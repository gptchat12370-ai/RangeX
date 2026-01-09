import { httpClient } from './httpClient';

export interface CreatorTestSession {
  id: string;
  userId: string;
  scenarioId: string;
  composeFile: string;
  status: 'running' | 'completed' | 'failed';
  validationResult?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  containerLogs?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface StartTestRequest {
  scenarioId: string;
  composeFile: string; // docker-compose.yml content
}

export const creatorTestingApi = {
  /**
   * Start a local Docker testing session
   */
  async startTest(data: StartTestRequest): Promise<CreatorTestSession> {
    const response = await httpClient.post('/creator-testing/start', data);
    return response.data;
  },

  /**
   * Get test session status
   */
  async getSession(sessionId: string): Promise<CreatorTestSession> {
    const response = await httpClient.get(`/creator-testing/session/${sessionId}`);
    return response.data;
  },

  /**
   * Stop a running test session
   */
  async stopSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await httpClient.post(`/creator-testing/session/${sessionId}/stop`);
    return response.data;
  },

  /**
   * Get container logs from test session
   */
  async getLogs(sessionId: string): Promise<{ logs: string }> {
    const response = await httpClient.get(`/creator-testing/session/${sessionId}/logs`);
    return response.data;
  },

  /**
   * Validate docker-compose file
   */
  async validateCompose(composeFile: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const response = await httpClient.post('/creator-testing/validate', { composeFile });
    return response.data;
  },

  /**
   * Get all test sessions for current user
   */
  async getMySessions(): Promise<CreatorTestSession[]> {
    const response = await httpClient.get('/creator-testing/my-sessions');
    return response.data;
  },

  /**
   * Clean up old test containers/sessions
   */
  async cleanup(): Promise<{ cleaned: number }> {
    const response = await httpClient.post('/creator-testing/cleanup');
    return response.data;
  },
};
