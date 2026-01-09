import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ length: 255, select: false })
  passwordHash: string;

  @Column({ length: 120 })
  displayName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  roleSolver: boolean;

  @Column({ default: false })
  roleCreator: boolean;

  @Column({ default: false })
  roleAdmin: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true, select: false })
  twofaSecret?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastIp?: string | null;

  @Column({ type: 'datetime', nullable: true })
  passwordUpdatedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
