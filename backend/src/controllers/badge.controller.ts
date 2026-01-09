import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { Badge } from '../entities/badge.entity';
import { BadgeRequirement } from '../entities/badge-requirement.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';

@Controller('badges')
@UseGuards(AuthGuard('jwt'))
export class BadgeController {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(BadgeRequirement) private readonly requirementRepo: Repository<BadgeRequirement>,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  @Get()
  async listAllBadges() {
    const badges = await this.badgeRepo.find({ order: { createdAt: 'ASC' } });
    
    const badgesWithRequirements = await Promise.all(
      badges.map(async (badge) => {
        const requirements = await this.requirementRepo.find({
          where: { badgeId: badge.id },
          relations: ['scenario'],
        });
        return { ...badge, requirements };
      })
    );
    
    return badgesWithRequirements;
  }

  @Get('progress/:userId')
  async getUserBadgeProgress(@Param('userId') userId: string) {
    const badges = await this.badgeRepo.find({ order: { createdAt: 'ASC' } });
    
    const progress = await Promise.all(
      badges.map(async (badge) => {
        const requirements = await this.requirementRepo.find({
          where: { badgeId: badge.id },
          relations: ['scenario'],
        });

        const hasEarned = await this.userBadgeRepo.findOne({ where: { userId, badgeId: badge.id } });
        
        // Check completion status for each requirement
        const requirementProgress = await Promise.all(
          requirements.map(async (req) => {
            if (req.scenarioId) {
              const completed = await this.sessionRepo.findOne({
                where: {
                  userId,
                  scenarioVersionId: req.scenarioId,
                  status: 'terminated',
                },
              });
              return {
                scenarioId: req.scenarioId,
                scenarioName: req.scenario?.title || 'Unknown Scenario',
                completed: !!completed,
              };
            }
            return null;
          })
        );

        const completedCount = requirementProgress.filter(r => r && r.completed).length;
        const totalCount = requirementProgress.filter(r => r !== null).length;

        return {
          badge,
          requirements: requirementProgress.filter(r => r !== null),
          earned: !!hasEarned,
          earnedAt: hasEarned?.earnedAt,
          progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          completedCount,
          totalCount,
        };
      })
    );
    
    return progress;
  }
}
