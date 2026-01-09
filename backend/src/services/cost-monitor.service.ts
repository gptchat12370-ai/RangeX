import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { SystemSettings } from '../entities/system-settings.entity';
import { AwsIntegrationService } from './aws-integration.service';
import { CostService } from './cost.service';

@Injectable()
export class CostMonitorService {
  private readonly logger = new Logger(CostMonitorService.name);

  // Alert thresholds
  private readonly ALERT_THRESHOLD_80 = 80;
  private readonly ALERT_THRESHOLD_90 = 90;
  private readonly IDLE_TIMEOUT_MINUTES = 30;

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>,
    private awsService: AwsIntegrationService,
    private costService: CostService,
  ) {}

  /**
   * Check budget thresholds every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkBudgetAlerts() {
    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings || !settings.budgetHardCapUsd) {
      return;
    }

    const currentSpend = await this.costService.getCurrentMonthCostRm();
    const hardCap = Number(settings.budgetHardCapUsd);
    const percentage = (currentSpend / hardCap) * 100;

    this.logger.log(
      `Monthly spend: $${currentSpend.toFixed(2)} / $${hardCap} (${percentage.toFixed(1)}%)`,
    );

    // Critical alert at 90%
    if (percentage >= this.ALERT_THRESHOLD_90 && percentage < 100) {
      this.logger.error(
        `🚨 CRITICAL: Budget at ${percentage.toFixed(1)}% - Approaching hard cap!`,
      );
      // TODO: Send critical alert (email/Slack/SNS)
    }
    // Warning alert at 80%
    else if (percentage >= this.ALERT_THRESHOLD_80 && percentage < 90) {
      this.logger.warn(
        `⚠️  WARNING: Budget at ${percentage.toFixed(1)}% - Consider optimizing usage`,
      );
      // TODO: Send warning alert
    }
  }

  /**
   * Terminate idle sessions every 10 minutes
   */
  @Cron('*/10 * * * *')
  async terminateIdleSessions() {
    const idleThreshold = new Date(
      Date.now() - this.IDLE_TIMEOUT_MINUTES * 60 * 1000,
    );

    // Find sessions that haven't been updated recently
    const idleSessions = await this.sessionRepo.find({
      where: {
        status: 'running',
        updatedAt: LessThan(idleThreshold),
      },
    });

    if (idleSessions.length === 0) {
      return;
    }

    this.logger.warn(
      `Found ${idleSessions.length} idle sessions (no activity for ${this.IDLE_TIMEOUT_MINUTES} minutes)`,
    );

    for (const session of idleSessions) {
      try {
        this.logger.log(
          `Terminating idle session ${session.id} (user: ${session.userId})`,
        );

        // Get machines and stop them
        const machines = session.machines || [];
        for (const machine of machines) {
          if (machine.taskArn) {
            await this.awsService.stopTasks([machine.taskArn]);
          }
        }

        session.status = 'terminated';
        session.stoppedAt = new Date();
        session.reasonStopped = 'Idle timeout';
        await this.sessionRepo.save(session);

        this.logger.log(`Successfully terminated idle session ${session.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to terminate idle session ${session.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Calculate current month's total spend (delegated to CostService)
   */
  private async calculateMonthlySpend(): Promise<number> {
    return this.costService.getCurrentMonthCostRm();
  }

  /**
   * Get cost dashboard data for admins
   */
  async getCostDashboard() {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allSessions, settings] = await Promise.all([
      this.sessionRepo.find({
        where: {
          createdAt: MoreThan(currentMonth),
        },
      }),
      this.settingsRepo.findOne({ where: {} }),
    ]);

    const totalCost = allSessions.reduce(
      (sum: number, s: EnvironmentSession) => sum + Number(s.costAccumulatedRm || 0),
      0,
    );
    const runningSessions = allSessions.filter((s: EnvironmentSession) => s.status === 'running');
    const runningCost = runningSessions.reduce(
      (sum: number, s: EnvironmentSession) => sum + Number(s.costAccumulatedRm || 0),
      0,
    );
    const todaySessions = allSessions.filter((s: EnvironmentSession) => s.createdAt >= today);

    // Calculate top spending users
    const userSpending = new Map<string, number>();
    allSessions.forEach((session: EnvironmentSession) => {
      const current = userSpending.get(session.userId) || 0;
      userSpending.set(
        session.userId,
        current + Number(session.costAccumulatedRm || 0),
      );
    });

    const topUsers = Array.from(userSpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, spend]) => ({
        userId,
        totalSpend: spend,
        sessionCount: allSessions.filter((s: EnvironmentSession) => s.userId === userId).length,
      }));

    const budgetHardCap = Number(settings?.budgetHardCapUsd || 0);
    const budgetPercentage = budgetHardCap > 0
      ? (totalCost / budgetHardCap) * 100
      : 0;

    return {
      monthToDate: {
        totalSessions: allSessions.length,
        totalCost: totalCost,
        avgCostPerSession:
          allSessions.length > 0 ? totalCost / allSessions.length : 0,
        budget: budgetHardCap,
        budgetUsedPercentage: budgetPercentage,
        budgetRemaining: budgetHardCap > 0
          ? Math.max(0, budgetHardCap - totalCost)
          : 0,
      },
      current: {
        runningSessions: runningSessions.length,
        estimatedRunningCost: runningCost,
      },
      today: {
        sessions: todaySessions.length,
        cost: todaySessions.reduce(
          (sum: number, s: EnvironmentSession) => sum + Number(s.costAccumulatedRm || 0),
          0,
        ),
      },
      topUsers,
      alerts: {
        budgetAt80: budgetPercentage >= 80,
        budgetAt90: budgetPercentage >= 90,
        budgetExceeded: budgetPercentage >= 100,
      },
    };
  }
}
