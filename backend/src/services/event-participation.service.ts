import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { EventParticipation } from '../entities/event-participation.entity';
import { EventSession } from '../entities/event-session.entity';
import { Event } from '../entities/event.entity';
import { Team } from '../entities/team.entity';
import { User } from '../entities/user.entity';
import { TeamMember } from '../entities/team-member.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';

@Injectable()
export class EventParticipationService {
  private readonly logger = new Logger(EventParticipationService.name);

  constructor(
    @InjectRepository(EventParticipation)
    private readonly participationRepo: Repository<EventParticipation>,
    @InjectRepository(EventSession)
    private readonly eventSessionRepo: Repository<EventSession>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(EnvironmentSession)
    private readonly environmentSessionRepo: Repository<EnvironmentSession>,
  ) {}

  // Register a player for an event
  async registerPlayer(eventId: string, userId: string) {
    console.log('DEBUG registerPlayer - eventId:', eventId, 'userId:', userId);
    
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Validate event hasn't ended
    const now = new Date();
    if (event.endDate && now > event.endDate) {
      throw new BadRequestException('Event has already ended. Registration is closed.');
    }

    // Check if event is Team vs Team format
    if (event.format === 'Team vs Team') {
      throw new BadRequestException('This event requires team registration');
    }

    // Check if already registered
    const existing = await this.participationRepo.findOne({
      where: { eventId, userId },
    });
    if (existing) {
      throw new BadRequestException('Already registered for this event');
    }

    // Check max participants
    if (event.maxParticipants > 0) {
      const currentCount = await this.participationRepo.count({ where: { eventId } });
      if (currentCount >= event.maxParticipants) {
        throw new BadRequestException('Event is full');
      }
    }

    const participation = this.participationRepo.create({
      id: uuidv4(),
      eventId,
      userId,
      teamId: null,
      participantType: 'player',
      totalPoints: 0,
      challengesCompleted: 0,
      rank: null,
      registeredAt: new Date(),
    });

    console.log('DEBUG registerPlayer - Created participation:', {
      id: participation.id,
      eventId: participation.eventId,
      userId: participation.userId,
      participantType: participation.participantType
    });

    await this.participationRepo.save(participation);
    
    // Verify it was saved
    const saved = await this.participationRepo.findOne({ 
      where: { id: participation.id },
      relations: ['user']
    });
    console.log('DEBUG registerPlayer - Saved participation:', {
      id: saved?.id,
      userId: saved?.userId,
      hasUser: !!saved?.user,
      userEmail: saved?.user ? (saved.user as any)?.email : 'NO USER'
    });
    
    return { success: true, participationId: participation.id };
  }

  // Register a team for an event
  async registerTeam(eventId: string, teamId: string, userId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Validate event hasn't ended
    const now = new Date();
    if (event.endDate && now > event.endDate) {
      throw new BadRequestException('Event has already ended. Registration is closed.');
    }

    // Check if event is Player vs Player format
    if (event.format === 'Player vs Player') {
      throw new BadRequestException('This event requires individual registration');
    }

    const team = await this.teamRepo.findOne({ 
      where: { id: teamId },
      relations: ['members'],
    });
    if (!team) throw new NotFoundException('Team not found');

    // Check if user is team leader
    this.logger.log(`Team registration check - Team: ${team.name}, Team Leader: ${team.leaderId}, User: ${userId}`);
    if (team.leaderId !== userId) {
      throw new ForbiddenException('Only team leader can register the team');
    }

    // Check if already registered
    const existing = await this.participationRepo.findOne({
      where: { eventId, teamId },
    });
    if (existing) {
      throw new BadRequestException('Team already registered for this event');
    }

    // Check max participants
    if (event.maxParticipants > 0) {
      const currentCount = await this.participationRepo.count({ where: { eventId } });
      if (currentCount >= event.maxParticipants) {
        throw new BadRequestException('Event is full');
      }
    }

    const participation = this.participationRepo.create({
      id: uuidv4(),
      eventId,
      userId: null,
      teamId,
      participantType: 'team',
      totalPoints: 0,
      challengesCompleted: 0,
      rank: null,
      registeredAt: new Date(),
    });

    await this.participationRepo.save(participation);
    return { success: true, participationId: participation.id };
  }

