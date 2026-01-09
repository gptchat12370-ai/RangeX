import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Scenario } from './scenario.entity';
import { Machine } from './machine.entity';
import { ScenarioAsset } from './scenario-asset.entity';

export enum ScenarioVersionStatus {
  DRAFT = 'DRAFT',           // Creator editing
  SUBMITTED = 'SUBMITTED',   // Creator requested review
  APPROVED = 'APPROVED',     // Admin approved; build pipeline runs
  PUBLISHED = 'PUBLISHED',   // Ready for solvers; deployments allowed
  REJECTED = 'REJECTED',     // Admin rejected with reason
  ARCHIVED = 'ARCHIVED',     // Old versions
}

export type ScenarioType = 'challenge' | 'open_lab' | 'event_lab';

@Entity()
export class ScenarioVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioId: string;

  @ManyToOne(() => Scenario, (scenario) => scenario.versions)
  scenario: Scenario;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'varchar', length: 24 })
  status: ScenarioVersionStatus;

  @Column({ length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 400 })
  shortDescription: string;

  @Column({ length: 64 })
  difficulty: string;

  @Column({ length: 64 })
  category: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl?: string;

  @Column({ type: 'int', default: 60 })
  estimatedMinutes: number;

  @Column({ type: 'varchar', length: 24 })
  scenarioType: ScenarioType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  creatorName?: string;

  @Column({ default: true })
  requiresMachines: boolean;

  @Column({ type: 'text', nullable: true })
  codeOfEthics?: string;

  @Column({ type: 'text', nullable: true })
  learningOutcomes?: string;

  @Column({ type: 'varchar', length: 24, default: 'instant' })
  validationMode: string;

  @Column({ type: 'varchar', length: 24, default: 'allOrNothing' })
  scoringMode: string;

  @Column({ type: 'varchar', length: 24, default: 'disabled' })
  hintMode: string;

  @Column({ type: 'text' })
  missionText: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'text' })
  solutionWriteup: string;

  @Column({ type: 'json', nullable: true })
  questions?: any[];

  @Column({ type: 'json', nullable: true })
  hints?: any[];

  @Column({ type: 'datetime', nullable: true })
  submittedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  promotedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId?: string | null;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectReason?: string | null;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ type: 'datetime', nullable: true })
  archivedAt?: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  dockerComposePath?: string | null;

  @Column({ default: false })
  ecrImagesPushed: boolean;

  @Column({ default: false })
  embeddedAssetsDeleted: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fargateTaskDefinition?: string | null;

  @Column({ type: 'json', nullable: true })
  artifactHashes?: {
    compose?: string;
    manifest?: string;
    images?: Record<string, string>; // imageKey -> sha256
    assets?: Record<string, string>; // assetKey -> sha256
  };

  @Column({ type: 'varchar', length: 64, nullable: true })
  submittedHash?: string | null; // Combined hash for immutability proof

  @Column({ type: 'json', nullable: true })
  runtimeManifest?: any; // AWS-ready deployment manifest (ECS task defs, SG rules, etc.)

  @Column({ type: 'text', nullable: true })
  buildLogs?: string; // ECR build pipeline logs

  @Column({ type: 'varchar', length: 24, nullable: true })
  buildStatus?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | null; // Build pipeline status

  @Column({ type: 'datetime', nullable: true })
  publishedAt?: Date | null; // When marked PUBLISHED

  // LOCAL CONTROL-PLANE + EPHEMERAL AWS FIELDS
  @Column({ type: 'varchar', length: 24, default: 'NONE' })
  localTestStatus: 'NONE' | 'RUNNING' | 'PASS' | 'FAIL' | 'STOPPED'; // Local Docker test status

  @Column({ type: 'varchar', length: 24, default: 'NONE' })
  bundleStatus: 'NONE' | 'CREATING' | 'READY' | 'FAILED'; // Local bundle creation status

  @Column({ type: 'varchar', length: 512, nullable: true })
  bundlePath?: string; // MinIO path to scenario bundle (e.g., rangex-bundles/scenario-123/v1.bundle.json)

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  currentStage: 'draft' | 'local_test' | 'submitted' | 'review' | 'bundled' | 'deployed'; // Pipeline stage

  // Admin Cloud Testing Fields
  @Column({ type: 'uuid', nullable: true })
  lastAdminTestId?: string | null;

  @Column({ type: 'varchar', length: 24, default: 'none' })
  lastAdminTestStatus: 'none' | 'running' | 'passed' | 'failed';

  @Column({ default: false })
  publishingBlocked: boolean;

  @OneToMany(() => Machine, (machine) => machine.scenarioVersion, { cascade: true })
  machines?: Machine[];

  @OneToMany(() => ScenarioAsset, (asset) => asset.scenarioVersion, { cascade: true })
  assets?: ScenarioAsset[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
