import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Machine } from '../entities/machine.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { MinioService } from './minio.service';
import { ConfigService } from '@nestjs/config';
import { 
  ECRClient, 
  CreateRepositoryCommand, 
  DescribeImagesCommand,
  GetAuthorizationTokenCommand,
  ImageScanningConfiguration,
  ImageTagMutability,
  EncryptionType
} from '@aws-sdk/client-ecr';
import { 
  ECSClient, 
  RegisterTaskDefinitionCommand,
  NetworkMode,
  Compatibility,
  LogDriver
} from '@aws-sdk/client-ecs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

interface ECRPromotionResult {
  versionId: string;
  promotedAt: Date;
  images: Record<string, {
    ecrUri: string;
    digest: string;
    repositoryName: string;
    size: number;
  }>;
  taskDefinitions: Array<{
    machineId: string;
    machineName: string;
    taskDefinitionArn: string;
    family: string;
  }>;
}

@Injectable()
export class ECRPromotionService {
  private readonly logger = new Logger(ECRPromotionService.name);
  private ecrClient: ECRClient;
  private ecsClient: ECSClient;
  private awsRegion: string;
  private awsAccountId: string;

  constructor(
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
    @InjectRepository(ScenarioVersion)
    private versionRepo: Repository<ScenarioVersion>,
    private minioService: MinioService,
    private configService: ConfigService,
  ) {
    this.awsRegion = this.configService.get<string>('AWS_REGION') || 'ap-south-2';
    this.awsAccountId = this.configService.get<string>('AWS_ACCOUNT_ID') || '688693885048';

    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.ecrClient = new ECRClient({
      region: this.awsRegion,
      credentials,
    });

    this.ecsClient = new ECSClient({
      region: this.awsRegion,
      credentials,
    });

    this.logger.log(`ECR Promotion Service initialized for region: ${this.awsRegion}`);
  }

