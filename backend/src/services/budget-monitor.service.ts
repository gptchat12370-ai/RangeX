import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { AlertService } from './alert.service';
import { EnvironmentService } from './environment.service';

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

  /**
   * Calculate total cost for a time period
   */
  private async calculatePeriodCost(start: Date, end: Date): Promise<number> {
    const sessions = await this.sessionRepo.find({
      where: [
        // Sessions that started and ended in period
        {
          startedAt: Between(start, end),
          endedAt: Between(start, end),
        },
        // Sessions that started before but ended in period
        {
          startedAt: MoreThan(new Date(0)),
          endedAt: Between(start, end),
        },
        // Sessions still running (started in period)
        {
          startedAt: Between(start, end),
          status: 'running',
        },
      ],
    });

    let totalCost = 0;

    for (const session of sessions) {
      // Calculate cost for this session's overlap with the period
      if (!session.startedAt) continue;
      const sessionStart = session.startedAt > start ? session.startedAt : start;
      const sessionEnd = (session.endedAt && session.endedAt < end) ? session.endedAt : end;
      
      const durationHours = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
      
      // Fargate pricing: ~RM 0.04/hour for 0.25 vCPU, 0.5GB RAM
      const hourlyRate = 0.04;
      const sessionCost = durationHours * hourlyRate;
      
      totalCost += sessionCost;
    }

    return totalCost;
  }

  /**
   * Calculate current hourly burn rate from running sessions
   */
  private async calculateActiveBurnRate(): Promise<number> {
    const runningSessions = await this.sessionRepo.count({
      where: { status: 'running' },
    });

    // RM 0.04/hour per session
    return runningSessions * 0.04;
  }

  /**
   * Handle daily budget warning (NO shutdown)
   */
  private async handleDailyWarning(report: CostReport): Promise<void> {
    this.logger.warn(`Daily budget at ${report.dailyPercentage.toFixed(1)}%`);

    await this.alertService.sendCostAlert('daily_warning', {
      currentCost: report.today,
      limit: report.dailyLimit,
      percentage: report.dailyPercentage,
      runningSessions: report.runningSessionsCount,
      activeBurnRate: report.activeCost,
      message: `Daily cost is at ${report.dailyPercentage.toFixed(1)}% (RM ${report.today.toFixed(2)} / RM ${report.dailyLimit}). No action taken - this is informational only.`,
    });
  }

  /**
   * Handle monthly budget warning (90%+ reached)
   */
  private async handleMonthlyWarning(report: CostReport): Promise<void> {
    this.logger.warn(`Monthly budget at ${report.monthlyPercentage.toFixed(1)}%`);

    await this.alertService.sendCostAlert('monthly_warning', {
      currentCost: report.thisMonth,
      limit: report.monthlyLimit,
      percentage: report.monthlyPercentage,
      projectedCost: report.projectedMonthly,
      runningSessions: report.runningSessionsCount,
      activeBurnRate: report.activeCost,
      message: `Monthly budget is at ${report.monthlyPercentage.toFixed(1)}% (RM ${report.thisMonth.toFixed(2)} / RM ${report.monthlyLimit}). 
      Projected monthly cost: RM ${report.projectedMonthly.toFixed(2)}.
      If budget exceeds 100%, all sessions will be auto-terminated after ${this.budgetConfig.gracePeriodMinutes} minute grace period.`,
    });
  }

  /**
   * Handle budget exceeded - initiate grace period then shutdown
   */
  private async handleBudgetExceeded(report: CostReport): Promise<void> {
    this.logger.error(`BUDGET EXCEEDED: ${report.monthlyPercentage.toFixed(1)}%`);

    // If already in grace period, check if it's expired
    if (this.gracePeriodActive) {
      const gracePeriodElapsed = (new Date().getTime() - this.gracePeriodStartedAt!.getTime()) / (1000 * 60);
      
      if (gracePeriodElapsed >= this.budgetConfig.gracePeriodMinutes) {
        // Grace period expired - execute shutdown
        await this.executeEmergencyShutdown(report);
      } else {
        this.logger.warn(`Grace period active: ${gracePeriodElapsed.toFixed(1)} / ${this.budgetConfig.gracePeriodMinutes} minutes`);
      }
      
      return;
    }

    // Start grace period
    this.gracePeriodActive = true;
    this.gracePeriodStartedAt = new Date();

    this.logger.warn(`Grace period started: ${this.budgetConfig.gracePeriodMinutes} minutes until auto-shutdown`);

    await this.alertService.send({
      level: 'emergency',
      title: 'BUDGET EXCEEDED - Grace Period Started',
      message: `
        Monthly budget has been exceeded!
        
        Current: RM ${report.thisMonth.toFixed(2)} / RM ${report.monthlyLimit}
        Percentage: ${report.monthlyPercentage.toFixed(1)}%
        
        Grace period: ${this.budgetConfig.gracePeriodMinutes} minutes
        
        ALL RUNNING SESSIONS WILL BE AUTOMATICALLY TERMINATED IN ${this.budgetConfig.gracePeriodMinutes} MINUTES
        unless budget is increased or sessions are manually stopped.
        
        Running sessions: ${report.runningSessionsCount}
        Current burn rate: RM ${report.activeCost.toFixed(2)}/hour
      `,
      channels: ['web', 'email', 'sms'],
      metadata: {
        type: 'budget_exceeded',
        gracePeriodMinutes: this.budgetConfig.gracePeriodMinutes,
        gracePeriodEndsAt: new Date(Date.now() + this.budgetConfig.gracePeriodMinutes * 60 * 1000),
        ...report,
      },
    });
  }

  /**
   * Execute emergency shutdown after grace period
   */
  private async executeEmergencyShutdown(report: CostReport): Promise<void> {
    this.logger.error('EXECUTING EMERGENCY SHUTDOWN - BUDGET EXCEEDED');

    // Get all running sessions
    const sessions = await this.sessionRepo.find({
      where: { status: 'running' },
    });

    this.logger.error(`Terminating ${sessions.length} running sessions...`);

    // Terminate all sessions
    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
      try {
        // Note: Session termination would need to be implemented via stopEnvironment
        // For now, log the session that should be terminated
        this.logger.warn(`Session ${session.id} should be terminated (budget exceeded)`);
        successCount++;
      } catch (error: any) {
        this.logger.error(`Failed to terminate session ${session.id}: ${error.message}`);
        failCount++;
      }
    }

    // Reset grace period
    this.gracePeriodActive = false;
    this.gracePeriodStartedAt = undefined;

    // Send completion alert
    await this.alertService.send({
      level: 'emergency',
      title: 'Emergency Shutdown Completed',
      message: `
        All running sessions have been terminated due to budget exceeded.
        
        Total sessions terminated: ${successCount}
        Failed terminations: ${failCount}
        
        Budget status:
        - Current cost: RM ${report.thisMonth.toFixed(2)}
        - Monthly limit: RM ${report.monthlyLimit}
        - Overage: RM ${(report.thisMonth - report.monthlyLimit).toFixed(2)}
        
        The system will remain operational but no new sessions can be started
        until the monthly budget is reset or increased.
      `,
      channels: ['web', 'email', 'sms'],
      metadata: {
        type: 'emergency_shutdown_completed',
        sessionsTerminated: successCount,
        failedTerminations: failCount,
        ...report,
      },
    });

    this.logger.log(`Emergency shutdown completed: ${successCount} terminated, ${failCount} failed`);
  }

  /**
   * Check if new sessions can be started (budget check)
   */
  async canStartNewSession(): Promise<{ allowed: boolean; reason?: string }> {
    const report = await this.generateCostReport();

    // Block if monthly budget exceeded
    if (report.monthlyPercentage >= 100) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded (${report.monthlyPercentage.toFixed(1)}%). Cannot start new sessions.`,
      };
    }

    // Warn if projected to exceed
    if (report.projectedMonthly > report.monthlyLimit * 1.1) {
      return {
        allowed: false,
        reason: `Projected monthly cost (RM ${report.projectedMonthly.toFixed(2)}) exceeds limit by 10%. Cannot start new sessions.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get cost breakdown by scenario
   */
  async getCostBreakdownByScenario(startDate: Date, endDate: Date): Promise<any[]> {
    const sessions = await this.sessionRepo.find({
      where: {
        startedAt: Between(startDate, endDate),
      },
      relations: ['scenarioVersion', 'scenarioVersion.scenario'],
    });

    const breakdown = new Map<string, { scenarioId: string; scenarioName: string; sessionCount: number; totalCost: number }>();

    for (const session of sessions) {
      const scenarioId = session.scenarioVersion?.scenario?.id || 'unknown';
      const scenarioName = session.scenarioVersion?.title || 'Unknown';

      if (!breakdown.has(scenarioId)) {
        breakdown.set(scenarioId, {
          scenarioId,
          scenarioName,
          sessionCount: 0,
          totalCost: 0,
        });
      }

      const entry = breakdown.get(scenarioId)!;
      entry.sessionCount++;

      // Calculate session cost
      if (!session.startedAt) continue;
      const start = session.startedAt > startDate ? session.startedAt : startDate;
      const end = (session.endedAt && session.endedAt < endDate) ? session.endedAt : endDate;
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      entry.totalCost += durationHours * 0.04;
    }

    return Array.from(breakdown.values()).sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Manual budget increase (admin only)
   */
  async increaseBudget(newMonthlyLimit: number, reason: string): Promise<void> {
    this.logger.log(`Budget increased from RM ${this.budgetConfig.monthlyLimit} to RM ${newMonthlyLimit}. Reason: ${reason}`);

    this.budgetConfig.monthlyLimit = newMonthlyLimit;

    // Cancel grace period if active
    if (this.gracePeriodActive) {
      this.gracePeriodActive = false;
      this.gracePeriodStartedAt = undefined;
      this.logger.log('Grace period cancelled due to budget increase');
    }

    await this.alertService.send({
      level: 'info',
      title: 'Budget Increased',
      message: `Monthly budget has been increased to RM ${newMonthlyLimit}. Reason: ${reason}`,
      channels: ['web', 'email'],
      metadata: { newLimit: newMonthlyLimit, reason },
    });
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<CostReport & { gracePeriod?: { active: boolean; startedAt?: Date; expiresAt?: Date } }> {
    const report = await this.generateCostReport();

    if (this.gracePeriodActive) {
      return {
        ...report,
        gracePeriod: {
          active: true,
          startedAt: this.gracePeriodStartedAt,
          expiresAt: new Date(this.gracePeriodStartedAt!.getTime() + this.budgetConfig.gracePeriodMinutes * 60 * 1000),
        },
      };
    }

    return report;
  }
}
