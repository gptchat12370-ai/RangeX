import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';

export type DeploymentStatus = 'DEPLOYING' | 'DEPLOYED' | 'PARKED' | 'FAILED' | 'FULL_TEARDOWN';

@Entity('deployment_environment')
export class DeploymentEnvironment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'varchar', length: 128 })
  deploymentName: string;

  @Column({ type: 'varchar', length: 32, default: 'DEPLOYING' })
  status: DeploymentStatus;

  @Column({ type: 'varchar', length: 256, nullable: true })
  gatewayEndpoint?: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  ecrRepositoryPrefix?: string;

  @Column({ type: 'text', nullable: true })
  gatewayTaskArn?: string;

  @Column({ type: 'json', nullable: true })
  machineTaskArns?: string[];

  @Column({ type: 'json', nullable: true })
  entrypointsConfig?: Array<{
    machineId: string;
    machineName: string;
    protocol: string;
    containerPort: number;
    externalPort: number;
    connectString: string;
  }>;

  @Column({ type: 'json', nullable: true })
  vpcEndpointIds?: string[];

  @Column({ type: 'varchar', length: 128, nullable: true })
  infraStackName?: string;

  @Column({ type: 'timestamp', nullable: true })
  deployedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  parkedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
