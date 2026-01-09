import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreatorEnvironmentService } from '../services/creator-environment.service';
import { ImageVariantService } from '../services/image-variant.service';
import { DockerComposeSyncService } from '../services/docker-compose-sync.service';
import { DockerComposeSyncServicePhase23 } from '../services/docker-compose-sync-phase23.service';
import { CreateMachineDto } from '../dto/create-machine.dto';

@Controller('creator/environment')
@UseGuards(AuthGuard('jwt'))
export class CreatorEnvironmentController {
  constructor(
    private readonly environmentService: CreatorEnvironmentService,
    private readonly imageVariantService: ImageVariantService,
    private readonly composeSync: DockerComposeSyncService,
    private readonly composeSyncPhase23: DockerComposeSyncServicePhase23,
  ) {}

  /**
   * Get all active image variants
   */
  @Get('image-variants')
  async getImageVariants() {
    return this.imageVariantService.getActiveVariants();
  }

  /**
   * Get variants filtered by role
   */
  @Get('image-variants/role/:role')
  async getVariantsByRole(@Param('role') role: string) {
    return this.imageVariantService.getVariantsByRole(role as any);
  }

  /**
   * Get variants by base OS
   */
  @Get('image-variants/os/:os')
  async getVariantsByOs(@Param('os') os: string) {
    return this.imageVariantService.getVariantsByBaseOs(os);
  }

  /**
   * Get specific variant details
   */
  @Get('image-variants/:id')
  async getVariantDetails(@Param('id') id: string) {
    return this.imageVariantService.getVariantById(id);
  }

  /**
   * Get cost optimization suggestions
   */
  @Get('image-variants/:id/optimize')
  async getCostOptimization(@Param('id') id: string) {
    return this.imageVariantService.getCostOptimizationSuggestions(id);
  }

  /**
   * Calculate total cost for multiple variants
   */
  @Post('image-variants/calculate-cost')
  async calculateCost(@Body() body: { variantIds: string[] }) {
    return this.imageVariantService.calculateTotalCost(body.variantIds);
  }

  /**
   * Get variant statistics (admin only)
   */
  @Get('image-variants/stats/overview')
  async getVariantStatistics() {
    return this.imageVariantService.getVariantStatistics();
  }

  /**
   * Get all machines for a scenario version
   */
  @Get('scenario/:scenarioVersionId/machines')
  async getMachines(@Param('scenarioVersionId') scenarioVersionId: string) {
    return this.environmentService.getMachinesByScenarioVersion(
      scenarioVersionId
    );
  }

  /**
   * Create machine in scenario
   */
  @Post('scenario/:scenarioVersionId/machines')
  async createMachine(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() dto: CreateMachineDto,
    @Req() req: any
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.environmentService.createMachine(
      scenarioVersionId,
      dto,
      userId
    );
  }

  /**
   * Delete machine
   */
  @Delete('machines/:id')
  async deleteMachine(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    await this.environmentService.deleteMachine(id, userId);
    return { success: true, message: 'Machine deleted successfully' };
  }

  /**
   * Generate docker-compose from machines (LEGACY - redirects to auto-sync)
   * @deprecated Use auto-sync endpoint instead
   */
  @Post('scenario/:scenarioVersionId/generate-compose')
  async generateCompose(
    @Param('scenarioVersionId') scenarioVersionId: string
  ) {
    // Redirect to auto-sync service
    return this.composeSync.validateAndGenerateCompose(scenarioVersionId, 'local_compose');
  }

  /**
   * Auto-sync: Validate + Generate + Auto-correct compose
   * This is the primary endpoint for saving machines
   */
  @Post('scenario/:scenarioVersionId/auto-sync')
  async autoSyncCompose(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() body?: { mode?: 'local_compose' | 'aws_runtime' }
  ) {
    const mode = body?.mode || 'local_compose';
    return this.composeSync.validateAndGenerateCompose(scenarioVersionId, mode);
  }

  /**
   * Phase 2-3 Auto-sync with full creator configurability
   * Supports: env vars, commands, healthchecks, dependencies, solver hints, attacker bootstrap
   */
  @Post('scenario/:scenarioVersionId/auto-sync-v2')
  async autoSyncComposeV2(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() body?: { mode?: 'local_compose' | 'aws_runtime' }
  ) {
    const mode = body?.mode || 'local_compose';
    return this.composeSyncPhase23.validateAndGenerateCompose(scenarioVersionId, mode);
  }

