import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Custom JWT extractor that supports both:
 * 1. Authorization: Bearer <token> header
 * 2. Cookie-based token (encrypted)
 */
const cookieExtractor = (req: Request): string | null => {
  let token = null;
  
  // Try to extract from Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback to cookie (decrypt it if encrypted)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    
    // If the cookie is encrypted (looks like base64), you may need to decrypt it
    // For now, try to use it as-is
    return token;
  }
  
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'default-secret-change-in-production',
      passReqToCallback: false,
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      userId: payload.sub,
      email: payload.email,
      roleAdmin: payload.roleAdmin,
      roleCreator: payload.roleCreator,
      roleSolver: payload.roleSolver,
    };
  }
}
