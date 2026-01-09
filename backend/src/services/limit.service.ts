import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { ScenarioLimit } from '../entities/scenario-limit.entity';
import { LimitExceededError } from '../common/errors/limit-exceeded.error';
import { ScenarioVersion } from '../entities/scenario-version.entity';

const ACTIVE_STATUSES = ['starting', 'running'];

@Injectable()
export class LimitService {
  private readonly logger = new Logger(LimitService.name);
  constructor(
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
    @InjectRepository(ScenarioLimit)
    private readonly scenarioLimitRepo: Repository<ScenarioLimit>,
    @InjectRepository(ScenarioVersion)
    private readonly scenarioVersionRepo: Repository<ScenarioVersion>,
  ) {}

  async checkUserLimits(userId: string): Promise<void> {
    const maxPerUser = await this.getNumericSetting('max_envs_per_user', 1);
    const activeCount = await this.sessionRepo.count({
      where: { userId, status: In(ACTIVE_STATUSES) as any },
    });
    if (activeCount >= maxPerUser) {
      this.logger.warn(`User ${userId} exceeds max_envs_per_user: ${activeCount}/${maxPerUser}`);
      throw new LimitExceededError({
        limitKey: 'max_envs_per_user',
        allowed: maxPerUser,
        current: activeCount,
        scope: 'user',
      });
    }
  }

  async checkGlobalLimits(): Promise<void> {
    const maxGlobal = await this.getNumericSetting('max_concurrent_envs_global', 5);
    const activeCount = await this.sessionRepo.count({
      where: { status: In(ACTIVE_STATUSES) as any },
    });
    if (activeCount >= maxGlobal) {
      this.logger.warn(`Global env limit hit: ${activeCount}/${maxGlobal}`);
      throw new LimitExceededError({
        limitKey: 'max_concurrent_envs_global',
        allowed: maxGlobal,
        current: activeCount,
        scope: 'global',
      });
    }
    await this.checkActiveUsersLimit();
  }

  async checkActiveUsersLimit(): Promise<void> {
    const allowedActiveUsers = await this.getNumericSetting('max_active_users', 5);
    const qb = this.sessionRepo
      .createQueryBuilder('session')
      .select('COUNT(DISTINCT session.userId)', 'count')
      .where('session.status IN (:...statuses)', { statuses: ACTIVE_STATUSES });
    const raw = await qb.getRawOne<{ count: string }>();
    const activeUsers = Number(raw?.count || 0);
    if (activeUsers >= allowedActiveUsers) {
      this.logger.warn(`Active users limit hit: ${activeUsers}/${allowedActiveUsers}`);
      throw new LimitExceededError({
        limitKey: 'max_active_users',
        allowed: allowedActiveUsers,
        current: activeUsers,
        scope: 'global',
      });
    }
  }

  async checkScenarioLimits(scenarioVersionId: string): Promise<void> {
    const version = await this.scenarioVersionRepo.findOne({
      where: { id: scenarioVersionId },
      relations: ['scenario'],
    });
    if (!version) return;
    const limit = await this.scenarioLimitRepo.findOne({ where: { scenarioId: version.scenarioId } });
    if (!limit || limit.maxConcurrentPlayers <= 0) return;

    const active = await this.sessionRepo.count({
      where: { scenarioVersionId: version.id, status: In(ACTIVE_STATUSES) as any },
    });
    if (active >= limit.maxConcurrentPlayers) {
      this.logger.warn(`Scenario limit hit for ${scenarioVersionId}: ${active}/${limit.maxConcurrentPlayers}`);
      throw new LimitExceededError({
        limitKey: 'scenario_max_concurrent',
        allowed: limit.maxConcurrentPlayers,
        current: active,
        scope: 'scenario',
      });
    }
  }

  async getNumericSetting(key: string, defaultValue: number): Promise<number> {
    const record = await this.settingsRepo.findOne({ where: { key } });
    if (!record) return defaultValue;
    const value = Number(record.value);
    return Number.isFinite(value) ? value : defaultValue;
  }
}
