import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioAsset } from '../entities/scenario-asset.entity';
import { MinioService } from './minio.service';
import { Client as MinioClient } from 'minio';
import { ECRClient, GetAuthorizationTokenCommand, BatchGetImageCommand } from '@aws-sdk/client-ecr';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Base image allowlist (dev-safe approved images only)
const ALLOWED_BASE_IMAGES = new Set([
  'nginx:alpine',
  'nginx:latest',
  'postgres:15',
  'postgres:15-alpine',
  'redis:7-alpine',
  'redis:latest',
  'mysql:8',
  'mysql:latest',
  'kalilinux/kali-rolling',
  'kalilinux/kali-last-release',
  'ubuntu:22.04',
  'ubuntu:latest',
  'debian:12',
  'debian:latest',
  'alpine:latest',
]);

// Build timeout configuration (default: 30 minutes)
const BUILD_TIMEOUT_MS = Number(process.env.BUILD_TIMEOUT_MS || 30 * 60 * 1000);
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB output buffer

/**
 * BuildOrchestrationService - Phase 2-3
 * 
 * Manages the MinIO → ECR build pipeline:
 * 1. Download assets from MinIO (scenario-specific folder)
 * 2. Generate Dockerfiles for each machine
 * 3. Build images with Docker CLI
 * 4. Push to AWS ECR
 * 5. Store build logs + image digests in database
 * 
 * Triggered by ScenarioApprovalService.approveVersion()
 */
