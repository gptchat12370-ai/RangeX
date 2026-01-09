# RangeX Code Documentation - Part 1: AWS Infrastructure

This document provides comprehensive code analysis of RangeX's AWS infrastructure implementation, including ECS Fargate deployment, ECR image management, VPC networking, cost tracking, and health monitoring.

---

## Table of Contents
1. [AWS SDK Client Initialization](#1-aws-sdk-client-initialization)
2. [ECS Fargate Deployment](#2-ecs-fargate-deployment)
3. [Task Definition Registration](#3-task-definition-registration)
4. [Budget Monitoring & Cost Calculation](#4-budget-monitoring--cost-calculation)
5. [Health Check System](#5-health-check-system)
6. [VPC Endpoint Management](#6-vpc-endpoint-management)

---

## 1. AWS SDK Client Initialization

**File**: [backend/src/services/aws-deploy.service.ts](backend/src/services/aws-deploy.service.ts) (Lines 52-84)

**Purpose**: Initialize AWS SDK v3 clients for ECS, ECR, and EC2 services with proper region configuration.

### Code Snippet:
```typescript
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
```

### Explanation:
- **Lines 53-58**: Define class properties for AWS clients and infrastructure identifiers. These are marked as `private readonly` to prevent accidental modification.
- **Lines 60-72**: Dependency injection pattern used by NestJS to inject repositories and services needed for deployment operations.
- **Line 73**: Retrieve AWS region from environment variables with fallback to 'ap-south-2' (Asia Pacific - Hyderabad).
- **Lines 75-77**: Initialize AWS SDK v3 clients. Each client is configured with the region and will use credentials from environment variables or IAM role.
- **Lines 79-82**: Load infrastructure configuration:
  - `clusterName`: ECS cluster where tasks will run
  - `vpcId`: Virtual Private Cloud identifier for network isolation
  - `subnets`: Comma-separated list of subnet IDs for task placement
  - `securityGroups`: Network security group IDs for firewall rules

### Key Takeaways:
- Uses AWS SDK v3 modular approach (separate clients for each service)
- Configuration is externalized via ConfigService for environment-specific deployments
- Defaults are provided to ensure service can initialize even with partial config
- All AWS resources are scoped to a single region for cost optimization

---

## 2. ECS Fargate Deployment

**File**: [backend/src/services/aws-deploy.service.ts](backend/src/services/aws-deploy.service.ts) (Lines 87-194)

**Purpose**: Deploy cybersecurity lab scenarios to AWS ECS Fargate using pre-built ECR images with shared infrastructure for cost efficiency.

### Code Snippet:
```typescript
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
```

### Explanation:
- **Lines 92-97**: JSDoc comment explains the deployment strategy - uses "Shared Infrastructure" approach where ECR images and VPC endpoints are reused across deployments to minimize costs.
- **Lines 100-107**: Load scenario version from database with relations. This includes all metadata needed for deployment.
- **Lines 109-120**: Bundle validation logic. If bundle isn't ready, it generates docker-compose configuration and creates a bundle. Otherwise, retrieves existing bundle from storage.
- **Lines 122-134**: Create deployment record with 'DEPLOYING' status. This provides audit trail and tracks deployment lifecycle. Port mappings are stored for connection string generation.
- **Lines 138-142**: Cost optimization strategy - skip ECR repository creation since images are already pushed during approval workflow. Uses shared 'rangex' prefix instead of per-deployment prefixes.
- **Lines 144-146**: Retrieve existing VPC endpoints rather than creating new ones. VPC endpoints are expensive (~$7/month each) so sharing them across deployments saves significant costs.
- **Lines 148-154**: Register ECS task definitions, start gateway (proxy) task, and start individual machine tasks. This creates the actual runtime infrastructure.
- **Lines 156-157**: Retrieve the public IP or DNS name of the gateway task. This becomes the entry point for solver connections.
- **Lines 159-170**: Update deployment record with all runtime information (ARNs, endpoints, status). This data is needed for park/unpark/teardown operations.
- **Lines 172-174**: Update scenario version status to 'deployed' for tracking purposes.
- **Lines 176-184**: Build connection strings for each exposed service. These are provided to solvers to access the lab environment.
- **Lines 185-191**: Error handling - if deployment fails at any step, mark deployment as FAILED and propagate error.

### Key Takeaways:
- **Shared Infrastructure Pattern**: Reuses ECR images and VPC endpoints to reduce costs from ~$50/month to ~$0.08/hour
- **Stateful Tracking**: Every deployment is tracked in database with status transitions for observability
- **Separation of Concerns**: Build Orchestration (image building) is decoupled from Deployment (runtime provisioning)
- **Gateway Architecture**: Single gateway task proxies traffic to multiple machine tasks for network isolation
- **Connection Abstraction**: Generates protocol-specific connection strings (ssh://, http://, etc.) for frontend display

---

## 3. Task Definition Registration

**File**: [backend/src/services/aws-deploy.service.ts](backend/src/services/aws-deploy.service.ts) (Lines 400-500, estimated)

**Purpose**: Register ECS task definitions that specify container configuration, resource limits, and networking for Fargate deployment.

### Code Snippet:
```typescript
private async registerTaskDefinitions(bundle: ScenarioBundle, repoPrefix: string): Promise<any> {
  const taskDefs: any = { machines: [] };

  // Register gateway task definition
  const gatewayTaskDef = {
    family: `${repoPrefix}-gateway`,
    networkMode: 'awsvpc',
    requiresCompatibilities: ['FARGATE'],
    cpu: '256', // 0.25 vCPU
    memory: '512', // 512 MB
    containerDefinitions: [
      {
        name: 'gateway',
        image: `${this.ecrRegistry}/${repoPrefix}/gateway:latest`,
        essential: true,
        portMappings: bundle.portMapping.map(pm => ({
          containerPort: pm.externalPort,
          protocol: pm.protocol === 'ssh' ? 'tcp' : pm.protocol,
        })),
        environment: [
          { name: 'MODE', value: 'gateway' },
          { name: 'SESSION_TOKEN', value: 'PLACEHOLDER' }, // Replaced at runtime
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': `/ecs/${repoPrefix}-gateway`,
            'awslogs-region': this.awsRegion,
            'awslogs-stream-prefix': 'gateway',
          },
        },
      },
    ],
  };

  const registerGatewayCommand = new RegisterTaskDefinitionCommand(gatewayTaskDef);
  const gatewayResponse = await this.ecsClient.send(registerGatewayCommand);
  taskDefs.gateway = gatewayResponse.taskDefinition?.taskDefinitionArn;

  // Register task definitions for each machine
  for (const image of bundle.images) {
    const taskDef = {
      family: `${repoPrefix}-${image.machineName}`,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: image.cpu || '256',
      memory: image.memory || '512',
      containerDefinitions: [
        {
          name: image.machineName,
          image: image.ecrUri || `${this.ecrRegistry}/${repoPrefix}/${image.machineName}:latest`,
          essential: true,
          environment: image.envVars || [],
          command: image.command ? image.command.split(' ') : undefined,
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': `/ecs/${repoPrefix}-${image.machineName}`,
              'awslogs-region': this.awsRegion,
              'awslogs-stream-prefix': image.machineName,
            },
          },
        },
      ],
    };

    const registerCommand = new RegisterTaskDefinitionCommand(taskDef);
    const response = await this.ecsClient.send(registerCommand);
    taskDefs.machines.push({
      machineName: image.machineName,
      taskDefinitionArn: response.taskDefinition?.taskDefinitionArn,
    });
  }

  return taskDefs;
}
```

### Explanation:
- **Lines 1-2**: Function returns both gateway and machine task definition ARNs for use in RunTask operations.
- **Lines 4-8**: Gateway task definition family name. Each registration creates a new revision (e.g., v1, v2, v3).
- **Lines 9-10**: Resource limits for gateway. 0.25 vCPU and 512MB is sufficient for proxy workload. Cost: ~$0.01/hour.
- **Lines 14-18**: Port mappings taken from bundle. Gateway exposes all solver-accessible ports (SSH, HTTP, VNC, etc.).
- **Lines 19-22**: Environment variables for gateway configuration. SESSION_TOKEN is replaced with actual session token when starting task.
- **Lines 23-30**: CloudWatch Logs configuration. All container stdout/stderr is sent to CloudWatch for debugging and audit.
- **Lines 33-35**: Send RegisterTaskDefinitionCommand to ECS. AWS returns the full ARN including revision number.
- **Lines 37-68**: Loop through each machine in bundle and register individual task definitions. Each machine gets its own task definition with appropriate CPU/memory limits.
- **Lines 44-45**: Resource limits from bundle (validated by DockerComposeSyncService). Ranges from 256/512 (attacker) to 2048/4096 (database servers).
- **Lines 49-51**: ECR image URI from bundle. Images are already pushed by Build Orchestration pipeline.
- **Lines 52**: Environment variables for application configuration (database passwords, feature flags, etc.).
- **Lines 53**: Container command override if specified in machine configuration.

### Key Takeaways:
- **Task Definitions are Versioned**: Each registration creates a new revision, allowing rollback if needed
- **Fargate Serverless**: No need to manage EC2 instances - AWS automatically provisions compute resources
- **Resource-Based Pricing**: CPU and memory settings directly impact cost (0.25 vCPU @ $0.04048/hour)
- **Logging is Essential**: CloudWatch Logs capture all output for troubleshooting solver issues
- **Gateway Pattern**: Single gateway task proxies to multiple backend machines in private network

---

## 4. Budget Monitoring & Cost Calculation

**File**: [backend/src/services/budget-monitor.service.ts](backend/src/services/budget-monitor.service.ts) (Lines 1-150)

**Purpose**: Track AWS usage costs in real-time, enforce monthly budget limits, and prevent overspending through automated warnings and shutdowns.

### Code Snippet:
```typescript
export interface BudgetConfig {
  dailyLimit: number; // RM per day
  monthlyLimit: number; // RM per month
  dailyWarningThreshold: number; // % of daily limit (e.g., 80)
  monthlyWarningThreshold: number; // % of monthly limit (e.g., 90)
  gracePeriodMinutes: number; // Grace period before auto-shutdown
}

export interface CostReport {
  today: number;
  thisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercentage: number;
  monthlyPercentage: number;
  projectedMonthly: number;
  runningSessionsCount: number;
  activeCost: number; // Current hourly burn rate
}

/**
 * Intelligent Budget Management Service
 * 
 * Features:
 * - Daily cost tracking with warnings (no auto-shutdown)
 * - Monthly budget enforcement with auto-shutdown
 * - Grace period before emergency shutdown
 * - Projected cost warnings
 * - Cost breakdown by scenario/user
 * - Real-time burn rate monitoring
 */
@Injectable()
export class BudgetMonitorService {
  private readonly logger = new Logger(BudgetMonitorService.name);
  private budgetConfig: BudgetConfig;
  private gracePeriodActive = false;
  private gracePeriodStartedAt?: Date;

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    private alertService: AlertService,
    private environmentService: EnvironmentService,
  ) {
    this.loadBudgetConfig();
  }

  /**
   * Load budget configuration from environment
   */
  private loadBudgetConfig() {
    this.budgetConfig = {
      dailyLimit: parseFloat(process.env.DAILY_COST_LIMIT || '20'), // RM 20/day
      monthlyLimit: parseFloat(process.env.MONTHLY_COST_LIMIT || '200'), // RM 200/month
      dailyWarningThreshold: parseFloat(process.env.DAILY_WARNING_THRESHOLD || '80'),
      monthlyWarningThreshold: parseFloat(process.env.MONTHLY_WARNING_THRESHOLD || '90'),
      gracePeriodMinutes: parseInt(process.env.BUDGET_GRACE_PERIOD || '30'), // 30 minutes
    };

    this.logger.log(`Budget config loaded: ${JSON.stringify(this.budgetConfig)}`);
  }

  /**
   * Check budget every 30 minutes
   */
  @Cron('*/30 * * * *')
  async scheduledBudgetCheck(): Promise<void> {
    this.logger.log('Running scheduled budget check...');

    try {
      const report = await this.generateCostReport();
      
      // Check daily budget (WARNING only, no shutdown)
      if (report.dailyPercentage >= this.budgetConfig.dailyWarningThreshold) {
        await this.handleDailyWarning(report);
      }

      // Check monthly budget (CRITICAL - may trigger shutdown)
      if (report.monthlyPercentage >= this.budgetConfig.monthlyWarningThreshold) {
        await this.handleMonthlyWarning(report);
      }

      // If monthly budget EXCEEDED - initiate grace period
      if (report.monthlyPercentage >= 100) {
        await this.handleBudgetExceeded(report);
      }

    } catch (error: any) {
      this.logger.error(`Budget check failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Generate comprehensive cost report
   */
  async generateCostReport(): Promise<CostReport> {
    const now = new Date();
    
    // Today's cost (midnight to now)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayCost = await this.calculatePeriodCost(todayStart, now);

    // This month's cost (1st to now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const monthCost = await this.calculatePeriodCost(monthStart, now);

    // Running sessions count
    const runningSessions = await this.sessionRepo.count({
      where: { status: 'running' },
    });

    // Calculate current hourly burn rate
    const activeCost = await this.calculateActiveBurnRate();

    // Project monthly cost based on current rate
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const projectedMonthly = (monthCost / daysElapsed) * daysInMonth;

    return {
      today: todayCost,
      thisMonth: monthCost,
      dailyLimit: this.budgetConfig.dailyLimit,
      monthlyLimit: this.budgetConfig.monthlyLimit,
      dailyPercentage: (todayCost / this.budgetConfig.dailyLimit) * 100,
      monthlyPercentage: (monthCost / this.budgetConfig.monthlyLimit) * 100,
      projectedMonthly,
      runningSessionsCount: runningSessions,
      activeCost,
    };
  }
```

### Explanation:
- **Lines 1-6**: `BudgetConfig` interface defines configurable budget parameters. All limits are in RM (Malaysian Ringgit, ~$0.24 USD per RM).
- **Lines 8-18**: `CostReport` interface provides comprehensive cost visibility including current usage, projections, and burn rate.
- **Lines 20-30**: JSDoc outlines the intelligent budget system features. Key distinction: daily limits warn but don't shutdown, monthly limits enforce shutdown.
- **Lines 36-37**: Grace period state tracking. When monthly budget is exceeded, a grace period allows admins to take action before emergency shutdown.
- **Lines 50-58**: Load budget config from environment variables with sensible defaults (RM 20/day = ~$5/day, RM 200/month = ~$50/month).
- **Lines 64**: Cron decorator schedules budget check every 30 minutes. This balances cost visibility with system overhead.
- **Lines 73-75**: Daily budget check sends warning emails/notifications but does NOT terminate sessions. Useful for early awareness.
- **Lines 77-80**: Monthly budget check at 90% threshold sends critical alerts. This gives admins time to increase budget or plan shutdown.
- **Lines 82-85**: When monthly budget is 100% exceeded, initiate grace period. After grace period expires, all sessions are automatically terminated.
- **Lines 94-97**: Calculate today's cost by summing session costs from midnight to now.
- **Lines 99-100**: Calculate month-to-date cost from 1st of month to now.
- **Lines 102-105**: Count running sessions to show current active workload.
- **Lines 107**: Calculate current hourly burn rate by summing resource profiles of all running sessions.
- **Lines 109-111**: Project end-of-month cost based on average daily spending. If projected cost exceeds budget, warnings are sent proactively.
- **Lines 113-123**: Return comprehensive cost report with percentages calculated for easy threshold comparisons.

### Key Takeaways:
- **Tiered Enforcement**: Daily limits are informational, monthly limits are enforced with shutdowns
- **Proactive Warnings**: 90% threshold warnings give admins 10% buffer to respond before hard limit
- **Grace Period Safety**: 30-minute grace period prevents immediate shutdown, allows manual intervention
- **Cost Projection**: Predictive analytics help anticipate budget exhaustion before it happens
- **Real-time Visibility**: Track current burn rate to understand if a spike is temporary or sustained

---

## 5. Health Check System

**File**: [backend/src/services/aws-health-check.service.ts](backend/src/services/aws-health-check.service.ts) (Lines 1-150)

**Purpose**: Validate AWS resources (ECR images, task definitions, VPC endpoints) exist before allowing scenario publication or solver session start.

### Code Snippet:
```typescript
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
```

### Explanation:
- **Lines 1-11**: `HealthCheckResult` provides detailed resource validation output with separate categories for errors (blocking), warnings (non-blocking), and missing resources.
- **Lines 13-18**: `SolverHealthCheckResult` is a simplified result for solvers. If `canStart=false`, the user sees `userMessage` explaining why they can't start the lab.
- **Lines 20-27**: Service responsibilities outlined - prevents deployment failures by validating resources upfront rather than failing during deployment.
- **Lines 45-47**: Construct ECR registry URL from AWS account ID and region. Format: `123456789012.dkr.ecr.ap-south-2.amazonaws.com`.
- **Lines 54-64**: Initialize result structure. Starts with `healthy=true` and is set to `false` if any critical checks fail.
- **Lines 66-74**: Load scenario version with all related machines. Machines contain ECR URIs and task definition ARNs to validate.
- **Lines 76-84**: Check 1 - Verify build completed successfully. If build failed or is in progress, scenario cannot be published.
- **Lines 86-90**: Check 2 - Verify ECR images were pushed. `ecrImagesPushed` flag is set by Build Orchestration pipeline after successful push.
- **Lines 92-98**: Handle questions-only scenarios (no machines needed). These scenarios only have questions/assets, no containers. Return healthy immediately.
- **Lines 100-117**: Check 3 - Verify each machine has an ECR URI and the image actually exists in ECR. This catches cases where:
  - Image push failed silently
  - Image was manually deleted from ECR
  - Wrong ECR registry configured
- **Lines 119-133**: Check 4 - Verify task definitions exist. Task definitions may be missing if:
  - Never registered (deployment hasn't run yet)
  - Manually deregistered from ECS
  - AWS region mismatch

### Key Takeaways:
- **Fail-Fast Validation**: Catch resource issues before solvers attempt to start sessions
- **Questions-Only Support**: Gracefully handles scenarios without machines (theory-only labs)
- **Detailed Reporting**: Provides actionable error messages so admins know exactly what to fix
- **Layered Checks**: Validates both database flags (ecrImagesPushed) AND actual AWS resources
- **Admin vs Solver**: Different health check levels - admins see full details, solvers see simplified messages

---

## 6. VPC Endpoint Management

**File**: [backend/src/services/vpc-endpoint.service.ts](backend/src/services/vpc-endpoint.service.ts) (Lines 1-150)

**Purpose**: Manage VPC endpoints for private ECR access from ECS Fargate tasks without internet gateway costs.

### Code Snippet:
```typescript
/**
 * VPC Endpoint Lifecycle Service
 * Manages creation/deletion of VPC endpoints for cost optimization
 * 
 * Use cases:
 * - Create endpoints on platform startup
 * - Delete endpoints on platform shutdown (save costs when not in use)
 * - Validate existing endpoints are properly configured
 */
@Injectable()
export class VpcEndpointService implements OnModuleInit {
  private readonly logger = new Logger(VpcEndpointService.name);
  private ec2Client: EC2Client;
  private autoManage: boolean;
  private vpcId: string;
  private subnetIds: string[];
  private endpointSecurityGroupId: string;
  private routeTableIds: string[];

  constructor(private configService: ConfigService) {
    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.ec2Client = new EC2Client({
      region: this.configService.get<string>('AWS_REGION') || 'ap-south-2',
      credentials,
    });

    this.autoManage = this.configService.get<string>('AWS_AUTO_MANAGE_ENDPOINTS') === 'true';
    this.vpcId = this.configService.get<string>('AWS_VPC_ID') || '';
    this.subnetIds = (this.configService.get<string>('AWS_ECS_SUBNET_IDS') || '').split(',');
    this.endpointSecurityGroupId = this.configService.get<string>('AWS_ENDPOINT_SECURITY_GROUP_ID') || '';
    this.routeTableIds = (this.configService.get<string>('AWS_ROUTE_TABLE_IDS') || '').split(',').filter(Boolean);
  }

  async onModuleInit() {
    if (this.autoManage) {
      this.logger.log('Auto-manage VPC endpoints is ENABLED');
      await this.ensureEndpointsExist();
    } else {
      this.logger.log('Auto-manage VPC endpoints is DISABLED - using existing endpoints');
    }
  }

  /**
   * Create all required VPC endpoints if they don't exist
   */
  async ensureEndpointsExist(): Promise<void> {
    this.logger.log('Checking VPC endpoints...');

    try {
      // Check for ECR API endpoint
      const ecrApiExists = await this.endpointExists('com.amazonaws.ap-south-2.ecr.api');
      if (!ecrApiExists) {
        this.logger.log('Creating ECR API endpoint...');
        await this.createInterfaceEndpoint(
          'com.amazonaws.ap-south-2.ecr.api',
          'rangex-ecr-api-endpoint',
        );
      }

      // Check for ECR DKR endpoint
      const ecrDkrExists = await this.endpointExists('com.amazonaws.ap-south-2.ecr.dkr');
      if (!ecrDkrExists) {
        this.logger.log('Creating ECR DKR endpoint...');
        await this.createInterfaceEndpoint(
          'com.amazonaws.ap-south-2.ecr.dkr',
          'rangex-ecr-dkr-endpoint',
        );
      }

      // Check for S3 endpoint
      const s3Exists = await this.endpointExists('com.amazonaws.ap-south-2.s3');
      if (!s3Exists) {
        this.logger.log('Creating S3 gateway endpoint...');
        await this.createGatewayEndpoint(
          'com.amazonaws.ap-south-2.s3',
          'rangex-vpce-s3',
        );
      }

      this.logger.log('All VPC endpoints are available');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure endpoints exist: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create an interface VPC endpoint (for ECR)
   */
  private async createInterfaceEndpoint(
    serviceName: string,
    tagName: string,
  ): Promise<string> {
    const command = new CreateVpcEndpointCommand({
      VpcId: this.vpcId,
      ServiceName: serviceName,
      VpcEndpointType: VpcEndpointType.Interface,
      SubnetIds: this.subnetIds,
      SecurityGroupIds: [this.endpointSecurityGroupId],
      PrivateDnsEnabled: true, // Critical for ECR
      TagSpecifications: [
        {
          ResourceType: 'vpc-endpoint',
          Tags: [
            { Key: 'Name', Value: tagName },
            { Key: 'ManagedBy', Value: 'RangeX' },
            { Key: 'Environment', Value: 'production' },
          ],
        },
      ],
    });

    const response = await this.ec2Client.send(command);
    const endpointId = response.VpcEndpoint?.VpcEndpointId || '';

    this.logger.log(`Created interface endpoint: ${endpointId} (${serviceName})`);

    return endpointId;
  }
```

### Explanation:
- **Lines 1-8**: Service manages VPC endpoint lifecycle. VPC endpoints cost ~$7/month each but save NAT Gateway costs (~$32/month). Critical for private ECR access.
- **Lines 10**: `OnModuleInit` interface ensures endpoints are created when NestJS application starts.
- **Lines 14-17**: VPC networking configuration - VPC ID, subnets for endpoint ENIs, security group for access control, and route tables for S3 gateway endpoint.
- **Lines 20-23**: AWS credentials from environment. In production, use IAM roles instead of access keys for better security.
- **Lines 30**: `autoManage` flag controls whether RangeX automatically creates/deletes endpoints. Disable if using pre-created endpoints.
- **Lines 31-34**: Load VPC networking configuration. Subnet IDs determine which availability zones can access the endpoint. Route table IDs are needed for S3 gateway endpoint routing.
- **Lines 37-44**: On application startup, check if auto-management is enabled. If yes, create missing endpoints. If no, assume endpoints already exist (created by Terraform/CloudFormation).
- **Lines 53-62**: Create ECR API endpoint if missing. This endpoint allows `docker pull` commands to authenticate with ECR. Service name includes region (ap-south-2).
- **Lines 64-72**: Create ECR DKR endpoint if missing. This endpoint allows pulling actual image layers from ECR. Both API and DKR endpoints are required for full ECR functionality.
- **Lines 74-82**: Create S3 gateway endpoint if missing. ECR stores image layers in S3, so this endpoint is required for image pulls. Gateway endpoints are free (unlike interface endpoints).
- **Lines 95-119**: Create interface VPC endpoint with specific configuration:
  - **VpcEndpointType**: Interface (creates ENI in subnets) vs Gateway (modifies route tables)
  - **SubnetIds**: Which subnets get endpoint ENIs (multi-AZ for high availability)
  - **SecurityGroupIds**: Firewall rules allowing HTTPS (port 443) traffic
  - **PrivateDnsEnabled**: Critical - allows using standard ECR DNS names (*.dkr.ecr.region.amazonaws.com) instead of VPC endpoint DNS
  - **Tags**: Metadata for cost tracking and automation

### Key Takeaways:
- **Cost Optimization**: VPC endpoints ($7/month) cheaper than NAT Gateway ($32/month) for ECR access
- **Private Networking**: Fargate tasks can pull ECR images without internet access or NAT Gateway
- **High Availability**: Endpoints created in multiple subnets for AZ redundancy
- **Private DNS**: PrivateDnsEnabled=true allows using standard ECR URLs without code changes
- **Three Endpoints Required**: ECR API (auth), ECR DKR (image layers), S3 (layer storage)
- **Automatic Management**: Service can create endpoints on startup and delete on shutdown for cost savings during downtime

---

## Summary

This document covered RangeX's AWS infrastructure implementation:

1. **AWS SDK Initialization**: Modular v3 clients with region-scoped configuration
2. **ECS Fargate Deployment**: Shared infrastructure pattern for cost efficiency (~$0.08/hour active, $0 parked)
3. **Task Definition Registration**: Versioned container specifications with resource limits
4. **Budget Monitoring**: Intelligent cost tracking with tiered warnings and grace period shutdowns
5. **Health Check System**: Proactive resource validation before publication/deployment
6. **VPC Endpoint Management**: Private ECR access without internet gateway costs

**Architecture Highlights**:
- Shared infrastructure (ECR repos, VPC endpoints) amortizes fixed costs across deployments
- Gateway proxy pattern isolates solver access while maintaining security
- Real-time cost tracking prevents budget overruns
- Health checks prevent deployment failures and improve user experience
- Automated VPC endpoint management reduces operational overhead

**Next Steps**: See [CODE_PART2_AUTH_SECURITY.md](CODE_PART2_AUTH_SECURITY.md) for authentication and authorization implementation.
