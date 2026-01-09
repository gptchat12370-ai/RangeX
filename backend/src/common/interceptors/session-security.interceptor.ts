import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../../entities/environment-session.entity';

/**
 * Session Security Interceptor
 * Implements OWASP "Binding the Session ID to Other User Properties"
 * 
 * Prevents session hijacking by validating:
 * 1. Client IP address matches session IP
 * 2. User-Agent matches session User-Agent (with version tolerance)
 * 
 * Apply to session-related endpoints with @UseInterceptors(SessionSecurityInterceptor)
 */

@Injectable()
export class SessionSecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SessionSecurityInterceptor.name);

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.params?.sessionId;

    // Only apply to requests with sessionId parameter
    if (!sessionId) {
      return next.handle();
    }

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });

    if (!session) {
      // Session not found - let controller handle it
      return next.handle();
    }

    // Extract current request properties
    const currentIp = this.getClientIp(request);
    const currentUserAgent = request.headers['user-agent'] || '';

    // Validate IP binding (if session has IP stored)
    if (session.clientIp && currentIp !== session.clientIp) {
      this.logger.warn(
        `Session IP mismatch detected! Session: ${sessionId}, Expected: ${session.clientIp}, Got: ${currentIp}`
      );
      
      throw new ForbiddenException(
        'Session security violation: IP address mismatch. This may indicate session hijacking. Please start a new session.'
      );
    }

    // Validate User-Agent binding (with tolerance for minor version changes)
    if (session.clientUserAgent && !this.userAgentMatches(session.clientUserAgent, currentUserAgent)) {
      this.logger.warn(
        `Session User-Agent mismatch detected! Session: ${sessionId}, Expected: ${session.clientUserAgent}, Got: ${currentUserAgent}`
      );
      
      throw new ForbiddenException(
        'Session security violation: Browser/device mismatch. This may indicate session hijacking. Please start a new session.'
      );
    }

    // Validation passed
    return next.handle();
  }

  /**
   * Extract client IP from request
   * Handles proxy headers (X-Forwarded-For, X-Real-IP)
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Check if User-Agent matches with tolerance for patch version changes
   * 
   * Allows: Chrome/120.0 → Chrome/120.1 (patch update)
   * Blocks: Chrome/120.0 → Firefox/120.0 (different browser)
   * Blocks: Chrome/120.0 → Chrome/121.0 (major update - suspicious)
   * 
   * @param original - Original User-Agent from session creation
   * @param current - Current User-Agent from request
   */
  private userAgentMatches(original: string, current: string): boolean {
    // Exact match - always allow
    if (original === current) {
      return true;
    }

    // Extract browser and major.minor version
    const extractBrowserVersion = (ua: string): string | null => {
      // Match: Chrome/120.0, Firefox/115.0, Safari/17.2, Edge/120.0
      const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
      return match ? `${match[1]}/${match[2]}` : null;
    };

    const originalBrowser = extractBrowserVersion(original);
    const currentBrowser = extractBrowserVersion(current);

    // If we can't extract browser, require exact match
    if (!originalBrowser || !currentBrowser) {
      return false;
    }

    // Compare browser and major.minor version
    return originalBrowser === currentBrowser;
  }
}