@Injectable()
export class BuildOrchestrationService {
  private readonly logger = new Logger(BuildOrchestrationService.name);
  private readonly ecrClient: ECRClient;
  private readonly ecrRegistry: string;
  private readonly ecrRegion: string;
  private readonly buildTempDir: string;

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly scenarioVersionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioAsset)
    private readonly assetRepo: Repository<ScenarioAsset>,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {
    // ECR configuration
    this.ecrRegion = this.configService.get<string>('AWS_REGION') || 'ap-south-2';
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID');
    if (!accountId) {
      this.logger.warn('AWS_ACCOUNT_ID not configured - ECR builds will fail');
    }
    this.ecrRegistry = `${accountId}.dkr.ecr.${this.ecrRegion}.amazonaws.com`;

    this.ecrClient = new ECRClient({ region: this.ecrRegion });

    // Temporary build directory
    this.buildTempDir = path.join(process.cwd(), 'temp-builds');
    fs.mkdir(this.buildTempDir, { recursive: true });
  }

  /**
   * Main pipeline: Build and push images for approved scenario
   */
  async enqueueBuildJob(versionId: string): Promise<void> {
    this.logger.log(`[BUILD] Starting build job for version ${versionId}`);

    try {
      // Initialize build logs
      await this.scenarioVersionRepo.update(versionId, {
        buildStatus: 'RUNNING',
        buildLogs: `[${new Date().toISOString()}] Build started\n`,
      });

      // Load version + machines + scenario
      const version = await this.scenarioVersionRepo.findOne({
        where: { id: versionId },
        relations: ['machines', 'scenario'],
      });

      if (!version) {
        throw new InternalServerErrorException(`Scenario version ${versionId} not found`);
      }

      const buildStartTime = new Date();

      // Load creator ID and scenario ID from scenario relation
      if (!version.scenario) {
        throw new InternalServerErrorException('Scenario relation not loaded');
      }
      const scenarioId = version.scenario.id;

      // Verify machines loaded
      if (!version.machines || version.machines.length === 0) {
        throw new InternalServerErrorException('No machines found for scenario version');
      }

      // Step 1: Load assets and download from MinIO
      this.logger.log(`[BUILD] Step 1/5: Loading assets from database`);
      await this.appendBuildLog(versionId, 'Step 1/5: Downloading assets from MinIO');
      
      // Load assets for this version
      const versionAssets = await this.assetRepo.find({
        where: { scenarioVersionId: versionId, assetLocation: 'machine-embedded' },
      });
      this.logger.log(`[BUILD] Found ${versionAssets.length} machine-embedded assets`);
      
      // Download assets organized by machine
      const assetsDir = await this.downloadAssetsFromMinIO(versionId, version.machines, versionAssets);
      await this.appendBuildLog(versionId, `Assets downloaded to: ${assetsDir}`);

      // Step 2: Generate Dockerfiles for each machine
      this.logger.log(`[BUILD] Step 2/5: Generating Dockerfiles`);
      await this.appendBuildLog(versionId, 'Step 2/5: Generating Dockerfiles');
      await this.generateDockerfiles(version.machines, assetsDir, versionAssets);
      await this.appendBuildLog(versionId, `Generated ${version.machines.length} Dockerfiles`);

      // Step 3: Docker login to ECR
      this.logger.log(`[BUILD] Step 3/5: Authenticating with ECR`);
      await this.appendBuildLog(versionId, 'Step 3/5: ECR authentication');
      await this.loginToECR();
      await this.appendBuildLog(versionId, `Logged in to ECR registry: ${this.ecrRegistry}`);

      // Step 4: Build and push images
      this.logger.log(`[BUILD] Step 4/5: Building and pushing images`);
      await this.appendBuildLog(versionId, 'Step 4/5: Building and pushing images to ECR');
      const imageDigests = await this.buildAndPushToECR(version.machines, assetsDir, versionId, scenarioId);
      await this.appendBuildLog(versionId, `Built and pushed ${imageDigests.size} images`);

      // Step 5: Update database with image digests
      this.logger.log(`[BUILD] Step 5/5: Updating database`);
      await this.appendBuildLog(versionId, 'Step 5/5: Updating database with image digests');
      await this.updateImageDigests(version, imageDigests);

      const buildDuration = Date.now() - buildStartTime.getTime();
      await this.appendBuildLog(versionId, `Build completed successfully in ${(buildDuration / 1000).toFixed(2)}s`);
      
      // Mark build as successful and set ecrImagesPushed flag
      await this.scenarioVersionRepo.update(versionId, { 
        buildStatus: 'SUCCESS',
        ecrImagesPushed: true,
      });
      
      // Phase 2: Create per-machine ECS task definitions (one task per machine)
      this.logger.log(`[BUILD] Creating per-machine ECS task definitions for version ${versionId}`);
      await this.appendBuildLog(versionId, 'Creating ECS task definitions for each machine...');
      
      try {
        await this.createTaskDefinitionsPerMachine(version);
        await this.appendBuildLog(versionId, `✅ Per-machine task definitions created successfully`);
      } catch (taskDefError: any) {
        this.logger.warn(`[BUILD] Failed to create task definitions: ${taskDefError.message}`);
        await this.appendBuildLog(versionId, `⚠️  WARN: Task definition creation failed: ${taskDefError.message}`);
        // Don't fail the entire build - task definitions can be created later
      }
      
      this.logger.log(`[BUILD] ✅ Build job completed for version ${versionId}`);
      await this.appendBuildLog(versionId, '✅ Build pipeline completed successfully');

      // Cleanup temp files
      await this.cleanup(assetsDir);

    } catch (error: any) {
      this.logger.error(`[BUILD] ❌ Build failed for version ${versionId}:`, error.stack);
      
      // Mark build as failed
      await this.scenarioVersionRepo.update(versionId, { buildStatus: 'FAILED' });
      
      // Store error logs (sanitize sensitive data)
      const sanitizedError = this.sanitizeBuildError(error);
      await this.appendBuildLog(versionId, `\n❌ BUILD FAILED:\n${sanitizedError}`);
      
      throw error;
    }
  }

  /**
   * Download assets from MinIO to local temp directory, organized by machine name
   */
  private async downloadAssetsFromMinIO(
    versionId: string,
    machines: Machine[],
    assets: ScenarioAsset[]
  ): Promise<string> {
    const localDir = path.join(this.buildTempDir, versionId);

    try {
      await fs.mkdir(localDir, { recursive: true });

      // Get MinIO client (internal access)
      const minio = (this.minioService as any).minioClient as MinioClient | undefined;
      const bucket = this.configService.get<string>('MINIO_BUCKET') || 'rangex-assets';

      if (!minio) {
        throw new InternalServerErrorException('MinIO client not initialized');
      }

      // Create machine ID to name mapping
      const machineIdToName = new Map<string, string>();
      for (const machine of machines) {
        machineIdToName.set(machine.id, machine.name);
      }

      this.logger.log(`[BUILD] Downloading ${assets.length} assets`);

      // Download each asset to its machine folder
      for (const asset of assets) {
        if (!asset.minioPath) {
          this.logger.warn(`[BUILD] Asset ${asset.fileName} has no minioPath, skipping`);
          continue;
        }

        if (!asset.machineId) {
          this.logger.warn(`[BUILD] Asset ${asset.fileName} has no machineId, skipping`);
          continue;
        }

        const machineName = machineIdToName.get(asset.machineId);
        if (!machineName) {
          this.logger.warn(`[BUILD] Asset ${asset.fileName} references unknown machine ${asset.machineId}, skipping`);
          continue;
        }

        // Download to: <localDir>/<machine-name>/<filename>
        const machineDir = path.join(localDir, machineName);
        await fs.mkdir(machineDir, { recursive: true });
        
        const localPath = path.join(machineDir, asset.fileName);

        // Download file from MinIO
        try {
          await minio.fGetObject(bucket, asset.minioPath, localPath);
          this.logger.log(`[BUILD] Downloaded: ${machineName}/${asset.fileName}`);
        } catch (error: any) {
          this.logger.error(`[BUILD] Failed to download ${asset.minioPath}: ${error.message}`);
          throw new InternalServerErrorException(`Failed to download asset: ${asset.fileName}`);
        }
      }

      return localDir;
    } catch (error: any) {
      this.logger.error(`[BUILD] Failed to download assets:`, error);
      throw new InternalServerErrorException(`Asset download failed: ${error.message}`);
    }
  }

  /**
   * Generate Dockerfiles for each machine
   */
  private async generateDockerfiles(machines: Machine[], assetsDir: string, assets: ScenarioAsset[]): Promise<void> {
    for (const machine of machines) {
      // Sanitize machine name for Docker compatibility (no spaces, lowercase)
      const sanitizedName = machine.name.replace(/\s+/g, '-').toLowerCase();
      const dockerfilePath = path.join(assetsDir, `Dockerfile.${sanitizedName}`);

      // Base Dockerfile content
      let dockerfileContent = `# Auto-generated Dockerfile for ${machine.name}\n`;
      dockerfileContent += `# Image: ${machine.imageRef}\n\n`;
      dockerfileContent += `FROM ${machine.imageRef}\n\n`;

      // Environment variables
      if (machine.envVars && Object.keys(machine.envVars).length > 0) {
        dockerfileContent += `# Environment variables\n`;
        for (const [key, value] of Object.entries(machine.envVars)) {
          dockerfileContent += `ENV ${key}="${value}"\n`;
        }
        dockerfileContent += `\n`;
      }

      // Copy assets with proper targetPath (matching docker-compose-generator approach)
      const machineAssets = assets.filter(a => a.machineId === machine.id);
      if (machineAssets.length > 0) {
        dockerfileContent += `# Copy machine-embedded assets\n`;
        for (const asset of machineAssets) {
          if (asset.targetPath) {
            // Ensure target directory exists
            const targetDir = path.dirname(asset.targetPath);
            if (targetDir !== '/') {
              dockerfileContent += `RUN mkdir -p ${targetDir}\n`;
            }
            
            // Copy asset to target path (use JSON array syntax for paths with spaces)
            const sourcePath = `${machine.name}/${asset.fileName}`;
            dockerfileContent += `COPY ["${sourcePath}", "${asset.targetPath}"]\n`;
            
            // Set permissions if specified
            if (asset.permissions) {
              dockerfileContent += `RUN chmod ${asset.permissions} ${asset.targetPath}\n`;
            }
          }
        }
        dockerfileContent += `\n`;
      }

      // Attacker bootstrap (GUI image + packages + commands)
      if (machine.attackerBootstrap) {
        const bootstrap = machine.attackerBootstrap;

        // Install packages
        if (bootstrap.installPackages && bootstrap.installPackages.length > 0) {
          dockerfileContent += `# Install packages\n`;
          dockerfileContent += `RUN apt-get update && apt-get install -y ${bootstrap.installPackages.join(' ')} \\\n`;
          dockerfileContent += `    && rm -rf /var/lib/apt/lists/*\n\n`;
        }

        // Run bootstrap commands
        if (bootstrap.runCommands && bootstrap.runCommands.length > 0) {
          dockerfileContent += `# Bootstrap commands\n`;
          for (const cmd of bootstrap.runCommands) {
            dockerfileContent += `RUN ${cmd}\n`;
          }
          dockerfileContent += `\n`;
        }
      }

      // Entrypoint
      if (machine.entrypoint) {
        const entrypoint = Array.isArray(machine.entrypoint) ? machine.entrypoint : [machine.entrypoint];
        if (entrypoint.length > 0) {
          dockerfileContent += `# Entrypoint\n`;
          dockerfileContent += `ENTRYPOINT [${entrypoint.map((arg: string) => `"${arg}"`).join(', ')}]\n\n`;
        }
      }

      // Command
      if (machine.command) {
        const command = Array.isArray(machine.command) ? machine.command : [machine.command];
        if (command.length > 0) {
          dockerfileContent += `# Command\n`;
          dockerfileContent += `CMD [${command.map((arg: string) => `"${arg}"`).join(', ')}]\n\n`;
        }
      } else {
        // Default CMD to keep container running
        dockerfileContent += `# Default CMD to keep container running\n`;
        dockerfileContent += `CMD ["sleep", "infinity"]\n`;
      }

      // Healthcheck
      if (machine.healthcheck) {
        const hc = machine.healthcheck;
        dockerfileContent += `# Healthcheck\n`;
        dockerfileContent += `HEALTHCHECK `;
        if (hc.intervalSec) dockerfileContent += `--interval=${hc.intervalSec}s `;
        if (hc.timeoutSec) dockerfileContent += `--timeout=${hc.timeoutSec}s `;
        if (hc.retries) dockerfileContent += `--retries=${hc.retries} `;
        dockerfileContent += `CMD ${Array.isArray(hc.test) ? hc.test.join(' ') : hc.test}\n`;
      }

      // Write Dockerfile
      await fs.writeFile(dockerfilePath, dockerfileContent);
      this.logger.log(`[BUILD] Generated Dockerfile for ${machine.name}`);
    }
  }

  /**
   * Login to AWS ECR
   */
  private async loginToECR(): Promise<void> {
    try {
      const command = new GetAuthorizationTokenCommand({});
      const response = await this.ecrClient.send(command);

      if (!response.authorizationData || response.authorizationData.length === 0) {
        throw new Error('No ECR authorization data received');
      }

      const authToken = response.authorizationData[0].authorizationToken;
      if (!authToken) {
        throw new Error('No ECR authorization token');
      }

      // Decode base64 token (format: AWS:password)
      const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
      const [username, password] = decodedToken.split(':');

      // Docker login (cross-platform)
      const isWindows = process.platform === 'win32';
      const loginCmd = isWindows
        ? `echo ${password} | docker login --username ${username} --password-stdin ${this.ecrRegistry}`
        : `echo "${password}" | docker login --username ${username} --password-stdin ${this.ecrRegistry}`;
      
      const { stdout, stderr } = await exec(loginCmd, { 
        shell: isWindows ? 'powershell.exe' : '/bin/bash' 
      });

      this.logger.log(`[BUILD] ECR login successful: ${stdout}`);
      if (stderr) this.logger.warn(`[BUILD] ECR login stderr: ${stderr}`);

    } catch (error: any) {
      this.logger.error(`[BUILD] ECR login failed:`, error);
      throw new InternalServerErrorException(`ECR login failed: ${error.message}`);
    }
  }

  /**
   * Build images with Docker and push to ECR
   */
  private async buildAndPushToECR(
    machines: Machine[],
    assetsDir: string,
    versionId: string,
    scenarioId: string,
  ): Promise<Map<string, string>> {
    const imageDigests = new Map<string, string>();

    for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      
      // Sanitize machine name for Docker (no spaces, lowercase)
      const sanitizedName = machine.name.replace(/\s+/g, '-').toLowerCase();
      
      // Extract base image name from machine.imageRef (e.g., "dvwa/web-dvwa:latest" → "web-dvwa")
      // This enables image sharing: multiple scenarios using same base image = same ECR repo
      const baseImageParts = machine.imageRef.split('/');
      const baseImageWithTag = baseImageParts[baseImageParts.length - 1]; // "web-dvwa:latest"
      const baseImage = baseImageWithTag.split(':')[0] || sanitizedName; // "web-dvwa"
      
      // ECR repository name: rangex/{base-image} (shared across scenarios)
      const imageName = `rangex/${baseImage}`;
      
      // Scenario-specific tag: scenario-{scenarioId} (prevents conflicts between users)
      const imageTag = `scenario-${scenarioId}`;
      
      const ecrImageUri = `${this.ecrRegistry}/${imageName}:${imageTag}`;
      const dockerfilePath = path.join(assetsDir, `Dockerfile.${sanitizedName}`);

      try {
        // Build image (quote paths for Windows compatibility)
        this.logger.log(`[BUILD] Building image ${i + 1}/${machines.length}: ${ecrImageUri}`);
        await this.appendBuildLog(versionId, `Building image ${i + 1}/${machines.length}: ${machine.name}`);
        
        const buildCmd = `docker build -f "${dockerfilePath}" -t "${ecrImageUri}" "${assetsDir}"`;
        const { stdout: buildStdout, stderr: buildStderr } = await exec(buildCmd, {
          timeout: BUILD_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER_SIZE,
        });

        this.logger.log(`[BUILD] Build stdout: ${buildStdout.slice(-500)}`); // Last 500 chars
        if (buildStderr) this.logger.warn(`[BUILD] Build stderr: ${buildStderr.slice(-500)}`);
        
        await this.appendBuildLog(versionId, `  ✓ Image built successfully for ${machine.name}`);

        // Ensure ECR repository exists (create if missing)
        await this.ensureECRRepository(imageName);

        // Push image
        this.logger.log(`[BUILD] Pushing image: ${ecrImageUri}`);
        await this.appendBuildLog(versionId, `  Pushing ${machine.name} to ECR...`);
        
        const pushCmd = `docker push ${ecrImageUri}`;
        const { stdout: pushStdout, stderr: pushStderr } = await exec(pushCmd, {
          timeout: BUILD_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER_SIZE,
        });

        this.logger.log(`[BUILD] Push stdout: ${pushStdout.slice(-500)}`);
        if (pushStderr) this.logger.warn(`[BUILD] Push stderr: ${pushStderr.slice(-500)}`);

        // Get image digest from ECR
        const digest = await this.getImageDigest(imageName, imageTag);
        imageDigests.set(machine.id, ecrImageUri + `@${digest}`);
        
        // Store ECR repository reference for ECS task definitions
        // Format: rangex/{base-image}:scenario-{scenarioId}
        machine.ecrRepository = `${imageName}:${imageTag}`;
        await this.machineRepo.save(machine);

        this.logger.log(`[BUILD] ✅ Built and pushed ${machine.name}: ${digest}`);
        this.logger.log(`[BUILD] ECR Reference: ${machine.ecrRepository}`);
        await this.appendBuildLog(versionId, `  ✓ Pushed ${machine.name} successfully (digest: ${digest.substring(0, 12)}...)`);

      } catch (error: any) {
        this.logger.error(`[BUILD] Failed to build/push ${machine.name}:`, error);
        await this.appendBuildLog(versionId, `  ✗ Failed to build ${machine.name}: ${error.message}`);
        throw error;
      }
    }

    return imageDigests;
  }

  /**
   * Ensure ECR repository exists (create if missing)
   */
  private async ensureECRRepository(repositoryName: string): Promise<void> {
    try {
      const { CreateRepositoryCommand } = await import('@aws-sdk/client-ecr');
      const command = new CreateRepositoryCommand({
        repositoryName,
        imageScanningConfiguration: { scanOnPush: true },
        encryptionConfiguration: { encryptionType: 'AES256' },
      });

      await this.ecrClient.send(command);
      this.logger.log(`[BUILD] Created ECR repository: ${repositoryName}`);
    } catch (error: any) {
      // Repository already exists - ignore
      if (error.name === 'RepositoryAlreadyExistsException') {
        this.logger.log(`[BUILD] ECR repository exists: ${repositoryName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get image digest from ECR
   */
  private async getImageDigest(repositoryName: string, imageTag: string): Promise<string> {
    try {
      const command = new BatchGetImageCommand({
        repositoryName,
        imageIds: [{ imageTag }],
      });

      const response = await this.ecrClient.send(command);

      if (!response.images || response.images.length === 0) {
        throw new Error(`Image not found in ECR: ${repositoryName}:${imageTag}`);
      }

      const digest = response.images[0].imageId?.imageDigest;
      if (!digest) {
        throw new Error(`No digest found for ${repositoryName}:${imageTag}`);
      }

      return digest;
    } catch (error: any) {
      this.logger.error(`[BUILD] Failed to get image digest:`, error);
      throw new InternalServerErrorException(`Failed to get image digest: ${error.message}`);
    }
  }

  /**
   * Update machines with ECR image URIs (with digests)
   */
  private async updateImageDigests(
    version: ScenarioVersion,
    imageDigests: Map<string, string>,
  ): Promise<void> {
    if (!version.machines) {
      this.logger.warn('No machines to update with image digests');
      return;
    }

    for (const machine of version.machines) {
      const imageUri = imageDigests.get(machine.id);
      if (imageUri) {
        machine.ecrUri = imageUri; // Store ECR URI@digest
        const digestMatch = imageUri.match(/@(sha256:[a-f0-9]{64})/);
        if (digestMatch) {
          machine.ecrDigest = digestMatch[1];
        }
        await this.machineRepo.save(machine);
        this.logger.log(`[BUILD] Updated ${machine.name} ecrUri: ${imageUri}`);
      }
    }
  }

  /**
   * Store build logs in scenario_version.buildLogs
   */
  private async storeBuildLogs(versionId: string, logs: string): Promise<void> {
    await this.scenarioVersionRepo.update(versionId, { buildLogs: logs });
    this.logger.log(`[BUILD] Stored build logs for version ${versionId} (${logs.length} chars)`);
  }

  /**
   * Append build log entry (for real-time updates)
   */
  private async appendBuildLog(versionId: string, message: string): Promise<void> {
    try {
      const version = await this.scenarioVersionRepo.findOne({ where: { id: versionId } });
      if (!version) return;

      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      const updatedLogs = (version.buildLogs || '') + logEntry;

      await this.scenarioVersionRepo.update(versionId, { buildLogs: updatedLogs });
    } catch (error: any) {
      this.logger.warn(`Failed to append build log: ${error.message}`);
    }
  }

  /**
   * Cleanup temporary build files
   */
  private async cleanup(assetsDir: string): Promise<void> {
    try {
      await fs.rm(assetsDir, { recursive: true, force: true });
      this.logger.log(`[BUILD] Cleaned up temp directory: ${assetsDir}`);
    } catch (error: any) {
      this.logger.warn(`[BUILD] Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Create multi-container ECS task definition from scenario machines
   * Phase 2: ONE task definition per scenario (reused across all solver sessions)
   * 
   * Architecture:
   * - Multi-container: All machines run as containers in ONE task
   * - Private networking: assignPublicIp DISABLED
   * - Fargate Spot: 70% cost savings
   * - Immutable: Each session starts fresh from this task definition
   */
  /**
   * PHASE 2: Create one task definition per machine (cybersecurity lab networking)
   * Each machine gets a unique IP address in AWS VPC for realistic pentesting
   * 
   * Key Changes from Phase 1:
   * - One task definition per machine (not multi-container)
   * - Each task runs as single container
   * - Hash-based reuse to avoid 2000 task def limit
   * - Store ARN in machine.fargateTaskDefinition
   */
  private async createTaskDefinitionsPerMachine(version: ScenarioVersion): Promise<void> {
    const { ECSClient, RegisterTaskDefinitionCommand, DescribeTaskDefinitionCommand } = await import('@aws-sdk/client-ecs');
    
    const ecsClient = new ECSClient({ region: this.ecrRegion });

    if (!version.machines || version.machines.length === 0) {
      throw new Error('No machines found for task definition creation');
    }

    this.logger.log(`[BUILD] Creating ${version.machines.length} task definitions (one per machine)`);

    for (const machine of version.machines) {
      try {
        // Step 1: Calculate hash of machine configuration
        const machineHash = this.calculateMachineHash(machine);
        const taskDefFamily = `rangex-machine-${machineHash}`;

        // Step 2: Check if task definition with this hash already exists
        let existingTaskDefArn: string | undefined;
        try {
          const describeCommand = new DescribeTaskDefinitionCommand({
            taskDefinition: taskDefFamily,
          });
          const describeResponse = await ecsClient.send(describeCommand);
          
          if (describeResponse.taskDefinition?.status === 'ACTIVE') {
            existingTaskDefArn = describeResponse.taskDefinition.taskDefinitionArn;
            this.logger.log(`[BUILD] Reusing existing task definition for ${machine.name}: ${existingTaskDefArn}`);
          }
        } catch (error: any) {
          // Task definition doesn't exist - will create new one
          if (!error.message?.includes('Unable to describe task definition')) {
            this.logger.debug(`[BUILD] Task definition ${taskDefFamily} not found, creating new`);
          }
        }

        // Step 3: If no existing task def, create new one
        if (!existingTaskDefArn) {
          const taskDefArn = await this.registerSingleContainerTaskDef(ecsClient, machine, taskDefFamily);
          existingTaskDefArn = taskDefArn;
          this.logger.log(`[BUILD] Created new task definition for ${machine.name}: ${taskDefArn}`);
        }

        // Step 4: Store ARN in machine.fargateTaskDefinition
        await this.machineRepo.update(machine.id, {
          fargateTaskDefinition: existingTaskDefArn,
        });

        this.logger.log(`[BUILD] ✅ Task definition ready for machine ${machine.name}`);

      } catch (error: any) {
        this.logger.error(`[BUILD] Failed to create task definition for ${machine.name}:`, error.message);
        throw error;
      }
    }

    this.logger.log(`[BUILD] All ${version.machines.length} task definitions created/reused successfully`);
  }

  /**
   * Calculate hash of machine configuration for task def reuse
   * Hash includes: image, resources, env vars, commands, entrypoints
   */
  private calculateMachineHash(machine: Machine): string {
    const crypto = require('crypto');
    
    const configString = JSON.stringify({
      image: machine.ecrRepository || machine.imageRef,
      cpu: this.getResourceCpu(machine.resourceProfile),
      memory: this.getResourceMemory(machine.resourceProfile),
      envVars: machine.envVars || {},
      command: machine.command,
      entrypoint: machine.entrypoint,
      healthcheck: machine.healthcheck,
      networkGroup: machine.networkGroup,
      networkEgressPolicy: machine.networkEgressPolicy,
    });

    return crypto.createHash('sha256').update(configString).digest('hex').substring(0, 16);
  }

  /**
   * Register a single-container task definition for one machine
   */
  private async registerSingleContainerTaskDef(
    ecsClient: any,
    machine: Machine,
    taskDefFamily: string,
  ): Promise<string> {
    const { RegisterTaskDefinitionCommand } = await import('@aws-sdk/client-ecs');

    // Calculate CPU/memory from resourceProfile
    const cpu = this.getResourceCpu(machine.resourceProfile);
    const memory = this.getResourceMemory(machine.resourceProfile);

    // Parse port mappings from entrypoints
    const portMappings = machine.entrypoints?.map(ep => ({
      containerPort: ep.containerPort,
      protocol: ep.protocol === 'udp' ? 'udp' as const : 'tcp' as const,
    })) || [];

    // Single container definition
    const containerDefinition = {
      name: machine.name.replace(/\s+/g, '-').toLowerCase(),
      image: machine.ecrRepository ? `${this.ecrRegistry}/${machine.ecrRepository}` : machine.imageRef,
      cpu,
      memory,
      essential: true,
      portMappings,
      environment: this.parseEnvVars(machine.envVars),
      command: machine.command ? (typeof machine.command === 'string' ? JSON.parse(machine.command) : machine.command) : undefined,
      entryPoint: machine.entrypoint ? (typeof machine.entrypoint === 'string' ? JSON.parse(machine.entrypoint) : machine.entrypoint) : undefined,
      healthCheck: machine.healthcheck ? (typeof machine.healthcheck === 'string' ? JSON.parse(machine.healthcheck) : machine.healthcheck) : undefined,
      logConfiguration: {
        logDriver: 'awslogs' as const,
        options: {
          'awslogs-group': `/ecs/rangex-machines`,
          'awslogs-region': this.ecrRegion,
          'awslogs-stream-prefix': machine.networkGroup || 'default',
          'awslogs-create-group': 'true',
        },
      },
    };

    // Register task definition with proper Fargate CPU/memory combinations
    const taskCpu = this.roundUpTaskCpu(cpu);
    const taskMemory = this.adjustMemoryForCpu(taskCpu, memory);

    const command = new RegisterTaskDefinitionCommand({
      family: taskDefFamily,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: taskCpu.toString(),
      memory: taskMemory.toString(),
      containerDefinitions: [containerDefinition],
      executionRoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole`,
      taskRoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole`,
      tags: [
        { key: 'ManagedBy', value: 'RangeX' },
        { key: 'MachineRole', value: machine.role },
        { key: 'NetworkGroup', value: machine.networkGroup },
      ],
    });

    const response = await ecsClient.send(command);
    const taskDefArn = response.taskDefinition?.taskDefinitionArn;

    if (!taskDefArn) {
      throw new Error('Failed to create task definition - no ARN returned');
    }

    return taskDefArn;
  }

  /**
   * Adjust memory to valid Fargate combination for given CPU
   * Fargate has strict CPU-memory combinations
   */
  private adjustMemoryForCpu(cpu: number, requestedMemory: number): number {
    const validCombinations: Record<number, number[]> = {
      256: [512, 1024, 2048],                     // 0.25 vCPU
      512: [1024, 2048, 3072, 4096],              // 0.5 vCPU
      1024: [2048, 3072, 4096, 5120, 6144, 7168, 8192], // 1 vCPU
      2048: [4096, 5120, 6144, 7168, 8192, 16384], // 2 vCPU
      4096: [8192, 16384, 30720],                 // 4 vCPU
    };

    const validMemories = validCombinations[cpu] || [512];
    return validMemories.find(m => m >= requestedMemory) || validMemories[0];
  }

  /**
   * LEGACY: Old multi-container task definition (Phase 1)
   * DEPRECATED: Use createTaskDefinitionsPerMachine instead
   * Kept for backward compatibility only
   */
  private async createTaskDefinition(version: ScenarioVersion): Promise<void> {
    const { ECSClient, RegisterTaskDefinitionCommand } = await import('@aws-sdk/client-ecs');
    
    const ecsClient = new ECSClient({ region: this.ecrRegion });
    const taskDefFamily = `rangex-scenario-${version.id}`;

    if (!version.machines || version.machines.length === 0) {
      throw new Error('No machines found for task definition creation');
    }

    // Build extra hosts for container-to-container communication
    // Each container can reach others via hostname (e.g., http://web-server/)
    const extraHosts = version.machines.map(m => ({
      hostname: m.name.replace(/\s+/g, '-').toLowerCase(),
      ipAddress: '127.0.0.1', // localhost in same task
    }));

    // Convert machines to ECS container definitions
    const containerDefinitions = version.machines.map(machine => {
      // Calculate CPU/memory from resourceProfile (default: 0.25 vCPU, 512 MB)
      const cpu = this.getResourceCpu(machine.resourceProfile);
      const memory = this.getResourceMemory(machine.resourceProfile);

      // Parse port mappings from entrypoints
      const portMappings = machine.entrypoints?.map(ep => ({
        containerPort: ep.containerPort,
        protocol: ep.protocol === 'udp' ? 'udp' as const : 'tcp' as const,
      })) || [];

      return {
        name: machine.name.replace(/\s+/g, '-').toLowerCase(),
        image: machine.ecrRepository ? `${this.ecrRegistry}/${machine.ecrRepository}` : machine.imageRef,
        cpu,
        memory,
        essential: true,
        portMappings, // Enable port exposure for inter-container communication
        extraHosts, // Enable hostname resolution (web-server → 127.0.0.1)
        environment: this.parseEnvVars(machine.envVars),
        command: machine.command ? JSON.parse(machine.command as any) : undefined,
        entryPoint: machine.entrypoint ? JSON.parse(machine.entrypoint as any) : undefined,
        healthCheck: machine.healthcheck ? JSON.parse(machine.healthcheck as any) : undefined,
        dependsOn: machine.dependsOn ? JSON.parse(machine.dependsOn as any).map((dep: string) => ({
          containerName: dep.replace(/\s+/g, '-').toLowerCase(),
          condition: 'START',
        })) : undefined,
        logConfiguration: {
          logDriver: 'awslogs' as const,
          options: {
            'awslogs-group': `/ecs/rangex-scenarios`,
            'awslogs-region': this.ecrRegion,
            'awslogs-stream-prefix': `${version.id}`,
            'awslogs-create-group': 'true',
          },
        },
      };
    });

    // Calculate total task CPU/memory (sum of all containers)
    const totalCpu = containerDefinitions.reduce((sum, c) => sum + c.cpu, 0);
    const totalMemory = containerDefinitions.reduce((sum, c) => sum + c.memory, 0);

    // Register task definition
    const command = new RegisterTaskDefinitionCommand({
      family: taskDefFamily,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: this.roundUpTaskCpu(totalCpu).toString(),
      memory: this.roundUpTaskMemory(totalMemory).toString(),
      containerDefinitions,
      executionRoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole`,
      taskRoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole`,
    });

    const response = await ecsClient.send(command);
    const taskDefArn = response.taskDefinition?.taskDefinitionArn;

    if (!taskDefArn) {
      throw new Error('Failed to create task definition - no ARN returned');
    }

    // Store task definition ARN in database
    await this.scenarioVersionRepo.update(version.id, {
      fargateTaskDefinition: taskDefArn,
    });

    this.logger.log(`[BUILD] Task definition registered: ${taskDefArn}`);
  }

  /**
   * Parse environment variables from JSON to ECS format
   */
  private parseEnvVars(envVars: any): Array<{ name: string; value: string }> {
    if (!envVars) return [];
    
    try {
      const parsed = typeof envVars === 'string' ? JSON.parse(envVars) : envVars;
      return Object.entries(parsed).map(([name, value]) => ({
        name,
        value: String(value),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get CPU allocation from resource profile
   */
  private getResourceCpu(profile?: string): number {
    switch (profile) {
      case 'small': return 256;   // 0.25 vCPU
      case 'medium': return 512;  // 0.5 vCPU
      case 'large': return 1024;  // 1 vCPU
      default: return 256;         // Default: 0.25 vCPU
    }
  }

  /**
   * Get memory allocation from resource profile
   */
  private getResourceMemory(profile?: string): number {
    switch (profile) {
      case 'small': return 512;    // 512 MB
      case 'medium': return 1024;  // 1 GB
      case 'large': return 2048;   // 2 GB
      default: return 512;          // Default: 512 MB
    }
  }

  /**
   * Round up task CPU to valid Fargate values
   */
  private roundUpTaskCpu(cpu: number): number {
    const validCpus = [256, 512, 1024, 2048, 4096];
    return validCpus.find(v => v >= cpu) || 256;
  }

  /**
   * Round up task memory to valid Fargate values
   */
  private roundUpTaskMemory(memory: number): number {
    const validMemories = [512, 1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192];
    return validMemories.find(v => v >= memory) || 512;
  }

  /**
   * Sanitize build error to remove sensitive data (AWS tokens, passwords)
   */
  private sanitizeBuildError(error: any): string {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorStack = error instanceof Error ? error.stack : '';

    // Remove AWS credentials/tokens (AKIA*, base64 patterns)
    errorMessage = errorMessage.replace(/AKIA[A-Z0-9]{16}/g, '[REDACTED_AWS_KEY]');
    errorMessage = errorMessage.replace(/[A-Za-z0-9+/]{40,}/g, '[REDACTED_TOKEN]');
    errorStack = errorStack?.replace(/AKIA[A-Z0-9]{16}/g, '[REDACTED_AWS_KEY]') || '';
    errorStack = errorStack?.replace(/[A-Za-z0-9+/]{40,}/g, '[REDACTED_TOKEN]') || '';

    return `${errorMessage}\n${errorStack}`;
  }
}
