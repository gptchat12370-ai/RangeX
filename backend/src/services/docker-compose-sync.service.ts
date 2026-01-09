import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { PLATFORM_LIMITS, getResourceProfile, isAllowedPort, getDefaultProfileForRole } from '../config/platform-limits.config';
import * as crypto from 'crypto';

export interface ValidationCorrection {
  fieldPath: string;
  from: any;
  to: any;
  reason: string;
}

export interface ComposeValidationResult {
  status: 'SYNCED' | 'OUT_OF_SYNC';
  warnings: string[];
  corrections: ValidationCorrection[];
  estimatedCost: {
    hourlyRM: number;
    dailyRM: number;
    currency: string;
  };
  finalCompose: any;
  finalComposeYAML: string;
  normalizedEnvironmentSnapshot: any;
}

@Injectable()
export class DockerComposeSyncService {
  private readonly logger = new Logger(DockerComposeSyncService.name);

  constructor(
    @InjectRepository(ScenarioVersion)
    private versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
  ) {}

  /**
   * Main validation and generation function
   */
  async validateAndGenerateCompose(
    scenarioVersionId: string,
    mode: 'local_compose' | 'aws_runtime' = 'local_compose',
  ): Promise<ComposeValidationResult> {
    this.logger.log(`Validating and generating compose for version ${scenarioVersionId}, mode: ${mode}`);

    const version = await this.versionRepo.findOne({
      where: { id: scenarioVersionId },
    });

    if (!version) {
      throw new Error('Scenario version not found');
    }

    const machines = await this.machineRepo.find({
      where: { scenarioVersionId },
    });

    const warnings: string[] = [];
    const corrections: ValidationCorrection[] = [];

    // 1. Validate machine count
    if (machines.length > PLATFORM_LIMITS.MAX_MACHINES_PER_SCENARIO) {
      throw new Error(
        `Too many machines: ${machines.length} (max ${PLATFORM_LIMITS.MAX_MACHINES_PER_SCENARIO})`,
      );
    }

    // 2. Normalize and validate each machine
    const normalizedMachines = [];
    for (const machine of machines) {
      const normalized = await this.normalizeMachine(machine, corrections, warnings);
      normalizedMachines.push(normalized);
    }

    // 3. Generate compose config
    const composeConfig = await this.generateComposeConfig(
      normalizedMachines,
      version,
      mode,
      corrections,
      warnings,
    );

    // 4. Convert to YAML
    const finalComposeYAML = this.exportAsYAML(composeConfig);

    // 5. Calculate estimated cost
    const estimatedCost = this.calculateCost(normalizedMachines);

    // 6. Create normalized snapshot
    const normalizedEnvironmentSnapshot = {
      machines: normalizedMachines.map((m) => ({
        name: m.name,
        role: m.role,
        image: this.canonicalizeImage(m.imageRef),
        resourceProfile: m.resourceProfile,
        entrypoints: m.entrypoints || [],
        networkGroup: m.networkGroup,
      })),
      version: scenarioVersionId,
      timestamp: new Date().toISOString(),
    };

    return {
      status: 'SYNCED',
      warnings,
      corrections,
      estimatedCost,
      finalCompose: composeConfig,
      finalComposeYAML,
      normalizedEnvironmentSnapshot,
    };
  }

  /**
   * Normalize and validate a single machine
   */
  private async normalizeMachine(
    machine: Machine,
    corrections: ValidationCorrection[],
    warnings: string[],
  ): Promise<Machine> {
    const normalized = { ...machine };

    // Canonicalize image
    const canonicalImage = this.canonicalizeImage(machine.imageRef);
    if (canonicalImage !== machine.imageRef) {
      corrections.push({
        fieldPath: `machines.${machine.name}.image`,
        from: machine.imageRef,
        to: canonicalImage,
        reason: 'Normalized image tag',
      });
      normalized.imageRef = canonicalImage;
    }

    // Validate and correct resource profile
    if (!normalized.resourceProfile) {
      const defaultProfile = getDefaultProfileForRole(machine.role as any);
      corrections.push({
        fieldPath: `machines.${machine.name}.resourceProfile`,
        from: null,
        to: defaultProfile,
        reason: `Applied default profile for ${machine.role} role`,
      });
      normalized.resourceProfile = defaultProfile as any;
    }

    // Validate resource limits
    const profile = getResourceProfile(normalized.resourceProfile as any);
    if (profile.cpu > PLATFORM_LIMITS.MAX_RESOURCES.cpu) {
      corrections.push({
        fieldPath: `machines.${machine.name}.cpu`,
        from: profile.cpu,
        to: PLATFORM_LIMITS.MAX_RESOURCES.cpu,
        reason: 'Exceeded maximum CPU limit',
      });
    }

    if (profile.memory > PLATFORM_LIMITS.MAX_RESOURCES.memory) {
      corrections.push({
        fieldPath: `machines.${machine.name}.memory`,
        from: profile.memory,
        to: PLATFORM_LIMITS.MAX_RESOURCES.memory,
        reason: 'Exceeded maximum memory limit',
      });
    }

    // Validate entrypoints
    const entrypoints = normalized.entrypoints || [];
    if (entrypoints.length > PLATFORM_LIMITS.MAX_EXPOSED_PORTS_PER_MACHINE) {
      warnings.push(
        `Machine ${machine.name} has ${entrypoints.length} entrypoints (max ${PLATFORM_LIMITS.MAX_EXPOSED_PORTS_PER_MACHINE})`,
      );
    }

    for (const ep of entrypoints) {
      if (!isAllowedPort(ep.containerPort)) {
        warnings.push(
          `Machine ${machine.name} has disallowed port ${ep.containerPort}. Allowed: ${PLATFORM_LIMITS.ALLOWED_CONTAINER_PORTS.join(', ')}`,
        );
      }
    }

    return normalized;
  }

