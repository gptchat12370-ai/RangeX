import { httpClient } from './httpClient';

export interface AwsHealthCheck {
  id: string;
  serviceName: 'vpc' | 'ecr' | 'ecs' | 'eventbridge';
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckAt: Date;
  issuesDetected: string[];
  autoHealAttempted: boolean;
  autoHealSuccess?: boolean;
  autoHealDetails?: string;
}

export const awsConfigApi = {
  /**
   * Get health status of all AWS services
   */
  async getHealth(): Promise<AwsHealthCheck[]> {
    const response = await httpClient.get('/aws-config/health');
    return response.data;
  },

  /**
   * Get health for specific service
   */
  async getServiceHealth(serviceName: string): Promise<AwsHealthCheck> {
    const response = await httpClient.get(`/aws-config/health/${serviceName}`);
    return response.data;
  },

  /**
   * Manually trigger health check
   */
  async checkNow(): Promise<AwsHealthCheck[]> {
    const response = await httpClient.post('/aws-config/check');
    return response.data;
  },

  /**
   * Get AWS configuration summary
   */
  async getConfig(): Promise<{
    region: string;
    vpcId?: string;
    ecrRepository?: string;
    ecsCluster?: string;
    configured: boolean;
  }> {
    const response = await httpClient.get('/aws-config/summary');
    return response.data;
  },
};
