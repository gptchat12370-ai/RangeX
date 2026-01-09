import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Job } from '../entities/job.entity';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  /**
   * Enqueue a new job
   */
  async enqueue(type: string, payload: any): Promise<Job> {
    const job = this.jobRepo.create({
      type,
      payload,
      status: 'pending',
      attempts: 0,
    });

    await this.jobRepo.save(job);
    this.logger.log(`Job enqueued: ${type} (${job.id})`);
    return job;
  }

  /**
   * Dequeue the next pending job (FIFO, with type filter)
   */
  async dequeue(type?: string): Promise<Job | null> {
    const query = this.jobRepo.createQueryBuilder('job')
      .where('job.status = :status', { status: 'pending' })
      .orderBy('job.createdAt', 'ASC')
      .limit(1);

    if (type) {
      query.andWhere('job.type = :type', { type });
    }

    const job = await query.getOne();

    if (job) {
      // Mark as processing
      job.status = 'processing';
      job.startedAt = new Date();
      job.attempts += 1;
      await this.jobRepo.save(job);
      this.logger.log(`Job dequeued: ${job.type} (${job.id}), attempt ${job.attempts}`);
    }

    return job;
  }

  /**
   * Mark job as completed
   */
  async markCompleted(jobId: string, result?: any): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      this.logger.warn(`Cannot mark non-existent job as completed: ${jobId}`);
      return;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    if (result) {
      job.result = JSON.stringify(result);
    }

    await this.jobRepo.save(job);
    this.logger.log(`Job completed: ${job.type} (${jobId})`);
  }

  /**
   * Alias for markCompleted (for consistency)
   */
  async complete(jobId: string, result?: any): Promise<void> {
    return this.markCompleted(jobId, result);
  }

  /**
   * Mark job as failed
   */
  async markFailed(jobId: string, error: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      this.logger.warn(`Cannot mark non-existent job as failed: ${jobId}`);
      return;
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();

    await this.jobRepo.save(job);
    this.logger.error(`Job failed: ${job.type} (${jobId}) - ${error}`);

    // Auto-retry logic (max 3 attempts)
    if (job.attempts < 3) {
      this.logger.log(`Scheduling retry for job ${jobId} (attempt ${job.attempts + 1}/3)`);
      job.status = 'pending';
      job.error = null;
      job.startedAt = null;
      job.completedAt = null;
      await this.jobRepo.save(job);
    }
  }

  /**
   * Alias for markFailed (for consistency)
   */
  async fail(jobId: string, error: string): Promise<void> {
    return this.markFailed(jobId, error);
  }

  /**
   * Retry a failed job manually
   */
  async retry(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Can only retry failed jobs. Current status: ${job.status}`);
    }

    job.status = 'pending';
    job.error = null;
    job.startedAt = null;
    job.completedAt = null;

    await this.jobRepo.save(job);
    this.logger.log(`Job retry scheduled: ${job.type} (${jobId})`);
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<Job | null> {
    return this.jobRepo.findOne({ where: { id: jobId } });
  }

  /**
   * List all jobs (with optional filtering)
   */
  async list(options?: { type?: string; status?: string; limit?: number }): Promise<Job[]> {
    const query = this.jobRepo.createQueryBuilder('job');

    if (options?.type) {
      query.andWhere('job.type = :type', { type: options.type });
    }

    if (options?.status) {
      query.andWhere('job.status = :status', { status: options.status });
    }

    query.orderBy('job.createdAt', 'DESC');

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query.getMany();
  }

  /**
   * Clean up old completed/failed jobs (retention policy)
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.jobRepo
      .createQueryBuilder()
      .delete()
      .where('status IN (:...statuses)', { statuses: ['completed', 'failed'] })
      .andWhere('completedAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old jobs (older than ${olderThanDays} days)`);
    return result.affected || 0;
  }
}
