import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Machine } from '../entities/machine.entity';
import { ImageVariant } from '../entities/image-variant.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { ImageVariantService } from './image-variant.service';
import { MinioService } from './minio.service';
import { CreateMachineDto } from '../dto/create-machine.dto';
import * as yaml from 'js-yaml';
import Dockerode from 'dockerode';

@Injectable()
export class CreatorEnvironmentService {
  private readonly logger = new Logger(CreatorEnvironmentService.name);

  constructor(
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly imageVariantService: ImageVariantService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Create a new machine with auto-populated resources from image variant
   */
  async createMachine(
    scenarioVersionId: string,
    dto: CreateMachineDto,
    userId: string
  ): Promise<Machine> {
    // Get variant details if variant ID provided
    let variant: ImageVariant | null = null;
    let imageRef: string;
    
    if (dto.imageVariantId) {
      variant = await this.imageVariantService.getVariantById(
        dto.imageVariantId
      );

      // Validate variant is suitable for role
      if (!variant.suitableForRoles || !variant.suitableForRoles.includes(dto.role)) {
        throw new BadRequestException(
          `Variant ${variant.displayName} is not suitable for role ${dto.role}`
        );
      }
      
      imageRef = variant.imageRef;
    } else if (dto.customImageRef) {
      imageRef = dto.customImageRef;
    } else {
      throw new BadRequestException('Either imageVariantId or customImageRef must be provided');
    }

    // Sanitize machine name
    const sanitizedName = this.sanitizeMachineName(dto.name);

    // Check for duplicate names in this scenario version
    const existing = await this.machineRepo.findOne({
      where: {
        scenarioVersionId,
        name: sanitizedName,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Machine with name "${sanitizedName}" already exists in this scenario`
      );
    }

    // Map to resource profile based on variant or use provided
    const resourceProfile = dto.resourceProfile || this.getProfileFromVariant(variant);

    // AUTO-FILL ENTRYPOINTS from ImageVariant defaults if not provided
    let entrypoints = dto.entrypoints;
    let allowSolverEntry = dto.allowSolverEntry ?? false;

    if (!entrypoints && variant?.defaultEntrypoints && variant.defaultEntrypoints.length > 0) {
      // Auto-populate from variant defaults
      entrypoints = variant.defaultEntrypoints;
      this.logger.log(
        `Auto-filled ${entrypoints.length} entrypoint(s) from variant ${variant.displayName}`
      );

      // Auto-set allowSolverEntry if variant has solver-exposed entrypoints
      if (variant.defaultAllowSolverEntry !== undefined) {
        allowSolverEntry = variant.defaultAllowSolverEntry;
      }
    }

    // Validate entrypoints if provided
    if (entrypoints && entrypoints.length > 0) {
      this.validateEntrypoints(entrypoints, dto.role);
    }

    // Validate attacker role has at least one solver-accessible entrypoint
    if (dto.role === 'attacker' && allowSolverEntry && (!entrypoints || entrypoints.length === 0)) {
      throw new BadRequestException(
        'Attacker role with allowSolverEntry=true must have at least one entrypoint defined'
      );
    }

    // Create machine using existing entity structure
    const machine = this.machineRepo.create({
      scenarioVersionId,
      name: sanitizedName,
      role: dto.role,
      imageSourceType: dto.imageVariantId ? 'platform_library' : 'custom_image',
      imageRef: imageRef,
      networkGroup: variant?.defaultNetworkGroup 
        ? this.sanitizeName(variant.defaultNetworkGroup) 
        : this.sanitizeName(dto.networkGroup),
      resourceProfile: resourceProfile,
      allowSolverEntry: allowSolverEntry,
      allowFromAttacker: dto.allowFromAttacker ?? false,
      allowInternalConnections: dto.allowInternalConnections ?? false,
      isPivotHost: dto.isPivotHost ?? false,
      entrypoints: entrypoints || [],
      startupCommands: dto.startupCommands || undefined,
      envVars: dto.envVars || undefined,
      command: dto.command || undefined,
      entrypoint: dto.entrypoint || undefined,
      dependsOn: dto.dependsOn || undefined,
      healthcheck: variant?.defaultHealthcheck || dto.healthcheck || undefined,
      networkAliases: undefined,
      solverHints: undefined,
      attackerBootstrap: dto.role === 'attacker' ? (dto.attackerBootstrap as any) : undefined,
      composeExtensions: dto.composeExtensions as any,
    });

    await this.machineRepo.save(machine);

    this.logger.log(
      `Machine created: ${machine.name} (${machine.role}) for scenario version ${scenarioVersionId}`
    );

    return machine;
  }

  /**
   * Map variant to resource profile
   */
  private getProfileFromVariant(variant: ImageVariant | null): 'micro' | 'small' | 'medium' | 'large' {
    if (!variant) return 'small';
    
    // Map based on CPU cores
    const cpu = Number(variant.cpuCores);
    if (cpu <= 0.25) return 'micro';
    if (cpu <= 0.5) return 'small';
    if (cpu <= 1) return 'medium';
    return 'large';
  }

  /**
   * Get all machines for a scenario version
   */
  async getMachinesByScenarioVersion(
    scenarioVersionId: string
  ): Promise<Machine[]> {
    return this.machineRepo.find({
      where: { scenarioVersionId },
      relations: ['scenarioVersion', 'registryCredential'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Delete a machine
   */
  async deleteMachine(id: string, userId: string): Promise<void> {
    const machine = await this.machineRepo.findOne({ where: { id } });

    if (!machine) {
      throw new NotFoundException(`Machine with ID ${id} not found`);
    }

    await this.machineRepo.remove(machine);
    this.logger.log(`Machine deleted: ${machine.name} by user ${userId}`);
  }

  /**
   * Generate docker-compose YAML from machines in environment
   * This is the CRITICAL SYNC FEATURE
   */
  async generateDockerComposeFromMachines(
    scenarioVersionId: string
  ): Promise<{
    dockerCompose: string;
    machineCount: number;
    estimatedCostPerHour: number;
  }> {
    const machines = await this.getMachinesByScenarioVersion(scenarioVersionId);

    if (machines.length === 0) {
      throw new BadRequestException(
        'No machines configured in environment. Please add machines in the Environment tab and save your scenario first.'
      );
    }

    this.logger.log(`Generating docker-compose for ${machines.length} machines`);

    // Build docker-compose structure
    const compose: any = {
      services: {},
      networks: {},
    };

    const networkGroups = new Map<string, boolean>();
    let totalCost = 0;

    // Track used host ports to prevent conflicts
    const usedHostPorts = new Set<number>();
    let nextAutoPort = 8000;

    // Create service for each machine
    for (const machine of machines) {
      // Track networks
      networkGroups.set(machine.networkGroup, true);

      // Get resource limits from profile
      const resources = this.getResourcesFromProfile(machine.resourceProfile);
      
      // Ensure image has a tag (add :latest if missing)
      let imageRef = machine.imageRef;
      if (imageRef && !imageRef.includes(':')) {
        imageRef = `${imageRef}:latest`;
        this.logger.warn(`Image ${machine.imageRef} missing tag, using ${imageRef}`);
      }
      
      // Create safe container name (sanitize: lowercase, replace non-alphanumeric with underscores)
      // MATCHES AWS: Uses same sanitization as docker-compose-generator.service.ts
      const serviceName = this.sanitizeName(machine.name);
      const containerName = `local-${serviceName}`;  // Prefix for local Docker testing
      
      // Build service definition
      compose.services[serviceName] = {
        image: imageRef,
        container_name: containerName,
        hostname: serviceName,
        networks: [machine.networkGroup],
        mem_limit: `${resources.memoryMb}m`,
        cpus: resources.cpuCores.toString(),
      };

      // MATCHES AWS: Only expose ports for machines with entrypoints AND allowSolverEntry=true
      // This aligns with AWS ALB/NLB routing behavior
      const ports: string[] = [];
      
      if (machine.allowSolverEntry && machine.entrypoints && machine.entrypoints.length > 0) {
        this.logger.log(`Machine ${machine.name} has ${machine.entrypoints.length} entrypoints, mapping ports...`);
        
        for (const entrypoint of machine.entrypoints) {
          if (!entrypoint.exposedToSolver) {
            this.logger.log(`  Skipping entrypoint ${entrypoint.protocol}:${entrypoint.containerPort} (not exposed to solver)`);
            continue;
          }

          // Auto-assign unique host port starting from 8000
          const hostPort = this.getNextAvailablePort(nextAutoPort, usedHostPorts);
          ports.push(`${hostPort}:${entrypoint.containerPort}`);
          this.logger.log(`  Mapped ${entrypoint.protocol}:${entrypoint.containerPort} -> host:${hostPort}`);
          
          usedHostPorts.add(hostPort);
          nextAutoPort = hostPort + 1;
        }
      } else {
        this.logger.log(`Machine ${machine.name}: No port mappings (allowSolverEntry=${machine.allowSolverEntry}, entrypoints=${machine.entrypoints?.length || 0})`);
      }
      
      if (ports.length > 0) {
        compose.services[serviceName].ports = ports;
      }

      // Add Kasm-specific configuration for web desktop images
      const isKasmWebImage = imageRef?.includes('kasmweb');
      if (isKasmWebImage) {
        compose.services[serviceName].environment = [
          'VNC_PW=vncpassword',
        ];
        compose.services[serviceName].shm_size = '512m';
      }

      // Add command to keep attacker containers alive (critical for Kali)
      // Skip for kasmweb images - they have their own startup process
      if (machine.role === 'attacker' && !isKasmWebImage) {
        compose.services[serviceName].command = 'sleep infinity';
      }

      // Add startup commands if provided (will override sleep infinity)
      if (machine.startupCommands) {
        compose.services[serviceName].command = machine.startupCommands;
      }

      // Add labels
      compose.services[serviceName].labels = {
        'rangex.role': machine.role,
        'rangex.scenario-version': scenarioVersionId,
        'rangex.resource-profile': machine.resourceProfile,
      };

      // Estimate cost (rough estimate based on profile)
      totalCost += resources.estimatedCostPerHour;
    }

    // Create network definitions
    for (const [networkName, _] of networkGroups) {
      compose.networks[networkName] = {
        driver: 'bridge',
        labels: {
          'rangex.scenario-version': scenarioVersionId,
        },
      };
    }

    return {
      dockerCompose: yaml.dump(compose, { indent: 2, lineWidth: 120 }),
      machineCount: machines.length,
      estimatedCostPerHour: parseFloat(totalCost.toFixed(4)),
    };
  }

  /**
   * Map resource profile to actual resources
   */
  private getResourcesFromProfile(profile: string): {
    cpuCores: number;
    memoryMb: number;
    estimatedCostPerHour: number;
  } {
    const profiles: Record<string, { cpuCores: number; memoryMb: number; estimatedCostPerHour: number }> = {
      micro: { cpuCores: 0.25, memoryMb: 512, estimatedCostPerHour: 0.03 },
      small: { cpuCores: 0.5, memoryMb: 1024, estimatedCostPerHour: 0.06 },
      medium: { cpuCores: 1.0, memoryMb: 2048, estimatedCostPerHour: 0.12 },
      large: { cpuCores: 2.0, memoryMb: 4096, estimatedCostPerHour: 0.24 },
    };

    return profiles[profile] || profiles.small;
  }

  /**
   * Validate that environment machines match docker-compose services
   */
  async validateEnvironmentComposeSync(
    scenarioVersionId: string,
    dockerComposeYaml: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const machines = await this.getMachinesByScenarioVersion(scenarioVersionId);
      const compose = yaml.load(dockerComposeYaml) as any;

      if (!compose.services) {
        errors.push('Docker compose has no services defined');
        return { valid: false, errors, warnings };
      }

      const machineNames = new Set(machines.map((m) => m.name));
      const serviceNames = new Set(Object.keys(compose.services));
      
      // Create sets using sanitizeName() to match actual service names in compose
      const originalMachineNames = new Set(machines.map((m) => m.name));
      const sanitizedMachineNames = new Set(
        machines.map((m) => this.sanitizeName(m.name))
      );

      // Check count match
      if (serviceNames.size !== machineNames.size) {
        errors.push(
          `Service count mismatch: ${serviceNames.size} services vs ${machineNames.size} machines`
        );
      }

      // Check all machines have services
      for (const machine of machines) {
        const sanitizedName = this.sanitizeName(machine.name);
        
        // Service name should match sanitized machine name
        const service = compose.services[sanitizedName];
        
        if (!service) {
          errors.push(`Machine "${machine.name}" not found in docker-compose (expected service: "${sanitizedName}")`);
          continue;
        }

        // Validate image match
        if (service.image !== machine.imageRef) {
          warnings.push(
            `Image mismatch for "${machine.name}": compose has "${service.image}" but environment expects "${machine.imageRef}"`
          );
        }

        // Validate network
        if (service.networks) {
          if (!service.networks.includes(machine.networkGroup)) {
            warnings.push(
              `Network mismatch for "${machine.name}": not in network "${machine.networkGroup}"`
            );
          }
        } else {
          warnings.push(`Machine "${machine.name}" has no networks in compose`);
        }
      }

      // Check for services without machines
      for (const serviceName of serviceNames) {
        // Check if service matches any machine's sanitized name
        const hasMatchingMachine = sanitizedMachineNames.has(serviceName);
        
        if (!hasMatchingMachine) {
          warnings.push(
            `Service "${serviceName}" in compose has no corresponding machine in environment`
          );
        }
      }

      // ========== ENHANCED VALIDATION ==========
      
      // 1. Port conflict detection
      const usedPorts = new Set<string>();
      for (const [serviceName, service] of Object.entries(compose.services as Record<string, any>)) {
        if (service.ports && Array.isArray(service.ports)) {
          for (const portMapping of service.ports) {
            const portStr = String(portMapping);
            const hostPort = portMapping.includes(':') ? portMapping.split(':')[0] : portMapping;
            
            if (usedPorts.has(hostPort)) {
              errors.push(`Port conflict: Host port ${hostPort} is used by multiple services`);
            }
            usedPorts.add(hostPort);
            
            // Check for commonly conflicting ports
            const conflictingPorts = ['3306', '5432', '27017', '6379', '9200'];
            if (conflictingPorts.includes(hostPort)) {
              warnings.push(
                `Port ${hostPort} in service "${serviceName}" may conflict with local services. Consider using a higher port (e.g., 33${hostPort.slice(-2)})`
              );
            }
          }
        }
      }

      // 2. Network validation
      const definedNetworks = new Set(Object.keys(compose.networks || {}));
      for (const [serviceName, service] of Object.entries(compose.services as Record<string, any>)) {
        if (service.networks && Array.isArray(service.networks)) {
          for (const network of service.networks) {
            if (!definedNetworks.has(network)) {
              errors.push(
                `Service "${serviceName}" references undefined network "${network}"`
              );
            }
          }
        }
      }

      // 3. Resource limit validation
      for (const [serviceName, service] of Object.entries(compose.services as Record<string, any>)) {
        // Check CPU limits
        if (service.cpus) {
          const cpus = parseFloat(service.cpus);
          if (cpus > 2.0) {
            warnings.push(
              `Service "${serviceName}" requests ${cpus} CPUs (max recommended: 2.0)`
            );
          }
        }

        // Check memory limits
        if (service.mem_limit) {
          const memStr = String(service.mem_limit).toLowerCase();
          const memMb = memStr.includes('g') 
            ? parseFloat(memStr) * 1024 
            : parseFloat(memStr);
          
          if (memMb > 4096) {
            warnings.push(
              `Service "${serviceName}" requests ${memStr} memory (max recommended: 4096m)`
            );
          }
        }
      }

      // 4. Image reference validation (basic format check)
      for (const [serviceName, service] of Object.entries(compose.services as Record<string, any>)) {
        if (!service.image) {
          errors.push(`Service "${serviceName}" has no image specified`);
        } else if (!service.image.includes(':')) {
          warnings.push(
            `Service "${serviceName}" image "${service.image}" has no tag (will use :latest)`
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error: any) {
      errors.push(`Failed to parse docker-compose: ${error.message || 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Sanitize machine name for Docker compatibility
   */
  private sanitizeMachineName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Sanitize name for use as Docker service name
   * MATCHES AWS: Same logic as docker-compose-generator.service.ts
   * - Converts to lowercase
   * - Replaces all non-alphanumeric characters with underscores
   * - Example: "Attacker Workstation" → "attacker_workstation"
   */
  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Validate entrypoints (ensure no duplicate protocol+port pairs)
   */
  private validateEntrypoints(
    entrypoints: Array<{
      protocol: string;
      containerPort: number;
      exposedToSolver: boolean;
      description?: string;
    }>,
    role: string
  ): void {
    const seen = new Set<string>();
    const solverAccessible = entrypoints.filter(e => e.exposedToSolver);

    for (const ep of entrypoints) {
      const key = `${ep.protocol}:${ep.containerPort}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate entrypoint: ${ep.protocol} on port ${ep.containerPort}`
        );
      }
      seen.add(key);

      // Validate port range
      if (ep.containerPort < 1 || ep.containerPort > 65535) {
        throw new BadRequestException(
          `Invalid port number: ${ep.containerPort} (must be 1-65535)`
        );
      }
    }

    // Ensure attacker role has at least one solver-accessible entrypoint (if allowSolverEntry is true)
    if (role === 'attacker' && solverAccessible.length === 0 && entrypoints.length > 0) {
      const hasExposedEntrypoint = entrypoints.some(e => e.exposedToSolver);
      if (!hasExposedEntrypoint) {
        this.logger.warn(
          'Attacker role without solver-accessible entrypoints - solver may not be able to access this machine'
        );
      }
    }
  }

  /**
   * Test Docker connection
   */
  async testDockerConnection(dockerHost: string, useTLS: boolean): Promise<{
    success: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      // Create Docker client based on connection type
      let docker: Dockerode;
      
      if (dockerHost.startsWith('unix://')) {
        docker = new Dockerode({ socketPath: dockerHost.replace('unix://', '') });
      } else if (dockerHost.startsWith('npipe://')) {
        // Windows named pipe (Docker Desktop on Windows)
        docker = new Dockerode({ socketPath: dockerHost.replace('npipe://', '') });
      } else if (dockerHost.startsWith('tcp://')) {
        const url = new URL(dockerHost);
        docker = new Dockerode({
          host: url.hostname,
          port: Number(url.port) || 2375,
          protocol: useTLS ? 'https' : 'http',
        });
      } else {
        throw new Error('Invalid Docker host format. Use unix://, npipe://, or tcp://');
      }

      // Test connection by getting version
      const info = await docker.version();
      
      this.logger.log(`Docker connection successful: ${info.Version}`);
      return {
        success: true,
        version: info.Version,
      };
    } catch (error: any) {
      this.logger.error(`Docker connection failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Failed to connect to Docker daemon',
      };
    }
  }

  /**
   * Save docker-compose to MinIO
   */
  async saveDockerComposeToMinIO(
    scenarioVersionId: string,
    dockerCompose: string
  ): Promise<{ minioPath: string }> {
    const version = await this.versionRepo.findOne({
      where: { id: scenarioVersionId },
      relations: ['scenario'],
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    const minioPath = `scenarios/${version.scenarioId}/versions/${scenarioVersionId}/docker-compose.yml`;

    // Upload to MinIO
    await this.minioService.uploadFile(
      Buffer.from(dockerCompose, 'utf-8'),
      minioPath
    );

    // Save path in scenario version
    await this.versionRepo.update(scenarioVersionId, {
      dockerComposePath: minioPath,
    });

    this.logger.log(`Docker compose saved to MinIO: ${minioPath}`);

    return { minioPath };
  }

  /**
   * Load docker-compose from MinIO
   */
  async loadDockerComposeFromMinIO(
    scenarioVersionId: string
  ): Promise<{ dockerCompose: string | null }> {
    const version = await this.versionRepo.findOne({
      where: { id: scenarioVersionId },
    });

    if (!version) {
      throw new NotFoundException('Scenario version not found');
    }

    if (!version.dockerComposePath) {
      return { dockerCompose: null };
    }

    try {
      const fileBuffer = await this.minioService.getFile(version.dockerComposePath);
      return { dockerCompose: fileBuffer.toString('utf-8') };
    } catch (error: any) {
      this.logger.warn(`Failed to load docker-compose from MinIO: ${error.message || 'Unknown error'}`);
      return { dockerCompose: null };
    }
  }

  /**
   * Test scenario on creator's Docker daemon
   */
  async testScenarioOnDockerDaemon(
    scenarioVersionId: string,
    dockerCompose: string,
    dockerConnection: { dockerHost: string; useTLS: boolean }
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    containers?: any[];
  }> {
    try {
      // First test connection
      const connectionTest = await this.testDockerConnection(
        dockerConnection.dockerHost,
        dockerConnection.useTLS
      );

      if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Docker connection failed');
      }

      // Parse docker-compose
      const compose = yaml.load(dockerCompose) as any;
      if (!compose.services) {
        throw new Error('Docker compose has no services defined');
      }

      // Create Docker client
      let docker: Dockerode;
      if (dockerConnection.dockerHost.startsWith('unix://')) {
        docker = new Dockerode({ socketPath: dockerConnection.dockerHost.replace('unix://', '') });
      } else if (dockerConnection.dockerHost.startsWith('npipe://')) {
        docker = new Dockerode({ socketPath: dockerConnection.dockerHost.replace('npipe://', '') });
      } else {
        const url = new URL(dockerConnection.dockerHost);
        docker = new Dockerode({
          host: url.hostname,
          port: Number(url.port) || 2375,
          protocol: dockerConnection.useTLS ? 'https' : 'http',
        });
      }

      // For now, just validate the compose file structure
      // Full docker-compose up would require docker-compose CLI or compose-spec implementation
      const services = Object.keys(compose.services);
      
      this.logger.log(`Docker test validated ${services.length} services for scenario ${scenarioVersionId}`);

      return {
        success: true,
        message: `Docker compose validated successfully with ${services.length} services`,
        containers: services.map(name => ({ name, status: 'ready-to-deploy' })),
      };
    } catch (error: any) {
      this.logger.error(`Docker test failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Failed to test scenario on Docker',
      };
    }
  }

  /**
   * Get latest version ID for a scenario (helper for compose alias)
   */
  async getLatestVersionIdForScenario(scenarioId: string): Promise<string | null> {
    const versions = await this.versionRepo.find({
      where: { scenarioId },
      order: { versionNumber: 'DESC' },
      take: 1,
    });

    return versions.length > 0 ? versions[0].id : null;
  }

  /**
   * Get next available host port for port mapping
   * MATCHES AWS: Same logic as docker-compose-generator.service.ts
   * - Starts from suggestedPort
   * - Increments if port already in use
   */
  private getNextAvailablePort(suggestedPort: number, usedPorts: Set<number>): number {
    let port = suggestedPort;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }
}
