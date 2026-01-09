import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Scenario } from './scenario.entity';

@Entity()
export class ScenarioLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioId: string;

  @ManyToOne(() => Scenario, (scenario) => scenario.limits)
  scenario: Scenario;

  @Column({ type: 'int', default: 1 })
  maxConcurrentPlayers: number;
}
