import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrphanedTaskMonitorService } from '../services/orphaned-task-monitor.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

/**
 * Orphaned Task Monitor Controller
 * Manages orphaned container detection and cleanup
 */
@Controller('admin/orphaned-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class OrphanedTaskController {
  constructor(
    private readonly orphanedTaskService: OrphanedTaskMonitorService
  ) {}

  /**
   * Get orphaned task statistics
   */
  @Get('statistics')
  async getStatistics() {
    return await this.orphanedTaskService.getStatistics();
  }

  /**
   * Trigger manual scan (for testing or immediate check)
   */
  @Post('scan')
  async manualScan() {
    const orphanedTasks = await this.orphanedTaskService.manualScan();
    
    return {
      message: 'Manual scan completed',
      orphanedTasksFound: orphanedTasks.length,
      tasks: orphanedTasks,
    };
  }
}
