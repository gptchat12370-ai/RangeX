import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class SystemSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Platform Access Control
  @Column({ type: 'boolean', default: false })
  maintenanceMode: boolean;

  @Column({ type: 'text', nullable: true })
  maintenanceMessage?: string;

  @Column({ type: 'int', default: 0, comment: 'Max concurrent users, 0 = unlimited' })
  maxConcurrentUsers: number;

  @Column({ type: 'int', default: 0, comment: 'Max total registered users, 0 = unlimited' })
  maxTotalUsers: number;

  @Column({ type: 'boolean', default: true })
  allowNewRegistrations: boolean;

  // Session/Container Limits
  @Column({ type: 'int', default: 1, comment: 'Max concurrent sessions per user' })
  maxSessionsPerUser: number;

  @Column({ type: 'int', default: 3, comment: 'Max session starts per hour per user' })
  maxSessionsPerHour: number;

  @Column({ type: 'int', default: 10, comment: 'Max session starts per day per user' })
  maxSessionsPerDay: number;

  @Column({ type: 'int', default: 30, comment: 'Idle timeout in minutes' })
  idleTimeoutMinutes: number;

  @Column({ type: 'int', default: 180, comment: 'Max session duration in minutes' })
  maxSessionDurationMinutes: number;

  // Scenario/Container Limits
  @Column({ type: 'int', default: 0, comment: 'Max total running containers, 0 = unlimited' })
  maxTotalContainers: number;

  @Column({ type: 'int', default: 1, comment: 'Max scenarios that can be accessed' })
  maxAccessibleScenarios: number;

  @Column({ type: 'boolean', default: true, comment: 'Allow users to access all scenarios' })
  allowAllScenarios: boolean;

  // Budget & Cost Control
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  budgetHardCapUsd: number;

  @Column({ type: 'int', default: 80, comment: 'Budget alert percentage threshold' })
  budgetAlertPercentage: number;

  @Column({ type: 'boolean', default: true, comment: 'Auto-enable maintenance at budget cap' })
  autoMaintenanceOnBudgetCap: boolean;

  // Storage Limits
  @Column({ type: 'bigint', default: 0, comment: 'Max storage per user in bytes, 0 = unlimited' })
  maxStoragePerUserBytes: number;

  @Column({ type: 'bigint', default: 0, comment: 'Max total storage in bytes, 0 = unlimited' })
  maxTotalStorageBytes: number;

  // MinIO/Storage Configuration
  @Column({ type: 'varchar', length: 255, default: 'minio' })
  storageDriver: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  minioEndpoint?: string;

  @Column({ type: 'int', nullable: true })
  minioPort?: number;

  @Column({ type: 'boolean', default: false })
  minioUseSSL: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  minioAccessKey?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  minioSecretKey?: string;

  @Column({ type: 'varchar', length: 255, default: 'assets' })
  minioBucket: string;

  // AWS Configuration (Fargate only - free tier VPC)
  @Column({ type: 'varchar', length: 50, nullable: true })
  awsRegion?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  awsEcsClusterName?: string;

  @Column({ type: 'text', nullable: true, comment: 'Comma-separated subnet IDs' })
  awsEcsSubnetIds?: string;

  @Column({ type: 'text', nullable: true, comment: 'Comma-separated security group IDs' })
  awsEcsSecurityGroupIds?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  awsEcrRegistry?: string;

  @Column({ type: 'boolean', default: false, comment: 'Use local Docker instead of Fargate' })
  useLocalDocker: boolean;

  // Docker Testing Limits
  @Column({ type: 'int', default: 5, comment: 'Max concurrent Docker test containers' })
  dockerMaxContainers: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.5, comment: 'Max CPUs per test container' })
  dockerMaxCpusPerContainer: number;

  @Column({ type: 'int', default: 250, comment: 'Max memory in MB per test container' })
  dockerMaxMemoryMbPerContainer: number;

  @Column({ type: 'int', default: 60, comment: 'Test timeout in minutes' })
  dockerTestTimeoutMinutes: number;

  @Column({ type: 'boolean', default: false, comment: 'Enable pulling from Docker Hub' })
  dockerEnablePullFromHub: boolean;

  // Monitoring & Performance
  @Column({ type: 'boolean', default: true })
  enablePrometheusMetrics: boolean;

  @Column({ type: 'boolean', default: true })
  enableRequestLogging: boolean;

  @Column({ type: 'int', default: 7, comment: 'Log retention in days' })
  logRetentionDays: number;

  // Error Handling
  @Column({ type: 'boolean', default: true })
  sendErrorNotifications: boolean;

  @Column({ type: 'text', nullable: true, comment: 'Comma-separated admin emails' })
  adminEmails?: string;

  @Column({ type: 'text', nullable: true })
  slackWebhookUrl?: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
