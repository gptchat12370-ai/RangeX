import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EnvironmentService } from './environment.service';

/**
 * Session Timeout Service
 * Implements OWASP Session Management Requirements:
 * 1. Idle Timeout - Terminate sessions with no activity
 * 2. Absolute Timeout - Terminate sessions that exceed max duration
 * 
 * Server-side enforcement prevents client tampering
 */

@Injectable()
export class SessionTimeoutService {
  private readonly logger = new Logger(SessionTimeoutService.name);
  
  // OWASP Recommendations:
  // - High-value apps: 2-5 minutes idle
  // - Low-risk apps: 15-30 minutes idle
  // - Absolute timeout: 4-8 hours for full-day usage
  
  // Different timeouts for different session types
  private readonly IDLE_TIMEOUT_MINUTES_PRACTICE = parseInt(
    process.env.IDLE_TIMEOUT_PRACTICE || '60'
  ); // Practice/normal sessions: 60 minutes (relaxed from 30)
  
  private readonly IDLE_TIMEOUT_MINUTES_EVENT = parseInt(
    process.env.IDLE_TIMEOUT_EVENT || '30'
  ); // Event sessions: 30 minutes (relaxed from 15)
  
  private readonly CLEANUP_INTERVAL_SECONDS = 60; // Check every minute

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    private environmentService: EnvironmentService,
  ) {}

  /**
   * Check for idle sessions and auto-terminate
   * Runs every minute
   * 
   * Idle = No heartbeat/activity for IDLE_TIMEOUT_MINUTES
   * Different timeouts for event sessions (15min) vs practice sessions (30min)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkIdleSessions() {
    try {
      const now = Date.now();
      
      // Separate thresholds for event and practice sessions
      const idleThresholdEvent = new Date(now - this.IDLE_TIMEOUT_MINUTES_EVENT * 60 * 1000);
      const idleThresholdPractice = new Date(now - this.IDLE_TIMEOUT_MINUTES_PRACTICE * 60 * 1000);

      // Find all running/paused sessions
      const allSessions = await this.sessionRepo.find({
        where: {
          status: In(['running', 'paused']),
        },
      });

      // Filter sessions based on their type and respective timeout
      const idleSessions = allSessions.filter(session => {
        if (!session.lastActivityAt) return false;
        
        const threshold = session.eventId ? idleThresholdEvent : idleThresholdPractice;
        return session.lastActivityAt < threshold;
      });

      if (idleSessions.length === 0) {
        return;
      }

      this.logger.warn(`Found ${idleSessions.length} idle sessions to terminate`);

      for (const session of idleSessions) {
        if (!session.lastActivityAt) continue; // Skip if no activity timestamp
        
        const idleMinutes = Math.floor((Date.now() - session.lastActivityAt.getTime()) / (1000 * 60));
        const timeoutLimit = session.eventId ? this.IDLE_TIMEOUT_MINUTES_EVENT : this.IDLE_TIMEOUT_MINUTES_PRACTICE;
        const sessionType = session.eventId ? 'event' : 'practice';
        
        this.logger.log(
          `Terminating idle ${sessionType} session: ${session.id} (user: ${session.userId}, idle: ${idleMinutes}/${timeoutLimit} minutes)`
        );

        await this.environmentService.terminateEnvironment(
          session.id,
          `Idle timeout (${idleMinutes} minutes of inactivity, limit: ${timeoutLimit}min for ${sessionType} sessions)`
        );
      }

      this.logger.log(`Successfully terminated ${idleSessions.length} idle sessions`);
    } catch (error) {
      this.logger.error('Error checking idle sessions:', error);
    }
  }

  /**
   * Check for expired sessions (absolute timeout)
   * Runs every minute
   * 
   * Sessions that exceed their expiresAt timestamp are terminated
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkExpiredSessions() {
    try {
      const now = new Date();

      // Find sessions that have exceeded their absolute timeout
      const expiredSessions = await this.sessionRepo.find({
        where: {
          status: In(['running', 'paused']),
          expiresAt: LessThan(now),
        },
      });

      if (expiredSessions.length === 0) {
        return;
      }

      this.logger.warn(`Found ${expiredSessions.length} expired sessions to terminate`);

      for (const session of expiredSessions) {
        this.logger.log(
          `Terminating expired session: ${session.id} (expired at: ${session.expiresAt})`
        );

        await this.environmentService.terminateEnvironment(
          session.id,
          `Absolute timeout (session expired at ${session.expiresAt})`
        );
      }

      this.logger.log(`Successfully terminated ${expiredSessions.length} expired sessions`);
    } catch (error) {
      this.logger.error('Error checking expired sessions:', error);
    }
  }

  /**
   * Update session activity timestamp
   * Call this on every user interaction (heartbeat, answer submission, etc.)
   * 
   * @param sessionId - Session to update
   */
  async updateActivity(sessionId: string): Promise<void> {
    try {
      await this.sessionRepo.update(
        { id: sessionId },
        { lastActivityAt: new Date() }
      );
    } catch (error) {
      this.logger.error(`Failed to update activity for session ${sessionId}:`, error);
    }
  }

  /**
   * Get remaining time before idle timeout
   * Useful for client-side warnings
   * 
   * @param session - Session to check
   * @returns Seconds until idle timeout
   */
  getIdleTimeoutRemaining(session: EnvironmentSession): number {
    if (!session.lastActivityAt) {
      const timeout = session.eventId ? this.IDLE_TIMEOUT_MINUTES_EVENT : this.IDLE_TIMEOUT_MINUTES_PRACTICE;
      return timeout * 60;
    }

    const idleSeconds = Math.floor((Date.now() - session.lastActivityAt.getTime()) / 1000);
    const timeout = session.eventId ? this.IDLE_TIMEOUT_MINUTES_EVENT : this.IDLE_TIMEOUT_MINUTES_PRACTICE;
    const maxIdleSeconds = timeout * 60;
    
    return Math.max(0, maxIdleSeconds - idleSeconds);
  }

  /**
   * Check if session is close to idle timeout
   * Useful for sending warnings to users
   * 
   * @param session - Session to check
   * @param warningThresholdMinutes - Minutes before timeout to warn (default: 5)
   * @returns true if session will timeout soon
   */
  isNearIdleTimeout(session: EnvironmentSession, warningThresholdMinutes = 5): boolean {
    const remainingSeconds = this.getIdleTimeoutRemaining(session);
    return remainingSeconds <= (warningThresholdMinutes * 60) && remainingSeconds > 0;
  }
}
