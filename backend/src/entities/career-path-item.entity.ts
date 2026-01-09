import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CareerPath } from './career-path.entity';
import { ScenarioVersion } from './scenario-version.entity';

@Entity('career_path_item')
export class CareerPathItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  careerPathId: string;

  @ManyToOne(() => CareerPath, (cp) => cp.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'careerPathId' })
  careerPath: CareerPath;

  @Column()
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioVersionId' })
  scenarioVersion: ScenarioVersion;

  @Column({ default: 0 })
  sortOrder: number;
}
