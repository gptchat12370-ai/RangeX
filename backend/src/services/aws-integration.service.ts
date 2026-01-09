import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  DescribeTasksCommand,
  Task,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from '@aws-sdk/client-ec2';
import { Machine } from '../entities/machine.entity';

export interface RunTaskContext {
  sessionId: string;
  userId: string;
}

export interface RunTaskResult {
  taskArn: string;
  privateIp?: string;
}

@Injectable()
export class AwsIntegrationService {
  private readonly logger = new Logger(AwsIntegrationService.name);
  private readonly ecs: ECSClient;
  private readonly ec2: EC2Client;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    this.ecs = new ECSClient({ region });
    this.ec2 = new EC2Client({ region });
  }

  async runTask(machine: Machine, ctx: RunTaskContext): Promise<RunTaskResult> {
    const cluster = this.configService.get<string>('AWS_ECS_CLUSTER_NAME');
    const subnets = this.configService.get<string>('AWS_ECS_SUBNET_IDS')?.split(',') ?? [];
    const securityGroups = this.configService.get<string>('AWS_ECS_SECURITY_GROUP_IDS')?.split(',') ?? [];

    // Skeleton implementation: in development environments we avoid real AWS calls.
    if (!cluster || subnets.length === 0) {
      this.logger.warn(`AWS cluster/subnets not configured; returning placeholder task for ${machine.name}`);
      return {
        taskArn: `placeholder-${machine.id}`,
        privateIp: '10.0.0.10',
      };
    }

    const command = new RunTaskCommand({
      cluster,
      launchType: 'FARGATE',
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets,
          securityGroups,
          assignPublicIp: 'DISABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: machine.name,
            environment: [
              { name: 'RANGEX_SESSION_ID', value: ctx.sessionId },
              { name: 'RANGEX_USER_ID', value: ctx.userId },
            ],
          },
        ],
      },
      taskDefinition: machine.imageRef, // In practice this should map to a task def per image/profile.
    });

    const result = await this.ecs.send(command);
    const task = result.tasks?.[0];
    
    if (!task?.taskArn) {
      throw new Error(`Failed to start task for machine ${machine.name}`);
    }

    this.logger.log(`Task started: ${task.taskArn} for machine ${machine.name}`);

    // Wait for task to reach RUNNING state and retrieve private IP
    const privateIp = await this.waitForTaskRunningAndGetIp(task.taskArn, cluster!);
    
    return {
      taskArn: task.taskArn,
      privateIp,
    };
  }

  /**
   * Wait for ECS task to reach RUNNING state and retrieve its private IP
   * @param taskArn The task ARN to monitor
   * @param cluster The ECS cluster name
   * @returns The private IP address of the task
   */
  private async waitForTaskRunningAndGetIp(
    taskArn: string,
    cluster: string,
  ): Promise<string | undefined> {
    const maxAttempts = 30; // 30 attempts * 10 seconds = 5 minutes max
    const delayMs = 10000; // 10 seconds between polls

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const describeResponse = await this.ecs.send(
          new DescribeTasksCommand({
            cluster,
            tasks: [taskArn],
          }),
        );

        const task = describeResponse.tasks?.[0];
        if (!task) {
          this.logger.warn(`Task ${taskArn} not found in describe response (attempt ${attempt}/${maxAttempts})`);
          await this.sleep(delayMs);
          continue;
        }

        const status = task.lastStatus;
        this.logger.log(`Task ${taskArn} status: ${status} (attempt ${attempt}/${maxAttempts})`);

        if (status === 'STOPPED' || status === 'DEPROVISIONING') {
          const stopReason = task.stopCode || 'Unknown';
          this.logger.error(`Task ${taskArn} stopped unexpectedly: ${stopReason}`);
          throw new Error(`Task stopped before reaching RUNNING state: ${stopReason}`);
        }

        if (status === 'RUNNING') {
          // Task is running, extract private IP
          const privateIp = this.extractPrivateIpFromTask(task);
          
          if (privateIp) {
            this.logger.log(`✓ Task ${taskArn} running with private IP: ${privateIp}`);
            return privateIp;
          } else {
            // Task is running but no IP yet, try to get it from ENI
            this.logger.log(`Task ${taskArn} is RUNNING but no private IP in task details, checking ENI...`);
            const eniIp = await this.getPrivateIpFromEni(task);
            if (eniIp) {
              this.logger.log(`✓ Retrieved IP from ENI: ${eniIp}`);
              return eniIp;
            }
          }
        }

        // Task not ready yet, wait and retry
        if (attempt < maxAttempts) {
          await this.sleep(delayMs);
        }
      } catch (error) {
        this.logger.error(`Error while waiting for task ${taskArn}: ${error instanceof Error ? error.message : String(error)}`);
        if (attempt === maxAttempts) {
          throw error;
        }
        await this.sleep(delayMs);
      }
    }

    this.logger.warn(`Task ${taskArn} did not reach RUNNING state within timeout`);
    return undefined;
  }

  /**
   * Extract private IP from task attachments
   */
  private extractPrivateIpFromTask(task: Task): string | undefined {
    if (!task.attachments) return undefined;
    
    for (const attachment of task.attachments) {
      if (attachment.type === 'ElasticNetworkInterface') {
        const ipDetail = attachment.details?.find((d) => d.name === 'privateIPv4Address');
        if (ipDetail?.value) {
          return ipDetail.value;
        }
      }
    }
    return undefined;
  }

  /**
   * Get private IP by querying EC2 network interface
   * Fallback method if task details don't have the IP yet
   */
  private async getPrivateIpFromEni(task: Task): Promise<string | undefined> {
    try {
      // Extract ENI ID from task attachments
      const eniId = this.extractEniId(task);
      if (!eniId) {
        this.logger.warn('No ENI ID found in task attachments');
        return undefined;
      }

      // Query EC2 for network interface details
      const response = await this.ec2.send(
        new DescribeNetworkInterfacesCommand({
          NetworkInterfaceIds: [eniId],
        }),
      );

      const networkInterface = response.NetworkInterfaces?.[0];
      const privateIp = networkInterface?.PrivateIpAddress;

      if (privateIp) {
        this.logger.log(`Retrieved private IP from ENI ${eniId}: ${privateIp}`);
        return privateIp;
      }

      return undefined;
    } catch (error) {
      this.logger.error(`Failed to get private IP from ENI: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * Extract ENI (Elastic Network Interface) ID from task attachments
   */
  private extractEniId(task: Task): string | undefined {
    if (!task.attachments) return undefined;

    for (const attachment of task.attachments) {
      if (attachment.type === 'ElasticNetworkInterface') {
        const eniDetail = attachment.details?.find((d) => d.name === 'networkInterfaceId');
        if (eniDetail?.value) {
          return eniDetail.value;
        }
      }
    }
    return undefined;
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stopTasks(taskArns: string[]): Promise<void> {
    const cluster = this.configService.get<string>('AWS_ECS_CLUSTER_NAME');
    if (!cluster || !taskArns.length) return;
    for (const arn of taskArns) {
      await this.ecs.send(
        new StopTaskCommand({
          cluster,
          task: arn,
          reason: 'Terminated by RangeX policy',
        }),
      );
    }
  }

  async describeTasks(taskArns: string[]): Promise<Task[] | undefined> {
    const cluster = this.configService.get<string>('AWS_ECS_CLUSTER_NAME');
    if (!cluster || !taskArns.length) return [];
    const res = await this.ecs.send(
      new DescribeTasksCommand({
        cluster,
        tasks: taskArns,
      }),
    );
    return res.tasks;
  }
}
