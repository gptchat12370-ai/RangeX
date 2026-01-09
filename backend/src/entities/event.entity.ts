import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EventScenario } from './event-scenario.entity';
import { EventRegistration } from './event-registration.entity';

export type EventFormat = 'Player vs Player' | 'Team vs Team';

@Entity('event')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImageUrl?: string;

  @Column({ type: 'datetime', nullable: true })
  startDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  endDate?: Date;

  @Column({ length: 64, default: 'UTC' })
  timezone: string;

  @Column({ type: 'int', default: 0 })
  maxParticipants: number;

  @Column({ type: 'varchar', length: 24, default: 'Player vs Player' })
  format: EventFormat;

  @Column({ type: 'simple-json', nullable: true })
  participatingTeamIds?: string[];

  @Column({ default: true })
  registrationRequired: boolean;

  @Column({ nullable: true })
  createdByUserId?: string;

  @OneToMany(() => EventScenario, (es) => es.event, { cascade: true })
  scenarios?: EventScenario[];

  @OneToMany(() => EventRegistration, (er) => er.event, { cascade: true })
  registrations?: EventRegistration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
