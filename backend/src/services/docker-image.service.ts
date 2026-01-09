import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DockerImage } from '../entities/docker-image.entity';
import { DockerCredential } from '../entities/docker-credential.entity';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class DockerImageService {
  private readonly DOCKER_HUB_REGISTRY = 'https://registry-1.docker.io';
  private readonly DOCKER_HUB_AUTH = 'https://auth.docker.io';
  private readonly ENCRYPTION_KEY = process.env.DOCKER_CRED_ENCRYPTION_KEY || 'change-this-to-32-char-secret!!';

  constructor(
    @InjectRepository(DockerImage)
    private readonly imageRepo: Repository<DockerImage>,
    @InjectRepository(DockerCredential)
    private readonly credentialRepo: Repository<DockerCredential>,
  ) {}

  /**
   * Verify if a public Docker Hub image exists
   */
  async verifyPublicImage(imageName: string, tag: string = 'latest'): Promise<boolean> {
    try {
      // Get authentication token from Docker Hub
      const authResponse = await axios.get(
        `${this.DOCKER_HUB_AUTH}/token?service=registry.docker.io&scope=repository:${imageName}:pull`
      );
      const token = authResponse.data.token;

      // Check if manifest exists
      const manifestResponse = await axios.head(
        `${this.DOCKER_HUB_REGISTRY}/v2/${imageName}/manifests/${tag}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
          },
        }
      );

      return manifestResponse.status === 200;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw new BadRequestException(`Failed to verify image: ${error.message}`);
    }
  }

  /**
   * Verify private Docker registry image with credentials
   */
  async verifyPrivateImage(
    registryUrl: string,
    imageName: string,
    tag: string,
    username: string,
    password: string
  ): Promise<boolean> {
    try {
      // For Docker Hub private images
      if (registryUrl.includes('docker.io') || registryUrl.includes('docker.hub')) {
        const authResponse = await axios.get(
          `${this.DOCKER_HUB_AUTH}/token?service=registry.docker.io&scope=repository:${imageName}:pull`,
          {
            auth: { username, password }
          }
        );
        const token = authResponse.data.token;

        const manifestResponse = await axios.head(
          `${this.DOCKER_HUB_REGISTRY}/v2/${imageName}/manifests/${tag}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
            },
          }
        );

        return manifestResponse.status === 200;
      }

      // For other private registries (AWS ECR, GCR, etc.)
      const normalizedRegistry = registryUrl.replace(/^https?:\/\//, '');
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

      const manifestResponse = await axios.head(
        `https://${normalizedRegistry}/v2/${imageName}/manifests/${tag}`,
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
          },
        }
      );

      return manifestResponse.status === 200;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new BadRequestException('Invalid credentials');
      }
      if (error.response?.status === 404) {
        return false;
      }
      throw new BadRequestException(`Failed to verify private image: ${error.message}`);
    }
  }

  /**
   * Encrypt password for storage
   */
  private encryptPassword(password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
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
   * Save Docker credential
   */
  async saveCredential(userId: string, registryUrl: string, username: string, password: string) {
    const encrypted = this.encryptPassword(password);
    
    const existing = await this.credentialRepo.findOne({ where: { userId, registryUrl } });
    if (existing) {
      existing.username = username;
      existing.passwordEncrypted = encrypted;
      return this.credentialRepo.save(existing);
    }

    const credential = this.credentialRepo.create({
      userId,
      registryUrl,
      username,
      passwordEncrypted: encrypted,
    });

    return this.credentialRepo.save(credential);
  }

  /**
   * Get user's credentials for a registry
   */
  async getCredential(userId: string, registryUrl: string) {
    const credential = await this.credentialRepo.findOne({ where: { userId, registryUrl } });
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return {
      id: credential.id,
      registryUrl: credential.registryUrl,
      username: credential.username,
      password: this.decryptPassword(credential.passwordEncrypted),
    };
  }

  /**
   * Create or update a Docker image record
   */
  async createImage(data: {
    name: string;
    tag: string;
    registryUrl?: string;
    description?: string;
    category?: string;
    isPublic: boolean;
    isReadyImage?: boolean;
    createdBy: string;
  }) {
    const image = this.imageRepo.create({
      ...data,
      registryUrl: data.registryUrl || 'docker.io',
      isVerified: false,
    });

    return this.imageRepo.save(image);
  }

  /**
   * Find image by name and tag
   */
  async findByNameAndTag(name: string, tag: string) {
    return this.imageRepo.findOne({ where: { name, tag } });
  }

  /**
   * List ready images (admin-uploaded)
   */
  async listReadyImages() {
    return this.imageRepo.find({
      where: { isReadyImage: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * List all images (admin)
   */
  async listAllImages() {
    return this.imageRepo.find({
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete image
   */
  async deleteImage(imageId: string) {
    await this.imageRepo.delete(imageId);
    return { deleted: true };
  }

  /**
   * Update image
   */
  async updateImage(imageId: string, updates: Partial<DockerImage>) {
    await this.imageRepo.update(imageId, updates);
    return this.imageRepo.findOne({ where: { id: imageId } });
  }
}
