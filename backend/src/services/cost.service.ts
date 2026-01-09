import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { UsageDaily } from '../entities/usage-daily.entity';
import { ResourceProfile } from '../entities/machine.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';

type ProfileCost = { vcpu: number; memoryGb: number };

const PROFILE_MATRIX: Record<ResourceProfile, ProfileCost> = {
  micro: { vcpu: 0.25, memoryGb: 0.5 },
  small: { vcpu: 0.5, memoryGb: 1 },
  medium: { vcpu: 1, memoryGb: 2 },
  large: { vcpu: 2, memoryGb: 4 },
};

@Injectable()
export class CostService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
    @InjectRepository(UsageDaily)
    private readonly usageRepo: Repository<UsageDaily>,
  ) {}

  async calculateTaskHourlyCostRm(resourceProfile: ResourceProfile): Promise<number> {
    const pricing = PROFILE_MATRIX[resourceProfile];
    const vcpuPrice = await this.getNumericSetting('fargate_vcpu_price_per_hour_rm', 0.25);
    const memPrice = await this.getNumericSetting('fargate_memory_price_per_gb_hour_rm', 0.03);
    return pricing.vcpu * vcpuPrice + pricing.memoryGb * memPrice;
  }

  async estimateSessionMaxCostRm(
    resourceProfile: ResourceProfile,
    ttlMinutes: number,
    machineCount: number,
  ): Promise<number> {
    const hourly = await this.calculateTaskHourlyCostRm(resourceProfile);
    const hours = Math.ceil(ttlMinutes / 60);
    return hourly * hours * machineCount;
  }

  async getCurrentMonthCostRm(): Promise<number> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const records = await this.usageRepo
      .createQueryBuilder('u')
      .where('u.date >= :start', { start: monthStart.toISOString().substring(0, 10) })
      .getMany();
    return records.reduce((sum, row) => sum + Number(row.totalEstimatedCostRm || 0), 0);
  }

  async recordSessionUsage(session: EnvironmentSession): Promise<void> {
    if (!session.startedAt || !session.stoppedAt) return;
    const durationHours =
      (session.stoppedAt.getTime() - session.startedAt.getTime()) / (1000 * 60 * 60);
    const profile = session.envProfile;
    const dateKey = session.stoppedAt.toISOString().substring(0, 10);
    const hourlyCost = await this.calculateTaskHourlyCostRm(profile);
    const machineCount = (session.machines && session.machines.length) || 1;
    const deltaCost = durationHours * hourlyCost * machineCount;

    let record = await this.usageRepo.findOne({ where: { date: dateKey } });
    if (!record) {
      record = this.usageRepo.create({
        date: dateKey,
        envHoursMicro: 0,
        envHoursSmall: 0,
        envHoursMedium: 0,
        envHoursLarge: 0,
        totalEstimatedCostRm: 0,
      });
    }

    if (profile === 'micro') record.envHoursMicro = Number(record.envHoursMicro || 0) + (durationHours * machineCount);
    if (profile === 'small') record.envHoursSmall = Number(record.envHoursSmall || 0) + (durationHours * machineCount);
    if (profile === 'medium') record.envHoursMedium = Number(record.envHoursMedium || 0) + (durationHours * machineCount);
    if (profile === 'large') record.envHoursLarge = Number(record.envHoursLarge || 0) + (durationHours * machineCount);
    record.totalEstimatedCostRm = Number(record.totalEstimatedCostRm || 0) + deltaCost;

    await this.usageRepo.save(record);
  }

  private async getNumericSetting(key: string, defaultValue: number): Promise<number> {
    const record = await this.settingsRepo.findOne({ where: { key } });
    if (!record) return defaultValue;
    const parsed = Number(record.value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  async getDailyUsage() {
    const records = await this.usageRepo.find({ order: { date: 'DESC' }, take: 30 });
    return records.map(r => ({
      date: r.date,
      totalEstimatedCostRm: r.totalEstimatedCostRm,
    }));
  }
}
