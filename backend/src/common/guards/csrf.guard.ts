import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomBytes } from 'crypto';

/**
 * CSRF Protection Guard
 * 
 * Implements Double Submit Cookie pattern:
 * 1. Server sets a CSRF token in a cookie (httpOnly=false so client can read it)
 * 2. Client must send the token in a header (X-CSRF-Token) on state-changing requests
 * 3. Server validates that cookie token matches header token
 * 
 * OWASP Recommendation: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Check if route has @SkipCsrf() decorator
    const skipCsrf = this.reflector.get<boolean>('skipCsrf', context.getHandler());
    if (skipCsrf) {
      return true;
    }

    // Get CSRF token from cookie
    const csrfCookie = request.cookies?.['csrf-token'];
    
    // Get CSRF token from header
    const csrfHeader = request.headers['x-csrf-token'];

    // Both must exist and match
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  /**
   * Generate a CSRF token for a new session
   */
  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}

/**
 * Decorator to skip CSRF validation for specific endpoints
 * Usage: @SkipCsrf()
 */
export const SkipCsrf = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('skipCsrf', true, descriptor.value);
    return descriptor;
  };
};
