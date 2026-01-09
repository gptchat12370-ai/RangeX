import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { SubmissionValidationService } from './submission-validation.service';
import { ImageScanService } from './image-scan.service';
import { TestDeploymentService } from './test-deployment.service';

/**
 * Job Worker Service
 * Processes background jobs from the database queue
 * Phase 3: VALIDATE_SUBMISSION ✅
 * Phase 4: SCAN_SUBMISSION ✅
 * Phase 5: TEST_DEPLOYMENT ✅
 */
@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5000; // 5 seconds
  private readonly MAX_CONCURRENT_JOBS = 3;
  private activeJobs = 0;

  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly validationService: SubmissionValidationService,
    private readonly imageScanService: ImageScanService,
    private readonly testDeploymentService: TestDeploymentService,
  ) {}

  /**
   * Start job worker when module initializes
   */
  async onModuleInit() {
    this.logger.log('Job worker starting...');
    this.start();
  }

  /**
   * Stop job worker when module destroys
   */
  async onModuleDestroy() {
    this.logger.log('Job worker stopping...');
    this.stop();
  }

  /**
   * Start polling for jobs
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Job worker already running');
      return;
    }

    this.isRunning = true;
    this.logger.log(`Job worker started. Polling every ${this.POLL_INTERVAL_MS}ms`);
    
    // Start polling loop
    this.pollInterval = setInterval(() => this.processJobs(), this.POLL_INTERVAL_MS);
  }

  /**
   * Stop polling for jobs
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.logger.log('Job worker stopped');
  }

  /**
   * Process available jobs from the queue
   */
  private async processJobs() {
    if (!this.isRunning) return;

    try {
      // Don't exceed max concurrent jobs
      const availableSlots = this.MAX_CONCURRENT_JOBS - this.activeJobs;
      if (availableSlots <= 0) {
        return;
      }

      // Dequeue jobs
      for (let i = 0; i < availableSlots; i++) {
        const job = await this.jobQueue.dequeue();
        
        if (!job) {
          break; // No more jobs available
        }

        // Process job asynchronously
        this.activeJobs++;
        this.handleJob(job)
          .catch((error) => {
            this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
          })
          .finally(() => {
            this.activeJobs--;
          });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in job processing loop: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Handle a single job
   */
  private async handleJob(job: any): Promise<void> {
    this.logger.log(`Processing job ${job.id} (type: ${job.type})`);

    try {
      switch (job.type) {
        case 'VALIDATE_SUBMISSION':
          await this.handleValidationJob(job);
          break;

        case 'SCAN_SUBMISSION':
          await this.handleScanJob(job);
          break;

        case 'TEST_DEPLOYMENT':
          await this.handleTestDeploymentJob(job);
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.type}`);
          await this.jobQueue.fail(job.id, `Unknown job type: ${job.type}`);
          return;
      }

      // Mark job as completed
      await this.jobQueue.complete(job.id, { success: true });
      this.logger.log(`Job ${job.id} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Job ${job.id} failed: ${errorMessage}`, errorStack);
      
      // Retry or fail
      const shouldRetry = job.attempts < 3;
      if (shouldRetry) {
        await this.jobQueue.retry(job.id);
      } else {
        await this.jobQueue.fail(job.id, errorMessage);
      }
    }
  }

  /**
   * Handle VALIDATE_SUBMISSION job
   * Phase 2: Policy validation checks
   */
  private async handleValidationJob(job: any): Promise<void> {
    const { versionId } = job.payload;
    
    if (!versionId) {
      throw new Error('Missing versionId in job payload');
    }

    this.logger.log(`Validating submission for version ${versionId}`);
    
    // Run validation
    const report = await this.validationService.validateSubmission(versionId);
    
    this.logger.log(
      `Validation for ${versionId}: ${report.passed ? 'PASSED' : 'FAILED'} ` +
      `(${report.hardBlocks.length} blocks, ${report.warnings.length} warnings)`,
    );
  }

  /**
   * Handle SCAN_SUBMISSION job
   * Phase 4: Security scanning with Trivy
   */
  private async handleScanJob(job: any): Promise<void> {
    const { versionId } = job.payload;
    
    if (!versionId) {
      throw new Error('Missing versionId in job payload');
    }

    this.logger.log(`Scanning images for version ${versionId}`);
    
    try {
      const scanReport = await this.imageScanService.scanSubmission(versionId);
      
      const totalVulns = Object.values(scanReport.images).reduce(
        (sum, img) => sum + img.summary.total,
        0,
      );
      
      const criticalCount = Object.values(scanReport.images).reduce(
        (sum, img) => sum + img.summary.critical,
        0,
      );
      
      const highCount = Object.values(scanReport.images).reduce(
        (sum, img) => sum + img.summary.high,
        0,
      );

      this.logger.log(
        `Scan for ${versionId}: ${totalVulns} vulns (${criticalCount} critical, ${highCount} high)`,
      );

      // For security labs, vulnerabilities don't block approval
      // Status updated to ready_for_review in imageScanService
    } catch (error) {
      this.logger.error(
        `Scan failed for ${versionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle TEST_DEPLOYMENT job
   * Phase 5: Deploy to Fargate for testing
   */
  private async handleTestDeploymentJob(job: any): Promise<void> {
    const { versionId } = job.payload;
    
    if (!versionId) {
      throw new Error('Missing versionId in job payload');
    }

    this.logger.log(`Creating test deployment for version ${versionId}`);
    
    try {
      // Create test deployment (this starts async execution)
      const deployment = await this.testDeploymentService.createTestDeployment(versionId);
      
      this.logger.log(
        `Test deployment ${deployment.id} created for version ${versionId}`,
      );
      
      // Job completes immediately - deployment runs asynchronously
      // Client can monitor progress via WebSocket
    } catch (error) {
      this.logger.error(
        `Test deployment failed for ${versionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
