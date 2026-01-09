import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EnvironmentSession } from './environment-session.entity';

@Entity('session_network_topology')
export class SessionNetworkTopology {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36, name: 'session_id' })
  sessionId: string;

  @Column('varchar', { length: 100, name: 'machine_name' })
  machineName: string;

  @Column('varchar', { length: 50, nullable: true, name: 'machine_role' })
  machineRole?: string;

  @Column('varchar', { length: 50, nullable: true, name: 'network_group' })
  networkGroup?: string;

  @Column('varchar', { length: 255, name: 'task_arn' })
  taskArn: string;

  @Column('varchar', { length: 15, name: 'private_ip' })
  privateIp: string;

  @Column('varchar', { length: 50, name: 'subnet_id' })
  subnetId: string;

  @Column('varchar', { length: 50, name: 'security_group_id' })
  securityGroupId: string;

  @Column('varchar', { length: 50, nullable: true, name: 'network_interface_id' })
  networkInterfaceId?: string;

  @Column({
    type: 'enum',
    enum: ['provisioning', 'running', 'stopped', 'terminated'],
    default: 'provisioning',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => EnvironmentSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: EnvironmentSession;
}
