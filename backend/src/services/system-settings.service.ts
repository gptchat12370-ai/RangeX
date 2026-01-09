import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from '../entities/system-settings.entity';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);
  private cachedSettings: SystemSettings | null = null;

  constructor(
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>,
  ) {}

  async onModuleInit() {
    // Initialize default settings if none exist
    const existing = await this.settingsRepo.findOne({ where: {} });
    if (!existing) {
      this.logger.log('Creating default system settings');
      const defaults = this.settingsRepo.create({
        maintenanceMode: false,
        maxConcurrentUsers: 0,
        maxTotalUsers: 0,
        allowNewRegistrations: true,
        maxSessionsPerUser: 1,
        maxSessionsPerHour: 3,
        maxSessionsPerDay: 10,
        idleTimeoutMinutes: 30,
        maxSessionDurationMinutes: 180,
        maxTotalContainers: 0,
        maxAccessibleScenarios: 1,
        allowAllScenarios: false, // Changed to false for cost control
        budgetHardCapUsd: 0,
        budgetAlertPercentage: 80,
        autoMaintenanceOnBudgetCap: true,
        maxStoragePerUserBytes: 0,
        maxTotalStorageBytes: 0,
        storageDriver: 'minio',
        minioBucket: 'assets',
        minioUseSSL: false,
        useLocalDocker: false,
        enablePrometheusMetrics: true,
        enableRequestLogging: true,
        logRetentionDays: 7,
        sendErrorNotifications: false,
      });
      await this.settingsRepo.save(defaults);
      this.cachedSettings = defaults;
    } else {
      this.cachedSettings = existing;
    }
  }

  /**
   * Get current system settings (cached)
   */
  async getSettings(): Promise<SystemSettings> {
    if (!this.cachedSettings) {
      this.cachedSettings = await this.settingsRepo.findOne({ where: {} }) || await this.initializeDefaults();
    }
    return this.cachedSettings;
  }

  /**
   * Update system settings
   */
  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSettings();
    
    // Merge updates
    Object.assign(current, updates);
    
    const saved = await this.settingsRepo.save(current);
    this.cachedSettings = saved;
    
    this.logger.log(`System settings updated: ${Object.keys(updates).join(', ')}`);
    
    return saved;
  }

  /**
   * Enable/disable maintenance mode
   */
  async setMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
    await this.updateSettings({
      maintenanceMode: enabled,
      maintenanceMessage: message,
    });
    this.logger.warn(`Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}${message ? `: ${message}` : ''}`);
  }

  /**
   * Check if platform can accept new users
   */
  async canAcceptNewUsers(): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getSettings();
    
    if (settings.maintenanceMode) {
      return { allowed: false, reason: settings.maintenanceMessage || 'System is under maintenance' };
    }
    
    if (!settings.allowNewRegistrations) {
      return { allowed: false, reason: 'New registrations are currently disabled' };
    }
    
    if (settings.maxTotalUsers > 0) {
      // Would need to count users here
      // const userCount = await this.userRepo.count();
      // if (userCount >= settings.maxTotalUsers) {
      //   return { allowed: false, reason: 'Maximum user capacity reached' };
      // }
    }
    
    return { allowed: true };
  }

  /**
   * Check if user can start a new session
   */
  async canStartSession(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getSettings();
    
    if (settings.maintenanceMode) {
      return { allowed: false, reason: 'System is under maintenance' };
    }
    
    if (settings.maxTotalContainers > 0) {
      // Would need to count running sessions
      // const runningCount = await this.sessionRepo.count({ where: { status: 'running' } });
      // if (runningCount >= settings.maxTotalContainers) {
      //   return { allowed: false, reason: 'Maximum container capacity reached' };
      // }
    }
    
    return { allowed: true };
  }

  /**
   * Get session limits for a user
   */
  async getSessionLimits() {
    const settings = await this.getSettings();
    return {
      maxSessionsPerUser: settings.maxSessionsPerUser,
      maxSessionsPerHour: settings.maxSessionsPerHour,
      maxSessionsPerDay: settings.maxSessionsPerDay,
      idleTimeoutMinutes: settings.idleTimeoutMinutes,
      maxSessionDurationMinutes: settings.maxSessionDurationMinutes,
    };
  }

  /**
   * Get scenario access settings
   */
  async getScenarioAccessSettings() {
    const settings = await this.getSettings();
    return {
      maxAccessibleScenarios: settings.maxAccessibleScenarios,
      allowAllScenarios: settings.allowAllScenarios,
    };
  }

  private async initializeDefaults(): Promise<SystemSettings> {
    const defaults = this.settingsRepo.create({
      maintenanceMode: false,
      maxConcurrentUsers: 0,
      maxTotalUsers: 0,
      allowNewRegistrations: true,
      maxSessionsPerUser: 1,
      maxSessionsPerHour: 3,
      maxSessionsPerDay: 10,
      idleTimeoutMinutes: 30,
      maxSessionDurationMinutes: 180,
      maxTotalContainers: 0,
      maxAccessibleScenarios: 1,
      allowAllScenarios: false,
      budgetHardCapUsd: 0,
      budgetAlertPercentage: 80,
      autoMaintenanceOnBudgetCap: true,
      storageDriver: 'minio',
      minioBucket: 'assets',
      minioUseSSL: false,
      useLocalDocker: false,
      enablePrometheusMetrics: true,
      enableRequestLogging: true,
      logRetentionDays: 7,
      sendErrorNotifications: false,
    });
    return this.settingsRepo.save(defaults);
  }
}
