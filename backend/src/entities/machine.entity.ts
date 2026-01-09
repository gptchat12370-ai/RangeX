import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ScenarioVersion } from './scenario-version.entity';
import { RegistryCredential } from './registry-credential.entity';

export type MachineRole = 'attacker' | 'internal' | 'service';
export const MACHINE_ROLES = ['attacker', 'internal', 'service'] as const;
export type ImageSourceType = 'platform_library' | 'custom_image';
export const IMAGE_SOURCE_TYPES = ['platform_library', 'custom_image'] as const;
export type ResourceProfile = 'micro' | 'small' | 'medium' | 'large';
export const RESOURCE_PROFILES = ['micro', 'small', 'medium', 'large'] as const;

// Entrypoint defines how solvers access a machine
export interface MachineEntrypoint {
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp';
  containerPort: number;
  exposedToSolver: boolean;
  description?: string; // e.g., "Web UI", "SSH Access", "RDP Console"
}

// Healthcheck configuration
export interface MachineHealthcheck {
  test: string[]; // e.g., ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
  intervalSec?: number;
  timeoutSec?: number;
  retries?: number;
  startPeriodSec?: number;
}

// Attacker bootstrap configuration (ONLY for attacker role)
export interface AttackerBootstrap {
  installPackages?: string[]; // apt packages to install
  runCommands?: string[]; // post-install commands
  browserRequired?: boolean; // ensures GUI image with browser
}

// Compose extensions (local-only, allowlisted)
export interface ComposeExtensions {
  shmSize?: string; // e.g., "512m"
  capAdd?: string[]; // e.g., ["NET_ADMIN", "NET_RAW"]
  sysctls?: Record<string, string>; // allowlisted only
  ulimits?: Record<string, any>; // allowlisted only
  extraHosts?: string[]; // local-only
  volumes?: string[]; // local-only, STRICTLY no docker.sock
}

@Entity()
export class Machine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scenarioVersionId: string;

  @ManyToOne(() => ScenarioVersion, (version) => version.machines)
  scenarioVersion: ScenarioVersion;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  role: MachineRole;

  @Column({ type: 'varchar', length: 32 })
  imageSourceType: ImageSourceType;

  @Column({ type: 'varchar', length: 255 })
  imageRef: string;

  @Column({ type: 'uuid', nullable: true })
  imageVariantId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  registryCredentialId?: string | null;

  @ManyToOne(() => RegistryCredential, (cred) => cred.machines, { nullable: true })
  registryCredential?: RegistryCredential | null;

  @Column({ type: 'varchar', length: 64 })
  networkGroup: string;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  networkEgressPolicy: 'none' | 'session-only' | 'internet';

  @Column({ type: 'varchar', length: 255, nullable: true })
  fargateTaskDefinition?: string | null;

  @Column({ type: 'varchar', length: 24 })
  resourceProfile: ResourceProfile;

  @Column({ default: false })
  allowSolverEntry: boolean;

  @Column({ default: false })
  allowFromAttacker: boolean;

  @Column({ default: false })
  allowInternalConnections: boolean;

  @Column({ default: false })
  isPivotHost: boolean;

  @Column({ type: 'text', nullable: true })
  startupCommands?: string;

  @Column({ type: 'json', nullable: true })
  entrypoints?: MachineEntrypoint[];

  // SSH/RDP Credentials
  @Column({ type: 'varchar', length: 64, nullable: true, default: 'root' })
  sshUsername?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sshPassword?: string; // Encrypted in production

  // Phase 4: ECR promotion fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  ecrUri?: string;

  @Column({ type: 'varchar', length: 71, nullable: true })
  ecrDigest?: string; // sha256:... (71 chars max)

  @Column({ type: 'varchar', length: 255, nullable: true })
  taskDefinitionArn?: string;

  // Phase 1: ECR image reference for multi-container task definitions
  @Column({ type: 'varchar', length: 255, nullable: true })
  ecrRepository?: string; // Format: rangex/{base-image}:scenario-{scenarioId}

  // Phase 2-3: Creator configurability
  @Column({ type: 'json', nullable: true })
  envVars?: Record<string, string>; // Additional environment variables

  @Column({ type: 'json', nullable: true })
  command?: string | string[]; // Container command override

  @Column({ type: 'json', nullable: true })
  entrypoint?: string | string[]; // Entrypoint override

  @Column({ type: 'json', nullable: true })
  dependsOn?: string[]; // Names/IDs of other machines

  @Column({ type: 'json', nullable: true })
  healthcheck?: MachineHealthcheck;

  @Column({ type: 'json', nullable: true })
  networkAliases?: string[]; // Local compose only

  @Column({ type: 'json', nullable: true })
  solverHints?: string[]; // Shown in Solver UI (e.g., "Open DVWA at http://web-server/")

  @Column({ type: 'json', nullable: true })
  attackerBootstrap?: AttackerBootstrap; // ONLY for attacker role

  @Column({ type: 'json', nullable: true })
  composeExtensions?: ComposeExtensions; // Local-only, guarded

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
