import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SystemSettings } from '../entities/system-settings.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';

const execAsync = promisify(exec);

export interface TestProgress {
  scenarioId: string;
  userId: string;
  status: 'preparing' | 'validating' | 'starting' | 'running' | 'stopping' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  logs: string[];
  containerIds: string[];
  startedAt: Date;
  error?: string;
}

interface DockerComposeConfig {
  version: string;
  services: {
    [key: string]: {
      image?: string;
      build?: any;
      ports?: string[];
      environment?: Record<string, string>;
      volumes?: string[];
      networks?: string[];
      cpus?: string;
      mem_limit?: string;
      [key: string]: any;
    };
  };
  networks?: any;
  volumes?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: string[];
  correctedConfig?: DockerComposeConfig;
}

interface ResourceLimits {
  maxCpus: number;
  maxMemoryMB: number;
  maxContainers: number;
  maxVolumes: number;
  maxPorts: number;
  allowedPorts: number[];
  forbiddenImages: string[];
  requiredLabels: string[];
}

/**
 * Creator Testing Service
 * 
 * Allows creators to:
 * - Connect to their local Docker daemon
 * - Test scenarios locally before submission
 * - Edit docker-compose.yml with live validation
 * - Auto-correction of common mistakes
 * - Resource limit enforcement
 * - Guided creation with hints and best practices
 */
@Injectable()
export class CreatorTestingService {
  private readonly logger = new Logger(CreatorTestingService.name);
  
  // Store active test sessions (in-memory, should use Redis in production)
  private activeTests: Map<string, TestProgress> = new Map();

  constructor(
    @InjectRepository(SystemSettings)
    private systemSettingsRepo: Repository<SystemSettings>,
    @InjectRepository(ScenarioVersion)
    private scenarioVersionRepo: Repository<ScenarioVersion>,
  ) {}
  
  /**
   * Get resource limits from SystemSettings (dynamic, admin-configurable)
   */
  private async getResourceLimits(): Promise<ResourceLimits> {
    const settings = await this.systemSettingsRepo.findOne({ where: { id: '1' } });
    
    return {
      maxCpus: settings?.dockerMaxCpusPerContainer || 0.5,
      maxMemoryMB: settings?.dockerMaxMemoryMbPerContainer || 250,
      maxContainers: settings?.dockerMaxContainers || 5,
      maxVolumes: 3,
      maxPorts: 5,
      allowedPorts: [22, 80, 443, 3000, 5900, 8080, 8443, 9090],
      forbiddenImages: ['postgres', 'mysql', 'mongodb', 'redis'],
      requiredLabels: ['rangex.scenario.name', 'rangex.scenario.creator'],
    };
  }
  
  // Legacy hardcoded limits (kept for backwards compatibility)
  private readonly resourceLimits: ResourceLimits = {
    maxCpus: 0.5,        // Max 0.5 vCPUs per container (economic)
    maxMemoryMB: 250,    // Max 250MB RAM per container (economic)
    maxContainers: 5,    // Max 5 containers per scenario
    maxVolumes: 3,       // Max 3 volumes
    maxPorts: 5,         // Max 5 exposed ports
    allowedPorts: [22, 80, 443, 3000, 5900, 8080, 8443, 9090], // Whitelisted ports
    forbiddenImages: ['postgres', 'mysql', 'mongodb', 'redis'], // No databases (use embedded)
    requiredLabels: ['rangex.scenario.name', 'rangex.scenario.creator'],
  };

  /**
   * Validate Docker is accessible on creator's machine
   */
  async validateDockerConnection(userId: string): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"');
      const version = stdout.trim();
      
      this.logger.log(`Docker connection validated for user ${userId}: v${version}`);
      
