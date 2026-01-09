import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';
import { Machine } from './machine.entity';

@Entity({ name: 'scenario_asset' })
export class ScenarioAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, (version) => version.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'uuid', nullable: true })
  machineId?: string;

  @ManyToOne(() => Machine, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'machineId' })
  machine?: Machine;

  @Column({ type: 'enum', enum: ['tool', 'script', 'file', 'wordlist', 'config'], nullable: true })
  assetType?: 'tool' | 'script' | 'file' | 'wordlist' | 'config';

  @Column({ type: 'enum', enum: ['machine-embedded', 'downloadable'], nullable: true })
  assetLocation?: 'machine-embedded' | 'downloadable';

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  minioPath?: string;

  @Column({ default: false })
  deletedFromMinio: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  targetPath?: string; // Where to mount in container e.g., /var/www/html/flag.txt

  @Column({ type: 'varchar', length: 10, nullable: true, default: '0644' })
  permissions?: string; // File permissions e.g., 0755

  @Column({ type: 'text', nullable: true })
  description?: string; // Purpose of this asset

  @Column({ type: 'int', nullable: true })
  fileSize: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;
}
