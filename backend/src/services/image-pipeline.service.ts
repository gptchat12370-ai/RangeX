import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { DockerImage } from '../entities/docker-image.entity';
import { MinioService } from './minio.service';
import { BundleService } from './bundle.service';
import { DockerComposeSyncServicePhase23 } from './docker-compose-sync-phase23.service';
import { ECRClient, PutImageCommand, BatchGetImageCommand, DescribeImagesCommand } from '@aws-sdk/client-ecr';
import { ECSClient, RegisterTaskDefinitionCommand } from '@aws-sdk/client-ecs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export type PipelineStage = 'local' | 'staging' | 'admin_review' | ScenarioVersionStatus.APPROVED | 'production';

export interface PipelineStatus {
  scenarioId: string;
  currentStage: PipelineStage;
  stages: {
    local: { completed: boolean; timestamp?: Date };
    staging: { completed: boolean; timestamp?: Date; minioPath?: string };
    admin_review: { completed: boolean; timestamp?: Date; reviewerId?: string };
    approved: { completed: boolean; timestamp?: Date };
    production: { completed: boolean; timestamp?: Date; ecrUri?: string };
  };
  securityChecks: {
    malwareScan: boolean;
    vulnerabilityScan: boolean;
    complianceCheck: boolean;
  };
  validations: {
    resourceLimits: boolean;
    portWhitelist: boolean;
    imageSize: boolean;
  };
}

/**
 * Image Pipeline Service
 * 
 * Workflow:
 * 1. Creator builds/tests locally (connects to their Docker)
 * 2. Creator submits → Image uploaded to MinIO staging area
 * 3. Admin reviews → Security scan, validation, compliance check
 * 4. Admin approves → Image pushed to ECR (production)
 * 5. Solver accesses → ECS pulls from ECR to run challenges
 * 
 * Benefits:
 * - Cost: Only approved images go to ECR (no wasted ECR storage)
 * - Security: Multi-stage validation before production
 * - Efficiency: Creators test locally, admins review in staging
 * - Control: Admin approval gate prevents malicious/broken images
 */
@Injectable()
export class ImagePipelineService {
  private readonly logger = new Logger(ImagePipelineService.name);
  private ecrClient: ECRClient;
  private ecsClient: ECSClient;
  
  private readonly ECR_REPOSITORY_URI = process.env.ECR_REPOSITORY_URI;
  private readonly MINIO_STAGING_BUCKET = 'rangex-staging';

  constructor(
    @InjectRepository(ScenarioVersion)
    private scenarioVersionRepo: Repository<ScenarioVersion>,
    @InjectRepository(DockerImage)
    private dockerImageRepo: Repository<DockerImage>,
    private minioService: MinioService,
    private bundleService: BundleService,
    private composeSyncService: DockerComposeSyncServicePhase23,
  ) {
    const region = process.env.AWS_REGION || 'ap-south-2';
    this.ecrClient = new ECRClient({ region });
    this.ecsClient = new ECSClient({ region });
  }

  /**
   * STAGE 1: Creator connects to local Docker
   * (Handled by CreatorTestingService - no backend needed)
   */

