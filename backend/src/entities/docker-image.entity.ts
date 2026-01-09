import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'docker_image' })
export class DockerImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, default: 'latest' })
  tag: string;

  @Column({ length: 255, default: 'docker.io' })
  registryUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  category: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isReadyImage: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator: User;
  @Column({ length: 500, nullable: true })
  minioPath?: string;

  @Column({ length: 255, nullable: true })
  ecrImageDigest?: string;

  @Column({ type: 'int', nullable: true })
  imageSizeMb?: number;

  @Column({ type: 'int', default: 0 })
  pullCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastPulledAt?: Date;
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
