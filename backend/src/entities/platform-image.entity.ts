import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ResourceProfile } from './machine.entity';

@Entity()
export class PlatformImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 255 })
  imageRef: string;

  @Column({ default: false })
  compatibleAttacker: boolean;

  @Column({ default: false })
  compatibleInternal: boolean;

  @Column({ default: false })
  compatibleService: boolean;

  @Column({ type: 'json', nullable: true })
  purposeTags?: string[];

  @Column({ type: 'varchar', length: 24 })
  resourceProfile: ResourceProfile;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
