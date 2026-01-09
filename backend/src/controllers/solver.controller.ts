import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards, ForbiddenException, BadRequestException, UseInterceptors, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { StartEnvironmentDto } from '../dto/start-environment.dto';
import { EnvironmentService } from '../services/environment.service';
import { SessionStateMachineService } from '../services/session-state-machine.service';
import { SessionTimeoutService } from '../services/session-timeout.service';
import { SessionSecurityService } from '../services/session-security.service';
import { EventParticipationService } from '../services/event-participation.service';
import { SessionSecurityInterceptor } from '../common/interceptors/session-security.interceptor';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EventSession } from '../entities/event-session.entity';

@Controller('solver')
export class SolverController {
  private readonly logger = new Logger(SolverController.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly stateMachine: SessionStateMachineService,
    private readonly sessionTimeout: SessionTimeoutService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly eventParticipationService: EventParticipationService,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EventSession)
    private readonly eventSessionRepo: Repository<EventSession>,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @Get('scenarios/:scenarioVersionId/detail')
  async getScenarioDetail(@Param('scenarioVersionId') scenarioVersionId: string) {
    // Allow both PUBLISHED (for solvers) and APPROVED (for admin testing)
    const v = await this.versionRepo.findOne({
      where: [
        { id: scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED },
        { id: scenarioVersionId, status: ScenarioVersionStatus.APPROVED },
      ],
      relations: ['scenario', 'machines', 'assets'],
    });
    if (!v) {
      throw new NotFoundException('Scenario not found or not published');
    }
    return {
      id: v.id,
      scenarioId: v.scenarioId,
      title: v.title,
      name: v.title,
      shortDescription: v.shortDescription,
      description: v.shortDescription,
      coverImageUrl: v.coverImageUrl,
      missionText: v.missionText,
      solutionWriteup: v.solutionWriteup,
      author: v.creatorName || v.scenario?.slug || 'Unknown Creator',
      tags: v.tags ?? [],
      mode: 'Single Player',
      type: 'Cyber Challenge',
      scenarioType: v.scenarioType,
      difficulty: v.difficulty,
      durationMinutes: v.estimatedMinutes,
      estimatedMinutes: v.estimatedMinutes,
      category: v.category,
      rating: Number(v.scenario?.averageRating) || 0,
      averageRating: Number(v.scenario?.averageRating) || 0,
      totalRatings: Number(v.scenario?.totalRatings) || 0,
      followers: 0,
      mission: v.missionText ? v.missionText : '',
      rules: { codeOfEthics: v.codeOfEthics || '', learningOutcomes: v.learningOutcomes || '' },
      learningOutcomes: v.learningOutcomes || '',
      machines: (v.machines || []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        kind: 'Docker',
        access: m.entrypoints?.map(ep => ep.protocol.toUpperCase()) || ['SSH'],
        solverCanAccess: m.allowSolverEntry ?? (m.role === 'attacker'),
        imageName: m.imageRef,
      })),
      questions: v.questions || [],
      hints: v.hints || [],
      validationPolicy: v.validationMode || 'Instant',
      scoringPolicy: v.scoringMode || 'AllOrNothing',
      hintPolicy: v.hintMode || 'Disabled',
      requiresMachines: v.requiresMachines,
      assets: (v.assets || []).map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        assetType: a.assetType,
        assetLocation: a.assetLocation,
        machineId: a.machineId,
        description: a.description,
        uploadedAt: a.uploadedAt,
      })),
      status: v.status,
      version: v.versionNumber,
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 starts per minute per user
  @Post('scenarios/:scenarioVersionId/start')
  startScenario(
    @Param('scenarioVersionId') scenarioVersionId: string,
    @Body() dto: StartEnvironmentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.environmentService.startEnvironment(
      scenarioVersionId,
      userId,
      dto.isTest ?? false,
      dto.ttlMinutes,
      dto.envProfile,
      dto.eventId,
      dto.teamId,
      req.ip, // Pass client IP for security binding
      req.headers['user-agent'], // Pass User-Agent for security binding
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @Get('scenarios')
  async listScenarios() {
    const versions = await this.versionRepo.find({
      where: { status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
      relations: ['scenario', 'machines'],
      order: { updatedAt: 'DESC' },
    });
    return versions.map((v) => ({
      id: v.id,
      scenarioId: v.scenarioId,
      title: v.title,
      shortDescription: v.shortDescription,
      coverImageUrl: v.coverImageUrl,
      author: v.creatorName || v.scenario?.slug || 'Unknown Creator',
      tags: v.tags ?? [],
      mode: 'Single Player',
      type: 'Cyber Challenge',
      difficulty: v.difficulty,
      durationMinutes: v.estimatedMinutes,
      category: v.category,
      rating: Number(v.scenario?.averageRating) || 0,
      averageRating: Number(v.scenario?.averageRating) || 0,
      totalRatings: Number(v.scenario?.totalRatings) || 0,
      followers: 0,
      mission: v.missionText || '',
      rules: { codeOfEthics: v.codeOfEthics || '' },
      machines: (v.machines || []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        kind: 'Docker',
        access: ['SSH'],
        solverCanAccess: m.allowSolverEntry ?? (m.role === 'attacker'),
        imageName: m.imageRef,
      })),
      questions: v.questions || [],
      validationPolicy: 'Instant',
      scoringPolicy: 'AllOrNothing',
      hintPolicy: 'Disabled',
      status: v.status,
      version: v.versionNumber,
    }));
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @UseInterceptors(SessionSecurityInterceptor)
  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const session = await this.sessionRepo.findOne({ 
      where: { id: sessionId },
      relations: ['environmentMachines']
    });
    if (!session) throw new NotFoundException('Session not found');
    
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && session.userId !== userId) {
      throw new ForbiddenException('You cannot access this session');
    }

    // SECURITY: Validate session security (IP/User-Agent binding)
    await this.sessionSecurity.validateSessionSecurity(
      sessionId,
      req.ip,
      req.headers['user-agent']
    );

    // Update activity timestamp for idle timeout tracking
    await this.sessionTimeout.updateActivity(sessionId);

    // Calculate remaining time
    const now = new Date();
    const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
    const remainingSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) : 0;

    // Map session status to frontend SessionStatus
    let sessionStatus: 'In Progress' | 'Completed' | 'Terminated' = 'In Progress';
    if (session.status === 'terminated' || session.status === 'stopping') {
      sessionStatus = 'Terminated';
    } else if (session.status === 'error') {
      sessionStatus = 'Terminated';
    }

    // Build machines status
    const machinesStatus: Record<string, 'running' | 'stopped' | 'restarting'> = {};
    (session.environmentMachines || []).forEach(m => {
      machinesStatus[m.id] = m.taskArn ? 'running' : 'stopped';
    });

    return {
      id: session.id,
      scenarioId: session.scenarioVersionId,
      userId: session.userId,
      status: sessionStatus,
      startedAt: session.startedAt?.toISOString() || session.createdAt.toISOString(),
      finishedAt: session.stoppedAt?.toISOString(),
      remainingSeconds,
      score: session.score || 0,
      progressPct: 0,
      answers: session.answers || {},
      machinesStatus,
      eventId: session.eventId, // CRITICAL: Return eventId so frontend can filter event sessions
      isTest: session.isTest || false, // Return isTest flag for admin test sessions
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard, CsrfGuard)
  @Roles('solver', 'creator', 'admin')
  @Post('sessions/:sessionId/questions/:questionId/answer')
  async answerQuestion(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() payload: any,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    const session = await this.sessionRepo.findOne({ 
      where: { id: sessionId },
      relations: ['environmentMachines']
    });
    if (!session) throw new NotFoundException('Session not found');
    
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && session.userId !== userId) {
      throw new ForbiddenException('You cannot access this session');
    }

    // SECURITY: Validate session security (IP/User-Agent binding)
    await this.sessionSecurity.validateSessionSecurity(
      sessionId,
      req.ip,
      req.headers['user-agent']
    );

    // Get scenario to validate answer
    const scenarioVersion = await this.versionRepo.findOne({
      where: { id: session.scenarioVersionId }
    });
    if (!scenarioVersion) throw new NotFoundException('Scenario not found');

    const question = (scenarioVersion.questions || []).find((q: any) => q.id === questionId);
    if (!question) throw new NotFoundException('Question not found');

    // Initialize answers if not exist
    if (!session.answers) {
      session.answers = {};
    }

    // Get or create answer tracking
    const answerTracking = session.answers[questionId] || {
      correct: false,
      attemptsMade: 0,
      remainingAttempts: question.maxAttempts || 15,
      earnedPoints: 0,
      submittedAnswer: null
    };

    // Check if already answered correctly
    if (answerTracking.correct) {
      return this.getSession(sessionId, req);
    }

    // Check if attempts remaining
    if (answerTracking.remainingAttempts <= 0) {
      throw new BadRequestException('No attempts remaining for this question');
    }

    // Validate answer
    let isCorrect = false;
    const userAnswer = payload.answer;

    if (question.type === 'single') {
      // Single choice - compare option IDs
      const correctOption = (question.options || []).find((opt: any) => opt.isCorrect);
      console.log(`Question ${questionId} validation:`, {
        questionType: question.type,
        userAnswer,
        correctOptionId: correctOption?.id,
        correctOptionText: correctOption?.text,
        allOptions: question.options.map((o: any) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }))
      });
      isCorrect = correctOption && correctOption.id === userAnswer;
    } else if (question.type === 'trueFalse') {
      // True/False - check correctAnswer field and compare with option index
      // Option 0 = True, Option 1 = False
      const options = question.options || [];
      const correctAnswerValue = question.correctAnswer; // true or false
      const userOptionIndex = options.findIndex((opt: any) => opt.id === userAnswer);
      
      console.log(`TrueFalse Question ${questionId} validation:`, {
        correctAnswer: correctAnswerValue,
        userAnswer,
        userOptionIndex,
        options: options.map((o: any, idx: number) => ({ id: o.id, index: idx }))
      });
      
      // If correctAnswer is true, option 0 should be selected; if false, option 1
      if (correctAnswerValue === true) {
        isCorrect = userOptionIndex === 0;
      } else {
        isCorrect = userOptionIndex === 1;
      }
    } else if (question.type === 'multiple') {
      // Multiple choice - user submits array of option IDs
      const correctIds = (question.options || [])
        .filter((opt: any) => opt.isCorrect)
        .map((opt: any) => opt.id)
        .sort();
      const userIds = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(userIds);
    } else if (question.type === 'shortAnswer') {
      // Short answer - flexible validation with best practices
      const acceptedAnswers = question.acceptedAnswers || [];
      const useRegex = question.useRegexMatching || false;
      const caseSensitive = question.caseSensitiveMatching || false;
      
      // Sanitize and normalize user input
      let userText = (userAnswer || '').toString().trim();
      
      // Security: Limit answer length to prevent abuse
      if (userText.length > 10000) {
        throw new BadRequestException('Answer too long. Maximum 10,000 characters.');
      }
      
      // Normalize whitespace (replace multiple spaces with single space)
      userText = userText.replace(/\s+/g, ' ');
      
      if (!caseSensitive) {
        userText = userText.toLowerCase();
      }
      
      isCorrect = acceptedAnswers.some((ans: string) => {
        let pattern = ans.trim();
        
        if (!caseSensitive) {
          pattern = pattern.toLowerCase();
        }
        
        // Normalize whitespace in pattern too
        pattern = pattern.replace(/\s+/g, ' ');
        
        if (useRegex) {
          try {
            // Security: Validate regex pattern
            const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
            return regex.test(userText);
          } catch (e) {
            // Invalid regex in pattern, fall back to exact match
            console.warn(`Invalid regex pattern: ${pattern}`);
            return pattern === userText;
          }
        } else {
          // Exact match with normalized whitespace
          return pattern === userText;
        }
      });
    } else if (question.type === 'matching') {
      // Matching pairs - validate structure and check correctness
      // matchingPairs is stored as array: [{id, left, right}, ...]
      const correctPairsArray = question.matchingPairs || [];
      const userPairs = userAnswer || {};
      
      // Security: Validate input is an object
      if (typeof userPairs !== 'object' || Array.isArray(userPairs)) {
        throw new BadRequestException('Invalid matching answer format');
      }
      
      // Convert correctPairs array to object for comparison
      // correctPairsArray = [{left: "1", right: "2"}, {left: "3", right: "4"}]
      // userPairs = {"1": "2", "3": "4"}
      const correctPairsMap: Record<string, string> = {};
      correctPairsArray.forEach((pair: any) => {
        if (pair.left && pair.right) {
          correctPairsMap[pair.left] = pair.right;
        }
      });
      
      this.logger.debug(`Matching Question ${question.id} validation:`, {
        correctPairsArray,
        correctPairsMap,
        userPairs
      });
      
      // Check if all pairs match
      const correctKeys = Object.keys(correctPairsMap);
      const userKeys = Object.keys(userPairs);
      
      // Must have same number of pairs
      if (correctKeys.length !== userKeys.length) {
        isCorrect = false;
      } else {
        // Check each pair
        isCorrect = correctKeys.every(key => 
          userPairs[key] && correctPairsMap[key] === userPairs[key]
        );
      }
      
      this.logger.log(`Matching Question ${question.id} result: ${isCorrect}`);
    } else if (question.type === 'ordering') {
      // Ordering - compare correct order property
      const orderingItems = question.orderingItems || [];
      const userOrder = userAnswer || [];
      
      // Security: Validate input is an array
      if (!Array.isArray(userOrder)) {
        throw new BadRequestException('Invalid ordering answer format');
      }
      
      // Security: Limit array size
      if (userOrder.length > 100) {
        throw new BadRequestException('Too many items in ordering answer');
      }
      
      // Check if arrays have same length
      if (orderingItems.length !== userOrder.length) {
        isCorrect = false;
      } else {
        // Compare the correctOrder property of each item in sequence
        isCorrect = orderingItems.every((item: any, idx: number) => {
          const expectedOrder = typeof item === 'object' ? item.correctOrder : idx + 1;
          const userItem = userOrder[idx];
          const userItemOrder = typeof userItem === 'object' ? userItem.correctOrder : userItem;
          
          // Also check item ID matches
          const expectedId = typeof item === 'object' ? item.id : item;
          const userId = typeof userItem === 'object' ? userItem.id : userItem;
          
          return expectedId === userId;
        });
      }
    }

    // Update tracking
    answerTracking.attemptsMade += 1;
    answerTracking.remainingAttempts -= 1;
    answerTracking.submittedAnswer = userAnswer;

    if (isCorrect) {
      answerTracking.correct = true;
      answerTracking.earnedPoints = question.points || 0;
      session.score = (session.score || 0) + answerTracking.earnedPoints;
    }

    session.answers[questionId] = answerTracking;

    // Update activity timestamp
    session.lastActivityAt = new Date();

    // Save session with optimistic locking
    try {
      await this.sessionRepo.save(session);
    } catch (error: any) {
      if (error.name === 'OptimisticLockVersionMismatchError') {
        throw new BadRequestException('Session was modified by another request. Please retry.');
      }
      throw error;
    }

    // Check if this is an event challenge - update points per question
    if (session.eventId && isCorrect) {
      const allQuestions = scenarioVersion.questions || [];
      const allAnswers = session.answers || {};
      
      this.logger.log(`Event challenge question answered correctly: eventId=${session.eventId}, sessionId=${session.id}, userId=${userId}, questionPoints=${answerTracking.earnedPoints}`);
      this.logger.log(`Progress: ${Object.values(allAnswers).filter((a: any) => a.correct).length}/${allQuestions.length} questions completed, current session score: ${session.score}`);
      
      // Find or create event session for THIS user's completion
      let eventSession = await this.eventSessionRepo.findOne({
        where: { 
          eventId: session.eventId,
          scenarioVersionId: session.scenarioVersionId,
          userId, // Track by user for individual completions
        },
        relations: ['participation'],
      });

      if (!eventSession) {
        // Create event session through participation service
        try {
          this.logger.log(`Creating event session for user ${userId} in event ${session.eventId}`);
          eventSession = await this.eventParticipationService.startEventSession(
            session.eventId,
            session.scenarioVersionId,
            userId,
          );
          this.logger.log(`✓ Event session created: ${eventSession.id}`);
        } catch (error) {
          this.logger.error(`Failed to create event session: ${error instanceof Error ? error.message : String(error)}`);
          // Don't fail the whole request if event tracking fails
          return this.getSession(sessionId, req);
        }
      }

      // Update event session score incrementally (track highest score for this challenge)
      if (eventSession) {
        try {
          const previousScore = eventSession.score || 0;
          const newScore = session.score;
          
          // Only update if new score is higher (allows retries)
          if (newScore > previousScore) {
            this.logger.log(`Updating event session ${eventSession.id} score: ${previousScore} → ${newScore}`);
            
            // Check if all questions are completed
            const allCompleted = allQuestions.every((q: any) => allAnswers[q.id]?.correct === true);
            
            // Status: Completed if all done, InProgress if partial
            const sessionStatus = allCompleted ? 'Completed' : 'InProgress';
            
            await this.eventParticipationService.completeEventSession(
              eventSession.id,
              newScore,
              sessionStatus,
              allAnswers, // Pass answers for integrity validation
            );
            
            if (allCompleted) {
              // Auto-terminate the environment session when challenge is completed
              session.status = 'terminated';
              session.stoppedAt = new Date();
              await this.sessionRepo.save(session);
              
              this.logger.log(`✓ Event challenge COMPLETED: ${newScore} points awarded to user ${userId}, session auto-terminated`);
            } else {
              this.logger.log(`✓ Event progress updated: ${newScore} points (${Object.values(allAnswers).filter((a: any) => a.correct).length}/${allQuestions.length} questions)`);
            }
          } else {
            this.logger.log(`Event session score unchanged (${previousScore} >= ${newScore}), no update needed`);
          }
        } catch (error) {
          this.logger.error(`Failed to update event session: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      // For non-event sessions, also auto-terminate when all questions completed
      const allQuestions = scenarioVersion.questions || [];
      const allAnswers = session.answers || {};
      const allCompleted = allQuestions.every((q: any) => allAnswers[q.id]?.correct === true);
      
      if (allCompleted && session.status === 'running') {
        session.status = 'terminated';
        session.stoppedAt = new Date();
        await this.sessionRepo.save(session);
        this.logger.log(`✓ Practice challenge COMPLETED: session ${sessionId} auto-terminated`);
      }
    }

    return this.getSession(sessionId, req);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @UseInterceptors(SessionSecurityInterceptor)
  @Post('sessions/:sessionId/heartbeat')
  async heartbeat(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && session.userId !== userId) {
      throw new ForbiddenException('You cannot access this session');
    }

    // SECURITY: Validate session security (IP/User-Agent binding)
    await this.sessionSecurity.validateSessionSecurity(
      sessionId,
      req.ip,
      req.headers['user-agent']
    );

    // Update activity timestamp using timeout service
    await this.sessionTimeout.updateActivity(sessionId);

    // Return current session state
    return this.getSession(sessionId, req);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('solver', 'creator', 'admin')
  @Post('sessions/:sessionId/stop')
  async stopSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const isAdmin = req.user?.roleAdmin;
    if (!isAdmin && session.userId !== userId) {
      throw new ForbiddenException('You cannot stop this session');
    }
    await this.environmentService.terminateEnvironment(sessionId, `Stopped by user ${userId}`);
    return { sessionId, status: 'terminated' };
  }
}
