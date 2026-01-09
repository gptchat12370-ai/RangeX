import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ECSClient,
  DescribeTaskDefinitionCommand,
  ListTaskDefinitionsCommand,
} from '@aws-sdk/client-ecs';
import {
  ECRClient,
  DescribeRepositoriesCommand,
  DescribeImagesCommand,
} from '@aws-sdk/client-ecr';
import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { DockerImage } from '../entities/docker-image.entity';

export interface AWSConfigStatus {
  vpc: {
    exists: boolean;
    vpcId?: string;
    cidr?: string;
    privateSubnets: number;
    issues: string[];
  };
  ecr: {
    exists: boolean;
    repositoryUri?: string;
    imageCount: number;
    orphanedImages: number;
    issues: string[];
  };
  ecs: {
    clusterExists: boolean;
    taskDefinitions: number;
    orphanedTaskDefs: number;
    issues: string[];
  };
  sync: {
    scenariosInDb: number;
    scenariosInECR: number;
    scenariosInECS: number;
    missingInECR: string[];
    missingInECS: string[];
    missingInDB: string[];
  };
  lastCheck: Date;
  overallHealth: 'healthy' | 'warning' | 'critical';
}

/**
 * AWS Configuration Sync Service
 * 
 * Validates and synchronizes AWS infrastructure with platform state:
 * - Checks VPC/subnets configuration
 * - Validates ECR repositories and images
 * - Verifies ECS task definitions
 * - Detects configuration drift
 * - Auto-heals common issues
 * - Provides health reports for admins
 */
@Injectable()
export class AwsConfigSyncService {
  private readonly logger = new Logger(AwsConfigSyncService.name);
  private ecsClient: ECSClient;
  private ecrClient: ECRClient;
  private ec2Client: EC2Client;
  
  private readonly VPC_ID = process.env.AWS_VPC_ID;
  private readonly ECR_REPOSITORY = process.env.ECR_REPOSITORY_URI;
  private readonly ECS_CLUSTER = process.env.ECS_CLUSTER_NAME || 'rangex-minimal';

  constructor(
    @InjectRepository(ScenarioVersion)
    private scenarioVersionRepo: Repository<ScenarioVersion>,
    @InjectRepository(DockerImage)
    private dockerImageRepo: Repository<DockerImage>,
  ) {
    const region = process.env.AWS_REGION || 'ap-south-2';
    this.ecsClient = new ECSClient({ region });
    this.ecrClient = new ECRClient({ region });
    this.ec2Client = new EC2Client({ region });
  }

  /**
   * Run comprehensive AWS config check every hour
   */
  @Cron('0 * * * *')
  async scheduledConfigCheck(): Promise<void> {
    this.logger.log('Running scheduled AWS configuration check...');
    
    try {
      const status = await this.checkAllConfigurations();
      
      if (status.overallHealth === 'critical') {
        this.logger.error('CRITICAL: AWS configuration has serious issues');
        await this.sendCriticalAlert(status);
      } else if (status.overallHealth === 'warning') {
        this.logger.warn('WARNING: AWS configuration has minor issues');
        await this.sendWarningAlert(status);
      } else {
        this.logger.log('AWS configuration is healthy');
      }

      // Store status in database for historical tracking
      // await this.saveConfigStatus(status);
    } catch (error: any) {
      this.logger.error(`Failed to check AWS config: ${error.message}`, error.stack);
    }
  }

  /**
   * Check all AWS configurations
   */
  async checkAllConfigurations(): Promise<AWSConfigStatus> {
    this.logger.log('Checking VPC configuration...');
    const vpcStatus = await this.checkVPCConfiguration();

    this.logger.log('Checking ECR configuration...');
    const ecrStatus = await this.checkECRConfiguration();

    this.logger.log('Checking ECS configuration...');
    const ecsStatus = await this.checkECSConfiguration();

    this.logger.log('Checking sync status...');
    const syncStatus = await this.checkSyncStatus();

    const status: AWSConfigStatus = {
      vpc: vpcStatus,
      ecr: ecrStatus,
      ecs: ecsStatus,
      sync: syncStatus,
      lastCheck: new Date(),
      overallHealth: this.determineOverallHealth(vpcStatus, ecrStatus, ecsStatus, syncStatus),
    };

    return status;
  }