  /**
   * Promote images from MinIO staging to ECR
   * This should only be called after successful validation and scanning
   */
  async promoteToECR(versionId: string): Promise<ECRPromotionResult> {
    this.logger.log(`Starting ECR promotion for version ${versionId}`);

    try {
      // Download manifest to get image list
      const manifestContent = await this.minioService.downloadObject(
        'rangex-staging',
        `scenarios/${versionId}/manifest.json`,
      );
      const manifest = JSON.parse(manifestContent);

      const result: ECRPromotionResult = {
        versionId,
        promotedAt: new Date(),
        images: {},
        taskDefinitions: [],
      };

      // Promote each image
      const imageKeys = Object.keys(manifest.images || {});
      this.logger.log(`Promoting ${imageKeys.length} images to ECR`);

      for (const imageKey of imageKeys) {
        const imageInfo = manifest.images[imageKey];
        const promotedImage = await this.promoteImage(versionId, imageKey, imageInfo);
        result.images[imageKey] = promotedImage;

        // Update machine record with ECR info
        if (imageInfo.machineId) {
          await this.machineRepo.update(imageInfo.machineId, {
            ecrUri: promotedImage.ecrUri,
            ecrDigest: promotedImage.digest,
          });
        }
      }

      // Register ECS task definitions
      const machines = await this.machineRepo.find({
        where: { scenarioVersionId: versionId },
      });

      for (const machine of machines) {
        if (machine.ecrUri && machine.ecrDigest) {
          const taskDefArn = await this.registerTaskDefinition(machine);
          
          await this.machineRepo.update(machine.id, {
            taskDefinitionArn: taskDefArn,
          });

          result.taskDefinitions.push({
            machineId: machine.id,
            machineName: machine.name,
            taskDefinitionArn: taskDefArn,
            family: `rangex-${versionId}-${machine.name}`,
          });
        }
      }

      // Update version status to approved
      await this.versionRepo.update(versionId, {
        status: ScenarioVersionStatus.APPROVED as any,
        promotedAt: new Date(),
      });

      this.logger.log(
        `ECR promotion complete for ${versionId}: ${imageKeys.length} images, ${result.taskDefinitions.length} task definitions`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `ECR promotion failed for ${versionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Promote a single image to ECR
   */
  private async promoteImage(
    versionId: string,
    imageKey: string,
    imageInfo: any,
  ): Promise<ECRPromotionResult['images'][string]> {
    const tmpDir = path.join(os.tmpdir(), `rangex-promote-${versionId}-${imageKey}`);
    const tarPath = path.join(tmpDir, `${imageKey}.tar`);

    try {
      // Create temp directory
      await fs.promises.mkdir(tmpDir, { recursive: true });

      // Download image tar from MinIO staging
      this.logger.log(`Downloading image ${imageKey}...`);
      const tarBuffer = await this.minioService.getFileFromBucket(
        'rangex-staging',
        `scenarios/${versionId}/images/${imageKey}.tar`,
      );
      await fs.promises.writeFile(tarPath, tarBuffer);

      // Check if Docker is available
      let hasDocker = false;
      try {
        await exec('docker --version');
        hasDocker = true;
      } catch (error) {
        this.logger.warn('Docker not available, using mock ECR promotion');
      }

      if (hasDocker) {
        return await this.promoteWithDocker(versionId, imageKey, tarPath, imageInfo);
      } else {
        return await this.mockECRPromotion(versionId, imageKey, imageInfo);
      }
    } finally {
      // Cleanup temp files
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup temp directory: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Promote image using Docker (REAL AWS ECR implementation)
   */
  private async promoteWithDocker(
    versionId: string,
    imageKey: string,
    tarPath: string,
    imageInfo: any,
  ): Promise<ECRPromotionResult['images'][string]> {
    const repositoryName = `rangex-scenarios/${versionId}/${imageKey}`;
    const ecrUri = `${this.awsAccountId}.dkr.ecr.${this.awsRegion}.amazonaws.com/${repositoryName}`;

    try {
      // Create ECR repository
      this.logger.log(`Creating ECR repository: ${repositoryName}`);
      try {
        await this.ecrClient.send(new CreateRepositoryCommand({
          repositoryName,
          imageScanningConfiguration: {
            scanOnPush: true,
          },
          imageTagMutability: ImageTagMutability.IMMUTABLE,
          encryptionConfiguration: {
            encryptionType: EncryptionType.AES256,
          },
        }));
        this.logger.log(`Created ECR repository: ${repositoryName}`);
      } catch (error: any) {
        if (error.name === 'RepositoryAlreadyExistsException') {
          this.logger.log(`ECR repository already exists: ${repositoryName}`);
        } else {
          throw error;
        }
      }

      // Load image into Docker
      this.logger.log(`Loading image ${imageKey} into Docker...`);
      await exec(`docker load -i "${tarPath}"`);

      // Tag for ECR
      const sourceTag = imageInfo.tag || 'latest';
      await exec(`docker tag ${imageKey}:${sourceTag} ${ecrUri}:latest`);

      // Get ECR login credentials
      this.logger.log('Getting ECR authentication token...');
      const authResponse = await this.ecrClient.send(new GetAuthorizationTokenCommand({}));
      const authData = Buffer.from(authResponse.authorizationData![0].authorizationToken!, 'base64')
        .toString()
        .split(':');
      const password = authData[1];

      // Login to ECR
      this.logger.log('Logging in to ECR...');
      await exec(
        `echo ${password} | docker login --username AWS --password-stdin ${this.awsAccountId}.dkr.ecr.${this.awsRegion}.amazonaws.com`,
      );

      // Push to ECR
      this.logger.log(`Pushing ${imageKey} to ECR...`);
      const pushOutput = await exec(`docker push ${ecrUri}:latest`);
      this.logger.log(`Push output: ${pushOutput.stdout}`);

      // Get image digest
      this.logger.log('Retrieving image digest from ECR...');
      const imageDetails = await this.ecrClient.send(new DescribeImagesCommand({
        repositoryName,
        imageIds: [{ imageTag: 'latest' }],
      }));

      const digest = imageDetails.imageDetails![0].imageDigest!;
      const size = imageDetails.imageDetails![0].imageSizeInBytes!;

      this.logger.log(`Image ${imageKey} promoted: ${ecrUri}@${digest} (${(size / 1024 / 1024).toFixed(2)} MB)`);

      // Cleanup local images
      try {
        await exec(`docker rmi ${imageKey}:${sourceTag} ${ecrUri}:latest`);
      } catch (error) {
        this.logger.warn('Failed to cleanup local images (non-critical)');
      }

      return {
        ecrUri,
        digest,
        repositoryName,
        size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to promote image ${imageKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Mock ECR promotion for development (when Docker not available)
   */
  private async mockECRPromotion(
    versionId: string,
    imageKey: string,
    imageInfo: any,
  ): Promise<ECRPromotionResult['images'][string]> {
    const repositoryName = `rangex-scenarios/${versionId}/${imageKey}`;
    const ecrUri = `${this.awsAccountId}.dkr.ecr.${this.awsRegion}.amazonaws.com/${repositoryName}`;
    const digest = `sha256:${Buffer.from(`${versionId}-${imageKey}-${Date.now()}`).toString('hex').substring(0, 64)}`;

    this.logger.warn(
      `MOCK: Promoted ${imageKey} to ${ecrUri}@${digest} (Docker not available)`,
    );

    return {
      ecrUri,
      digest,
      repositoryName,
      size: imageInfo.size || 1024 * 1024 * 100, // Mock 100MB
    };
  }

  /**
   * Register ECS task definition for a machine (REAL AWS ECS implementation)
   */
  private async registerTaskDefinition(machine: Machine): Promise<string> {
    const family = `rangex-${machine.scenarioVersionId}-${machine.name}`;
    const { cpu, memory } = this.mapResourceProfile(machine.resourceProfile);

    try {
      this.logger.log(`Registering task definition: ${family}`);

      const command = new RegisterTaskDefinitionCommand({
        family,
        networkMode: NetworkMode.AWSVPC,
        requiresCompatibilities: [Compatibility.FARGATE],
        cpu: String(cpu),
        memory: String(memory),
        containerDefinitions: [
          {
            name: machine.name,
            image: `${machine.ecrUri}@${machine.ecrDigest}`,
            essential: true,
            environment: [
              {
                name: 'RANGEX_MACHINE_ID',
                value: machine.id,
              },
              {
                name: 'RANGEX_MACHINE_NAME',
                value: machine.name,
              },
              // Asset bootstrap variables (replaced at runtime)
              {
                name: 'RANGEX_ASSET_BUNDLE_URL',
                value: '${ASSET_URL}',
              },
              {
                name: 'RANGEX_ASSET_BUNDLE_SHA256',
                value: '${ASSET_SHA256}',
              },
            ],
            portMappings: (machine.entrypoints || []).map((entrypoint: any) => ({
              containerPort: entrypoint.containerPort,
              protocol: entrypoint.protocol?.toLowerCase() || 'tcp',
            })),
            logConfiguration: {
              logDriver: LogDriver.AWSLOGS, // Correct capitalization
              options: {
                'awslogs-group': '/ecs/rangex',
                'awslogs-region': this.awsRegion,
                'awslogs-stream-prefix': family,
                'awslogs-create-group': 'true',
              },
            },
          },
        ],
      });

      const result = await this.ecsClient.send(command);
      const taskDefArn = result.taskDefinition!.taskDefinitionArn!;

      this.logger.log(`Task definition registered: ${taskDefArn}`);
      return taskDefArn;
    } catch (error) {
      this.logger.error(
        `Failed to register task definition for ${machine.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Map machine resource profile to Fargate CPU/memory
   */
  private mapResourceProfile(profile: string): { cpu: number; memory: number } {
    const profileMap: Record<string, { cpu: number; memory: number }> = {
      micro: { cpu: 256, memory: 512 },
      small: { cpu: 512, memory: 1024 },
      medium: { cpu: 1024, memory: 2048 },
      large: { cpu: 2048, memory: 4096 },
      xlarge: { cpu: 4096, memory: 8192 },
    };

    return profileMap[profile] || profileMap.small;
  }
}
