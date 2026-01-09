import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';

export type TestDeploymentStatus = 
  | 'pending' 
  | 'deploying' 
  | 'running' 
  | 'success' 
  | 'failed' 
  | 'cleaning' 
  | 'cleaned';

export const TEST_DEPLOYMENT_STATUSES = [
  'pending',
  'deploying',
  'running',
  'success',
  'failed',
  'cleaning',
  'cleaned',
] as const;

export interface DeploymentStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  logs?: string[];
  error?: string;
}

export interface DeploymentProgress {
  currentStep: number;
  totalSteps: number;
  steps: DeploymentStep[];
}

@Entity()
export class TestDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion)
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: TestDeploymentStatus;

  @Column({ type: 'json', nullable: true })
  progress?: DeploymentProgress;

  @Column({ type: 'json', nullable: true })
  ecsTaskArns?: string[];

  @Column({ type: 'json', nullable: true })
  networkInterfaces?: Array<{
    machineId: string;
    machineName: string;
    networkInterfaceId: string;
    privateIp: string;
    publicIp?: string;
  }>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionSecurityGroupId?: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  estimatedCostPerHour?: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  cleanedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
