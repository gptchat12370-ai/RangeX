import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Playlist } from './playlist.entity';
import { ScenarioVersion } from './scenario-version.entity';

@Entity({ name: 'playlist_item' })
export class PlaylistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playlistId: string;

  @ManyToOne(() => Playlist, (playlist) => playlist.items, { onDelete: 'CASCADE' })
  playlist: Playlist;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  scenarioVersion: ScenarioVersion;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
