import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { EnvironmentMachine } from './environment-machine.entity';
import { ResourceProfile } from './machine.entity';
import { ScenarioVersion } from './scenario-version.entity';

export type EnvironmentStatus = 'starting' | 'running' | 'paused' | 'stopping' | 'terminated' | 'failed' | 'error';

@Entity()
export class EnvironmentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion)
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion?: ScenarioVersion;

  @Column({ type: 'varchar', length: 255, nullable: true })
  awsTaskArn?: string;

  @Column({ type: 'uuid', nullable: true })
  eventId?: string;

  @Column({ type: 'uuid', nullable: true })
  teamId?: string;

  @Column({ type: 'varchar', length: 24 })
  status: EnvironmentStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  stoppedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;

  @Column({ type: 'text', nullable: true })
  reasonStopped?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  gatewayIp?: string;

  @Column({ type: 'varchar', length: 128 })
  gatewaySessionToken: string;

  @Column({ type: 'varchar', length: 24 })
  envProfile: ResourceProfile;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costAccumulatedRm: number;

  @Column({ type: 'tinyint', default: 0 })
  softLimitWarned: boolean;

  @Column({ type: 'json', nullable: true })
  answers?: Record<string, { correct: boolean; attemptsMade: number; remainingAttempts: number; earnedPoints: number; submittedAnswer: any }>;

  @Column({ type: 'int', default: 0 })
  score: number;

  // Session Security Fields (OWASP Requirements)
  @Column({ type: 'varchar', length: 45, nullable: true })
  clientIp?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  clientUserAgent?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt?: Date;

  @Column({ type: 'int', nullable: true })
  pausedRemainingSeconds?: number;

  @Column({ type: 'boolean', default: false })
  isTest: boolean;

  @VersionColumn()
  version: number;

  @OneToMany(() => EnvironmentMachine, (machine) => machine.environmentSession, { cascade: true })
  environmentMachines?: EnvironmentMachine[];

  // Backward compatibility alias
  get machines(): EnvironmentMachine[] | undefined {
    return this.environmentMachines;
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
