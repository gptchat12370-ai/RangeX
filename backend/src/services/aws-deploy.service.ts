import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeploymentEnvironment } from '../entities/deployment-environment.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { BundleService, ScenarioBundle } from './bundle.service';
import { DockerComposeSyncServicePhase23 } from './docker-compose-sync-phase23.service';
import {
  ECSClient,
  CreateServiceCommand,
  DeleteServiceCommand,
  UpdateServiceCommand,
  StopTaskCommand,
  RegisterTaskDefinitionCommand,
  DeregisterTaskDefinitionCommand,
  RunTaskCommand,
  DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  ECRClient,
  CreateRepositoryCommand,
  DeleteRepositoryCommand,
  BatchDeleteImageCommand,
  GetAuthorizationTokenCommand,
  PutImageCommand,
  DescribeRepositoriesCommand,
} from '@aws-sdk/client-ecr';
import {
  EC2Client,
  CreateVpcEndpointCommand,
  DeleteVpcEndpointsCommand,
  DescribeNetworkInterfacesCommand,
  DescribeRouteTablesCommand,
} from '@aws-sdk/client-ec2';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeploymentResult {
  deploymentId: string;
  gatewayEndpoint: string;
  entrypoints: Array<{
    machineName: string;
    protocol: string;
    externalPort: number;
    connectionString: string;
  }>;
  status: 'DEPLOYING' | 'DEPLOYED';
}

@Injectable()
export class AwsDeployService {
  private readonly logger = new Logger(AwsDeployService.name);
  private readonly ecsClient: ECSClient;
  private readonly ecrClient: ECRClient;
  private readonly ec2Client: EC2Client;
  private readonly clusterName: string;
  private readonly vpcId: string;
  private readonly subnets: string[];
  private readonly securityGroups: string[];

  constructor(
    @InjectRepository(DeploymentEnvironment)
    private readonly deploymentRepo: Repository<DeploymentEnvironment>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly bundleService: BundleService,
    private readonly composeSyncService: DockerComposeSyncServicePhase23,
    private readonly configService: ConfigService,
  ) {
    const region = this.configService.get<string>('AWS_REGION', 'ap-south-2');
    
    this.ecsClient = new ECSClient({ region });
    this.ecrClient = new ECRClient({ region });
    this.ec2Client = new EC2Client({ region });

    this.clusterName = this.configService.get<string>('ECS_CLUSTER_NAME', 'rangex-ephemeral');
    this.vpcId = this.configService.get<string>('VPC_ID') || '';
    this.subnets = this.configService.get<string>('SUBNETS', '').split(',');
    this.securityGroups = this.configService.get<string>('SECURITY_GROUPS', '').split(',');
  }

  /**
   * Deploy scenario to AWS (Option A: Shared Infrastructure)
   * Uses: Build Orchestration ECR images, shared VPC endpoints, ECS Fargate
   * Cost: ~$0.08/hour (Fargate only), $0/hour when parked
   */
  async deployToAWS(versionId: string, deploymentName?: string): Promise<DeploymentResult> {
    this.logger.log(`Deploying version ${versionId} to AWS`);

    // Load scenario version
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new Error('Scenario version not found');
    }

    // Ensure bundle exists
    let bundle: ScenarioBundle;
    if (version.bundleStatus !== 'READY') {
      this.logger.log('Bundle not ready, creating...');
      // Generate compose from Environment tab
      const composeResult = await this.composeSyncService.validateAndGenerateCompose(versionId);
      const compose = composeResult.finalComposeYAML;
      bundle = await this.bundleService.createBundle(versionId, compose);
    } else {
      if (!version.bundlePath) {
        throw new Error('Bundle path not found');
      }
      bundle = await this.bundleService.getBundle(version.bundlePath);
    }

    // Create deployment record
    const deployment = this.deploymentRepo.create({
      scenarioVersionId: versionId,
      deploymentName: deploymentName || `scenario-${version.scenarioId}-v${version.versionNumber}`,
      status: 'DEPLOYING',
      entrypointsConfig: bundle.portMapping.map(pm => ({
        machineName: pm.machineName,
        protocol: pm.protocol,
        externalPort: pm.externalPort,
        containerPort: pm.containerPort,
      })),
    });

