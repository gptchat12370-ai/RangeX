import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';
import { ScenarioLimit } from './scenario-limit.entity';

@Entity()
export class Scenario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.00 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  totalRatings: number;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @Column({ default: false })
  isPublished: boolean;

  @OneToMany(() => ScenarioVersion, (version) => version.scenario, { cascade: true })
  versions?: ScenarioVersion[];

  @OneToMany(() => ScenarioLimit, (limit) => limit.scenario, { cascade: true })
  limits?: ScenarioLimit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
