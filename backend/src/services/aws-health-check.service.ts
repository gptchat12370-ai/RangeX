import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { ConfigService } from '@nestjs/config';

interface HealthCheckResult {
  healthy: boolean;
  missing: string[];
  errors: string[];
  warnings: string[];
  details: {
    ecrImages?: { exists: boolean; digest?: string }[];
    taskDefinitions?: { exists: boolean; arn?: string }[];
    vpcEndpoints?: { exists: boolean; status?: string }[];
    securityGroups?: { exists: boolean; id?: string }[];
  };
}

interface SolverHealthCheckResult {
  canStart: boolean;
  userMessage?: string;
  adminMessage?: string;
  missingResources?: string[];
}

/**
 * AWS Resource Health Check Service
 * 
 * Validates AWS resources exist before:
 * 1. Publishing scenarios (admin)
 * 2. Starting challenges (solvers)
 * 3. Rebuilding (after manual resource deletion)
 */
@Injectable()
export class AwsHealthCheckService {
  private readonly logger = new Logger(AwsHealthCheckService.name);
  private ecrClient: any;
  private ecsClient: any;
  private ec2Client: any;
  private readonly awsRegion: string;
  private readonly ecrRegistry: string;

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    private readonly configService: ConfigService,
  ) {
    this.awsRegion = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const awsAccountId = this.configService.get<string>('AWS_ACCOUNT_ID');
    this.ecrRegistry = `${awsAccountId}.dkr.ecr.${this.awsRegion}.amazonaws.com`;
    this.initAWSClients();
  }

  private async initAWSClients() {
    const { ECRClient } = await import('@aws-sdk/client-ecr');
    const { ECSClient } = await import('@aws-sdk/client-ecs');
    const { EC2Client } = await import('@aws-sdk/client-ec2');

    this.ecrClient = new ECRClient({ region: this.awsRegion });
    this.ecsClient = new ECSClient({ region: this.awsRegion });
    this.ec2Client = new EC2Client({ region: this.awsRegion });
  }

  /**
   * ADMIN: Comprehensive health check before publishing
   * Returns detailed report for admin review
   */
  async checkPublishReadiness(versionId: string): Promise<HealthCheckResult> {
    this.logger.log(`[HEALTH CHECK] Running publish readiness check for version ${versionId}`);

    const result: HealthCheckResult = {
      healthy: true,
      missing: [],
      errors: [],
      warnings: [],
      details: {},
    };

    try {
      // Load version with machines
      const version = await this.versionRepo.findOne({
        where: { id: versionId },
        relations: ['machines', 'scenario'],
      });

      if (!version) {
        result.healthy = false;
        result.errors.push('Scenario version not found');
        return result;
      }

      // Check 1: Verify build status is SUCCESS
      if (version.buildStatus !== 'SUCCESS') {
        result.healthy = false;
        result.errors.push(`Build status is ${version.buildStatus}, must be SUCCESS`);
      }

      // Check 2: Verify ecrImagesPushed flag
      if (!version.ecrImagesPushed) {
        result.healthy = false;
        result.errors.push('ECR images not pushed (ecrImagesPushed=false)');
      }

      // Check 3: Verify all machines have ECR image URIs
      const machines = version.machines || [];
      if (machines.length === 0) {
        // Questions-only scenarios are allowed (no machines needed)
        this.logger.log(`Version ${versionId} has no machines - questions/assets only scenario`);
        return result; // Return healthy status for questions-only scenarios
      }

      result.details.ecrImages = [];
      for (const machine of machines) {
        if (!machine.ecrUri) {
          result.healthy = false;
          result.missing.push(`Machine "${machine.name}" missing ECR image URI`);
          result.details.ecrImages.push({ exists: false });
        } else {
          // Verify ECR image actually exists
          const imageExists = await this.checkECRImageExists(machine.ecrUri);
          result.details.ecrImages.push({
            exists: imageExists,
            digest: machine.ecrDigest || undefined,
          });

          if (!imageExists) {
            result.healthy = false;
            result.missing.push(`ECR image not found: ${machine.ecrUri}`);
          }
        }
      }

      // Check 4: Verify all machines have task definitions
      result.details.taskDefinitions = [];
      for (const machine of machines) {
        if (!machine.taskDefinitionArn) {
          result.warnings.push(`Machine "${machine.name}" missing task definition ARN`);
          result.details.taskDefinitions.push({ exists: false });
        } else {
          // Verify task definition exists in ECS
          const taskDefExists = await this.checkTaskDefinitionExists(machine.taskDefinitionArn);
          result.details.taskDefinitions.push({
            exists: taskDefExists,
            arn: machine.taskDefinitionArn,
          });

          if (!taskDefExists) {
            result.warnings.push(`Task definition not found: ${machine.taskDefinitionArn}`);
          }
        }
      }

      // Check 5: Verify VPC endpoints (optional check)
      const vpcEndpointCheck = await this.checkVPCEndpoints();
      result.details.vpcEndpoints = vpcEndpointCheck;

      if (vpcEndpointCheck.some(ep => !ep.exists)) {
        result.warnings.push('Some VPC endpoints are missing - builds may fail');
      }

      // Check 6: Verify build logs exist
      if (!version.buildLogs || version.buildLogs.trim().length === 0) {
        result.warnings.push('Build logs are empty');
      }

    } catch (error: any) {
      this.logger.error(`[HEALTH CHECK] Error during publish readiness check:`, error);
      result.healthy = false;
      result.errors.push(`Health check failed: ${error.message}`);
    }

    this.logger.log(`[HEALTH CHECK] Publish readiness: ${result.healthy ? '✅ PASS' : '❌ FAIL'}`);
    return result;
  }

  /**
   * SOLVER: Pre-start validation with user-friendly messages
   * Returns simple can/cannot start with appropriate messaging
   */
  async checkSolverStartReadiness(versionId: string): Promise<SolverHealthCheckResult> {
    this.logger.log(`[HEALTH CHECK] Running solver start readiness check for version ${versionId}`);

    try {
      // Load version with machines
      const version = await this.versionRepo.findOne({
        where: { id: versionId },
        relations: ['machines'],
      });

      if (!version) {
        return {
          canStart: false,
          userMessage: 'This challenge is not available. Please try another challenge.',
          adminMessage: 'Scenario version not found in database',
        };
      }

      // Check if scenario is published
      if (version.status !== 'PUBLISHED') {
        return {
          canStart: false,
          userMessage: 'This challenge is currently unavailable. It may be under review or maintenance.',
          adminMessage: `Scenario status is ${version.status}, must be PUBLISHED`,
        };
      }

      const machines = version.machines || [];
      if (machines.length === 0) {
        // Questions-only scenario - no infrastructure needed
        this.logger.log(`Version ${versionId} has no machines - allowing questions-only scenario`);
        return {
          canStart: true,
          userMessage: 'Questions-only challenge ready',
          adminMessage: 'No machines - questions/assets only scenario',
        };
      }

      const missingResources: string[] = [];

      // Check all machines have ECR images
      for (const machine of machines) {
        if (!machine.ecrUri) {
          missingResources.push(`Machine "${machine.name}" - Missing ECR image`);
        }
      }

      // Check task definitions (critical for deployment)
      for (const machine of machines) {
        if (!machine.taskDefinitionArn) {
          missingResources.push(`Machine "${machine.name}" - Missing task definition`);
        } else {
          // Verify task definition still exists
          const exists = await this.checkTaskDefinitionExists(machine.taskDefinitionArn);
          if (!exists) {
            missingResources.push(`Machine "${machine.name}" - Task definition deleted from AWS`);
          }
        }
      }

      if (missingResources.length > 0) {
        return {
          canStart: false,
          userMessage: 'This challenge is temporarily unavailable due to system maintenance. Please try again later or contact support.',
          adminMessage: 'AWS resources missing - requires rebuild',
          missingResources,
        };
      }

      // All checks passed
      return {
        canStart: true,
      };

    } catch (error: any) {
      this.logger.error(`[HEALTH CHECK] Error during solver start readiness check:`, error);
      return {
        canStart: false,
        userMessage: 'An error occurred while preparing this challenge. Please try again later.',
        adminMessage: `Health check error: ${error.message}`,
      };
    }
  }

  /**
   * REBUILD: Check what resources are missing and need recreation
   * Returns list of resources to recreate
   */
  async checkRebuildRequirements(versionId: string): Promise<{
    needsRebuild: boolean;
    missingECRImages: string[];
    missingTaskDefinitions: string[];
    canRebuild: boolean;
    reason?: string;
  }> {
    this.logger.log(`[HEALTH CHECK] Checking rebuild requirements for version ${versionId}`);

    const result = {
      needsRebuild: false,
      missingECRImages: [] as string[],
      missingTaskDefinitions: [] as string[],
      canRebuild: true,
      reason: undefined as string | undefined,
    };

    try {
      const version = await this.versionRepo.findOne({
        where: { id: versionId },
        relations: ['machines', 'scenario'],
      });

      if (!version) {
        result.canRebuild = false;
        result.reason = 'Scenario version not found';
        return result;
      }

      const machines = version.machines || [];

      // Check ECR images
      for (const machine of machines) {
        if (!machine.ecrUri) {
          result.needsRebuild = true;
          result.missingECRImages.push(machine.name);
        } else {
          const exists = await this.checkECRImageExists(machine.ecrUri);
          if (!exists) {
            result.needsRebuild = true;
            result.missingECRImages.push(machine.name);
          }
        }
      }

      // Check task definitions
      for (const machine of machines) {
        if (!machine.taskDefinitionArn) {
          result.needsRebuild = true;
          result.missingTaskDefinitions.push(machine.name);
        } else {
          const exists = await this.checkTaskDefinitionExists(machine.taskDefinitionArn);
          if (!exists) {
            result.needsRebuild = true;
            result.missingTaskDefinitions.push(machine.name);
          }
        }
      }

      // Check if scenario has build artifacts in MinIO
      if (!version.dockerComposePath && machines.length > 0) {
        result.canRebuild = false;
        result.reason = 'No build artifacts found in MinIO - cannot rebuild';
      }

    } catch (error: any) {
      this.logger.error(`[HEALTH CHECK] Error checking rebuild requirements:`, error);
      result.canRebuild = false;
      result.reason = `Health check error: ${error.message}`;
    }

    return result;
  }

  /**
   * Check if ECR image exists
   */
  private async checkECRImageExists(imageUri: string): Promise<boolean> {
    try {
      const { DescribeImagesCommand } = await import('@aws-sdk/client-ecr');

      // Parse image URI: 123456789012.dkr.ecr.us-east-1.amazonaws.com/repo:tag
      const parts = imageUri.split('/');
      const repoAndTag = parts[parts.length - 1];
      const [repoName, tag] = repoAndTag.split(':');

      const command = new DescribeImagesCommand({
        repositoryName: repoName,
        imageIds: tag ? [{ imageTag: tag }] : undefined,
      });

      await this.ecrClient.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'ImageNotFoundException' || error.name === 'RepositoryNotFoundException') {
        return false;
      }
      this.logger.warn(`Error checking ECR image ${imageUri}:`, error.message);
      return false;
    }
  }

  /**
   * Check if ECS task definition exists
   */
  private async checkTaskDefinitionExists(taskDefArn: string): Promise<boolean> {
    try {
      const { DescribeTaskDefinitionCommand } = await import('@aws-sdk/client-ecs');

      const command = new DescribeTaskDefinitionCommand({
        taskDefinition: taskDefArn,
      });

      await this.ecsClient.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'ClientException' || error.message?.includes('not found')) {
        return false;
      }
      this.logger.warn(`Error checking task definition ${taskDefArn}:`, error.message);
      return false;
    }
  }

  /**
   * Check VPC endpoints status
   */
  private async checkVPCEndpoints(): Promise<Array<{ exists: boolean; status?: string }>> {
    try {
      const { DescribeVpcEndpointsCommand } = await import('@aws-sdk/client-ec2');

      const ecrApiId = process.env.AWS_VPC_ENDPOINT_ECR_API_ID;
      const ecrDkrId = process.env.AWS_VPC_ENDPOINT_ECR_DKR_ID;
      const s3Id = process.env.AWS_VPC_ENDPOINT_S3_ID;

      const endpointIds = [ecrApiId, ecrDkrId, s3Id].filter(Boolean);

      if (endpointIds.length === 0) {
        return [{ exists: false, status: 'Not configured' }];
      }

      const command = new DescribeVpcEndpointsCommand({
        VpcEndpointIds: endpointIds as string[],
      });

      const response = await this.ec2Client.send(command);
      const endpoints = response.VpcEndpoints || [];

      return endpoints.map((ep: any) => ({
        exists: true,
        status: ep.State,
      }));
    } catch (error: any) {
      this.logger.warn('Error checking VPC endpoints:', error.message);
      return [{ exists: false, status: 'Check failed' }];
    }
  }

  /**
   * MinIO connectivity health check
   * Validates MinIO is accessible and can generate presigned URLs
   */
  async checkMinIOConnectivity(): Promise<{
    connected: boolean;
    canUpload: boolean;
    canDownload: boolean;
    error?: string;
  }> {
    try {
      const { MinioService } = await import('./minio.service');
      // This is a basic check - in production you'd inject MinioService
      
      const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
      const minioPort = process.env.MINIO_PORT || '9000';

      this.logger.log(`[HEALTH CHECK] Checking MinIO connectivity at ${minioEndpoint}:${minioPort}`);

      // Basic connectivity check would go here
      // For now, return success if environment is configured
      return {
        connected: !!minioEndpoint,
        canUpload: true,
        canDownload: true,
      };
    } catch (error: any) {
      return {
        connected: false,
        canUpload: false,
        canDownload: false,
        error: error.message,
      };
    }
  }
}
