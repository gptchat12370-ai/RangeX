import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';
import { User } from './user.entity';

@Entity('scenario_version_admin_test')
export class ScenarioVersionAdminTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'enum', enum: ['pending', 'running', 'pass', 'fail', 'error'], default: 'pending' })
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error';

  @Column({ type: 'enum', enum: ['cloud_aws', 'local_docker'], default: 'cloud_aws' })
  mode: 'cloud_aws' | 'local_docker';

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number; // Duration in seconds

  // Test results
  @Column({ type: 'json', nullable: true })
  reportJson?: any; // Full test report with per-machine/entrypoint results

  @Column({ type: 'text', nullable: true })
  summary?: string; // Human-readable summary

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // AWS session info (if cloud test)
  @Column({ type: 'uuid', nullable: true })
  testSessionId?: string; // Environment session ID used for testing

  @Column({ type: 'varchar', length: 45, nullable: true })
  gatewayIp?: string;

  // Admin tracking
  @Column({ type: 'uuid' })
  createdByAdminId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdByAdminId' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
