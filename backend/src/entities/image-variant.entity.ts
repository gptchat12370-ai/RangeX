import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { MachineEntrypoint } from './machine.entity';

@Entity('image_variants')
export class ImageVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  baseOs: string; // 'kali', 'ubuntu', 'windows', 'alpine', 'debian'

  @Column({ type: 'varchar', length: 16 })
  variantType: string; // 'lite', 'standard', 'full'

  @Column({ type: 'varchar', length: 255 })
  imageRef: string; // Docker image reference (e.g., 'kalilinux/kali-last-release:2024.1')

  @Column({ type: 'varchar', length: 100, nullable: true })
  version: string; // Specific version (e.g., '2024.1', '22.04', 'v1.16.1')

  @Column({ type: 'varchar', length: 50, default: 'library' })
  imageCategory: string; // 'attacker', 'library', 'service'

  @Column({ type: 'varchar', length: 120 })
  displayName: string; // 'Kali Linux Lite', 'Ubuntu Minimal', etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  // Resource allocation
  @Column({ type: 'decimal', precision: 3, scale: 2 })
  cpuCores: number; // 0.25, 0.5, 1.0, 2.0

  @Column({ type: 'integer' })
  memoryMb: number; // 128, 256, 512, 1024, 2048, 4096

  @Column({ type: 'integer' })
  diskGb: number; // 5, 10, 20, 30, 50

  // AWS Fargate cost (RM/hour)
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  hourlyCostRm: number;

  // Role compatibility
  @Column({ type: 'simple-array' })
  suitableForRoles: string[]; // ['attacker', 'victim', 'service', 'internal']

  // Tools/packages included (for informational purposes)
  @Column({ type: 'simple-array', nullable: true })
  includedTools: string[]; // ['nmap', 'sqlmap', 'metasploit'] for Kali

  // Admin control
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isAdminApproved: boolean; // Only approved variants can be used

  // Connection contract - defines default entrypoints for this image
  @Column({ type: 'json', nullable: true })
  defaultEntrypoints?: MachineEntrypoint[]; // Auto-populated when creator selects this image

  @Column({ type: 'boolean', nullable: true, default: false })
  defaultAllowSolverEntry?: boolean; // Default: allow external solver access to machines from this variant

  @Column({ type: 'varchar', length: 50, nullable: true })
  defaultNetworkGroup?: string; // Default network isolation group: 'attacker', 'dmz', 'internal', 'mgmt', 'isolated'

  @Column({ type: 'enum', enum: ['none', 'session-only', 'internet'], nullable: true })
  defaultNetworkEgressPolicy?: 'none' | 'session-only' | 'internet'; // Outbound connectivity: none=no egress, session-only=internal only, internet=full

  @Column({ type: 'json', nullable: true })
  defaultHealthcheck?: {
    command?: string[];
    interval?: number;
    timeout?: number;
    retries?: number;
    startPeriod?: number;
  }; // Default ECS health check configuration

  @Column({ type: 'boolean', nullable: true, default: false })
  hasGui?: boolean; // Has desktop GUI (VNC, RDP, Kasm, noVNC)

  @Column({ type: 'varchar', length: 64, nullable: true })
  recommendedNetworkGroup?: string; // 'attacker', 'dmz', 'internal', 'mgmt'

  @Column({ type: 'text', nullable: true })
  notes?: string; // Admin notes about this image variant

  // Tags for filtering
  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // ['penetration-testing', 'web-server', 'database']

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