    await this.deploymentRepo.save(deployment);

    try {
      // Step 1: SKIP - ECR repos already exist from Build Orchestration
      // Images are already pushed to 'rangex/machine-name' by approval pipeline
      const ecrRepoPrefix = 'rangex'; // Use shared repo instead of per-deployment prefix

      // Step 2: SKIP - Images already in ECR (no re-push needed)
      // Build Orchestration already pushed images when version was approved

      // Step 3: Use existing shared VPC endpoints (cost-effective)
      const vpcEndpoints = await this.getSharedVPCEndpoints();

      // Step 4: Register ECS task definitions (using Build Orchestration images)
      const taskDefs = await this.registerTaskDefinitions(bundle, ecrRepoPrefix);

      // Step 5: Start gateway task
      const gatewayTaskArn = await this.startGatewayTask(bundle, taskDefs.gateway);

      // Step 6: Start machine tasks
      const machineTaskArns = await this.startMachineTasks(bundle, taskDefs.machines);

      // Step 7: Get gateway endpoint
      const gatewayEndpoint = await this.getGatewayEndpoint(gatewayTaskArn);

      // Update deployment
      deployment.status = 'DEPLOYED';
      deployment.gatewayEndpoint = gatewayEndpoint;
      deployment.ecrRepositoryPrefix = ecrRepoPrefix;
      deployment.gatewayTaskArn = gatewayTaskArn;
      deployment.machineTaskArns = machineTaskArns;
      deployment.vpcEndpointIds = vpcEndpoints;
      deployment.deployedAt = new Date();

      await this.deploymentRepo.save(deployment);

      // Update version
      await this.versionRepo.update(versionId, {
        currentStage: 'deployed',
      });

      // Build connection strings
      const entrypoints = bundle.portMapping.map(pm => ({
        machineName: pm.machineName,
        protocol: pm.protocol,
        externalPort: pm.externalPort,
        connectionString: `${pm.protocol}://${gatewayEndpoint}:${pm.externalPort}`,
      }));

      return {
        deploymentId: deployment.id,
        gatewayEndpoint,
        entrypoints,
        status: 'DEPLOYED',
      };
    } catch (error) {
      this.logger.error('Deployment failed:', error);
      deployment.status = 'FAILED';
      await this.deploymentRepo.save(deployment);
      throw error;
    }
  }

  /**
   * PARK deployment (stop ECS tasks only - Option A: Shared Infrastructure)
   * Stops: ECS tasks (gateway + machines)
   * Keeps: ECR images (reusable), VPC endpoints (shared), deployment record
   * Cost after park: $0/hour (only ECR storage ~$0.10/GB/month)
   */
  async parkDeployment(deploymentId: string): Promise<void> {
    this.logger.log(`Parking deployment ${deploymentId}`);

    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    if (deployment.status === 'PARKED') {
      this.logger.warn('Deployment already parked');
      return;
    }

    try {
      // Step 1: Stop ECS tasks (ONLY real cost component)
      if (deployment.gatewayTaskArn) {
        await this.stopTask(deployment.gatewayTaskArn);
      }

      for (const taskArn of deployment.machineTaskArns || []) {
        await this.stopTask(taskArn);
      }

      // Step 2: KEEP ECR images (already built by Build Orchestration, reusable)
      // NO deletion - images persist for instant unpark

      // Step 3: KEEP VPC endpoints (shared infrastructure, never delete)
      // VPC endpoints are shared across all deployments

      // Update deployment
      deployment.status = 'PARKED';
      deployment.parkedAt = new Date();
      deployment.gatewayTaskArn = undefined;
      deployment.machineTaskArns = [];
      // KEEP vpcEndpointIds and ecrRepositoryPrefix for unpark

      await this.deploymentRepo.save(deployment);

      this.logger.log(`Deployment ${deploymentId} parked successfully (ECS tasks stopped, ECR images preserved)`);
    } catch (error) {
      this.logger.error('Park failed:', error);
      throw error;
    }
  }

  /**instant resume - Option A: Shared Infrastructure)
   * Recreates: ECS tasks only
   * Uses: Existing ECR images (Build Orchestration), shared VPC endpoints
   * Unpark time: ~30 seconds (images already cached in ECRks
   * Uses: Same bundle, same port mapping (stable)
   */
  async unparkDeployment(deploymentId: string): Promise<DeploymentResult> {
    this.logger.log(`Unparking deployment ${deploymentId}`);

    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
      relations: ['scenarioVersion'],
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    if (deployment.status !== 'PARKED') {
      throw new Error('Deployment is not parked');
    }

    // Load bundle from local storage
    if (!deployment.scenarioVersion.bundlePath) {
      throw new Error('Bundle path not found for deployment');
    }
    const bundle = await this.bundleService.getBundle(deployment.scenarioVersion.bundlePath);

    deployment.status = 'DEPLOYING';
    await this.deploymentRepo.save(deployment);

    try {
      // Step 1: SKIP - ECR repos already exist (Build Orchestration images)
      const ecrRepoPrefix = deployment.ecrRepositoryPrefix || 'rangex';

      // Step 2: SKIP - Images already in ECR (no re-push, instant unpark!)
      // Build Orchestration images are persistent

      // Step 3: Use existing shared VPC endpoints
      const vpcEndpoints = deployment.vpcEndpointIds || await this.getSharedVPCEndpoints();

      // Step 4: Register task definitions (using existing images)
      const taskDefs = await this.registerTaskDefinitions(bundle, ecrRepoPrefix);

      // Start tasks
      const gatewayTaskArn = await this.startGatewayTask(bundle, taskDefs.gateway);
      const machineTaskArns = await this.startMachineTasks(bundle, taskDefs.machines);

      // Get new gateway endpoint
      const gatewayEndpoint = await this.getGatewayEndpoint(gatewayTaskArn);

      // Update deployment
      deployment.status = 'DEPLOYED';
      deployment.gatewayEndpoint = gatewayEndpoint;
      deployment.ecrRepositoryPrefix = ecrRepoPrefix;
      deployment.gatewayTaskArn = gatewayTaskArn;
      deployment.machineTaskArns = machineTaskArns;
      deployment.vpcEndpointIds = vpcEndpoints;
      deployment.deployedAt = new Date();

      await this.deploymentRepo.save(deployment);

      // Build connection strings (stable ports from bundle)
      const entrypoints = bundle.portMapping.map(pm => ({
        machineName: pm.machineName,
        protocol: pm.protocol,
        externalPort: pm.externalPort,
        connectionString: `${pm.protocol}://${gatewayEndpoint}:${pm.externalPort}`,
      }));

      return {
        deploymentId: deployment.id,
        gatewayEndpoint,
        entrypoints,
        status: 'DEPLOYED',
      };
    } catch (error) {
      this.logger.error('Unpark failed:', error);
      deployment.status = 'FAILED';
      await this.deploymentRepo.save(deployment);
      throw error;
    }
  }

  /**
   * FULL TEARDOWN (delete CloudFormation/Terraform stack)
   * Use this for complete cleanup including VPC, cluster, IAM
   */
  async fullTeardown(deploymentId: string): Promise<void> {
    this.logger.log(`Full teardown for deployment ${deploymentId}`);

    const deployment = await this.deploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Park first (clean ECS/ECR/VPC endpoints)
    if (deployment.status !== 'PARKED') {
      await this.parkDeployment(deploymentId);
    }

    // Delete CloudFormation/Terraform stack if managed
    if (deployment.infraStackName) {
      this.logger.log(`Deleting infrastructure stack: ${deployment.infraStackName}`);
      // TODO: Implement CloudFormation/Terraform deletion
    }

    // Update deployment
    deployment.status = 'FULL_TEARDOWN';
    deployment.deletedAt = new Date();
    await this.deploymentRepo.save(deployment);

    this.logger.log(`Full teardown completed for ${deploymentId}`);
  }

  // ========== PRIVATE HELPER METHODS ==========

  private async createECRRepositories(bundle: ScenarioBundle, repoPrefix: string): Promise<void> {
    for (const image of bundle.images) {
      if (image.sourceType === 'public_digest') continue;

      const repoName = `${repoPrefix}/${image.machineName}`;
      try {
        await this.ecrClient.send(new CreateRepositoryCommand({
          repositoryName: repoName,
        }));
        this.logger.log(`Created ECR repo: ${repoName}`);
      } catch (error: any) {
        if (error.name !== 'RepositoryAlreadyExistsException') {
          throw error;
        }
      }
    }
  }

  private async deleteECRRepositories(repoPrefix: string): Promise<void> {
    if (!repoPrefix) return;

    this.logger.log(`Deleting ECR repositories with prefix: ${repoPrefix}`);

    try {
      // List all repositories
      const listRepos = await this.ecrClient.send(new DescribeRepositoriesCommand({}));
      
      if (!listRepos.repositories) return;

      // Filter repositories by prefix
      const reposToDelete = listRepos.repositories
        .filter(repo => repo.repositoryName?.startsWith(repoPrefix))
        .map(repo => repo.repositoryName!);

      // Delete each repository
      for (const repoName of reposToDelete) {
        try {
          await this.ecrClient.send(new DeleteRepositoryCommand({
            repositoryName: repoName,
            force: true, // Delete even if images exist
          }));
          this.logger.log(`Deleted ECR repo: ${repoName}`);
        } catch (error: any) {
          this.logger.warn(`Failed to delete repo ${repoName}:`, error.message);
        }
      }
    } catch (error) {
      this.logger.error('Error deleting ECR repositories:', error);
    }
  }

  private async pushImagesToECR(bundle: ScenarioBundle, repoPrefix: string): Promise<void> {
    // Get ECR auth token
    const authData = await this.ecrClient.send(new GetAuthorizationTokenCommand({}));
    const token = authData.authorizationData?.[0]?.authorizationToken;
    const endpoint = authData.authorizationData?.[0]?.proxyEndpoint;

    if (!token || !endpoint) {
      throw new Error('Failed to get ECR auth token');
    }

    // Login to ECR
    const [username, password] = Buffer.from(token, 'base64').toString().split(':');
    await execAsync(`echo ${password} | docker login --username ${username} --password-stdin ${endpoint}`);

    // Push images
    for (const image of bundle.images) {
      if (image.sourceType === 'public_digest') {
        // Public image - pull and push
        await execAsync(`docker pull ${image.imageRef}`);
        const ecrImage = `${endpoint.replace('https://', '')}/${repoPrefix}/${image.machineName}:latest`;
        await execAsync(`docker tag ${image.imageRef} ${ecrImage}`);
        await execAsync(`docker push ${ecrImage}`);
      } else {
        // OCI archive - load from MinIO and push
        if (!image.archivePath) {
          throw new Error(`Archive path missing for ${image.machineName}`);
        }
        await this.bundleService.loadImageFromArchive(image.archivePath);
        const ecrImage = `${endpoint.replace('https://', '')}/${repoPrefix}/${image.machineName}:latest`;
        await execAsync(`docker tag ${image.imageRef} ${ecrImage}`);
        await execAsync(`docker push ${ecrImage}`);
      }
    }
  }

  /**
   * Get shared VPC endpoints (cost-optimized approach)
   * Uses existing endpoints from .env instead of creating new ones
   */
  private async getSharedVPCEndpoints(): Promise<string[]> {
    this.logger.log('Using existing shared VPC endpoints');

    // Use pre-configured shared endpoints
    const existingEndpoints = [
      this.configService.get('AWS_VPC_ENDPOINT_ECR_API_ID'),
      this.configService.get('AWS_VPC_ENDPOINT_ECR_DKR_ID'),
      this.configService.get('AWS_VPC_ENDPOINT_S3_ID'),
    ].filter(Boolean) as string[];

    if (existingEndpoints.length > 0) {
      this.logger.log(`Using ${existingEndpoints.length} shared VPC endpoints: ${existingEndpoints.join(', ')}`);
      return existingEndpoints;
    }

    // Fallback: create new ones if none exist (first-time setup)
    this.logger.warn('No existing VPC endpoints found, falling back to creation (expensive!)');
    return this.createVPCEndpointsIfNeeded();
  }

  /**
   * Create VPC endpoints only if they don't exist (fallback for first-time setup)
   * @deprecated Use getSharedVPCEndpoints() which uses existing endpoints
   */
  private async createVPCEndpointsIfNeeded(): Promise<string[]> {
    this.logger.log('Creating VPC endpoints (fallback)');

    if (!this.vpcId) {
      this.logger.warn('No VPC ID configured, skipping VPC endpoint creation');
      return [];
    }

    const endpointIds: string[] = [];
    const region = this.configService.get('AWS_REGION', 'ap-south-2');

    // Required Interface endpoints for ECR/ECS with private tasks (assignPublicIp: DISABLED)
    const interfaceServices = [
      `com.amazonaws.${region}.ecr.dkr`,      // ECR Docker registry
      `com.amazonaws.${region}.ecr.api`,      // ECR API
      `com.amazonaws.${region}.ecs`,          // ECS control plane
      `com.amazonaws.${region}.ecs-agent`,    // ECS agent communication
      `com.amazonaws.${region}.ecs-telemetry`,// ECS telemetry
      `com.amazonaws.${region}.logs`,         // CloudWatch Logs
    ];

    for (const serviceName of interfaceServices) {
      try {
        const result = await this.ec2Client.send(new CreateVpcEndpointCommand({
          VpcId: this.vpcId,
          ServiceName: serviceName,
          VpcEndpointType: 'Interface',
          SubnetIds: this.subnets,
          SecurityGroupIds: this.securityGroups,
          PrivateDnsEnabled: true, // Required for ECR/ECS to resolve service endpoints
        }));

        if (result.VpcEndpoint?.VpcEndpointId) {
          endpointIds.push(result.VpcEndpoint.VpcEndpointId);
          this.logger.log(`Created Interface endpoint: ${result.VpcEndpoint.VpcEndpointId} for ${serviceName}`);
        }
      } catch (error: any) {
        // Endpoint may already exist or error creating
        this.logger.warn(`Failed to create Interface endpoint for ${serviceName}: ${error.message}`);
      }
    }

    // S3 Gateway endpoint (required for ECR image layer storage in private subnets)
    // NOTE: Gateway endpoints require RouteTableIds instead of SubnetIds
    // This implementation assumes route tables are auto-detected from subnets
    try {
      // Get route tables associated with our subnets
      const routeTables = await this.ec2Client.send(new DescribeRouteTablesCommand({
        Filters: [
          { Name: 'vpc-id', Values: [this.vpcId] },
        ],
      }));

      const routeTableIds = routeTables.RouteTables
        ?.filter(rt => rt.Associations?.some(assoc => 
          this.subnets.includes(assoc.SubnetId || '')
        ))
        .map(rt => rt.RouteTableId!)
        .filter(Boolean) || [];

      if (routeTableIds.length > 0) {
        const s3Result = await this.ec2Client.send(new CreateVpcEndpointCommand({
          VpcId: this.vpcId,
          ServiceName: `com.amazonaws.${region}.s3`,
          VpcEndpointType: 'Gateway', // S3 uses Gateway, not Interface
          RouteTableIds: routeTableIds,
        }));

        if (s3Result.VpcEndpoint?.VpcEndpointId) {
          endpointIds.push(s3Result.VpcEndpoint.VpcEndpointId);
          this.logger.log(`Created Gateway endpoint: ${s3Result.VpcEndpoint.VpcEndpointId} for S3 (ECR layer storage)`);
        }
      } else {
        this.logger.warn('No route tables found for subnets - S3 Gateway endpoint not created. ECR pulls may fail in private subnets.');
      }
    } catch (error: any) {
      this.logger.warn(`Failed to create S3 Gateway endpoint: ${error.message} - ECR pulls may fail in private subnets without NAT or S3 gateway`);
    }

    return endpointIds;
  }

  private async deleteVPCEndpoints(endpointIds: string[]): Promise<void> {
    // NEVER delete VPC endpoints - they are shared infrastructure
    this.logger.warn('VPC endpoint deletion skipped - endpoints are shared across all deployments');
    this.logger.log(`Preserving ${endpointIds.length} shared VPC endpoints`);
    return;
  }

  private async registerTaskDefinitions(bundle: ScenarioBundle, ecrRepoPrefix: string): Promise<any> {
    this.logger.log('Registering ECS task definitions');

    const region = this.configService.get<string>('AWS_REGION', 'ap-south-2');
    const accountId = await this.getAccountId();
    const ecrBaseUri = `${accountId}.dkr.ecr.${region}.amazonaws.com`;

    // Register gateway task definition
    const gatewayImage = bundle.images.find(img => 
      img.machineName.toLowerCase().includes('gateway') || img.machineId === 'gateway'
    );

    const gatewayTaskDef = await this.ecsClient.send(new RegisterTaskDefinitionCommand({
      family: `rangex-gateway-${bundle.scenarioVersionId.substring(0, 8)}`,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '512',
      memory: '1024',
      containerDefinitions: [{
        name: 'gateway',
        image: gatewayImage 
          ? (gatewayImage.sourceType === 'public_digest' 
              ? gatewayImage.imageRef 
              : `${ecrBaseUri}/${ecrRepoPrefix}/${gatewayImage.machineName}:latest`)
          : 'nginx:latest', // Fallback
        portMappings: bundle.portMapping.map(pm => ({
          containerPort: pm.containerPort,
          protocol: pm.protocol === 'tcp' ? 'tcp' : 'tcp',
        })),
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': `/rangex/gateway-${bundle.scenarioVersionId}`,
            'awslogs-region': region,
            'awslogs-stream-prefix': 'gateway',
            'awslogs-create-group': 'true',
          },
        },
      }],
    }));

    // Register machine task definitions
    const machineTaskDefs = [];
    for (const machine of bundle.machines) {
      if (machine.name.toLowerCase().includes('gateway')) continue; // Skip gateway

      const machineImage = bundle.images.find(img => img.machineId === machine.id);
      if (!machineImage) {
        this.logger.warn(`No image found for machine ${machine.name}`);
        continue;
      }

      const taskDef = await this.ecsClient.send(new RegisterTaskDefinitionCommand({
        family: `rangex-${machine.name}-${bundle.scenarioVersionId.substring(0, 8)}`,
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: machine.resourceProfile === 'large' ? '1024' : '512',
        memory: machine.resourceProfile === 'large' ? '2048' : '1024',
        containerDefinitions: [{
          name: machine.name,
          image: machineImage.sourceType === 'public_digest'
            ? machineImage.imageRef
            : `${ecrBaseUri}/${ecrRepoPrefix}/${machineImage.machineName}:latest`,
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': `/rangex/machines-${bundle.scenarioVersionId}`,
              'awslogs-region': region,
              'awslogs-stream-prefix': machine.name,
              'awslogs-create-group': 'true',
            },
          },
        }],
      }));

      machineTaskDefs.push({
        machineId: machine.id,
        machineName: machine.name,
        taskDefinitionArn: taskDef.taskDefinition?.taskDefinitionArn!,
      });
    }

    return {
      gateway: gatewayTaskDef.taskDefinition?.taskDefinitionArn!,
      machines: machineTaskDefs,
    };
  }

  private async startGatewayTask(bundle: ScenarioBundle, taskDef: string): Promise<string> {
    this.logger.log('Starting gateway task on Fargate Spot');

    const result = await this.ecsClient.send(new RunTaskCommand({
      cluster: this.clusterName,
      taskDefinition: taskDef,
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
          base: 0,
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.subnets,
          securityGroups: this.securityGroups,
          assignPublicIp: 'ENABLED', // Required for ephemeral deployments
        },
      },
      enableExecuteCommand: true, // Optional: For debugging
    }));

    if (!result.tasks || result.tasks.length === 0) {
      throw new Error('Failed to start gateway task');
    }

    const taskArn = result.tasks[0].taskArn!;
    this.logger.log(`Started gateway task: ${taskArn}`);

    // Wait for task to be running
    await this.waitForTaskRunning(taskArn);

    return taskArn;
  }

  private async startMachineTasks(bundle: ScenarioBundle, taskDefs: any[]): Promise<string[]> {
    this.logger.log(`Starting ${taskDefs.length} machine tasks on Fargate Spot`);

    const taskArns: string[] = [];

    for (const taskDef of taskDefs) {
      const result = await this.ecsClient.send(new RunTaskCommand({
        cluster: this.clusterName,
        taskDefinition: taskDef.taskDefinitionArn,
        capacityProviderStrategy: [
          {
            capacityProvider: 'FARGATE_SPOT',
            weight: 1,
            base: 0,
          },
        ],
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: this.subnets,
            securityGroups: this.securityGroups,
            assignPublicIp: 'DISABLED', // Machines don't need public IPs
          },
        },
      }));

      if (result.tasks && result.tasks.length > 0) {
        const taskArn = result.tasks[0].taskArn!;
        taskArns.push(taskArn);
        this.logger.log(`Started machine task: ${taskDef.machineName} (${taskArn})`);
      }
    }

    // Wait for all tasks to be running
    await Promise.all(taskArns.map(arn => this.waitForTaskRunning(arn)));

    return taskArns;
  }

  private async getGatewayEndpoint(taskArn: string): Promise<string> {
    this.logger.log('Discovering gateway endpoint');

    // Describe task to get ENI
    const taskDetails = await this.ecsClient.send(new DescribeTasksCommand({
      cluster: this.clusterName,
      tasks: [taskArn],
    }));

    if (!taskDetails.tasks || taskDetails.tasks.length === 0) {
      throw new Error('Gateway task not found');
    }

    const task = taskDetails.tasks[0];
    const attachment = task.attachments?.find(a => a.type === 'ElasticNetworkInterface');
    const eniId = attachment?.details?.find(d => d.name === 'networkInterfaceId')?.value;

    if (!eniId) {
      throw new Error('Gateway task ENI not found');
    }

    // Get ENI public IP
    const eniDetails = await this.ec2Client.send(new DescribeNetworkInterfacesCommand({
      NetworkInterfaceIds: [eniId],
    }));

    const publicIp = eniDetails.NetworkInterfaces?.[0]?.Association?.PublicIp;

    if (!publicIp) {
      throw new Error('Gateway task public IP not found. Ensure assignPublicIp is enabled.');
    }

    this.logger.log(`Gateway endpoint: ${publicIp}`);
    return publicIp;
  }

  private async waitForTaskRunning(taskArn: string, maxWaitSeconds: number = 120): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      const taskDetails = await this.ecsClient.send(new DescribeTasksCommand({
        cluster: this.clusterName,
        tasks: [taskArn],
      }));

      if (taskDetails.tasks && taskDetails.tasks.length > 0) {
        const task = taskDetails.tasks[0];
        if (task.lastStatus === 'RUNNING') {
          return;
        }
        if (task.lastStatus === 'STOPPED') {
          throw new Error(`Task stopped unexpectedly: ${task.stoppedReason}`);
        }
      }

      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error(`Task ${taskArn} did not reach RUNNING state within ${maxWaitSeconds}s`);
  }

  private async getAccountId(): Promise<string> {
    // Get account ID from ECR auth token
    const authData = await this.ecrClient.send(new GetAuthorizationTokenCommand({}));
    const endpoint = authData.authorizationData?.[0]?.proxyEndpoint;
    
    if (!endpoint) {
      throw new Error('Failed to get ECR endpoint');
    }

    // Extract account ID from endpoint: https://ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
    const match = endpoint.match(/https:\/\/(\d+)\.dkr\.ecr\./);
    if (!match) {
      throw new Error('Failed to extract account ID from ECR endpoint');
    }

    return match[1];
  }

  private async stopTask(taskArn: string): Promise<void> {
    try {
      await this.ecsClient.send(new StopTaskCommand({
        cluster: this.clusterName,
        task: taskArn,
        reason: 'Parking deployment',
      }));
      this.logger.log(`Stopped task: ${taskArn}`);
    } catch (error) {
      this.logger.warn(`Failed to stop task ${taskArn}:`, error);
    }
  }
}
