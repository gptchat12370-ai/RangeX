import { BadRequestException, Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { Machine, ResourceProfile } from '../entities/machine.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EnvironmentMachine } from '../entities/environment-machine.entity';
import { SessionNetworkTopology } from '../entities/session-network-topology.entity';
import { NetworkPivotPoint } from '../entities/network-pivot-point.entity';
import { SecurityGroupManagerService } from './security-group-manager.service';
import { LimitService } from './limit.service';
import { CostService } from './cost.service';
import { AwsIntegrationService, RunTaskResult } from './aws-integration.service';
import { BudgetExceededError } from '../common/errors/budget-exceeded.error';
import { MaintenanceModeError } from '../common/errors/maintenance-mode.error';
import { SystemSetting } from '../entities/system-setting.entity';
import { randomBytes } from 'crypto';
import { AuditLog } from '../entities/audit-log.entity';
import { SystemSettingsService } from './system-settings.service';
import { SessionLimitService } from './session-limit.service';
import { DockerComposeGeneratorService } from './docker-compose-generator.service';
import { EventParticipationService } from './event-participation.service';
import { SessionSecurityService } from './session-security.service';
import { AwsHealthCheckService } from './aws-health-check.service';
import { ConfigService } from '@nestjs/config';
import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  AssignPublicIp,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from '@aws-sdk/client-ec2';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);
  private ecsClient: ECSClient;
  private ec2Client: EC2Client;
  private awsRegion: string;
  private ecsClusterName: string;
  private subnetIds: string[];
  private securityGroupIds: string[];

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly scenarioVersionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EnvironmentMachine)
    private readonly envMachineRepo: Repository<EnvironmentMachine>,
    @InjectRepository(SessionNetworkTopology)
    private readonly networkTopologyRepo: Repository<SessionNetworkTopology>,
    @InjectRepository(NetworkPivotPoint)
    private readonly pivotPointRepo: Repository<NetworkPivotPoint>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly limitService: LimitService,
    private readonly costService: CostService,
    private readonly awsIntegration: AwsIntegrationService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly sessionLimitService: SessionLimitService,
    private readonly dockerComposeGenerator: DockerComposeGeneratorService,
    @Inject(forwardRef(() => EventParticipationService))
    private readonly eventParticipationService: EventParticipationService,
    private readonly sessionSecurityService: SessionSecurityService,
    private readonly securityGroupManager: SecurityGroupManagerService,
    private readonly awsHealthCheck: AwsHealthCheckService,
    private readonly configService: ConfigService,
  ) {
    // Initialize AWS clients for Phase 3: Multi-container session deployment
    this.awsRegion = this.configService.get<string>('AWS_REGION') || 'ap-south-2';
    this.ecsClusterName = this.configService.get<string>('AWS_ECS_CLUSTER_NAME') || 'rangex-labs';
    this.subnetIds = (this.configService.get<string>('AWS_PRIVATE_SUBNET_IDS') || '').split(',');
    this.securityGroupIds = (this.configService.get<string>('AWS_ECS_SECURITY_GROUP_IDS') || '').split(',');

    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.ecsClient = new ECSClient({ region: this.awsRegion, credentials });
    this.ec2Client = new EC2Client({ region: this.awsRegion, credentials });
  }

  async startEnvironment(
    scenarioVersionId: string,
    userId: string,
    isTest = false,
    ttlMinutesOverride?: number,
    envProfileOverride?: ResourceProfile,
    eventId?: string,
    teamId?: string,
    clientIp?: string,
    clientUserAgent?: string,
  ): Promise<{ sessionId: string; softBudgetWarning: boolean }> {
    this.logger.log(`startEnvironment requested version=${scenarioVersionId} user=${userId} event=${eventId || 'none'} team=${teamId || 'none'}`);
    
    // NEW: Get system settings for comprehensive checks
    const settings = await this.systemSettingsService.getSettings();
    
    // Check maintenance mode
    if (settings.maintenanceMode) {
      throw new MaintenanceModeError();
    }

    // CRITICAL: Validate event registration if eventId is provided
    if (eventId) {
      this.logger.log(`Validating event registration for user ${userId} in event ${eventId}...`);
      try {
        const { registered } = await this.eventParticipationService.isRegistered(eventId, userId);
        if (!registered) {
          this.logger.warn(`User ${userId} attempted to start event ${eventId} challenge without registration`);
          throw new BadRequestException(
            'You must be registered for this event to compete. Please register first from the event page.'
          );
        }
        this.logger.log(`✓ Event registration validated for user ${userId} in event ${eventId}`);
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(`Event registration check failed: ${error.message}`);
        throw new BadRequestException('Failed to validate event registration. Please try again.');
      }
    }

    // NEW: Check if platform can accept new sessions
    if (!await this.systemSettingsService.canStartSession(userId)) {
      throw new BadRequestException('System container capacity reached. Please try again later.');
    }

    // NEW: Check session limits (rate limiting)
    try {
      await this.sessionLimitService.checkUserLimits(userId);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Session limit exceeded');
    }

    // NEW: Check total running containers limit
    if (settings.maxTotalContainers > 0) {
      const runningCount = await this.sessionRepo.count({ 
        where: { status: In(['starting', 'running']) as any } 
      });
      if (runningCount >= settings.maxTotalContainers) {
        this.logger.warn(`Container limit reached: ${runningCount}/${settings.maxTotalContainers}`);
        throw new BadRequestException('System container capacity reached. Please try again later.');
      }
    }

    const scenarioVersion = await this.scenarioVersionRepo.findOne({
      where: { id: scenarioVersionId },
      relations: ['machines'],
    });
    if (!scenarioVersion) {
      throw new BadRequestException('Scenario version not found');
    }

    // CRITICAL: Only allow starting PUBLISHED scenarios (or APPROVED for admin testing)
    // For admin tests, allow APPROVED scenarios with successful builds
    const allowedStatuses = isTest 
      ? [ScenarioVersionStatus.PUBLISHED, ScenarioVersionStatus.APPROVED]
      : [ScenarioVersionStatus.PUBLISHED];
    
    if (!allowedStatuses.includes(scenarioVersion.status)) {
      const statusMessage = scenarioVersion.status === ScenarioVersionStatus.APPROVED
        ? 'This scenario is currently being built and deployed. Please wait for it to be published.'
        : `This scenario is not available for play (status: ${scenarioVersion.status}).`;
      throw new BadRequestException(statusMessage);
    }

    // For APPROVED scenarios (admin testing), ensure build is complete
    if (scenarioVersion.status === ScenarioVersionStatus.APPROVED) {
      // Allow admins to test APPROVED scenarios even if not published yet
      if (scenarioVersion.buildStatus !== 'SUCCESS') {
        throw new BadRequestException(
          `This scenario build is still in progress (${scenarioVersion.buildStatus || 'PENDING'}). Please wait for the build to complete.`
        );
      }
      if (!scenarioVersion.ecrImagesPushed) {
        throw new BadRequestException('This scenario images are still being pushed to AWS. Please wait.');
      }
      // Skip the isTest check - admins testing APPROVED scenarios is allowed
    } else {
      // For non-APPROVED, non-PUBLISHED scenarios, reject
      if (scenarioVersion.status !== ScenarioVersionStatus.PUBLISHED) {
        throw new BadRequestException(
          `This scenario is not available for play (status: ${scenarioVersion.status}).`
        );
      }
    }

    // ✅ CRITICAL: Health check AWS resources before starting (for solvers)
    // This ensures ECR images and task definitions exist before attempting deployment
    if (!isTest) { // Skip health check for creator testing
      this.logger.log(`[START] Running health check for solver start: ${scenarioVersionId}`);
      const healthCheck = await this.awsHealthCheck.checkSolverStartReadiness(scenarioVersionId);

      if (!healthCheck.canStart) {
        this.logger.error(
          `[START] Health check failed for version ${scenarioVersionId}:\n` +
          `User message: ${healthCheck.userMessage}\n` +
          `Admin message: ${healthCheck.adminMessage}\n` +
          `Missing: ${healthCheck.missingResources?.join(', ')}`
        );
        throw new BadRequestException(healthCheck.userMessage || 'This challenge is currently unavailable.');
      }
      this.logger.log(`[START] ✓ Health check passed for version ${scenarioVersionId}`);
    }

    // CRITICAL: For scenarios with machines, validate that each machine has a task definition
    const scenarioHasMachines = scenarioVersion.machines && scenarioVersion.machines.length > 0;
    if (scenarioHasMachines) {
      const machinesWithoutTaskDef = (scenarioVersion.machines || []).filter(m => !m.fargateTaskDefinition);
      if (machinesWithoutTaskDef.length > 0) {
        this.logger.error(
          `Scenario ${scenarioVersionId} has machines without task definitions: ${machinesWithoutTaskDef.map(m => m.name).join(', ')}`
        );
        throw new BadRequestException(
          'This scenario has not been properly deployed. Please contact an administrator.'
        );
      }
    }

    // NEW: Check scenario access limits (cost control)
    // This limits how many DIFFERENT scenarios a user can have RUNNING simultaneously
    if (!settings.allowAllScenarios && settings.maxAccessibleScenarios > 0) {
      // Check if user already has an active session for THIS scenario
      let existingSessions = await this.sessionRepo.find({
        where: { 
          userId,
          scenarioVersionId,
          status: In(['starting', 'running']) as any
        }
      });
      
      // CRITICAL FIX: Verify AWS task status for "starting" or "running" sessions
      // If AWS task is stopped/failed but DB shows active, mark as failed
      for (const session of existingSessions) {
        this.logger.debug(`[SESSION ${session.id}] Checking session - status: ${session.status}, awsTaskArn: ${session.awsTaskArn || 'none'}`);
        
        if (session.awsTaskArn) {
          try {
            // Check actual AWS task status
            const taskStatus = await this.getTaskStatus(session.awsTaskArn);
            this.logger.debug(`[SESSION ${session.id}] AWS task status: ${taskStatus}`);
            
            if (taskStatus === 'STOPPED' || taskStatus === 'FAILED') {
              this.logger.warn(`[SESSION ${session.id}] Found stuck session - AWS task is ${taskStatus}, marking as failed`);
              await this.sessionRepo.update(session.id, { status: 'failed' });
            }
          } catch (error: any) {
            this.logger.error(`[SESSION ${session.id}] Failed to check AWS task status: ${error.message}`);
            // Assume stuck session, mark as failed
            await this.sessionRepo.update(session.id, { status: 'failed' });
          }
        } else if (session.status === 'starting') {
          // Session is "starting" but has no AWS task ARN - likely failed to launch
          this.logger.warn(`[SESSION ${session.id}] Found orphaned session with no AWS task ARN, marking as failed`);
          await this.sessionRepo.update(session.id, { status: 'failed' });
        }
      }
      
      // Re-fetch sessions after cleanup to get accurate count
      existingSessions = await this.sessionRepo.find({
        where: { 
          userId,
          scenarioVersionId,
          status: In(['starting', 'running']) as any
        }
      });
      
      if (existingSessions.length > 0) {
        this.logger.warn(`User ${userId} already has ${existingSessions.length} active session(s) for scenario ${scenarioVersionId}`);
        throw new BadRequestException(
          'You already have an active session for this scenario. Please terminate it before starting a new one.'
        );
      }

      // User is starting a NEW scenario (not resuming existing one)
      // Count how many DIFFERENT scenarios they currently have RUNNING
      const runningUniqueScenarios = await this.sessionRepo
        .createQueryBuilder('session')
        .select('COUNT(DISTINCT session.scenarioVersionId)', 'count')
        .where('session.userId = :userId', { userId })
        .andWhere('session.status IN (:...statuses)', { statuses: ['starting', 'running'] })
        .getRawOne();
      
      const currentlyRunningCount = parseInt(runningUniqueScenarios?.count || '0', 10);
      
      if (currentlyRunningCount >= settings.maxAccessibleScenarios) {
        this.logger.warn(`User ${userId} reached concurrent scenario limit: ${currentlyRunningCount}/${settings.maxAccessibleScenarios}`);
        throw new BadRequestException(
          `Scenario access limit reached. You can access up to ${settings.maxAccessibleScenarios} scenario(s) simultaneously. Please terminate a running scenario before starting a new one.`
        );
      }
    }
    await this.limitService.checkUserLimits(userId);
    await this.limitService.checkGlobalLimits();
    await this.limitService.checkScenarioLimits(scenarioVersionId);

    // Use scenario's estimated duration, or fallback to global setting
    const scenarioDuration = scenarioVersion.estimatedMinutes || Number(await this.getSetting('env_default_duration_minutes', '90'));
    const ttlMinutes = ttlMinutesOverride ?? scenarioDuration;
    if (ttlMinutes < 15 || ttlMinutes > 480) {
      throw new BadRequestException('TTL out of allowed range');
    }

    const machines =
      scenarioVersion.machines && scenarioVersion.machines.length > 0
        ? scenarioVersion.machines
        : await this.machineRepo.find({ where: { scenarioVersionId } });

    const hasMachines = machines && machines.length > 0;
    const envProfile: ResourceProfile = envProfileOverride ?? (hasMachines ? machines[0].resourceProfile : 'micro');
    const machineCount = hasMachines ? machines.length : 1;

    const projectedCost = await this.costService.estimateSessionMaxCostRm(envProfile, ttlMinutes, machineCount);
    const currentMonthCost = await this.costService.getCurrentMonthCostRm();
    const softLimit = Number(await this.getSetting('soft_usage_limit_rm', '250'));
    const hardLimit = Number(await this.getSetting('hard_usage_limit_rm', '300'));

    if (currentMonthCost + projectedCost >= hardLimit) {
      throw new BudgetExceededError({
        currentMonthCost,
        projectedSessionCost: projectedCost,
        softLimit,
        hardLimit,
        isHardBlock: true,
      });
    }

    const softBudgetWarning = currentMonthCost + projectedCost >= softLimit;

    const session = this.sessionRepo.create({
      userId,
      scenarioVersionId,
      eventId,
      teamId,
      status: 'starting',
      gatewaySessionToken: randomBytes(24).toString('hex'),
      envProfile,
      startedAt: new Date(),
      isTest, // Set admin test flag
    });

    const savedSession = await this.sessionRepo.save(session);

    // SECURITY: Initialize session security metadata (IP, User-Agent)
    if (clientIp && clientUserAgent) {
      try {
        await this.sessionSecurityService.initializeSessionSecurity(
          savedSession.id,
          clientIp,
          clientUserAgent,
        );
        this.logger.log(`✓ Session security initialized for ${savedSession.id}`);
      } catch (error: any) {
        this.logger.warn(`Failed to initialize session security: ${error.message}`);
        // Continue with session creation even if security init fails
      }
    }

    if (machines && machines.length > 0) {
      // Generate Docker Compose with custom images (assets baked in for ECR/Fargate)
      try {
        this.logger.log(`Generating Docker Compose for session ${savedSession.id}`);
        await this.dockerComposeGenerator.generateDockerCompose(
          scenarioVersionId,
          savedSession.id,
        );
        this.logger.log(`Docker Compose generated successfully for session ${savedSession.id}`);
      } catch (error) {
        this.logger.error(`Failed to generate Docker Compose: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with standard images if custom build fails (fallback)
      }
      
      // PHASE 3: Launch multi-container ECS task from stored task definition
      try {
        // PHASE 3: Launch multi-task network topology (one task per machine)
        await this.launchNetworkTopology(savedSession, scenarioVersion, machines);
      } catch (error) {
        this.logger.error(`Failed to launch multi-container task for session ${savedSession.id}:`, error);
        // Auto-terminate failed session
        savedSession.status = 'terminated';
        savedSession.stoppedAt = new Date();
        savedSession.reasonStopped = `Task launch failed: ${error instanceof Error ? error.message : String(error)}`;
        await this.sessionRepo.save(savedSession);
        
        // Re-throw error to inform user
        throw new BadRequestException(
          `Failed to start environment: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `This usually means the scenario has not been properly deployed to AWS. Please contact an administrator.`
        );
      }
    } else {
      // No machines: mark running immediately
      savedSession.status = 'running';
      await this.sessionRepo.save(savedSession);
    }

    savedSession.status = 'running';
    savedSession.expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.sessionRepo.save(savedSession);
    this.logger.log(`startEnvironment success session=${savedSession.id} machines=${machines?.length || 0}`);

    // If this is an event session, create an event_session record
    if (eventId) {
      try {
        await this.eventParticipationService.initializeEventSession(
          savedSession.id,
          eventId,
          userId,
          scenarioVersionId,
        );
        this.logger.log(`✓ Event session initialized for session ${savedSession.id}`);
      } catch (error: any) {
        this.logger.error(`Failed to initialize event session: ${error.message}`);
        // Don't fail the whole operation, just log the error
      }
    }

    if (softBudgetWarning) {
      await this.auditRepo.save(
        this.auditRepo.create({
          userId,
          actionType: 'BUDGET_SOFT_LIMIT_WARNING',
          details: { sessionId: savedSession.id, projectedCost },
        }),
      );
    }

    return { sessionId: savedSession.id, softBudgetWarning };
  }

  /**
   * PHASE 4: Terminate environment with immediate response
   * 
   * Updated: User gets immediate response, cleanup happens in background
   * 
   * Critical Order:
   * 1. Mark session as terminated (immediate - user can exit)
   * 2. Record billing usage (immediate)
   * 3. Background: Stop all ECS tasks
   * 4. Background: Wait for tasks to reach STOPPED status
   * 5. Background: Wait for ENIs to detach (30-60 seconds)
   * 6. Background: Delete security groups via SecurityGroupManagerService
   */
  async terminateEnvironment(sessionId: string, reason: string): Promise<void> {
    this.logger.log(`[SESSION ${sessionId}] Terminating environment: ${reason}`);

    const session = await this.sessionRepo.findOne({ 
      where: { id: sessionId }, 
      relations: ['environmentMachines'] 
    });
    
    if (!session) {
      this.logger.warn(`[SESSION ${sessionId}] Session not found, skipping termination`);
      return;
    }

    // IMMEDIATE: Mark session as terminated so user can exit
    session.status = 'terminated';
    session.stoppedAt = new Date();
    session.reasonStopped = reason;
    await this.sessionRepo.save(session);

    // IMMEDIATE: Record usage for billing
    await this.costService.recordSessionUsage(session);

    this.logger.log(`[SESSION ${sessionId}] ✅ Session marked as terminated - user can exit`);

    // BACKGROUND: Clean up AWS resources asynchronously (don't wait)
    this.cleanupAwsResourcesBackground(sessionId).catch(error => {
      this.logger.error(
        `[SESSION ${sessionId}] Background cleanup failed: ${error.message}`,
        error.stack,
      );
    });
  }

  /**
   * Background cleanup of AWS resources - runs asynchronously
   * User doesn't wait for this to complete
   */
  private async cleanupAwsResourcesBackground(sessionId: string): Promise<void> {
    this.logger.log(`[SESSION ${sessionId}] Starting background AWS cleanup...`);

    try {
      // Step 1: Get all task ARNs from network topology
      const topology = await this.networkTopologyRepo.find({
        where: { sessionId },
      });

      const taskArns = [...new Set(topology.map(t => t.taskArn))];

      if (taskArns.length === 0) {
        this.logger.warn(`[SESSION ${sessionId}] No tasks found in topology`);
      } else {
        // Step 2: Stop all tasks
        this.logger.log(`[SESSION ${sessionId}] Stopping ${taskArns.length} tasks...`);
        await this.stopAllTasks(taskArns);

        // Step 3: Wait for tasks to reach STOPPED status
        this.logger.log(`[SESSION ${sessionId}] Waiting for tasks to stop...`);
        await this.waitForTasksStopped(taskArns, sessionId);

        // Step 4: Wait for ENIs to detach (critical for SG deletion)
        this.logger.log(`[SESSION ${sessionId}] Waiting for ENIs to detach...`);
        const eniIds = topology.map(t => t.networkInterfaceId).filter(Boolean) as string[];
        await this.waitForEnisDetached(eniIds, sessionId);
      }

      // Step 5: Delete security groups
      this.logger.log(`[SESSION ${sessionId}] Deleting security groups...`);
      await this.securityGroupManager.deleteSessionSecurityGroups(sessionId);

      this.logger.log(`[SESSION ${sessionId}] ✅ Background AWS cleanup completed successfully`);

    } catch (error: any) {
      this.logger.error(
        `[SESSION ${sessionId}] Background AWS cleanup failed: ${error.message}`,
        error.stack,
      );
      // Error is already logged, orphaned resource monitor will clean up eventually
    }
  }

  /**
   * Stop all ECS tasks
   */
  private async stopAllTasks(taskArns: string[]): Promise<void> {
    const { StopTaskCommand } = await import('@aws-sdk/client-ecs');

    for (const taskArn of taskArns) {
      try {
        const command = new StopTaskCommand({
          cluster: this.ecsClusterName,
          task: taskArn,
          reason: 'Session terminated',
        });
        await this.ecsClient.send(command);
        this.logger.debug(`Stopped task: ${taskArn}`);
      } catch (error: any) {
        this.logger.warn(`Failed to stop task ${taskArn}: ${error.message}`);
      }
    }
  }

  /**
   * Wait for all tasks to reach STOPPED status
   */
  private async waitForTasksStopped(taskArns: string[], sessionId: string): Promise<void> {
    const maxAttempts = 12; // 2 minutes max
    const delayMs = 10000; // 10 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const describeCommand = new DescribeTasksCommand({
        cluster: this.ecsClusterName,
        tasks: taskArns,
      });

      const response = await this.ecsClient.send(describeCommand);

      if (!response.tasks || response.tasks.length === 0) {
        // All tasks have been deprovisioned
        this.logger.log(`[SESSION ${sessionId}] All tasks deprovisioned`);
        return;
      }

      const allStopped = response.tasks.every(t => t.lastStatus === 'STOPPED');

      if (allStopped) {
        this.logger.log(`[SESSION ${sessionId}] All tasks are STOPPED`);
        return;
      }

      this.logger.log(
        `[SESSION ${sessionId}] Waiting for tasks to stop... Attempt ${attempt + 1}/${maxAttempts}`,
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    this.logger.warn(`[SESSION ${sessionId}] Timeout waiting for tasks to stop, proceeding anyway`);
  }

  /**
   * CRITICAL: Wait for ENIs to detach before deleting security groups
   * ENI detachment takes 30-60 seconds after task stops
   */
  private async waitForEnisDetached(eniIds: string[], sessionId: string): Promise<void> {
    if (eniIds.length === 0) {
      this.logger.log(`[SESSION ${sessionId}] No ENIs to wait for`);
      return;
    }

    const { DescribeNetworkInterfacesCommand } = await import('@aws-sdk/client-ec2');
    const maxAttempts = 30; // 5 minutes max
    const delayMs = 10000; // 10 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const command = new DescribeNetworkInterfacesCommand({
          NetworkInterfaceIds: eniIds,
        });

        const response = await this.ec2Client.send(command);

        if (!response.NetworkInterfaces || response.NetworkInterfaces.length === 0) {
          // All ENIs have been deleted
          this.logger.log(`[SESSION ${sessionId}] All ENIs deleted`);
          return;
        }

        // Check if all ENIs are detached (status = 'available') or deleted
        const allDetached = response.NetworkInterfaces.every(
          eni => eni.Status === 'available' || !eni.Attachment,
        );

        if (allDetached) {
          this.logger.log(`[SESSION ${sessionId}] All ENIs detached`);
          return;
        }

        this.logger.log(
          `[SESSION ${sessionId}] Waiting for ENIs to detach... Attempt ${attempt + 1}/${maxAttempts}`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error: any) {
        // If ENIs don't exist, they're already cleaned up
        if (error.name === 'InvalidNetworkInterfaceID.NotFound') {
          this.logger.log(`[SESSION ${sessionId}] ENIs already deleted`);
          return;
        }
        throw error;
      }
    }

    this.logger.warn(
      `[SESSION ${sessionId}] Timeout waiting for ENI detachment, proceeding anyway (may fail SG deletion)`,
    );
  }

  async terminateAllActiveEnvironments(reason: string): Promise<void> {
    const active = await this.sessionRepo.find({ where: { status: In(['starting', 'running']) as any }, relations: ['machines'] });
    for (const session of active) {
      await this.terminateEnvironment(session.id, reason);
    }
  }

  /**
   * PHASE 3: Launch network topology with one task per machine
   * Each machine gets unique IP for realistic pentesting (nmap, arp-scan)
   * 
   * CRITICAL ARCHITECTURE - THREE-LAYER SECURITY MODEL:
   * ====================================================
   * 
   * LAYER 1 - INFRASTRUCTURE ACCESS (Shared, Static)
   * - ONE shared SG (sg-085c91e7b44303df9) for ALL tasks
   * - Allows: ECR pulls, CloudWatch Logs, S3 access
   * - Trusted by: VPC endpoints (ecr, logs, s3)
   * - Assigned to: ECS task networkConfiguration
   * - Never changes per session
   * - WHY: AWS endpoints require predictable, stable security group access
   *        Dynamic SGs cause "unable to pull registry auth" errors
   * 
   * LAYER 2 - RUNTIME ISOLATION (Future Enhancement)
   * - Per-machine SGs created via SecurityGroupManagerService
   * - Currently: Created but NOT enforced (tasks use infrastructure SG)
   * - Future: Container-level firewall (iptables) OR AWS Network Firewall
   * - These SGs stored for reference and future implementation
   * 
   * LAYER 3 - SOLVER ACCESS (Gateway-Controlled)
   * - Gateway proxy in public subnet
   * - Authentication + JWT-based access control
   * - Entrypoint filtering via exposedToSolver flag
   * - SSH/HTTP forwarding through secure gateway
   * 
   * Steps:
   * 1. Extract network groups from machines
   * 2. Load pivot points from scenario
   * 3. Create security groups per network group (for future use)
   * 4. Launch one Fargate task per machine with INFRASTRUCTURE SG
   * 5. Wait for all tasks to reach RUNNING state
   * 6. Extract private IPs and ENI IDs from tasks
   * 7. Store topology in session_network_topology table
   */
  private async launchNetworkTopology(
    session: EnvironmentSession,
    scenarioVersion: ScenarioVersion,
    machines: Machine[],
  ): Promise<void> {
    const { v4: uuidv4 } = require('uuid');

    this.logger.log(
      `[SESSION ${session.id}] Launching network topology with ${machines.length} machines`,
    );

    // Step 1: Extract unique network groups from machines
    const networkGroups = [...new Set(machines.map(m => m.networkGroup).filter(Boolean))];
    this.logger.log(`[SESSION ${session.id}] Network groups: ${networkGroups.join(', ')}`);

    // Step 2: Build machine configurations for per-machine security groups
    const machineConfigs = machines.map(machine => ({
      machineId: machine.id,
      machineName: machine.name,
      networkGroup: machine.networkGroup,
      networkEgressPolicy: machine.networkEgressPolicy,
      allowSolverEntry: machine.allowSolverEntry,
      allowFromAttacker: machine.allowFromAttacker,
      allowInternalConnections: machine.allowInternalConnections,
      isPivotHost: machine.isPivotHost,
      exposedPorts: machine.entrypoints
        ?.filter(e => e.exposedToSolver)
        .map(e => ({ protocol: e.protocol, port: e.containerPort })) || [],
    }));

    // Step 3: Create per-machine security groups (fine-grained network control)
    this.logger.log(`[SESSION ${session.id}] Creating ${machines.length} per-machine security groups...`);
    const sgMap = await this.securityGroupManager.createMachineSecurityGroups(
      session.id,
      machineConfigs,
    );
    this.logger.log(`[SESSION ${session.id}] Per-machine security groups created successfully`);

    // Step 4: Launch one Fargate task per machine
    const taskLaunches: Promise<any>[] = [];
    const machineToSgMap = new Map<string, string>();

    for (const machine of machines) {
      const taskDefArn = machine.fargateTaskDefinition;
      if (!taskDefArn) {
        throw new Error(`Machine ${machine.name} has no task definition ARN`);
      }

      const securityGroupId = sgMap.get(machine.id);
      if (!securityGroupId) {
        throw new Error(`No security group found for machine ${machine.id}`);
      }

      machineToSgMap.set(machine.id, securityGroupId);

      this.logger.log(
        `[SESSION ${session.id}] Launching task for ${machine.name} (${machine.networkGroup})`,
      );

      const launchPromise = this.launchSingleMachineTask(
        session.id,
        machine,
        taskDefArn,
        securityGroupId,
      );
      taskLaunches.push(launchPromise);
    }

    // Wait for all tasks to launch
    const launchedTasks = await Promise.all(taskLaunches);
    this.logger.log(`[SESSION ${session.id}] All ${machines.length} tasks launched`);

    // Step 5: Wait for all tasks to reach RUNNING state
    const taskArns = launchedTasks.map(t => t.taskArn);
    await this.waitForAllTasksRunning(taskArns, session.id);

    // Step 6: Extract private IPs and ENI IDs from tasks
    this.logger.log(`[SESSION ${session.id}] Extracting private IPs and ENI IDs...`);
    const taskDetails = await this.getTaskNetworkDetails(taskArns);

    // Step 7: Store topology in session_network_topology table
    for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      const taskInfo = launchedTasks[i];
      const networkDetails = taskDetails.get(taskInfo.taskArn);

      if (!networkDetails) {
        this.logger.warn(`[SESSION ${session.id}] No network details for ${machine.name}`);
        continue;
      }

      await this.networkTopologyRepo.save(
        this.networkTopologyRepo.create({
          id: uuidv4(),
          sessionId: session.id,
          machineName: machine.name,
          machineRole: machine.role,
          networkGroup: machine.networkGroup,
          taskArn: taskInfo.taskArn,
          privateIp: networkDetails.privateIp,
          subnetId: networkDetails.subnetId,
          securityGroupId: machineToSgMap.get(machine.id)!,
          networkInterfaceId: networkDetails.eniId,
          status: 'running',
        }),
      );

      // Also create environment_machine record for backward compatibility
      await this.envMachineRepo.save(
        this.envMachineRepo.create({
          environmentSessionId: session.id,
          machineId: machine.id,
          machineTemplateId: machine.id,
          taskArn: taskInfo.taskArn,
          privateIp: networkDetails.privateIp,
          securityGroupId: machineToSgMap.get(machine.id)!,
          role: machine.role,
        }),
      );
    }

    this.logger.log(
      `[SESSION ${session.id}] ✅ Network topology deployed: ${machines.length} machines with unique IPs`,
    );
  }

  /**
   * Launch a single Fargate task for one machine
   * 
   * CRITICAL: Uses static infrastructure SG for ECR/CloudWatch access
   * Runtime network isolation is handled by security group rules, not task assignment
   */
  private async launchSingleMachineTask(
    sessionId: string,
    machine: Machine,
    taskDefArn: string,
    runtimeSecurityGroupId: string, // For logging/reference only
  ): Promise<{ taskArn: string; machineName: string }> {
    this.logger.debug(`[SESSION ${sessionId}] Launching ${machine.name} with infrastructure SGs: ${this.securityGroupIds.join(', ')}`);
    
    const runTaskCommand = new RunTaskCommand({
      cluster: this.ecsClusterName,
      taskDefinition: taskDefArn,
      count: 1,
      // Fargate Spot for cost savings
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
          // LAYER 1 - INFRASTRUCTURE ACCESS (Static, Shared)
          // Must use static SG trusted by VPC endpoints for ECR/Logs/S3
          securityGroups: this.securityGroupIds, // sg-085c91e7b44303df9
          assignPublicIp: AssignPublicIp.DISABLED,
        },
      },
      tags: [
        { key: 'SessionId', value: sessionId },
        { key: 'MachineName', value: machine.name },
        { key: 'NetworkGroup', value: machine.networkGroup },
        { key: 'MachineRole', value: machine.role },
        { key: 'ManagedBy', value: 'RangeX' },
        { key: 'RuntimeSecurityGroup', value: runtimeSecurityGroupId }, // For reference
      ],
    });

    const response = await this.ecsClient.send(runTaskCommand);

    if (!response.tasks || response.tasks.length === 0) {
      throw new Error(`Failed to launch task for machine ${machine.name}`);
    }

    const taskArn = response.tasks[0].taskArn!;
    this.logger.log(`[SESSION ${sessionId}] Task launched for ${machine.name}: ${taskArn}`);

    return { taskArn, machineName: machine.name };
  }

  /**
   * Wait for all tasks to reach RUNNING state
   */
  private async waitForAllTasksRunning(taskArns: string[], sessionId: string): Promise<void> {
    const maxAttempts = 30; // 5 minutes max
    const delayMs = 10000; // 10 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const describeCommand = new DescribeTasksCommand({
        cluster: this.ecsClusterName,
        tasks: taskArns,
      });

      const response = await this.ecsClient.send(describeCommand);

      if (!response.tasks) {
        throw new Error('Failed to describe tasks');
      }

      const allRunning = response.tasks.every(t => t.lastStatus === 'RUNNING');
      const anyFailed = response.tasks.some(t => t.lastStatus === 'STOPPED');

      if (anyFailed) {
        const failedTasks = response.tasks.filter(t => t.lastStatus === 'STOPPED');
        
        // Log detailed failure reasons for each task
        for (const task of failedTasks) {
          this.logger.error(`[SESSION ${sessionId}] Task ${task.taskArn} STOPPED`);
          this.logger.error(`  stopCode: ${task.stopCode || 'none'}`);
          this.logger.error(`  stoppedReason: ${task.stoppedReason || 'none'}`);
          
          // Log container failure details
          if (task.containers) {
            for (const container of task.containers) {
              if (container.reason) {
                this.logger.error(`  Container ${container.name}: ${container.reason}`);
              }
              if (container.exitCode !== undefined) {
                this.logger.error(`  Container ${container.name} exitCode: ${container.exitCode}`);
              }
            }
          }
        }
        
        throw new Error(
          `Tasks failed to start: ${failedTasks.map(t => t.taskArn).join(', ')}`,
        );
      }

      if (allRunning) {
        this.logger.log(`[SESSION ${sessionId}] All ${taskArns.length} tasks are RUNNING`);
        return;
      }

      this.logger.log(
        `[SESSION ${sessionId}] Waiting for tasks... Attempt ${attempt + 1}/${maxAttempts}`,
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Timeout waiting for tasks to reach RUNNING state');
  }

  /**
   * Get network details (private IP, ENI ID, subnet) for tasks
   */
  private async getTaskNetworkDetails(
    taskArns: string[],
  ): Promise<Map<string, { privateIp: string; eniId: string; subnetId: string }>> {
    const details = new Map<string, { privateIp: string; eniId: string; subnetId: string }>();

    const describeCommand = new DescribeTasksCommand({
      cluster: this.ecsClusterName,
      tasks: taskArns,
      include: ['TAGS'],
    });

    const response = await this.ecsClient.send(describeCommand);

    if (!response.tasks) {
      throw new Error('Failed to describe tasks for network details');
    }

    for (const task of response.tasks) {
      if (!task.taskArn || !task.attachments) continue;

      // Find the ENI attachment
      const eniAttachment = task.attachments.find(a => a.type === 'ElasticNetworkInterface');
      if (!eniAttachment) continue;

      const eniId = eniAttachment.details?.find(d => d.name === 'networkInterfaceId')?.value;
      const privateIp = eniAttachment.details?.find(d => d.name === 'privateIPv4Address')?.value;
      const subnetId = eniAttachment.details?.find(d => d.name === 'subnetId')?.value;

      if (eniId && privateIp && subnetId) {
        details.set(task.taskArn, { privateIp, eniId, subnetId });
      }
    }

    return details;
  }

  /**
   * LEGACY: Old multi-container task launch (Phase 1)
   * DEPRECATED: Use launchNetworkTopology instead
   */
  private async launchMultiContainerTask(
    session: EnvironmentSession,
    scenarioVersion: ScenarioVersion,
    machines: Machine[],
  ): Promise<void> {
    const taskDefinitionArn = scenarioVersion.fargateTaskDefinition;

    if (!taskDefinitionArn) {
      throw new Error('Task definition ARN not found for scenario version');
    }

    this.logger.log(
      `[SESSION ${session.id}] [LEGACY] Launching multi-container task from definition: ${taskDefinitionArn}`,
    );

    // Launch Fargate Spot task with all containers
    const runTaskCommand = new RunTaskCommand({
      cluster: this.ecsClusterName,
      taskDefinition: taskDefinitionArn,
      // Fargate Spot for 70% cost savings
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
          subnets: this.subnetIds, // Private subnets only
          securityGroups: this.securityGroupIds,
          assignPublicIp: AssignPublicIp.DISABLED, // No public IP
        },
      },
      tags: [
        { key: 'SessionId', value: session.id },
        { key: 'UserId', value: session.userId.toString() },
        { key: 'ScenarioVersionId', value: scenarioVersion.id },
        { key: 'Environment', value: 'solver-session' },
      ],
    });

    const runTaskResponse = await this.ecsClient.send(runTaskCommand);

    if (!runTaskResponse.tasks || runTaskResponse.tasks.length === 0) {
      throw new Error('Failed to start ECS task - no tasks returned');
    }

    const taskArn = runTaskResponse.tasks[0].taskArn!;
    this.logger.log(`[SESSION ${session.id}] Task started: ${taskArn}`);

    // Store task ARN in session (for cleanup)
    session.awsTaskArn = taskArn;
    await this.sessionRepo.save(session);

    // Wait for task to reach RUNNING state
    await this.waitForTaskRunning(taskArn, session.id);

    // Get private IPs for all containers
    const containerIps = await this.getContainerPrivateIps(taskArn, session.id);

    // Create environment_machine records for each container
    for (const machine of machines) {
      const containerName = machine.name.replace(/\s+/g, '-').toLowerCase();
      const privateIp = containerIps[containerName];

      if (!privateIp) {
        this.logger.warn(
          `[SESSION ${session.id}] No IP found for container ${containerName}`,
        );
      }

      await this.envMachineRepo.save(
        this.envMachineRepo.create({
          environmentSessionId: session.id,
          machineTemplateId: machine.id,
          taskArn: taskArn, // Same task ARN for all containers
          privateIp: privateIp || 'pending',
          role: machine.role,
        }),
      );
    }

    this.logger.log(
      `[SESSION ${session.id}] Multi-container task deployed with ${machines.length} containers`,
    );
  }

  /**
   * Wait for ECS task to reach RUNNING state
   */
  private async waitForTaskRunning(taskArn: string, sessionId: string): Promise<void> {
    const maxAttempts = 30; // 5 minutes max
    const delayMs = 10000; // 10 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const describeCommand = new DescribeTasksCommand({
        cluster: this.ecsClusterName,
        tasks: [taskArn],
      });

      const response = await this.ecsClient.send(describeCommand);
      const task = response.tasks?.[0];

      if (!task) {
        throw new Error('Task not found');
      }

      if (task.lastStatus === 'RUNNING') {
        this.logger.log(`[SESSION ${sessionId}] Task is now RUNNING`);
        return;
      }

      if (task.lastStatus === 'STOPPED') {
        throw new Error(`Task stopped unexpectedly: ${task.stopCode || 'Unknown reason'}`);
      }

      this.logger.log(
        `[SESSION ${sessionId}] Waiting for task to start... (${task.lastStatus})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Timeout waiting for task to reach RUNNING state');
  }

  /**
   * Get private IPs for all containers in the task
   * Returns a map of container name -> private IP
   */
  private async getContainerPrivateIps(
    taskArn: string,
    sessionId: string,
  ): Promise<Record<string, string>> {
    const describeCommand = new DescribeTasksCommand({
      cluster: this.ecsClusterName,
      tasks: [taskArn],
    });

    const response = await this.ecsClient.send(describeCommand);
    const task = response.tasks?.[0];

    if (!task) {
      throw new Error('Task not found when retrieving IPs');
    }

    // Get network interface ID from task
    const eniAttachment = task.attachments?.find((a) => a.type === 'ElasticNetworkInterface');
    if (!eniAttachment) {
      throw new Error('No network interface found for task');
    }

    const eniIdDetail = eniAttachment.details?.find((d) => d.name === 'networkInterfaceId');
    if (!eniIdDetail?.value) {
      throw new Error('Network interface ID not found');
    }

    const networkInterfaceId = eniIdDetail.value;

    // Get private IPs from network interface
    const ec2Command = new DescribeNetworkInterfacesCommand({
      NetworkInterfaceIds: [networkInterfaceId],
    });

    const ec2Response = await this.ec2Client.send(ec2Command);
    const networkInterface = ec2Response.NetworkInterfaces?.[0];

    if (!networkInterface?.PrivateIpAddress) {
      throw new Error('Private IP not found for network interface');
    }

    const primaryIp = networkInterface.PrivateIpAddress;

    // In multi-container tasks, all containers share the same private IP
    // They communicate via localhost on different ports
    this.logger.log(`[SESSION ${sessionId}] Task private IP: ${primaryIp}`);

    // Map all container names to the same IP (they're in the same task)
    const containerIps: Record<string, string> = {};
    
    // Get container names from task definition
    if (task.containers) {
      for (const container of task.containers) {
        if (container.name) {
          containerIps[container.name] = primaryIp;
        }
      }
    }

    return containerIps;
  }

  // Deprecated: Old single-task-per-machine provisioning (kept for backward compatibility)
  private async provisionMachines(session: EnvironmentSession, machines: Machine[]): Promise<void> {
    const tasks: RunTaskResult[] = [];
    for (const machine of machines) {
      const result = await this.awsIntegration.runTask(machine, {
        sessionId: session.id,
        userId: session.userId,
      });
      tasks.push(result);
      await this.envMachineRepo.save(
        this.envMachineRepo.create({
          environmentSessionId: session.id,
          machineTemplateId: machine.id,
          taskArn: result.taskArn,
          privateIp: result.privateIp,
          role: machine.role,
        }),
      );
    }
    this.logger.log(`Provisioned ${tasks.length} tasks for session ${session.id}`);
  }

  private async getSetting(key: string, fallback: string): Promise<string> {
    const record = await this.settingsRepo.findOne({ where: { key } });
    return record?.value ?? fallback;
  }

  /**
   * Get current AWS task status (for stuck session detection)
   */
  private async getTaskStatus(taskArn: string): Promise<string> {
    try {
      const describeCommand = new DescribeTasksCommand({
        cluster: this.ecsClusterName,
        tasks: [taskArn],
      });

      const response = await this.ecsClient.send(describeCommand);
      const task = response.tasks?.[0];

      if (!task) {
        return 'STOPPED'; // Task not found, assume stopped
      }

      return task.lastStatus || 'UNKNOWN';
    } catch (error: any) {
      this.logger.error(`Failed to get task status for ${taskArn}: ${error.message}`);
      return 'UNKNOWN';
    }
  }
}
