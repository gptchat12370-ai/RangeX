import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';
import { User } from './user.entity';

export type TestRunStatus = 'pending' | 'deploying' | 'testing' | 'passed' | 'failed' | 'cancelled';

export interface TestResults {
  gatewayReachable: boolean;
  machinesHealthy: { [machineId: string]: boolean };
  entrypointsAccessible: { [entrypointKey: string]: boolean };
  errors: string[];
  checkDetails?: {
    gatewayCheck?: { success: boolean; message: string; timestamp: Date };
    machineHealthChecks?: Array<{ machineId: string; machineName: string; success: boolean; message: string }>;
    entrypointChecks?: Array<{ entrypointKey: string; url: string; success: boolean; message: string }>;
  };
}

@Entity('scenario_version_test_runs')
export class ScenarioVersionTestRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'varchar', length: 36 })
  initiatedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiatedBy' })
  initiator: User;

  @Column({
    type: 'enum',
    enum: ['pending', 'deploying', 'testing', 'passed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: TestRunStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  deploymentId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionToken: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayProxyUrl: string | null;

  @Column({ type: 'json', nullable: true })
  testResults: TestResults | null;

  @Column({ type: 'text', nullable: true })
  logs: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
