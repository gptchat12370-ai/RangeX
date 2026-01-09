import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string; // VALIDATE_SUBMISSION, SCAN_SUBMISSION, PROMOTE_TO_ECR, TEST_DEPLOYMENT, etc.

  @Column({ default: 'pending' })
  status: string; // pending, processing, completed, failed

  @Column('json')
  payload: any;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'text', nullable: true })
  result: string | null; // JSON result from job execution

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
