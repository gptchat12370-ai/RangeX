import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine, MachineHealthcheck, AttackerBootstrap, ComposeExtensions } from '../entities/machine.entity';
import { PLATFORM_LIMITS, getResourceProfile, isAllowedPort, getDefaultProfileForRole, ATTACKER_GUI_IMAGES } from '../config/platform-limits.config';
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
  runtimeManifest?: RuntimeManifest; // For AWS mode
}

export interface RuntimeManifest {
  version: string;
  scenarioVersionId: string;
  machines: RuntimeMachine[];
  sessionNetworking: {
    allowInterMachine: boolean;
    solverExposedPorts: Array<{
      machineId: string;
      machineName: string;
      containerPort: number;
      protocol: string;
      description?: string;
    }>;
  };
  estimatedCost: {
    hourlyRM: number;
    dailyRM: number;
  };
}

export interface RuntimeMachine {
  machineId: string;
  machineName: string;
  role: string;
  imageUri: string; // ECR URI or digest
  cpu: number;
  memory: number;
  envVars: Record<string, string>;
  command?: string | string[];
  entrypoint?: string | string[];
  healthcheck?: MachineHealthcheck;
  networkGroup: string;
  entrypoints: Array<{
    protocol: string;
    containerPort: number;
    exposedToSolver: boolean;
    description?: string;
  }>;
  solverHints: string[];
}

@Injectable()
export class DockerComposeSyncServicePhase23 {
  private readonly logger = new Logger(DockerComposeSyncServicePhase23.name);

  // Allowed sysctls (networking labs only)
  private readonly ALLOWED_SYSCTLS = [
    'net.ipv4.ip_forward',
    'net.ipv4.conf.all.route_localnet',
    'net.ipv6.conf.all.forwarding',
  ];

  // Allowed cap_add (attacker use cases)
  private readonly ALLOWED_CAP_ADD = [
    'NET_ADMIN',
    'NET_RAW',
    'SYS_ADMIN', // Careful with this one
  ];

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

    // 3. Validate dependencies
    this.validateDependencies(normalizedMachines, warnings);


    let finalCompose: any;
    let finalComposeYAML: string;
    let runtimeManifest: RuntimeManifest | undefined;

    if (mode === 'local_compose') {
      finalCompose = await this.generateComposeConfig(
        normalizedMachines,
        version,
        'local_compose',
        corrections,
        warnings,
      );
      finalComposeYAML = this.exportAsYAML(finalCompose);
    } else {
      // aws_runtime mode
      runtimeManifest = this.generateRuntimeManifest(normalizedMachines, version);
      finalCompose = {}; // No docker-compose for AWS runtime
      finalComposeYAML = '# AWS Runtime - No docker-compose needed';
    }

    // 6. Calculate estimated cost
    const estimatedCost = this.calculateCost(normalizedMachines);

    // 7. Create normalized snapshot
    const normalizedEnvironmentSnapshot = {
      machines: normalizedMachines.map((m) => ({
        name: m.name,
        role: m.role,
        image: this.canonicalizeImage(m.imageRef),
        resourceProfile: m.resourceProfile,
        entrypoints: m.entrypoints || [],
        networkGroup: m.networkGroup,
        envVars: m.envVars || {},
        command: m.command,
        healthcheck: m.healthcheck,
        solverHints: m.solverHints || [],
      })),
      version: scenarioVersionId,
      timestamp: new Date().toISOString(),
    };

