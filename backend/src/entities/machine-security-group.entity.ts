import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EnvironmentSession } from './environment-session.entity';

export type MachineSgStatus = 'creating' | 'active' | 'deleting' | 'deleted' | 'failed';

export interface IngressSource {
  machineId?: string;
  machineName?: string;
  cidr?: string;
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  fromPort?: number;
  toPort?: number;
  description?: string;
}

export interface EgressTarget {
  machineId?: string;
  machineName?: string;
  cidr?: string;
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  fromPort?: number;
  toPort?: number;
  description?: string;
}

export interface ExposedPort {
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
  containerPort: number;
  exposedToSolver: boolean;
  description?: string;
}

export interface AwsSgMetadata {
  vpcId: string;
  ingressRuleIds?: string[];
  egressRuleIds?: string[];
  region: string;
  lastSyncAt?: Date;
}

@Entity('machine_security_groups')
export class MachineSecurityGroup {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  sessionId: string;

  @Column('varchar', { length: 36 })
  machineId: string;

  @Column('varchar', { length: 255 })
  machineName: string;

  @Column('varchar', { length: 100 })
  networkGroup: string;

  @Column('varchar', { length: 100, comment: 'AWS security group ID (sg-xxxxx)' })
  securityGroupId: string;

  @Column('varchar', { length: 255 })
  securityGroupName: string;

  @Column('json', {
    nullable: true,
    comment: 'List of allowed source machine IDs or CIDR blocks',
  })
  allowedIngressSources: IngressSource[] | null;

  @Column('json', {
    nullable: true,
    comment: 'List of allowed destination machine IDs or CIDR blocks',
  })
  allowedEgressTargets: EgressTarget[] | null;

  @Column('json', {
    nullable: true,
    comment: 'List of ports exposed to solver via gateway proxy',
  })
  exposedPorts: ExposedPort[] | null;

  @Column('enum', {
    enum: ['creating', 'active', 'deleting', 'deleted', 'failed'],
    default: 'creating',
  })
  status: MachineSgStatus;

  @Column('json', {
    nullable: true,
    comment: 'AWS-specific metadata (VPC ID, rules, etc)',
  })
  awsMetadata: AwsSgMetadata | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  // Relations
  @ManyToOne(() => EnvironmentSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: EnvironmentSession;
}
