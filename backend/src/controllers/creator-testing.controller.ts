import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreatorTestingService } from '../services/creator-testing.service';
import { DockerImageService } from '../services/docker-image.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';

/**
 * Creator Testing Controller
 * Endpoints for creators to test scenarios on the BACKEND server
 * 
 * IMPORTANT: This tests scenarios on the backend's Docker daemon,
 * NOT on the creator's local machine. This ensures consistency
 * and works for remote creators.
 */
@Controller('creator/testing')
export class CreatorTestingController {
  private readonly logger = new Logger(CreatorTestingController.name);
  
  constructor(
    private readonly creatorTestingService: CreatorTestingService,
    private readonly dockerImageService: DockerImageService,
    @InjectRepository(ScenarioVersion)
    private readonly scenarioVersionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
  ) {}

  /**
   * Validate Docker is available on backend server
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('docker/validate')
  async validateDocker(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.creatorTestingService.validateDockerConnection(userId);
  }

  /**
   * Get available Docker images from database (approved by admin)
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('docker/images')
  async getDockerImages(@Req() req: any) {
    // Return ONLY cached images (minioPath !== null) for instant/offline testing
    const allImages = await this.dockerImageService.listReadyImages();
    const cachedImages = allImages.filter(img => img.minioPath !== null);
    
    return {
      images: cachedImages,
      total: cachedImages.length,
      allAvailable: allImages.length,
      message: 'Showing cached images only (ready for instant testing)',
    };
  }

  /**
   * Validate docker-compose.yml with auto-correction
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('validate-compose')
  async validateDockerCompose(
    @Req() req: any,
    @Body() body: { dockerCompose: string; scenarioId?: string }
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Basic YAML validation
    const validation = await this.creatorTestingService.validateDockerCompose(
      body.dockerCompose
    );

    // If scenarioId provided, check Environment sync
    if (body.scenarioId) {
      const scenario = await this.scenarioVersionRepo.findOne({
        where: { id: body.scenarioId },
        relations: ['machines'],
      });
      
      if (scenario) {
        const machineCount = scenario.machines?.length || 0;
        const yaml = require('js-yaml');
        const config = yaml.load(body.dockerCompose);
        const serviceCount = config?.services ? Object.keys(config.services).length : 0;
        
        // Check if Environment tab is empty
        if (machineCount === 0) {
          validation.errors.push('⚠️ Environment tab is empty. Add machines first.');
          validation.valid = false;
        }
        // Check if counts match
        else if (serviceCount !== machineCount) {
          validation.warnings.push(
            `⚠️ Environment has ${machineCount} machines but docker-compose has ${serviceCount} services. Click "Auto-Generate from Environment".`
          );
        }
        
        // REMOVED: Cached image validation
        // Docker test pulls images directly from Docker Hub/registries
        // No need to pre-cache for testing
      }
    }

    // If there are corrections, also return the corrected YAML
    let correctedYaml: string | undefined;
    if (validation.correctedConfig) {
      correctedYaml = this.creatorTestingService.getCorrectedDockerCompose(validation);
    }

    const hints = await this.creatorTestingService.getHints(validation);

    return {
      validation,
      correctedYaml,
      hints,
    };
  }

  /**
   * Test scenario using docker-compose on backend server
   * Returns real-time progress and logs
   * 
   * SUPPORTS BOTH:
   * - POST /creator/testing/test/:scenarioId (resolves to latest version)
   * - POST /creator/testing/test/:scenarioVersionId
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('test/:id')
  async testScenario(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { dockerCompose: string }
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Resolve ID to versionId (could be scenarioId or versionId)
    const versionId = await this.resolveToVersionId(id);
    
    // Get scenario with machines from Environment tab
    const scenario = await this.scenarioVersionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });
    
    if (!scenario) {
      throw new NotFoundException('Scenario version not found');
    }
    
    // VALIDATION 1: Environment tab must have machines
    const machineCount = scenario.machines?.length || 0;
    if (machineCount === 0) {
      throw new HttpException(
        {
          error: 'Cannot test without Environment setup',
          message: 'Environment tab is empty. Please add machines in the Environment tab first.',
          fix: 'Go to Environment tab → Add Machines → Then return to Docker Test',
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    
    // VALIDATION 2: Docker compose must match Environment
    const yaml = require('js-yaml');
    const config = yaml.load(body.dockerCompose);
    const serviceCount = config?.services ? Object.keys(config.services).length : 0;
    
    if (serviceCount !== machineCount) {
      throw new HttpException(
        {
          error: 'Docker compose does not match Environment',
          message: `Environment has ${machineCount} machines, but docker-compose has ${serviceCount} services`,
          fix: 'Click "Auto-Generate from Environment" button to sync',
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    
    this.logger.log(`✅ All validations passed for version ${versionId} - starting Docker test`);
    
    // All validations passed - proceed with test
    return await this.creatorTestingService.testScenarioLocally(
      userId,
      versionId,
      body.dockerCompose
    );
  }

  /**
   * Get test progress and logs for running test
   * SUPPORTS BOTH scenarioId and versionId
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('test/:id/status')
  async getTestStatus(
    @Req() req: any,
    @Param('id') id: string
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const versionId = await this.resolveToVersionId(id);
    return await this.creatorTestingService.getTestStatus(userId, versionId);
  }

  /**
   * Get live logs from running test containers
   * SUPPORTS BOTH scenarioId and versionId
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('test/:id/logs')
  async getTestLogs(
    @Req() req: any,
    @Param('id') id: string
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const versionId = await this.resolveToVersionId(id);
    return await this.creatorTestingService.getTestLogs(userId, versionId);
  }

  /**
   * Stop test containers for this creator
   * SUPPORTS BOTH scenarioId and versionId
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('test/:id')
  async stopTest(
    @Req() req: any,
    @Param('id') id: string
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const versionId = await this.resolveToVersionId(id);
    await this.creatorTestingService.stopTestContainers(userId, versionId);
    return { message: 'Test containers stopped' };
  }

  /**
   * Stop test containers (ALIAS for frontend compatibility)
   * DELETE /creator/testing/test/:scenarioVersionId/stop
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('test/:id/stop')
  async stopTestAlias(
    @Req() req: any,
    @Param('id') id: string
  ) {
    return this.stopTest(req, id);
  }

  /**
   * Build Docker image from Dockerfile on backend
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('build/:versionId')
  async buildImage(
    @Req() req: any,
    @Param('versionId') versionId: string,
    @Body() body: { dockerfilePath: string; imageName: string }
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return await this.creatorTestingService.buildImage(
      userId,
      versionId,
      body.dockerfilePath,
      body.imageName
    );
  }

  /**
   * Get template docker-compose.yml (PUBLIC - no auth required)
   */
  @Get('template/:type')
  async getTemplate(
    @Param('type') type: 'single-container' | 'multi-container' | 'network-challenge',
    @Req() req: any
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const template = await this.creatorTestingService.generateTemplate(type, userId);
    return { template };
  }

