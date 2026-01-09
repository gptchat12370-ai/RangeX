import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Asset } from './asset.entity';
import { ScenarioVersion } from './scenario-version.entity';

@Entity({ name: 'asset_scenario_version' })
export class AssetScenarioVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  asset: Asset;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  scenarioVersion: ScenarioVersion;
}
