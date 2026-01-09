import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ECSClient,
  DescribeServicesCommand,
  DescribeTasksCommand,
  Task,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from '@aws-sdk/client-ec2';
import { ConfigService } from '@nestjs/config';

interface GatewayProxyInfo {
  publicIp: string;
  privateIp: string;
  taskArn: string;
  status: string;
  lastUpdated: Date;
}

@Injectable()
export class GatewayProxyService implements OnModuleInit {
  private readonly logger = new Logger(GatewayProxyService.name);
  private readonly ecsClient: ECSClient;
  private readonly ec2Client: EC2Client;
  
  private readonly region: string;
  private readonly clusterName: string;
  private readonly serviceName: string;
  private readonly proxyKey: string;
  private readonly containerPort: number;
  
  // Cache gateway proxy info (refresh every 5 minutes)
  private cachedProxyInfo: GatewayProxyInfo | null = null;
  private lastDiscoveryTime: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION')!;
    this.clusterName = this.configService.get<string>('AWS_ECS_CLUSTER_NAME') || 'rangex-labs';
    this.serviceName = this.configService.get<string>(
      'RANGEX_GATEWAY_PROXY_SERVICE_NAME',
      'rangex-gateway-proxy-svc',
    )!;
    this.proxyKey = this.configService.get<string>(
      'RANGEX_GATEWAY_PROXY_KEY',
    )!;
    this.containerPort = parseInt(
      this.configService.get<string>(
        'RANGEX_GATEWAY_PROXY_CONTAINER_PORT',
        '80',
      )!,
      10,
    );

