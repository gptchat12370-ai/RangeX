import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AwsDeployService } from '../services/aws-deploy.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DeploymentEnvironment } from '../entities/deployment-environment.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { BuildOrchestrationService } from '../services/build-orchestration.service';

/**
 * Admin Deployment Controller
 * Manages ephemeral AWS deployments: deploy, park, unpark, full teardown
 * 
 * ARCHITECTURE: LOCAL control-plane + EPHEMERAL AWS runtime
 * - Deploy: Create temporary ECR + ECS resources
 * - Park: Delete all AWS resources (zero cost)
 * - Unpark: Recreate from local MinIO bundle
 * - Full Teardown: Delete CloudFormation/Terraform stack
 */
@Controller('admin/deployments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AdminDeploymentsController {
  private readonly logger = new Logger(AdminDeploymentsController.name);

  constructor(
    private readonly awsDeployService: AwsDeployService,
    private readonly buildOrchestration: BuildOrchestrationService,
    @InjectRepository(DeploymentEnvironment)
    private readonly deploymentRepo: Repository<DeploymentEnvironment>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
  ) {}

  /**
   * POST /api/admin/deployments/deploy/:versionId
   * Deploy scenario to AWS (ephemeral resources)
   * 
   * Prerequisites:
   * - bundleStatus must be 'READY'
   * - Bundle must exist in MinIO
   * 
   * Creates:
   * - Temporary ECR repositories
   * - ECS Fargate tasks (gateway + machines)
   * - Optional VPC interface endpoints
   * 
   * Returns:
   * - deploymentId (UUID)
   * - gatewayEndpoint (public IP or DNS)
   * - entrypoints (connection strings with stable ports)
   */
  @Post('deploy/:versionId')
  async deployToAWS(
    @Param('versionId') versionId: string,
    @Body() body: { deploymentName?: string },
  ) {
    this.logger.log(`Deploying scenario version ${versionId} to AWS`);

    // Validate scenario version exists and has bundle ready
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });

    if (!version) {
      throw new NotFoundException(`Scenario version not found: ${versionId}`);
    }

    if (version.bundleStatus !== 'READY') {
      throw new BadRequestException(
        `Cannot deploy: bundleStatus is ${version.bundleStatus}, must be READY. ` +
        `Ensure scenario is approved first.`
      );
    }

    if (!version.bundlePath) {
      throw new BadRequestException(
        `Cannot deploy: bundlePath is missing. Bundle may not have been created.`
      );
    }

    // Deploy to AWS
    const result = await this.awsDeployService.deployToAWS(
      versionId,
      body.deploymentName,
    );

    this.logger.log(`Deployment successful: ${result.deploymentId}`);

    return {
      success: true,
      deploymentId: result.deploymentId,
      gatewayEndpoint: result.gatewayEndpoint,
      entrypoints: result.entrypoints,
      message: 'Deployment to AWS successful. Resources are ephemeral and can be parked to eliminate costs.',
    };
  }

  /**
   * POST /api/admin/deployments/:deploymentId/park
   * Park deployment (delete all AWS resources)
   * 
   * Deletes:
   * - ECS tasks/services
   * - ECR repositories (and images)
   * - VPC interface endpoints
   * 
   * Result: ZERO AWS costs
   * 
   * Bundle remains in MinIO (local) for unpark
   */
  @Post(':deploymentId/park')
  async parkDeployment(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Parking deployment ${deploymentId}`);

    // Validate deployment exists
    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.status === 'PARKED') {
      return {
        success: true,
        message: 'Deployment is already parked',
      };
    }

    // Park deployment
    await this.awsDeployService.parkDeployment(deploymentId);

    this.logger.log(`Deployment ${deploymentId} parked successfully`);

    return {
      success: true,
      message: 'Deployment parked. All AWS resources deleted. No ongoing costs.',
    };
  }

  /**
   * POST /api/admin/deployments/:deploymentId/unpark
   * Unpark deployment (recreate from local bundle)
   * 
   * Recreates:
   * - ECR repositories
   * - Pushes images from MinIO OCI archives
   * - ECS tasks/services
   * - VPC interface endpoints
   * 
   * Returns:
   * - NEW gatewayEndpoint (IP may change)
   * - Same entrypoints with stable ports
   */
  @Post(':deploymentId/unpark')
  async unparkDeployment(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Unparking deployment ${deploymentId}`);

    // Validate deployment exists
    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
      relations: ['scenarioVersion'],
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.status !== 'PARKED') {
      throw new BadRequestException(
        `Cannot unpark: Deployment status is ${deployment.status}, must be PARKED`
      );
    }

    // Unpark deployment
    const result = await this.awsDeployService.unparkDeployment(deploymentId);

    this.logger.log(`Deployment ${deploymentId} unparked successfully`);

    return {
      success: true,
      gatewayEndpoint: result.gatewayEndpoint,
      entrypoints: result.entrypoints,
      message: 'Deployment unparked. Resources recreated from local bundle.',
    };
  }

  /**
   * POST /api/admin/deployments/:deploymentId/full-teardown
   * Complete teardown (delete CloudFormation/Terraform stack)
   * 
   * Parks first, then deletes infrastructure stack
   * 
   * WARNING: Cannot be reversed. Must create new deployment.
   */
  @Post(':deploymentId/full-teardown')
  async fullTeardown(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Full teardown of deployment ${deploymentId}`);

    // Validate deployment exists
    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.status === 'FULL_TEARDOWN') {
      return {
        success: true,
        message: 'Deployment is already fully torn down',
      };
    }

    // Full teardown
    await this.awsDeployService.fullTeardown(deploymentId);

    this.logger.log(`Deployment ${deploymentId} fully torn down`);

    return {
      success: true,
      message: 'Deployment fully torn down. All AWS resources and stack deleted.',
    };
  }

  /**
   * GET /api/admin/deployments
   * List all deployments with optional status filter
   * 
   * Query params:
   * - status?: DEPLOYING | DEPLOYED | PARKED | FAILED | FULL_TEARDOWN
   */
  @Get()
  async listDeployments(@Body() query?: { status?: string }) {
    this.logger.log('Listing deployments');

    const whereClause: any = query?.status ? { status: query.status as any } : {};

    const deployments = await this.deploymentRepo.find({
      where: whereClause,
      relations: ['scenarioVersion', 'scenarioVersion.scenario'],
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      count: deployments.length,
      deployments: deployments.map((d) => ({
        id: d.id,
        deploymentName: d.deploymentName,
        status: d.status,
        gatewayEndpoint: d.gatewayEndpoint,
        scenarioVersion: {
          id: d.scenarioVersion.id,
          versionNumber: d.scenarioVersion.versionNumber,
          scenarioId: d.scenarioVersion.scenarioId,
        },
        deployedAt: d.deployedAt,
        parkedAt: d.parkedAt,
        deletedAt: d.deletedAt,
      })),
    };
  }

  /**
   * GET /api/admin/deployments/:deploymentId
   * Get deployment details with full entrypoints
   */
  @Get(':deploymentId')
  async getDeployment(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Getting deployment ${deploymentId}`);

    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
      relations: ['scenarioVersion', 'scenarioVersion.scenario', 'scenarioVersion.machines'],
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment not found: ${deploymentId}`);
    }

    return {
      success: true,
      deployment: {
        id: deployment.id,
        deploymentName: deployment.deploymentName,
        status: deployment.status,
        gatewayEndpoint: deployment.gatewayEndpoint,
        ecrRepositoryPrefix: deployment.ecrRepositoryPrefix,
        gatewayTaskArn: deployment.gatewayTaskArn,
        machineTaskArns: deployment.machineTaskArns,
        vpcEndpointIds: deployment.vpcEndpointIds,
        entrypointsConfig: deployment.entrypointsConfig,
        infraStackName: deployment.infraStackName,
        deployedAt: deployment.deployedAt,
        parkedAt: deployment.parkedAt,
        deletedAt: deployment.deletedAt,
        scenarioVersion: {
          id: deployment.scenarioVersion.id,
          versionNumber: deployment.scenarioVersion.versionNumber,
          scenarioId: deployment.scenarioVersion.scenarioId,
          bundlePath: deployment.scenarioVersion.bundlePath,
          bundleStatus: deployment.scenarioVersion.bundleStatus,
          localTestStatus: deployment.scenarioVersion.localTestStatus,
          machines: deployment.scenarioVersion.machines?.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            imageRef: m.imageRef,
          })),
        },
      },
    };
  }

  /**
   * POST /api/admin/deployments/builds/:versionId/retry
   * Retry a failed build
   */
  @Post('builds/:versionId/retry')
  async retryBuild(@Param('versionId') versionId: string) {
    this.logger.log(`Retrying build for version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });

    if (!version) {
      throw new NotFoundException(`Scenario version not found: ${versionId}`);
    }

    if (version.buildStatus === 'RUNNING') {
      throw new BadRequestException('Build is already running');
    }

    // Allow rebuild even if SUCCESS (for testing/iteration)
    if (version.buildStatus === 'SUCCESS') {
      this.logger.warn(`Rebuilding already successful build for ${versionId}`);
    }

    // Reset build status and flags
    version.buildStatus = 'PENDING';
    version.ecrImagesPushed = false;
    version.buildLogs = (version.buildLogs || '') + '\n\n[RETRY] Build manually retried by admin at ' + new Date().toISOString();
    await this.versionRepo.save(version);

    // CRITICAL FIX: Actually trigger the build orchestration service
    // Don't just set status to PENDING and hope something picks it up
    this.logger.log(`Triggering build orchestration for version ${versionId}`);
    this.buildOrchestration.enqueueBuildJob(versionId)
      .catch((error) => {
        this.logger.error(`Build retry failed for version ${versionId}:`, error);
      });

    return {
      success: true,
      message: 'Build retry initiated',
      versionId,
      buildStatus: version.buildStatus,
    };
  }

  /**
   * POST /api/admin/deployments/builds/:versionId/cancel
   * Cancel a pending or running build
   */
  @Post('builds/:versionId/cancel')
  async cancelBuild(@Param('versionId') versionId: string) {
    this.logger.log(`Cancelling build for version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException(`Scenario version not found: ${versionId}`);
    }

    if (version.buildStatus === 'SUCCESS') {
      throw new BadRequestException('Cannot cancel a successful build');
    }

    // Mark as cancelled
    version.buildStatus = 'CANCELLED';
    version.buildLogs = (version.buildLogs || '') + '\n\n[CANCELLED] Build manually cancelled by admin at ' + new Date().toISOString();
    await this.versionRepo.save(version);

    return {
      success: true,
      message: 'Build cancelled successfully',
      versionId,
      buildStatus: version.buildStatus,
    };
  }

  /**
   * POST /api/admin/deployments/builds/:versionId/mark-failed
   * Mark a stuck build as failed
   */
  @Post('builds/:versionId/mark-failed')
  async markBuildFailed(@Param('versionId') versionId: string, @Body() body: { reason?: string }) {
    this.logger.log(`Marking build as failed for version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException(`Scenario version not found: ${versionId}`);
    }

    const reason = body.reason || 'Manually marked as failed by admin';

    version.buildStatus = 'FAILED';
    version.buildLogs = (version.buildLogs || '') + `\n\n[FAILED] ${reason}\nMarked at: ${new Date().toISOString()}`;
    await this.versionRepo.save(version);

    return {
      success: true,
      message: 'Build marked as failed',
      versionId,
      buildStatus: version.buildStatus,
      reason,
    };
  }
}
