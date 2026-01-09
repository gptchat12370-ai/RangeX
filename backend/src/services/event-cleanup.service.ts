import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Event } from '../entities/event.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EventSession } from '../entities/event-session.entity';

@Injectable()
export class EventCleanupService {
  private readonly logger = new Logger(EventCleanupService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(EnvironmentSession)
    private readonly environmentSessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EventSession)
    private readonly eventSessionRepo: Repository<EventSession>,
  ) {}

  /**
   * Auto-terminate all active sessions for events that have ended
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async terminateExpiredEventSessions() {
    const now = new Date();
    
    try {
      // Find all events that have ended
      const endedEvents = await this.eventRepo.find({
        where: {
          endDate: LessThan(now),
        },
      });

      if (endedEvents.length === 0) {
        return; // No ended events
      }

      this.logger.log(`Found ${endedEvents.length} ended events, cleaning up sessions...`);

      for (const event of endedEvents) {
        await this.terminateEventSessions(event.id, event.name);
      }

      this.logger.log(`✓ Cleanup complete for ${endedEvents.length} events`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Event cleanup failed: ${errorMessage}`);
    }
  }

  /**
   * Terminate all active sessions for a specific event
   */
  private async terminateEventSessions(eventId: string, eventName: string) {
    try {
      // Find all running environment sessions for this event
      const activeSessions = await this.environmentSessionRepo.find({
        where: {
          eventId,
          status: 'running',
        },
      });

      if (activeSessions.length === 0) {
        this.logger.log(`No active sessions found for event ${eventName}`);
        return;
      }

      this.logger.log(`Terminating ${activeSessions.length} active sessions for event ${eventName}...`);

      // Terminate each session
      for (const session of activeSessions) {
        session.status = 'terminated';
        session.stoppedAt = new Date();
        session.reasonStopped = `Event ended: ${eventName}`;
        await this.environmentSessionRepo.save(session);
      }

      // Mark all event_session records as Completed
      await this.eventSessionRepo
        .createQueryBuilder()
        .update()
        .set({ 
          status: 'Completed',
          finishedAt: new Date(),
        })
        .where('eventId = :eventId', { eventId })
        .andWhere('status = :status', { status: 'InProgress' })
        .execute();

      this.logger.log(`✓ Terminated ${activeSessions.length} sessions for event ${eventName}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to terminate sessions for event ${eventId}: ${errorMessage}`);
    }
  }

  /**
   * Manually terminate all sessions for an event (can be called from API)
   */
  async forceTerminateEventSessions(eventId: string): Promise<number> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new Error('Event not found');
    }

    const activeSessions = await this.environmentSessionRepo.find({
      where: { eventId, status: 'running' },
    });

    await this.terminateEventSessions(eventId, event.name);
    
    return activeSessions.length;
  }
}
