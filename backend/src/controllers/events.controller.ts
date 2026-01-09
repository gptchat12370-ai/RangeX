import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { Event } from '../entities/event.entity';
import { EventScenario } from '../entities/event-scenario.entity';
import { EventRegistration } from '../entities/event-registration.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { EventParticipationService } from '../services/event-participation.service';

@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventsController {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventScenario) private readonly eventScenarioRepo: Repository<EventScenario>,
    @InjectRepository(EventRegistration) private readonly regRepo: Repository<EventRegistration>,
    @InjectRepository(ScenarioVersion) private readonly versionRepo: Repository<ScenarioVersion>,
    private readonly eventParticipationService: EventParticipationService,
  ) {}

  /**
   * Normalizes cover image URL from MinIO format to assets API format
   * and provides fallback if no cover is available
   */
  private normalizeCoverImageUrl(url: string | null | undefined): string {
    if (!url) {
      return '/api/assets/file/defaults/event-cover.png';
    }
    
    // If already in assets API format, return as-is
    if (url.startsWith('/api/assets/file/')) {
      return url;
    }
    
    // Convert MinIO direct URL to assets API format
    // Format: http://localhost:9000/rangex-assets/path/to/file.png
    // Target: /api/assets/file/path/to/file.png
    const match = url.match(/\/rangex-assets\/(.+?)(\?|$)/);
    if (match) {
      return `/api/assets/file/${match[1]}`;
    }
    
    // If format is unknown, return fallback
    return '/api/assets/file/defaults/event-cover.png';
  }

  private calculateEventStatus(startDate?: Date, endDate?: Date): 'Scheduled' | 'Live' | 'Ended' {
    if (!startDate || !endDate) return 'Scheduled';
    const now = new Date();
    if (now < startDate) return 'Scheduled';
    if (now > endDate) return 'Ended';
    return 'Live';
  }

  private formatEvent(event: Event) {
    const status = this.calculateEventStatus(event.startDate, event.endDate);
    const participants = (event.registrations || []).map((r: any) => r.userId);
    const tags = event.description ? [] : []; // TODO: extract tags if needed
    const durationMinutes = event.startDate && event.endDate
      ? Math.floor((event.endDate.getTime() - event.startDate.getTime()) / 60000)
      : 0;

    return {
      ...event,
      status,
      participants,
      tags,
      durationMinutes,
      startAt: event.startDate, // Add for backwards compatibility
      isCommunityEvent: false, // TODO: add flag if needed
    };
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.sub;
    const isAdmin = req.user?.roleAdmin;
    const where = isAdmin ? {} : { createdByUserId: userId };
    const events = await this.eventRepo.find({ where, relations: ['scenarios', 'registrations'] });
    
    // Filter out scenarios with hidden/archived scenario versions
    for (const event of events) {
      if (event.scenarios && event.scenarios.length > 0) {
        // Get all scenario version IDs
        const scenarioIds = event.scenarios.map(it => it.scenarioVersionId);
        
        // Query visible scenarios (published and not archived)
        const visibleScenarios = await this.versionRepo.find({
          where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
        });
        
        const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
        
        // Filter scenarios to only include those with visible scenario versions
        event.scenarios = event.scenarios.filter(scenario => visibleScenarioIds.has(scenario.scenarioVersionId));
        
        // If no visible scenarios remain, use fallback cover
        if (event.scenarios.length === 0) {
          event.coverImageUrl = this.normalizeCoverImageUrl(null);
        } else {
          // Always use first scenario's cover (sorted by sortOrder)
          const firstItem = event.scenarios.sort((a, b) => a.sortOrder - b.sortOrder)[0];
          const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
          event.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
        }
      } else {
        // Normalize cover image URL even if no scenarios
        event.coverImageUrl = this.normalizeCoverImageUrl(event.coverImageUrl);
      }
    }
    
    return events.map((e) => this.formatEvent(e));
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    const ev = await this.eventRepo.findOne({ where: { id }, relations: ['scenarios', 'registrations'] });
    if (!ev) throw new NotFoundException('Event not found');
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && ev.createdByUserId && ev.createdByUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    
    // Filter out scenarios with hidden/archived scenario versions
    if (ev.scenarios && ev.scenarios.length > 0) {
      const scenarioIds = ev.scenarios.map(it => it.scenarioVersionId);
      
      // Query visible scenarios (published and not archived)
      const visibleScenarios = await this.versionRepo.find({
        where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
      });
      
      const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
      
      // Filter scenarios to only include those with visible scenario versions
      ev.scenarios = ev.scenarios.filter(scenario => visibleScenarioIds.has(scenario.scenarioVersionId));
      
      // If no visible scenarios remain, use fallback cover
      if (ev.scenarios.length === 0) {
        ev.coverImageUrl = this.normalizeCoverImageUrl(null);
      } else {
        // Always use first scenario's cover (sorted by sortOrder)
        const firstItem = ev.scenarios.sort((a, b) => a.sortOrder - b.sortOrder)[0];
        const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
        ev.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
      }
    } else {
      // Normalize cover image URL even if no scenarios
      ev.coverImageUrl = this.normalizeCoverImageUrl(ev.coverImageUrl);
    }
    
    return this.formatEvent(ev);
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      timezone?: string;
      maxParticipants?: number;
      format?: 'Player vs Player' | 'Team vs Team';
      registrationRequired?: boolean;
      scenarios?: { scenarioVersionId: string; sortOrder?: number }[];
    },
    @Req() req: any,
  ) {
    const ev = this.eventRepo.create({
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      timezone: body.timezone || 'UTC',
      maxParticipants: body.maxParticipants ?? 0,
      format: body.format || 'Player vs Player',
      registrationRequired: body.registrationRequired ?? true,
      createdByUserId: req.user?.sub,
    });
    const saved = await this.eventRepo.save(ev);
    if (body.scenarios?.length) {
      const toInsert = body.scenarios.map((s, idx) =>
        this.eventScenarioRepo.create({
          eventId: saved.id,
          scenarioVersionId: s.scenarioVersionId,
          sortOrder: s.sortOrder ?? idx,
        }),
      );
      await this.eventScenarioRepo.save(toInsert);
      
      // Auto-set cover from first visible scenario if no cover is set
      const firstScenario = await this.versionRepo.findOne({
        where: { id: toInsert[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
      });
      if (firstScenario?.coverImageUrl) {
        await this.eventRepo.update(saved.id, { coverImageUrl: firstScenario.coverImageUrl });
        saved.coverImageUrl = firstScenario.coverImageUrl; // Update in-memory object
      }
    }
    // Reload to ensure coverImageUrl is included
    const created = await this.eventRepo.findOne({ where: { id: saved.id }, relations: ['scenarios', 'registrations'] });
    return created ? this.formatEvent(created) : null;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<Event> & { scenarios?: { scenarioVersionId: string; sortOrder?: number }[] },
    @Req() req: any,
  ) {
    const ev = await this.eventRepo.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Event not found');
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && ev.createdByUserId && ev.createdByUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    await this.eventRepo.update(id, {
      name: body.name ?? ev.name,
      description: body.description ?? ev.description,
      startDate: body.startDate ?? ev.startDate,
      endDate: body.endDate ?? ev.endDate,
      timezone: body.timezone ?? ev.timezone,
      maxParticipants: body.maxParticipants ?? ev.maxParticipants,
      format: body.format ?? ev.format,
      registrationRequired: body.registrationRequired ?? ev.registrationRequired,
      updatedAt: new Date(),
    });
    if (body.scenarios) {
      await this.eventScenarioRepo.delete({ eventId: id });
      const toInsert = body.scenarios.map((s, idx) =>
        this.eventScenarioRepo.create({
          eventId: id,
          scenarioVersionId: s.scenarioVersionId,
          sortOrder: s.sortOrder ?? idx,
        }),
      );
      if (toInsert.length) {
        await this.eventScenarioRepo.save(toInsert);
        
        // Auto-set cover from first visible scenario if no cover is currently set
        if (!ev.coverImageUrl) {
          const firstScenario = await this.versionRepo.findOne({
            where: { id: toInsert[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
          });
          if (firstScenario?.coverImageUrl) {
            await this.eventRepo.update(id, { coverImageUrl: firstScenario.coverImageUrl });
          }
        }
      }
    }
    // Reload to get updated coverImageUrl
    const updated = await this.eventRepo.findOne({ where: { id }, relations: ['scenarios', 'registrations'] });
    return updated ? this.formatEvent(updated) : null;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const ev = await this.eventRepo.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Event not found');
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && ev.createdByUserId && ev.createdByUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    await this.eventRepo.delete(id);
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Post(':id/register')
  async register(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub;
    const ev = await this.eventRepo.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Event not found');
    if (ev.maxParticipants > 0) {
      const currentCount = await this.regRepo.count({ where: { eventId: id } });
      if (currentCount >= ev.maxParticipants) {
        throw new BadRequestException('Event is full');
      }
    }
    await this.regRepo
      .createQueryBuilder()
      .insert()
      .values({ eventId: id, userId })
      .orIgnore()
      .execute();
    const count = await this.regRepo.count({ where: { eventId: id } });
    return { registered: true, count };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Delete(':id/register')
  async unregister(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub;
    await this.regRepo.delete({ eventId: id, userId });
    const count = await this.regRepo.count({ where: { eventId: id } });
    return { registered: false, count };
  }

  // New event participation endpoints
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 registrations per minute
  @Post(':id/register-player')
  async registerPlayer(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    console.log('DEBUG registerPlayer endpoint - userId:', userId, 'req.user:', req.user);
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    return this.eventParticipationService.registerPlayer(id, userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/register-team')
  async registerTeam(@Param('id') id: string, @Body() body: { teamId: string }, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    if (!body.teamId) {
      throw new BadRequestException('Team ID is required');
    }
    return this.eventParticipationService.registerTeam(id, body.teamId, userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Delete(':id/unregister-participation')
  async unregisterParticipation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    return this.eventParticipationService.unregister(id, userId);
  }

  @Get(':id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    return this.eventParticipationService.getEventLeaderboard(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Get(':id/registration-status')
  async getRegistrationStatus(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    if (!userId) {
      return { registered: false };
    }
    return this.eventParticipationService.isRegistered(id, userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Post(':id/start-session')
  async startEventSession(
    @Param('id') id: string, 
    @Body() body: { scenarioVersionId: string }, 
    @Req() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub; // Support both token formats
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    return this.eventParticipationService.startEventSession(id, body.scenarioVersionId, userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Put(':id/complete-session/:sessionId')
  async completeEventSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() body: { score: number; status: 'Completed' | 'Failed' },
  ) {
    return this.eventParticipationService.completeEventSession(sessionId, body.score, body.status);
  }

  @Get(':id/participants')
  async getParticipants(@Param('id') id: string) {
    return this.eventParticipationService.getEventParticipants(id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Get(':id/active-session')
  async getActiveSession(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    return this.eventParticipationService.getActiveEventSession(id, userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('creator', 'admin', 'solver')
  @Get(':id/my-sessions')
  async getMyEventSessions(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }
    return this.eventParticipationService.getUserEventSessions(id, userId);
  }

  @Post('backfill-covers')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async backfillCovers() {
    // Get all events without covers
    const events = await this.eventRepo.find({
      where: { coverImageUrl: null as any },
      relations: ['scenarios'],
    });

    let updated = 0;
    for (const event of events) {
      if (event.scenarios && event.scenarios.length > 0) {
        // Sort by sortOrder
        const sortedScenarios = [...event.scenarios].sort((a, b) => a.sortOrder - b.sortOrder);
        
        // Find first visible scenario
        const firstScenario = await this.versionRepo.findOne({
          where: { id: sortedScenarios[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
        });
        
        if (firstScenario?.coverImageUrl) {
          await this.eventRepo.update(event.id, { coverImageUrl: firstScenario.coverImageUrl });
          updated++;
        }
      }
    }

    return { success: true, updated };
  }
}
