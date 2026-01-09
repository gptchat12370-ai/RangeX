import { httpClient } from './httpClient';

export type PipelineStage = 'local' | 'staging' | 'admin_review' | 'approved' | 'production';

export interface ImagePipelineStage {
  id: string;
  scenarioId: string;
  creatorUserId: string;
  imageName: string;
  imageTag: string;
  currentStage: PipelineStage;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // MinIO paths
  minioStagingPath?: string;
  minioApprovedPath?: string;
  
  // ECR details
  ecrDigest?: string;
  ecrPushedAt?: Date;
  
  // Security scan results
  securityScanStatus?: 'pending' | 'passed' | 'failed';
  securityIssues?: string;
  
  // Admin review
  reviewedByUserId?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  
  // Auto-promotion
  autoPromoteEnabled: boolean;
  autoPromotedAt?: Date;
  
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface SubmitImageRequest {
  scenarioId: string;
  imageName: string;
  imageTag: string;
}

export interface PromoteImageRequest {
  reviewNotes?: string;
}

export const imagePipelineApi = {
  /**
   * CREATOR: Submit image to staging (MinIO)
   */
  async submitToStaging(data: SubmitImageRequest): Promise<ImagePipelineStage> {
    const response = await httpClient.post('/image-pipeline/submit', data);
    return response.data;
  },

  /**
   * Get image pipeline status
   */
  async getStatus(scenarioId: string): Promise<ImagePipelineStage> {
    const response = await httpClient.get(`/image-pipeline/status/${scenarioId}`);
    return response.data;
  },

  /**
   * CREATOR: Get my submitted images
   */
  async getMySubmissions(): Promise<ImagePipelineStage[]> {
    const response = await httpClient.get('/image-pipeline/my-submissions');
    return response.data;
  },

  /**
   * ADMIN: Get all images pending review
   */
  async getPendingReview(): Promise<ImagePipelineStage[]> {
    const response = await httpClient.get('/image-pipeline/admin/pending-review');
    return response.data;
  },

  /**
   * ADMIN: Approve image and promote to ECR
   */
  async approveImage(scenarioId: string, data: PromoteImageRequest): Promise<ImagePipelineStage> {
    const response = await httpClient.post(`/image-pipeline/admin/approve/${scenarioId}`, data);
    return response.data;
  },

  /**
   * ADMIN: Reject image and remove from staging
   */
  async rejectImage(scenarioId: string, reason: string): Promise<{ success: boolean }> {
    const response = await httpClient.post(`/image-pipeline/admin/reject/${scenarioId}`, { reason });
    return response.data;
  },

  /**
   * Get security scan results
   */
  async getSecurityScan(scenarioId: string): Promise<{
    status: 'pending' | 'passed' | 'failed';
    issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      cve?: string;
    }>;
  }> {
    const response = await httpClient.get(`/image-pipeline/security-scan/${scenarioId}`);
    return response.data;
  },

  /**
   * Get all images in production (ECR)
   */
  async getProductionImages(): Promise<ImagePipelineStage[]> {
    const response = await httpClient.get('/image-pipeline/production');
    return response.data;
  },
};
