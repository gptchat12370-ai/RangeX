import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentService } from './environment.service';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { SystemSetting } from '../entities/system-setting.entity';
import { CostService } from './cost.service';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly environmentService: EnvironmentService,
    private readonly costService: CostService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async terminateExpiredSessions() {
    const now = new Date();
    const expired = await this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.machines', 'machines')
      .where('session.status = :status', { status: 'running' })
      .andWhere('session.expiresAt <= :now', { now })
      .getMany();
    for (const session of expired) {
      await this.environmentService.terminateEnvironment(session.id, 'TTL expired');
    }
    if (expired.length > 0) {
      this.logger.log(`Terminated ${expired.length} expired sessions`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async enforceBudgetCap() {
    const hardLimit = Number(await this.getSetting('hard_usage_limit_rm', '300'));
    const current = await this.costService.getCurrentMonthCostRm();
    if (current >= hardLimit) {
      await this.settingsRepo.save({ key: 'maintenance_mode', value: '1' });
      await this.environmentService.terminateAllActiveEnvironments('Budget hard cap triggered');
      await this.auditRepo.save(
        this.auditRepo.create({
          actionType: 'BUDGET_HARD_CAP_TRIGGERED',
          details: { current },
        }),
      );
      this.logger.warn(`Budget hard cap reached; maintenance mode enabled`);
    }
  }

  private async getSetting(key: string, fallback: string): Promise<string> {
    const record = await this.settingsRepo.findOne({ where: { key } });
    return record?.value ?? fallback;
  }
}