    return {
      status: 'SYNCED',
      warnings,
      corrections,
      estimatedCost,
      finalCompose,
      finalComposeYAML,
      normalizedEnvironmentSnapshot,
      runtimeManifest,
    };
  }

  /**
   * Normalize and validate a single machine (Phase 2-3 extended)
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

    // Validate attacker bootstrap (ONLY for attacker role)
    if (normalized.attackerBootstrap && machine.role !== 'attacker') {
      warnings.push(`Machine ${machine.name} has attackerBootstrap but is not an attacker role`);
      normalized.attackerBootstrap = undefined;
    }

    // Validate compose extensions
    if (normalized.composeExtensions) {
      this.validateComposeExtensions(normalized, corrections, warnings);
    }

    // Validate healthcheck format
    if (normalized.healthcheck) {
      this.validateHealthcheck(normalized.healthcheck, machine.name, warnings);
    }

    return normalized;
  }

  /**
   * Validate compose extensions (security critical)
   */
  private validateComposeExtensions(
    machine: Machine,
    corrections: ValidationCorrection[],
    warnings: string[],
  ): void {
    const ext = machine.composeExtensions;
    if (!ext) return;

    // Check cap_add allowlist
    if (ext.capAdd) {
      const invalidCaps = ext.capAdd.filter(cap => !this.ALLOWED_CAP_ADD.includes(cap));
      if (invalidCaps.length > 0) {
        warnings.push(
          `Machine ${machine.name} has invalid capabilities: ${invalidCaps.join(', ')}. Allowed: ${this.ALLOWED_CAP_ADD.join(', ')}`,
        );
        ext.capAdd = ext.capAdd.filter(cap => this.ALLOWED_CAP_ADD.includes(cap));
      }
    }

    // Check sysctls allowlist
    if (ext.sysctls) {
      const invalidSysctls = Object.keys(ext.sysctls).filter(
        key => !this.ALLOWED_SYSCTLS.includes(key),
      );
      if (invalidSysctls.length > 0) {
        warnings.push(
          `Machine ${machine.name} has invalid sysctls: ${invalidSysctls.join(', ')}`,
        );
        invalidSysctls.forEach(key => delete ext.sysctls![key]);
      }
    }

    // Block docker.sock mounts (CRITICAL SECURITY)
    if (ext.volumes) {
      const dockerSockMounts = ext.volumes.filter(vol =>
        vol.includes('/var/run/docker.sock'),
      );
      if (dockerSockMounts.length > 0) {
        throw new Error(
          `Machine ${machine.name}: Docker socket mounts are FORBIDDEN for security`,
        );
      }
    }
  }

  /**
   * Validate healthcheck format
   */
  private validateHealthcheck(
    healthcheck: MachineHealthcheck,
    machineName: string,
    warnings: string[],
  ): void {
    if (!healthcheck.test || healthcheck.test.length === 0) {
      warnings.push(`Machine ${machineName}: healthcheck.test is empty`);
    }

    if (healthcheck.intervalSec && healthcheck.intervalSec < 5) {
      warnings.push(`Machine ${machineName}: healthcheck interval too short (min 5s)`);
    }
  }

  /**
   * Validate machine dependencies (depends_on)
   */
  private validateDependencies(machines: Machine[], warnings: string[]): void {
    const machineNames = new Set(machines.map(m => m.name));

    for (const machine of machines) {
      if (machine.dependsOn) {
        for (const depName of machine.dependsOn) {
          if (!machineNames.has(depName)) {
            warnings.push(
              `Machine ${machine.name} depends on non-existent machine: ${depName}`,
            );
          }
        }
      }
    }
  }

  /**
   * Generate Docker Compose configuration (Phase 2-3 extended)
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
        networks: machine.networkAliases ? [
          { [machine.networkGroup]: { aliases: machine.networkAliases } }
        ] : [machine.networkGroup],
        labels: {
          'rangex.scenario.name': version.scenarioId,
          'rangex.scenario.creator': version.creatorName || 'unknown',
          'rangex.scenario-version': version.id,
          'rangex.role': machine.role,
          'rangex.resource-profile': machine.resourceProfile,
        },
      };

      // Add environment variables (merge system + custom)
      const envVars = this.buildEnvironmentVars(machine);
      if (Object.keys(envVars).length > 0) {
        service.environment = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);
      }

      // Add command override
      if (machine.command) {
        service.command = machine.command;
      }

      // Add entrypoint override
      if (machine.entrypoint) {
        service.entrypoint = machine.entrypoint;
      }

      // Add depends_on
      if (machine.dependsOn && machine.dependsOn.length > 0) {
        service.depends_on = machine.dependsOn;
      }

      // Add healthcheck
      if (machine.healthcheck) {
        service.healthcheck = this.serializeHealthcheck(machine.healthcheck);
      }

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

      // Add compose extensions (local-only)
      if (machine.composeExtensions) {
        const ext = machine.composeExtensions;

        if (ext.shmSize) {
          service.shm_size = ext.shmSize;
        }

        if (ext.capAdd && ext.capAdd.length > 0) {
          service.cap_add = ext.capAdd;
        }

        if (ext.sysctls && Object.keys(ext.sysctls).length > 0) {
          service.sysctls = ext.sysctls;
        }

        if (ext.ulimits && Object.keys(ext.ulimits).length > 0) {
          service.ulimits = ext.ulimits;
        }

        if (ext.extraHosts && ext.extraHosts.length > 0) {
          service.extra_hosts = ext.extraHosts;
        }

        if (ext.volumes && ext.volumes.length > 0) {
          service.volumes = ext.volumes;
        }
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
   * Build environment variables (system + custom)
   */
  private buildEnvironmentVars(machine: Machine): Record<string, string> {
    const env: Record<string, string> = {};

    // System env vars for GUI images
    if (machine.role === 'attacker' && machine.imageRef.includes('kasm')) {
      env['VNC_PW'] = 'vncpassword';
    }

    // Custom env vars from creator
    if (machine.envVars) {
      Object.assign(env, machine.envVars);
    }

    return env;
  }

  /**
   * Serialize healthcheck to Docker Compose format
   */
  private serializeHealthcheck(hc: MachineHealthcheck): any {
    const result: any = {
      test: hc.test,
    };

    if (hc.intervalSec) result.interval = `${hc.intervalSec}s`;
    if (hc.timeoutSec) result.timeout = `${hc.timeoutSec}s`;
    if (hc.retries) result.retries = hc.retries;
    if (hc.startPeriodSec) result.start_period = `${hc.startPeriodSec}s`;

    return result;
  }

  /**
   * Generate AWS runtime manifest (no docker-compose)
   */
  private generateRuntimeManifest(
    machines: Machine[],
    version: ScenarioVersion,
  ): RuntimeManifest {
    const runtimeMachines: RuntimeMachine[] = machines.map(m => {
      const profile = getResourceProfile(m.resourceProfile as any);

      return {
        machineId: m.id,
        machineName: m.name,
        role: m.role,
        imageUri: m.ecrUri || m.imageRef, // Use ECR URI if available
        cpu: profile.cpu,
        memory: profile.memory,
        envVars: this.buildEnvironmentVars(m),
        command: m.command,
        entrypoint: m.entrypoint,
        healthcheck: m.healthcheck,
        networkGroup: m.networkGroup,
        entrypoints: (m.entrypoints || []).map(ep => ({
          protocol: ep.protocol,
          containerPort: ep.containerPort,
          exposedToSolver: ep.exposedToSolver,
          description: ep.description,
        })),
        solverHints: m.solverHints || [],
      };
    });

    const solverExposedPorts = [];
    for (const m of machines) {
      if (m.entrypoints) {
        for (const ep of m.entrypoints) {
          if (ep.exposedToSolver && m.allowSolverEntry) {
            solverExposedPorts.push({
              machineId: m.id,
              machineName: m.name,
              containerPort: ep.containerPort,
              protocol: ep.protocol,
              description: ep.description,
            });
          }
        }
      }
    }

    const estimatedCost = this.calculateCost(machines);

    return {
      version: '1.0',
      scenarioVersionId: version.id,
      machines: runtimeMachines,
      sessionNetworking: {
        allowInterMachine: true, // All machines in session can talk to each other
        solverExposedPorts,
      },
      estimatedCost: {
        hourlyRM: estimatedCost.hourlyRM,
        dailyRM: estimatedCost.dailyRM,
      },
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
    const { CPU_PER_VCPU_HOUR, MEMORY_PER_GB_HOUR, USD_TO_RM } = PLATFORM_LIMITS.PRICING;

    let totalCostPerHour = 0;

    for (const machine of machines) {
      const profile = getResourceProfile(machine.resourceProfile as any);
      const cpuCost = profile.cpu * CPU_PER_VCPU_HOUR;
      const memoryCost = (profile.memory / 1024) * MEMORY_PER_GB_HOUR;
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
   * Export compose config as YAML (Phase 2-3 extended)
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

      if (service.entrypoint) {
        if (Array.isArray(service.entrypoint)) {
          lines.push('    entrypoint:');
          for (const cmd of service.entrypoint) {
            lines.push(`      - ${cmd}`);
          }
        } else {
          lines.push(`    entrypoint: ${service.entrypoint}`);
        }
      }

      if (service.command) {
        if (Array.isArray(service.command)) {
          lines.push('    command:');
          for (const cmd of service.command) {
            lines.push(`      - ${cmd}`);
          }
        } else {
          lines.push(`    command: ${service.command}`);
        }
      }

      if (service.depends_on && service.depends_on.length > 0) {
        lines.push('    depends_on:');
        for (const dep of service.depends_on) {
          lines.push(`      - ${dep}`);
        }
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

      if (service.healthcheck) {
        lines.push('    healthcheck:');
        lines.push('      test:');
        for (const testCmd of service.healthcheck.test) {
          lines.push(`        - ${testCmd}`);
        }
        if (service.healthcheck.interval) {
          lines.push(`      interval: ${service.healthcheck.interval}`);
        }
        if (service.healthcheck.timeout) {
          lines.push(`      timeout: ${service.healthcheck.timeout}`);
        }
        if (service.healthcheck.retries) {
          lines.push(`      retries: ${service.healthcheck.retries}`);
        }
        if (service.healthcheck.start_period) {
          lines.push(`      start_period: ${service.healthcheck.start_period}`);
        }
      }

      if (service.cap_add && service.cap_add.length > 0) {
        lines.push('    cap_add:');
        for (const cap of service.cap_add) {
          lines.push(`      - ${cap}`);
        }
      }

      if (service.sysctls) {
        lines.push('    sysctls:');
        for (const [key, value] of Object.entries(service.sysctls)) {
          lines.push(`      ${key}: ${value}`);
        }
      }

      if (service.ulimits) {
        lines.push('    ulimits:');
        for (const [key, value] of Object.entries(service.ulimits)) {
          if (value && typeof value === 'object') {
            lines.push(`      ${key}:`);
            for (const [k, v] of Object.entries(value)) {
              lines.push(`        ${k}: ${v}`);
            }
          } else {
            lines.push(`      ${key}: ${value}`);
          }
        }
      }

      if (service.extra_hosts && service.extra_hosts.length > 0) {
        lines.push('    extra_hosts:');
        for (const host of service.extra_hosts) {
          lines.push(`      - "${host}"`);
        }
      }

      if (service.volumes && service.volumes.length > 0) {
        lines.push('    volumes:');
        for (const vol of service.volumes) {
          lines.push(`      - ${vol}`);
        }
      }

      if (service.networks) {
        lines.push('    networks:');
        if (Array.isArray(service.networks)) {
          for (const network of service.networks) {
            if (typeof network === 'string') {
              lines.push(`      - ${network}`);
            } else {
              // Network with aliases
              for (const [netName, netConfig] of Object.entries<any>(network)) {
                lines.push(`      ${netName}:`);
                if (netConfig.aliases) {
                  lines.push('        aliases:');
                  for (const alias of netConfig.aliases) {
                    lines.push(`          - ${alias}`);
                  }
                }
              }
            }
          }
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