  /**
   * Generate Docker Compose configuration
   */
  private async generateComposeConfig(
    machines: Machine[],
    version: ScenarioVersion,
    mode: 'local_compose' | 'aws_runtime',
    corrections: ValidationCorrection[],
    warnings: string[],
  ): Promise<any> {
    const services: any = {};
    const networks: any = {};
    const usedHostPorts = new Set<number>();

    // Track network groups
    const networkGroups = new Set<string>();
    for (const machine of machines) {
      networkGroups.add(machine.networkGroup);
    }

    // Create networks
    for (const networkGroup of networkGroups) {
      const subnet = this.generateSubnet(networkGroup);
      networks[networkGroup] = {
        driver: 'bridge',
        ipam: {
          config: [{ subnet }],
        },
        labels: {
          'rangex.scenario-version': version.id,
          'rangex.network-group': networkGroup,
        },
      };
    }

    // Create services
    for (const machine of machines) {
      const profile = getResourceProfile(machine.resourceProfile as any);
      const serviceName = this.sanitizeName(machine.name);
      const service: any = {
        image: machine.imageRef,
        container_name: serviceName,
        hostname: serviceName,
        mem_limit: `${profile.memory}m`,
        cpus: profile.cpu.toString(),
        networks: [machine.networkGroup],
        labels: {
          'rangex.scenario.name': version.scenarioId,
          'rangex.scenario.creator': 'creator-id', // TODO: Get from version
          'rangex.scenario-version': version.id,
          'rangex.role': machine.role,
          'rangex.resource-profile': machine.resourceProfile,
        },
      };

      // Add ports for local_compose mode
      if (mode === 'local_compose') {
        const ports = [];
        const entrypoints = machine.entrypoints || [];

        for (const ep of entrypoints) {
          if (ep.exposedToSolver && machine.allowSolverEntry) {
            let hostPort: number;

            // Special handling for Kasm GUI
            if (ep.containerPort === PLATFORM_LIMITS.KASM_GUI_PORT) {
              hostPort = PLATFORM_LIMITS.KASM_GUI_PORT;
              if (usedHostPorts.has(hostPort)) {
                hostPort = this.allocateHostPort(usedHostPorts);
              }
            } else {
              hostPort = this.allocateHostPort(usedHostPorts);
            }

            usedHostPorts.add(hostPort);
            ports.push(`${hostPort}:${ep.containerPort}`);
          }
        }

        if (ports.length > 0) {
          service.ports = ports;
        }
      }

      // Add environment variables for GUI images
      if (machine.role === 'attacker' && machine.imageRef.includes('kasm')) {
        service.environment = service.environment || [];
        service.environment.push('VNC_PW=vncpassword');
        service.shm_size = '512m';
      }

      // Add startup commands
      if (machine.startupCommands) {
        service.command = machine.startupCommands;
      }

      services[serviceName] = service;
    }

    return {
      version: '3.8',
      services,
      networks,
    };
  }

  /**
   * Canonicalize image reference (normalize tags)
   */
  private canonicalizeImage(image: string): string {
    // If no tag specified, keep it without :latest
    // This prevents "repo" vs "repo:latest" mismatches
    if (!image.includes(':')) {
      return image;
    }
    return image;
  }

  /**
   * Check if two images are equivalent
   */
  public imagesEqual(img1: string, img2: string): boolean {
    const canon1 = img1.includes(':') ? img1 : `${img1}:latest`;
    const canon2 = img2.includes(':') ? img2 : `${img2}:latest`;
    return canon1 === canon2;
  }

