import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AwsConfigSyncService } from '../services/aws-config-sync.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

/**
 * AWS Config Sync Controller
 * Validates and syncs AWS infrastructure
 */
@Controller('admin/aws-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AwsConfigController {
  constructor(private readonly awsConfigService: AwsConfigSyncService) {}

  /**
   * Get current AWS configuration status
   */
  @Get('status')
  async getConfigStatus() {
    return await this.awsConfigService.checkAllConfigurations();
  }

  /**
   * Trigger manual configuration check
   */
  @Post('check')
  async manualCheck() {
    const status = await this.awsConfigService.manualCheck();
    
    return {
      message: 'Configuration check completed',
      status,
    };
  }

  /**
   * Auto-heal configuration issues
   */
  @Post('auto-heal')
  async autoHeal() {
    const result = await this.awsConfigService.autoHeal();
    
    return {
      message: 'Auto-heal completed',
      fixed: result.fixed,
      failed: result.failed,
    };
  }
}
