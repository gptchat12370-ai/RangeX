import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TeamMember } from './team-member.entity';

@Entity({ name: 'team' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  motto?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  ownerUserId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  leaderId?: string;

  @Column({ type: 'int', default: 0 })
  eventPoints: number;

  @Column({ type: 'int', default: 10 })
  maxMembers: number;

  @Column({ type: 'tinyint', default: 0 })
  openTeam: boolean;

  @Column({ type: 'tinyint', default: 1 })
  registrationsOpen: boolean;

  @OneToMany(() => TeamMember, (m) => m.team, { cascade: true })
  members?: TeamMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
