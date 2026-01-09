import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { Badge } from './badge.entity';

@Entity({ name: 'user_badge' })
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid' })
  badgeId: string;

  @ManyToOne(() => Badge, { onDelete: 'CASCADE' })
  badge: Badge;

  @CreateDateColumn()
  earnedAt: Date;
}
