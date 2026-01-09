import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';

@Entity('event_registration')
@Unique('uniq_event_user', ['eventId', 'userId'])
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Event, (event) => event.registrations, { onDelete: 'CASCADE' })
  event: Event;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}
