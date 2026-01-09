import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 64 })
  type: string;

  @Column({ length: 255 })
  storageKey: string;

  @Column({ type: 'bigint' })
  sizeBytes: number;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  scenarioVersionId?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
