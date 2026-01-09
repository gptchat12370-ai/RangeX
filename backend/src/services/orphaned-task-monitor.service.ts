import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { SessionNetworkTopology } from '../entities/session-network-topology.entity';
import { ECSClient, DescribeTasksCommand, StopTaskCommand, ListTasksCommand } from '@aws-sdk/client-ecs';

export interface OrphanedTask {
  taskArn: string;
  sessionId: string;
  startedAt: Date;
  reason: 'no_session' | 'session_terminated' | 'backend_crash' | 'stale';
  estimatedCost: number;
}

/**
 * Orphaned Container Prevention Service
 * 
 * Detects and terminates Fargate tasks that are running without active sessions.
 * This prevents unexpected AWS charges from:
 * - Backend crashes (sessions lost but containers still running)
 * - Database inconsistencies (session marked terminated but task still running)
 * - Stale tasks (running longer than max session duration)
 * - Manual interventions (admin deleted session but forgot to stop task)
 */
@Injectable()
export class OrphanedTaskMonitorService {
  private readonly logger = new Logger(OrphanedTaskMonitorService.name);
  private ecsClient: ECSClient;
  private readonly CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || 'rangex-minimal';
  private readonly MAX_SESSION_DURATION_HOURS = 4; // No session should run longer than this
  private readonly GRACE_PERIOD_MINUTES = 15; // Don't kill tasks younger than this (allow time to start)

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(SessionNetworkTopology)
    private topologyRepo: Repository<SessionNetworkTopology>,
  ) {
    this.ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'ap-south-2' });
  }

  /**
   * Run every 10 minutes to check for orphaned tasks
   */
  @Cron('*/10 * * * *')
  async scanForOrphanedTasks(): Promise<void> {
    this.logger.log('Scanning for orphaned Fargate tasks...');

    try {
      const orphanedTasks = await this.detectOrphanedTasks();

      if (orphanedTasks.length === 0) {
        this.logger.log('No orphaned tasks found');
        return;
      }

      this.logger.warn(`Found ${orphanedTasks.length} orphaned tasks`);

      // Terminate each orphaned task
      for (const task of orphanedTasks) {
        await this.terminateOrphanedTask(task);
      }

      // Send alert to admins
      await this.sendOrphanedTaskAlert(orphanedTasks);
    } catch (error: any) {
      this.logger.error(`Failed to scan for orphaned tasks: ${error.message}`, error.stack);
    }
  }

  /**
   * Detect orphaned tasks by cross-checking ECS with database
   */
  private async detectOrphanedTasks(): Promise<OrphanedTask[]> {
    const orphaned: OrphanedTask[] = [];

    // Step 1: Get all running ECS tasks
    const runningTasks = await this.getAllRunningTasks();
    this.logger.log(`Found ${runningTasks.length} running ECS tasks`);

    // Step 2: Get all active sessions from database
    const activeSessions = await this.sessionRepo.find({
      where: {
        status: In(['starting', 'running']) as any,
      },
      select: ['id', 'awsTaskArn', 'startedAt'],
    });

    // Collect task ARNs from both session.awsTaskArn and network topology
    const activeTaskArns = new Set<string>();
    
    for (const session of activeSessions) {
      // Add legacy awsTaskArn if exists
      if (session.awsTaskArn) {
        activeTaskArns.add(session.awsTaskArn);
      }
      
      // Query network topology for this session's machine tasks
      const topology = await this.topologyRepo.find({
        where: { sessionId: session.id },
        select: ['taskArn'],
      });
      
      for (const machine of topology) {
        if (machine.taskArn) {
          activeTaskArns.add(machine.taskArn);
        }
      }
    }

    this.logger.log(`Found ${activeSessions.length} active sessions in database`);

    // Step 3: Find tasks without active sessions
    for (const taskArn of runningTasks) {
      if (!activeTaskArns.has(taskArn)) {
        // This task is running but has no active session
        const details = await this.getTaskDetails(taskArn);
        
        // Skip infrastructure tasks (gateway-proxy, services, etc.)
        if (details.taskFamily === 'rangex-gateway-proxy') {
          this.logger.debug(`Skipping infrastructure task: ${details.taskFamily}`);
          continue;
        }
        
        // GRACE PERIOD: Don't kill tasks that started recently (allow time for PENDING -> RUNNING)
        const taskAgeMinutes = (new Date().getTime() - details.startedAt.getTime()) / (1000 * 60);
        if (taskAgeMinutes < this.GRACE_PERIOD_MINUTES) {
          this.logger.debug(`Skipping young task (${taskAgeMinutes.toFixed(1)} minutes old): ${taskArn}`);
          continue;
        }
        
        orphaned.push({
          taskArn,
          sessionId: details.sessionId || 'unknown',
          startedAt: details.startedAt,
          reason: await this.determineOrphanReason(taskArn, details.sessionId),
          estimatedCost: this.calculateWastedCost(details.startedAt),
        });
      }
    }

    // Step 4: Find stale tasks (running longer than max duration)
    const maxDuration = new Date();
    maxDuration.setHours(maxDuration.getHours() - this.MAX_SESSION_DURATION_HOURS);

    const staleSessions = await this.sessionRepo.find({
      where: {
        status: 'running',
        startedAt: LessThan(maxDuration),
      },
    });

    for (const session of staleSessions) {
      if (session.awsTaskArn && session.startedAt) {
        orphaned.push({
          taskArn: session.awsTaskArn,
          sessionId: session.id,
          startedAt: session.startedAt,
          reason: 'stale',
          estimatedCost: this.calculateWastedCost(session.startedAt),
        });
      }
    }

    return orphaned;
  }

  /**
   * Get all running tasks from ECS
   */
  private async getAllRunningTasks(): Promise<string[]> {
    try {
      const listCommand = new ListTasksCommand({
        cluster: this.CLUSTER_NAME,
        desiredStatus: 'RUNNING',
      });

      const response = await this.ecsClient.send(listCommand);
      return response.taskArns || [];
    } catch (error: any) {
      this.logger.error(`Failed to list ECS tasks: ${error.message}`);
      return [];
    }
  }

  /**
   * Get task details from ECS
   */
  private async getTaskDetails(taskArn: string): Promise<{ sessionId?: string; startedAt: Date; taskFamily?: string }> {
    try {
      const describeCommand = new DescribeTasksCommand({
        cluster: this.CLUSTER_NAME,
        tasks: [taskArn],
      });

      const response = await this.ecsClient.send(describeCommand);
      const task = response.tasks?.[0];

      if (!task) {
        return { startedAt: new Date() };
      }

      // Extract task family from task definition ARN
      // Example: arn:aws:ecs:region:account:task-definition/rangex-gateway-proxy:4
      const taskDefArn = task.taskDefinitionArn || '';
      const taskFamily = taskDefArn.split('/')[1]?.split(':')[0]; // Extract "rangex-gateway-proxy"

      // Extract session ID from task tags or environment variables
      const sessionIdTag = task.tags?.find((tag) => tag.key === 'SessionId');
      const sessionId = sessionIdTag?.value;

      return {
        sessionId,
        startedAt: task.startedAt ? new Date(task.startedAt) : new Date(),
        taskFamily,
      };
    } catch (error: any) {
      this.logger.error(`Failed to describe task ${taskArn}: ${error.message}`);
      return { startedAt: new Date() };
    }
  }

  /**
   * Determine why task is orphaned
   */
  private async determineOrphanReason(taskArn: string, sessionId?: string): Promise<OrphanedTask['reason']> {
    if (!sessionId) {
      return 'no_session';
    }

    // Check if session exists in database
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      return 'backend_crash'; // Session was lost from database
    }

    if (session.status === 'stopping') {
      return 'session_terminated'; // Session ended but task still running
    }

    return 'no_session';
  }

  /**
   * Calculate wasted cost for orphaned task
   */
  private calculateWastedCost(startedAt: Date): number {
    const now = new Date();
    const durationHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    // Fargate pricing: ~RM 0.04/hour for 0.25 vCPU, 0.5GB RAM
    const hourlyRate = 0.04;
    return durationHours * hourlyRate;
  }

  /**
   * Terminate orphaned task
   */
  private async terminateOrphanedTask(task: OrphanedTask): Promise<void> {
    this.logger.warn(
      `Terminating orphaned task: ${task.taskArn} (Reason: ${task.reason}, Wasted: RM ${task.estimatedCost.toFixed(2)})`
    );

    try {
      // Stop the ECS task
      const stopCommand = new StopTaskCommand({
        cluster: this.CLUSTER_NAME,
        task: task.taskArn,
        reason: `Orphaned task detected: ${task.reason}`,
      });

      await this.ecsClient.send(stopCommand);

      // Update session in database if it exists
      if (task.sessionId !== 'unknown') {
        await this.sessionRepo.update(
          { id: task.sessionId },
          {
            status: 'terminated' as any,
            endedAt: new Date() as any,
          }
        );
      }

      this.logger.log(`Successfully terminated orphaned task: ${task.taskArn}`);
    } catch (error: any) {
      this.logger.error(`Failed to terminate orphaned task ${task.taskArn}: ${error.message}`, error.stack);
    }
  }

  /**
   * Send alert about orphaned tasks
   */
  private async sendOrphanedTaskAlert(tasks: OrphanedTask[]): Promise<void> {
    const totalWasted = tasks.reduce((sum, task) => sum + task.estimatedCost, 0);

    const message = `
      🚨 Orphaned Fargate Tasks Detected
      
      Found: ${tasks.length} orphaned tasks
      Total Wasted Cost: RM ${totalWasted.toFixed(2)}
      
      Breakdown:
      ${tasks.map((t) => `- ${t.sessionId}: ${t.reason} (RM ${t.estimatedCost.toFixed(2)})`).join('\n')}
      
      All orphaned tasks have been automatically terminated.
    `;

    this.logger.error(message);

    // TODO: Send via AlertService (SMS, Email, Web notification)
    // await this.alertService.send({
    //   level: 'critical',
    //   title: 'Orphaned Tasks Detected',
    //   message,
    //   channels: ['sms', 'email', 'web'],
    // });
  }

  /**
   * Manual scan trigger (for testing or admin use)
   */
  async manualScan(): Promise<OrphanedTask[]> {
    this.logger.log('Manual orphaned task scan triggered');
    const orphaned = await this.detectOrphanedTasks();
    
    if (orphaned.length > 0) {
      for (const task of orphaned) {
        await this.terminateOrphanedTask(task);
      }
    }

    return orphaned;
  }

  /**
   * Get orphaned task statistics
   */
  async getStatistics(): Promise<{
    totalDetected: number;
    totalTerminated: number;
    totalWastedCost: number;
    lastScan: Date;
  }> {
    // In production: Store in database for historical tracking
    // For now: Return current scan results
    const orphaned = await this.detectOrphanedTasks();
    
    return {
      totalDetected: orphaned.length,
      totalTerminated: orphaned.length,
      totalWastedCost: orphaned.reduce((sum, t) => sum + t.estimatedCost, 0),
      lastScan: new Date(),
    };
  }
}
