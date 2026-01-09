import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Machine } from './machine.entity';

@Entity()
export class RegistryCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  label: string;

  @Column({ length: 200 })
  registryUrl: string;

  @Column({ type: 'varbinary', length: 512 })
  usernameEnc: Buffer;

  @Column({ type: 'varbinary', length: 512 })
  passwordOrTokenEnc: Buffer;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => Machine, (machine) => machine.registryCredential)
  machines?: Machine[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastTestedAt?: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
