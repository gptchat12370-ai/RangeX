import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { BudgetMonitorService } from '../services/budget-monitor.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/**
 * Budget Monitor Controller
 * Manages budget tracking and cost controls
 */
@Controller('admin/budget')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BudgetMonitorController {
  constructor(private readonly budgetService: BudgetMonitorService) {}

  /**
   * Get current budget status
   */
  @Get('status')
  async getBudgetStatus() {
    return await this.budgetService.getBudgetStatus();
  }

  /**
   * Get cost report
   */
  @Get('report')
  async getCostReport() {
    return await this.budgetService.generateCostReport();
  }

  /**
   * Get cost breakdown by scenario
   */
  @Get('breakdown')
  async getCostBreakdown(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return await this.budgetService.getCostBreakdownByScenario(start, end);
  }

  /**
   * Check if new session can start (budget check)
   */
  @Get('can-start-session')
  async canStartSession() {
    return await this.budgetService.canStartNewSession();
  }

  /**
   * Increase monthly budget (admin action)
   */
  @Patch('increase')
  async increaseBudget(
    @CurrentUser() user: User,
    @Body() body: { newMonthlyLimit: number; reason: string }
  ) {
    await this.budgetService.increaseBudget(body.newMonthlyLimit, body.reason);
    
    return {
      message: 'Budget increased',
      newLimit: body.newMonthlyLimit,
      reason: body.reason,
      updatedBy: user.email,
    };
  }
}
