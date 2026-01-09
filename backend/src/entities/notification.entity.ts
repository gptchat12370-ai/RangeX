import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notification' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ length: 64, default: 'info' })
  type: string; // info | warning | error | approval etc.

  @Column({ type: 'tinyint', default: 0 })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
