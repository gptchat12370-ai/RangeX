import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Private Network Middleware - Phase 2-3 Private Dev Protection
 * 
 * Enforces IP-based access control to prevent accidental public exposure.
 * CORS only controls browsers - this middleware blocks ALL non-private clients.
 * 
 * Default: PRIVATE ONLY (LAN/VPN only)
 * Public launch: Set ALLOW_PUBLIC_API=true
 */
@Injectable()
export class PrivateNetworkMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Check if public API access is allowed
    const allowPublic = this.configService.get<string>('ALLOW_PUBLIC_API', 'false').toLowerCase() === 'true';
    
    if (allowPublic) {
      return next();
    }

    // Get client IP (normalize IPv4-mapped IPv6 format ::ffff:192.168.1.10)
    const rawIp = (req.ip || '').replace('::ffff:', '');

    // Allow local connections
    if (this.isLocal(rawIp)) {
      return next();
    }

    // Allow RFC1918 private IPs
    if (this.isPrivateIpv4(rawIp)) {
      return next();
    }

    // Block all other IPs
    throw new ForbiddenException({
      message: 'API is private (LAN/VPN only). Set ALLOW_PUBLIC_API=true to enable public access.',
      clientIp: rawIp,
      hint: 'This is a security feature to prevent accidental public exposure during development.',
    });
  }

  private isIpv4(ip: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  }

  private isPrivateIpv4(ip: string): boolean {
    if (!this.isIpv4(ip)) return false;
    
    const [a, b] = ip.split('.').map(n => parseInt(n, 10));
    
    // 10.0.0.0/8
    if (a === 10) return true;
    
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    
    return false;
  }

  private isLocal(ip: string): boolean {
    return ip === '127.0.0.1' || ip === 'localhost' || ip === '::1';
  }
}
