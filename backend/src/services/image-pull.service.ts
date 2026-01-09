import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DockerImage } from '../entities/docker-image.entity';
import { DockerCredential } from '../entities/docker-credential.entity';
import { MinioService } from './minio.service';
import axios from 'axios';
import * as crypto from 'crypto';
import * as stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);

interface ImageManifest {
  schemaVersion: number;
  mediaType: string;
  config: {
    mediaType: string;
    size: number;
    digest: string;
  };
  layers: Array<{
    mediaType: string;
    size: number;
    digest: string;
  }>;
}

@Injectable()
export class ImagePullService {
  private readonly logger = new Logger(ImagePullService.name);
  private readonly DOCKER_HUB_AUTH = 'https://auth.docker.io';
  private readonly DOCKER_HUB_REGISTRY = 'https://registry-1.docker.io';
  private readonly ENCRYPTION_KEY = process.env.DOCKER_CRED_ENCRYPTION_KEY || 'change-this-to-32-char-secret!!';

  constructor(
    @InjectRepository(DockerImage)
    private readonly imageRepo: Repository<DockerImage>,
    @InjectRepository(DockerCredential)
    private readonly credentialRepo: Repository<DockerCredential>,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Pull Docker image and store in MinIO
   */
  async pullAndStoreImage(imageId: string): Promise<{ minioPath: string; sizeMb: number }> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image) {
      throw new BadRequestException('Image not found');
    }

    // Check if already stored in MinIO
    if (image.minioPath) {
      this.logger.log(`Image ${image.name}:${image.tag} already stored in MinIO`);
      return {
        minioPath: image.minioPath,
        sizeMb: image.imageSizeMb || 0,
      };
    }

