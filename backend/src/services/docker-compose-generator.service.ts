import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioAsset } from '../entities/scenario-asset.entity';
import { MinioService } from './minio.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DockerComposeService {
  image: string;
  container_name: string;
  hostname: string;
  networks: string[];
  environment?: Record<string, string>;
  ports?: string[];
  cap_add?: string[];
  privileged?: boolean;
}

interface DockerComposeConfig {
  version: string;
  services: Record<string, DockerComposeService>;
  networks: Record<string, any>;
}

@Injectable()
export class DockerComposeGeneratorService {
  private readonly logger = new Logger(DockerComposeGeneratorService.name);

  constructor(
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioAsset)
    private assetRepo: Repository<ScenarioAsset>,
    private minioService: MinioService,
  ) {}

  /**
   * Generate Docker Compose YAML for a scenario version
   * Assets are baked into custom images pushed to ECR (not mounted as volumes)
   */
  async generateDockerCompose(
    scenarioVersionId: string,
    sessionId: string,
  ): Promise<DockerComposeConfig> {
    this.logger.log(`Generating Docker Compose for version ${scenarioVersionId}, session ${sessionId}`);

    // Load machines
    const machines = await this.machineRepo.find({
      where: { scenarioVersionId },
      relations: ['registryCredential'],
    });

    // Allow scenarios with 0 machines (quiz/asset-only challenges)
    if (machines.length === 0) {
      this.logger.warn(`No machines found for scenario version ${scenarioVersionId} - generating minimal compose file`);
      return {
        version: '3.8',
        services: {},
        networks: {
          default: {
            driver: 'bridge',
          },
        },
      };
    }

    // Load assets for this scenario version
    const assets = await this.assetRepo.find({
      where: { scenarioVersionId },
      relations: ['machine'],
    });

    this.logger.log(`Found ${machines.length} machines and ${assets.length} assets`);

    // Build services
    const services: Record<string, DockerComposeService> = {};
    const networks: Record<string, any> = {};
    const usedHostPorts = new Set<number>(); // Track used ports to avoid conflicts
    let nextAutoPort = 8000; // Start auto-assigning from port 8000

    for (const machine of machines) {
      const serviceName = this.sanitizeName(machine.name);
      const networkName = this.sanitizeName(machine.networkGroup || 'default');

      // Determine image source - if machine has assets, use custom-built image
      const machineAssets = assets.filter(asset => asset.machineId === machine.id);
      const image = await this.resolveImageSource(machine, machineAssets, scenarioVersionId, sessionId);

      // Create service config
      const service: DockerComposeService = {
        image,
        container_name: `${sessionId}-${serviceName}`,
        hostname: serviceName,
        networks: [networkName],
      };

      // Add startup commands if any
      if (machine.startupCommands) {
        service.environment = {
          STARTUP_CMD: machine.startupCommands,
        };
      }

      // Add capabilities based on role
      if (machine.role === 'attacker') {
        service.cap_add = ['NET_ADMIN', 'NET_RAW'];
      }

      // CRITICAL FIX: Only expose ports for entrypoint machines (local testing mode)
      // Production (Fargate) uses ALB/NLB routing instead of direct port mapping
      if (machine.allowSolverEntry && (machine.entrypoints && machine.entrypoints.length > 0)) {
        const ports: string[] = [];
        
        for (const entrypoint of machine.entrypoints) {
          if (!entrypoint.exposedToSolver) continue;
          
          // Auto-assign unique host port to avoid conflicts
          const hostPort = this.getNextAvailablePort(nextAutoPort, usedHostPorts);
          usedHostPorts.add(hostPort);
          nextAutoPort = hostPort + 1;
          
          ports.push(`${hostPort}:${entrypoint.containerPort}`);
          
          this.logger.log(
            `Mapped ${serviceName} entrypoint: ${entrypoint.protocol} ` +
            `${hostPort}:${entrypoint.containerPort} (${entrypoint.description || 'no description'})`
          );
        }
        
        if (ports.length > 0) {
          service.ports = ports;
        }
      } else if (machine.allowSolverEntry) {
        // Fallback for machines without entrypoints defined but marked as entry points
        // Use common default ports based on role/image
        const defaultPorts = this.inferDefaultPorts(machine);
        if (defaultPorts.length > 0) {
          const ports: string[] = [];
          for (const containerPort of defaultPorts) {
            const hostPort = this.getNextAvailablePort(nextAutoPort, usedHostPorts);
            usedHostPorts.add(hostPort);
            nextAutoPort = hostPort + 1;
            ports.push(`${hostPort}:${containerPort}`);
          }
          service.ports = ports;
          this.logger.warn(
            `Machine ${serviceName} has allowSolverEntry but no entrypoints defined. ` +
            `Auto-assigned ports: ${ports.join(', ')}`
          );
        }
      }

      services[serviceName] = service;

      // Add network definition
      if (!networks[networkName]) {
        networks[networkName] = {
          driver: 'bridge',
          ipam: {
            config: [{ subnet: this.generateSubnet(networkName) }],
          },
        };
      }
    }

    const compose: DockerComposeConfig = {
      version: '3.8',
      services,
      networks,
    };

    this.logger.log(`Generated Docker Compose with ${Object.keys(services).length} services`);
    return compose;
  }

  /**
   * Resolve image source:
   * - If machine has assets: Build custom image with assets baked in, push to ECR
   * - If Platform Library: Use cached image from MinIO/ECR
   * - Otherwise: Use Docker Hub image
   */
  private async resolveImageSource(
    machine: Machine,
    machineAssets: ScenarioAsset[],
    scenarioVersionId: string,
    sessionId: string,
  ): Promise<string> {
    // If machine has assets, build custom image
    if (machineAssets.length > 0) {
      const customImageTag = `${machine.id}-${sessionId}`.toLowerCase();
      const ecrRegistry = process.env.ECR_REGISTRY || 'localhost:5000'; // Local registry for dev
      const customImage = `${ecrRegistry}/rangex-custom:${customImageTag}`;
      
      this.logger.log(`Building custom image for ${machine.name} with ${machineAssets.length} assets`);
      
      // Build and push custom image with assets baked in
      await this.buildCustomImage(machine, machineAssets, customImage, sessionId);
      
      return customImage;
    }

    // No assets - use base image
    if (machine.imageSourceType === 'platform_library') {
      // Image is in Platform Library (cached in MinIO or ECR)
      const ecrRegistry = process.env.ECR_REGISTRY || 'localhost:5000';
      return `${ecrRegistry}/rangex-platform:${machine.imageRef.replace(':', '-')}`;
    } else {
      // Custom image from Docker Hub or private registry
      return machine.imageRef;
    }
  }

  /**
   * Build custom Docker image with assets baked in
   * Downloads assets from MinIO, creates Dockerfile, builds image, pushes to ECR
   */
  private async buildCustomImage(
    machine: Machine,
    assets: ScenarioAsset[],
    targetImage: string,
    sessionId: string,
  ): Promise<void> {
    const buildDir = `/tmp/rangex/${sessionId}/build/${machine.id}`;
    const assetsDir = `${buildDir}/assets`;

    try {
      // Create build directory
      await fs.mkdir(assetsDir, { recursive: true });

      // Download all assets from MinIO
      for (const asset of assets) {
        await this.downloadAsset(asset, assetsDir);
      }

      // Generate Dockerfile
      const dockerfile = this.generateDockerfile(machine, assets);
      await fs.writeFile(`${buildDir}/Dockerfile`, dockerfile);

      this.logger.log(`Dockerfile created at ${buildDir}/Dockerfile`);

      // Build image
      this.logger.log(`Building image: ${targetImage}`);
      const buildCmd = `docker build -t ${targetImage} ${buildDir}`;
      await execAsync(buildCmd);

      // Push to ECR (or local registry in dev)
      this.logger.log(`Pushing image to registry: ${targetImage}`);
      const pushCmd = `docker push ${targetImage}`;
      await execAsync(pushCmd);

      this.logger.log(`Custom image built and pushed: ${targetImage}`);
    } catch (error) {
      this.logger.error(`Failed to build custom image: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Download asset from MinIO to local filesystem
   */
  private async downloadAsset(asset: ScenarioAsset, targetDir: string): Promise<void> {
    try {
      // Skip if fileUrl is null or empty
      if (!asset.fileUrl) {
        this.logger.warn(`Asset ${asset.fileName} has no fileUrl, skipping download`);
        return;
      }

      // Extract MinIO object key from URL
      // URL format: /api/assets/file/{objectKey}
      let objectKey = asset.fileUrl;
      if (objectKey.startsWith('/api/assets/file/')) {
        objectKey = objectKey.replace('/api/assets/file/', '');
      }
      
      // Remove query parameters if present
      const queryIndex = objectKey.indexOf('?');
      if (queryIndex !== -1) {
        objectKey = objectKey.substring(0, queryIndex);
      }

      // Get file stream from MinIO
      const stream = await this.minioService.getFileStream(objectKey);
      
      // Save to local file
      const localPath = path.join(targetDir, asset.fileName);
      const writeStream = await fs.open(localPath, 'w');
      
      // Stream to file
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => writeStream.write(chunk));
        stream.on('end', () => {
          writeStream.close();
          resolve(null);
        });
        stream.on('error', reject);
      });

      // Set permissions
      if (asset.permissions) {
        const mode = parseInt(asset.permissions, 8);
        await fs.chmod(localPath, mode);
      }

      this.logger.log(`Downloaded asset: ${asset.fileName} → ${localPath}`);
    } catch (error) {
      this.logger.error(`Failed to download asset ${asset.fileName}:`, error);
      throw error;
    }
  }

  /**
   * Generate Dockerfile that bakes assets into the base image
   */
  private generateDockerfile(machine: Machine, assets: ScenarioAsset[]): string {
    const baseImage = machine.imageSourceType === 'platform_library'
      ? `${process.env.ECR_REGISTRY || 'localhost:5000'}/rangex-platform:${machine.imageRef.replace(':', '-')}`
      : machine.imageRef;

    const lines = [
      `FROM ${baseImage}`,
      '',
      '# Bake assets into image',
    ];

    // Add COPY instructions for each asset
    for (const asset of assets) {
      if (asset.targetPath) {
        // Ensure target directory exists
        const targetDir = path.dirname(asset.targetPath);
        if (targetDir !== '/') {
          lines.push(`RUN mkdir -p ${targetDir}`);
        }
        
        // Copy asset to target path
        lines.push(`COPY assets/${asset.fileName} ${asset.targetPath}`);
        
        // Set permissions if specified
        if (asset.permissions) {
          lines.push(`RUN chmod ${asset.permissions} ${asset.targetPath}`);
        }
      }
    }

    // Add startup commands if any
    if (machine.startupCommands) {
      lines.push('');
      lines.push(`# Startup commands`);
      lines.push(`CMD ${machine.startupCommands}`);
    }

    return lines.join('\n');
  }

  /**
   * Sanitize name for Docker Compose (alphanumeric + underscore only)
   */
  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Generate subnet for network (simple hash-based approach)
   */
  private generateSubnet(networkName: string): string {
    // Simple hash to generate unique subnet
    const hash = networkName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const thirdOctet = (hash % 250) + 1;
    return `172.${Math.floor(thirdOctet / 256)}.${thirdOctet % 256}.0/24`;
  }

  /**
   * Get next available host port (auto-increment to avoid conflicts)
   */
  private getNextAvailablePort(startPort: number, usedPorts: Set<number>): number {
    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
      if (port > 65535) {
        throw new Error('Ran out of available ports for Docker Compose mapping');
      }
    }
    return port;
  }

  /**
   * Infer default container ports based on machine role and image
   * Used as fallback when entrypoints are not explicitly defined
   */
  private inferDefaultPorts(machine: Machine): number[] {
    const imageRef = machine.imageRef.toLowerCase();
    
    // Kali Linux / attacker boxes typically use VNC
    if (imageRef.includes('kali') || imageRef.includes('parrot')) {
      return [6901]; // Kasmweb VNC web interface
    }
    
    // Web servers
    if (imageRef.includes('nginx') || imageRef.includes('apache') || imageRef.includes('httpd')) {
      return [80, 443];
    }
    
    // Database servers
    if (imageRef.includes('mysql')) return [3306];
    if (imageRef.includes('postgres')) return [5432];
    if (imageRef.includes('mongo')) return [27017];
    if (imageRef.includes('redis')) return [6379];
    
    // Application servers
    if (imageRef.includes('tomcat')) return [8080];
    if (imageRef.includes('nodejs') || imageRef.includes('node:')) return [3000];
    
    // SSH servers
    if (imageRef.includes('ssh') || imageRef.includes('ubuntu') || imageRef.includes('debian')) {
      return [22];
    }
    
    // Windows / RDP
    if (imageRef.includes('windows')) return [3389];
    
    // Default: assume web service
    return [80];
  }

  /**
   * Export Docker Compose as YAML string
   */
  exportAsYAML(compose: DockerComposeConfig): string {
    const yaml = [`version: '${compose.version}'`, '', 'services:'];

    for (const [name, service] of Object.entries(compose.services)) {
      yaml.push(`  ${name}:`);
      yaml.push(`    image: ${service.image}`);
      yaml.push(`    container_name: ${service.container_name}`);
      yaml.push(`    hostname: ${service.hostname}`);

      if (service.networks && service.networks.length > 0) {
        yaml.push(`    networks:`);
        service.networks.forEach(net => yaml.push(`      - ${net}`));
      }

      if (service.environment) {
        yaml.push(`    environment:`);
        Object.entries(service.environment).forEach(([key, val]) => 
          yaml.push(`      ${key}: ${val}`)
        );
      }

      if (service.cap_add) {
        yaml.push(`    cap_add:`);
        service.cap_add.forEach(cap => yaml.push(`      - ${cap}`));
      }

      yaml.push('');
    }

    yaml.push('networks:');
    for (const [name, config] of Object.entries(compose.networks)) {
      yaml.push(`  ${name}:`);
      yaml.push(`    driver: ${config.driver}`);
      if (config.ipam) {
        yaml.push(`    ipam:`);
        yaml.push(`      config:`);
        config.ipam.config.forEach((subnet: any) => 
          yaml.push(`        - subnet: ${subnet.subnet}`)
        );
      }
      yaml.push('');
    }

    return yaml.join('\n');
  }
}