  // Unregister from event
  async unregister(eventId: string, userId: string) {
    // Find player participation
    const playerParticipation = await this.participationRepo.findOne({
      where: { eventId, userId },
    });

    if (playerParticipation) {
      // Terminate all active environment sessions for this user in this event
      const activeSessions = await this.environmentSessionRepo.find({
        where: { eventId, userId, status: 'running' },
      });

      for (const session of activeSessions) {
        session.status = 'terminated';
        session.stoppedAt = new Date();
        await this.environmentSessionRepo.save(session);
        this.logger.log(`Terminated session ${session.id} for user ${userId} unregistering from event ${eventId}`);
      }

      // Delete all event sessions for this participation (clean slate)
      await this.eventSessionRepo.delete({ participationId: playerParticipation.id });
      
      // Delete the participation record
      await this.participationRepo.delete({ id: playerParticipation.id });
      return { success: true };
    }

    // Find team participation where user is leader
    const teams = await this.teamRepo.find({ where: { leaderId: userId } });
    for (const team of teams) {
      const teamParticipation = await this.participationRepo.findOne({
        where: { eventId, teamId: team.id },
      });
      if (teamParticipation) {
        // Terminate all active environment sessions for this team in this event
        const activeSessions = await this.environmentSessionRepo.find({
          where: { eventId, teamId: team.id, status: 'running' },
        });

        for (const session of activeSessions) {
          session.status = 'terminated';
          session.stoppedAt = new Date();
          await this.environmentSessionRepo.save(session);
          this.logger.log(`Terminated session ${session.id} for team ${team.id} unregistering from event ${eventId}`);
        }

        // Delete all event sessions for this team participation (clean slate)
        await this.eventSessionRepo.delete({ participationId: teamParticipation.id });
        
        // Delete the team participation record
        await this.participationRepo.delete({ id: teamParticipation.id });
        return { success: true };
      }
    }

    throw new NotFoundException('No registration found');
  }

  // Get event leaderboard
  async getEventLeaderboard(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Optimized query with proper relations and ordering
    const participations = await this.participationRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.team', 'team')
      .leftJoinAndSelect('team.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser')
      .where('p.eventId = :eventId', { eventId })
      .orderBy('p.totalPoints', 'DESC')
      .addOrderBy('p.registeredAt', 'ASC') // Tiebreaker: earlier registration
      .getMany();

    // DEBUG: Log participation data
    console.log('DEBUG Leaderboard - Participations:', participations.map(p => ({
      id: p.id,
      userId: p.userId,
      teamId: p.teamId,
      participantType: p.participantType,
      totalPoints: p.totalPoints,
      challengesCompleted: p.challengesCompleted,
      hasUser: !!p.user,
      userName: p.user ? (p.user as any)?.email : 'NO USER OBJECT'
    })));

    // Calculate ranks
    let currentRank = 1;
    let previousPoints = -1;
    const leaderboard = participations.map((p, idx) => {
      if (p.totalPoints !== previousPoints) {
        currentRank = idx + 1;
        previousPoints = p.totalPoints;
      }

      // Get proper name with fallbacks
      let participantName = 'Unknown';
      if (p.participantType === 'player') {
        if (p.user) {
          participantName = (p.user as any)?.displayName || 
                          (p.user as any)?.username || 
                          (p.user as any)?.email || 
                          `Player ${p.userId?.substring(0, 8)}`;
        } else {
          participantName = `Player ${p.userId?.substring(0, 8) || 'Unknown'}`;
        }
      } else {
        participantName = p.team?.name || `Team ${p.teamId?.substring(0, 8) || 'Unknown'}`;
      }

      return {
        rank: currentRank,
        participantType: p.participantType,
        participantId: p.participantType === 'player' ? p.userId : p.teamId,
        participantName,
        avatarUrl: p.participantType === 'player' ? (p.user as any)?.avatarUrl : p.team?.avatarUrl,
        country: p.participantType === 'player' ? (p.user as any)?.country : p.team?.country,
        totalPoints: p.totalPoints,
        challengesCompleted: p.challengesCompleted,
        memberCount: p.participantType === 'team' ? p.team?.members?.length || 0 : undefined,
      };
    });

    return leaderboard;
  }