  /**
   * Validate environment-compose synchronization
   */
  @Post('scenario/:scenarioVersionId/validate-sync')
  async validateSync(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() body: { dockerCompose: string }
  ) {
    return this.environmentService.validateEnvironmentComposeSync(
      scenarioVersionId,
      body.dockerCompose
    );
  }

  /**
   * Get cost estimate for scenario
   */
  @Get('scenario/:scenarioVersionId/cost-estimate')
  async getCostEstimate(
    @Param('scenarioVersionId') scenarioVersionId: string
  ) {
    const machines =
      await this.environmentService.getMachinesByScenarioVersion(
        scenarioVersionId
      );

    // Since Machine doesn't store variant ID directly, we calculate based on resource profile
    // This is a simplified cost estimate
    let totalCostPerHour = 0;
    
    for (const machine of machines) {
      const resources = this.getResourcesFromProfile(machine.resourceProfile);
      totalCostPerHour += resources.estimatedCostPerHour;
    }

    return {
      machineCount: machines.length,
      hourly: parseFloat(totalCostPerHour.toFixed(4)),
      daily: parseFloat((totalCostPerHour * 24).toFixed(2)),
      monthly: parseFloat((totalCostPerHour * 24 * 30).toFixed(2)),
    };
  }

  /**
   * Helper to get resources from profile
   */
  private getResourcesFromProfile(profile: string): {
    cpuCores: number;
    memoryMb: number;
    estimatedCostPerHour: number;
  } {
    const profiles: Record<string, { cpuCores: number; memoryMb: number; estimatedCostPerHour: number }> = {
      micro: { cpuCores: 0.25, memoryMb: 512, estimatedCostPerHour: 0.03 },
      small: { cpuCores: 0.5, memoryMb: 1024, estimatedCostPerHour: 0.06 },
      medium: { cpuCores: 1.0, memoryMb: 2048, estimatedCostPerHour: 0.12 },
      large: { cpuCores: 2.0, memoryMb: 4096, estimatedCostPerHour: 0.24 },
    };

    return profiles[profile] || profiles.small;
  }

  /**
   * Test Docker connection
   */
  @Post('docker/test-connection')
  async testDockerConnection(
    @Body() body: { dockerHost: string; useTLS: boolean }
  ) {
    return this.environmentService.testDockerConnection(body.dockerHost, body.useTLS);
  }

  /**
   * Save docker-compose to MinIO
   */
  @Post('scenario/:scenarioVersionId/save-compose')
  async saveDockerCompose(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() body: { dockerCompose: string }
  ) {
    return this.environmentService.saveDockerComposeToMinIO(scenarioVersionId, body.dockerCompose);
  }

  /**
   * Load docker-compose from MinIO (by versionId)
   */
  @Get('scenario/:scenarioVersionId/docker-compose')
  async loadDockerCompose(
    @Param('scenarioVersionId') scenarioVersionId: string
  ) {
    return this.environmentService.loadDockerComposeFromMinIO(scenarioVersionId);
  }

  /**
   * Load docker-compose for latest version of scenario (ALIAS for frontend)
   * Frontend calls: GET /api/creator/scenarios/:scenarioId/docker-compose
   */
  @Get('../scenarios/:scenarioId/docker-compose')
  async loadDockerComposeByScenarioId(
    @Param('scenarioId') scenarioId: string
  ) {
    // Resolve latest version
    const latestVersion = await this.environmentService.getLatestVersionIdForScenario(scenarioId);
    if (!latestVersion) {
      throw new Error('No versions found for scenario');
    }
    return this.environmentService.loadDockerComposeFromMinIO(latestVersion);
  }

  /**
   * Test scenario on creator's Docker
   */
  @Post('docker/test-scenario')
  async testScenario(
    @Body() body: {
      scenarioVersionId: string;
      dockerCompose: string;
      dockerConnection: { dockerHost: string; useTLS: boolean };
    }
  ) {
    return this.environmentService.testScenarioOnDockerDaemon(
      body.scenarioVersionId,
      body.dockerCompose,
      body.dockerConnection
    );
  }
}
