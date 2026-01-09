import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { randomBytes } from 'crypto';

/**
 * Session Security Service
 * Implements OWASP session management best practices:
 * - Session binding to client IP and User-Agent
 * - Token rotation on privilege changes
 * - Session validation and hijacking detection
 */
@Injectable()
export class SessionSecurityService {
  private readonly logger = new Logger(SessionSecurityService.name);

  // Configuration: Set to true in production, false for localhost development
  private readonly STRICT_IP_VALIDATION = process.env.STRICT_IP_VALIDATION === 'false'; // Default: false
  
  // Allow IP changes for VPN users (validate User-Agent only) - DEFAULT: TRUE
  private readonly ALLOW_VPN_IP_CHANGE = process.env.ALLOW_VPN_IP_CHANGE !== 'true'; // Default: true
  
  // Disable User-Agent validation for local network/hotspot scenarios - DEFAULT: FALSE
  private readonly VALIDATE_USER_AGENT = process.env.VALIDATE_USER_AGENT === 'false'; // Default: false

  constructor(
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
  ) {}

  /**
   * Validate session belongs to the same client
   * Checks IP and User-Agent to detect session hijacking
   */
  async validateSessionSecurity(
    sessionId: string,
    clientIp: string,
    clientUserAgent: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    
    if (!session) {
      throw new ForbiddenException('Session not found');
    }

    // Skip validation for admin test sessions (they don't have strict IP/UA requirements)
    if (session.isTest) {
      this.logger.debug(`Skipping session validation for admin test session: ${sessionId}`);
      return;
    }

    // Skip validation for localhost and local network development
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
    const isLocalNetwork = 
      /^192\.168\.\d+\.\d+$/.test(clientIp) ||
      /^10\.\d+\.\d+\.\d+$/.test(clientIp) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(clientIp);
    
    if ((isLocalhost || isLocalNetwork) && !this.STRICT_IP_VALIDATION) {
      this.logger.debug(`Skipping session validation for local network: ${sessionId} (IP: ${clientIp})`);
      return;
    }

    // Validate User-Agent (only if enabled - disabled by default for hotspot/VPN scenarios)
    if (this.VALIDATE_USER_AGENT && session.clientUserAgent && session.clientUserAgent !== clientUserAgent) {
      this.logger.warn(
        `Session security warning: User-Agent mismatch for session ${sessionId}. ` +
        `Expected: ${session.clientUserAgent}, Got: ${clientUserAgent}`
      );
      // Log but don't block - User-Agent can change due to browser updates, extensions, etc.
      this.logger.log(`Allowing session ${sessionId} to continue despite User-Agent change`);
    }

    // Validate IP (can be disabled for VPN users)
    if (!this.ALLOW_VPN_IP_CHANGE && session.clientIp && session.clientIp !== clientIp) {
      this.logger.warn(
        `Session hijacking detected: IP mismatch for session ${sessionId}. ` +
        `Expected: ${session.clientIp}, Got: ${clientIp}`
      );
      throw new ForbiddenException('Session validation failed: IP address mismatch');
    }

    // Log IP changes (for VPN detection and monitoring)
    if (session.clientIp && session.clientIp !== clientIp) {
      this.logger.log(
        `IP changed for session ${sessionId}: ${session.clientIp} → ${clientIp} ` +
        `(VPN/mobile network suspected)`
      );
    }
  }

  /**
   * Rotate session token (use after privilege escalation or sensitive operations)
   */
  async rotateSessionToken(sessionId: string): Promise<string> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    
    if (!session) {
      throw new Error('Session not found');
    }

    const newToken = randomBytes(24).toString('hex');
    session.gatewaySessionToken = newToken;
    
    await this.sessionRepo.save(session);
    
    this.logger.log(`Session token rotated for session ${sessionId}`);
    
    return newToken;
  }

  /**
   * Initialize session security metadata
   */
  async initializeSessionSecurity(
    sessionId: string,
    clientIp: string,
    clientUserAgent: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    
    if (!session) {
      throw new Error('Session not found');
    }

    session.clientIp = clientIp;
    session.clientUserAgent = clientUserAgent;
    session.lastActivityAt = new Date();
    
    await this.sessionRepo.save(session);
    
    this.logger.log(`Session security initialized for ${sessionId}: IP=${clientIp}`);
  }

  /**
   * Update last activity timestamp (for idle timeout tracking)
   */
  async updateActivity(sessionId: string): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update()
      .set({ lastActivityAt: new Date() })
      .where('id = :sessionId', { sessionId })
      .execute();
  }
}
