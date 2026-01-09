import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Badge } from './badge.entity';
import { ScenarioVersion } from './scenario-version.entity';

@Entity({ name: 'badge_requirement' })
export class BadgeRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  badgeId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  scenarioId?: string;

  @Column({ type: 'varchar', length: 50, default: 'scenario_completion' })
  requirementType: string; // 'scenario_completion', 'challenge_count', etc.

  @ManyToOne(() => Badge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badgeId' })
  badge?: Badge;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scenarioId' })
  scenario?: ScenarioVersion;

  @CreateDateColumn()
  createdAt: Date;
}
