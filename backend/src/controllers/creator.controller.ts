import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req, Query, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Scenario } from '../entities/scenario.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioAsset } from '../entities/scenario-asset.entity';
import { User } from '../entities/user.entity';
import { ImageVariant } from '../entities/image-variant.entity';
import { CreateScenarioDto, UpdateScenarioVersionDto } from '../dto/scenario.dto';
import { MinioService } from '../services/minio.service';
import { DockerImagesService } from '../services/docker-images.service';
import { ScenarioWorkflowService } from '../services/scenario-workflow.service';
import { SubmissionValidationService } from '../services/submission-validation.service';
import { JobQueueService } from '../services/job-queue.service';
import { FileOrganizationService, FileType } from '../services/file-organization.service';
import { v4 as uuid } from 'uuid';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';

@Controller('creator')
export class CreatorController {
  private readonly logger = new Logger(CreatorController.name);
  constructor(
    @InjectRepository(Scenario)
    private readonly scenarioRepo: Repository<Scenario>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioAsset)
    private readonly assetRepo: Repository<ScenarioAsset>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ImageVariant)
    private readonly imageVariantRepo: Repository<ImageVariant>,
    private readonly minioService: MinioService,
    private readonly dockerImagesService: DockerImagesService,
    private readonly workflowService: ScenarioWorkflowService,
    private readonly validationService: SubmissionValidationService,
    private readonly jobQueueService: JobQueueService,
    private readonly fileOrgService: FileOrganizationService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('scenarios')
  async listOwn(@Req() req: any, @Query('all') all?: string) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`listOwn user=${userId} all=${all}`);
    const isAdmin = req.user?.roleAdmin;
    const where = all === '1' && isAdmin ? {} : { createdByUserId: userId };
    const scenarios = await this.scenarioRepo.find({
      where,
      relations: ['versions', 'versions.machines'],
      order: { createdAt: 'DESC' },
    });
    
    // Fetch creator information if admin is viewing all
    let creatorMap = new Map<string, string>();
    if (all === '1' && isAdmin) {
      const creatorIds = [...new Set(scenarios.map(s => s.createdByUserId))];
      const creators = await this.userRepo.find({
        where: { id: In(creatorIds) },
        select: ['id', 'displayName', 'email'],
      });
      creators.forEach(user => {
        creatorMap.set(user.id, user.displayName || user.email);
      });
    }
    
    return scenarios.map((s) => {
      const versions = s.versions?.map((v) => this.mapVersion(v)) || [];
      const latestVersion = versions.slice().sort((a, b) => ((b as any).versionNumber || 0) - ((a as any).versionNumber || 0))[0];
      return {
        id: s.id,
        slug: s.slug,
        createdByUserId: s.createdByUserId,
        creatorName: creatorMap.get(s.createdByUserId) || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        versions,
        latestVersion,
      };
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 scenario creates/updates per minute
  async createScenario(@Req() req: any, @Body() dto: CreateScenarioDto & { baseScenarioId?: string }) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`createScenario user=${userId} baseScenarioId=${dto.baseScenarioId || 'none'}`);
    this.logger.log(`createScenario received fields: ${Object.keys(dto).join(', ')}`);
    this.logger.log(`createScenario title: ${dto.title}`);
    this.logger.log(`createScenario questions count: ${dto.questions?.length || 0}`);
    
    // Validate required fields
    if (!dto.title || dto.title.trim().length === 0) {
      this.logger.error('createScenario: Title is required');
      throw new BadRequestException('Scenario title is required');
    }
    
    let savedScenario: any;
    let versionNumber = 1;
    
    if (dto.baseScenarioId) {
      // Creating new version of existing scenario
      savedScenario = await this.scenarioRepo.findOne({ where: { id: dto.baseScenarioId } });
      if (!savedScenario) {
        throw new BadRequestException('Base scenario not found');
      }
      
      // Verify user has permission (owner or admin)
      const isAdmin = req.user?.roleAdmin;
      if (!isAdmin && savedScenario.createdByUserId !== userId) {
        throw new BadRequestException('Not authorized to create version of this scenario');
      }
      
      // Check if a draft version already exists for this scenario
      const existingDraft = await this.versionRepo.findOne({
        where: { 
          scenarioId: dto.baseScenarioId,
          status: ScenarioVersionStatus.DRAFT
        }
      });
      
      if (existingDraft) {
        throw new BadRequestException(
          'A draft version already exists for this scenario. Please edit or delete it before creating a new version.'
        );
      }
      
      // Get next version number from ALL versions in database (not just in-memory)
      const allVersions = await this.versionRepo.find({ 
        where: { scenarioId: dto.baseScenarioId },
        order: { versionNumber: 'DESC' },
      });
      
      // Find HIGHEST version number across ALL statuses
      const highestVersion = allVersions.length > 0 
        ? Math.max(...allVersions.map(v => v.versionNumber || 0))
        : 0;
      
      versionNumber = highestVersion + 1;
      
      this.logger.log(`Found ${allVersions.length} existing versions, highest is v${highestVersion}, creating v${versionNumber}`);
      this.logger.log(`Version statuses: ${allVersions.map(v => `v${v.versionNumber}=${v.status}`).join(', ')}`);
      
      // Get latest non-draft version to copy data from
      const existingVersions = allVersions.filter(v => v.status !== ScenarioVersionStatus.DRAFT);
      
      // ⚠️ CRITICAL: Removed check preventing new version creation - allow creating versions anytime
      
      // Copy metadata from previous version if not provided in DTO
      const previousVersion = existingVersions[0];
      if (previousVersion && !dto.coverImageUrl) {
        dto.coverImageUrl = previousVersion.coverImageUrl;
      }
      if (previousVersion && !dto.shortDescription) {
        dto.shortDescription = previousVersion.shortDescription;
      }
      if (previousVersion && !dto.difficulty) {
        dto.difficulty = previousVersion.difficulty;
      }
      if (previousVersion && !dto.category) {
        dto.category = previousVersion.category;
      }
      if (previousVersion && !dto.tags?.length) {
        dto.tags = previousVersion.tags;
      }
      if (previousVersion && !dto.codeOfEthics) {
        dto.codeOfEthics = previousVersion.codeOfEthics;
      }
      if (previousVersion && !dto.learningOutcomes) {
        dto.learningOutcomes = previousVersion.learningOutcomes;
      }
      
      this.logger.log(`Creating version ${versionNumber} of existing scenario ${dto.baseScenarioId}`);
    } else {
      // Creating brand new scenario
      const slug = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + uuid().slice(0, 6);
      const scenario = this.scenarioRepo.create({
        slug,
        createdByUserId: userId,
      });
      savedScenario = await this.scenarioRepo.save(scenario);
      this.logger.log(`Created new scenario ${savedScenario.id} with owner ${savedScenario.createdByUserId}`);
    }

    const version = this.versionRepo.create({
      scenarioId: savedScenario.id,
      versionNumber: versionNumber,
      status: ScenarioVersionStatus.DRAFT,
      title: dto.title,
      shortDescription: dto.shortDescription || '',
      difficulty: dto.difficulty || '',
      category: dto.category || '',
      tags: dto.tags ?? [],
      estimatedMinutes: dto.estimatedMinutes,
      scenarioType: dto.scenarioType,
      missionText: dto.missionText || '',
      solutionWriteup: dto.solutionWriteup || '',
      questions: dto.questions || [],
      hints: dto.hints || [],
      creatorName: dto.creatorName || '',
      codeOfEthics: dto.codeOfEthics || '',
      learningOutcomes: dto.learningOutcomes || '',
      coverImageUrl: dto.coverImageUrl || undefined,
    });
    const savedVersion: ScenarioVersion = await this.versionRepo.save(version) as ScenarioVersion;
    this.logger.log(`createScenario SAVED questions: ${JSON.stringify(savedVersion.questions)}`);

    // �️ Move temp images from missionText and solutionWriteup to permanent locations
    try {
      let missionTextUpdated = false;
      let solutionWriteupUpdated = false;

      // Process mission text temp images
      if (savedVersion.missionText && savedVersion.missionText.includes('scenarios/temp/')) {
        const tempImageRegex = /\/api\/assets\/file\/scenarios\/temp\/[^\/]+\/[^"\s]+/g;
        const tempImages = savedVersion.missionText.match(tempImageRegex) || [];
        
        for (const tempUrl of tempImages) {
          try {
            // Move file and get new URL
            const newPath = await this.fileOrgService.moveTempFile(
              tempUrl,
              {
                userId,
                scenarioId: savedScenario.id,
                versionId: savedVersion.id,
                fileType: FileType.MISSION_IMAGE,
                originalFilename: tempUrl.split('/').pop() || 'image.jpg',
                mimetype: 'image/jpeg',
              },
              this.minioService,
            );
            
            // Replace temp URL with permanent URL
            savedVersion.missionText = savedVersion.missionText.replace(tempUrl, newPath.publicUrl);
            missionTextUpdated = true;
            this.logger.log(`Moved mission temp image: ${tempUrl} → ${newPath.publicUrl}`);
          } catch (error: any) {
            this.logger.error(`Failed to move temp image: ${error?.message || error}`);
          }
        }
      }

      // Process solution writeup temp images
      if (savedVersion.solutionWriteup && savedVersion.solutionWriteup.includes('/api/assets/file/scenarios/temp/')) {
        this.logger.log('✅ Found temp images in solutionWriteup');
        const tempImageRegex = /\/api\/assets\/file\/scenarios\/temp\/[^\/]+\/[^"\s]+/g;
        const tempImages = savedVersion.solutionWriteup.match(tempImageRegex) || [];
        this.logger.log(`📸 Found ${tempImages.length} temp images in solutionWriteup: ${JSON.stringify(tempImages)}`);
        
        for (const tempUrl of tempImages) {
          try {
            const newPath = await this.fileOrgService.moveTempFile(
              tempUrl,
              {
                userId,
                scenarioId: savedScenario.id,
                versionId: savedVersion.id,
                fileType: FileType.WRITEUP_IMAGE,
                originalFilename: tempUrl.split('/').pop() || 'image.jpg',
                mimetype: 'image/jpeg',
              },
              this.minioService,
            );
            
            savedVersion.solutionWriteup = savedVersion.solutionWriteup.replace(tempUrl, newPath.publicUrl);
            solutionWriteupUpdated = true;
            this.logger.log(`Moved writeup temp image: ${tempUrl} → ${newPath.publicUrl}`);
          } catch (error: any) {
            this.logger.error(`Failed to move temp image: ${error?.message || error}`);
          }
        }
      }

      // Save updates if any temp files were moved
      if (missionTextUpdated || solutionWriteupUpdated) {
        const updatedVersion = await this.versionRepo.save(savedVersion);
        this.logger.log(`✅ [createScenario] Updated version with moved temp images`);
        this.logger.log(`📝 [createScenario] New missionText preview: ${updatedVersion.missionText?.substring(0, 200)}...`);
      }
    } catch (error: any) {
      this.logger.error(`Error processing temp images: ${error?.message || error}`);
      // Don't fail entire operation if image moving fails
    }

    // �🔄 Copy files from previous version to new version in MinIO (if creating new version)
    if (dto.baseScenarioId && versionNumber > 1) {
      try {
        const previousVersions = await this.versionRepo.find({
          where: { scenarioId: dto.baseScenarioId },
          order: { versionNumber: 'DESC' },
        });
        const previousVersion = previousVersions.find(v => v.versionNumber < versionNumber);
        
        if (previousVersion) {
          this.logger.log(`Copying files from version ${previousVersion.versionNumber} to version ${versionNumber}`);
          
          // Copy cover image
          if (previousVersion.coverImageUrl && typeof previousVersion.coverImageUrl === 'string') {
            const oldPath = previousVersion.coverImageUrl.replace('/api/assets/file/', '');
            // Validate: ensure path doesn't contain path traversal attempts
            if (oldPath.includes('..') || oldPath.includes('//')) {
              this.logger.warn(`Invalid cover image path detected: ${oldPath}`);
            } else {
              const newPath = oldPath.replace(
                `/${previousVersion.id}/`,
                `/${savedVersion.id}/`
              );
              
              try {
                await this.minioService.copyFile(oldPath, newPath);
                savedVersion.coverImageUrl = `/api/assets/file/${newPath}`;
                this.logger.log(`Copied cover image: ${oldPath} → ${newPath}`);
              } catch (error: any) {
                this.logger.warn(`Failed to copy cover image: ${error?.message || error}`);
              }
            }
          }
          
          // Copy docker compose
          if (previousVersion.dockerComposePath && typeof previousVersion.dockerComposePath === 'string') {
            const oldPath = previousVersion.dockerComposePath.replace('/api/assets/file/', '');
            // Validate: ensure path doesn't contain path traversal attempts
            if (oldPath.includes('..') || oldPath.includes('//')) {
              this.logger.warn(`Invalid docker compose path detected: ${oldPath}`);
            } else {
              const newPath = oldPath.replace(
                `/versions/${previousVersion.id}/`,
                `/versions/${savedVersion.id}/`
              );
              
              try {
                await this.minioService.copyFile(oldPath, newPath);
                savedVersion.dockerComposePath = `/api/assets/file/${newPath}`;
                this.logger.log(`Copied docker compose: ${oldPath} → ${newPath}`);
              } catch (error: any) {
                this.logger.warn(`Failed to copy docker compose: ${error?.message || error}`);
              }
            }
          }
          
          // Save updated file URLs
          if (previousVersion.coverImageUrl || previousVersion.dockerComposePath) {
            await this.versionRepo.save(savedVersion);
          }
        }
      } catch (error: any) {
        this.logger.error(`Error copying files from previous version: ${error?.message || error}`);
        // Don't fail the entire operation if file copy fails
      }
    }

    if (dto.machines?.length) {
      // Load image variants for auto-population
      const variantIds = dto.machines
        .filter(m => m.imageVariantId)
        .map(m => m.imageVariantId!);
      
      const variants = variantIds.length > 0
        ? await this.imageVariantRepo.findByIds(variantIds)
        : [];
      
      const variantMap = new Map(variants.map(v => [v.id, v]));

      const machines = dto.machines.map((m) => {
        let entrypoints = m.entrypoints;
        let allowSolverEntry = m.allowSolverEntry;

        // Auto-populate entrypoints from image variant if not provided
        if (m.imageVariantId && !entrypoints) {
          const variant = variantMap.get(m.imageVariantId);
          if (variant?.defaultEntrypoints?.length) {
            entrypoints = variant.defaultEntrypoints;
            this.logger.log(`Auto-populated ${entrypoints.length} entrypoints for machine ${m.name} from image variant`);
          }
        }

        // Derive allowSolverEntry from entrypoints if entrypoints are set
        if (entrypoints?.length && allowSolverEntry === undefined) {
          allowSolverEntry = entrypoints.some(e => e.exposedToSolver);
          this.logger.log(`Derived allowSolverEntry=${allowSolverEntry} for machine ${m.name} from entrypoints`);
        }

        return this.machineRepo.create({
          scenarioVersionId: savedVersion.id,
          name: m.name,
          role: m.role,
          imageSourceType: m.imageSourceType,
          imageRef: m.imageRef,
          imageVariantId: m.imageVariantId,
          registryCredentialId: m.registryCredentialId,
          networkGroup: m.networkGroup,
          resourceProfile: m.resourceProfile,
          entrypoints,
          allowSolverEntry,
          allowFromAttacker: m.allowFromAttacker,
          allowInternalConnections: m.allowInternalConnections,
          isPivotHost: m.isPivotHost,
          startupCommands: m.startupCommands,
        });
      });
      await this.machineRepo.save(machines);
      savedVersion.machines = machines;
    }

    const hydrated = await this.scenarioRepo.findOne({
      where: { id: savedScenario.id },
      relations: ['versions', 'versions.machines'],
    });
    
    // Return structure expected by frontend
    return {
      scenarioId: savedScenario.id,
      versionId: savedVersion.id,
      ...hydrated,
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('scenarios/:scenarioId')
  async deleteScenario(@Req() req: any, @Param('scenarioId') scenarioId: string) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) throw new BadRequestException('Scenario not found');
    if (!isAdmin && scenario.createdByUserId !== userId) throw new BadRequestException('Scenario not found');
    
    const versions = await this.versionRepo.find({ where: { scenarioId } });
    const versionIds = versions.map((v) => v.id);
    
    // Delete from database
    if (versionIds.length) {
      await this.machineRepo.delete({ scenarioVersionId: In(versionIds) });
      await this.versionRepo.delete(versionIds);
    }
    await this.scenarioRepo.delete(scenarioId);
    
    // Cleanup MinIO resources in background (don't block response)
    this.cleanupScenarioMinioResources(scenarioId).catch((error) => {
      this.logger.error(`Failed to cleanup MinIO resources for scenario ${scenarioId}:`, error);
    });
    
    return { deleted: true };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('scenarios/:scenarioId/versions/:versionId')
  async deleteScenarioVersion(
    @Req() req: any,
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    // Verify scenario exists and user has permission
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) throw new BadRequestException('Scenario not found');
    if (!isAdmin && scenario.createdByUserId !== userId) {
      throw new BadRequestException('Not authorized to delete this version');
    }

    // Verify version exists and belongs to this scenario
    const version = await this.versionRepo.findOne({ 
      where: { id: versionId, scenarioId } 
    });
    if (!version) throw new BadRequestException('Version not found');

    // ⚠️ DELETE PROTECTION: Block deleting APPROVED or PUBLISHED scenarios
    if (version.status === 'APPROVED' || version.status === 'PUBLISHED') {
      throw new BadRequestException(
        `Cannot delete ${version.status} scenario version. ` +
        `Only DRAFT, SUBMITTED, or REJECTED scenarios can be deleted. ` +
        `Please contact an administrator to revert this scenario to DRAFT before deletion.`
      );
    }

    // Check if this is the only version
    const versionCount = await this.versionRepo.count({ where: { scenarioId } });
    if (versionCount === 1) {
      // If this is the last version, delete the entire scenario
      await this.machineRepo.delete({ scenarioVersionId: versionId });
      await this.versionRepo.delete(versionId);
      await this.scenarioRepo.delete(scenarioId);
      
      // Cleanup MinIO resources
      this.cleanupScenarioMinioResources(scenarioId).catch((error) => {
        this.logger.error(`Failed to cleanup MinIO resources for scenario ${scenarioId}:`, error);
      });

      return { deleted: true, deletedScenario: true };
    }

    // Prevent deletion of approved/live versions (only drafts can be deleted)
    if (version.status !== ScenarioVersionStatus.DRAFT) {
      throw new BadRequestException('Cannot delete non-draft versions. Only draft versions can be deleted.');
    }

    // Delete the version and its machines
    await this.machineRepo.delete({ scenarioVersionId: versionId });
    await this.versionRepo.delete(versionId);

    // Cleanup MinIO resources for this version
    this.cleanupVersionMinioResources(scenarioId, versionId).catch((error) => {
      this.logger.error(`Failed to cleanup MinIO resources for version ${versionId}:`, error);
    });

    return { deleted: true, deletedScenario: false };
  }

  /**
   * Cleanup MinIO resources for a specific version
   */
  private async cleanupVersionMinioResources(scenarioId: string, versionId: string): Promise<void> {
    try {
      this.logger.log(`Cleaning up MinIO resources for version: ${versionId}`);
      
      const foldersToClean = [
        `scenarios/cover-images/${scenarioId}/${versionId}`,
        `scenarios/editor-images/${scenarioId}/${versionId}`,
        `scenarios/assets/images/${scenarioId}/${versionId}`,
        `scenarios/assets/tools/${scenarioId}/${versionId}`,
      ];
      
      for (const folder of foldersToClean) {
        try {
          await this.minioService.deleteFolder(folder);
          this.logger.log(`Deleted MinIO folder: ${folder}`);
        } catch (error) {
          this.logger.warn(`Failed to delete MinIO folder ${folder}:`, error);
        }
      }
      
      this.logger.log(`Completed MinIO cleanup for version: ${versionId}`);
    } catch (error) {
      this.logger.error(`Error during MinIO cleanup for version ${versionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Cleanup all MinIO resources associated with a scenario
   */
  private async cleanupScenarioMinioResources(scenarioId: string): Promise<void> {
    try {
      this.logger.log(`Cleaning up MinIO resources for scenario: ${scenarioId}`);
      
      // Paths to clean:
      // - scenarios/cover-images/{scenarioId}/{versionId}/
      // - scenarios/editor-images/{scenarioId}/{versionId}/
      // - scenarios/assets/images/{scenarioId}/{versionId}/
      // - scenarios/assets/tools/{scenarioId}/{versionId}/
      // Note: We clean by scenario ID to remove all versions when deleting scenario
      
      const foldersToClean = [
        `scenarios/cover-images/${scenarioId}`,
        `scenarios/editor-images/${scenarioId}`,
        `scenarios/assets/images/${scenarioId}`,
        `scenarios/assets/tools/${scenarioId}`,
      ];
      
      for (const folder of foldersToClean) {
        try {
          await this.minioService.deleteFolder(folder);
          this.logger.log(`Deleted MinIO folder: ${folder}`);
        } catch (error) {
          this.logger.warn(`Failed to delete MinIO folder ${folder}:`, error);
        }
      }
      
      this.logger.log(`Completed MinIO cleanup for scenario: ${scenarioId}`);
    } catch (error) {
      this.logger.error(`Error during MinIO cleanup for scenario ${scenarioId}:`, error);
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios/:scenarioId/duplicate')
  async duplicateScenario(@Req() req: any, @Param('scenarioId') scenarioId: string) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId }, relations: ['versions', 'versions.machines'] });
    if (!scenario) throw new BadRequestException('Scenario not found');
    if (!isAdmin && scenario.createdByUserId !== userId) throw new BadRequestException('Scenario not found');
    const latest = scenario.versions?.sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const newSlug = scenario.slug + '-copy-' + uuid().slice(0, 4);
    const newScenario = await this.scenarioRepo.save(this.scenarioRepo.create({ slug: newSlug, createdByUserId: userId }));
    if (latest) {
      const newVersion = this.versionRepo.create({
        scenarioId: newScenario.id,
        versionNumber: 1,
        status: ScenarioVersionStatus.DRAFT,
        title: `${latest.title} (Copy)`,
        shortDescription: latest.shortDescription,
        difficulty: latest.difficulty,
        category: latest.category,
        tags: latest.tags,
        estimatedMinutes: latest.estimatedMinutes,
        scenarioType: latest.scenarioType,
        missionText: latest.missionText,
        solutionWriteup: latest.solutionWriteup,
      });
      const savedVersion = await this.versionRepo.save(newVersion);
      if (latest.machines?.length) {
        const copies = latest.machines.map((m) =>
          this.machineRepo.create({
            scenarioVersionId: savedVersion.id,
            name: m.name,
            role: m.role,
            imageSourceType: m.imageSourceType,
            imageRef: m.imageRef,
            registryCredentialId: m.registryCredentialId,
            networkGroup: m.networkGroup,
            resourceProfile: m.resourceProfile,
            allowSolverEntry: m.allowSolverEntry,
            allowFromAttacker: m.allowFromAttacker,
            allowInternalConnections: m.allowInternalConnections,
            isPivotHost: m.isPivotHost,
            startupCommands: m.startupCommands,
          }),
        );
        await this.machineRepo.save(copies);
      }
    }
    return this.listOwn(req);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('scenarios/:scenarioId/versions/:versionId')
  async getVersion(@Req() req: any, @Param('scenarioId') scenarioId: string, @Param('versionId') versionId: string) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Scenario not found');
    if (!isAdmin && scenario.createdByUserId !== userId) throw new ForbiddenException();
    const version = await this.versionRepo.findOne({ where: { id: versionId, scenarioId }, relations: ['machines', 'assets'] });
    if (!version) throw new NotFoundException('Version not found');
    return this.mapVersion(version);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Put('scenarios/:scenarioId/versions/:versionId')
  async updateVersion(
    @Req() req: any,
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateScenarioVersionDto,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    this.logger.log(`updateVersion user=${userId} versionId=${versionId} dto=${JSON.stringify(dto).slice(0, 300)}`);
    const isAdmin = req.user?.roleAdmin;
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Scenario not found');
    if (!isAdmin && scenario.createdByUserId !== userId) throw new ForbiddenException();
    
    // Clean up ALL orphaned machines with NULL scenarioVersionId FIRST (before loading version)
    const orphanedMachines = await this.machineRepo.find({ 
      where: { scenarioVersionId: IsNull() }
    });
    if (orphanedMachines.length > 0) {
      await this.machineRepo.remove(orphanedMachines);
      this.logger.log(`[CLEANUP] Deleted ${orphanedMachines.length} orphaned machines with NULL scenarioVersionId`);
    }
    
    // Don't load machines relation - they're synced separately
    const version = await this.versionRepo.findOne({ where: { id: versionId, scenarioId } });
    if (!version) throw new NotFoundException('Version not found');
    
    // ⚠️ VERSION VALIDATION: Check if a newer version exists in SUBMITTED/APPROVED/PUBLISHED
    const allVersions = await this.versionRepo.find({
      where: { scenarioId },
      order: { versionNumber: 'DESC' }
    });
    const latestVersion = allVersions.length > 0 ? allVersions[0] : null;
    
    if (latestVersion && latestVersion.versionNumber > version.versionNumber &&
        (latestVersion.status === ScenarioVersionStatus.SUBMITTED || 
         latestVersion.status === ScenarioVersionStatus.APPROVED ||
         latestVersion.status === ScenarioVersionStatus.PUBLISHED)) {
      this.logger.warn(`Attempted to edit v${version.versionNumber} while v${latestVersion.versionNumber} is ${latestVersion.status}`);
      throw new BadRequestException(
        `Cannot edit version ${version.versionNumber}: A newer version ${latestVersion.versionNumber} already exists with status ${latestVersion.status}. ` +
        `Only the latest version can be edited.`
      );
    }
    
    // ⚠️ EDIT PROTECTION: Block editing APPROVED or PUBLISHED scenarios
    if (version.status === 'APPROVED' || version.status === 'PUBLISHED') {
      throw new BadRequestException(
        `Cannot edit scenario with status ${version.status}. ` +
        `Only DRAFT scenarios can be edited. Please contact an administrator to revert this scenario to DRAFT if changes are needed.`
      );
    }
    
    // **BEST PRACTICE**: Extract machines before Object.assign to prevent TypeORM from tracking them
    const machinesFromDto = dto.machines;
    delete dto.machines; // Remove machines from DTO so Object.assign won't touch the relationship
    
    // Extract assets from DTO before Object.assign
    const assetsFromDto = dto.assets;
    delete dto.assets; // Remove assets from DTO so Object.assign won't touch the relationship
    
    // Auto-detect requiresMachines based on DTO machines array
    const hasConfiguredMachines = machinesFromDto && Array.isArray(machinesFromDto) && machinesFromDto.length > 0;
    dto.requiresMachines = hasConfiguredMachines;
    
    Object.assign(version, dto); // Now safe - no machines or assets property in dto
    version.updatedAt = new Date();
    const saved = await this.versionRepo.save(version);
    
    // 🖼️ Move temp images from missionText and solutionWriteup to permanent locations
    try {
      this.logger.log('🖼️ [updateVersion] Starting temp image processing...');
      const userId = req.user?.sub || req.user?.userId;
      let missionTextUpdated = false;
      let solutionWriteupUpdated = false;

      // Process mission text temp images
      if (saved.missionText && saved.missionText.includes('/api/assets/file/scenarios/temp/')) {
        this.logger.log('✅ [updateVersion] Found temp images in missionText');
        const tempImageRegex = /\/api\/assets\/file\/scenarios\/temp\/[^\/]+\/[^"\s]+/g;
        const tempImages = saved.missionText.match(tempImageRegex) || [];
        this.logger.log(`📸 [updateVersion] Found ${tempImages.length} temp images in missionText: ${JSON.stringify(tempImages)}`);
        
        for (const tempUrl of tempImages) {
          try {
            const newPath = await this.fileOrgService.moveTempFile(
              tempUrl,
              {
                userId,
                scenarioId,
                versionId: saved.id,
                fileType: FileType.MISSION_IMAGE,
                originalFilename: tempUrl.split('/').pop() || 'image.jpg',
                mimetype: 'image/jpeg',
              },
              this.minioService,
            );
            
            saved.missionText = saved.missionText.replace(tempUrl, newPath.publicUrl);
            missionTextUpdated = true;
            this.logger.log(`Moved mission temp image: ${tempUrl} → ${newPath.publicUrl}`);
          } catch (error: any) {
            this.logger.error(`Failed to move temp image: ${error?.message || error}`);
          }
        }
      }

      // Process solution writeup temp images
      if (saved.solutionWriteup && saved.solutionWriteup.includes('/api/assets/file/scenarios/temp/')) {
        this.logger.log('✅ [updateVersion] Found temp images in solutionWriteup');
        const tempImageRegex = /\/api\/assets\/file\/scenarios\/temp\/[^\/]+\/[^"\s]+/g;
        const tempImages = saved.solutionWriteup.match(tempImageRegex) || [];
        this.logger.log(`📸 [updateVersion] Found ${tempImages.length} temp images in solutionWriteup: ${JSON.stringify(tempImages)}`);
        
        for (const tempUrl of tempImages) {
          try {
            const newPath = await this.fileOrgService.moveTempFile(
              tempUrl,
              {
                userId,
                scenarioId,
                versionId: saved.id,
                fileType: FileType.WRITEUP_IMAGE,
                originalFilename: tempUrl.split('/').pop() || 'image.jpg',
                mimetype: 'image/jpeg',
              },
              this.minioService,
            );
            
            saved.solutionWriteup = saved.solutionWriteup.replace(tempUrl, newPath.publicUrl);
            solutionWriteupUpdated = true;
            this.logger.log(`Moved writeup temp image: ${tempUrl} → ${newPath.publicUrl}`);
          } catch (error: any) {
            this.logger.error(`Failed to move temp image: ${error?.message || error}`);
          }
        }
      }

      // Save updates if any temp files were moved
      if (missionTextUpdated || solutionWriteupUpdated) {
        const updatedVersion = await this.versionRepo.save(saved);
        this.logger.log(`✅ Updated version with moved temp images`);
        this.logger.log(`📝 New missionText preview: ${updatedVersion.missionText?.substring(0, 200)}...`);
      }
    } catch (error: any) {
      this.logger.error(`Error processing temp images: ${error?.message || error}`);
      // Don't fail entire operation if image moving fails
    }
    
    // Sync machines from DTO to Machine entities (if provided)
    const machineIdMapping = new Map<string, string>(); // Map old temporary IDs to new database IDs
    if (machinesFromDto && Array.isArray(machinesFromDto) && machinesFromDto.length > 0) {
      this.logger.log(`Syncing ${machinesFromDto.length} machines to Machine entities`);
      
      // Delete ALL existing machines for this version
      const existingMachines = await this.machineRepo.find({ 
        where: { scenarioVersionId: versionId }
      });
      if (existingMachines.length > 0) {
        await this.machineRepo.remove(existingMachines);
        this.logger.log(`Deleted ${existingMachines.length} existing machines`);
      }
      
      // Create new Machine entities and track ID mappings
      for (const machineInput of machinesFromDto) {
        if (!machineInput.name || !machineInput.role) continue; // Skip incomplete machines
        
        const oldId = machineInput.id; // Store the temporary/old ID from frontend
        
        const machine = this.machineRepo.create({
          scenarioVersionId: versionId,
          name: machineInput.name,
          role: machineInput.role,
          imageSourceType: machineInput.imageSourceType,
          imageRef: machineInput.imageRef,
          registryCredentialId: machineInput.registryCredentialId || null,
          networkGroup: machineInput.networkGroup || '', // Default to empty - must be explicitly set
          resourceProfile: machineInput.resourceProfile,
          allowSolverEntry: machineInput.allowSolverEntry,
          allowFromAttacker: machineInput.allowFromAttacker,
          allowInternalConnections: machineInput.allowInternalConnections,
          isPivotHost: machineInput.isPivotHost,
          startupCommands: machineInput.startupCommands || undefined,
        });
        
        const savedMachine = await this.machineRepo.save(machine);
        
        // Map old ID to new database ID (try both ID and name+role for matching)
        if (oldId) {
          machineIdMapping.set(oldId, savedMachine.id);
          this.logger.log(`Machine ID mapping: ${oldId} -> ${savedMachine.id}`);
        }
        // Also create mapping by name+role as fallback
        const nameRoleKey = `${machineInput.name}:${machineInput.role}`;
        machineIdMapping.set(nameRoleKey, savedMachine.id);
        this.logger.log(`Machine name+role mapping: ${nameRoleKey} -> ${savedMachine.id}`);
      }
      
      this.logger.log(`Synced ${machinesFromDto.length} machines to Machine entities successfully`);
    }
    
    // Sync assets from DTO to ScenarioAsset entities (if provided)
    if (assetsFromDto && Array.isArray(assetsFromDto)) {
      this.logger.log(`Syncing ${assetsFromDto.length} assets to ScenarioAsset entities`);
      
      // Filter out pending-upload assets (they're uploaded separately via uploadAsset endpoint)
      const validAssets = assetsFromDto.filter(a => 
        a.status !== 'pending-upload' && a.fileName && (a.fileUrl || a.status === 'library-reference')
      );
      
      this.logger.log(`Found ${validAssets.length} valid assets (filtered out ${assetsFromDto.length - validAssets.length} pending uploads)`);
      
      // Delete ALL existing assets for this version
      const existingAssets = await this.assetRepo.find({
        where: { scenarioVersionId: versionId }
      });
      if (existingAssets.length > 0) {
        await this.assetRepo.remove(existingAssets);
        this.logger.log(`Deleted ${existingAssets.length} existing assets`);
      }
      
      // Create new ScenarioAsset entities with updated machine IDs
      for (const assetInput of validAssets) {
        if (!assetInput.fileName) continue; // Skip incomplete assets
        
        // Map old machineId to new database ID if it exists
        let machineId = assetInput.machineId;
        if (machineId && machineIdMapping.has(machineId)) {
          const newMachineId = machineIdMapping.get(machineId);
          this.logger.log(`Mapping asset machineId: ${machineId} -> ${newMachineId}`);
          machineId = newMachineId;
        } else if (machineId && assetInput.machineName) {
          // Try to find machine by name if ID mapping failed
          const machine = await this.machineRepo.findOne({
            where: { scenarioVersionId: versionId, name: assetInput.machineName }
          });
          if (machine) {
            this.logger.log(`Found machine by name: ${assetInput.machineName} -> ${machine.id}`);
            machineId = machine.id;
          } else {
            this.logger.warn(`Could not find machine: ${assetInput.machineName}, asset will have null machineId`);
            machineId = null;
          }
        }
        
        const asset = this.assetRepo.create({
          scenarioVersionId: versionId,
          fileName: assetInput.fileName,
          fileUrl: assetInput.fileUrl || null, // Library assets have fileUrl, uploaded will get it later
          assetLocation: assetInput.assetLocation || 'downloadable',
          machineId: machineId || null,
          targetPath: assetInput.targetPath || null,
          permissions: assetInput.permissions || '0644',
          description: assetInput.description || null,
          fileSize: assetInput.fileSize || 0,
          minioPath: assetInput.minioPath || null,
          deletedFromMinio: false,
        });
        
        await this.assetRepo.save(asset);
      }
      
      this.logger.log(`Synced ${validAssets.length} assets to ScenarioAsset entities successfully`);
    }
    
    // ⚠️ CRITICAL: Use { reload: true } to bypass TypeORM cache and get fresh data from DB
    const refreshed = await this.versionRepo.findOne({ 
      where: { id: versionId }, 
      relations: ['machines', 'assets'],
      cache: false // Disable query result caching
    });
    
    // Force reload from database to ensure we get the latest missionText with permanent image URLs
    if (refreshed) {
      await this.versionRepo.manager.connection.queryResultCache?.remove(['scenario_version', versionId]);
    }
    
    this.logger.log(`updateVersion REFRESHED questions: ${JSON.stringify(refreshed?.questions)}`);
    
    // 🔍 Log what we're returning to verify image URLs are updated
    if (refreshed?.missionText?.includes('/api/assets/file/scenarios/')) {
      const imageUrls = refreshed.missionText.match(/\/api\/assets\/file\/scenarios\/[^\s"]+/g) || [];
      this.logger.log(`🔍 Returning ${imageUrls.length} image URLs in missionText: ${JSON.stringify(imageUrls)}`);
    }
    
    return refreshed ? this.mapVersion(refreshed) : null;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('scenario-versions/:versionId/machines')
  async listMachines(@Req() req: any, @Param('versionId') versionId: string) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) throw new ForbiddenException();
    return this.machineRepo.find({ where: { scenarioVersionId: versionId } });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenario-versions/:versionId/machines')
  async addMachine(@Req() req: any, @Param('versionId') versionId: string, @Body() dto: any) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    const version = await this.versionRepo.findOne({ where: { id: versionId }, relations: ['scenario'] });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) throw new ForbiddenException();
    const machine = this.machineRepo.create({
      scenarioVersionId: versionId,
      name: dto.name,
      role: dto.role,
      imageSourceType: dto.imageSourceType,
      imageRef: dto.imageRef,
      registryCredentialId: dto.registryCredentialId,
      networkGroup: dto.networkGroup,
      resourceProfile: dto.resourceProfile,
      allowSolverEntry: dto.allowSolverEntry,
      allowFromAttacker: dto.allowFromAttacker,
      allowInternalConnections: dto.allowInternalConnections,
      isPivotHost: dto.isPivotHost,
      startupCommands: dto.startupCommands,
    });
    const saved = await this.machineRepo.save(machine);
    return saved;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Put('machines/:id')
  async updateMachine(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    this.logger.log(`🔥 [updateMachine] Received update for machine ${id}`);
    this.logger.log(`🔥 [updateMachine] DTO keys: ${Object.keys(dto).join(', ')}`);
    this.logger.log(`🔥 [updateMachine] imageVariantId: ${dto.imageVariantId}`);
    this.logger.log(`🔥 [updateMachine] networkEgressPolicy: ${dto.networkEgressPolicy}`);
    this.logger.log(`🔥 [updateMachine] entrypoints: ${JSON.stringify(dto.entrypoints)}`);
    
    const machine = await this.machineRepo.findOne({ where: { id }, relations: ['scenarioVersion', 'scenarioVersion.scenario'] });
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    if (!machine) throw new NotFoundException('Machine not found');
    if (!isAdmin && machine.scenarioVersion.scenario.createdByUserId !== userId) throw new ForbiddenException();
    
    this.logger.log(`🔥 [updateMachine] Before update - imageVariantId: ${machine.imageVariantId}, networkEgressPolicy: ${machine.networkEgressPolicy}`);
    Object.assign(machine, dto);
    this.logger.log(`🔥 [updateMachine] After assign - imageVariantId: ${machine.imageVariantId}, networkEgressPolicy: ${machine.networkEgressPolicy}`);
    
    const saved = await this.machineRepo.save(machine);
    this.logger.log(`🔥 [updateMachine] After save - imageVariantId: ${saved.imageVariantId}, networkEgressPolicy: ${saved.networkEgressPolicy}`);
    
    return saved;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('machines/:id')
  async deleteMachine(@Req() req: any, @Param('id') id: string) {
    const machine = await this.machineRepo.findOne({ where: { id }, relations: ['scenarioVersion', 'scenarioVersion.scenario'] });
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;
    if (!machine) throw new NotFoundException('Machine not found');
    if (!isAdmin && machine.scenarioVersion.scenario.createdByUserId !== userId) throw new ForbiddenException();
    await this.machineRepo.delete(id);
    return { deleted: true };
  }

  // Old submission method removed - using workflow service now

  private mapVersion(v: ScenarioVersion) {
    this.logger.log(`mapVersion questions from DB: ${JSON.stringify(v.questions)}`);
    
    // Convert dockerComposePath to API URL if it exists
    let dockerComposeUrl: string | undefined;
    if (v.dockerComposePath) {
      // Convert MinIO path to API endpoint: /api/assets/file/docker-compose/...
      dockerComposeUrl = `/api/assets/file/docker-compose/${v.dockerComposePath}`;
    }
    
    const mapped = {
      id: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      title: v.title,
      shortDescription: v.shortDescription,
      difficulty: v.difficulty,
      category: v.category,
      tags: v.tags ?? [],
      coverImageUrl: v.coverImageUrl,
      dockerComposeUrl,
      estimatedMinutes: v.estimatedMinutes,
      scenarioType: v.scenarioType,
      creatorName: v.creatorName,
      requiresMachines: v.requiresMachines,
      codeOfEthics: v.codeOfEthics,
      validationMode: v.validationMode,
      scoringMode: v.scoringMode,
      hintMode: v.hintMode,
      learningOutcomes: v.learningOutcomes,
      missionText: v.missionText,
      solutionWriteup: v.solutionWriteup,
      questions: v.questions ?? [],
      hints: v.hints ?? [],
      submittedAt: v.submittedAt,
      approvedAt: v.approvedAt,
      rejectedAt: v.rejectedAt,
      rejectReason: v.rejectReason,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      machines: v.machines ?? [],
      assets: v.assets?.map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        assetType: a.assetType,
        assetLocation: a.assetLocation,
        machineId: a.machineId,
        targetPath: a.targetPath,
        permissions: a.permissions,
        description: a.description,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt,
      })) ?? [],
    };
    this.logger.log(`mapVersion returning questions: ${JSON.stringify(mapped.questions)}`);
    return mapped;
  }

  /**
   * Upload cover image for a scenario version
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios/:scenarioId/versions/:versionId/upload-cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCoverImage(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`uploadCoverImage scenarioId=${scenarioId} versionId=${versionId} user=${userId}`);

    // Validate file
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type (images only)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Check permissions
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this scenario');
    }

    // Delete old cover image if exists
    if (version.coverImageUrl) {
      try {
        // Security: Validate the path before deletion
        // Extract path from URL: http://localhost:9000/rangex-assets/scenarios/cover-images/...
        // Strip query parameters (e.g., ?t=timestamp) before processing
        const urlWithoutQuery = version.coverImageUrl.split('?')[0];
        const bucketMatch = urlWithoutQuery.match(/\/rangex-assets\/(.+)$/);
        if (!bucketMatch) {
          this.logger.warn(`Could not extract path from cover image URL: ${version.coverImageUrl}`);
        } else {
          const urlPath = bucketMatch[1];
          if (urlPath.includes('..') || urlPath.includes('//')) {
            this.logger.error(`Path traversal detected in cover image URL: ${version.coverImageUrl}`);
            throw new BadRequestException('Invalid cover image path');
          }
          
          this.logger.log(`Deleting old cover image: ${urlPath}`);
          await this.minioService.deleteFile(urlPath);
          this.logger.log(`Old cover image deleted successfully`);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete old cover image: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Upload new cover image
    const fileName = `${uuid()}-${file.originalname}`;
    const objectPath = `scenarios/cover-images/${scenarioId}/${versionId}/${fileName}`;
    const fileUrl = await this.minioService.uploadFile(file.buffer, objectPath);

    // Update version with new cover image URL
    version.coverImageUrl = fileUrl;
    await this.versionRepo.save(version);

    this.logger.log(`Cover image uploaded successfully: ${fileUrl}`);

    return {
      url: fileUrl,
      coverImageUrl: fileUrl,
      message: 'Cover image uploaded successfully',
    };
  }

  /**
   * Upload asset (machine-embedded or downloadable) for a scenario version
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios/:scenarioId/versions/:versionId/upload-asset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Body('assetLocation') assetLocation: string,
    @Body('machineId') machineId: string,
    @Body('targetPath') targetPath: string,
    @Body('permissions') permissions: string,
    @Body('description') description: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`uploadAsset scenarioId=${scenarioId} versionId=${versionId} location=${assetLocation} machine=${machineId} target=${targetPath} user=${userId}`);

    // Validate file
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate asset location
    const allowedLocations = ['machine-embedded', 'downloadable'];
    if (!assetLocation || !allowedLocations.includes(assetLocation)) {
      throw new BadRequestException('Invalid asset location. Must be: machine-embedded or downloadable');
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 100MB limit');
    }

    // Validate machine assignment for embedded assets
    if (assetLocation === 'machine-embedded') {
      if (!machineId) {
        throw new BadRequestException('Machine ID is required for machine-embedded assets');
      }

      const machine = await this.machineRepo.findOne({
        where: { id: machineId, scenarioVersionId: versionId },
      });
      if (!machine) {
        throw new BadRequestException('Machine not found or does not belong to this scenario version');
      }

      // Validate target path (must be absolute)
      if (!targetPath || !targetPath.startsWith('/')) {
        throw new BadRequestException('Target path must be an absolute path (start with /) for embedded assets');
      }
    }

    // Check permissions
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this scenario');
    }

    // Upload to MinIO with new folder structure
    const fileName = `${uuid()}-${file.originalname}`;
    let minioPath: string;
    
    if (assetLocation === 'machine-embedded') {
      // scenarios/{scenarioId}/assets/machines/{machineId}/{fileName}
      minioPath = `scenarios/${scenarioId}/assets/machines/${machineId}/${fileName}`;
    } else {
      // scenarios/{scenarioId}/assets/downloads/{fileName}
      minioPath = `scenarios/${scenarioId}/assets/downloads/${fileName}`;
    }

    const fileUrl = await this.minioService.uploadFile(file.buffer, minioPath);

    this.logger.log(`Asset uploaded successfully: ${fileUrl} at ${minioPath}`);

    // Save asset metadata to scenario_asset table
    const asset = new ScenarioAsset();
    asset.scenarioVersionId = versionId;
    asset.assetLocation = assetLocation as 'machine-embedded' | 'downloadable';
    asset.fileName = file.originalname;
    asset.fileUrl = fileUrl;
    asset.minioPath = minioPath;
    asset.fileSize = file.size;
    asset.deletedFromMinio = false;
    asset.machineId = machineId || undefined;
    asset.targetPath = targetPath || undefined;
    asset.permissions = permissions || '0644';
    asset.description = description || undefined;
    await this.assetRepo.save(asset);

    return {
      id: asset.id,
      url: fileUrl,
      minioPath,
      fileName: file.originalname,
      assetLocation,
      fileSize: file.size,
      machineId: asset.machineId,
      targetPath: asset.targetPath,
      permissions: asset.permissions,
      message: 'Asset uploaded successfully',
    };
  }

  /**
   * Delete uploaded asset by assetId (NEW - frontend expects this)
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('scenarios/:scenarioId/versions/:versionId/assets/:assetId')
  async deleteAssetById(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Param('assetId') assetId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`deleteAssetById scenarioId=${scenarioId} versionId=${versionId} assetId=${assetId} user=${userId}`);

    // Load asset to get fileUrl
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, scenarioVersionId: versionId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Check permissions
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this scenario');
    }

    // Delete file from MinIO if it exists
    if (asset.minioPath) {
      try {
        await this.minioService.deleteFile(asset.minioPath);
      } catch (error) {
        this.logger.warn(`Failed to delete MinIO file ${asset.minioPath}:`, error);
      }
    }

    // Delete from database
    await this.assetRepo.delete({ id: assetId });

    this.logger.log(`Asset deleted successfully: ${assetId}`);

    return {
      message: 'Asset deleted successfully',
    };
  }

  /**
   * Delete uploaded asset by fileUrl (LEGACY - for backwards compatibility)
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('scenarios/:scenarioId/versions/:versionId/asset')
  async deleteAsset(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Body('fileUrl') fileUrl: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`deleteAsset scenarioId=${scenarioId} versionId=${versionId} user=${userId}`);

    if (!fileUrl) {
      throw new BadRequestException('fileUrl is required');
    }
    
    // Strip query parameters before processing
    const fileUrlWithoutQuery = fileUrl.split('?')[0];
    
    // Security: Validate path format and prevent path traversal
    const urlPath = fileUrlWithoutQuery.replace(/^https?:\/\/[^\/]+\/[^\/]+\//, '');
    if (urlPath.includes('..') || urlPath.includes('//')) {
      this.logger.error(`Path traversal detected in asset URL: ${fileUrl}`);
      throw new ForbiddenException('Invalid asset path: path traversal detected');
    }
    
    // Security: Only allow deletion from scenarios/assets/ folder
    if (!urlPath.startsWith('scenarios/assets/')) {
      this.logger.error(`Unauthorized asset path: ${urlPath}`);
      throw new ForbiddenException('Can only delete assets from scenarios/assets/ folder');
    }

    // Check permissions
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this scenario');
    }

    // Delete file from MinIO
    await this.minioService.deleteFile(urlPath);

    // Delete from scenario_asset table
    await this.assetRepo.delete({ fileUrl });

    this.logger.log(`Asset deleted successfully: ${fileUrl}`);

    return {
      message: 'Asset deleted successfully',
    };
  }

  /**
   * Get all assets for a scenario version
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('scenarios/:scenarioId/versions/:versionId/assets')
  async listAssets(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`listAssets scenarioId=${scenarioId} versionId=${versionId} user=${userId}`);

    // Check permissions
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!isAdmin && version.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to view this scenario');
    }

    // Get assets with machine details
    const assets = await this.assetRepo.find({
      where: { scenarioVersionId: versionId },
      relations: ['machine'],
      order: { uploadedAt: 'DESC' },
    });

    return assets.map(asset => ({
      id: asset.id,
      fileName: asset.fileName,
      assetType: asset.assetType,
      fileSize: asset.fileSize,
      fileUrl: asset.fileUrl,
      machineId: asset.machineId,
      machineName: asset.machine?.name || null,
      targetPath: asset.targetPath,
      permissions: asset.permissions,
      description: asset.description,
      uploadedAt: asset.uploadedAt,
    }));
  }

  /**
   * Update asset assignment (machine, target path, permissions)
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Put('assets/:assetId/assign')
  async updateAssetAssignment(
    @Param('assetId') assetId: string,
    @Body('machineId') machineId: string,
    @Body('targetPath') targetPath: string,
    @Body('permissions') permissions: string,
    @Body('description') description: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const isAdmin = req.user?.roleAdmin;

    this.logger.log(`updateAssetAssignment assetId=${assetId} machineId=${machineId} targetPath=${targetPath} user=${userId}`);

    // Get asset with scenario
    const asset = await this.assetRepo.findOne({
      where: { id: assetId },
      relations: ['scenarioVersion', 'scenarioVersion.scenario'],
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // Check permissions
    if (!isAdmin && asset.scenarioVersion.scenario.createdByUserId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this asset');
    }

    // Validate machine assignment (if provided)
    if (machineId) {
      const machine = await this.machineRepo.findOne({
        where: { id: machineId, scenarioVersionId: asset.scenarioVersionId },
      });
      if (!machine) {
        throw new BadRequestException('Machine not found or does not belong to this scenario version');
      }

      // Validate target path (must be absolute)
      if (targetPath && !targetPath.startsWith('/')) {
        throw new BadRequestException('Target path must be an absolute path (start with /)');
      }
    }

    // Update assignment
    asset.machineId = machineId || undefined;
    asset.targetPath = targetPath || undefined;
    asset.permissions = permissions || '0644';
    asset.description = description || undefined;
    await this.assetRepo.save(asset);

    this.logger.log(`Asset assignment updated successfully: ${assetId}`);

    return {
      id: asset.id,
      machineId: asset.machineId,
      targetPath: asset.targetPath,
      permissions: asset.permissions,
      description: asset.description,
      message: 'Asset assignment updated successfully',
    };
  }

  // ==================== Docker Images Management ====================

  /**
   * Get available Docker images (local + recommended)
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('docker/images')
  async getDockerImages() {
    this.logger.log('Fetching Docker images');
    
    const [localImages, recommendedImages] = await Promise.all([
      this.dockerImagesService.getLocalImages(),
      this.dockerImagesService.getRecommendedImages(),
    ]);

    return {
      local: localImages,
      recommended: recommendedImages,
      dockerAvailable: await this.dockerImagesService.isDockerAvailable(),
    };
  }

  /**
   * Pull a Docker image from Docker Hub
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('docker/images/pull')
  async pullDockerImage(@Body() body: { repository: string; tag?: string }) {
    this.logger.log(`Pulling Docker image: ${body.repository}:${body.tag || 'latest'}`);
    
    const success = await this.dockerImagesService.pullImage(body.repository, body.tag);
    
    if (!success) {
      throw new BadRequestException('Failed to pull Docker image');
    }

    return {
      message: 'Image pulled successfully',
      image: `${body.repository}:${body.tag || 'latest'}`,
    };
  }

  /**
   * Get running Docker containers
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('docker/containers')
  async getDockerContainers() {
    this.logger.log('Fetching running Docker containers');
    
    const containers = await this.dockerImagesService.getRunningContainers();
    
    return {
      containers,
      count: containers.length,
    };
  }

  /**
   * Test run a Docker container
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('docker/containers/test')
  async testDockerContainer(@Body() body: { imageId: string; containerName: string }) {
    this.logger.log(`Testing Docker container: ${body.containerName} with image ${body.imageId}`);
    
    const result = await this.dockerImagesService.testContainer(body.imageId, body.containerName);
    
    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to start container');
    }

    return {
      message: 'Container started successfully',
      containerId: result.containerId,
    };
  }

  /**
   * Stop and remove a test container
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('docker/containers/:containerName')
  async stopDockerContainer(@Param('containerName') containerName: string) {
    this.logger.log(`Stopping Docker container: ${containerName}`);
    
    const success = await this.dockerImagesService.stopTestContainer(containerName);
    
    if (!success) {
      throw new BadRequestException('Failed to stop container');
    }

    return {
      message: 'Container stopped successfully',
    };
  }

  // ==================== Artifact Upload Pipeline ====================

  /**
   * Generate presigned upload URLs for scenario artifacts
   * Phase 1: Upload pipeline - creator uploads to MinIO staging bucket
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios/:scenarioId/versions/:versionId/upload-urls')
  async generateUploadUrls(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Body() body: { artifacts?: { compose?: boolean; manifest?: boolean; images?: string[]; assets?: string[] } },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Verify ownership
    const version = await this.versionRepo.findOne({
      where: { id: versionId, scenario: { createdByUserId: userId } },
      relations: ['scenario'],
    });
    
    if (!version) {
      throw new NotFoundException('Scenario version not found or access denied');
    }
    
    // Only allow for draft versions
    if (version.status !== ScenarioVersionStatus.DRAFT) {
      throw new BadRequestException('Can only upload artifacts for draft versions');
    }
    
    // Default to all artifacts if not specified
    const artifacts = body?.artifacts || { compose: true, manifest: true, images: [], assets: [] };
    
    const uploadUrls: Record<string, any> = {};
    
    // Generate presigned PUT URLs
    if (artifacts.compose) {
      uploadUrls.compose = await this.minioService.getPresignedPutUrl(
        'rangex-staging',
        `scenarios/${versionId}/compose.yml`,
        3600, // 1 hour expiry
      );
    }
    
    if (artifacts.manifest) {
      uploadUrls.manifest = await this.minioService.getPresignedPutUrl(
        'rangex-staging',
        `scenarios/${versionId}/manifest.json`,
        3600,
      );
    }
    
    if (artifacts.images && artifacts.images.length > 0) {
      uploadUrls.images = {};
      for (const imageKey of artifacts.images) {
        uploadUrls.images[imageKey] = await this.minioService.getPresignedPutUrl(
          'rangex-staging',
          `scenarios/${versionId}/images/${imageKey}.tar`,
          3600,
        );
      }
    }
    
    if (artifacts.assets && artifacts.assets.length > 0) {
      uploadUrls.assets = {};
      for (const assetKey of artifacts.assets) {
        uploadUrls.assets[assetKey] = await this.minioService.getPresignedPutUrl(
          'rangex-staging',
          `scenarios/${versionId}/assets/${assetKey}.tar.gz`,
          3600,
        );
      }
    }
    
    this.logger.log(`Generated upload URLs for version ${versionId}`);
    
    return {
      versionId,
      uploadUrls,
      expiresIn: 3600,
    };
  }

  /**
   * Submit scenario with artifact hashes (hash-lock submission)
   * Phase 1: Locks version for immutability and enqueues validation
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenarios/:scenarioId/versions/:versionId/submit-artifacts')
  async submitArtifacts(
    @Param('scenarioId') scenarioId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      hashes: {
        compose?: string;
        manifest?: string;
        images?: Record<string, string>;
        assets?: Record<string, string>;
      };
    },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Verify ownership
    const version = await this.versionRepo.findOne({
      where: { id: versionId, scenario: { createdByUserId: userId } },
      relations: ['scenario'],
    });
    
    if (!version) {
      throw new NotFoundException('Scenario version not found or access denied');
    }
    
    // Only allow for draft versions
    if (version.status !== ScenarioVersionStatus.DRAFT) {
      throw new BadRequestException('Can only submit artifacts for draft versions');
    }
    
    // Store artifact hashes
    version.artifactHashes = body.hashes;
    
    // Calculate combined hash for immutability proof
    const hashString = JSON.stringify(body.hashes, Object.keys(body.hashes).sort());
    const crypto = await import('crypto');
    version.submittedHash = crypto.createHash('sha256').update(hashString).digest('hex');
    
    // Update status and submission timestamp
    version.status = ScenarioVersionStatus.SUBMITTED;
    version.submittedAt = new Date();
    
    await this.versionRepo.save(version);
    
    // Enqueue validation job (Phase 2)
    await this.jobQueueService.enqueue('VALIDATE_SUBMISSION', {
      versionId,
      submittedHash: version.submittedHash,
    });
    
    this.logger.log(`Artifacts submitted for version ${versionId} with hash ${version.submittedHash}. Validation job enqueued.`);
    
    return {
      success: true,
      versionId,
      submittedHash: version.submittedHash,
      status: version.status,
      message: 'Artifacts submitted successfully. Version is now locked and pending approval.',
    };
  }

  // ==================== Scenario Workflow ====================

  /**
   * Submit scenario version for admin review
   * - Validates completeness
   * - Uploads docker-compose.yml to MinIO
   * - Changes status from ScenarioVersionStatus.DRAFT to 'pending'
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenario/:versionId/submit-for-review')
  async submitForReview(@Param('versionId') versionId: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.workflowService.submitForReview(versionId, userId);
  }

  /**
   * Save draft (auto-save or manual save)
   * - No MinIO upload
   * - No validation required
   * - Status remains ScenarioVersionStatus.DRAFT
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('scenario/:versionId/save-draft')
  async saveDraft(
    @Param('versionId') versionId: string,
    @Body() updates: Partial<ScenarioVersion>,
    @Req() req: any,
  ) {
    return this.workflowService.saveDraft(versionId, req.user.id, updates);
  }
}
