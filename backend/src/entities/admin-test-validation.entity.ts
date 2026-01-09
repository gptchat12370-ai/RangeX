import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ScenarioVersionAdminTest } from './scenario-version-admin-test.entity';

@Entity('admin_test_validations')
export class AdminTestValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adminTestId: string;

  @ManyToOne(() => ScenarioVersionAdminTest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminTestId' })
  adminTest: ScenarioVersionAdminTest;

  @Column({ type: 'uuid', nullable: true })
  machineId?: string; // Machine template ID being tested

  @Column({ type: 'varchar', length: 255, nullable: true })
  machineName?: string;

  @Column({ type: 'enum', enum: ['task_running', 'private_ip', 'entrypoint_reachable', 'segmentation', 'credentials'] })
  checkType: 'task_running' | 'private_ip' | 'entrypoint_reachable' | 'segmentation' | 'credentials';

  @Column({ type: 'varchar', length: 255, nullable: true })
  checkTarget?: string; // Entrypoint being tested or segmentation rule

  @Column({ type: 'enum', enum: ['pass', 'fail', 'skip'] })
  status: 'pass' | 'fail' | 'skip';

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'json', nullable: true })
  details?: any;

  @CreateDateColumn()
  checkedAt: Date;
}