  // Start event session
  async startEventSession(eventId: string, scenarioVersionId: string, userId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Validate event timing
    const now = new Date();
    if (event.startDate && now < event.startDate) {
      throw new BadRequestException('Event has not started yet');
    }
    if (event.endDate && now > event.endDate) {
      throw new BadRequestException('Event has ended');
    }

    // Find participation
    let participation = await this.participationRepo.findOne({
      where: { eventId, userId },
    });

    if (!participation) {
      // Check if user is in a team that's registered
      const teamMember = await this.teamMemberRepo.findOne({
        where: { userId },
        relations: ['team'],
      });

      if (teamMember) {
        participation = await this.participationRepo.findOne({
          where: { eventId, teamId: teamMember.teamId },
        });
      }
    }

    if (!participation) {
      throw new BadRequestException('Not registered for this event');
    }

    const mode = participation.participantType === 'team' ? 'team' : 'solo';

    const session = this.eventSessionRepo.create({
      id: uuidv4(),
      eventId,
      participationId: participation.id,
      scenarioVersionId,
      userId, // Track which user completed this
      mode,
      status: 'InProgress',
      score: 0,
      progressPct: 0,
      startedAt: new Date(),
      finishedAt: null,
    });

    await this.eventSessionRepo.save(session);
    return session;
  }

  // Complete event session
  async completeEventSession(sessionId: string, score: number, status: 'Completed' | 'Failed' | 'InProgress', answers?: any) {
    const session = await this.eventSessionRepo.findOne({
      where: { id: sessionId },
      relations: ['participation'],
    });

    if (!session) throw new NotFoundException('Session not found');

    // Validate answer integrity if answers provided (event sessions only)
    if (answers) {
      const currentHash = session.answersHash;
      const newHash = this.generateAnswersHash(answers);
      
      // If hash exists and doesn't match, potential tampering detected
      if (currentHash && currentHash !== newHash) {
        this.logger.error(`Answer tampering detected for session ${sessionId}: hash mismatch`);
        throw new ForbiddenException('Answer integrity validation failed');
      }
      
      // Update hash
      session.answersHash = newHash;
    }

    // Update session
    session.status = status as any;
    session.score = score;
    if (status === 'Completed') {
      session.finishedAt = new Date();
    }
    await this.eventSessionRepo.save(session);

    // ALWAYS update participation points (even for partial progress)
    const participation = session.participation;
    
    // Get all sessions for this participation (including in-progress)
    const allSessions = await this.eventSessionRepo.find({
      where: { participationId: participation.id },
    });

    // Calculate total points from ALL sessions (highest score per challenge)
    const challengeScores = new Map<string, number>();
    allSessions.forEach((s) => {
      const currentScore = challengeScores.get(s.scenarioVersionId) || 0;
      if ((s.score || 0) > currentScore) {
        challengeScores.set(s.scenarioVersionId, s.score || 0);
      }
    });

    const totalPoints = Array.from(challengeScores.values()).reduce((sum, score) => sum + score, 0);
    
    // Count only fully completed challenges
    const completedSessions = allSessions.filter(s => s.status === 'Completed');
    const challengesCompleted = new Set(completedSessions.map(s => s.scenarioVersionId)).size;

    participation.totalPoints = totalPoints;
    participation.challengesCompleted = challengesCompleted;
    await this.participationRepo.save(participation);

    this.logger.log(`Updated participation ${participation.id}: ${totalPoints} pts, ${challengesCompleted} challenges completed`);

    // If team participation, update team eventPoints
    if (participation.participantType === 'team' && participation.teamId) {
      const team = await this.teamRepo.findOne({ where: { id: participation.teamId } });
      if (team) {
        // Team eventPoints = sum of all their event participations
        const allTeamParticipations = await this.participationRepo.find({
          where: { teamId: team.id },
        });
        const teamEventPoints = allTeamParticipations.reduce((sum, p) => sum + (p.totalPoints || 0), 0);
        
        await this.teamRepo.update(team.id, { eventPoints: teamEventPoints } as any);
      }
    }

    return { success: true, totalPoints, challengesCompleted };
  }

  // Check if user is registered for event
  async isRegistered(eventId: string, userId: string) {
    // Check player registration
    const playerParticipation = await this.participationRepo.findOne({
      where: { eventId, userId },
    });

    if (playerParticipation) {
      return { registered: true, type: 'player', participationId: playerParticipation.id };
    }

    // Check team registration
    const teamMember = await this.teamMemberRepo.findOne({
      where: { userId },
    });

    if (teamMember) {
      const teamParticipation = await this.participationRepo.findOne({
        where: { eventId, teamId: teamMember.teamId },
      });

      if (teamParticipation) {
        return { registered: true, type: 'team', participationId: teamParticipation.id };
      }
    }

    return { registered: false };
  }