    this.ecsClient = new ECSClient({ region: this.region });
    this.ec2Client = new EC2Client({ region: this.region });
  }

  async onModuleInit() {
    this.logger.log('Gateway Proxy Service initialized');
    
    // Discover gateway proxy on startup
    try {
      await this.discoverGatewayProxy();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to discover gateway proxy on startup: ${errorMessage}`,
      );
      this.logger.warn(
        'Gateway proxy will be discovered on first use',
      );
    }
  }

  /**
   * Discovers the public IP of the running gateway proxy task
   */
  async discoverGatewayProxy(forceRefresh = false): Promise<GatewayProxyInfo> {
    // Return cached info if still valid
    if (
      !forceRefresh &&
      this.cachedProxyInfo &&
      this.lastDiscoveryTime &&
      Date.now() - this.lastDiscoveryTime.getTime() < this.CACHE_TTL_MS
    ) {
      this.logger.debug('Returning cached gateway proxy info');
      return this.cachedProxyInfo;
    }

    this.logger.log('Discovering gateway proxy public IP...');

    try {
      // Step 1: Try to find gateway proxy task (deployed as standalone task, not service)
      // Look for tasks with family name containing "gateway-proxy"
      const { ListTasksCommand } = await import('@aws-sdk/client-ecs');
      const listTasksCommand = new ListTasksCommand({
        cluster: this.clusterName,
        desiredStatus: 'RUNNING',
      });

      const listTasksResponse = await this.ecsClient.send(listTasksCommand);
      let taskArns = listTasksResponse.taskArns || [];

      if (taskArns.length === 0) {
        throw new Error('No running tasks found in cluster');
      }

      // Step 2: Describe tasks to find the gateway proxy
      const describeTasksCommand = new DescribeTasksCommand({
        cluster: this.clusterName,
        tasks: taskArns,
      });

      const tasksResponse = await this.ecsClient.send(describeTasksCommand);
      const allTasks = tasksResponse.tasks || [];

      // Find gateway proxy task by checking group or task definition family
      const gatewayTask = allTasks.find(task => {
        const group = task.group || '';
        const taskDefFamily = task.taskDefinitionArn?.split('/').pop()?.split(':')[0] || '';
        return group.includes('gateway-proxy') || taskDefFamily.includes('gateway-proxy');
      });

      if (!gatewayTask) {
        throw new Error('Gateway proxy task not found in running tasks');
      }

      taskArns = [gatewayTask.taskArn!];

      taskArns = [gatewayTask.taskArn!];

      // Step 3: Use the gateway proxy task we found
      const task = gatewayTask;

      if (!task) {
        throw new Error('Failed to describe gateway proxy task');
      }

      // Step 4: Extract ENI ID from task attachments
      const eniId = this.extractEniId(task);
      if (!eniId) {
        throw new Error('Failed to extract ENI ID from task');
      }

      // Step 5: Get public IP from ENI
      const { publicIp, privateIp } = await this.getIpFromEni(eniId);

      const proxyInfo: GatewayProxyInfo = {
        publicIp,
        privateIp,
        taskArn: task.taskArn!,
        status: task.lastStatus!,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.cachedProxyInfo = proxyInfo;
      this.lastDiscoveryTime = new Date();

      this.logger.log(
        `✅ Gateway proxy discovered: ${publicIp} (task: ${task.taskArn?.split('/').pop()})`,
      );

      return proxyInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to discover gateway proxy: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Gets running task ARNs for the gateway proxy service
   */
  private async getRunningTaskArns(): Promise<string[]> {
    const { ECSClient, ListTasksCommand } = await import('@aws-sdk/client-ecs');
    const client = new ECSClient({ region: this.region });

    const listTasksCommand = new ListTasksCommand({
      cluster: this.clusterName,
      serviceName: this.serviceName,
      desiredStatus: 'RUNNING',
    });

    const response = await client.send(listTasksCommand);
    return response.taskArns || [];
  }

  /**
   * Extracts ENI ID from ECS task attachments
   */
  private extractEniId(task: Task): string | null {
    const eniAttachment = task.attachments?.find(
      (att) => att.type === 'ElasticNetworkInterface',
    );

    const eniIdDetail = eniAttachment?.details?.find(
      (detail) => detail.name === 'networkInterfaceId',
    );

    return eniIdDetail?.value || null;
  }

  /**
   * Gets public and private IP from ENI
   */
  private async getIpFromEni(
    eniId: string,
  ): Promise<{ publicIp: string; privateIp: string }> {
    const describeNiCommand = new DescribeNetworkInterfacesCommand({
      NetworkInterfaceIds: [eniId],
    });

    const niResponse = await this.ec2Client.send(describeNiCommand);
    const networkInterface = niResponse.NetworkInterfaces?.[0];

    if (!networkInterface) {
      throw new Error(`Network interface ${eniId} not found`);
    }

    const publicIp =
      networkInterface.Association?.PublicIp ||
      networkInterface.PrivateIpAddress!;
    const privateIp = networkInterface.PrivateIpAddress!;

    return { publicIp, privateIp };
  }

  /**
   * Gets the current gateway proxy base URL (with protocol and port)
   */
  async getGatewayProxyUrl(): Promise<string> {
    // Check for manual override in env
    const manualUrl = this.configService.get<string>(
      'RANGEX_GATEWAY_PROXY_PUBLIC_URL',
    );
    if (manualUrl) {
      this.logger.debug(`Using manual gateway proxy URL: ${manualUrl}`);
      return manualUrl;
    }

    // Auto-discover
    const proxyInfo = await this.discoverGatewayProxy();
    const protocol = this.containerPort === 443 ? 'https' : 'http';
    const port = this.containerPort === 80 || this.containerPort === 443 
      ? '' 
      : `:${this.containerPort}`;
    
    return `${protocol}://${proxyInfo.publicIp}${port}`;
  }

  /**
   * Builds a proxied URL for accessing a private task
   */
  buildProxiedUrl(
    destinationIp: string,
    destinationPort: number,
    path: string = '/',
  ): string {
    // Build query parameters
    const params = new URLSearchParams({
      dst: destinationIp,
      port: destinationPort.toString(),
      path: path,
    });

    // Return the proxied URL (base URL will be discovered when needed)
    return `/http?${params.toString()}`;
  }

  /**
   * Builds a full proxied URL (with gateway proxy base URL)
   */
  async buildFullProxiedUrl(
    destinationIp: string,
    destinationPort: number,
    path: string = '/',
  ): Promise<string> {
    const baseUrl = await this.getGatewayProxyUrl();
    const proxyPath = this.buildProxiedUrl(destinationIp, destinationPort, path);
    return `${baseUrl}${proxyPath}`;
  }

  /**
   * Gets the proxy authentication header
   */
  getProxyAuthHeaders(): Record<string, string> {
    if (!this.proxyKey) {
      throw new Error(
        'RANGEX_GATEWAY_PROXY_KEY not configured - cannot authenticate to gateway proxy',
      );
    }

    return {
      'X-RANGEX-PROXY-KEY': this.proxyKey,
    };
  }

  /**
   * Health check - verifies gateway proxy is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = await this.getGatewayProxyUrl();
      const healthUrl = `${baseUrl}/health`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        this.logger.debug('Gateway proxy health check: OK');
        return true;
      } else {
        this.logger.warn(
          `Gateway proxy health check failed: ${response.status}`,
        );
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Gateway proxy health check error: ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Forces a refresh of the cached gateway proxy info
   */
  async refreshProxyInfo(): Promise<GatewayProxyInfo> {
    this.logger.log('Forcing gateway proxy refresh...');
    return this.discoverGatewayProxy(true);
  }

  /**
   * Gets cached proxy info (if available)
   */
  getCachedProxyInfo(): GatewayProxyInfo | null {
    return this.cachedProxyInfo;
  }

  /**
   * Ensures the gateway proxy ECS Service exists (creates if missing)
   * This is infrastructure setup - run once on deployment
   */
  async ensureGatewayProxyService(): Promise<void> {
    const {
      CreateServiceCommand,
      UpdateServiceCommand,
      RegisterTaskDefinitionCommand,
    } = await import('@aws-sdk/client-ecs');

    try {
      // Check if service already exists
      const describeServicesCommand = new DescribeServicesCommand({
        cluster: this.clusterName,
        services: [this.serviceName],
      });

      const servicesResponse = await this.ecsClient.send(describeServicesCommand);
      const service = servicesResponse.services?.[0];

      if (service && service.status !== 'INACTIVE') {
        this.logger.log(`Gateway proxy service already exists: ${this.serviceName}`);
        return;
      }

      // Get configuration from environment
      const taskDefinitionFamily = this.configService.get<string>(
        'RANGEX_GATEWAY_PROXY_TASK_FAMILY',
        'rangex-gateway-proxy',
      )!;
      const ecrImageUri = this.configService.get<string>(
        'RANGEX_GATEWAY_PROXY_IMAGE',
      )!;
      const securityGroupId = this.configService.get<string>(
        'RANGEX_GATEWAY_PROXY_SECURITY_GROUP',
      )!;
      const publicSubnetIds = this.configService.get<string>(
        'AWS_PUBLIC_SUBNET_IDS',
      )!.split(',');

      // Register task definition
      this.logger.log('Registering gateway proxy task definition...');
      const taskDefResponse = await this.ecsClient.send(
        new RegisterTaskDefinitionCommand({
          family: taskDefinitionFamily,
          networkMode: 'awsvpc',
          requiresCompatibilities: ['FARGATE'],
          cpu: '256',
          memory: '512',
          containerDefinitions: [
            {
              name: 'gateway-proxy',
              image: ecrImageUri,
              essential: true,
              portMappings: [
                {
                  containerPort: this.containerPort,
                  protocol: 'tcp',
                },
              ],
              environment: [
                {
                  name: 'PORT',
                  value: this.containerPort.toString(),
                },
                {
                  name: 'RANGEX_PROXY_KEY',
                  value: this.proxyKey,
                },
              ],
              logConfiguration: {
                logDriver: 'awslogs',
                options: {
                  'awslogs-group': '/ecs/rangex-gateway-proxy',
                  'awslogs-region': this.region,
                  'awslogs-stream-prefix': 'ecs',
                },
              },
              healthCheck: {
                command: [
                  'CMD-SHELL',
                  `node -e "require('http').get('http://localhost:${this.containerPort}/health', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"`,
                ],
                interval: 30,
                timeout: 5,
                retries: 3,
                startPeriod: 20,
              },
            },
          ],
          tags: [
            { key: 'Name', value: 'rangex-gateway-proxy' },
            { key: 'Role', value: 'gateway-proxy' },
            { key: 'ManagedBy', value: 'RangeX' },
          ],
        }),
      );

      const taskDefArn = taskDefResponse.taskDefinition?.taskDefinitionArn;
      this.logger.log(`Task definition registered: ${taskDefArn}`);

      // Create ECS Service
      this.logger.log('Creating gateway proxy ECS Service...');
      await this.ecsClient.send(
        new CreateServiceCommand({
          cluster: this.clusterName,
          serviceName: this.serviceName,
          taskDefinition: taskDefArn,
          desiredCount: 1,
          launchType: 'FARGATE',
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: publicSubnetIds,
              securityGroups: [securityGroupId],
              assignPublicIp: 'ENABLED',
            },
          },
          healthCheckGracePeriodSeconds: 60,
          enableExecuteCommand: true,
          tags: [
            { key: 'Name', value: 'rangex-gateway-proxy-service' },
            { key: 'Role', value: 'gateway-proxy' },
            { key: 'ManagedBy', value: 'RangeX' },
          ],
        }),
      );

      this.logger.log(`✅ Gateway proxy service created: ${this.serviceName}`);
      this.logger.log('Service will auto-start and maintain 1 running task');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure gateway proxy service: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Updates the gateway proxy service to use a new task definition
   */
  async updateGatewayProxyService(newTaskDefinitionArn: string): Promise<void> {
    const { UpdateServiceCommand } = await import('@aws-sdk/client-ecs');

    try {
      this.logger.log(`Updating gateway proxy service to task definition: ${newTaskDefinitionArn}`);
      
      await this.ecsClient.send(
        new UpdateServiceCommand({
          cluster: this.clusterName,
          service: this.serviceName,
          taskDefinition: newTaskDefinitionArn,
          forceNewDeployment: true,
        }),
      );

      this.logger.log('✅ Gateway proxy service updated');
      
      // Invalidate cache to force re-discovery
      this.cachedProxyInfo = null;
      this.lastDiscoveryTime = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update gateway proxy service: ${errorMessage}`);
      throw error;
    }
  }
}
