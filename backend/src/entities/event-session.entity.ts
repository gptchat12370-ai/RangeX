import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Event } from './event.entity';
import { EventParticipation } from './event-participation.entity';
import { ScenarioVersion } from './scenario-version.entity';

@Entity('event_sessions')
export class EventSession {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  eventId: string;

  @Column('varchar', { length: 36 })
  participationId: string;

  @Column('varchar', { length: 36 })
  scenarioVersionId: string;

  @Column('varchar', { length: 36, nullable: true })
  userId: string | null; // Track which user completed this (for team events)

  @Column({
    type: 'enum',
    enum: ['solo', 'team'],
  })
  mode: 'solo' | 'team';

  @Column({
    type: 'enum',
    enum: ['InProgress', 'Completed', 'Failed'],
    default: 'InProgress',
  })
  status: 'InProgress' | 'Completed' | 'Failed';

  @Column('int', { default: 0 })
  score: number;

  @Column('int', { default: 0 })
  progressPct: number;

  @CreateDateColumn()
  startedAt: Date;

  @Column('datetime', { nullable: true })
  finishedAt: Date | null;

  @Column('json', { nullable: true })
  answers: any;

  @Column('varchar', { length: 64, nullable: true })
  answersHash: string | null; // SHA256 hash of answers for integrity validation

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => EventParticipation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participationId' })
  participation: EventParticipation;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenario: ScenarioVersion;
}