  // Get event participants with progress
  async getEventParticipants(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const participations = await this.participationRepo.find({
      where: { eventId },
      relations: ['user', 'team', 'team.members', 'team.members.user'],
      order: { totalPoints: 'DESC', registeredAt: 'ASC' },
    });

    // Get challenge completions for each participation
    const participantsWithDetails = await Promise.all(
      participations.map(async (p) => {
        let completedChallenges: any[] = [];
        
        if (p.participantType === 'team') {
          // For teams, get all completed sessions with user info
          const sessions = await this.eventSessionRepo.find({
            where: { 
              eventId,
              participationId: p.id,
              status: 'Completed',
            },
            relations: ['scenario'],
          });
          
          // Get user info for each session
          completedChallenges = await Promise.all(
            sessions.map(async (session) => {
              const user = session.userId 
                ? await this.userRepo.findOne({ where: { id: session.userId } })
                : null;
              
              return {
                scenarioId: session.scenarioVersionId,
                scenarioTitle: (session.scenario as any)?.title || 'Unknown',
                score: session.score,
                completedBy: user ? {
                  id: user.id,
                  displayName: (user as any).displayName || (user as any).email,
                  avatarUrl: (user as any).avatarUrl,
                } : null,
                completedAt: session.finishedAt,
              };
            })
          );
        }

        // Get proper participant name with multiple fallbacks
        let participantName = 'Unknown';
        if (p.participantType === 'player') {
          if (p.user) {
            participantName = (p.user as any)?.displayName || 
                            (p.user as any)?.username || 
                            (p.user as any)?.email || 
                            `Player ${p.userId?.substring(0, 8)}`;
          } else {
            participantName = `Player ${p.userId?.substring(0, 8) || 'Unknown'}`;
          }
        } else {
          participantName = p.team?.name || `Team ${p.teamId?.substring(0, 8) || 'Unknown'}`;
        }

        return {
          id: p.id,
          participantType: p.participantType,
          participantId: p.participantType === 'player' ? p.userId : p.teamId,
          participantName,
          avatarUrl: p.participantType === 'player' ? (p.user as any)?.avatarUrl : p.team?.avatarUrl,
          totalPoints: p.totalPoints,
          challengesCompleted: p.challengesCompleted,
          registeredAt: p.registeredAt,
          rank: p.rank,
          completedChallenges, // Details of completed challenges (for teams, shows who completed each)
          teamMembers: p.participantType === 'team' 
            ? (p.team?.members || []).map((m: any) => ({
                id: m.userId,
                displayName: m.user?.displayName || m.user?.username || m.user?.email || 'Unknown',
                avatarUrl: m.user?.avatarUrl,
              }))
            : undefined,
        };
      })
    );

    return participantsWithDetails;
  }

  // Get active event session for a user
  async getActiveEventSession(eventId: string, userId: string) {
    console.log('DEBUG getActiveEventSession - eventId:', eventId, 'userId:', userId);
    
    // Check if user is registered for the event
    const { registered } = await this.isRegistered(eventId, userId);
    if (!registered) {
      console.log('DEBUG getActiveEventSession - User not registered');
      return { hasActiveSession: false, session: null };
    }

    // Find active session by userId (works for both team and solo events)
    const activeSession = await this.eventSessionRepo.findOne({
      where: { 
        eventId,
        userId,
        status: 'InProgress',
      },
      order: { startedAt: 'DESC' },
    });

    if (!activeSession) {
      console.log('DEBUG getActiveEventSession - No active session found');
      return { hasActiveSession: false, session: null };
    }

    console.log('DEBUG getActiveEventSession - Found active session:', {
      id: activeSession.id,
      scenarioVersionId: activeSession.scenarioVersionId,
      status: activeSession.status,
      score: activeSession.score,
    });

    // Find the corresponding environment session
    const environmentSession = await this.environmentSessionRepo.findOne({
      where: {
        eventId,
        userId,
        scenarioVersionId: activeSession.scenarioVersionId,
        status: 'running' as any,
      },
      order: { startedAt: 'DESC' },
    });

    if (!environmentSession) {
      console.log('DEBUG getActiveEventSession - No environment session found');
      return { hasActiveSession: false, session: null };
    }

    console.log('DEBUG getActiveEventSession - Found environment session:', environmentSession.id);

    return { 
      hasActiveSession: true, 
      session: {
        id: activeSession.id,
        environmentSessionId: environmentSession.id, // Add environment session ID for navigation
        eventId: activeSession.eventId,
        scenarioVersionId: activeSession.scenarioVersionId,
        scenarioId: activeSession.scenarioVersionId, // Add for frontend compatibility
        status: activeSession.status,
        score: activeSession.score,
        startedAt: activeSession.startedAt,
        completedAt: activeSession.finishedAt,
      },
    };
  }

