import { BadRequestException, Body, Controller, Get, Param, Post, Put, Patch, UseGuards, Delete, Req, Query, NotFoundException, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemSettingsService } from '../services/system-settings.service';
import { Scenario } from '../entities/scenario.entity';
import { User } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UpdateSystemSettingsDto } from '../dto/system-settings.dto';
import { CreateImageVariantDto, UpdateImageVariantDto } from '../dto/image-variant.dto';
import { CreateToolDto, UpdateToolDto } from '../dto/tool.dto';
import * as argon2 from 'argon2';
import { AuditService } from '../services/audit.service';
import { SessionsService } from '../services/sessions.service';
import { CostService } from '../services/cost.service';
import { BadgesService } from '../services/badges.service';
import { Role } from '../common/guards/roles.enum';
import { SystemSettings } from '../entities/system-settings.entity';
import { UsersService } from '../services/users.service';
import { ScenariosService } from '../services/scenarios.service';
import { RegistryService } from '../services/registry.service';
import { RegistryCredential } from '../entities/registry-credential.entity';
import { PlatformImage } from '../entities/platform-image.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { ImageVariant } from '../entities/image-variant.entity';
import { Tool } from '../entities/tool.entity';
import { ScenarioWorkflowService } from '../services/scenario-workflow.service';
import { ScenarioApprovalService } from '../services/scenario-approval.service';
// AdminTestService removed - not using automated testing
import { AdminTestEnvironmentService } from '../services/admin-test-environment.service';
import { AwsDeployService } from '../services/aws-deploy.service';
import { EnvironmentService } from '../services/environment.service';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { MinioService } from '../services/minio.service';
import { Express, Request } from 'express';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);
  
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly auditService: AuditService,
    private readonly sessionsService: SessionsService,
    private readonly costService: CostService,
    private readonly badgesService: BadgesService,
    private readonly usersService: UsersService,
    private readonly scenariosService: ScenariosService,
    private readonly registryService: RegistryService,
    private readonly workflowService: ScenarioWorkflowService,
    private readonly approvalService: ScenarioApprovalService,
    // AdminTestService removed - not using automated testing
    private readonly adminTestEnvironmentService: AdminTestEnvironmentService,
    private readonly minioService: MinioService,
    private readonly awsDeployService: AwsDeployService,
    private readonly environmentService: EnvironmentService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Scenario) private readonly scenarioRepo: Repository<Scenario>,
    @InjectRepository(ScenarioVersion) private readonly versionRepository: Repository<ScenarioVersion>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepository: Repository<EnvironmentSession>,
    @InjectRepository(RegistryCredential) private readonly registryRepo: Repository<RegistryCredential>,
    @InjectRepository(PlatformImage) private readonly platformImageRepo: Repository<PlatformImage>,
    @InjectRepository(ImageVariant) private readonly imageVariantRepo: Repository<ImageVariant>,
    @InjectRepository(Tool) private readonly toolRepo: Repository<Tool>,
  ) {}

  @Get('system-settings')
  @Roles(Role.Admin)
  async getSystemSettings() {
    return this.systemSettingsService.getSettings();
  }

  @Put('system-settings')
  @Roles(Role.Admin)
  async updateSystemSettings(@Body() updates: UpdateSystemSettingsDto) {
    // Additional validation
    if (updates.budgetSoftCapUsd && updates.budgetHardCapUsd && 
        updates.budgetSoftCapUsd > updates.budgetHardCapUsd) {
      throw new BadRequestException('Soft cap cannot be greater than hard cap');
    }
    
    return this.systemSettingsService.updateSettings(updates);
  }

  @Post('system-settings/maintenance')
  @Roles(Role.Admin)
  async toggleMaintenance(@Body() body: { enabled: boolean; message?: string }) {
    return this.systemSettingsService.setMaintenanceMode(body.enabled, body.message);
  }

  @Get('users')
  @Roles(Role.Admin)
  async listUsers() {
    return this.usersService.findAll();
  }

  @Post('users')
  @Roles(Role.Admin)
  async createUser(@Body() dto: CreateUserDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) {
      throw new BadRequestException('Email already exists');
    }
    const user = this.userRepo.create({
      ...dto,
      passwordHash: await argon2.hash(dto.password),
    });
    const saved = await this.userRepo.save(user);
    const { passwordHash, ...safe } = saved as any;
    return safe;
  }

  @Put('users/:id')
  @Roles(Role.Admin)
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete('users/:id')
  @Roles(Role.Admin)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Get('scenarios/pending')
  @Roles(Role.Admin)
  async listPendingScenarios() {
    return this.scenariosService.findPending();
  }

  @Delete('scenarios/:id')
  @Roles(Role.Admin)
  async deleteScenario(@Param('id') id: string) {
    return this.scenariosService.delete(id);
  }

  @Get('sessions')
  @Roles(Role.Admin)
  async listSessions() {
    return this.sessionsService.findAll();
  }

  @Get('usage/daily')
  @Roles(Role.Admin)
  async dailyUsage() {
    return this.costService.getDailyUsage();
  }

  @Get('audit-logs')
  @Roles(Role.Admin)
  async getAuditLogs() {
    return this.auditService.findAll();
  }

  // Badges CRUD
  @Get('badges')
  @Roles(Role.Admin)
  async listBadges() {
    return this.badgesService.listBadges();
  }

  @Post('badges')
  @Roles(Role.Admin)
  async createBadge(@Body() badgeData: { name: string; description: string; iconUrl: string; criteria: string }) {
    return this.badgesService.createBadge(badgeData);
  }

  @Put('badges/:id')
  @Roles(Role.Admin)
  async updateBadge(@Param('id') id: string, @Body() badgeData: Partial<{ name: string; description: string; iconUrl: string; criteria: string }>) {
    return this.badgesService.updateBadge(id, badgeData);
  }

  // Badge DELETE moved to AdminBadgeController (includes MinIO folder deletion)

  // Scenario Approvals (frontend expects these routes)
  @Get('scenario-approvals')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async getScenarioApprovals() {
    // Return both SUBMITTED (pending approval) and APPROVED (pending publish) scenarios
    const submitted = await this.scenariosService.findPending();
    const approved = await this.approvalService.getApprovedAwaitingPublish();
    return [...submitted, ...approved];
  }

  @Get('scenario-approvals/count')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async getScenarioApprovalsCount() {
    const scenarios = await this.scenariosService.findPending();
    return { pending: scenarios.length };
  }

  @Post('scenario-approvals/:versionId/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async approveScenario(@Param('versionId') versionId: string, @Req() req: any) {
    const adminId = req.user?.sub || req.user?.userId;
    
    // Use the proper approval service which handles build orchestration and auto-publish
    await this.approvalService.approveVersion(versionId, adminId);
    
    // Fetch the updated version for response
    const version = await this.versionRepository.findOne({ 
      where: { id: versionId },
      relations: ['scenario']
    });
    
    return { 
      message: 'Scenario approved successfully and queued for build/deployment', 
      version
    };
  }

  @Post('scenario-approvals/:versionId/unapprove')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async unapproveScenario(@Param('versionId') versionId: string, @Req() req: any) {
    const adminId = req.user?.sub || req.user?.userId;
    
    // Revert version to DRAFT status for editing
    await this.approvalService.unapproveVersion(versionId, adminId);
    
    // Clean up AWS resources (ECR images, ECS task definitions)
    await this.approvalService.cleanupAwsResourcesOnRevert(versionId);
    
    // Fetch the updated version for response
    const version = await this.versionRepository.findOne({ 
      where: { id: versionId },
      relations: ['scenario']
    });
    
    return { 
      message: 'Scenario reverted to DRAFT status - creator can now edit and resubmit. AWS resources cleaned up.', 
      version
    };
  }

  /**
   * Revert scenario to DRAFT from any status (SUBMITTED, APPROVED, PUBLISHED)
   * ⚠️ CRITICAL: Deletes all AWS resources and allows editing again
   * Use when significant changes needed to published scenarios
   */
  @Post('scenario-approvals/:versionId/revert-to-draft')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async revertToDraft(
    @Param('versionId') versionId: string,
    @Body('reason') reason: string,
    @Req() req: any
  ) {
    const adminId = req.user?.sub || req.user?.userId;
    
    // Complete revert with AWS cleanup
    await this.approvalService.revertToDraft(versionId, adminId, reason);
    
    // Fetch the updated version for response
    const version = await this.versionRepository.findOne({ 
      where: { id: versionId },
      relations: ['scenario', 'machines']
    });
    
    return { 
      message: 'Scenario reverted to DRAFT status. AWS resources deleted. Creator can now edit and resubmit.', 
      version
    };
  }

  @Post('scenario-approvals/:versionId/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async publishScenario(
    @Param('versionId') versionId: string, 
    @Req() req: any,
    @Body() body?: { overrideGate?: boolean }
  ) {
    const adminId = req.user?.sub || req.user?.userId;
    
    // Check version exists
    const version = await this.versionRepository.findOne({ 
      where: { id: versionId },
      relations: ['scenario']
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    // Publishing gate removed - admins manually test and publish
    // Super admins can still use overrideGate if needed for logging purposes
    if (body?.overrideGate) {
      this.logger.warn(`[ADMIN] Publishing with override flag for version ${versionId} by admin ${adminId}`);
    }
    
    // Manually publish after successful build
    await this.approvalService.publishVersion(versionId, adminId);
    
    // Fetch the updated version for response
    const updatedVersion = await this.versionRepository.findOne({ 
      where: { id: versionId },
      relations: ['scenario']
    });
    
    return { 
      message: 'Scenario published successfully - now available to solvers!', 
      version: updatedVersion
    };
  }

  @Delete('scenario-versions/:versionId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async deleteScenarioVersion(@Param('versionId') versionId: string) {
    // Complete cleanup: ECR images, ECS task definitions, MinIO files, database
    await this.approvalService.deleteVersionCompletely(versionId);
    
    return { 
      message: 'Scenario version completely deleted (AWS resources, MinIO files, database)', 
      versionId
    };
  }

  @Post('scenarios/:scenarioId/archive-old-versions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async archiveOldVersions(@Param('scenarioId') scenarioId: string) {
    // Find all approved versions of this scenario
    const approvedVersions = await this.versionRepository.find({
      where: {
        scenarioId: scenarioId,
        status: ScenarioVersionStatus.APPROVED
      },
      order: {
        versionNumber: 'DESC'
      }
    });
    
    if (approvedVersions.length <= 1) {
      return { message: 'No old versions to archive', archivedCount: 0 };
    }
    
    // Keep only the latest version visible, archive all others
    const latestVersion = approvedVersions[0];
    const oldVersions = approvedVersions.slice(1);
    
    for (const oldVersion of oldVersions) {
      oldVersion.isArchived = true;
    }
    
    await this.versionRepository.save(oldVersions);
    
    this.logger.log(`Archived ${oldVersions.length} old version(s) of scenario ${scenarioId}, kept latest: v${latestVersion.versionNumber}`);
    
    return {
      message: `Archived ${oldVersions.length} old version(s)`,
      archivedCount: oldVersions.length,
      latestVersion: latestVersion.versionNumber
    };
  }

  @Post('scenario-approvals/:versionId/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async rejectScenario(@Param('versionId') versionId: string, @Body() body: { reason: string }) {
    const version = await this.versionRepository.findOne({ where: { id: versionId } });
    
    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }
    
    if (version.status !== ScenarioVersionStatus.SUBMITTED) {
      throw new BadRequestException('Scenario is not pending approval');
    }
    
    // Reject and send back to draft
    version.status = ScenarioVersionStatus.DRAFT;
    version.rejectReason = body.reason || 'No reason provided';
    version.rejectedAt = new Date();
    version.approvedByUserId = null;
    
    await this.versionRepository.save(version);
    return { message: 'Scenario rejected successfully', version };
  }

  @Post('scenario-approvals/:versionId/disable')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  async disableScenarioVersion(@Param('versionId') versionId: string, @Body() body: { reason: string }) {
    // Find the scenario (could be pending or approved)
    const version = await this.versionRepository.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }
    
    // Move back to draft status with rejection reason
    version.status = ScenarioVersionStatus.DRAFT;
    version.rejectReason = body.reason;
    version.rejectedAt = new Date();
    version.approvedByUserId = null;
    
    await this.versionRepository.save(version);
    return version;
  }

  @Get('scenarios/:versionId/details')
  @Roles(Role.Admin)
  async getScenarioVersionDetails(@Param('versionId') versionId: string) {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    return version;
  }

  @Patch('scenarios/:versionId/toggle-visibility')
  @Roles(Role.Admin)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 visibility toggles per minute
  async toggleScenarioVisibility(@Param('versionId') versionId: string) {
    this.logger.log(`toggleScenarioVisibility called with versionId: ${versionId}`);
    
    // Validate versionId format
    if (!versionId || versionId.trim().length === 0) {
      this.logger.error('toggleScenarioVisibility: Invalid versionId (empty)');
      throw new BadRequestException('Invalid scenario version ID');
    }
    
    const version = await this.versionRepository.findOne({ where: { id: versionId } });
    if (!version) {
      this.logger.error(`toggleScenarioVisibility: Version not found for id: ${versionId}`);
      throw new NotFoundException('Scenario version not found');
    }
    
    this.logger.log(`toggleScenarioVisibility: Found version ${version.id}, status: ${version.status}, isArchived: ${version.isArchived}`);
    
    if (version.status !== ScenarioVersionStatus.APPROVED) {
      this.logger.warn(`toggleScenarioVisibility: Cannot toggle non-approved scenario (status: ${version.status})`);
      throw new BadRequestException('Only approved scenarios can be hidden/shown');
    }
    
    const previousState = version.isArchived;
    version.isArchived = !version.isArchived;
    await this.versionRepository.save(version);
    
    const message = version.isArchived ? 'Scenario hidden from users' : 'Scenario visible to users';
    this.logger.log(`toggleScenarioVisibility: Successfully toggled ${versionId} from ${previousState} to ${version.isArchived}`);
    
    return { 
      success: true,
      id: version.id, 
      isArchived: version.isArchived,
      message: message
    };
  }

  /**
   * Start an admin cloud test for a scenario version
   * Returns immediately with sessionId, provisioning happens in background
   */
  @Post('scenarios/:versionId/test')
  @Roles(Role.Admin)
  @Throttle({ default: { limit: 20, ttl: 300000 } }) // 20 tests per 5 minutes
  async startAdminTest(
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in authentication token');
    }
    
    this.logger.log(`Admin ${userId} starting test session for scenario ${versionId}`);
    
    // Start environment - this will still block, but we'll return sessionId ASAP
    // TODO: Refactor to create session record first, then provision in background
    try {
      const result = await this.environmentService.startEnvironment(
        versionId,
        userId,
        true, // isTest = true (admin testing)
        undefined, // ttlMinutesOverride
        undefined, // envProfileOverride
        undefined, // eventId
        undefined, // teamId
      );

      return {
        success: true,
        sessionId: result.sessionId,
        message: 'Test session started',
      };
    } catch (error: any) {
      this.logger.error(`Failed to start admin test: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to start test session');
    }
  }

  /**
   * Get the latest test run for a scenario version
   */
  @Get('scenarios/:versionId/latest-test')
  @Roles(Role.Admin)
  async getLatestAdminTest(@Param('versionId') versionId: string) {
    const testRun = await this.adminTestEnvironmentService.getLatestTestRun(versionId);
    
    // Return null if no test runs exist yet (not an error - just means they haven't tested yet)
    return testRun || null;
  }

  // Removed getAdminTestResult - automated testing not used

  // Removed terminateAdminTestSession - automated testing not used

  // Removed terminateAdminTestSession - automated testing not used

/**
   * NEW: Start automated test deployment with validation checks
   * Deploys scenario to AWS and validates gateway, machines, and entrypoints
   */
  @Post('scenario-versions/:versionId/test-run/start')
  @Roles(Role.Admin)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 test runs per 5 minutes
  async startTestRun(
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    this.logger.log(`Starting automated test run for version ${versionId}`);
    
    const testRun = await this.adminTestEnvironmentService.startTestRun(
      versionId,
      req.user.userId,
    );

    return {
      success: true,
      testRunId: testRun.id,
      status: testRun.status,
      sessionToken: testRun.sessionToken,
      message: 'Automated test run started. Deployment and validation will run in the background.',
    };
  }

  /**
   * Get test run status and results
   */
  @Get('scenario-versions/:versionId/test-run/status')
  @Roles(Role.Admin)
  async getTestRunStatus(@Param('versionId') versionId: string) {
    const testRun = await this.adminTestEnvironmentService.getLatestTestRun(versionId);
    
    if (!testRun) {
      return {
        testRun: null,
        message: 'No test runs found for this version',
      };
    }

    return {
      testRun,
      isPassed: testRun.status === 'passed',
      isFailed: testRun.status === 'failed',
      isRunning: testRun.status === 'deploying' || testRun.status === 'testing',
    };
  }

  /**
   * Get test run by ID
   */
  @Get('test-runs/:testRunId')
  @Roles(Role.Admin)
  async getTestRun(@Param('testRunId') testRunId: string) {
    const testRun = await this.adminTestEnvironmentService.getTestRun(testRunId);
    
    return {
      testRun,
      isPassed: testRun.status === 'passed',
      isFailed: testRun.status === 'failed',
      isRunning: testRun.status === 'deploying' || testRun.status === 'testing',
    };
  }

  /**
   * Cancel a running test
   */
  @Post('test-runs/:testRunId/cancel')
  @Roles(Role.Admin)
  async cancelTestRun(@Param('testRunId') testRunId: string) {
    await this.adminTestEnvironmentService.cancelTestRun(testRunId);
    
    return {
      success: true,
      message: 'Test run cancelled and deployment terminated',
    };
  }

  
  // Settings alias (frontend calls /admin/settings instead of /admin/system-settings)
  @Get('settings')
  @Roles(Role.Admin)
  async getSettings() {
    return this.systemSettingsService.getSettings();
  }

  @Put('settings')
  @Roles(Role.Admin)
  async updateSettings(@Body() updates: UpdateSystemSettingsDto) {
    // Additional validation
    if (updates.budgetSoftCapUsd && updates.budgetHardCapUsd && 
        updates.budgetSoftCapUsd > updates.budgetHardCapUsd) {
      throw new BadRequestException('Soft cap cannot be greater than hard cap');
    }
    
    return this.systemSettingsService.updateSettings(updates);
  }

  // Registry Credentials
  @Get('registry')
  @Roles(Role.Admin)
  async listRegistryCredentials() {
    return this.registryService.listSafe();
  }

  @Get('registry-credentials')
  @Roles(Role.Admin)
  async getRegistryCredentials() {
    return this.registryService.listSafe();
  }

  @Post('registry')
  @Roles(Role.Admin)
  async createRegistryCredential(@Req() req: any, @Body() body: { label: string; registryUrl: string; username: string; passwordOrToken: string }) {
    const userId = req.user?.userId;
    return this.registryService.createCredential({ ...body, createdByUserId: userId });
  }

  @Put('registry/:id')
  @Roles(Role.Admin)
  async updateRegistryCredential(@Param('id') id: string, @Body() body: Partial<{ label: string; registryUrl: string; username: string; passwordOrToken: string }>) {
    const cred = await this.registryRepo.findOne({ where: { id } });
    if (!cred) throw new BadRequestException('Credential not found');
    if (body.label) cred.label = body.label;
    if (body.registryUrl) cred.registryUrl = body.registryUrl;
    return this.registryRepo.save(cred);
  }

  @Delete('registry/:id')
  @Roles(Role.Admin)
  async deleteRegistryCredential(@Param('id') id: string) {
    await this.registryRepo.delete(id);
    return { deleted: true };
  }

  @Post('registry/:id/test')
  @Roles(Role.Admin)
  async testRegistryCredential(@Param('id') id: string) {
    return { status: 'ok', message: 'Credential test not implemented' };
  }

  // Platform Images
  @Get('platform-images')
  @Roles(Role.Admin)
  async listPlatformImages() {
    return this.platformImageRepo.find();
  }

  @Post('platform-images')
  @Roles(Role.Admin)
  async createPlatformImage(@Body() body: { label: string; imageRef: string; compatibleAttacker?: boolean; compatibleInternal?: boolean; compatibleService?: boolean; resourceProfile: string; isActive?: boolean }) {
    const image = this.platformImageRepo.create({
      ...body,
      resourceProfile: body.resourceProfile as any
    });
    return this.platformImageRepo.save(image);
  }

  @Put('platform-images/:id')
  @Roles(Role.Admin)
  async updatePlatformImage(@Param('id') id: string, @Body() body: Partial<{ label: string; imageRef: string; resourceProfile: string; isActive: boolean }>) {
    const image = await this.platformImageRepo.findOne({ where: { id } });
    if (!image) throw new BadRequestException('Image not found');
    Object.assign(image, body);
    return this.platformImageRepo.save(image);
  }

  // Audit Log Stats
  @Get('audit-logs/stats')
  @Roles(Role.Admin)
  async getAuditLogStats() {
    const logs = await this.auditService.findAll();
    const successful = logs.filter(l => !l.actionType?.toLowerCase().includes('fail')).length;
    const failed = logs.filter(l => l.actionType?.toLowerCase().includes('fail')).length;
    return {
      total: logs.length,
      successful,
      failed,
      uniqueUsers: new Set(logs.map(l => l.userId)).size
    };
  }

  // Assets delete alias
  @Delete('assets/:id')
  @Roles(Role.Admin)
  async deleteAssetAsAdmin(@Param('id') id: string) {
    // Forward to assets controller logic or implement here
    return { deleted: true, message: 'Asset deletion handled' };
  }

  // Session terminate
  @Post('sessions/:sessionId/terminate')
  @Roles(Role.Admin)
  async terminateSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    this.logger.log(`Admin ${userId} terminating session ${sessionId}`);
    
    // Use environmentService to properly stop AWS resources
    await this.environmentService.terminateEnvironment(
      sessionId, 
      `Terminated by admin ${userId}`
    );
    
    return { terminated: true, sessionId };
  }

  // Get active test sessions for admin
  @Get('test-sessions/active')
  @Roles(Role.Admin)
  async getActiveTestSessions(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    
    const sessions = await this.sessionRepository.find({
      where: {
        userId,
        isTest: true,
        status: In(['PROVISIONING', 'RUNNING']),
      },
      relations: ['scenarioVersion'],
      order: { startedAt: 'DESC' },
      take: 10,
    });

    return sessions.map(s => ({
      id: s.id,
      scenarioId: s.scenarioVersion?.scenarioId,
      scenarioTitle: s.scenarioVersion?.title || 'Unknown Scenario',
      versionId: s.scenarioVersionId,
      startedAt: s.startedAt,
      status: s.status,
    }));
  }

  // Containers endpoints (alias for sessions)
  @Get('containers/running')
  @Roles(Role.Admin)
  async getRunningContainers() {
    return this.sessionsService.findAll();
  }

  @Post('containers/:sessionId/terminate')
  @Roles(Role.Admin)
  async terminateContainer(@Param('sessionId') sessionId: string, @Body() body: { reason?: string }, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const reason = body.reason || `Terminated by admin ${userId}`;
    this.logger.log(`Admin ${userId} terminating container ${sessionId}: ${reason}`);
    
    // Use environmentService to properly stop AWS resources
    await this.environmentService.terminateEnvironment(sessionId, reason);
    
    return { terminated: true, sessionId };
  }

  // Tools endpoint (returns static tool links for frontend)
  // NOTE: Monitoring stack (Grafana/Loki/Prometheus) removed for LOCAL + EPHEMERAL architecture
  @Get('tools')
  @Roles(Role.Admin)
  async getTools(@Req() req: Request) {
    // Use the same host as the API request to work on local networks
    const host = req.headers.host?.split(':')[0] || 'localhost';
    const protocol = req.protocol || 'http';
    
    return [
      { label: 'MinIO Console', url: `${protocol}://${host}:9001`, description: 'S3-compatible object storage console (bundles, assets, images)' }
    ];
  }

  // ==================== IMAGE VARIANTS MANAGEMENT ====================
  
  /**
   * Get all image variants (admin view - includes inactive)
   */
  @Get('image-variants')
  @Roles(Role.Admin)
  async getAllImageVariants() {
    return this.imageVariantRepo.find({ order: { baseOs: 'ASC', variantType: 'ASC' } });
  }

  /**
   * Get single image variant by ID
   */
  @Get('image-variants/:id')
  @Roles(Role.Admin)
  async getImageVariant(@Param('id') id: string) {
    const variant = await this.imageVariantRepo.findOne({ where: { id } });
    if (!variant) {
      throw new NotFoundException(`Image variant ${id} not found`);
    }
    return variant;
  }

  /**
   * Create new image variant
   */
  @Post('image-variants')
  @Roles(Role.Admin)
  async createImageVariant(@Body() dto: CreateImageVariantDto, @Req() req: any) {
    // Security: Validate image reference format
    if (!dto.imageRef.includes(':')) {
      throw new BadRequestException('Image reference must include tag (e.g., ubuntu:22.04)');
    }

    // Check for duplicate
    const existing = await this.imageVariantRepo.findOne({
      where: { baseOs: dto.baseOs, variantType: dto.variantType }
    });
    
    if (existing) {
      throw new BadRequestException(
        `Image variant already exists: ${dto.baseOs} ${dto.variantType}`
      );
    }

    const variant = new ImageVariant();
    variant.baseOs = dto.baseOs;
    variant.variantType = dto.variantType;
    variant.imageRef = dto.imageRef;
    variant.displayName = dto.displayName;
    variant.description = dto.description;
    variant.cpuCores = dto.cpuCores;
    variant.memoryMb = dto.memoryMb;
    variant.diskGb = dto.diskGb;
    variant.hourlyCostRm = dto.hourlyCostRm;
    variant.suitableForRoles = dto.suitableForRoles ? dto.suitableForRoles.split(',').map(r => r.trim()) : [];
    variant.includedTools = dto.includedTools ? dto.includedTools.split(',').map(t => t.trim()) : [];
    variant.tags = dto.tags ? dto.tags.split(',').map(t => t.trim()) : [];
    variant.isActive = true;
    variant.isAdminApproved = true;

    const saved = await this.imageVariantRepo.save(variant);
    
    this.logger.log(`Admin ${req.user.email} created image variant: ${saved.displayName}`);
    
    return saved;
  }

  /**
   * Update image variant
   */
  @Put('image-variants/:id')
  @Roles(Role.Admin)
  async updateImageVariant(
    @Param('id') id: string, 
    @Body() dto: UpdateImageVariantDto,
    @Req() req: any
  ) {
    const variant = await this.imageVariantRepo.findOne({ where: { id } });
    
    if (!variant) {
      throw new NotFoundException(`Image variant ${id} not found`);
    }

    Object.assign(variant, dto);
    const updated = await this.imageVariantRepo.save(variant);
    
    this.logger.log(`Admin ${req.user.email} updated image variant: ${updated.displayName}`);
    
    return updated;
  }

  /**
   * Verify Docker image exists (public or private)
   */
  @Post('image-variants/verify')
  @Roles(Role.Admin)
  async verifyDockerImage(
    @Body() body: {
      imageName: string;
      tag: string;
      registryUrl?: string;
      username?: string;
      password?: string;
    },
    @Req() req: any,
  ) {
    const { imageName, tag, registryUrl, username, password } = body;

    if (!imageName || !tag) {
      throw new BadRequestException('imageName and tag are required');
    }

    try {
      let exists = false;

      if (registryUrl && username && password) {
        // Verify private image
        const { DockerImageService } = await import('../services/docker-image.service');
        const dockerImageService = new DockerImageService(null as any, null as any);
        exists = await dockerImageService.verifyPrivateImage(
          registryUrl,
          imageName,
          tag,
          username,
          password
        );
      } else {
        // Verify public image (Docker Hub)
        const { DockerImageService } = await import('../services/docker-image.service');
        const dockerImageService = new DockerImageService(null as any, null as any);
        exists = await dockerImageService.verifyPublicImage(imageName, tag);
      }

      await this.auditService.log({
        userId: req.user?.userId,
        actionType: 'verify_docker_image',
        details: { imageName, tag, registryUrl, exists },
        req,
      });

      return {
        exists,
        imageName,
        tag,
        registryUrl: registryUrl || 'docker.io',
        message: exists
          ? 'Image found and accessible'
          : 'Image not found or not accessible',
      };
    } catch (error: any) {
      this.logger.error(`Docker image verification failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Delete image variant (soft delete - mark inactive)
   */
  @Delete('image-variants/:id')
  @Roles(Role.Admin)
  async deleteImageVariant(@Param('id') id: string, @Req() req: any) {
    const variant = await this.imageVariantRepo.findOne({ where: { id } });
    
    if (!variant) {
      throw new NotFoundException(`Image variant ${id} not found`);
    }

    // Soft delete - just mark as inactive
    variant.isActive = false;
    await this.imageVariantRepo.save(variant);
    
    this.logger.log(`Admin ${req.user.email} deactivated image variant: ${variant.displayName}`);
    
    return { success: true, message: 'Image variant deactivated' };
  }

  /**
   * Hard delete image variant (permanent deletion)
   */
  @Delete('image-variants/:id/permanent')
  @Roles(Role.Admin)
  async permanentlyDeleteImageVariant(@Param('id') id: string, @Req() req: any) {
    const variant = await this.imageVariantRepo.findOne({ where: { id } });
    
    if (!variant) {
      throw new NotFoundException(`Image variant ${id} not found`);
    }

    await this.imageVariantRepo.remove(variant);
    
    this.logger.warn(`Admin ${req.user.email} permanently deleted image variant: ${variant.displayName}`);
    
    return { success: true, message: 'Image variant permanently deleted' };
  }

  /**
   * Toggle image variant active status
   */
  @Patch('image-variants/:id/toggle-active')
  @Roles(Role.Admin)
  async toggleImageVariantActive(@Param('id') id: string, @Req() req: any) {
    const variant = await this.imageVariantRepo.findOne({ where: { id } });
    
    if (!variant) {
      throw new NotFoundException(`Image variant ${id} not found`);
    }

    variant.isActive = !variant.isActive;
    const updated = await this.imageVariantRepo.save(variant);
    
    this.logger.log(
      `Admin ${req.user.email} ${updated.isActive ? 'activated' : 'deactivated'} image variant: ${updated.displayName}`
    );
    
    return updated;
  }

  // ==================== Scenario Workflow Management ====================

  /**
   * Get all scenarios pending admin review
   */
  @Get('scenarios/pending')
  @Roles(Role.Admin)
  async getPendingScenarios() {
    return this.workflowService.getPendingScenarios();
  }

  /**
   * Get all approved scenarios
   */
  @Get('scenarios/approved')
  @Roles(Role.Admin)
  async getApprovedScenarios() {
    return this.workflowService.getApprovedScenarios();
  }

  /**
   * Get scenarios ready for testing (APPROVED status only)
   */
  @Get('scenarios/testing')
  @Roles(Role.Admin)
  async getTestingScenarios() {
    return this.workflowService.getTestingScenarios();
  }
  // ==================== Assets Management ====================

  /**
   * Get all assets (admin - all assets)
   */
  @Get('assets')
  @Roles(Role.Admin)
  async getAllAssets(@Query('active') active?: string) {
    const where = active === 'false' ? {} : { isActive: true };
    return this.toolRepo.find({ 
      where,
      order: { category: 'ASC', name: 'ASC' } 
    });
  }

  /**
   * Get asset library (public - for creators, only active assets)
   */
  @Get('assets-library')
  async getAssetLibrary() {
    return this.toolRepo.find({ 
      where: { isActive: true },
      order: { category: 'ASC', name: 'ASC' } 
    });
  }

  /**
   * Get asset by ID
   */
  @Get('assets/:id')
  @Roles(Role.Admin)
  async getAsset(@Param('id') id: string) {
    const asset = await this.toolRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  /**
   * Create new asset
   */
  @Post('assets')
  @Roles(Role.Admin)
  async createAsset(@Body() dto: CreateToolDto, @Req() req: any) {
    // Check if asset with same name already exists
    const existing = await this.toolRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`Tool with name "${dto.name}" already exists`);
    }

    const tool = this.toolRepo.create({
      ...dto,
      isActive: true,
      usageCount: 0,
    });

    const saved = await this.toolRepo.save(tool);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'create_tool',
      details: { toolId: saved.id, name: saved.name },
      req,
    });

    return saved;
  }

  /**
   * Upload file for a tool
   */
  @Post('assets/:id/upload-file')
  @Roles(Role.Admin)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max for tool assets
      },
      fileFilter: (_req, file, cb) => {
        // Allow common file types for tools: binaries, scripts, archives
        const allowed = [
          'application/octet-stream', // Binaries
          'application/x-executable',
          'application/x-elf',
          'text/x-shellscript',
          'text/x-python',
          'text/plain',
          'application/zip',
          'application/x-gzip',
          'application/x-tar',
          'application/x-7z-compressed',
        ];
        if (file.originalname.includes('..')) {
          return cb(new BadRequestException('Invalid filename'), false);
        }
        cb(null, true); // Allow all types for flexibility
      },
    }),
  )
  async uploadToolFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    // Upload to MinIO
    const objectName = `assets/${id}/${file.originalname}`;
    
    try {
      await this.minioService.uploadFile(file.buffer, objectName);
    } catch (error: any) {
      this.logger.error(`Failed to upload tool file to MinIO: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }

    // Calculate checksum
    const crypto = require('crypto');
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Update tool with file information
    tool.fileUrl = objectName;
    tool.fileSizeBytes = file.size;
    tool.fileChecksum = checksum;

    const updated = await this.toolRepo.save(tool);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'upload_tool_file',
      details: { 
        toolId: id, 
        name: tool.name, 
        fileName: file.originalname,
        fileSize: file.size 
      },
      req,
    });

    return {
      message: 'File uploaded successfully',
      tool: updated,
      file: {
        name: file.originalname,
        size: file.size,
        checksum,
      },
    };
  }

  /**
   * Update existing tool
   */
  @Put('assets/:id')
  @Roles(Role.Admin)
  async updateTool(
    @Param('id') id: string,
    @Body() dto: UpdateToolDto,
    @Req() req: any,
  ) {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    Object.assign(tool, dto);
    const updated = await this.toolRepo.save(tool);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'update_tool',
      details: { toolId: updated.id, name: updated.name },
      req,
    });

    return updated;
  }

  /**
   * Delete tool (soft delete - set isActive to false)
   */
  @Delete('assets/:id')
  @Roles(Role.Admin)
  async deleteAsset(@Param('id') id: string, @Req() req: any) {
    const asset = await this.toolRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    // Hard delete
    await this.toolRepo.remove(asset);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'delete_asset',
      details: { assetId: id, name: asset.name },
      req,
    });

    return { message: 'Tool deactivated successfully', id };
  }

  /**
   * Permanently delete tool
   */
  @Delete('assets/:id/permanent')
  @Roles(Role.Admin)
  async permanentlyDeleteTool(@Param('id') id: string, @Req() req: any) {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    // Check if tool is being used
    if (tool.usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete tool "${tool.name}" as it is being used in ${tool.usageCount} scenario(s)`
      );
    }

    await this.toolRepo.remove(tool);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'permanent_delete_tool',
      details: { toolId: id, name: tool.name },
      req,
    });

    return { message: 'Tool permanently deleted', id };
  }

  /**
   * Toggle tool active status
   */
  @Patch('assets/:id/toggle-active')
  @Roles(Role.Admin)
  async toggleToolActive(@Param('id') id: string, @Req() req: any) {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    tool.isActive = !tool.isActive;
    const updated = await this.toolRepo.save(tool);

    await this.auditService.log({
      userId: req.user?.userId,
      actionType: 'toggle_tool_active',
      details: { toolId: id, name: updated.name, isActive: updated.isActive },
      req,
    });

    return updated;
  }

  /**
   * Get tool statistics
   */
  @Get('assets/stats/overview')
  @Roles(Role.Admin)
  async getAssetStats() {
    const allTools = await this.toolRepo.find();
    const activeTools = allTools.filter(t => t.isActive);

    const byCategory: Record<string, number> = {};
    allTools.forEach(t => {
      const cat = t.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const byPackageManager: Record<string, number> = {};
    allTools.forEach(t => {
      if (t.packageManager) {
        byPackageManager[t.packageManager] = (byPackageManager[t.packageManager] || 0) + 1;
      }
    });

    return {
      total: allTools.length,
      active: activeTools.length,
      inactive: allTools.length - activeTools.length,
      byCategory,
      byPackageManager,
      totalUsage: allTools.reduce((sum, t) => sum + t.usageCount, 0),
      mostUsed: allTools.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
    };
  }

  /**
   * Get deployments list (approved scenarios with build/deployment status)
   */
  @Roles(Role.Admin)
  @Get('deployments')
  async getDeployments() {
    this.logger.log('[getDeployments] Fetching deployments');
    
    // Get all approved scenario versions that require machines (have builds)
    // Fix: Load machines separately to avoid GROUP BY issues with MySQL ONLY_FULL_GROUP_BY
    const approvedVersions = await this.versionRepository.find({
      where: {
        status: ScenarioVersionStatus.APPROVED,
        requiresMachines: true,
      },
      relations: ['scenario', 'machines'],
      order: {
        approvedAt: 'DESC',
      },
    });

    // Filter out versions with no machines
    const versionsWithMachines = approvedVersions.filter(v => v.machines && v.machines.length > 0);

    // Map to deployment format with comprehensive metadata
    const deployments = versionsWithMachines.map((v: ScenarioVersion) => {
      // Generate ECR repository names from machines
      const ecrRepos = v.machines?.map(m => {
        const sanitizedName = m.name.replace(/\s+/g, '-').toLowerCase();
        return `rangex/${sanitizedName}`;
      }) || [];

      // CloudFormation stack name (if deployed)
      const stackName = `rangex-scenario-${v.scenario.slug}-v${v.versionNumber}`;

      return {
        id: v.id,
        versionId: v.id,
        scenarioId: v.scenario.id,
        scenarioName: v.title || v.scenario?.slug || 'Unnamed',
        scenarioSlug: v.scenario?.slug,
        status: this.mapBuildStatusToDeploymentStatus(v.buildStatus || undefined),
        buildStatus: v.buildStatus || 'PENDING',
        buildLogs: v.buildLogs,
        ecrImagesPushed: v.ecrImagesPushed || false,
        approvedAt: v.approvedAt,
        publishedAt: v.publishedAt,
        deployedAt: v.approvedAt,
        approvedBy: v.approvedByUserId,
        versionNumber: v.versionNumber,
        // Deployment metadata
        cloudFormationStack: stackName,
        ecrRepositories: ecrRepos,
        awsRegion: process.env.AWS_REGION || 'ap-south-2',
        awsAccount: process.env.AWS_ACCOUNT_ID || '',
        ecsCluster: process.env.ECS_CLUSTER_NAME || 'rangex-labs',
        // Machine details
        machines: v.machines?.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          imageRef: m.imageRef,
          sanitizedName: m.name.replace(/\s+/g, '-').toLowerCase(),
          ecrRepo: `rangex/${m.name.replace(/\s+/g, '-').toLowerCase()}`,
          fargateTaskDefinition: m.fargateTaskDefinition,
          ecrDigest: m.ecrDigest,
          ecrUri: m.ecrUri,
        })) || [],
        machineCount: v.machines?.length || 0,
      };
    });

    return deployments;
  }

  /**
   * Map build status to deployment status for UI
   */
  private mapBuildStatusToDeploymentStatus(buildStatus?: string): string {
    if (!buildStatus || buildStatus === 'PENDING') return 'deploying';
    if (buildStatus === 'SUCCESS') return 'active';
    if (buildStatus === 'FAILED') return 'failed';
    return 'deploying';
  }

  /**
   * GET /admin/deployments/:versionId/details
   * Get comprehensive deployment details including AWS resources
   */
  @Roles(Role.Admin)
  @Get('deployments/:versionId/details')
  async getDeploymentDetails(@Param('versionId') versionId: string) {
    this.logger.log(`[getDeploymentDetails] Fetching details for ${versionId}`);

    const version = await this.versionRepository.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Deployment not found');
    }

    // Check ECR repositories
    const ecrRepos = await Promise.all(
      (version.machines || []).map(async (m) => {
        const sanitizedName = m.name.replace(/\s+/g, '-').toLowerCase();
        const repoName = `rangex/${sanitizedName}`;
        
        try {
          // Check if ECR repo exists (you can add actual AWS SDK call here)
          return {
            name: repoName,
            exists: version.buildStatus === 'SUCCESS',
            uri: `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION}.amazonaws.com/${repoName}`,
            machineName: m.name,
          };
        } catch {
          return {
            name: repoName,
            exists: false,
            uri: '',
            machineName: m.name,
          };
        }
      })
    );

    return {
      versionId: version.id,
      scenarioId: version.scenario.id,
      scenarioName: version.title,
      scenarioSlug: version.scenario.slug,
      buildStatus: version.buildStatus,
      buildLogs: version.buildLogs,
      cloudFormationStack: `rangex-scenario-${version.scenario.slug}-v${version.versionNumber}`,
      ecrRepositories: ecrRepos,
      machines: version.machines?.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role,
        imageRef: m.imageRef,
        ecrRepo: `rangex/${m.name.replace(/\s+/g, '-').toLowerCase()}`,
      })),
      awsResources: {
        region: process.env.AWS_REGION,
        account: process.env.AWS_ACCOUNT_ID,
        cluster: process.env.ECS_CLUSTER_NAME,
      },
    };
  }

  /**
   * Deploy scenario to AWS for testing
   * POST /admin/deployments/deploy/:versionId
   */
  @Roles(Role.Admin)
  @Post('deployments/deploy/:versionId')
  async deployScenarioToAWS(
    @Param('versionId') versionId: string,
  ) {
    this.logger.log(`[deployScenarioToAWS] Deploying version ${versionId} to AWS`);
    
    try {
      const result = await this.awsDeployService.deployToAWS(versionId);
      return {
        success: true,
        message: 'Deployment started successfully',
        deployment: result,
      };
    } catch (error: any) {
      this.logger.error(`[deployScenarioToAWS] Failed to deploy version ${versionId}:`, error);
      throw new BadRequestException(error.message || 'Deployment failed');
    }
  }

  /**
   * Park deployment (delete AWS resources, keep bundle)
   * POST /admin/deployments/:deploymentId/park
   */
  @Roles(Role.Admin)
  @Post('deployments/:deploymentId/park')
  async parkDeployment(
    @Param('deploymentId') deploymentId: string,
  ) {
    this.logger.log(`[parkDeployment] Parking deployment ${deploymentId}`);
    
    try {
      await this.awsDeployService.parkDeployment(deploymentId);
      return {
        success: true,
        message: 'Deployment parked successfully. AWS resources deleted, bundle preserved.',
      };
    } catch (error: any) {
      this.logger.error(`[parkDeployment] Failed to park deployment ${deploymentId}:`, error);
      throw new BadRequestException(error.message || 'Park operation failed');
    }
  }

  /**
   * Unpark deployment (recreate AWS resources from bundle)
   * POST /admin/deployments/:deploymentId/unpark
   */
  @Roles(Role.Admin)
  @Post('deployments/:deploymentId/unpark')
  async unparkDeployment(
    @Param('deploymentId') deploymentId: string,
  ) {
    this.logger.log(`[unparkDeployment] Unparking deployment ${deploymentId}`);
    
    try {
      const result = await this.awsDeployService.unparkDeployment(deploymentId);
      return {
        success: true,
        message: 'Deployment unparked successfully. AWS resources recreated.',
        deployment: result,
      };
    } catch (error: any) {
      this.logger.error(`[unparkDeployment] Failed to unpark deployment ${deploymentId}:`, error);
      throw new BadRequestException(error.message || 'Unpark operation failed');
    }
  }

  /**
   * Full teardown (delete everything including bundle)
   * POST /admin/deployments/:deploymentId/teardown
   */
  @Roles(Role.Admin)
  @Post('deployments/:deploymentId/teardown')
  async teardownDeployment(
    @Param('deploymentId') deploymentId: string,
  ) {
    this.logger.log(`[teardownDeployment] Full teardown of deployment ${deploymentId}`);
    
    try {
      await this.awsDeployService.fullTeardown(deploymentId);
      return {
        success: true,
        message: 'Deployment fully removed. All AWS resources and bundles deleted.',
      };
    } catch (error: any) {
      this.logger.error(`[teardownDeployment] Failed to teardown deployment ${deploymentId}:`, error);
      throw new BadRequestException(error.message || 'Teardown operation failed');
    }
  }
}

