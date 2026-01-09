import { Controller, Post, Delete, Get, Param, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { MultiOsGuiService, OSType } from '../services/multi-os-gui.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SessionOwnershipGuard } from '../guards/session-ownership.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { CreateGuiSessionDto } from '../dto/gui-session.dto';
import { Logger } from '@nestjs/common';

/**
 * Multi-OS GUI Controller
 * Manages browser-based GUI access to containers
 * SECURITY: Scoped to solver's own sessions via SessionOwnershipGuard
 */
@Controller('solver/sessions')
@UseGuards(JwtAuthGuard)
export class MultiOsGuiController {
  private readonly logger = new Logger(MultiOsGuiController.name);

  constructor(
    private readonly multiOsGuiService: MultiOsGuiService,
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  /**
   * Create GUI session for a running container
   * POST /solver/sessions/:sessionId/gui
   * SECURITY: containerIp derived from session, not trusted from client
   */
  @Post(':sessionId/gui')
  @UseGuards(SessionOwnershipGuard)
  async createGuiSession(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
    @Body() body: CreateGuiSessionDto
  ) {
    this.logger.log(`User ${user.id} creating GUI session for ${sessionId}`);

    // SECURITY: Get container IP from DB session, not from client input
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['machines'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.machines || session.machines.length === 0) {
      throw new BadRequestException('No machines found in session');
    }

    if (session.status !== 'running') {
      throw new BadRequestException(`Session is ${session.status}, must be running to create GUI session`);
    }

    // Use first machine's private IP (or implement machine selector)
    const containerIp = session.machines[0].privateIp;
    if (!containerIp) {
      throw new BadRequestException('Machine IP not yet assigned. Please wait for session to fully start.');
    }

    // Validate IP format
    if (!this.isValidPrivateIp(containerIp)) {
      this.logger.error(`Invalid private IP detected: ${containerIp}`);
      throw new BadRequestException('Invalid machine IP address');
    }

    try {
      const result = await this.multiOsGuiService.createGUISession(
        sessionId,
        body.osType as OSType,
        containerIp
      );
      this.logger.log(`GUI session created successfully for ${sessionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create GUI session: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException(`Failed to create GUI session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get GUI session info
   * GET /solver/sessions/:sessionId/gui
   * Returns full GuiSessionInfo for frontend
   */
  @Get(':sessionId/gui')
  @UseGuards(SessionOwnershipGuard)
  async getGuiSession(@Param('sessionId') sessionId: string) {
    const guiSession = this.multiOsGuiService.getSession(sessionId);
    
    if (!guiSession) {
      return { exists: false };
    }

    try {
      // Return full session info matching frontend expectations
      return {
        exists: true,
        sessionId: guiSession.sessionId,
        osType: guiSession.osType,
        protocol: guiSession.protocol,
        proxyUrl: `https://yourdomain.com/gui/${sessionId}`, // TODO: Use actual domain from config
        containerPrivateIp: guiSession.containerIp,
        credentials: await this.getCredentials(guiSession),
        health: 'healthy', // TODO: Implement actual health check
        createdAt: guiSession.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get GUI session info: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException('Failed to retrieve GUI session information');
    }
  }

  /**
   * Get credentials for GUI session
   */
  private async getCredentials(session: any) {
    try {
      if (session.protocol === 'vnc') {
        return {
          vncPassword: await this.multiOsGuiService.getVNCPassword(session.sessionId),
        };
      } else if (session.protocol === 'rdp') {
        return await this.multiOsGuiService.getRDPCredentials(session.sessionId);
      }
      return {};
    } catch (error) {
      this.logger.error(`Failed to get credentials: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * Validate private IP address (RFC 1918)
   */
  private isValidPrivateIp(ip: string): boolean {
    const ipRegex = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
    return ipRegex.test(ip);
  }

  /**
   * Close GUI session
   * DELETE /solver/sessions/:sessionId/gui
   */
  @Delete(':sessionId/gui')
  @UseGuards(SessionOwnershipGuard)
  async closeSession(@Param('sessionId') sessionId: string) {
    await this.multiOsGuiService.closeSession(sessionId);
    
    return {
      message: 'GUI session closed',
      sessionId,
    };
  }

  /**
   * Health check for GUI session
   * GET /solver/sessions/:sessionId/gui/health
   */
  @Get(':sessionId/gui/health')
  @UseGuards(SessionOwnershipGuard)
  async checkHealth(@Param('sessionId') sessionId: string) {
    const healthy = await this.multiOsGuiService.healthCheck(sessionId);
    
    return {
      sessionId,
      healthy,
      status: healthy ? 'connected' : 'disconnected',
    };
  }
}
