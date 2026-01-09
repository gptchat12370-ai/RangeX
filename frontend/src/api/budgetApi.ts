import { httpClient } from './httpClient';

export interface BudgetStatus {
  scenarioId: string;
  currentCost: number;
  budgetLimit: number;
  utilizationPercent: number;
  status: 'normal' | 'warning' | 'critical' | 'exceeded';
  alertSent: boolean;
  inGracePeriod: boolean;
  gracePeriodEndsAt?: Date;
  forecast30Days?: number;
}

export interface BudgetAlert {
  id: string;
  scenarioId: string;
  alertMonth: string; // YYYY-MM
  alertType: '80_percent' | 'exceeded';
  currentCost: number;
  budgetLimit: number;
  utilizationPercent: number;
  gracePeriodHours: number;
  gracePeriodEndsAt: Date;
  notificationSent: boolean;
  autoShutdownAt?: Date;
  status: 'active' | 'resolved' | 'shutdown';
  createdAt: Date;
}

export interface BudgetConfig {
  budgetLimit: number;
  alertThreshold: number; // 0.8 for 80%
  gracePeriodHours: number;
  enableAutoShutdown: boolean;
}

export const budgetMonitorApi = {
  /**
   * Get current budget status for scenario
   */
  async getStatus(scenarioId: string): Promise<BudgetStatus> {
    const response = await httpClient.get(`/budget/status/${scenarioId}`);
    return response.data;
  },

  /**
   * Get all scenarios' budget status
   */
  async getAllStatus(): Promise<BudgetStatus[]> {
    const response = await httpClient.get('/budget/status');
    return response.data;
  },

  /**
   * Get budget alerts for scenario
   */
  async getAlerts(scenarioId: string): Promise<BudgetAlert[]> {
    const response = await httpClient.get(`/budget/alerts/${scenarioId}`);
    return response.data;
  },

  /**
   * Get active budget alerts across all scenarios
   */
  async getActiveAlerts(): Promise<BudgetAlert[]> {
    const response = await httpClient.get('/budget/alerts/active');
    return response.data;
  },

  /**
   * Update budget configuration
   */
  async updateConfig(scenarioId: string, config: Partial<BudgetConfig>): Promise<BudgetConfig> {
    const response = await httpClient.put(`/budget/config/${scenarioId}`, config);
    return response.data;
  },

  /**
   * Get budget configuration
   */
  async getConfig(scenarioId: string): Promise<BudgetConfig> {
    const response = await httpClient.get(`/budget/config/${scenarioId}`);
    return response.data;
  },

  /**
   * Manually trigger budget check
   */
  async checkNow(scenarioId: string): Promise<BudgetStatus> {
    const response = await httpClient.post(`/budget/check/${scenarioId}`);
    return response.data;
  },

  /**
   * Acknowledge alert and extend grace period
   */
  async extendGracePeriod(alertId: string, hours: number): Promise<BudgetAlert> {
    const response = await httpClient.post(`/budget/alerts/${alertId}/extend`, { hours });
    return response.data;
  },
};
