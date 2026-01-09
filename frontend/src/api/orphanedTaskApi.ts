import { httpClient } from './httpClient';

export interface OrphanedTask {
  id: string;
  userId: string;
  scenarioId: string;
  taskArn: string;
  containerName: string;
  status: 'detected' | 'investigating' | 'terminated' | 'ignored';
  detectedAt: Date;
  terminatedAt?: Date;
  runningMinutes: number;
  expectedMaxMinutes: number;
  taskMetadata: {
    cpu: string;
    memory: string;
    imageUri: string;
    lastHeartbeat?: Date;
    sessionActive: boolean;
  };
  autoTerminated: boolean;
  terminationReason?: string;
}

export const orphanedTaskApi = {
  /**
   * Get all currently orphaned tasks
   */
  async getActive(): Promise<OrphanedTask[]> {
    const response = await httpClient.get('/orphaned-tasks/active');
    return response.data;
  },

  /**
   * Get orphaned tasks for specific scenario
   */
  async getByScenario(scenarioId: string): Promise<OrphanedTask[]> {
    const response = await httpClient.get(`/orphaned-tasks/scenario/${scenarioId}`);
    return response.data;
  },

  /**
   * Get orphaned task history
   */
  async getHistory(limit?: number): Promise<OrphanedTask[]> {
    const response = await httpClient.get('/orphaned-tasks/history', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Manually terminate an orphaned task
   */
  async terminate(taskArn: string, reason?: string): Promise<{ success: boolean }> {
    const response = await httpClient.post('/orphaned-tasks/terminate', {
      taskArn,
      reason,
    });
    return response.data;
  },

  /**
   * Mark task as ignored (not orphaned)
   */
  async ignore(taskArn: string, reason: string): Promise<{ success: boolean }> {
    const response = await httpClient.post('/orphaned-tasks/ignore', {
      taskArn,
      reason,
    });
    return response.data;
  },
};
