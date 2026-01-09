import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../entities/badge.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { User } from '../entities/user.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  async awardBadges() {
    const users = await this.userRepo.find();
    const badges = await this.badgeRepo.find();

    for (const user of users) {
      for (const badge of badges) {
        const hasBadge = await this.userBadgeRepo.findOne({ where: { userId: user.id, badgeId: badge.id } });
        if (hasBadge) {
          continue;
        }

        const [criteriaType, criteriaValue] = badge.criteria.split('_');
        const value = parseInt(criteriaValue, 10);

        if (criteriaType === 'challenges' && (await this.getCompletedChallenges(user.id)) >= value) {
          await this.awardBadge(user.id, badge.id);
        }
      }
    }
  }

  private async getCompletedChallenges(userId: string): Promise<number> {
    return this.sessionRepo.count({ where: { userId, status: 'terminated' } });
  }

  private async awardBadge(userId: string, badgeId: string) {
    const userBadge = this.userBadgeRepo.create({ userId, badgeId });
    await this.userBadgeRepo.save(userBadge);
  }

  async createBadge(badgeData: { name: string; description: string; iconUrl: string; criteria: string }) {
    const badge = this.badgeRepo.create(badgeData);
    return this.badgeRepo.save(badge);
  }

  async updateBadge(badgeId: string, badgeData: { name?: string; description?: string; iconUrl?: string; criteria?: string }) {
    await this.badgeRepo.update(badgeId, badgeData);
    return this.badgeRepo.findOne({ where: { id: badgeId } });
  }

  async deleteBadge(badgeId: string) {
    await this.badgeRepo.delete(badgeId);
    return { deleted: true };
  }

  async delete(badgeId: string) {
    await this.badgeRepo.delete(badgeId);
    return { deleted: true };
  }

  async listBadges() {
    return this.badgeRepo.find();
  }
}
