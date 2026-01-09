import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';
import { Team } from './team.entity';

@Entity('event_participation')
@Index(['eventId', 'totalPoints'])
export class EventParticipation {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  eventId: string;

  @Column('varchar', { length: 36, nullable: true })
  userId: string | null;

  @Column('varchar', { length: 36, nullable: true })
  teamId: string | null;

  @Column({
    type: 'enum',
    enum: ['player', 'team'],
  })
  participantType: 'player' | 'team';

  @Column('int', { default: 0 })
  totalPoints: number;

  @Column('int', { default: 0 })
  challengesCompleted: number;

  @Column('int', { nullable: true })
  rank: number | null;

  @CreateDateColumn()
  registeredAt: Date;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @ManyToOne(() => Team, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;
}
