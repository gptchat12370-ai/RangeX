import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { ImageVariant } from './image-variant.entity';

@Entity('creator_preferences')
export class CreatorPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  user: User;

  // Preferred image variants for each role
  @Column({ type: 'uuid', nullable: true })
  preferredAttackerVariantId?: string;

  @ManyToOne(() => ImageVariant, { nullable: true })
  preferredAttackerVariant?: ImageVariant;

  @Column({ type: 'uuid', nullable: true })
  preferredVictimVariantId?: string;

  @ManyToOne(() => ImageVariant, { nullable: true })
  preferredVictimVariant?: ImageVariant;

  @Column({ type: 'uuid', nullable: true })
  preferredServiceVariantId?: string;

  @ManyToOne(() => ImageVariant, { nullable: true })
  preferredServiceVariant?: ImageVariant;

  // Default resource profile
  @Column({ type: 'varchar', length: 24, default: 'small' })
  defaultResourceProfile: string; // 'micro', 'small', 'medium', 'large'

  // Docker registry credentials (encrypted)
  @Column({ type: 'varchar', length: 255, nullable: true })
  dockerRegistryUrl?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  dockerUsername?: string;

  @Column({ type: 'text', nullable: true })
  dockerPasswordEncrypted?: string; // Encrypted with AES

  // Notification preferences
  @Column({ default: true })
  notifyOnApproval: boolean;

  @Column({ default: true })
  notifyOnRejection: boolean;

  @Column({ default: false })
  notifyOnCostAlert: boolean;

  // Cost alert threshold (RM/hour)
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  costAlertThreshold?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
