import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SessionLimitService {
  private readonly logger = new Logger(SessionLimitService.name);

  // Configurable limits
  private readonly MAX_SESSIONS_PER_HOUR = 10;
  private readonly MAX_SESSIONS_PER_DAY = 50;
  private readonly MAX_CONCURRENT_SESSIONS = 5;

  constructor(
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  /**
   * Check if user can start a new session
   * Throws ForbiddenException if limits exceeded
   */
  async checkUserLimits(userId: string): Promise<void> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const recentSessions = await this.sessionRepo.count({
      where: {
        userId,
        createdAt: MoreThan(hourAgo),
      },
    });

    if (recentSessions >= this.MAX_SESSIONS_PER_HOUR) {
      this.logger.warn(
        `User ${userId} exceeded hourly session limit (${recentSessions}/${this.MAX_SESSIONS_PER_HOUR})`,
      );
      throw new ForbiddenException(
        `Maximum ${this.MAX_SESSIONS_PER_HOUR} sessions per hour. Please wait before starting another challenge.`,
      );
    }

    // Check daily limit
    const dailySessions = await this.sessionRepo.count({
      where: {
        userId,
        createdAt: MoreThan(dayAgo),
      },
    });

    if (dailySessions >= this.MAX_SESSIONS_PER_DAY) {
      this.logger.warn(
        `User ${userId} exceeded daily session limit (${dailySessions}/${this.MAX_SESSIONS_PER_DAY})`,
      );
      throw new ForbiddenException(
        `Maximum ${this.MAX_SESSIONS_PER_DAY} sessions per day reached. Please try again tomorrow.`,
      );
    }

    // Check concurrent sessions
    const runningSessions = await this.sessionRepo.count({
      where: {
        userId,
        status: 'running',
      },
    });

    if (runningSessions >= this.MAX_CONCURRENT_SESSIONS) {
      this.logger.warn(
        `User ${userId} has too many concurrent sessions (${runningSessions}/${this.MAX_CONCURRENT_SESSIONS})`,
      );
      throw new ForbiddenException(
        `Maximum ${this.MAX_CONCURRENT_SESSIONS} concurrent sessions allowed. Please terminate an existing session first.`,
      );
    }

    this.logger.log(
      `Session limits check passed for user ${userId}: ${recentSessions}/hr, ${dailySessions}/day, ${runningSessions} running`,
    );
  }

  /**
   * Get user's current session usage
   */
  async getUserUsage(userId: string) {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [hourly, daily, concurrent] = await Promise.all([
      this.sessionRepo.count({
        where: {
          userId,
          createdAt: MoreThan(hourAgo),
        },
      }),
      this.sessionRepo.count({
        where: {
          userId,
          createdAt: MoreThan(dayAgo),
        },
      }),
      this.sessionRepo.count({
        where: {
          userId,
          status: 'running',
        },
      }),
    ]);

    return {
      hourly: {
        used: hourly,
        limit: this.MAX_SESSIONS_PER_HOUR,
        remaining: Math.max(0, this.MAX_SESSIONS_PER_HOUR - hourly),
      },
      daily: {
        used: daily,
        limit: this.MAX_SESSIONS_PER_DAY,
        remaining: Math.max(0, this.MAX_SESSIONS_PER_DAY - daily),
      },
      concurrent: {
        used: concurrent,
        limit: this.MAX_CONCURRENT_SESSIONS,
        remaining: Math.max(0, this.MAX_CONCURRENT_SESSIONS - concurrent),
      },
    };
  }
}
