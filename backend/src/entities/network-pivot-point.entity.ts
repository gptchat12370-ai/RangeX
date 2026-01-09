import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';

@Entity('network_pivot_points')
export class NetworkPivotPoint {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  scenarioVersionId: string;

  @Column('varchar', { length: 50 })
  sourceNetworkGroup: string;

  @Column('varchar', { length: 50 })
  targetNetworkGroup: string;

  @Column('text', { nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;
}