      return { connected: true, version };
    } catch (error: any) {
      this.logger.error(`Docker connection failed for user ${userId}: ${error.message}`);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Test scenario locally using docker-compose with real-time progress
   */
  async testScenarioLocally(
    userId: string,
    scenarioId: string,
    dockerComposeContent: string
  ): Promise<{ success: boolean; testId: string; status: TestProgress }> {
    const testId = `${userId}-${scenarioId}`;
    this.logger.log(`Testing scenario ${scenarioId} for user ${userId}`);

    // Set localTestStatus to RUNNING
    await this.scenarioVersionRepo.update(scenarioId, {
      localTestStatus: 'RUNNING',
    });

    // Initialize progress tracking
    const progress: TestProgress = {
      scenarioId,
      userId,
      status: 'preparing',
      progress: 0,
      currentStep: 'Initializing test environment...',
      logs: [],
      containerIds: [],
      startedAt: new Date(),
    };
    this.activeTests.set(testId, progress);

    try {
      // Step 1: Validate docker-compose.yml
      this.updateProgress(testId, {
        status: 'validating',
        progress: 10,
        currentStep: 'Validating docker-compose.yml...',
      });

      const validation = await this.validateDockerCompose(dockerComposeContent);
      progress.logs.push(`[Validation] Checking docker-compose.yml...`);

      if (!validation.valid) {
        this.updateProgress(testId, {
          status: 'failed',
          progress: 100,
          currentStep: 'Validation failed',
          error: validation.errors.join('\n'),
        });
        progress.logs.push(`[Error] Validation failed: ${validation.errors.join(', ')}`);
        return { success: false, testId, status: this.activeTests.get(testId)! };
      }

      progress.logs.push(`[Validation] ✅ docker-compose.yml is valid`);
      if (validation.autoCorrections.length > 0) {
        progress.logs.push(`[Auto-correct] Applied ${validation.autoCorrections.length} corrections`);
      }

      // Step 2: Prepare test directory
      this.updateProgress(testId, {
        status: 'preparing',
        progress: 30,
        currentStep: 'Creating test directory...',
      });

      const tempDir = path.join(os.tmpdir(), `rangex-test-${testId}`);
      await fs.mkdir(tempDir, { recursive: true });
      progress.logs.push(`[Setup] Created test directory: ${tempDir}`);

      const dockerComposePath = path.join(tempDir, 'docker-compose.yml');
      await fs.writeFile(dockerComposePath, dockerComposeContent);
      progress.logs.push(`[Setup] Wrote docker-compose.yml`);

      // Step 3: Pull required images
      this.updateProgress(testId, {
        status: 'starting',
        progress: 50,
        currentStep: 'Pulling Docker images...',
      });

      progress.logs.push(`[Docker] Pulling required images...`);
      try {
        const { stdout: pullOutput } = await execAsync(
          `docker-compose -f "${dockerComposePath}" pull`,
          { cwd: tempDir }
        );
        progress.logs.push(`[Docker] Images pulled successfully`);
      } catch (pullError: any) {
        progress.logs.push(`[Warning] Some images may need to be built: ${pullError.message}`);
      }

      // Step 4: Start containers
      this.updateProgress(testId, {
        status: 'starting',
        progress: 70,
        currentStep: 'Starting containers...',
      });

      progress.logs.push(`[Docker] Starting containers...`);
      const { stdout: startOutput, stderr: startError } = await execAsync(
        `docker-compose -f "${dockerComposePath}" up -d`,
        { cwd: tempDir }
      );

      if (startOutput) progress.logs.push(`[Docker] ${startOutput.trim()}`);
      if (startError) progress.logs.push(`[Docker] ${startError.trim()}`);

      // Step 5: Get container IDs
      this.updateProgress(testId, {
        status: 'running',
        progress: 90,
        currentStep: 'Containers running, collecting logs...',
      });

      const { stdout: psOutput } = await execAsync(
        `docker-compose -f "${dockerComposePath}" ps -q`,
        { cwd: tempDir }
      );

      const containerIds = psOutput.trim().split('\n').filter(Boolean);
      this.updateProgress(testId, { containerIds });

      progress.logs.push(`[Status] Started ${containerIds.length} containers`);

      // Step 6: Get initial logs
      for (const containerId of containerIds) {
        try {
          const { stdout: containerLogs } = await execAsync(`docker logs ${containerId} --tail 20`);
          progress.logs.push(`[Container ${containerId.substring(0, 12)}] ${containerLogs.trim()}`);
        } catch {
          progress.logs.push(`[Container ${containerId.substring(0, 12)}] No logs yet`);
        }
      }

      // Step 7: Complete
      this.updateProgress(testId, {
        status: 'running',
        progress: 100,
        currentStep: 'Test environment running successfully',
      });

      progress.logs.push(`[Success] ✅ Test environment is running`);
      progress.logs.push(`[Info] Use the status endpoint to monitor progress`);
      progress.logs.push(`[Info] Use the logs endpoint to get real-time container logs`);

      // Check container health to determine PASS/FAIL
      await this.checkContainerHealthAndSetStatus(scenarioId, containerIds, progress);

      // Schedule automatic cleanup after timeout
      this.scheduleTestTimeout(userId, scenarioId, testId);

      return { success: true, testId, status: this.activeTests.get(testId)! };

    } catch (error: any) {
      this.logger.error(`Failed to test scenario ${scenarioId}: ${error.message}`);
      
      // Set localTestStatus to FAIL
      await this.scenarioVersionRepo.update(scenarioId, {
        localTestStatus: 'FAIL',
      });
      
      progress.logs.push(`[Error] Test failed: ${error.message}`);
      
      this.updateProgress(testId, {
        status: 'failed',
        progress: 100,
        currentStep: 'Test failed',
        error: error.message,
      });

      // Cleanup on error
      try {
        const tempDir = path.join(os.tmpdir(), `rangex-test-${testId}`);
        const dockerComposePath = path.join(tempDir, 'docker-compose.yml');
        await execAsync(`docker-compose -f "${dockerComposePath}" down -v`, { cwd: tempDir });
        await fs.rm(tempDir, { recursive: true, force: true });
        progress.logs.push(`[Cleanup] Removed failed test environment`);
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, testId, status: this.activeTests.get(testId)! };
    }
  }

  /**
   * Update progress for a test session
   */
  private updateProgress(testId: string, updates: Partial<TestProgress>): void {
    const progress = this.activeTests.get(testId);
    if (progress) {
      Object.assign(progress, updates);
      this.activeTests.set(testId, progress);
    }
  }

  /**
   * Get test status and progress
   */
  async getTestStatus(userId: string, scenarioId: string): Promise<TestProgress | null> {
    const testId = `${userId}-${scenarioId}`;
    return this.activeTests.get(testId) || null;
  }

  /**
   * Get live logs from running test containers
   */
  async getTestLogs(userId: string, scenarioId: string): Promise<{ logs: string[]; containerLogs: any[] }> {
    const testId = `${userId}-${scenarioId}`;
    const progress = this.activeTests.get(testId);

    if (!progress || progress.status !== 'running') {
      return { logs: progress?.logs || [], containerLogs: [] };
    }

    const containerLogs = [];

    // Get live logs from each container
    for (const containerId of progress.containerIds) {
      try {
        const { stdout } = await execAsync(`docker logs ${containerId} --tail 50`);
        containerLogs.push({
          containerId: containerId.substring(0, 12),
          logs: stdout.trim().split('\n'),
        });
      } catch (error: any) {
        containerLogs.push({
          containerId: containerId.substring(0, 12),
          error: error.message,
        });
      }
    }

    return {
      logs: progress.logs,
      containerLogs,
    };
  }

  /**
   * Stop test containers and cleanup
   */
  async stopTestContainers(userId: string, scenarioId: string): Promise<void> {
    const testId = `${userId}-${scenarioId}`;
    const tempDir = path.join(os.tmpdir(), `rangex-test-${testId}`);
    const dockerComposePath = path.join(tempDir, 'docker-compose.yml');

    const progress = this.activeTests.get(testId);
    if (progress) {
    // Set localTestStatus to STOPPED
    await this.scenarioVersionRepo.update(scenarioId, {
      localTestStatus: 'STOPPED',
    });

      progress.status = 'stopping';
      progress.currentStep = 'Stopping containers...';
      progress.logs.push(`[Cleanup] Stopping test environment...`);
    }

    try {
      await execAsync(`docker-compose -f "${dockerComposePath}" down -v`, { cwd: tempDir });
      this.logger.log(`Stopped test containers for ${scenarioId}`);
      
      if (progress) {
        progress.logs.push(`[Cleanup] ✅ Containers stopped`);
      }
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      
      if (progress) {
        progress.status = 'completed';
        progress.currentStep = 'Test environment cleaned up';
        progress.logs.push(`[Cleanup] ✅ Removed test directory`);
      }
      
      // Remove from active tests after 30 seconds (allow time to fetch final status)
      setTimeout(() => {
        this.activeTests.delete(testId);
        this.logger.log(`Removed test session ${testId} from memory`);
      }, 30000);
      
    } catch (error: any) {
      this.logger.error(`Failed to stop test containers: ${error.message}`);
      
      if (progress) {
        progress.status = 'failed';
        progress.error = error.message;
        progress.logs.push(`[Error] Failed to stop containers: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Schedule automatic timeout for test environment
   */
  private async scheduleTestTimeout(userId: string, scenarioId: string, testId: string): Promise<void> {
    const settings = await this.systemSettingsRepo.findOne({ where: { id: '1' } });
    const timeoutMinutes = settings?.dockerTestTimeoutMinutes || 60;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    this.logger.log(`Scheduled timeout for test ${testId} in ${timeoutMinutes} minutes`);

    setTimeout(async () => {
      const progress = this.activeTests.get(testId);
      if (progress && progress.status === 'running') {
        this.logger.warn(`Test ${testId} timed out after ${timeoutMinutes} minutes. Auto-cleaning up.`);
        
        progress.logs.push(`[Timeout] ⏱️ Test exceeded ${timeoutMinutes} minute limit. Auto-stopping...`);
        
        try {
          await this.stopTestContainers(userId, scenarioId);
          progress.logs.push(`[Timeout] ✅ Cleanup completed`);
        } catch (error: any) {
          this.logger.error(`Failed to cleanup timed-out test: ${error.message}`);
          progress.logs.push(`[Error] Failed to cleanup: ${error.message}`);
        }
      }
    }, timeoutMs);
  }

  /**
   * Validate docker-compose.yml with auto-correction
   */
  async validateDockerCompose(content: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      autoCorrections: [],
    };

    try {
      // Get dynamic resource limits from SystemSettings
      const resourceLimits = await this.getResourceLimits();
      
      // Parse YAML
      const config = yaml.load(content) as DockerComposeConfig;
      
      if (!config.services) {
        result.valid = false;
        result.errors.push('No services defined in docker-compose.yml');
        return result;
      }

      // Create a copy for auto-corrections
      const correctedConfig: DockerComposeConfig = JSON.parse(JSON.stringify(config));

      // Validate each service
      const serviceNames = Object.keys(config.services);
      
      if (serviceNames.length > resourceLimits.maxContainers) {
        result.valid = false;
        result.errors.push(`Too many containers: ${serviceNames.length} (max: ${resourceLimits.maxContainers})`);
      }

      for (const serviceName of serviceNames) {
        const service = config.services[serviceName];
        
        // Check forbidden images
        if (service.image) {
          const imageName = service.image.split(':')[0];
          if (resourceLimits.forbiddenImages.includes(imageName)) {
            result.valid = false;
            result.errors.push(`Forbidden image: ${imageName}. Use embedded/lightweight alternatives.`);
          }
        }

        // Validate CPU limits
        if (service.cpus) {
          const cpus = parseFloat(service.cpus);
          if (cpus > resourceLimits.maxCpus) {
            result.warnings.push(`Service "${serviceName}" requests ${cpus} CPUs (max: ${resourceLimits.maxCpus}). Auto-correcting...`);
            correctedConfig.services[serviceName].cpus = resourceLimits.maxCpus.toString();
            result.autoCorrections.push(`Reduced CPU limit for "${serviceName}" to ${resourceLimits.maxCpus}`);
          }
        } else {
          // Add default CPU limit
          correctedConfig.services[serviceName].cpus = '1';
          result.autoCorrections.push(`Added default CPU limit (1) to "${serviceName}"`);
        }

        // Validate memory limits
        if (service.mem_limit) {
          const memMB = this.parseMemoryLimit(service.mem_limit);
          if (memMB > resourceLimits.maxMemoryMB) {
            result.warnings.push(`Service "${serviceName}" requests ${memMB}MB RAM (max: ${resourceLimits.maxMemoryMB}MB). Auto-correcting...`);
            correctedConfig.services[serviceName].mem_limit = `${resourceLimits.maxMemoryMB}m`;
            result.autoCorrections.push(`Reduced memory limit for "${serviceName}" to ${resourceLimits.maxMemoryMB}MB`);
          }
        } else {
          // Add default memory limit
          correctedConfig.services[serviceName].mem_limit = '512m';
          result.autoCorrections.push(`Added default memory limit (512MB) to "${serviceName}"`);
        }

        // Validate ports
        if (service.ports) {
          if (service.ports.length > resourceLimits.maxPorts) {
            result.valid = false;
            result.errors.push(`Too many ports for "${serviceName}": ${service.ports.length} (max: ${resourceLimits.maxPorts})`);
          }

          for (const portMapping of service.ports) {
            const port = parseInt(portMapping.split(':').pop() || '0');
            if (!resourceLimits.allowedPorts.includes(port)) {
              result.warnings.push(`Port ${port} on "${serviceName}" is not in whitelist. Consider using: ${resourceLimits.allowedPorts.join(', ')}`);
            }
          }
        }

        // Add required labels
        if (!service.labels) {
          correctedConfig.services[serviceName].labels = {};
        }

        for (const requiredLabel of resourceLimits.requiredLabels) {
          if (!service.labels || !service.labels[requiredLabel]) {
            correctedConfig.services[serviceName].labels = correctedConfig.services[serviceName].labels || {};
            correctedConfig.services[serviceName].labels[requiredLabel] = 'auto-generated';
            result.autoCorrections.push(`Added required label '${requiredLabel}' to '${serviceName}'`);
          }
        }

        // Security: Remove privileged mode
        if (service.privileged) {
          result.warnings.push(`Service '${serviceName}' has privileged mode enabled. This is a security risk. Removing...`);
          delete correctedConfig.services[serviceName].privileged;
          result.autoCorrections.push(`Removed privileged mode from '${serviceName}'`);
        }

        // Security: Check for host network mode
        if (service.network_mode === 'host') {
          result.valid = false;
          result.errors.push(`Service '${serviceName}' uses host network mode. This is forbidden.`);
        }

        // Security: Warn about volume mounts
        if (service.volumes) {
          for (const volume of service.volumes) {
            if (volume.includes('/var/run/docker.sock')) {
              result.valid = false;
              result.errors.push(`Service '${serviceName}' mounts Docker socket. This is forbidden.`);
            }
            if (volume.startsWith('/')) {
              result.warnings.push(`Service '${serviceName}' uses absolute host path: ${volume}. Consider using named volumes.`);
            }
          }

          if (service.volumes.length > this.resourceLimits.maxVolumes) {
            result.warnings.push(`Service '${serviceName}' has ${service.volumes.length} volumes (recommended max: ${this.resourceLimits.maxVolumes})`);
          }
        }
      }

      // Store corrected config
      result.correctedConfig = correctedConfig;

      // If we have auto-corrections but no errors, suggest using corrected version
      if (result.autoCorrections.length > 0 && result.errors.length === 0) {
        result.warnings.push(`${result.autoCorrections.length} auto-corrections available. Review and apply corrected configuration.`);
      }

    } catch (error: any) {
      result.valid = false;
      result.errors.push(`Invalid YAML: ${error.message}`);
    }

    return result;
  }

  /**
   * Get corrected docker-compose.yml as string
   */
  getCorrectedDockerCompose(validation: ValidationResult): string {
    if (!validation.correctedConfig) {
      throw new BadRequestException('No corrected config available');
    }

    return yaml.dump(validation.correctedConfig, {
      indent: 2,
      lineWidth: 120,
    });
  }

  /**
   * Generate dynamic docker-compose template using admin-configured limits
   */
  async generateTemplate(scenarioType: 'single-container' | 'multi-container' | 'network-challenge', userId?: string): Promise<string> {
    const resourceLimits = await this.getResourceLimits();
    const maxCpus = resourceLimits.maxCpus;
    const maxMemory = `${resourceLimits.maxMemoryMB}m`;
    const userIdPlaceholder = userId || '{{USER_ID}}';

    const templates = {
      'single-container': `version: '3.8'

services:
  challenge:
    image: alpine:latest    # Change to your preferred image
    container_name: rangex-{{SCENARIO_ID}}-challenge
    cpus: '${maxCpus}'
    mem_limit: ${maxMemory}
    ports:
      - "22:22"    # SSH (if needed)
      - "80:80"    # Web interface
    environment:
      - CHALLENGE_NAME=my-challenge
      - DIFFICULTY=medium
    labels:
      rangex.scenario.name: "My Awesome Challenge"
      rangex.scenario.creator: "${userIdPlaceholder}"
    networks:
      - challenge-net

networks:
  challenge-net:
    driver: bridge

# Platform Limits: Max ${resourceLimits.maxContainers} containers, ${maxCpus} CPUs, ${resourceLimits.maxMemoryMB}MB RAM per container
`,

      'multi-container': `version: '3.8'

services:
  attacker:
    image: alpine:latest    # Change to kalilinux/kali-rolling if cached
    container_name: rangex-{{SCENARIO_ID}}-attacker
    cpus: '${maxCpus}'
    mem_limit: ${maxMemory}
    ports:
      - "22:22"
    environment:
      - ROLE=attacker
    labels:
      rangex.scenario.name: "Network Attack Scenario"
      rangex.scenario.creator: "${userIdPlaceholder}"
    networks:
      - attack-net

  victim:
    image: alpine:latest    # Change to ubuntu:22.04 if needed
    container_name: rangex-{{SCENARIO_ID}}-victim
    cpus: '${maxCpus}'
    mem_limit: ${maxMemory}
    environment:
      - ROLE=victim
    labels:
      rangex.scenario.name: "Network Attack Scenario"
      rangex.scenario.creator: "${userIdPlaceholder}"
    networks:
      - attack-net

networks:
  attack-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24

# Platform Limits: Max ${resourceLimits.maxContainers} containers, ${maxCpus} CPUs, ${resourceLimits.maxMemoryMB}MB RAM per container
# Allowed Ports: ${resourceLimits.allowedPorts.join(', ')}
`,

      'network-challenge': `version: '3.8'

services:
  web-server:
    image: nginx:alpine
    container_name: rangex-{{SCENARIO_ID}}-web
    cpus: '${Math.min(maxCpus, 0.25).toFixed(2)}'
    mem_limit: 128m
    ports:
      - "80:80"
    volumes:
      - ./web-content:/usr/share/nginx/html:ro
    labels:
      rangex.scenario.name: "Web Security Challenge"
      rangex.scenario.creator: "${userIdPlaceholder}"
    networks:
      - web-net

  kali:
    image: alpine:latest    # Change to kalilinux/kali-rolling if cached
    container_name: rangex-{{SCENARIO_ID}}-kali
    cpus: '${maxCpus}'
    mem_limit: ${maxMemory}
    ports:
      - "22:22"
    labels:
      rangex.scenario.name: "Web Security Challenge"
      rangex.scenario.creator: "${userIdPlaceholder}"
    networks:
      - web-net

networks:
  web-net:
    driver: bridge

# Platform Limits: Max ${resourceLimits.maxContainers} containers, ${maxCpus} CPUs, ${resourceLimits.maxMemoryMB}MB RAM per container
# Note: Replace {{SCENARIO_ID}} with actual scenario ID
# Note: Use cached images from Platform Library for faster deployment
`,
    };

    return templates[scenarioType];
  }

  /**
   * Provide contextual hints based on validation errors (uses dynamic admin settings)
   */
  async getHints(validation: ValidationResult): Promise<string[]> {
    const hints: string[] = [];
    const resourceLimits = await this.getResourceLimits();

    if (validation.errors.some((e) => e.includes('Too many containers'))) {
      hints.push(`💡 Platform Limit: Max ${resourceLimits.maxContainers} containers per scenario. Consider consolidating services.`);
    }

    if (validation.errors.some((e) => e.includes('Forbidden image'))) {
      hints.push(`💡 Platform Limit: Forbidden images: ${resourceLimits.forbiddenImages.join(', ')}. Use SQLite or embedded databases instead.`);
    }

    if (validation.warnings.some((w) => w.includes('privileged'))) {
      hints.push('💡 Security: Privileged mode is forbidden. Use specific capabilities instead (e.g., CAP_NET_ADMIN).');
    }

    if (validation.warnings.some((w) => w.includes('CPU'))) {
      hints.push(`💡 Platform Limit: Max ${resourceLimits.maxCpus} CPUs per container (admin configured).`);
    }

    if (validation.warnings.some((w) => w.includes('RAM') || w.includes('memory'))) {
      hints.push(`💡 Platform Limit: Max ${resourceLimits.maxMemoryMB}MB RAM per container (admin configured).`);
    }

    if (validation.autoCorrections.length > 0) {
      hints.push('✅ Auto-corrections applied! Review the corrected config below.');
    }

    // Show current platform limits
    hints.push(`\n📋 Current Platform Limits:\n• Max ${resourceLimits.maxContainers} containers\n• Max ${resourceLimits.maxCpus} CPUs per container\n• Max ${resourceLimits.maxMemoryMB}MB RAM per container\n• Allowed ports: ${resourceLimits.allowedPorts.join(', ')}`);

    return hints;
  }

  /**
   * Helper: Parse memory limit to MB
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k': return value / 1024;
      case 'm': return value;
      case 'g': return value * 1024;
      default: return value / (1024 * 1024); // Bytes to MB
    }
  }

  /**
   * Get local Docker images available on creator's machine
   */
  async getLocalImages(userId: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
      const images = stdout.trim().split('\n').filter(Boolean);
      
      this.logger.log(`Found ${images.length} local images for user ${userId}`);
      return images;
    } catch (error: any) {
      this.logger.error(`Failed to get local images: ${error.message}`);
      return [];
    }
  }

  /**
   * Build Docker image from Dockerfile
   */
  async buildImage(
    userId: string,
    scenarioId: string,
    dockerfilePath: string,
    imageName: string
  ): Promise<{ success: boolean; imageId?: string; logs?: string; error?: string }> {
    this.logger.log(`Building image ${imageName} for scenario ${scenarioId}`);

    try {
      const { stdout, stderr } = await execAsync(
        `docker build -t ${imageName} -f ${dockerfilePath} .`,
        { cwd: path.dirname(dockerfilePath) }
      );

      // Extract image ID from build output
      const imageIdMatch = stdout.match(/Successfully built ([a-f0-9]+)/);
      const imageId = imageIdMatch ? imageIdMatch[1] : undefined;

      this.logger.log(`Built image ${imageName}: ${imageId}`);

      return {
        success: true,
        imageId,
        logs: stdout + stderr,
      };
    } catch (error: any) {
      this.logger.error(`Failed to build image: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Auto-generate docker-compose.yml from Environment tab machines
   * Includes userId for multi-creator isolation
   */
  async generateFromEnvironment(machines: any[], userId: string, versionId: string): Promise<string> {
    this.logger.log(`Generating docker-compose from ${machines.length} machines for user ${userId}`);

    // Create unique network name per user to prevent conflicts
    const userPrefix = userId.substring(0, 8);
    const versionPrefix = versionId.substring(0, 8);
    const networkName = `rangex-${userPrefix}-net`;

    const config: DockerComposeConfig = {
      version: '3.8',
      services: {},
      networks: {
        [networkName]: {
          driver: 'bridge',
        },
      },
    };

    for (const machine of machines) {
      const serviceName = machine.name.toLowerCase().replace(/\s+/g, '-');
      
      // Ensure image has a tag
      let imageRef = machine.imageRef || 'alpine:latest';
      if (!imageRef.includes(':')) {
        imageRef = `${imageRef}:latest`;
      }
      
      config.services[serviceName] = {
        image: imageRef,
        // Unique container name per user + scenario to prevent conflicts
        container_name: `rangex-${userPrefix}-${versionPrefix}-${serviceName}`,
        cpus: '0.5',
        mem_limit: '250m',
        networks: [networkName],
        labels: {
          'rangex.user.id': userId,
          'rangex.scenario.version.id': versionId,
          'rangex.machine.id': machine.id,
          'rangex.machine.name': machine.name,
          'rangex.machine.role': machine.role || 'internal',
        },
      };
    }

    return yaml.dump(config, { indent: 2, lineWidth: 120 });
  }

  /**
   * Check container health and set localTestStatus PASS/FAIL
   * Checks for:
   * - All containers running (not exited/crashed)
   * - Healthcheck status (if defined)
   * - No restart loops
   */
  private async checkContainerHealthAndSetStatus(
    scenarioId: string,
    containerIds: string[],
    progress: TestProgress
  ): Promise<void> {
    try {
      // Wait 5 seconds for containers to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000));

      let allHealthy = true;
      const healthReports: string[] = [];

      for (const containerId of containerIds) {
        try {
          // Get container state
          const { stdout } = await execAsync(
            `docker inspect --format='{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}' ${containerId}`
          );
          
          const [status, health, restartCount] = stdout.trim().split('|');

          // Check if running
          if (status !== 'running') {
            allHealthy = false;
            healthReports.push(`❌ Container ${containerId.substring(0, 12)}: Status=${status} (not running)`);
            continue;
          }

          // Check restart loops
          const restarts = parseInt(restartCount || '0', 10);
          if (restarts > 0) {
            allHealthy = false;
            healthReports.push(`❌ Container ${containerId.substring(0, 12)}: Restarted ${restarts} times`);
            continue;
          }

          // Check healthcheck if defined
          if (health && health !== '<no value>') {
            if (health === 'healthy') {
              healthReports.push(`✅ Container ${containerId.substring(0, 12)}: Healthy`);
            } else if (health === 'unhealthy') {
              allHealthy = false;
              healthReports.push(`❌ Container ${containerId.substring(0, 12)}: Unhealthy`);
            } else if (health === 'starting') {
              // Still starting, treat as healthy for now
              healthReports.push(`⏳ Container ${containerId.substring(0, 12)}: Starting...`);
            }
          } else {
            // No healthcheck defined, just check if running
            healthReports.push(`✅ Container ${containerId.substring(0, 12)}: Running (no healthcheck)`);
          }
        } catch (error: any) {
          allHealthy = false;
          healthReports.push(`❌ Container ${containerId.substring(0, 12)}: Failed to inspect - ${error.message}`);
        }
      }

      // Log health reports
      healthReports.forEach(report => progress.logs.push(`[Health] ${report}`));

      // Set localTestStatus based on health
      if (allHealthy) {
        await this.scenarioVersionRepo.update(scenarioId, {
          localTestStatus: 'PASS',
        });
        progress.logs.push(`[Test Result] ✅ PASS - All containers healthy`);
      } else {
        await this.scenarioVersionRepo.update(scenarioId, {
          localTestStatus: 'FAIL',
        });
        progress.logs.push(`[Test Result] ❌ FAIL - Some containers are unhealthy`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to check container health: ${error.message}`);
      await this.scenarioVersionRepo.update(scenarioId, {
        localTestStatus: 'FAIL',
      });
      progress.logs.push(`[Test Result] ❌ FAIL - Health check error: ${error.message}`);
    }
  }

  /**
   * Start a simple test container for debugging
   */
  async startTestContainer(imageName: string, userId: string): Promise<string> {
    try {
      const containerName = `rangex-test-${userId.substring(0, 8)}-${Date.now()}`;
      
      // Simple docker run command
      const cmd = `docker run -d --name ${containerName} --rm ${imageName} tail -f /dev/null`;
      
      const { stdout } = await execAsync(cmd);
      const containerId = stdout.trim();
      
      this.logger.log(`Test container started: ${containerName} (${containerId.substring(0, 12)})`);
      
      return containerId;
    } catch (error: any) {
      this.logger.error(`Failed to start test container: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Stop and remove a test container
   */
  async stopTestContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${containerId}`);
      this.logger.log(`Test container stopped: ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      this.logger.error(`Failed to stop test container: ${error?.message || error}`);
      throw error;
    }
  }
}