  /**
   * Generate subnet for network group
   */
  private generateSubnet(networkGroup: string): string {
    // Use stable hashing to allocate /24 subnets within 172.16.0.0/12
    const hash = crypto.createHash('md5').update(networkGroup).digest();
    const octet2 = 16 + (hash[0] % 16); // 172.16-31.x.x
    const octet3 = hash[1]; // 172.x.0-255.x

    return `172.${octet2}.${octet3}.0/24`;
  }

  /**
   * Allocate unique host port
   */
  private allocateHostPort(usedPorts: Set<number>): number {
    for (
      let port = PLATFORM_LIMITS.HOST_PORT_RANGE.start;
      port < PLATFORM_LIMITS.HOST_PORT_RANGE.end;
      port++
    ) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }
    throw new Error('No available host ports');
  }

  /**
   * Calculate estimated cost
   */
  private calculateCost(machines: Machine[]): {
    hourlyRM: number;
    dailyRM: number;
    currency: string;
  } {
    // Fargate pricing in ap-south-2 (Hyderabad)
    const CPU_PRICE_PER_VCPU_HOUR = 0.04556; // USD
    const MEMORY_PRICE_PER_GB_HOUR = 0.00533; // USD
    const USD_TO_RM = 4.5; // Approximate exchange rate

    let totalCostPerHour = 0;

    for (const machine of machines) {
      const profile = getResourceProfile(machine.resourceProfile as any);
      const cpuCost = profile.cpu * CPU_PRICE_PER_VCPU_HOUR;
      const memoryCost = (profile.memory / 1024) * MEMORY_PRICE_PER_GB_HOUR;
      totalCostPerHour += cpuCost + memoryCost;
    }

    const hourlyRM = totalCostPerHour * USD_TO_RM;
    const dailyRM = hourlyRM * 24;

    return {
      hourlyRM: parseFloat(hourlyRM.toFixed(4)),
      dailyRM: parseFloat(dailyRM.toFixed(2)),
      currency: 'RM',
    };
  }

  /**
   * Export compose config as YAML
   * FIXES: Now includes ports, mem_limit, cpus, shm_size, environment
   */
  private exportAsYAML(config: any): string {
    const lines: string[] = [];

    lines.push(`version: "${config.version}"`);
    lines.push('');
    lines.push('services:');

    for (const [serviceName, service] of Object.entries<any>(config.services)) {
      lines.push(`  ${serviceName}:`);
      lines.push(`    image: ${service.image}`);
      
      if (service.container_name) {
        lines.push(`    container_name: ${service.container_name}`);
      }
      
      if (service.hostname) {
        lines.push(`    hostname: ${service.hostname}`);
      }

      if (service.mem_limit) {
        lines.push(`    mem_limit: ${service.mem_limit}`);
      }

      if (service.cpus) {
        lines.push(`    cpus: "${service.cpus}"`);
      }

      if (service.shm_size) {
        lines.push(`    shm_size: ${service.shm_size}`);
      }

      if (service.ports && service.ports.length > 0) {
        lines.push('    ports:');
        for (const port of service.ports) {
          lines.push(`      - "${port}"`);
        }
      }

      if (service.environment && service.environment.length > 0) {
        lines.push('    environment:');
        for (const env of service.environment) {
          lines.push(`      - ${env}`);
        }
      }

      if (service.command) {
        lines.push(`    command: ${service.command}`);
      }

      if (service.networks && service.networks.length > 0) {
        lines.push('    networks:');
        for (const network of service.networks) {
          lines.push(`      - ${network}`);
        }
      }

      if (service.labels) {
        lines.push('    labels:');
        for (const [key, value] of Object.entries(service.labels)) {
          lines.push(`      ${key}: "${value}"`);
        }
      }

      lines.push('');
    }

    if (config.networks) {
      lines.push('networks:');
      for (const [networkName, network] of Object.entries<any>(config.networks)) {
        lines.push(`  ${networkName}:`);
        lines.push(`    driver: ${network.driver}`);
        
        if (network.ipam) {
          lines.push('    ipam:');
          lines.push('      config:');
          for (const cfg of network.ipam.config) {
            lines.push(`        - subnet: ${cfg.subnet}`);
          }
        }

        if (network.labels) {
          lines.push('    labels:');
          for (const [key, value] of Object.entries(network.labels)) {
            lines.push(`      ${key}: "${value}"`);
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Sanitize name for Docker Compose (alphanumeric + underscore only)
   * Example: "Web Server" -> "web_server"
   * Example: "Attacker Workstation" -> "attacker_workstation"
   */
  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
}
