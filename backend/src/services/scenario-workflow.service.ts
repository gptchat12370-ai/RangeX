import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { CreatorEnvironmentService } from './creator-environment.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages the complete scenario lifecycle workflow:
 * Draft → Submit for Review → MinIO Upload → Admin Approval → AWS Deployment
 */
@Injectable()
export class ScenarioWorkflowService {
  private readonly logger = new Logger(ScenarioWorkflowService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly minioService: MinioService,
    private readonly environmentService: CreatorEnvironmentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Submit scenario for admin review
   * - Validates completeness
   * - Uploads docker-compose.yml to MinIO
   * - Updates status to 'pending'
   * - Sends admin notification
   */
  async submitForReview(versionId: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let minioPath: string | null = null;
    let s3Key: string | null = null;

    try {
      // Get scenario version with validations
      const version = await queryRunner.manager.findOne(ScenarioVersion, {
        where: { id: versionId },
        relations: ['scenario', 'machines'],
      });

      if (!version) {
        throw new BadRequestException('Scenario version not found');
      }

      // Log for debugging
      this.logger.log(`Submit check - Version owner: ${version.scenario.createdByUserId}, Current user: ${userId}`);

      if (version.scenario.createdByUserId !== userId) {
        throw new BadRequestException('Unauthorized: You do not own this scenario');
      }

      if (version.status !== ScenarioVersionStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot submit - current status: ${version.status}`,
        );
      }

      // Validation checks
      const errors: string[] = [];

      // Allow 0 machines if scenario has questions or assets (quiz-style challenge)
      const hasMachines = version.machines && version.machines.length > 0;
      const hasQuestions = version.questions && version.questions.length > 0;
      const hasAssets = version.assets && version.assets.length > 0;

      if (!hasMachines && !hasQuestions && !hasAssets) {
        errors.push('Scenario must have at least one of: machines, questions, or assets');
      }

      if (!version.missionText || version.missionText.trim().length < 50) {
        errors.push('Mission text must be at least 50 characters');
      }

      if (!version.creatorName || version.creatorName.trim().length === 0) {
        errors.push('Creator name is required (add your name in the Author field)');
      }

      // Validate machine configurations
      if (version.machines) {
        version.machines.forEach((machine, index) => {
          if (!machine.imageRef) {
            errors.push(`Machine ${index + 1}: Image reference is required`);
          } else if (!machine.imageRef.includes(':')) {
            errors.push(`Machine ${index + 1}: Image must include tag (e.g., :latest)`);
          }

          if (!machine.networkGroup) {
            errors.push(`Machine ${index + 1}: Network group is required`);
          }

          if (!machine.resourceProfile) {
            errors.push(`Machine ${index + 1}: Resource profile is required`);
          }
        });
      }

      if (errors.length > 0) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      }

      // Generate docker-compose.yml (only if machines exist)
      if (hasMachines) {
        this.logger.log(`Generating docker-compose for version ${versionId}`);
        const result = await this.environmentService.generateDockerComposeFromMachines(
          versionId,
        );

        // Validate docker-compose structure
        if (!result || !result.dockerCompose) {
          throw new BadRequestException('Generated docker-compose is invalid');
        }

        // Upload to MinIO
        const scenarioId = version.scenarioId;
        s3Key = `scenarios/${scenarioId}/versions/${versionId}/docker-compose.yml`;
        
        this.logger.log(`Uploading to MinIO: ${s3Key}`);
        const dockerComposeBuffer = Buffer.from(result.dockerCompose, 'utf-8');
        await this.minioService.uploadFile(dockerComposeBuffer, s3Key);

        minioPath = s3Key;
      } else {
        this.logger.log(`Skipping docker-compose generation for machine-less scenario (quiz/asset-only)`);
        minioPath = null;
      }

      // Update version status
      version.status = ScenarioVersionStatus.SUBMITTED as ScenarioVersionStatus;
      version.dockerComposePath = minioPath;
      version.submittedAt = new Date();

      await queryRunner.manager.save(version);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Scenario version ${versionId} submitted for review by user ${userId}`,
      );

      // TODO: Send notification to admins
      // await this.notificationService.notifyAdmins({
      //   type: 'scenario_submitted',
      //   scenarioId,
      //   versionId,
      //   creatorName: version.scenario.createdBy.displayName,
      //   title: version.scenario.title,
      // });

      return {
        success: true,
        message: 'Scenario submitted for admin review',
        versionId,
        status: ScenarioVersionStatus.SUBMITTED,
        minioPath: s3Key,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      // Cleanup MinIO upload on failure
      if (minioPath) {
        try {
          await this.minioService.deleteFile(minioPath);
          this.logger.warn(`Rolled back MinIO upload: ${minioPath}`);
        } catch (cleanupError: any) {
          this.logger.error(
            `Failed to cleanup MinIO file ${minioPath}: ${cleanupError.message}`,
          );
        }
      }

      this.logger.error(`Submit for review failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Admin approves scenario
   * - Updates status to ScenarioVersionStatus.APPROVED
   * - Records admin approval
   * - Triggers AWS deployment preparation
   */
  async approveScenario(versionId: string, adminId: string, feedback?: string) {
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new BadRequestException('Scenario version not found');
    }

    if (version.status !== ScenarioVersionStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve - current status: ${version.status}`,
      );
    }

    // Security: Validate docker-compose exists in MinIO
    if (!version.dockerComposePath) {
      throw new BadRequestException('No docker-compose file uploaded');
    }

    // Download and validate docker-compose
    const dockerComposeBuffer = await this.minioService.getFile(
      version.dockerComposePath,
    );
    
    const dockerCompose = dockerComposeBuffer.toString('utf-8');

    if (!dockerCompose || dockerCompose.length === 0) {
      throw new BadRequestException('Invalid docker-compose file');
    }

    // Update status
    version.status = ScenarioVersionStatus.APPROVED as ScenarioVersionStatus;
    version.approvedByUserId = adminId;
    version.approvedAt = new Date();

    await this.versionRepo.save(version);

    this.logger.log(
      `Scenario version ${versionId} approved by admin ${adminId}`,
    );

    // TODO: Trigger AWS deployment preparation
    // await this.awsDeploymentService.prepareScenarioDeployment(versionId);

    // TODO: Notify creator
    // await this.notificationService.notifyCreator(version.scenario.createdById, {
    //   type: 'scenario_approved',
    //   scenarioId: version.scenarioId,
    //   versionId,
    //   feedback,
    // });

    return {
      success: true,
      message: 'Scenario approved',
      versionId,
      status: ScenarioVersionStatus.APPROVED,
    };
  }

  /**
   * Admin rejects scenario
   * - Updates status to ScenarioVersionStatus.REJECTED
   * - Records rejection reason
   * - Notifies creator
   */
  async rejectScenario(versionId: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new BadRequestException('Scenario version not found');
    }

    if (version.status !== ScenarioVersionStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject - current status: ${version.status}`,
      );
    }

    // Update status
    version.status = ScenarioVersionStatus.ARCHIVED as ScenarioVersionStatus; // Use archived for rejected
    version.rejectedAt = new Date();
    version.rejectReason = reason;

    await this.versionRepo.save(version);

    this.logger.log(
      `Scenario version ${versionId} rejected by admin ${adminId}: ${reason}`,
    );

    // TODO: Notify creator
    // await this.notificationService.notifyCreator(version.scenario.createdById, {
    //   type: 'scenario_rejected',
    //   scenarioId: version.scenarioId,
    //   versionId,
    //   reason,
    // });

    return {
      success: true,
      message: 'Scenario rejected',
      versionId,
      status: ScenarioVersionStatus.REJECTED,
      reason,
    };
  }

  /**
   * Get all scenarios pending admin review
   */
  async getPendingScenarios() {
    return this.versionRepo.find({
      where: { status: ScenarioVersionStatus.SUBMITTED as ScenarioVersionStatus },
      relations: ['scenario', 'machines'],
      order: { submittedAt: 'ASC' },
    });
  }

  /**
   * Get all approved scenarios (visible to users)
   * Returns only PUBLISHED scenarios (APPROVED scenarios are in the approvals queue)
   */
  async getApprovedScenarios() {
    // Get only PUBLISHED versions (APPROVED scenarios should use the testing page)
    const allVersions = await this.versionRepo.find({
      where: {
        status: ScenarioVersionStatus.PUBLISHED as ScenarioVersionStatus,
        isArchived: false
      },
      relations: ['scenario', 'machines'],
      order: { publishedAt: 'DESC' },
    });

    // Group by scenarioId and keep only the latest version for each scenario
    const scenarioMap = new Map<string, any>();
    
    for (const version of allVersions) {
      const scenarioId = version.scenario.id;
      const existing = scenarioMap.get(scenarioId);
      
      // Keep the one with the highest version number (or latest publishedAt if same version)
      if (!existing || 
          version.versionNumber > existing.versionNumber ||
          (version.versionNumber === existing.versionNumber && 
           version.publishedAt && existing.publishedAt && 
           version.publishedAt > existing.publishedAt)) {
        scenarioMap.set(scenarioId, version);
      }
    }

    // Return only the latest versions (PUBLISHED) with explicit field mapping
    return Array.from(scenarioMap.values()).map(v => ({
      id: v.id, // This is the VERSION ID - CRITICAL for frontend navigation
      scenarioId: v.scenarioId, // This is the parent scenario ID
      title: v.title,
      shortDescription: v.shortDescription,
      difficulty: v.difficulty,
      category: v.category,
      tags: v.tags,
      estimatedMinutes: v.estimatedMinutes,
      versionNumber: v.versionNumber,
      status: v.status,
      isArchived: v.isArchived,
      publishedAt: v.publishedAt,
      machines: v.machines || [],
    }));
  }

  /**
   * Get scenarios ready for admin testing
   * Returns only APPROVED scenarios (not yet published)
   */
  async getTestingScenarios() {
    // Get only APPROVED versions with successful builds
    const allVersions = await this.versionRepo.find({
      where: {
        status: ScenarioVersionStatus.APPROVED as ScenarioVersionStatus,
        isArchived: false,
        buildStatus: 'SUCCESS' // Only show scenarios with successful builds
      },
      relations: ['scenario', 'machines'],
      order: { updatedAt: 'DESC' },
    });

    // Group by scenarioId and keep only the latest version for each scenario
    const scenarioMap = new Map<string, any>();
    
    for (const version of allVersions) {
      const scenarioId = version.scenario.id;
      const existing = scenarioMap.get(scenarioId);
      
      // Keep the one with the highest version number (or latest publishedAt if same version)
      if (!existing || 
          version.versionNumber > existing.versionNumber ||
          (version.versionNumber === existing.versionNumber && 
           version.publishedAt && existing.publishedAt && 
           version.publishedAt > existing.publishedAt)) {
        scenarioMap.set(scenarioId, version);
      }
    }

    // Return only the latest APPROVED versions with explicit field mapping
    return Array.from(scenarioMap.values()).map(v => ({
      id: v.id, // This is the VERSION ID - CRITICAL for frontend navigation
      scenarioId: v.scenarioId, // This is the parent scenario ID
      title: v.title,
      shortDescription: v.shortDescription,
      difficulty: v.difficulty,
      category: v.category,
      tags: v.tags,
      estimatedMinutes: v.estimatedMinutes,
      versionNumber: v.versionNumber,
      status: v.status,
      machines: v.machines,
      lastAdminTestStatus: v.lastAdminTestStatus,
      publishingBlocked: v.publishingBlocked,
    }));
  }

  /**
   * Save draft (auto-save or manual)
   * - Updates scenario version without validation
   * - Does NOT upload to MinIO
   * - Status remains ScenarioVersionStatus.DRAFT
   */
  async saveDraft(versionId: string, userId: string, updates: Partial<ScenarioVersion>) {
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new BadRequestException('Scenario version not found');
    }

    if (version.scenario.createdByUserId !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    if (version.status !== ScenarioVersionStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot edit - current status: ${version.status}`,
      );
    }

    // Only allow updating certain fields
    const allowedFields = [
      'missionText',
      'shortDescription',
      'difficulty',
      'estimatedMinutes',
      'tags',
    ];

    allowedFields.forEach((field) => {
      if (updates[field as keyof ScenarioVersion] !== undefined) {
        (version as any)[field] = updates[field as keyof ScenarioVersion];
      }
    });

    version.updatedAt = new Date();

    await this.versionRepo.save(version);

    this.logger.log(`Draft saved for version ${versionId}`);

    return {
      success: true,
      message: 'Draft saved',
      versionId,
      updatedAt: version.updatedAt,
    };
  }
}
