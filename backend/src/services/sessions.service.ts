import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepository: Repository<EnvironmentSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll() {
    const sessions = await this.sessionRepository.find({
      relations: ['environmentMachines'],
      order: { startedAt: 'DESC' },
      take: 100,
    });

    // Load user emails separately since there's no user relation
    const userIds = [...new Set(sessions.map(s => s.userId))];
    const users = await this.userRepository.find({
      where: userIds.map(id => ({ id })),
      select: ['id', 'email']
    });
    
    const userMap = new Map(users.map(u => [u.id, u.email]));

    return sessions.map(session => ({
      ...session,
      userEmail: userMap.get(session.userId) || 'Unknown',
      idleMinutes: session.stoppedAt 
        ? Math.floor((session.stoppedAt.getTime() - (session.startedAt?.getTime() || 0)) / 60000)
        : session.startedAt
        ? Math.floor((new Date().getTime() - session.startedAt.getTime()) / 60000)
        : 0
    }));
  }

  async terminate(sessionId: string) {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    session.stoppedAt = new Date();
    session.status = 'terminated';
    session.reasonStopped = 'Terminated by admin';
    await this.sessionRepository.save(session);
    return { terminated: true, sessionId };
  }
}