    try {
      this.logger.log(`Pulling image ${image.name}:${image.tag} from ${image.registryUrl}`);

      // Normalize image name for Docker Hub (official images need library/ prefix)
      let imageName = image.name;
      if (!imageName.includes('/') && image.registryUrl === 'docker.io') {
        imageName = `library/${imageName}`;
      }

      // Get authentication token (with credentials for private images)
      const token = await this.getAuthToken(imageName, image);

      // Get manifest
      const manifest = await this.getManifest(imageName, image.tag, token);

      // Download and store config
      const configPath = await this.downloadAndStoreBlob(
        imageName,
        manifest.config.digest,
        token,
        'config.json',
        image,
      );

      // Download and store layers
      let totalSize = 0;
      const layerPaths: string[] = [];

      for (const layer of manifest.layers) {
        // Sanitize digest for MinIO path (replace sha256: with sha256-)
        const sanitizedDigest = layer.digest.replace(':', '-');
        const layerPath = await this.downloadAndStoreBlob(
          imageName,
          layer.digest,
          token,
          `layers/${sanitizedDigest}.tar.gz`,
          image,
        );
        layerPaths.push(layerPath);
        totalSize += layer.size;
      }

      // Store manifest
      const manifestPath = await this.storeManifest(manifest, image);

      // Update image record
      const minioPath = this.getImageBasePath(image);
      const sizeMb = Math.round(totalSize / (1024 * 1024));

      await this.imageRepo.update(imageId, {
        minioPath,
        imageSizeMb: sizeMb,
        pullCount: (image.pullCount || 0) + 1,
        lastPulledAt: new Date(),
      });

      this.logger.log(`Image stored successfully: ${minioPath} (${sizeMb} MB)`);

      return { minioPath, sizeMb };
    } catch (error: any) {
      this.logger.error(`Failed to pull and store image: ${error.message}`);
      throw new BadRequestException(`Failed to pull image: ${error.message}`);
    }
  }

  /**
   * Get Docker Hub authentication token
   */
  private async getAuthToken(imageName: string, image: DockerImage): Promise<string> {
    const scope = `repository:${imageName}:pull`;
    const url = `${this.DOCKER_HUB_AUTH}/token?service=registry.docker.io&scope=${scope}`;

    try {
      // For private images, use stored credentials
      if (!image.isPublic && image.createdBy) {
        const credential = await this.credentialRepo.findOne({
          where: { userId: image.createdBy, registryUrl: 'docker.io' }
        });

        if (credential) {
          const password = this.decryptPassword(credential.passwordEncrypted);
          const response = await axios.get(url, {
            auth: {
              username: credential.username,
              password: password
            }
          });
          this.logger.log('Authenticated with private credentials');
          return response.data.token;
        } else {
          this.logger.warn('Private image but no credentials found, attempting anonymous pull');
        }
      }

      // Public image or no credentials - use anonymous token
      const response = await axios.get(url);
      return response.data.token;
    } catch (error: any) {
      throw new BadRequestException('Failed to authenticate with Docker Hub');
    }
  }

  /**
   * Decrypt password from storage
   */
  private decryptPassword(encryptedPassword: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get image manifest from registry
   */
  private async getManifest(imageName: string, tag: string, token: string): Promise<ImageManifest> {
    const url = `${this.DOCKER_HUB_REGISTRY}/v2/${imageName}/manifests/${tag}`;

    try {
      this.logger.log(`Fetching manifest from: ${url}`);
      
      // Request manifest - might get list or direct manifest
      let response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
        },
      });
      
      this.logger.log(`Manifest received - mediaType: ${response.data.mediaType}`);
      
      // Check if it's a manifest list/index (OCI or Docker)
      const isManifestList = response.data.mediaType === 'application/vnd.docker.distribution.manifest.list.v2+json' ||
                             response.data.mediaType === 'application/vnd.oci.image.index.v1+json';
      
      if (isManifestList && response.data.manifests) {
        this.logger.log('Received manifest list, selecting linux/amd64 platform');
        
        // Find the linux/amd64 manifest (skip attestation manifests)
        const platformManifest = response.data.manifests.find((m: any) => 
          m.platform?.architecture === 'amd64' && 
          m.platform?.os === 'linux' &&
          !m.annotations?.['vnd.docker.reference.type']?.includes('attestation')
        );
        
        if (!platformManifest) {
          throw new BadRequestException('No linux/amd64 manifest found');
        }

        this.logger.log(`Fetching platform-specific manifest: ${platformManifest.digest}`);
        
        // Fetch the platform-specific manifest using its digest
        const digestUrl = `${this.DOCKER_HUB_REGISTRY}/v2/${imageName}/manifests/${platformManifest.digest}`;
        response = await axios.get(digestUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
          },
        });
        
        this.logger.log(`Platform manifest received - mediaType: ${response.data.mediaType}`);
      }
      
      if (!response.data.config || !response.data.layers) {
        this.logger.error(`Invalid manifest structure: ${JSON.stringify(response.data).substring(0, 500)}`);
        throw new BadRequestException('Invalid manifest format: missing config or layers');
      }
      
      this.logger.log(`Valid manifest - config: ${response.data.config.size} bytes, layers: ${response.data.layers.length}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get manifest: ${error.response?.status} - ${JSON.stringify(error.response?.data || error.message).substring(0, 200)}`);
      if (error.response?.status === 404) {
        throw new BadRequestException('Image not found');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to get image manifest');
    }
  }

  /**
   * Download blob (layer or config) and store in MinIO
   */
  private async downloadAndStoreBlob(
    imageName: string,
    digest: string,
    token: string,
    relativePath: string,
    image: DockerImage,
  ): Promise<string> {
    const url = `${this.DOCKER_HUB_REGISTRY}/v2/${imageName}/blobs/${digest}`;

    try {
      this.logger.log(`Downloading blob: ${digest.substring(0, 20)}...`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        responseType: 'stream',
      });

      const minioPath = `${this.getImageBasePath(image)}/${relativePath}`;
      
      // Stream directly to MinIO
      await this.minioService.uploadStream(
        response.data,
        minioPath,
        response.headers['content-length'] ? parseInt(response.headers['content-length']) : undefined,
      );

      this.logger.log(`Stored blob to MinIO: ${minioPath}`);
      return minioPath;
    } catch (error: any) {
      this.logger.error(`Failed to download blob ${digest}: ${error.message}`);
      throw new BadRequestException('Failed to download image layer');
    }
  }

  /**
   * Store manifest in MinIO
   */
  private async storeManifest(manifest: ImageManifest, image: DockerImage): Promise<string> {
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestJson, 'utf-8');
    const minioPath = `${this.getImageBasePath(image)}/manifest.json`;

    await this.minioService.uploadFile(
      manifestBuffer,
      minioPath,
    );

    return minioPath;
  }

  /**
   * Get base path for image in MinIO
   * Organizes images into: docker-images/public/, docker-images/private/, docker-images/library/
   */
  private getImageBasePath(image: DockerImage): string {
    const registryPath = image.registryUrl.replace(/[^a-z0-9-]/gi, '_');
    const imagePath = image.name.replace(/[^a-z0-9-]/gi, '_');
    
    // Organize by visibility
    let visibility: string;
    if (image.registryUrl === 'docker.io' && image.name.startsWith('library/')) {
      // Official Docker library images
      visibility = 'library';
    } else if (image.isPublic) {
      visibility = 'public';
    } else {
      visibility = 'private';
    }
    
    return `docker-images/${visibility}/${registryPath}/${imagePath}/${image.tag}`;
  }

  /**
   * Get image from MinIO as tar stream
   */
  async getImageFromMinIO(imageId: string): Promise<any> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image || !image.minioPath) {
      throw new BadRequestException('Image not found in MinIO');
    }

    try {
      // Create tar archive from MinIO files
      // This would require packaging manifest + config + layers into Docker tar format
      // For now, return manifest as stream
      const manifestPath = `${image.minioPath}/manifest.json`;
      return await this.minioService.getFileStream(manifestPath);
    } catch (error: any) {
      throw new BadRequestException('Failed to retrieve image from MinIO');
    }
  }

  /**
   * Check if image exists in MinIO
   */
  async checkImageInMinIO(imageId: string): Promise<boolean> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image || !image.minioPath) {
      return false;
    }

    try {
      const manifestPath = `${image.minioPath}/manifest.json`;
      await this.minioService.getFileStream(manifestPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete image from MinIO
   */
  async deleteImageFromMinIO(imageId: string): Promise<void> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image || !image.minioPath) {
      return;
    }

    try {
      // Delete all files in the image directory
      // MinIO doesn't have recursive delete, so we need to list and delete
      const basePath = image.minioPath;
      
      // For now, just clear the minioPath in the database
      // TODO: Implement recursive delete from MinIO
      await this.imageRepo.update(imageId, {
        minioPath: undefined,
        imageSizeMb: undefined,
      });

      this.logger.log(`Cleared MinIO path for image ${image.name}:${image.tag}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete image from MinIO: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    cachedImages: number;
    totalSizeMb: number;
  }> {
    const images = await this.imageRepo.find();
    const cachedImages = images.filter(img => img.minioPath);
    const totalSizeMb = cachedImages.reduce((sum, img) => sum + (img.imageSizeMb || 0), 0);

    return {
      totalImages: images.length,
      cachedImages: cachedImages.length,
      totalSizeMb,
    };
  }
}
