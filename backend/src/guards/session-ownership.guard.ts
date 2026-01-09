import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';

@Injectable()
export class SessionOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const sessionId = request.params.sessionId || request.params.id;

    if (!user || !user.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!sessionId) {
      throw new ForbiddenException('Session ID required');
    }

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== user.sub) {
      throw new ForbiddenException('You do not have access to this session');
    }

    // Attach session to request for use in controller
    request.session = session;

    return true;
  }
}