  /**
   * Auto-generate docker-compose.yml from Environment tab machines
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('generate-from-environment/:versionId')
  async generateFromEnvironment(
    @Req() req: any,
    @Param('versionId') versionId: string
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Get scenario with machines from Environment tab
    const scenario = await this.scenarioVersionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });
    
    if (!scenario) {
      throw new NotFoundException('Scenario version not found');
    }
    
    const machineCount = scenario.machines?.length || 0;
    
    // Check if Environment tab has machines
    if (machineCount === 0) {
      throw new HttpException(
        {
          error: 'Environment tab is empty',
          message: 'No machines configured in Environment tab. Please add machines first.',
          fix: 'Go to Environment tab → Add Machines',
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    
    // Generate docker-compose from machines with user isolation
    const dockerCompose = await this.creatorTestingService.generateFromEnvironment(
      scenario.machines || [],
      userId,
      versionId
    );
    
    return {
      dockerCompose,
      machineCount,
      message: `Generated from ${machineCount} machines in Environment tab`,
    };
  }

  /**
   * Check Environment tab sync status
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('environment-status/:versionId')
  async getEnvironmentStatus(
    @Req() req: any,
    @Param('versionId') versionId: string
  ) {
    const scenario = await this.scenarioVersionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });
    
    if (!scenario) {
      throw new NotFoundException('Scenario version not found');
    }
    
    const machineCount = scenario.machines?.length || 0;
    const cachedImages = await this.dockerImageService.listReadyImages();
    const cachedImageNames = cachedImages
      .filter(img => img.minioPath !== null)
      .map(img => img.name);
    
    return {
      machineCount,
      isEmpty: machineCount === 0,
      machines: scenario.machines?.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role,
        imageRef: m.imageRef,
        isCached: cachedImageNames.some(cached => m.imageRef.includes(cached)),
      })) || [],
      cachedImages: cachedImageNames,
      allMachinesCached: scenario.machines?.every(m => 
        cachedImageNames.some(cached => m.imageRef.includes(cached))
      ) || false,
    };
  }

  /**
   * Get platform image library with caching status and resource recommendations
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Get('docker/library')
  async getImageLibrary(@Req() req: any) {
    const images = await this.dockerImageService.listReadyImages();
    
    return {
      images: images.map(img => ({
        ...img,
        isCached: !!img.minioPath,
        isAvailableOffline: !!img.minioPath,
      })),
      categorized: {
        cached: images.filter(img => img.minioPath),
        public: images.filter(img => img.isPublic && !img.minioPath),
        private: images.filter(img => !img.isPublic),
      },
      stats: {
        total: images.length,
        cached: images.filter(img => img.minioPath).length,
        public: images.filter(img => img.isPublic).length,
        private: images.filter(img => !img.isPublic).length,
      },
    };
  }

  /**
   * Test a single container for debugging
   * This is a simple test to verify image works before full scenario deployment
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Post('docker/containers/test')
  async testContainer(
    @Req() req: any,
    @Body() body: { imageName: string; imageTag: string }
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    // Validate parameters
    if (!body.imageName || body.imageName === 'undefined') {
      throw new HttpException(
        {
          success: false,
          message: 'Invalid image name. Please select a valid Docker image.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    
    if (!body.imageTag || body.imageTag === 'undefined') {
      throw new HttpException(
        {
          success: false,
          message: 'Invalid image tag. Please specify a valid tag (e.g., latest).',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    
    const fullImageName = `${body.imageName}:${body.imageTag}`;
    
    try {
      // Start a simple test container
      const containerId = await this.creatorTestingService.startTestContainer(
        fullImageName,
        userId
      );
      
      return {
        success: true,
        containerId,
        message: `Test container started successfully: ${fullImageName}`,
        note: 'This is a short-lived test container. Use Docker Desktop to inspect it.',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to start test container: ${error?.message || error}`,
          error: error?.message || String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Stop a test container
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin')
  @Delete('docker/containers/test/:containerId')
  async stopTestContainer(
    @Req() req: any,
    @Param('containerId') containerId: string
  ) {
    try {
      await this.creatorTestingService.stopTestContainer(containerId);
      return {
        success: true,
        message: 'Test container stopped and removed',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to stop test container: ${error?.message || error}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper: Resolve ID to versionId
   * If ID matches a scenarioId, return latest versionId
   * If ID matches a versionId, return it directly
   */
  private async resolveToVersionId(id: string): Promise<string> {
    // Try as versionId first
    const version = await this.scenarioVersionRepo.findOne({
      where: { id },
    });

    if (version) {
      return version.id;
    }

    // Try as scenarioId - get latest version
    const latestVersion = await this.scenarioVersionRepo.findOne({
      where: { scenarioId: id },
      order: { versionNumber: 'DESC' },
    });

    if (latestVersion) {
      return latestVersion.id;
    }

    throw new NotFoundException(`No scenario or version found with ID: ${id}`);
  }
}

