import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { Machine } from '../entities/machine.entity';
import * as MinioClient from 'minio';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface ScenarioBundle {
  version: string; // Bundle format version
  scenarioVersionId: string;
  scenarioId: string;
  versionNumber: number;
  title: string;
  createdAt: string;
  
  // Compose manifest
  dockerCompose: string; // YAML content
  composeHash: string; // SHA256 checksum
  
  // Machines summary
  machines: Array<{
    id: string;
    name: string;
    role: string;
    imageRef: string;
    resourceProfile: string;
    networkGroup: string;
    entrypoints: Array<{
      protocol: string;
      containerPort: number;
      exposedToSolver: boolean;
      description?: string;
    }>;
  }>;
  
  // Deterministic port mapping (stable across deployments)
  portMapping: Array<{
    machineId: string;
    machineName: string;
    protocol: string;
    containerPort: number;
    externalPort: number; // Stable external port
  }>;
  
  // Assets manifest
  assets: Array<{
    id: string;
    filename: string;
    minioPath: string; // Path in rangex-assets bucket
    checksum: string; // SHA256
  }>;
  
  // Image plan (critical for ephemeral AWS deployments)
  images: Array<{
    machineId: string;
    machineName: string;
    sourceType: 'public_digest' | 'oci_archive';
    imageRef: string; // Original image reference
    digest?: string; // For public images with pinned digest (e.g., nginx@sha256:...)
    archivePath?: string; // For OCI archives (e.g., rangex-images/scenario-123/nginx.tar)
    archiveChecksum?: string; // SHA256 of tar file
  }>;
}

@Injectable()
export class BundleService {
  private readonly logger = new Logger(BundleService.name);
  private readonly minioClient: MinioClient.Client;
  private readonly bucketBundles = 'rangex-bundles';
  private readonly bucketImages = 'rangex-images';
  private readonly bucketAssets = 'rangex-assets';

