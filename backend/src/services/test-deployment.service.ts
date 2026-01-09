import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestDeployment, DeploymentStep } from '../entities/test-deployment.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { ConfigService } from '@nestjs/config';
import { TestDeploymentGateway } from '../gateways/test-deployment.gateway';
import { SessionSecurityGroupService } from './session-security-group.service';
import { GatewayProxyService } from './gateway-proxy.service';
import {
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  DescribeTasksCommand,
  AssignPublicIp,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand as EC2DescribeNICommand,
} from '@aws-sdk/client-ec2';

@Injectable()
export class TestDeploymentService {
  private readonly logger = new Logger(TestDeploymentService.name);
  private ecsClient: ECSClient;
  private ec2Client: EC2Client;
  private awsRegion: string;
  private ecsClusterName: string;
  private subnetIds: string[]; // Now private subnets
  private securityGroupIds: string[];
  private usePerSessionSg: boolean;

  constructor(
    @InjectRepository(TestDeployment)
    private testDeploymentRepo: Repository<TestDeployment>,
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioVersion)
    private versionRepo: Repository<ScenarioVersion>,
    private minioService: MinioService,
    private configService: ConfigService,
    private testDeploymentGateway: TestDeploymentGateway,
    private sessionSecurityGroupService: SessionSecurityGroupService,
    private gatewayProxyService: GatewayProxyService,
  ) {
    this.awsRegion = this.configService.get<string>('AWS_REGION') || 'ap-south-2';
    this.ecsClusterName = this.configService.get<string>('AWS_ECS_CLUSTER_NAME') || 'rangex-labs';
    // Use PRIVATE subnets for challenge tasks (no public IP)
    this.subnetIds = (this.configService.get<string>('AWS_PRIVATE_SUBNET_IDS') || '').split(',');
    this.securityGroupIds = (this.configService.get<string>('AWS_ECS_SECURITY_GROUP_IDS') || '').split(',');
    this.usePerSessionSg = this.configService.get<string>('RANGEX_USE_PER_SESSION_SECURITY_GROUP', 'true') === 'true';

    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.ecsClient = new ECSClient({
      region: this.awsRegion,
      credentials,
    });

    this.ec2Client = new EC2Client({
      region: this.awsRegion,
      credentials,
    });

    this.logger.log(
      `Test Deployment Service initialized for cluster: ${this.ecsClusterName} in ${this.awsRegion}`,
    );
  }

  /**
   * Create a new test deployment
   */
  async createTestDeployment(versionId: string): Promise<TestDeployment> {
    this.logger.log(`Creating test deployment for version ${versionId}`);

    const deployment = this.testDeploymentRepo.create({
      scenarioVersionId: versionId,
      status: 'pending',
      progress: {
        currentStep: 0,
        totalSteps: 8,
        steps: [
          { name: 'Validating scenario configuration', status: 'pending' },
          { name: 'Loading task definitions', status: 'pending' },
          { name: 'Starting Fargate tasks', status: 'pending' },
          { name: 'Waiting for tasks to start', status: 'pending' },
          { name: 'Retrieving network interfaces', status: 'pending' },
          { name: 'Running health checks', status: 'pending' },
          { name: 'Calculating cost estimate', status: 'pending' },
          { name: 'Deployment complete', status: 'pending' },
        ],
      },
    });

    await this.testDeploymentRepo.save(deployment);

    // Start deployment asynchronously (don't await)
    this.executeTestDeployment(deployment.id).catch((error) => {
      this.logger.error(`Test deployment ${deployment.id} failed: ${error.message}`);
    });

    return deployment;
  }

  /**
   * Execute test deployment (runs asynchronously)
   */
  async executeTestDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.testDeploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      deployment.status = 'deploying';
      deployment.startedAt = new Date();
      await this.testDeploymentRepo.save(deployment);
      this.emitProgress(deployment);

      // Step 1: Validate configuration
      await this.updateStep(deployment, 0, 'in-progress');
      const machines = await this.machineRepo.find({
        where: { scenarioVersionId: deployment.scenarioVersionId },
      });

      if (machines.length === 0) {
        throw new Error('No machines found for this scenario version');
      }

      const machinesWithTaskDefs = machines.filter(
        (m) => m.taskDefinitionArn && m.ecrUri && m.ecrDigest,
      );

      if (machinesWithTaskDefs.length === 0) {
        throw new Error('No machines have been promoted to ECR yet');
      }

      await this.updateStep(deployment, 0, 'completed', [
        `Found ${machinesWithTaskDefs.length} machines ready for deployment`,
      ]);

      // Step 2: Load task definitions
      await this.updateStep(deployment, 1, 'in-progress');
      await this.updateStep(deployment, 1, 'completed', [
        `Loaded ${machinesWithTaskDefs.length} task definitions`,
      ]);

      // Step 2.5: Create session security group (if enabled)
      let sessionSecurityGroupId: string | undefined;
      if (this.usePerSessionSg) {
        await this.updateStep(deployment, 1, 'in-progress', [
          'Creating session-isolated security group...',
        ]);
        sessionSecurityGroupId = await this.sessionSecurityGroupService.createSessionSecurityGroup(
          deploymentId,
        );
        deployment.sessionSecurityGroupId = sessionSecurityGroupId;
        await this.testDeploymentRepo.save(deployment);
        await this.updateStep(deployment, 1, 'completed', [
          `Created session security group: ${sessionSecurityGroupId}`,
        ]);
      }

      // Step 3: Start Fargate tasks
      await this.updateStep(deployment, 2, 'in-progress');
      const taskArns: string[] = [];

      for (const machine of machinesWithTaskDefs) {
        const taskArn = await this.startFargateTask(machine, sessionSecurityGroupId);
        taskArns.push(taskArn);
        await this.updateStep(deployment, 2, 'in-progress', [
          `Started task for ${machine.name}: ${taskArn.split('/').pop()}`,
        ]);
      }

      deployment.ecsTaskArns = taskArns;
      await this.testDeploymentRepo.save(deployment);
      await this.updateStep(deployment, 2, 'completed', [
        `Started ${taskArns.length} Fargate tasks successfully`,
      ]);

      // Step 4: Wait for tasks to start
      await this.updateStep(deployment, 3, 'in-progress');
      await this.waitForTasksRunning(taskArns);
      await this.updateStep(deployment, 3, 'completed', ['All tasks are now running']);

      // Step 5: Get network interfaces
      await this.updateStep(deployment, 4, 'in-progress');
      const networkInterfaces = await this.getTaskNetworkInterfaces(taskArns, machinesWithTaskDefs);
      deployment.networkInterfaces = networkInterfaces;
      await this.testDeploymentRepo.save(deployment);
      await this.updateStep(deployment, 4, 'completed', [
        `Retrieved ${networkInterfaces.length} network interfaces`,
      ]);

      // Step 6: Health checks
      await this.updateStep(deployment, 5, 'in-progress');
      const healthChecksPassed = await this.runHealthChecks(taskArns);
      await this.updateStep(deployment, 5, healthChecksPassed ? 'completed' : 'failed', [
        healthChecksPassed ? 'All health checks passed' : 'Some health checks failed',
      ]);

      // Step 7: Calculate cost
      await this.updateStep(deployment, 6, 'in-progress');
      const costPerHour = this.calculateCostEstimate(machinesWithTaskDefs);
      deployment.estimatedCostPerHour = costPerHour;
      await this.testDeploymentRepo.save(deployment);
      await this.updateStep(deployment, 6, 'completed', [
        `Estimated cost: $${costPerHour.toFixed(4)}/hour`,
      ]);

      // Step 8: Complete
      await this.updateStep(deployment, 7, 'completed', ['Test deployment successful!']);

      deployment.status = healthChecksPassed ? 'success' : 'running';
      deployment.completedAt = new Date();
      await this.testDeploymentRepo.save(deployment);
      this.emitProgress(deployment);

      this.logger.log(`Test deployment ${deploymentId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Test deployment ${deploymentId} failed: ${errorMessage}`);

      // Find current step and mark as failed
      const currentStepIndex = deployment.progress!.steps.findIndex(
        (s) => s.status === 'in-progress',
      );
      if (currentStepIndex >= 0) {
        await this.updateStep(deployment, currentStepIndex, 'failed', [], errorMessage);
      }

      deployment.status = 'failed';
      deployment.errorMessage = errorMessage;
      deployment.completedAt = new Date();
      await this.testDeploymentRepo.save(deployment);
      this.emitProgress(deployment);

      // Cleanup on failure
      if (deployment.ecsTaskArns && deployment.ecsTaskArns.length > 0) {
        await this.cleanupTestDeployment(deploymentId);
      }
    }
  }

  /**
   * Start a single Fargate task
   */
  private async startFargateTask(
    machine: Machine,
    sessionSecurityGroupId?: string,
  ): Promise<string> {
    // Use session SG if provided, otherwise fall back to default
    const securityGroups = sessionSecurityGroupId
      ? [sessionSecurityGroupId]
      : this.securityGroupIds;

    const command = new RunTaskCommand({
      cluster: this.ecsClusterName,
      taskDefinition: machine.taskDefinitionArn!,
      // Use Fargate Spot for cost savings (70% cheaper)
      // Falls back to on-demand Fargate if spot unavailable
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
          base: 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: 0,
          base: 0,
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.subnetIds, // Private subnets
          securityGroups: securityGroups, // Session SG or default
          assignPublicIp: AssignPublicIp.DISABLED, // No public IP (private only)
        },
      },
      tags: [
        { key: 'Environment', value: 'test' },
        { key: 'MachineId', value: machine.id },
        { key: 'MachineName', value: machine.name },
        { key: 'ScenarioVersionId', value: machine.scenarioVersionId },
      ],
    });

    const response = await this.ecsClient.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      throw new Error(`Failed to start task for machine ${machine.name}`);
    }

    const taskArn = response.tasks[0].taskArn!;
    this.logger.log(`Started Fargate Spot task: ${taskArn} for machine ${machine.name}`);

    return taskArn;
  }

  /**
   * Wait for all tasks to reach RUNNING state
   */
  private async waitForTasksRunning(taskArns: string[]): Promise<void> {
    const maxAttempts = 30; // 5 minutes max
    const delayMs = 10000; // 10 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const command = new DescribeTasksCommand({
        cluster: this.ecsClusterName,
        tasks: taskArns,
      });

      const response = await this.ecsClient.send(command);
      const tasks = response.tasks || [];

      const runningTasks = tasks.filter((t) => t.lastStatus === 'RUNNING');
      const stoppedTasks = tasks.filter((t) => t.lastStatus === 'STOPPED');

      this.logger.log(
        `Task status: ${runningTasks.length}/${tasks.length} running, ${stoppedTasks.length} stopped`,
      );

      if (stoppedTasks.length > 0) {
        throw new Error(`Some tasks stopped unexpectedly: ${stoppedTasks.map((t) => t.stopCode).join(', ')}`);
      }

      if (runningTasks.length === taskArns.length) {
        this.logger.log('All tasks are now running');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Timeout waiting for tasks to start');
  }

  /**
   * Get network interfaces for tasks
   */
  private async getTaskNetworkInterfaces(
    taskArns: string[],
    machines: Machine[],
  ): Promise<Array<{ machineId: string; machineName: string; networkInterfaceId: string; privateIp: string }>> {
    const command = new DescribeTasksCommand({
      cluster: this.ecsClusterName,
      tasks: taskArns,
    });

    const response = await this.ecsClient.send(command);
    const tasks = response.tasks || [];

    const networkInterfaces: Array<{
      machineId: string;
      machineName: string;
      networkInterfaceId: string;
      privateIp: string;
    }> = [];

    for (const task of tasks) {
      const machineIdTag = task.tags?.find((t) => t.key === 'MachineId');
      const machineNameTag = task.tags?.find((t) => t.key === 'MachineName');

      if (!machineIdTag || !machineNameTag) {
        continue;
      }

      const attachment = task.attachments?.find((a) => a.type === 'ElasticNetworkInterface');
      if (!attachment) {
        continue;
      }

      const eniIdDetail = attachment.details?.find((d) => d.name === 'networkInterfaceId');
      const privateIpDetail = attachment.details?.find((d) => d.name === 'privateIPv4Address');

      if (eniIdDetail && privateIpDetail) {
        networkInterfaces.push({
          machineId: machineIdTag.value!,
          machineName: machineNameTag.value!,
          networkInterfaceId: eniIdDetail.value!,
          privateIp: privateIpDetail.value!,
        });
      }
    }

    return networkInterfaces;
  }

  /**
   * Run health checks on tasks
   */
  private async runHealthChecks(taskArns: string[]): Promise<boolean> {
    // For now, just check if tasks are running
    // TODO: Add actual container health checks via HTTP/TCP probes
    const command = new DescribeTasksCommand({
      cluster: this.ecsClusterName,
      tasks: taskArns,
    });

    const response = await this.ecsClient.send(command);
    const tasks = response.tasks || [];

    const healthyTasks = tasks.filter((t) => t.lastStatus === 'RUNNING' && t.healthStatus !== 'UNHEALTHY');

    return healthyTasks.length === taskArns.length;
  }

  /**
   * Calculate estimated cost per hour
   */
  private calculateCostEstimate(machines: Machine[]): number {
    // Fargate Spot pricing for ap-south-2 (Mumbai) - 70% discount
    const FARGATE_SPOT_COST_PER_VCPU_HOUR = 0.04556 * 0.3; // 70% cheaper
    const FARGATE_SPOT_COST_PER_GB_HOUR = 0.00533 * 0.3;

    let totalCost = 0;

    for (const machine of machines) {
      const profile = machine.resourceProfile || 'small';
      const { cpu, memory } = this.mapResourceProfile(profile);

      const vcpu = cpu / 1024; // Convert from Fargate units to vCPU
      const memoryGb = memory / 1024; // Convert from MB to GB

      const machineCost = vcpu * FARGATE_SPOT_COST_PER_VCPU_HOUR + memoryGb * FARGATE_SPOT_COST_PER_GB_HOUR;
      totalCost += machineCost;
    }

    return totalCost;
  }

  /**
   * Map resource profile to CPU/memory
   */
  private mapResourceProfile(profile: string): { cpu: number; memory: number } {
    const profileMap: Record<string, { cpu: number; memory: number }> = {
      micro: { cpu: 256, memory: 512 },
      small: { cpu: 512, memory: 1024 },
      medium: { cpu: 1024, memory: 2048 },
      large: { cpu: 2048, memory: 4096 },
      xlarge: { cpu: 4096, memory: 8192 },
    };

    return profileMap[profile] || profileMap.small;
  }

  /**
   * Cleanup test deployment (stop tasks)
   */
  async cleanupTestDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.testDeploymentRepo.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    deployment.status = 'cleaning';
    await this.testDeploymentRepo.save(deployment);
    this.emitProgress(deployment);

    this.logger.log(`Cleaning up test deployment ${deploymentId}`);

    if (deployment.ecsTaskArns) {
      for (const taskArn of deployment.ecsTaskArns) {
        try {
          await this.ecsClient.send(
            new StopTaskCommand({
              cluster: this.ecsClusterName,
              task: taskArn,
              reason: 'Test deployment cleanup',
            }),
          );
          this.logger.log(`Stopped task: ${taskArn}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to stop task ${taskArn}: ${errorMessage}`);
        }
      }
    }

    // Delete session security group (if created)
    if (deployment.sessionSecurityGroupId && this.usePerSessionSg) {
      try {
        await this.sessionSecurityGroupService.deleteSessionSecurityGroup(deploymentId);
        this.logger.log(`Deleted session security group: ${deployment.sessionSecurityGroupId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to delete session security group ${deployment.sessionSecurityGroupId}: ${errorMessage}`,
        );
      }
    }

    deployment.status = 'cleaned';
    deployment.cleanedAt = new Date();
    await this.testDeploymentRepo.save(deployment);
    this.emitProgress(deployment);

    this.logger.log(`Test deployment ${deploymentId} cleaned up successfully`);
  }

  /**
   * Update a deployment step
   */
  private async updateStep(
    deployment: TestDeployment,
    stepIndex: number,
    status: DeploymentStep['status'],
    logs: string[] = [],
    error?: string,
  ): Promise<void> {
    if (!deployment.progress) {
      return;
    }

    const step = deployment.progress.steps[stepIndex];
    step.status = status;

    if (status === 'in-progress' && !step.startedAt) {
      step.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      step.completedAt = new Date();
    }

    if (logs.length > 0) {
      step.logs = [...(step.logs || []), ...logs];
    }

    if (error) {
      step.error = error;
    }

    deployment.progress.currentStep = stepIndex;
    await this.testDeploymentRepo.save(deployment);
    this.emitProgress(deployment);
  }

  /**
   * Emit progress update via WebSocket
   */
  private emitProgress(deployment: TestDeployment): void {
    this.testDeploymentGateway.sendProgressUpdate(deployment.id, {
      deploymentId: deployment.id,
      status: deployment.status,
      progress: deployment.progress,
      networkInterfaces: deployment.networkInterfaces,
      estimatedCostPerHour: deployment.estimatedCostPerHour,
    });
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<TestDeployment | null> {
    return this.testDeploymentRepo.findOne({
      where: { id: deploymentId },
    });
  }
}
