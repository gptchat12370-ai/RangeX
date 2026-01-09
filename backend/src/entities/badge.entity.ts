import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'badge' })
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ length: 500, nullable: true, default: 'https://api.dicebear.com/7.x/icons/svg?seed=badge&icon=shield' })
  iconUrl: string;

  @Column({ length: 120 })
  criteria: string; // e.g., 'challenges_completed_5'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
