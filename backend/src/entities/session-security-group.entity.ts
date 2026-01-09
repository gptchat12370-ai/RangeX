import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EnvironmentSession } from './environment-session.entity';

@Entity('session_security_groups')
export class SessionSecurityGroup {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36, name: 'session_id' })
  sessionId: string;

  @Column('varchar', { length: 50, name: 'network_group' })
  networkGroup: string;

  @Column('varchar', { length: 36, nullable: true, name: 'machine_id' })
  machineId?: string;

  @Column('varchar', { length: 50, unique: true, name: 'security_group_id' })
  securityGroupId: string;

  @Column('varchar', { length: 255, name: 'security_group_name' })
  securityGroupName: string;

  @Column({
    type: 'enum',
    enum: ['creating', 'active', 'deleting', 'deleted'],
    default: 'creating',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt?: Date;

  @ManyToOne(() => EnvironmentSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: EnvironmentSession;
}
