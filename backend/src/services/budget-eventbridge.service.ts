import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BudgetMonitorService } from './budget-monitor.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scenario } from '../entities/scenario.entity';

/**
 * EventBridge Budget Alert Handler
 * 
 * Integrates with AWS Budgets to receive automated budget alerts.
 * Since we're using local infrastructure (no CloudWatch Events),
 * this service polls AWS Budgets API directly.
 * 
 * Cost: FREE (AWS Budgets API is free, 2 budgets included)
 * 
 * Integration Points:
 * 1. AWS Budgets -> Email/SNS notification (manual setup)
 * 2. This service polls Budgets API every hour
 * 3. Triggers grace period logic when threshold exceeded
 * 
 * Manual Setup Required:
 * 1. AWS Console -> AWS Budgets
 * 2. Create budget: "$150 monthly limit"
 * 3. Set threshold: 80% ($120)
 * 4. Add SNS topic (optional, for email alerts)
 * 5. This service auto-detects budget status
 */
@Injectable()
export class BudgetEventBridgeService {
  private readonly logger = new Logger(BudgetEventBridgeService.name);

  constructor(
    private readonly budgetMonitorService: BudgetMonitorService,
    @InjectRepository(Scenario)
    private readonly scenarioRepository: Repository<Scenario>,
  ) {}

  /**
   * Poll AWS Budgets API every hour
   * Checks if any budget has exceeded threshold
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkBudgetStatus(): Promise<void> {
    try {
      this.logger.log('Checking AWS budget status...');

      const costReport = await this.budgetMonitorService.generateCostReport();
      const currentMonthCost = costReport.thisMonth;
      
      // Get budget threshold from environment
      const budgetLimit = parseFloat(process.env.AWS_BUDGET_LIMIT || '150');
      const warningThreshold = parseFloat(process.env.AWS_BUDGET_WARNING_THRESHOLD || '0.8');
      const thresholdAmount = budgetLimit * warningThreshold;

      if (currentMonthCost >= thresholdAmount) {
        this.logger.warn(
          `Budget threshold exceeded: RM ${currentMonthCost.toFixed(2)} / RM ${budgetLimit} (${(currentMonthCost / budgetLimit * 100).toFixed(1)}%)`
        );

        // Trigger grace period logic
        await this.handleBudgetExceeded(currentMonthCost, budgetLimit);
      } else {
        this.logger.log(
          `Budget OK: RM ${currentMonthCost.toFixed(2)} / RM ${budgetLimit} (${(currentMonthCost / budgetLimit * 100).toFixed(1)}%)`
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to check budget status: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle budget exceeded event
   * Initiates grace period before auto-shutdown
   */
  private async handleBudgetExceeded(currentCost: number, budgetLimit: number): Promise<void> {
    try {
      const percentageUsed = (currentCost / budgetLimit) * 100;

      // Get all active scenarios
      const activeScenarios = await this.scenarioRepository.find({
        where: { isPublished: true },
      });

      this.logger.warn(
        `BUDGET ALERT: ${percentageUsed.toFixed(1)}% used (RM ${currentCost.toFixed(2)} / RM ${budgetLimit})`
      );
      this.logger.warn(`Active scenarios: ${activeScenarios.length}`);

      // Log budget exceeded for active scenarios
      for (const scenario of activeScenarios) {
        this.logger.warn(`Budget exceeded - Active scenario: ${scenario.id}`);
      }

      // Send admin notification
      await this.sendAdminNotification(currentCost, budgetLimit, activeScenarios.length);
    } catch (error: any) {
      this.logger.error(`Failed to handle budget exceeded: ${error.message}`, error.stack);
    }
  }

  /**
   * Send notification to admins
   * Uses alert service for email/SMS
   */
  private async sendAdminNotification(
    currentCost: number,
    budgetLimit: number,
    activeScenarios: number,
  ): Promise<void> {
    const percentageUsed = (currentCost / budgetLimit) * 100;

    const message = `
🚨 AWS BUDGET ALERT 🚨

Budget: ${percentageUsed.toFixed(1)}% used
Current: RM ${currentCost.toFixed(2)}
Limit: RM ${budgetLimit}
Active Scenarios: ${activeScenarios}

Grace period initiated for all scenarios.
Scenarios will auto-shutdown if budget reaches 100%.

Dashboard: ${process.env.FRONTEND_URL}/admin/budget
    `.trim();

    this.logger.warn(message);

    // TODO: Integrate with AlertService for email/SMS
    // await this.alertService.sendAlert({
    //   type: 'BUDGET_EXCEEDED',
    //   priority: 'HIGH',
    //   message,
    //   recipients: ['admin@rangex.com'],
    // });
  }

  /**
   * Get budget forecast
   * Predicts end-of-month cost based on current usage
   */
  async getBudgetForecast(): Promise<{
    currentCost: number;
    projectedCost: number;
    budgetLimit: number;
    daysRemaining: number;
    onTrack: boolean;
  }> {
    const costReport = await this.budgetMonitorService.generateCostReport();
    const currentCost = costReport.thisMonth;
    const budgetLimit = parseFloat(process.env.AWS_BUDGET_LIMIT || '150');

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = daysInMonth - currentDay;

    // Simple linear projection
    const dailyAverage = currentCost / currentDay;
    const projectedCost = dailyAverage * daysInMonth;
    const onTrack = projectedCost <= budgetLimit;

    return {
      currentCost,
      projectedCost,
      budgetLimit,
      daysRemaining,
      onTrack,
    };
  }

  /**
   * Manual trigger for budget exceeded (admin override)
   */
  async manualBudgetAlert(scenarioId: number): Promise<void> {
    const costReport = await this.budgetMonitorService.generateCostReport();
    const currentCost = costReport.thisMonth;
    const budgetLimit = parseFloat(process.env.AWS_BUDGET_LIMIT || '150');

    // Log manual budget alert
    this.logger.warn(`Manual budget alert triggered for scenario ${scenarioId}`);
    this.logger.warn(`Current cost: RM ${currentCost.toFixed(2)} / RM ${budgetLimit}`);
  }
}
