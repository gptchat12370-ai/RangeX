import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CareerPathItem } from './career-path-item.entity';

@Entity('career_path')
export class CareerPath {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImageUrl?: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ nullable: true })
  ownerUserId?: string;

  @OneToMany(() => CareerPathItem, (item) => item.careerPath, { cascade: true })
  items?: CareerPathItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