  // Get all user event sessions (for progress tracking)
  async getUserEventSessions(eventId: string, userId: string) {
    // Check if user is registered for the event
    const { registered } = await this.isRegistered(eventId, userId);
    if (!registered) {
      return { sessions: [] };
    }

    // Find the participation
    const participation = await this.participationRepo.findOne({
      where: { eventId, userId },
    });
    
    if (!participation) {
      // Check if user is in a registered team
      const teamMember = await this.teamMemberRepo.findOne({
        where: { userId },
        relations: ['team'],
      });

      if (teamMember) {
        const teamParticipation = await this.participationRepo.findOne({
          where: { eventId, teamId: teamMember.teamId },
        });

        if (teamParticipation) {
          // Get sessions for this team participation but filtered by userId
          const sessions = await this.eventSessionRepo.find({
            where: { 
              participationId: teamParticipation.id,
              userId, // Only sessions completed by this specific user
            },
            order: { startedAt: 'DESC' },
          });

          return { sessions: sessions.map(s => ({
            id: s.id,
            eventId: s.eventId,
            scenarioVersionId: s.scenarioVersionId,
            status: s.status,
            score: s.score,
            startedAt: s.startedAt,
            completedAt: s.finishedAt,
          })) };
        }
      }

      return { sessions: [] };
    }

    // Get all sessions for this participation
    const sessions = await this.eventSessionRepo.find({
      where: { participationId: participation.id },
      order: { startedAt: 'DESC' },
    });

    return { 
      sessions: sessions.map(s => ({
        id: s.id,
        eventId: s.eventId,
        scenarioVersionId: s.scenarioVersionId,
        status: s.status,
        score: s.score,
        startedAt: s.startedAt,
        completedAt: s.finishedAt,
      })),
    };
  }

  // Initialize event session when environment starts
  async initializeEventSession(
    sessionId: string,
    eventId: string,
    userId: string,
    scenarioVersionId: string,
  ) {
    this.logger.log(`Initializing event session for session ${sessionId}, event ${eventId}, user ${userId}`);
    
    // Find the participation
    let participation = await this.participationRepo.findOne({
      where: { eventId, userId },
    });

    if (!participation) {
      // Check if user is in a team that's registered
      const teamMember = await this.teamMemberRepo.findOne({
        where: { userId },
        relations: ['team'],
      });

      if (teamMember) {
        participation = await this.participationRepo.findOne({
          where: { eventId, teamId: teamMember.teamId },
        });
      }
    }
    
    if (!participation) {
      this.logger.warn(`No participation found for user ${userId} in event ${eventId}`);
      return;
    }

    // Check if an event_session already exists for this scenario
    const existing = await this.eventSessionRepo.findOne({
      where: {
        eventId,
        scenarioVersionId,
        userId,
        status: 'InProgress',
      },
    });

    if (existing) {
      this.logger.log(`Event session already exists: ${existing.id}`);
      return;
    }

    const mode = participation.participantType === 'team' ? 'team' : 'solo';

    // Create new event session
    const eventSession = this.eventSessionRepo.create({
      id: uuidv4(),
      eventId,
      participationId: participation.id,
      scenarioVersionId,
      userId,
      mode,
      status: 'InProgress',
      score: 0,
      progressPct: 0,
      startedAt: new Date(),
      finishedAt: null,
    });

    await this.eventSessionRepo.save(eventSession);
    this.logger.log(`✓ Created event_session ${eventSession.id} for environment session ${sessionId}`);
  }

  /**
   * Generate SHA256 hash of answers for integrity validation
   * This prevents answer tampering in event sessions
   */
  private generateAnswersHash(answers: any): string {
    // Sort keys to ensure consistent hashing
    const sortedAnswers = Object.keys(answers)
      .sort()
      .reduce((obj, key) => {
        obj[key] = answers[key];
        return obj;
      }, {} as any);

    const answersString = JSON.stringify(sortedAnswers);
    return createHash('sha256').update(answersString).digest('hex');
  }
}
