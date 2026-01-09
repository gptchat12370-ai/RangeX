import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BadgesService } from '../services/badges.service';

@Injectable()
export class BadgesJob {
  constructor(private readonly badgesService: BadgesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleCron() {
    this.badgesService.awardBadges();
  }
}
