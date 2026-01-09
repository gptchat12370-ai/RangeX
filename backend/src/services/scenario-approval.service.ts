import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { DockerComposeSyncServicePhase23 } from './docker-compose-sync-phase23.service';
import { NotificationsService } from './notifications.service';
import { BuildOrchestrationService } from './build-orchestration.service';
import { MinioService } from './minio.service';
import { AwsHealthCheckService } from './aws-health-check.service';

@Injectable()
export class ScenarioApprovalService {
  private readonly logger = new Logger(ScenarioApprovalService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    private readonly composeSync: DockerComposeSyncServicePhase23,
    private readonly notificationsService: NotificationsService,
    private readonly buildOrchestration: BuildOrchestrationService,
    private readonly configService: ConfigService,
    private readonly minioService: MinioService,
    private readonly awsHealthCheck: AwsHealthCheckService,
  ) {}

  /**
   * Submit scenario for approval (DRAFT → SUBMITTED)
   */
  async submitForApproval(versionId: string, userId: string): Promise<void> {
    this.logger.log(`Submitting version ${versionId} for approval by user ${userId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    if (version.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot submit version with status ${version.status}`);
    }

    // Validate version has machines (if requiresMachines)
    if (version.requiresMachines) {
      const machines = await this.machineRepo.find({ where: { scenarioVersionId: versionId } });
      
      // Skip network validation if no machines (allowed now)
      if (machines.length === 0) {
        this.logger.log(`Scenario ${versionId} submitted with no machines (questions/assets only)`);
      } else {
        // ⚠️ NETWORK VALIDATION: At least one machine must have a network group assigned
        const machinesWithNetwork = machines.filter(m => m.networkGroup && m.networkGroup.trim() !== '');
        
        if (machinesWithNetwork.length === 0) {
          throw new BadRequestException(
            'Cannot submit: At least one machine must be assigned to a network group. ' +
            'Please configure network groups in the Machines tab before submission.'
          );
        }

        // Validate network group naming (alphanumeric, hyphens, underscores only)
        const invalidNetworkGroups = machinesWithNetwork.filter(m => 
          !/^[a-zA-Z0-9_-]+$/.test(m.networkGroup)
        );

        if (invalidNetworkGroups.length > 0) {
          const invalidNames = invalidNetworkGroups.map(m => `${m.name}: "${m.networkGroup}"`).join(', ');
          throw new BadRequestException(
            `Cannot submit: Invalid network group names detected. Network groups must contain only letters, numbers, hyphens, and underscores. ` +
            `Invalid entries: ${invalidNames}`
          );
        }

        this.logger.log(`✅ Network validation passed: ${machinesWithNetwork.length}/${machines.length} machines have valid network groups`);
      }
    }

    // Run validation in aws_runtime mode (strict pre-publish validation)
    // Skip if no machines exist (questions/assets only scenarios)
    const machines = await this.machineRepo.find({ where: { scenarioVersionId: versionId } });
    
    if (machines.length > 0) {
      try {
        const validationResult = await this.composeSync.validateAndGenerateCompose(
          versionId,
          'aws_runtime',
        );

        // Check for critical errors (non-warnings)
        if (validationResult.warnings.some(w => this.isCriticalWarning(w))) {
          throw new BadRequestException(
            `Cannot submit: Critical validation errors exist. Please fix warnings and try again.`,
          );
        }

        // Store runtime manifest for admin review
        version.runtimeManifest = validationResult.runtimeManifest || {};
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(`Validation failed: ${message}`);
      }
    } else {
      this.logger.log(`Scenario ${versionId} has no machines - skipping docker compose validation`);
    }

    // Update status
    version.status = ScenarioVersionStatus.SUBMITTED;
    version.submittedAt = new Date();
    await this.versionRepo.save(version);

    // Notify admins
    await this.notificationsService.notify(
      'admin',
      'scenario_submitted',
      `Scenario "${version.title}" submitted for approval`,
      {
        scenarioVersionId: versionId,
        scenarioId: version.scenarioId,
        submittedBy: userId,
      },
    );

