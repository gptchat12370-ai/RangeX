import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ImagePipelineService } from '../services/image-pipeline.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/**
 * Image Pipeline Controller
 * Manages the 5-stage image deployment pipeline
 */
@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImagePipelineController {
  constructor(private readonly pipelineService: ImagePipelineService) {}

  /**
   * Creator: Submit scenario to staging (Stage 2)
   * Body is OPTIONAL - if localImageName not provided, derive from scenarioId
   */
  @Post('submit/:scenarioId')
  @Roles('creator', 'admin')
  async submitToStaging(
    @CurrentUser() user: User,
    @Param('scenarioId') scenarioId: string,
    @Body() body?: { localImageName?: string }
  ) {
    // Derive deterministic image name if not provided
    const imageName = body?.localImageName || `rangex-scenario-${scenarioId.substring(0, 8)}`;
    return await this.pipelineService.submitToStaging(
      scenarioId,
      user.id,
      imageName
    );
  }

  /**
   * Admin: Get review details (Stage 3)
   */
  @Get('review/:scenarioId')
  @Roles('admin')
  async getReviewDetails(@Param('scenarioId') scenarioId: string) {
    return await this.pipelineService.getReviewDetails(scenarioId);
  }

  /**
   * Admin: Approve and push to ECR (Stage 4)
   */
  @Post('approve/:scenarioId')
  @Roles('admin')
  async approveScenario(
    @CurrentUser() user: User,
    @Param('scenarioId') scenarioId: string
  ) {
    return await this.pipelineService.approveAndPushToECR(scenarioId, user.id);
  }

  /**
   * Admin: Reject scenario
   */
  @Post('reject/:scenarioId')
  @Roles('admin')
  async rejectScenario(
    @CurrentUser() user: User,
    @Param('scenarioId') scenarioId: string,
    @Body() body: { reason: string }
  ) {
    await this.pipelineService.rejectScenario(scenarioId, user.id, body.reason);
    return { message: 'Scenario rejected', reason: body.reason };
  }

  /**
   * Get pipeline status for a scenario
   */
  @Get('status/:scenarioId')
  @Roles('creator', 'admin')
  async getPipelineStatus(@Param('scenarioId') scenarioId: string) {
    return await this.pipelineService.getPipelineStatus(scenarioId);
  }
}
