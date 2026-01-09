import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TestDeploymentService } from '../services/test-deployment.service';
import { JobQueueService } from '../services/job-queue.service';

/**
 * Admin Test Deployment Controller
 * Phase 5: Test deployment management for admins
 */
@Controller('admin/test-deployments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestDeploymentController {
  private readonly logger = new Logger(TestDeploymentController.name);

  constructor(
    private testDeploymentService: TestDeploymentService,
    private jobQueue: JobQueueService,
  ) {}

  /**
   * Create a test deployment for a scenario version
   * POST /admin/test-deployments/:versionId
   */
  @Post(':versionId')
  @Roles('admin')
  async createTestDeployment(@Param('versionId') versionId: string) {
    this.logger.log(`Admin creating test deployment for version ${versionId}`);

    try {
      // Enqueue TEST_DEPLOYMENT job
      const job = await this.jobQueue.enqueue('TEST_DEPLOYMENT', { versionId });

      return {
        success: true,
        message: 'Test deployment job enqueued',
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create test deployment: ${errorMessage}`);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to create test deployment',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get test deployment status
   * GET /admin/test-deployments/:deploymentId
   */
  @Get(':deploymentId')
  @Roles('admin')
  async getDeployment(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Admin fetching deployment ${deploymentId}`);

    try {
      const deployment = await this.testDeploymentService.getDeployment(deploymentId);

      if (!deployment) {
        throw new HttpException(
          {
            success: false,
            message: 'Test deployment not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        deployment,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch deployment: ${errorMessage}`);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch deployment',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cleanup test deployment (stop tasks)
   * DELETE /admin/test-deployments/:deploymentId
   */
  @Delete(':deploymentId')
  @Roles('admin')
  async cleanupDeployment(@Param('deploymentId') deploymentId: string) {
    this.logger.log(`Admin cleaning up deployment ${deploymentId}`);

    try {
      await this.testDeploymentService.cleanupTestDeployment(deploymentId);

      return {
        success: true,
        message: 'Test deployment cleaned up successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup deployment: ${errorMessage}`);

      throw new HttpException(
        {
          success: false,
          message: 'Failed to cleanup deployment',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