  constructor(
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    private readonly configService: ConfigService,
  ) {
    // Initialize MinIO client
    this.minioClient = new MinioClient.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });

    this.ensureBuckets();
  }

  /**
   * Ensure required MinIO buckets exist
   */
  private async ensureBuckets(): Promise<void> {
    const buckets = [this.bucketBundles, this.bucketImages, this.bucketAssets];
    const minioRegion = this.configService.get<string>('AWS_REGION', 'ap-south-2');
    
    for (const bucket of buckets) {
      try {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket, minioRegion);
          this.logger.log(`Created MinIO bucket: ${bucket}`);
        }
      } catch (error) {
        this.logger.error(`Failed to create bucket ${bucket}:`, error);
      }
    }
  }

  /**
   * Create a complete scenario bundle (LOCAL STORAGE)
   * This is the CRITICAL function that enables ephemeral AWS deployments
   */
  async createBundle(versionId: string, dockerCompose: string): Promise<ScenarioBundle> {
    this.logger.log(`Creating bundle for version ${versionId}`);

    // Update status
    await this.versionRepo.update(versionId, {
      bundleStatus: 'CREATING',
    });

    try {
      // Load scenario version with machines and assets
      const version = await this.versionRepo.findOne({
        where: { id: versionId },
        relations: ['machines', 'assets', 'scenario'],
      });

      if (!version) {
        throw new Error('Scenario version not found');
      }

      // Generate deterministic port mapping (stable across deployments)
      const portMapping = this.generatePortMapping(version.machines || []);

      // Create images plan (archive OCI images for non-public images)
      const images = await this.createImagePlan(version.machines || [], versionId);

      // Build bundle
      const bundle: ScenarioBundle = {
        version: '1.0.0',
        scenarioVersionId: versionId,
        scenarioId: version.scenarioId,
        versionNumber: version.versionNumber,
        title: version.title,
        createdAt: new Date().toISOString(),
        dockerCompose,
        composeHash: this.computeHash(dockerCompose),
        machines: (version.machines || []).map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          imageRef: m.imageRef,
          resourceProfile: m.resourceProfile,
          networkGroup: m.networkGroup,
          entrypoints: m.entrypoints || [],
        })),
        portMapping,
        assets: (version.assets || []).map(a => ({
          id: a.id,
          filename: a.fileName || '',
          minioPath: a.minioPath || '',
          checksum: this.computeHash(a.fileUrl || a.fileName || ''),
        })),
        images,
      };

      // Store bundle in MinIO
      const bundlePath = `scenario-${version.scenarioId}/v${version.versionNumber}.bundle.json`;
      const bundleContent = JSON.stringify(bundle, null, 2);

      await this.minioClient.putObject(
        this.bucketBundles,
        bundlePath,
        Buffer.from(bundleContent),
        bundleContent.length,
        {
          'Content-Type': 'application/json',
          'x-amz-meta-scenario-version-id': versionId,
          'x-amz-meta-created-at': new Date().toISOString(),
        },
      );

      this.logger.log(`Bundle created: ${bundlePath}`);

      // Update version with bundle path
      await this.versionRepo.update(versionId, {
        bundleStatus: 'READY',
        bundlePath: `${this.bucketBundles}/${bundlePath}`,
        currentStage: 'bundled',
      });

      return bundle;
    } catch (error) {
      this.logger.error(`Bundle creation failed:`, error);
      await this.versionRepo.update(versionId, {
        bundleStatus: 'FAILED',
      });
      throw error;
    }
  }

  /**
   * Load bundle from MinIO
   */
  async getBundle(bundlePath: string): Promise<ScenarioBundle> {
    const [bucket, ...pathParts] = bundlePath.split('/');
    const objectPath = pathParts.join('/');

    const stream = await this.minioClient.getObject(bucket, objectPath);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(content));
      });
      stream.on('error', reject);
    });
  }

  /**
   * Generate deterministic port mapping (stable external ports)
   * Uses hash-based assignment to ensure same machine+port always gets same external port
   */
  private generatePortMapping(machines: Machine[]): ScenarioBundle['portMapping'] {
    const mapping: ScenarioBundle['portMapping'] = [];
    const basePort = 8000; // Start from 8000
    const usedPorts = new Set<number>();

    for (const machine of machines) {
      for (const ep of machine.entrypoints || []) {
        if (!ep.exposedToSolver) continue;

        // Generate stable port based on machine ID + container port
        const seed = `${machine.id}-${ep.containerPort}`;
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        const offset = parseInt(hash.substring(0, 4), 16) % 10000; // 0-9999
        let externalPort = basePort + offset;

        // Ensure uniqueness (collision handling)
        while (usedPorts.has(externalPort)) {
          externalPort++;
          if (externalPort > 65535) externalPort = basePort;
        }

        usedPorts.add(externalPort);

        mapping.push({
          machineId: machine.id,
          machineName: machine.name,
          protocol: ep.protocol,
          containerPort: ep.containerPort,
          externalPort,
        });
      }
    }

    return mapping;
  }

  /**
   * Create image plan and archive OCI images
   * CRITICAL: This enables ephemeral AWS deployments by storing images locally
   */
  private async createImagePlan(machines: Machine[], versionId: string): Promise<ScenarioBundle['images']> {
    const images: ScenarioBundle['images'] = [];

    for (const machine of machines) {
      const imageRef = machine.imageRef;

      // Check if image has a digest (pinned public image)
      if (imageRef.includes('@sha256:')) {
        // Public image with digest - no archive needed
        images.push({
          machineId: machine.id,
          machineName: machine.name,
          sourceType: 'public_digest',
          imageRef,
          digest: imageRef.split('@')[1],
        });
      } else {
        // Archive image to MinIO (critical for consistency)
        try {
          const archivePath = await this.archiveImage(imageRef, versionId, machine.id);
          const archiveChecksum = await this.computeFileHash(archivePath);

          images.push({
            machineId: machine.id,
            machineName: machine.name,
            sourceType: 'oci_archive',
            imageRef,
            archivePath,
            archiveChecksum,
          });
        } catch (error) {
          this.logger.error(`Failed to archive image ${imageRef}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Image archive failed for ${imageRef}: ${errorMessage}`);
        }
      }
    }

    return images;
  }

  /**
   * Archive Docker image to MinIO as OCI tar
   */
  private async archiveImage(imageRef: string, versionId: string, machineId: string): Promise<string> {
    const sanitizedRef = imageRef.replace(/[^a-z0-9-]/gi, '_');
    const tarFilename = `${sanitizedRef}.tar`;
    const tmpPath = path.join('/tmp', tarFilename);
    const minioPath = `scenario-${versionId}/${machineId}/${tarFilename}`;

    try {
      // Pull image if not present
      this.logger.log(`Pulling image: ${imageRef}`);
      await execAsync(`docker pull ${imageRef}`);

      // Save image to tar
      this.logger.log(`Saving image to tar: ${tmpPath}`);
      await execAsync(`docker save -o ${tmpPath} ${imageRef}`);

      // Upload to MinIO
      this.logger.log(`Uploading tar to MinIO: ${minioPath}`);
      const stats = await fs.stat(tmpPath);
      const stream = require('fs').createReadStream(tmpPath);

      await this.minioClient.putObject(
        this.bucketImages,
        minioPath,
        stream,
        stats.size,
        {
          'Content-Type': 'application/x-tar',
          'x-amz-meta-image-ref': imageRef,
          'x-amz-meta-version-id': versionId,
          'x-amz-meta-machine-id': machineId,
        },
      );

      // Clean up tmp file
      await fs.unlink(tmpPath);

      return `${this.bucketImages}/${minioPath}`;
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(tmpPath);
      } catch {}
      throw error;
    }
  }

  /**
   * Load OCI archive from MinIO and restore to Docker
   */
  async loadImageFromArchive(archivePath: string): Promise<void> {
    const [bucket, ...pathParts] = archivePath.split('/');
    const objectPath = pathParts.join('/');
    const tmpPath = path.join('/tmp', `restore-${Date.now()}.tar`);

    try {
      // Download tar from MinIO
      this.logger.log(`Downloading image archive: ${archivePath}`);
      await this.minioClient.fGetObject(bucket, objectPath, tmpPath);

      // Load into Docker
      this.logger.log(`Loading image into Docker: ${tmpPath}`);
      await execAsync(`docker load -i ${tmpPath}`);

      // Clean up
      await fs.unlink(tmpPath);
    } catch (error) {
      try {
        await fs.unlink(tmpPath);
      } catch {}
      throw error;
    }
  }

  /**
   * Compute SHA256 hash
   */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compute file hash
   */
  private async computeFileHash(filePath: string): Promise<string> {
    const [bucket, ...pathParts] = filePath.split('/');
    const objectPath = pathParts.join('/');

    const stream = await this.minioClient.getObject(bucket, objectPath);
    const hash = crypto.createHash('sha256');

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
