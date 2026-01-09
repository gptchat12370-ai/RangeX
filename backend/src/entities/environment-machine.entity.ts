import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EnvironmentSession } from './environment-session.entity';
import { MachineRole } from './machine.entity';

@Entity()
export class EnvironmentMachine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  environmentSessionId: string;

  @ManyToOne(() => EnvironmentSession, (session) => session.environmentMachines)
  environmentSession: EnvironmentSession;

  @Column({ type: 'uuid' })
  machineId: string; // References Machine.id (the machine template)

  @Column({ type: 'uuid', nullable: true })
  machineTemplateId?: string; // Backward compatibility

  @Column({ length: 200, nullable: true })
  taskArn?: string;

  @Column({ length: 64, nullable: true })
  privateIp?: string;

  @Column({ length: 50, nullable: true })
  securityGroupId?: string;

  @Column({ type: 'varchar', length: 24, default: 'starting' })
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed' | 'healthy';

  @Column({ type: 'varchar', length: 32 })
  role: MachineRole;

  @CreateDateColumn()
  createdAt: Date;
}
