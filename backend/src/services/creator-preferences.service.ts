import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorPreferences } from '../entities/creator-preferences.entity';
import { ImageVariantService } from './image-variant.service';
import * as crypto from 'crypto';

@Injectable()
export class CreatorPreferencesService {
  private readonly logger = new Logger(CreatorPreferencesService.name);
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    @InjectRepository(CreatorPreferences)
    private preferencesRepo: Repository<CreatorPreferences>,
    private imageVariantService: ImageVariantService,
  ) {
    // Use environment variable for encryption key
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32-chars';
    
    if (this.encryptionKey === 'default-key-change-in-production-32-chars') {
      this.logger.warn('⚠️ Using default encryption key. Set ENCRYPTION_KEY in production!');
    }
  }

  /**
   * Get or create preferences for a user
   */
  async getPreferences(userId: string): Promise<CreatorPreferences> {
    let preferences = await this.preferencesRepo.findOne({
      where: { userId },
      relations: ['preferredAttackerVariant', 'preferredVictimVariant', 'preferredServiceVariant'],
    });

    if (!preferences) {
      // Create default preferences with recommended variants
      const attackerVariant = await this.imageVariantService.getRecommendedVariant('attacker', true);
      const internalVariant = await this.imageVariantService.getRecommendedVariant('internal', true);
      const serviceVariant = await this.imageVariantService.getRecommendedVariant('service', true);

      preferences = this.preferencesRepo.create({
        userId,
        preferredAttackerVariantId: attackerVariant?.id,
        preferredVictimVariantId: internalVariant?.id,
        preferredServiceVariantId: serviceVariant?.id,
        defaultResourceProfile: 'small',
        notifyOnApproval: true,
        notifyOnRejection: true,
        notifyOnCostAlert: false,
      });

      await this.preferencesRepo.save(preferences);
      
      // Reload with relations
      preferences = await this.preferencesRepo.findOne({
        where: { userId },
        relations: ['preferredAttackerVariant', 'preferredVictimVariant', 'preferredServiceVariant'],
      });
    }

    return preferences!;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<CreatorPreferences>
  ): Promise<CreatorPreferences> {
    const preferences = await this.getPreferences(userId);

    // Validate variant IDs if provided
    if (updates.preferredAttackerVariantId) {
      await this.imageVariantService.getVariantById(updates.preferredAttackerVariantId);
    }
    if (updates.preferredVictimVariantId) {
      await this.imageVariantService.getVariantById(updates.preferredVictimVariantId);
    }
    if (updates.preferredServiceVariantId) {
      await this.imageVariantService.getVariantById(updates.preferredServiceVariantId);
    }

    // Don't allow direct password updates (use separate method)
    delete (updates as any).dockerPasswordEncrypted;

    Object.assign(preferences, updates);
    await this.preferencesRepo.save(preferences);

    return this.getPreferences(userId);
  }

  /**
   * Save Docker credentials (encrypted)
   */
  async saveDockerCredentials(
    userId: string,
    registryUrl: string,
    username: string,
    password: string
  ): Promise<void> {
    const preferences = await this.getPreferences(userId);

    preferences.dockerRegistryUrl = registryUrl;
    preferences.dockerUsername = username;
    preferences.dockerPasswordEncrypted = this.encryptPassword(password);

    await this.preferencesRepo.save(preferences);
    
    this.logger.log(`Docker credentials saved for user ${userId}, registry: ${registryUrl}`);
  }

  /**
   * Get decrypted Docker credentials
   */
  async getDockerCredentials(userId: string): Promise<{
    registryUrl?: string;
    username?: string;
    password?: string;
  } | null> {
    const preferences = await this.getPreferences(userId);

    if (!preferences.dockerRegistryUrl || !preferences.dockerUsername || !preferences.dockerPasswordEncrypted) {
      return null;
    }

    return {
      registryUrl: preferences.dockerRegistryUrl,
      username: preferences.dockerUsername,
      password: this.decryptPassword(preferences.dockerPasswordEncrypted),
    };
  }

  /**
   * Delete Docker credentials
   */
  async deleteDockerCredentials(userId: string): Promise<void> {
    const preferences = await this.getPreferences(userId);

    preferences.dockerRegistryUrl = undefined;
    preferences.dockerUsername = undefined;
    preferences.dockerPasswordEncrypted = undefined;

    await this.preferencesRepo.save(preferences);
    
    this.logger.log(`Docker credentials deleted for user ${userId}`);
  }

  /**
   * Encrypt password using AES-256
   */
  private encryptPassword(password: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt password using AES-256
   */
  private decryptPassword(encrypted: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get preferred variant for a role
   */
  async getPreferredVariantForRole(userId: string, role: 'attacker' | 'victim' | 'service'): Promise<string | undefined> {
    const preferences = await this.getPreferences(userId);

    switch (role) {
      case 'attacker':
        return preferences.preferredAttackerVariantId;
      case 'victim':
        return preferences.preferredVictimVariantId;
      case 'service':
        return preferences.preferredServiceVariantId;
      default:
        return undefined;
    }
  }

  /**
   * Check if cost alert should be triggered
   */
  async shouldTriggerCostAlert(userId: string, estimatedCostPerHour: number): Promise<boolean> {
    const preferences = await this.getPreferences(userId);

    if (!preferences.notifyOnCostAlert || !preferences.costAlertThreshold) {
      return false;
    }

    return estimatedCostPerHour > Number(preferences.costAlertThreshold);
  }
}