    this.logger.log(`Version ${versionId} submitted successfully`);
  }

  /**
   * Approve scenario version (SUBMITTED → APPROVED)
   * Triggers build orchestration
   */
  async approveVersion(versionId: string, adminUserId: string): Promise<void> {
    this.logger.log(`Approving version ${versionId} by admin ${adminUserId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    if (version.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot approve version with status ${version.status}`);
    }

    // Delete all previous approved/published versions of the same scenario
    await this.deletePreviousApprovedVersions(version.scenario.id, versionId);

    // CRITICAL: Cancel any pending builds for old versions
    await this.cancelPendingBuildsForScenario(version.scenario.id, versionId);

    // Check if scenario requires machines
    const hasMachines = version.machines && version.machines.length > 0;
    const needsBuild = version.requiresMachines && hasMachines;

    if (!needsBuild) {
      // No machines OR requiresMachines=false - publish immediately
      version.status = ScenarioVersionStatus.PUBLISHED;
      version.approvedAt = new Date();
      version.approvedByUserId = adminUserId;
      version.publishedAt = new Date();
      await this.versionRepo.save(version);

      this.logger.log(`Version ${versionId} published immediately (no build required - requiresMachines: ${version.requiresMachines}, hasMachines: ${hasMachines})`);
      
      // Notify creator
      const creatorId = version.scenario.createdByUserId;
      await this.notificationsService.notify(
        creatorId,
        'scenario_published',
        `Your scenario "${version.title}" has been approved and published!`,
        {
          scenarioVersionId: versionId,
          approvedBy: adminUserId,
        },
      );
      return;
    }

    // Has machines - update to APPROVED and trigger build
    version.status = ScenarioVersionStatus.APPROVED;
    version.approvedAt = new Date();
    version.approvedByUserId = adminUserId;
    await this.versionRepo.save(version);

    // Feature flags: Check if builds and auto-publish are enabled
    const enableBuilds = this.configService.get<string>('ENABLE_BUILDS', 'false').toLowerCase() === 'true';
    const autoPublish = this.configService.get<string>('AUTO_PUBLISH', 'false').toLowerCase() === 'true';

    if (!enableBuilds) {
      // Builds disabled - notify creator without triggering build
      const creatorId = version.scenario.createdByUserId;
      await this.notificationsService.notify(
        creatorId,
        'scenario_approved',
        `Your scenario "${version.title}" has been approved. Build is disabled in this environment (dev-private mode).`,
        {
          scenarioVersionId: versionId,
          approvedBy: adminUserId,
          buildsEnabled: false,
        },
      );
      this.logger.log(`Version ${versionId} approved (builds disabled)`);
      return;
    }

    // Trigger build orchestration (async, non-blocking)
    this.logger.log(`Triggering build job for version ${versionId}`);
    this.buildOrchestration.enqueueBuildJob(versionId)
      .then(() => {
        this.logger.log(`Build job completed for version ${versionId}`);
        // Auto-publish on successful build (if enabled)
        if (autoPublish) {
          return this.autoPublishAfterBuild(versionId);
        } else {
          this.logger.log(`Auto-publish disabled for version ${versionId}`);
        }
      })
      .catch(error => {
        this.logger.error(`Build job failed for version ${versionId}:`, error);
        // Optionally: revert to SUBMITTED status or set status to BUILD_FAILED
      });

    // Notify creator
    const creatorId = version.scenario.createdByUserId;
    await this.notificationsService.notify(
      creatorId,
      'scenario_approved',
      `Your scenario "${version.title}" has been approved and is being built`,
      {
        scenarioVersionId: versionId,
        approvedBy: adminUserId,
      },
    );

    this.logger.log(`Version ${versionId} approved successfully`);
  }

  /**
   * Reject scenario version (SUBMITTED → REJECTED)
   */
  async rejectVersion(
    versionId: string,
    adminUserId: string,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Rejecting version ${versionId} by admin ${adminUserId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    if (version.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot reject version with status ${version.status}`);
    }

    // Update status
    version.status = ScenarioVersionStatus.REJECTED;
    version.rejectedAt = new Date();
    version.rejectReason = reason;
    await this.versionRepo.save(version);

    // Notify creator
    const creatorId = version.scenario.createdByUserId;
    await this.notificationsService.notify(
      creatorId,
      'scenario_rejected',
      `Your scenario "${version.title}" was rejected: ${reason}`,
      {
        scenarioVersionId: versionId,
        rejectedBy: adminUserId,
        reason,
      },
    );

    this.logger.log(`Version ${versionId} rejected successfully`);
  }

  /**
   * Unapprove scenario version (APPROVED/SUBMITTED → DRAFT)
   * Allows editing by reverting to draft state
   * NOTE: This method does NOT clean up AWS resources or allow reverting PUBLISHED scenarios.
   * Use revertToDraft() for complete cleanup including PUBLISHED scenarios.
   */
  async unapproveVersion(versionId: string, adminUserId: string): Promise<void> {
    this.logger.log(`Unapproving version ${versionId} by admin ${adminUserId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    // Can only unapprove SUBMITTED or APPROVED versions (not PUBLISHED)
    if (version.status !== 'SUBMITTED' && version.status !== 'APPROVED') {
      throw new BadRequestException(
        `Cannot unapprove version with status ${version.status}. Only SUBMITTED or APPROVED versions can be reverted to DRAFT.`
      );
    }

    // If version has been built, clean up AWS resources
    if (version.buildStatus === 'SUCCESS' || version.ecrImagesPushed) {
      this.logger.log(`Version has AWS builds, cleaning up resources before reverting to DRAFT`);
      try {
        await this.cleanupAwsResourcesOnRevert(versionId);
        this.logger.log(`AWS resources cleaned up successfully`);
      } catch (error: any) {
        this.logger.error(`Failed to cleanup AWS resources: ${error?.message}`);
        throw new BadRequestException(
          `Failed to cleanup AWS resources: ${error?.message}. Please try again or contact support.`
        );
      }
    }

    // Revert to DRAFT
    version.status = ScenarioVersionStatus.DRAFT;
    version.submittedAt = null;
    version.approvedAt = null;
    version.approvedByUserId = null;
    version.buildStatus = null;
    version.ecrImagesPushed = false;
    version.fargateTaskDefinition = null;
    version.runtimeManifest = null;
    await this.versionRepo.save(version);

    // Notify creator
    const creatorId = version.scenario.createdByUserId;
    await this.notificationsService.notify(
      creatorId,
      'scenario_unapproved',
      `Scenario "${version.title}" has been reverted to DRAFT status. You can now edit and resubmit.`,
      {
        scenarioVersionId: versionId,
        unapprovedBy: adminUserId,
      },
    );

    this.logger.log(`Version ${versionId} unapproved successfully - reverted to DRAFT`);
  }

  /**
   * Revert scenario to DRAFT from any status (SUBMITTED, APPROVED, PUBLISHED)
   * ⚠️ CRITICAL: Deletes all AWS resources (ECR images, task definitions)
   * Use this when admin needs to allow creator to make significant changes to published scenarios
   * 
   * Workflow:
   * 1. Validate no active sessions exist
   * 2. Delete AWS resources (ECR images, ECS task definitions)
   * 3. Clear build metadata (ecrUri, taskDefinitionArn, runtimeManifest, buildLogs)
   * 4. Update status to DRAFT
   * 5. Clear approval/publish metadata
   * 6. Notify creator
   */
  async revertToDraft(versionId: string, adminUserId: string, reason?: string): Promise<void> {
    this.logger.log(`Reverting version ${versionId} to DRAFT by admin ${adminUserId}`);
    
    if (reason) {
      this.logger.log(`Revert reason: ${reason}`);
    }

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    // Can only revert SUBMITTED, APPROVED, or PUBLISHED (not already DRAFT or REJECTED)
    if (version.status === 'DRAFT') {
      throw new BadRequestException('Version is already in DRAFT status');
    }

    if (version.status === 'REJECTED' || version.status === 'ARCHIVED') {
      throw new BadRequestException(
        `Cannot revert ${version.status} scenario. Only SUBMITTED, APPROVED, or PUBLISHED scenarios can be reverted to DRAFT.`
      );
    }

    // ==================== VALIDATION: Check for active sessions ====================
    const activeSessions = await this.sessionRepo.find({
      where: {
        scenarioVersionId: versionId,
        status: In(['launching', 'active', 'paused', 'stopping']),
      },
    });

    if (activeSessions.length > 0) {
      throw new BadRequestException(
        `Cannot revert to DRAFT: ${activeSessions.length} active session(s) are currently using this scenario version. ` +
        `Please terminate all sessions first.`
      );
    }

    // ==================== AWS CLEANUP ====================
    try {
      await this.cleanupAwsResourcesOnRevert(versionId);
      this.logger.log(`AWS resources cleaned up successfully for version ${versionId}`);
    } catch (error: any) {
      this.logger.error(`AWS cleanup failed: ${error?.message || 'Unknown error'}`);
      // Continue with revert even if AWS cleanup fails (resources may have been manually deleted)
      this.logger.warn('Continuing with revert despite AWS cleanup errors');
    }

    // ==================== DATABASE CLEANUP ====================
    // Clear machine-level build metadata
    if (version.machines && version.machines.length > 0) {
      for (const machine of version.machines) {
        machine.ecrUri = undefined;
        machine.ecrDigest = undefined;
        machine.taskDefinitionArn = undefined;
        machine.ecrRepository = undefined; // New ECR field
        await this.machineRepo.save(machine);
      }
    }

    // Clear version-level build metadata
    version.runtimeManifest = undefined;
    version.buildLogs = undefined;
    version.buildStatus = null;
    version.ecrImagesPushed = false;

    // Clear approval/publish metadata
    version.status = ScenarioVersionStatus.DRAFT;
    version.submittedAt = null;
    version.approvedAt = null;
    version.approvedByUserId = null;
    version.publishedAt = null;

    await this.versionRepo.save(version);

    // ==================== NOTIFICATION ====================
    const creatorId = version.scenario.createdByUserId;
    const notificationMessage = reason
      ? `Scenario "${version.title}" has been reverted to DRAFT status. Reason: ${reason}. You can now edit and resubmit.`
      : `Scenario "${version.title}" has been reverted to DRAFT status. You can now edit and resubmit.`;

    await this.notificationsService.notify(
      creatorId,
      'scenario_reverted',
      notificationMessage,
      {
        scenarioVersionId: versionId,
        revertedBy: adminUserId,
        reason,
      },
    );

    this.logger.log(`✅ Version ${versionId} successfully reverted to DRAFT`);
  }

  /**
   * Get all APPROVED scenarios awaiting publish
   * Used by approval page to show scenarios with successful builds that need admin review before publishing
   */
  async getApprovedAwaitingPublish(): Promise<ScenarioVersion[]> {
    const versions = await this.versionRepo.find({
      where: { 
        status: 'APPROVED' as ScenarioVersionStatus,
        publishedAt: IsNull() // Not yet published
      },
      relations: ['scenario', 'machines'],
      order: {
        approvedAt: 'DESC'
      }
    });

    this.logger.log(`Found ${versions.length} APPROVED scenarios awaiting publish`);
    return versions;
  }

  /**
   * Publish scenario version after build completes (APPROVED → PUBLISHED)
   * Called automatically after successful build
   */
  private async autoPublishAfterBuild(versionId: string): Promise<void> {
    this.logger.log(`Auto-publishing version ${versionId} after successful build`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      this.logger.error(`Version ${versionId} not found for auto-publish`);
      return;
    }

    if (version.status !== 'APPROVED') {
      this.logger.warn(`Cannot auto-publish version ${versionId} with status ${version.status}`);
      return;
    }

    // CRITICAL: Verify buildStatus is SUCCESS (not just logs exist)
    if (version.buildStatus !== 'SUCCESS') {
      this.logger.error(`Cannot auto-publish ${versionId}: buildStatus=${version.buildStatus} (must be SUCCESS)`);
      return;
    }

    // Verify runtime manifest exists
    if (!version.runtimeManifest) {
      this.logger.error(`Cannot auto-publish ${versionId}: Runtime manifest missing`);
      return;
    }

    // Verify ALL machines have ECR digests (confirms all builds succeeded)
    if (version.machines && version.machines.length > 0) {
      const missingDigests = version.machines.filter(m => !m.ecrDigest);
      if (missingDigests.length > 0) {
        this.logger.error(
          `Cannot auto-publish ${versionId}: ${missingDigests.length} machines missing ECR digests: ${missingDigests.map(m => m.name).join(', ')}`
        );
        return;
      }
    }

    // Update status
    version.status = ScenarioVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await this.versionRepo.save(version);

    // Notify creator
    const creatorId = version.scenario.createdByUserId;
    await this.notificationsService.notify(
      creatorId,
      'scenario_published',
      `Your scenario "${version.title}" is now published and available to solvers!`,
      {
        scenarioVersionId: versionId,
        publishedAt: version.publishedAt,
      },
    );

    this.logger.log(`Version ${versionId} auto-published successfully`);
  }

  /**
   * Helper to determine if a warning is critical (blocks submission)
   */
  private isCriticalWarning(warning: string): boolean {
    const criticalPatterns = [
      /too many machines/i,
      /forbidden/i,
      /blocked/i,
      /docker.sock/i,
      /privileged/i,
    ];

    return criticalPatterns.some(pattern => pattern.test(warning));
  }

  /**
   * Delete all previous approved versions of a scenario (keep only the latest)
   * This is called before approving a new version to ensure only one approved version exists
   */
  private async deletePreviousApprovedVersions(scenarioId: string, newVersionId: string): Promise<void> {
    this.logger.log(`Deleting previous approved/published versions for scenario ${scenarioId}, keeping ${newVersionId}`);
    
    // Find all approved OR published versions for this scenario except the new one
    const oldVersions = await this.versionRepo.find({
      where: [
        {
          scenario: { id: scenarioId },
          status: ScenarioVersionStatus.APPROVED,
        },
        {
          scenario: { id: scenarioId },
          status: ScenarioVersionStatus.PUBLISHED,
        },
      ],
    });

    // Filter out the version we're about to approve
    const versionsToDelete = oldVersions.filter(v => v.id !== newVersionId);

    if (versionsToDelete.length === 0) {
      this.logger.log('No previous approved/published versions to delete');
      return;
    }

    this.logger.log(`Found ${versionsToDelete.length} previous versions to delete`);

    // Delete each version and its assets from MinIO
    for (const version of versionsToDelete) {
      try {
        // CRITICAL: Delete associated machines FIRST to avoid foreign key constraint violation
        const machines = await this.machineRepo.find({
          where: { scenarioVersionId: version.id }
        });
        
        if (machines.length > 0) {
          await this.machineRepo.remove(machines);
          this.logger.log(`Deleted ${machines.length} machines for version ${version.id}`);
        }

        // Delete cover image from MinIO if exists
        if (version.coverImageUrl) {
          try {
            await this.minioService.deleteFile(version.coverImageUrl);
            this.logger.log(`Deleted cover image for version ${version.id}`);
          } catch (err: any) {
            this.logger.warn(`Failed to delete cover image for version ${version.id}: ${err?.message || 'Unknown error'}`);
          }
        }

        // Delete docker-compose file from MinIO if exists
        if (version.dockerComposePath) {
          try {
            await this.minioService.deleteFile(version.dockerComposePath);
            this.logger.log(`Deleted docker-compose for version ${version.id}`);
          } catch (err: any) {
            this.logger.warn(`Failed to delete docker-compose for version ${version.id}: ${err?.message || 'Unknown error'}`);
          }
        }

        // Delete the version from database
        await this.versionRepo.remove(version);
        this.logger.log(`Deleted version ${version.id} (v${version.versionNumber}) from database`);
      } catch (err: any) {
        this.logger.error(`Error deleting version ${version.id}: ${err?.message || 'Unknown error'}`);
        // Continue with other versions even if one fails
      }
    }

    this.logger.log(`Successfully cleaned up ${versionsToDelete.length} old versions`);
  }

  /**
   * Cancel pending builds for old versions of a scenario
   * This prevents resource waste when approving a new version
   */
  private async cancelPendingBuildsForScenario(scenarioId: string, excludeVersionId: string): Promise<void> {
    try {
      const oldVersions = await this.versionRepo.find({
        where: { 
          scenario: { id: scenarioId },
          buildStatus: 'PENDING' // Only cancel pending builds
        }
      });

      const versionsToCancel = oldVersions.filter(v => v.id !== excludeVersionId);

      for (const version of versionsToCancel) {
        try {
          version.buildStatus = 'CANCELLED';
          version.buildLogs = (version.buildLogs || '') + '\n\n[CANCELLED] Build cancelled because a newer version (v' + 
            excludeVersionId + ') was approved.';
          await this.versionRepo.save(version);
          this.logger.log(`Cancelled pending build for version ${version.id} (v${version.versionNumber})`);
        } catch (err: any) {
          this.logger.warn(`Failed to cancel build for version ${version.id}: ${err?.message || 'Unknown error'}`);
        }
      }

      if (versionsToCancel.length > 0) {
        this.logger.log(`Cancelled ${versionsToCancel.length} pending builds for scenario ${scenarioId}`);
      }
    } catch (err: any) {
      this.logger.error(`Error cancelling pending builds: ${err?.message || 'Unknown error'}`);
      // Don't throw - cancellation is best-effort
    }
  }

  /**
   * Manually publish a scenario after successful build (ADMIN ACTION)
   * This allows admin to verify the build before making it available to solvers
   */
  async publishVersion(versionId: string, adminUserId: string): Promise<void> {
    this.logger.log(`Admin ${adminUserId} manually publishing version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['scenario', 'machines'],
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot publish: Version status is ${version.status}, must be APPROVED`);
    }

    // Verify build completed successfully
    if (version.buildStatus !== 'SUCCESS') {
      throw new BadRequestException(`Cannot publish: Build status is ${version.buildStatus}, must be SUCCESS`);
    }

    // ✅ CRITICAL: Run comprehensive health check before publishing
    this.logger.log(`[PUBLISH] Running health check for version ${versionId}...`);
    const healthCheck = await this.awsHealthCheck.checkPublishReadiness(versionId);

    if (!healthCheck.healthy) {
      const errorMessage = [
        'Cannot publish: Health check failed',
        '',
        '❌ Errors:',
        ...healthCheck.errors.map(e => `  - ${e}`),
        '',
        '❌ Missing Resources:',
        ...healthCheck.missing.map(m => `  - ${m}`),
      ];

      if (healthCheck.warnings.length > 0) {
        errorMessage.push('');
        errorMessage.push('⚠️ Warnings:');
        errorMessage.push(...healthCheck.warnings.map(w => `  - ${w}`));
      }

      this.logger.error(errorMessage.join('\n'));
      throw new BadRequestException(errorMessage.join('\n'));
    }

    if (healthCheck.warnings.length > 0) {
      this.logger.warn(
        `[PUBLISH] Health check passed with warnings for version ${versionId}:\n${healthCheck.warnings.map(w => `  - ${w}`).join('\n')}`
      );
    }

    // Verify runtime manifest exists (confirms deployment artifacts ready)
    if (!version.runtimeManifest) {
      throw new BadRequestException('Cannot publish: Runtime manifest missing. Build may not have completed properly.');
    }

    // Update status to PUBLISHED
    version.status = ScenarioVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await this.versionRepo.save(version);

    this.logger.log(`✅ Version ${versionId} published successfully by admin ${adminUserId}`);

    // Notify creator
    const creatorId = version.scenario.createdByUserId;
    await this.notificationsService.notify(
      creatorId,
      'scenario_published',
      `Your scenario "${version.title}" has been published and is now available to solvers!`,
      {
        scenarioVersionId: versionId,
        publishedAt: version.publishedAt,
      },
    );
  }

  /**
   * Clean up AWS resources when reverting to draft
   * Deletes: ECS task definitions, ECR images (if ecrImagesPushed=true)
   */
  async cleanupAwsResourcesOnRevert(versionId: string): Promise<void> {
    this.logger.log(`Cleaning up AWS resources for version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['machines'],
    });

    if (!version) {
      this.logger.warn(`Version ${versionId} not found for cleanup`);
      return;
    }

    try {
      // Delete ECR images if they were pushed
      if (version.ecrImagesPushed && version.machines && version.machines.length > 0) {
        const { ECRClient, BatchDeleteImageCommand } = await import('@aws-sdk/client-ecr');
        const ecrClient = new ECRClient({ 
          region: this.configService.get<string>('AWS_REGION', 'ap-south-2') 
        });

        // New ECR naming: rangex/{base-image}:scenario-{scenarioId}
        // Multiple machines may share the same base image repository
        const deletedRepos = new Set<string>();

        for (const machine of version.machines) {
          if (machine.ecrRepository) {
            // ecrRepository format: "rangex/web-dvwa:scenario-abc123"
            const [repositoryWithRegistry, tag] = machine.ecrRepository.split(':');
            const repositoryName = repositoryWithRegistry.replace(/^[^/]+\//, ''); // Remove registry prefix if present
            
            // Skip if we already deleted this tag from this repository
            const repoKey = `${repositoryName}:${tag}`;
            if (deletedRepos.has(repoKey)) {
              continue;
            }

            try {
              await ecrClient.send(new BatchDeleteImageCommand({
                repositoryName,
                imageIds: [{ imageTag: tag }],
              }));
              this.logger.log(`Deleted ECR image ${repositoryName}:${tag} for machine ${machine.name}`);
              deletedRepos.add(repoKey);
            } catch (err: any) {
              this.logger.warn(`Failed to delete ECR image ${repositoryName}:${tag}: ${err?.message || 'Unknown error'}`);
            }
          }
        }
      }

      // Delete ECS task definitions (one per machine in Phase 2 architecture)
      const taskDefsToDelete: string[] = [];
      
      // Collect task definitions from machines
      if (version.machines && version.machines.length > 0) {
        for (const machine of version.machines) {
          if (machine.fargateTaskDefinition) {
            taskDefsToDelete.push(machine.fargateTaskDefinition);
          }
        }
      }
      
      // Also check legacy scenario-level task definition (if exists)
      if (version.fargateTaskDefinition) {
        taskDefsToDelete.push(version.fargateTaskDefinition);
      }

      // Deregister all task definitions
      if (taskDefsToDelete.length > 0) {
        const { ECSClient, DeregisterTaskDefinitionCommand } = await import('@aws-sdk/client-ecs');
        const ecsClient = new ECSClient({ 
          region: this.configService.get<string>('AWS_REGION', 'ap-south-2') 
        });

        for (const taskDefArn of taskDefsToDelete) {
          try {
            await ecsClient.send(new DeregisterTaskDefinitionCommand({
              taskDefinition: taskDefArn,
            }));
            this.logger.log(`Deregistered ECS task definition: ${taskDefArn}`);
          } catch (err: any) {
            this.logger.warn(`Failed to deregister task definition ${taskDefArn}: ${err?.message || 'Unknown error'}`);
          }
        }
      }

      this.logger.log(`AWS resources cleaned up for version ${versionId}`);
    } catch (error: any) {
      this.logger.error(`Error cleaning up AWS resources for ${versionId}: ${error?.message || 'Unknown error'}`);
      // Don't throw - cleanup is best-effort
    }
  }

  /**
   * Complete cleanup when deleting a scenario version
   * Validates: No active sessions, checks for builds
   * Deletes: ECR images, ECS task definitions, MinIO files, database records
   */
  async deleteVersionCompletely(versionId: string): Promise<void> {
    this.logger.log(`Completely deleting version ${versionId}`);

    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['machines', 'assets'],
    });

    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found`);
    }

    // ==================== VALIDATION PHASE ====================
    
    // 1. Check for active sessions using this version
    const activeSessions = await this.sessionRepo.find({
      where: { 
        scenarioVersionId: versionId,
        status: In(['launching', 'active', 'paused', 'stopping'])
      },
    });

    if (activeSessions.length > 0) {
      throw new BadRequestException(
        `Cannot delete version: ${activeSessions.length} active session(s) are currently using this version. Please terminate all sessions first.`
      );
    }

    // 2. Check if version has builds (warn but allow deletion with cleanup)
    const hasBuild = version.fargateTaskDefinition || 
                    version.ecrImagesPushed || 
                    (version.machines && version.machines.some(m => m.fargateTaskDefinition));

    if (hasBuild) {
      this.logger.warn(`Version ${versionId} has AWS builds - will clean up task definitions and ECR images`);
    }

    // ==================== AWS CLEANUP PHASE ====================


    try {
      // 1. Clean up AWS resources
      await this.cleanupAwsResourcesOnRevert(versionId);

      // 2. Delete MinIO files
      if (version.coverImageUrl) {
        try {
          await this.minioService.deleteFile(version.coverImageUrl);
          this.logger.log(`Deleted cover image from MinIO`);
        } catch (err: any) {
          this.logger.warn(`Failed to delete cover image: ${err?.message || 'Unknown error'}`);
        }
      }

      if (version.dockerComposePath) {
        try {
          await this.minioService.deleteFile(version.dockerComposePath);
          this.logger.log(`Deleted docker-compose from MinIO`);
        } catch (err: any) {
          this.logger.warn(`Failed to delete docker-compose: ${err?.message || 'Unknown error'}`);
        }
      }

      if (version.bundlePath) {
        try {
          await this.minioService.deleteFile(version.bundlePath);
          this.logger.log(`Deleted bundle from MinIO`);
        } catch (err: any) {
          this.logger.warn(`Failed to delete bundle: ${err?.message || 'Unknown error'}`);
        }
      }

      // 3. Delete all assets from MinIO
      if (version.assets && version.assets.length > 0) {
        for (const asset of version.assets) {
          if (asset.minioPath) {
            try {
              await this.minioService.deleteFile(asset.minioPath);
              this.logger.log(`Deleted asset ${asset.fileName} from MinIO`);
            } catch (err: any) {
              this.logger.warn(`Failed to delete asset ${asset.fileName}: ${err?.message || 'Unknown error'}`);
            }
          }
        }
      }

      // 4. Delete machines FIRST (to avoid foreign key constraint)
      if (version.machines && version.machines.length > 0) {
        this.logger.log(`Deleting ${version.machines.length} machines for version ${versionId}`);
        for (const machine of version.machines) {
          await this.machineRepo.remove(machine);
        }
        this.logger.log(`Deleted all machines for version ${versionId}`);
      }

      // 5. Delete database record (version)
      await this.versionRepo.remove(version);
      this.logger.log(`Deleted version ${versionId} from database`);

      this.logger.log(`Version ${versionId} completely deleted`);
    } catch (error: any) {
      this.logger.error(`Error completely deleting version ${versionId}: ${error?.message || 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get approval status for a version
   */
  async getApprovalStatus(versionId: string): Promise<{
    status: string;
    submittedAt?: Date;
    approvedAt?: Date;
    publishedAt?: Date;
    rejectedAt?: Date;
    rejectReason?: string;
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
    canUnapprove: boolean;
    canPublish: boolean;
  }> {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    const canUnapprove = (version.status === 'SUBMITTED' || version.status === 'APPROVED') && 
                          version.buildStatus !== 'SUCCESS' && version.buildStatus !== 'RUNNING';

    return {
      status: version.status,
      submittedAt: version.submittedAt ?? undefined,
      approvedAt: version.approvedAt ?? undefined,
      publishedAt: version.publishedAt ?? undefined,
      rejectedAt: version.rejectedAt ?? undefined,
      rejectReason: version.rejectReason ?? undefined,
      canSubmit: version.status === 'DRAFT',
      canApprove: version.status === 'SUBMITTED',
      canReject: version.status === 'SUBMITTED',
      canUnapprove,
      canPublish: version.status === 'APPROVED' && version.buildStatus === 'SUCCESS',
    };
  }
}