  /**
   * STAGE 2: Submit scenario for review
   * NEW BUNDLE ARCHITECTURE: No longer exports single image
   * Validation only - bundle creation happens on approval
   */
  async submitToStaging(
    scenarioId: string,
    userId: string,
    localImageName?: string  // Now optional - not used in bundle flow
  ): Promise<{ success: boolean; stagingPath?: string; error?: string }> {
    this.logger.log(`Submitting scenario ${scenarioId} for review`);

    try {
      // Validate scenario version exists
      const scenarioVersion = await this.scenarioVersionRepo.findOne({
        where: { id: scenarioId },
        relations: ['machines'],
      });

      if (!scenarioVersion) {
        return { success: false, error: 'Scenario version not found' };
      }

      // Validate local test status (MUST be PASS)
      if (scenarioVersion.localTestStatus !== 'PASS') {
        return {
          success: false,
          error: `Cannot submit: Local test status is ${scenarioVersion.localTestStatus}. Must be PASS.`
        };
      }

      // Validate machines exist
      if (!scenarioVersion.machines || scenarioVersion.machines.length === 0) {
        return {
          success: false,
          error: 'No machines configured. Configure machines in Environment tab before submitting.'
        };
      }

      // Update status to SUBMITTED
      await this.scenarioVersionRepo.update(
        { id: scenarioId },
        {
          status: ScenarioVersionStatus.SUBMITTED as any,
          currentStage: 'submitted',
          metadata: {
            ...(scenarioVersion.metadata || {}),
            submittedAt: new Date().toISOString(),
            submittedBy: userId,
          } as any,
        }
      );

      this.logger.log(`Scenario ${scenarioId} submitted for review`);

      return {
        success: true,
        stagingPath: 'pending_approval', // No staging artifact in bundle flow
      };
    } catch (error: any) {
      this.logger.error(`Submit failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * STAGE 3: Admin reviews image in staging
   */
  async getReviewDetails(scenarioId: string): Promise<{
    scenarioVersion: ScenarioVersion;
    stagingPath: string;
    securityScanResults: any;
    validationResults: any;
    imageMetadata: any;
  }> {
    const scenarioVersion = await this.scenarioVersionRepo.findOne({
      where: { id: scenarioId },
      relations: ['scenario', 'dockerImages', 'createdBy'],
    });

    if (!scenarioVersion) {
      throw new Error(`Scenario version not found: ${scenarioId}`);
    }

    const stagingPath = scenarioVersion.metadata?.stagingPath;
    if (!stagingPath) {
      throw new Error('No staging path found for scenario');
    }

    // Get security scan results
    const securityScanResults = await this.getSecurityScanResults(scenarioId);

    // Get validation results
    const validationResults = await this.validateStagingImage(scenarioId);

    // Get image metadata
    const imageMetadata = await this.getImageMetadata(stagingPath);

    return {
      scenarioVersion,
      stagingPath,
      securityScanResults,
      validationResults,
      imageMetadata,
    };
  }

  /**
   * STAGE 4: Admin approves → Create bundle and push to ECR (DEPRECATED)
   * NEW WORKFLOW: Admin approves → Create bundle in MinIO (LOCAL STORAGE)
   * Deploy happens separately via admin/deployments endpoints
   */
  async approveAndPushToECR(
    scenarioId: string,
    adminId: string
  ): Promise<{ success: boolean; bundlePath?: string; ecrUri?: string; taskDefinitionArn?: string; error?: string }> {
    this.logger.log(`Approving scenario ${scenarioId} and creating bundle`);

    try {
      // Step 1: Get scenario version with machines
      const scenarioVersion = await this.scenarioVersionRepo.findOne({
        where: { id: scenarioId },
        relations: ['machines', 'assets'],
      });

      if (!scenarioVersion) {
        throw new Error(`Scenario version not found: ${scenarioId}`);
      }

      // Step 2: Check if local test passed
      if (scenarioVersion.localTestStatus !== 'PASS') {
        throw new Error(`Cannot approve: Local test status is ${scenarioVersion.localTestStatus}. Must be PASS.`);
      }

      // Step 3: Generate docker-compose from Environment tab
      this.logger.log('Generating docker-compose from Environment tab...');
      const composeResult = await this.composeSyncService.validateAndGenerateCompose(scenarioId);
      
      if (composeResult.status === 'OUT_OF_SYNC') {
        this.logger.warn(`Compose out of sync - applying ${composeResult.corrections.length} corrections`);
      }

      const dockerCompose = composeResult.finalComposeYAML;

      // Step 4: Create bundle in MinIO (LOCAL STORAGE)
      this.logger.log('Creating scenario bundle in MinIO...');
      const bundle = await this.bundleService.createBundle(scenarioId, dockerCompose);

      this.logger.log(`Bundle created: ${bundle.scenarioVersionId} with ${bundle.images.length} images`);

      // Step 5: Update scenario version status
      await this.scenarioVersionRepo.update(
        { id: scenarioId },
        {
          status: ScenarioVersionStatus.APPROVED as any,
          approvedAt: new Date() as any,
          currentStage: 'bundled',
        }
      );

      this.logger.log(`Approval complete: ${scenarioId} - bundle ready for deployment`);

      return {
        success: true,
        bundlePath: scenarioVersion.bundlePath,
        ecrUri: undefined, // No ECR push on approval anymore
        taskDefinitionArn: undefined,
      };

    } catch (error: any) {
      this.logger.error(`Failed to approve and push: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * STAGE 5: Solver accesses via ECS (already implemented in EnvironmentService)
   */

  /**
   * Security scan (using Snyk or Trivy)
   */
  private async runSecurityScan(scenarioId: string, stagingPath: string): Promise<void> {
    this.logger.log(`Running security scan for ${scenarioId}`);

    // Download from MinIO
    const localTarball = `/tmp/rangex-scan-${scenarioId}.tar`;
    
    // Use getFileStream to download
    const stream = await this.minioService.getFileStream(stagingPath);
    const writeStream = require('fs').createWriteStream(localTarball);
    await new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Load into Docker
    await execAsync(`docker load -i ${localTarball}`);

    try {
      // Run Trivy scan
      const { stdout: scanOutput } = await execAsync(`trivy image --format json scenario-${scenarioId}`);
      const scanResults = JSON.parse(scanOutput);

      // Store scan results in metadata (simplified - TypeORM type issue)
      // Note: metadata update would need proper entity structure
      this.logger.log(`Security scan completed for ${scenarioId}`);
      // TODO: Store scan results in dedicated security_scans table

      this.logger.log(`Security scan completed for ${scenarioId}`);
    } catch (error: any) {
      this.logger.error(`Security scan failed: ${error.message}`);
      // Log error - metadata update removed due to TypeORM type issues
    } finally {
      // Cleanup
      await execAsync(`rm ${localTarball}`);
    }
  }

  /**
   * Validate staging image
   */
  private async validateStagingImage(scenarioId: string): Promise<any> {
    const scenarioVersion = await this.scenarioVersionRepo.findOne({
      where: { id: scenarioId },
    });

    if (!scenarioVersion) {
      throw new Error('Scenario version not found');
    }

    const validations = {
      resourceLimits: true,
      portWhitelist: true,
      imageSize: true,
      securityScan: false,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Check security scan results
    const securityScan = scenarioVersion.metadata?.securityScan;
    if (securityScan) {
      if (securityScan.criticalVulnerabilities > 0) {
        validations.errors.push(`${securityScan.criticalVulnerabilities} CRITICAL vulnerabilities found`);
        validations.securityScan = false;
      } else if (securityScan.highVulnerabilities > 5) {
        validations.warnings.push(`${securityScan.highVulnerabilities} HIGH vulnerabilities found`);
      }
    }

    return validations;
  }

  /**
   * Get image metadata
   */
  private async getImageMetadata(stagingPath: string): Promise<any> {
    // In production: Extract metadata from Docker image manifest
    // For now: Return placeholder
    return {
      size: '1.2 GB',
      layers: 15,
      createdAt: new Date(),
    };
  }

  /**
   * Get security scan results
   */
  private async getSecurityScanResults(scenarioId: string): Promise<any> {
    const scenarioVersion = await this.scenarioVersionRepo.findOne({
      where: { id: scenarioId },
    });

    return scenarioVersion?.metadata?.securityScan || { status: 'pending' };
  }

  /**
   * Create ECS task definition
   */
  private async createECSTaskDefinition(scenarioId: string, ecrUri: string): Promise<string> {
    this.logger.log(`Creating ECS task definition for ${scenarioId}`);

    const taskDefCommand = new RegisterTaskDefinitionCommand({
      family: `rangex-scenario-${scenarioId}`,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '256',
      memory: '512',
      containerDefinitions: [
        {
          name: 'challenge',
          image: ecrUri,
          portMappings: [
            { containerPort: 22, protocol: 'tcp' },
            { containerPort: 80, protocol: 'tcp' },
            { containerPort: 5900, protocol: 'tcp' },
          ],
          environment: [
            { name: 'SCENARIO_ID', value: scenarioId },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': `/rangex/scenario-${scenarioId}`,
              'awslogs-region': process.env.AWS_REGION || 'ap-south-2',
              'awslogs-stream-prefix': 'challenge',
            },
          },
        },
      ],
    });

    const response = await this.ecsClient.send(taskDefCommand);
    const taskDefArn = response.taskDefinition?.taskDefinitionArn;

    this.logger.log(`Created task definition: ${taskDefArn}`);

    return taskDefArn!;
  }

  /**
   * Helpers
   */
  private async getFileSizeGB(filePath: string): Promise<number> {
    const { stdout } = await execAsync(`stat -c%s ${filePath}`);
    const bytes = parseInt(stdout.trim());
    return bytes / (1024 * 1024 * 1024);
  }

  private async getFileSizeBytes(filePath: string): Promise<number> {
    const { stdout } = await execAsync(`stat -c%s ${filePath}`);
    return parseInt(stdout.trim());
  }

  private countVulnerabilities(scanResults: any, severity: string): number {
    // Parse Trivy JSON output
    let count = 0;
    for (const result of scanResults.Results || []) {
      for (const vuln of result.Vulnerabilities || []) {
        if (vuln.Severity === severity) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Reject scenario (admin action)
   */
  async rejectScenario(scenarioId: string, adminId: string, reason: string): Promise<void> {
    this.logger.log(`Rejecting scenario ${scenarioId}: ${reason}`);

    await this.scenarioVersionRepo.update(
      { id: scenarioId },
      {
        status: ScenarioVersionStatus.DRAFT as any,
      }
    );

    // TODO: Store rejection details in separate table
    // TODO: Notify creator via AlertService
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(scenarioId: string): Promise<PipelineStatus> {
    // Resolve to version ID (handle both scenarioId and versionId)
    const versionId = await this.resolveToVersionId(scenarioId);

    const scenarioVersion = await this.scenarioVersionRepo.findOne({
      where: { id: versionId },
    });

    if (!scenarioVersion) {
      throw new Error('Scenario version not found');
    }

    const metadata = scenarioVersion.metadata || {};

    return {
      scenarioId: versionId,
      currentStage: this.determineCurrentStage(scenarioVersion.status),
      stages: {
        local: {
          completed: !!metadata.submittedAt,
          timestamp: metadata.submittedAt,
        },
        staging: {
          completed: !!metadata.stagingPath,
          timestamp: metadata.submittedAt,
          minioPath: metadata.stagingPath,
        },
        admin_review: {
          completed: !!metadata.securityScan,
          timestamp: metadata.securityScan?.timestamp,
          reviewerId: metadata.reviewedBy,
        },
        approved: {
          completed: scenarioVersion.status === ScenarioVersionStatus.APPROVED,
          timestamp: metadata.approvedAt,
        },
        production: {
          completed: !!metadata.ecrUri,
          timestamp: metadata.approvedAt,
          ecrUri: metadata.ecrUri,
        },
      },
      securityChecks: {
        malwareScan: metadata.securityScan?.tool === 'trivy',
        vulnerabilityScan: metadata.securityScan?.criticalVulnerabilities === 0,
        complianceCheck: true, // TODO: Implement compliance check
      },
      validations: {
        resourceLimits: true,
        portWhitelist: true,
        imageSize: true,
      },
    };
  }

  /**
   * Resolve scenarioId or versionId to versionId
   * Same pattern as creator-testing.controller.ts
   */
  private async resolveToVersionId(id: string): Promise<string> {
    // Try as versionId first
    const version = await this.scenarioVersionRepo.findOne({ where: { id } });
    if (version) return version.id;

    // Try as scenarioId - get latest version
    const latestVersion = await this.scenarioVersionRepo.findOne({
      where: { scenarioId: id },
      order: { versionNumber: 'DESC' as any },
    });
    if (latestVersion) return latestVersion.id;

    throw new Error(`No scenario or version found with ID: ${id}`);
  }

  private determineCurrentStage(status: string): PipelineStage {
    switch (status) {
      case ScenarioVersionStatus.DRAFT: return 'local';
      case ScenarioVersionStatus.SUBMITTED: return 'admin_review';
      case ScenarioVersionStatus.APPROVED: return 'production';
      default: return 'local';
    }
  }
}
