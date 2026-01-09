import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OneToMany } from 'typeorm';
import { PlaylistItem } from './playlist-item.entity';

@Entity({ name: 'playlist' })
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImageUrl?: string;

  @Column({ default: false, type: 'tinyint' })
  isPublic: boolean;

  @Column({ type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @OneToMany(() => PlaylistItem, (item) => item.playlist, { cascade: true })
  items?: PlaylistItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