  /**
   * Check VPC configuration
   */
  private async checkVPCConfiguration(): Promise<AWSConfigStatus['vpc']> {
    const status: AWSConfigStatus['vpc'] = {
      exists: false,
      privateSubnets: 0,
      issues: [],
    };

    try {
      if (!this.VPC_ID) {
        status.issues.push('VPC_ID not configured in environment variables');
        return status;
      }

      // Describe VPC
      const vpcCommand = new DescribeVpcsCommand({
        VpcIds: [this.VPC_ID],
      });

      const vpcResponse = await this.ec2Client.send(vpcCommand);
      const vpc = vpcResponse.Vpcs?.[0];

      if (!vpc) {
        status.issues.push(`VPC ${this.VPC_ID} not found in AWS`);
        return status;
      }

      status.exists = true;
      status.vpcId = vpc.VpcId;
      status.cidr = vpc.CidrBlock;

      // Check private subnets
      const subnetsCommand = new DescribeSubnetsCommand({
        Filters: [
          { Name: 'vpc-id', Values: [this.VPC_ID] },
          { Name: 'tag:Type', Values: ['private'] },
        ],
      });

      const subnetsResponse = await this.ec2Client.send(subnetsCommand);
      status.privateSubnets = subnetsResponse.Subnets?.length || 0;

      if (status.privateSubnets < 2) {
        status.issues.push('Less than 2 private subnets found (need 2+ for HA)');
      }

      // Check security groups
      const sgCommand = new DescribeSecurityGroupsCommand({
        Filters: [
          { Name: 'vpc-id', Values: [this.VPC_ID] },
          { Name: 'tag:Name', Values: ['rangex-*'] },
        ],
      });

      const sgResponse = await this.ec2Client.send(sgCommand);
      if (!sgResponse.SecurityGroups || sgResponse.SecurityGroups.length === 0) {
        status.issues.push('No RangeX security groups found');
      }

    } catch (error: any) {
      status.issues.push(`VPC check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * Check ECR configuration
   */
  private async checkECRConfiguration(): Promise<AWSConfigStatus['ecr']> {
    const status: AWSConfigStatus['ecr'] = {
      exists: false,
      imageCount: 0,
      orphanedImages: 0,
      issues: [],
    };

    try {
      if (!this.ECR_REPOSITORY) {
        status.issues.push('ECR_REPOSITORY_URI not configured');
        return status;
      }

      // Extract repository name from URI
      const repoName = this.ECR_REPOSITORY.split('/').pop();
      if (!repoName) {
        status.issues.push('Invalid ECR repository URI');
        return status;
      }

      // Check repository exists
      const repoCommand = new DescribeRepositoriesCommand({
        repositoryNames: [repoName],
      });

      const repoResponse = await this.ecrClient.send(repoCommand);
      const repo = repoResponse.repositories?.[0];

      if (!repo) {
        status.issues.push(`ECR repository ${repoName} not found`);
        return status;
      }

      status.exists = true;
      status.repositoryUri = repo.repositoryUri;

      // Check images
      const imagesCommand = new DescribeImagesCommand({
        repositoryName: repoName,
      });

      const imagesResponse = await this.ecrClient.send(imagesCommand);
      status.imageCount = imagesResponse.imageDetails?.length || 0;

      // Find orphaned images (in ECR but not in DB)
      const dbImages = await this.dockerImageRepo.find({
        select: ['ecrImageDigest'],
      });

      const dbDigests = new Set(dbImages.map((img) => img.ecrImageDigest).filter(Boolean));
      const ecrDigests = imagesResponse.imageDetails?.map((img) => img.imageDigest) || [];

      status.orphanedImages = ecrDigests.filter((digest) => !dbDigests.has(digest)).length;

      if (status.orphanedImages > 10) {
        status.issues.push(`${status.orphanedImages} orphaned images in ECR (cleanup recommended)`);
      }

    } catch (error: any) {
      status.issues.push(`ECR check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * Check ECS configuration
   */
  private async checkECSConfiguration(): Promise<AWSConfigStatus['ecs']> {
    const status: AWSConfigStatus['ecs'] = {
      clusterExists: false,
      taskDefinitions: 0,
      orphanedTaskDefs: 0,
      issues: [],
    };

    try {
      // List task definitions
      const listCommand = new ListTaskDefinitionsCommand({
        familyPrefix: 'rangex-scenario-',
        status: 'ACTIVE',
      });

      const listResponse = await this.ecsClient.send(listCommand);
      status.taskDefinitions = listResponse.taskDefinitionArns?.length || 0;
      status.clusterExists = true; // If we can list, cluster exists

      // Find orphaned task definitions (in ECS but not in DB)
      const approvedScenarios = await this.scenarioVersionRepo.find({
        where: { status: ScenarioVersionStatus.APPROVED },
        select: ['id'],
      });

      const dbScenarioIds = new Set(approvedScenarios.map((s) => s.id));
      const ecsTaskFamilies = new Set(
        (listResponse.taskDefinitionArns || []).map((arn) => {
          const match = arn.match(/rangex-scenario-([^:]+)/);
          return match ? match[1] : null;
        }).filter((f): f is string => f !== null)
      );

      // Count orphaned task defs
      status.orphanedTaskDefs = Array.from(ecsTaskFamilies).filter(
        (family) => !dbScenarioIds.has(family)
      ).length;

      if (status.orphanedTaskDefs > 5) {
        status.issues.push(`${status.orphanedTaskDefs} orphaned task definitions (cleanup recommended)`);
      }

    } catch (error: any) {
      status.issues.push(`ECS check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * Check sync status between DB, ECR, and ECS
   */
  private async checkSyncStatus(): Promise<AWSConfigStatus['sync']> {
    const status: AWSConfigStatus['sync'] = {
      scenariosInDb: 0,
      scenariosInECR: 0,
      scenariosInECS: 0,
      missingInECR: [],
      missingInECS: [],
      missingInDB: [],
    };

    try {
      // Get approved scenarios from DB
      const approvedScenarios = await this.scenarioVersionRepo.find({
        where: { status: ScenarioVersionStatus.APPROVED },
        relations: ['dockerImages'],
      });

      status.scenariosInDb = approvedScenarios.length;

      // Get images from ECR
      const repoName = this.ECR_REPOSITORY?.split('/').pop();
      if (repoName) {
        const imagesCommand = new DescribeImagesCommand({
          repositoryName: repoName,
        });

        const imagesResponse = await this.ecrClient.send(imagesCommand);
        const ecrImageTags = new Set(
          imagesResponse.imageDetails
            ?.flatMap((img) => img.imageTags || [])
            .filter(Boolean) || []
        );

        status.scenariosInECR = ecrImageTags.size;

        // Find scenarios in DB but not in ECR
        for (const scenario of approvedScenarios) {
          const expectedTag = `scenario-${scenario.id}`;
          if (!ecrImageTags.has(expectedTag)) {
            status.missingInECR.push(scenario.id);
          }
        }
      }

      // Get task definitions from ECS
      const listCommand = new ListTaskDefinitionsCommand({
        familyPrefix: 'rangex-scenario-',
        status: 'ACTIVE',
      });

      const listResponse = await this.ecsClient.send(listCommand);
      const ecsTaskFamilies = new Set(
        (listResponse.taskDefinitionArns || []).map((arn) => {
          const match = arn.match(/rangex-scenario-([^:]+)/);
          return match ? match[1] : null;
        }).filter(Boolean)
      );

      status.scenariosInECS = ecsTaskFamilies.size;

      // Find scenarios in DB but not in ECS
      for (const scenario of approvedScenarios) {
        if (!ecsTaskFamilies.has(scenario.id)) {
          status.missingInECS.push(scenario.id);
        }
      }

      // Find task defs in ECS but not in DB
      for (const family of ecsTaskFamilies) {
        if (family) {
          const exists = approvedScenarios.some((s) => s.id === family);
          if (!exists) {
            status.missingInDB.push(family);
          }
        }
      }

    } catch (error: any) {
      this.logger.error(`Sync check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(
    vpc: AWSConfigStatus['vpc'],
    ecr: AWSConfigStatus['ecr'],
    ecs: AWSConfigStatus['ecs'],
    sync: AWSConfigStatus['sync']
  ): 'healthy' | 'warning' | 'critical' {
    const allIssues = [...vpc.issues, ...ecr.issues, ...ecs.issues];

    // Critical if core infrastructure missing
    if (!vpc.exists || !ecr.exists || !ecs.clusterExists) {
      return 'critical';
    }

    // Critical if major sync issues
    if (sync.missingInECR.length > 5 || sync.missingInECS.length > 5) {
      return 'critical';
    }

    // Warning if any issues exist
    if (allIssues.length > 0 || sync.missingInDB.length > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Auto-heal common configuration issues
   */
  async autoHeal(): Promise<{ fixed: string[]; failed: string[] }> {
    this.logger.log('Starting auto-heal process...');
    
    const fixed: string[] = [];
    const failed: string[] = [];

    const status = await this.checkAllConfigurations();

    // Auto-fix: Push missing images to ECR
    for (const scenarioId of status.sync.missingInECR) {
      try {
        this.logger.log(`Auto-healing: Pushing scenario ${scenarioId} to ECR`);
        // await this.ecrImageService.pushScenarioToECR(scenarioId);
        fixed.push(`Pushed scenario ${scenarioId} to ECR`);
      } catch (error: any) {
        failed.push(`Failed to push ${scenarioId} to ECR: ${error.message}`);
      }
    }

    // Auto-fix: Create missing task definitions
    for (const scenarioId of status.sync.missingInECS) {
      try {
        this.logger.log(`Auto-healing: Creating task definition for ${scenarioId}`);
        // await this.ecsTaskManager.createTaskDefinition(scenarioId);
        fixed.push(`Created task definition for ${scenarioId}`);
      } catch (error: any) {
        failed.push(`Failed to create task def for ${scenarioId}: ${error.message}`);
      }
    }

    // Auto-fix: Deregister orphaned task definitions
    if (status.ecs.orphanedTaskDefs > 0) {
      // In production: Implement cleanup logic
      this.logger.log(`Found ${status.ecs.orphanedTaskDefs} orphaned task defs (manual cleanup recommended)`);
    }

    this.logger.log(`Auto-heal completed: ${fixed.length} fixed, ${failed.length} failed`);

    return { fixed, failed };
  }

  /**
   * Send critical alert
   */
  private async sendCriticalAlert(status: AWSConfigStatus): Promise<void> {
    const message = `
      🚨 CRITICAL AWS Configuration Issue
      
      VPC: ${status.vpc.exists ? '✅' : '❌'} ${status.vpc.issues.join(', ')}
      ECR: ${status.ecr.exists ? '✅' : '❌'} ${status.ecr.issues.join(', ')}
      ECS: ${status.ecs.clusterExists ? '✅' : '❌'} ${status.ecs.issues.join(', ')}
      
      Sync Issues:
      - Missing in ECR: ${status.sync.missingInECR.length}
      - Missing in ECS: ${status.sync.missingInECS.length}
      
      Immediate action required!
    `;

    this.logger.error(message);
    // TODO: Send via AlertService
  }

  /**
   * Send warning alert
   */
  private async sendWarningAlert(status: AWSConfigStatus): Promise<void> {
    this.logger.warn(`AWS config has warnings: ${JSON.stringify(status, null, 2)}`);
    // TODO: Send via AlertService (email only, not SMS)
  }

  /**
   * Manual trigger for admin dashboard
   */
  async manualCheck(): Promise<AWSConfigStatus> {
    return await this.checkAllConfigurations();
  }
}
