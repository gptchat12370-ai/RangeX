import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tool')
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  version: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  installCommand: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  fileUrl: string; // MinIO object URL for uploaded asset files (binaries, scripts, etc.)

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number; // File size if uploaded to MinIO

  @Column({ type: 'varchar', length: 100, nullable: true })
  fileChecksum: string; // SHA256 checksum for integrity verification

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  packageName: string; // apt, yum, apk package name

  @Column({ type: 'varchar', length: 100, nullable: true })
  packageManager: string; // apt, yum, apk, npm, pip, etc.

  @Column({ type: 'int', default: 0 })
  usageCount: number; // Track how many scenarios use this tool

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
