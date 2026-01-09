# RangeX Code Documentation - Part 2: Authentication & Security

This document provides comprehensive code analysis of RangeX's authentication and authorization system, including JWT token management, password hashing with Argon2, CSRF protection, and role-based access control (RBAC).

---

## Table of Contents
1. [Authentication Controller & CSRF Tokens](#1-authentication-controller--csrf-tokens)
2. [Login with Argon2 Password Verification](#2-login-with-argon2-password-verification)
3. [JWT Token Generation & Refresh](#3-jwt-token-generation--refresh)
4. [CSRF Protection Guard](#4-csrf-protection-guard)
5. [JWT Authentication Guard](#5-jwt-authentication-guard)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)

---

## 1. Authentication Controller & CSRF Tokens

**File**: [backend/src/controllers/auth.controller.ts](backend/src/controllers/auth.controller.ts) (Lines 1-60)

**Purpose**: Handle authentication endpoints (login, CSRF token generation, password changes) with security best practices.

### Code Snippet:
```typescript
import { Body, Controller, Post, Get, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from '../dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get CSRF token for client-side requests
   * Client should:
   * 1. Call this endpoint to get CSRF token in cookie
   * 2. Read token from cookie
   * 3. Send token in X-CSRF-Token header on POST/PUT/DELETE requests
   */
  @Get('csrf-token')
  getCsrfToken(@Res() res: Response) {
    const token = CsrfGuard.generateToken();
    res.cookie('csrf-token', token, {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    return res.json({ csrfToken: token });
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    // Generate CSRF token on successful login
    const result = await this.authService.login(dto);
    const csrfToken = CsrfGuard.generateToken();
    
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    
    return res.json({ ...result, csrfToken });
  }

  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(AuthGuard('jwt'), CsrfGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user?.userId || req.user?.sub;
    return this.authService.changePassword(userId, dto);
  }
}
```

### Explanation:
- **Lines 1-7**: Import NestJS decorators, guards, and DTOs. `ThrottlerGuard` prevents brute-force attacks, `CsrfGuard` prevents cross-site request forgery.
- **Lines 9-11**: Controller is registered at `/auth` base path. All endpoints are prefixed with this.
- **Lines 13-19**: JSDoc explains CSRF token workflow. This is the "Double Submit Cookie" pattern recommended by OWASP.
- **Lines 20-30**: `GET /auth/csrf-token` endpoint generates a random CSRF token and sets it in a cookie. Key security properties:
  - `httpOnly: false` - Client JavaScript can read this cookie (required for CSRF pattern)
  - `secure: true` (production) - Cookie only sent over HTTPS
  - `sameSite: 'strict'` - Prevents cookie from being sent in cross-site requests
  - `maxAge: 3600000` - Token expires after 1 hour
- **Line 22**: `CsrfGuard.generateToken()` creates a cryptographically random 32-byte token using Node's `crypto.randomBytes()`.
- **Lines 32-49**: `POST /auth/login` endpoint with rate limiting. `@UseGuards(ThrottlerGuard)` limits login attempts (default: 10 requests/minute) to prevent brute-force attacks.
- **Lines 36-38**: On successful login, call `AuthService.login()` which verifies password and generates JWT tokens.
- **Lines 39-47**: Generate fresh CSRF token on login and set cookie. This ensures each session has a unique CSRF token.
- **Lines 51-55**: `POST /auth/refresh` endpoint to get new access token using refresh token. Protected by `CsrfGuard` to prevent token theft via CSRF.
- **Lines 57-62**: `POST /auth/change-password` endpoint requires both JWT authentication (`AuthGuard('jwt')`) AND CSRF protection. This prevents attackers from changing passwords even if they steal a JWT token.
- **Line 60**: Extract user ID from JWT payload. NestJS Passport automatically injects `req.user` after JWT validation.

### Key Takeaways:
- **Defense in Depth**: Multiple security layers (rate limiting, CSRF, JWT validation)
- **CSRF Token Rotation**: New token generated on each login for better security
- **Secure Cookie Flags**: `httpOnly: false` (for CSRF), `secure: true` (HTTPS only), `sameSite: strict` (no cross-site)
- **Brute-Force Protection**: ThrottlerGuard limits login attempts to prevent password guessing
- **Stateless Authentication**: JWT tokens eliminate need for server-side session storage

---

## 2. Login with Argon2 Password Verification

**File**: [backend/src/services/auth.service.ts](backend/src/services/auth.service.ts) (Lines 1-90)

**Purpose**: Verify user credentials using Argon2id password hashing and generate JWT access/refresh tokens.

### Code Snippet:
```typescript
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'passwordHash', 'displayName', 'roleAdmin', 'roleCreator', 'roleSolver', 'isActive', 'avatarUrl'],
    });
    if (!user || !user.isActive) return null;
    const valid = await argon2.verify(user.passwordHash, password);
    return valid ? user : null;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = this.createPayload(user);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d', // Extended to 30 days for better user experience
    });
    return {
      accessToken,
      refreshToken,
      user: this.safeUser(user),
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      const newPayload = this.createPayload(user);
      const accessToken = await this.jwtService.signAsync(newPayload);
      const refreshToken = await this.jwtService.signAsync(newPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d', // Extended to 30 days for better user experience
      });
      return { accessToken, refreshToken, user: this.safeUser(user) };
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await argon2.hash(dto.newPassword);
    await this.userRepo.save(user);
    return { success: true };
  }

  private createPayload(user: User) {
    return {
      sub: user.id,
      email: user.email,
      roleAdmin: user.roleAdmin,
      roleCreator: user.roleCreator,
      roleSolver: user.roleSolver,
    };
  }

  private safeUser(user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
```

### Explanation:
- **Line 4**: Import `argon2` library. Argon2id is the winner of Password Hashing Competition and resistant to GPU/ASIC attacks.
- **Lines 19-27**: `validateUser()` method fetches user by email and verifies password:
  - **Line 21**: `select` array explicitly includes `passwordHash` which is normally excluded by `select: false` in User entity
  - **Line 24**: Check `isActive` flag to prevent disabled accounts from logging in
  - **Line 25**: `argon2.verify()` performs constant-time comparison to prevent timing attacks. It automatically extracts salt and parameters from the hash.
  - **Line 26**: Return user only if password is valid, otherwise return null
- **Lines 29-44**: `login()` method orchestrates authentication flow:
  - **Lines 30-33**: Validate credentials and throw `UnauthorizedException` if invalid (returns 401 status)
  - **Line 34**: Create JWT payload with user ID and roles
  - **Line 35**: Sign access token with default secret and expiration (typically 15 minutes)
  - **Lines 36-38**: Sign refresh token with separate secret and 30-day expiration. Separate secret allows invalidating all refresh tokens without affecting access tokens.
  - **Lines 40-43**: Return both tokens and sanitized user object (password hash removed)
- **Lines 46-63**: `refresh()` method exchanges refresh token for new access + refresh tokens:
  - **Lines 48-50**: Verify refresh token signature using refresh secret
  - **Lines 51-52**: Load user from database to ensure account still exists and is active
  - **Lines 54-58**: Generate new token pair. This implements "refresh token rotation" - each refresh invalidates the previous refresh token.
  - **Lines 60-62**: Catch verification errors and return 401. This prevents token reuse attacks.
- **Lines 65-78**: `changePassword()` method requires current password verification:
  - **Lines 66-70**: Load user with password hash (normally hidden)
  - **Lines 71-74**: Verify current password with Argon2. This prevents attackers from changing password if they steal JWT but don't know password.
  - **Line 75**: Hash new password with Argon2. Library automatically generates random salt and uses secure parameters.
  - **Lines 76-77**: Save updated password hash to database
- **Lines 80-88**: `createPayload()` creates JWT payload with claims. `sub` (subject) claim contains user ID.
- **Lines 90-93**: `safeUser()` removes password hash from user object before sending to client. This prevents accidental password hash exposure.

### Key Takeaways:
- **Argon2id Hashing**: Memory-hard algorithm resistant to GPU/ASIC cracking (OWASP recommended)
- **Constant-Time Comparison**: `argon2.verify()` prevents timing attacks that could leak password information
- **Separate Token Secrets**: Access and refresh tokens use different secrets for security isolation
- **Refresh Token Rotation**: Each token refresh generates new refresh token to prevent replay attacks
- **Password Verification on Change**: Requires old password even with valid JWT to prevent session hijacking attacks
- **Automatic Salt Generation**: Argon2 library handles salt generation, no need for manual salt management

---

## 3. JWT Token Generation & Refresh

**File**: [backend/src/services/auth.service.ts](backend/src/services/auth.service.ts) (Lines 29-63)

**Purpose**: Generate stateless JWT tokens for authentication and implement secure token refresh mechanism.

### Code Snippet:
```typescript
async login(dto: LoginDto) {
  const user = await this.validateUser(dto.email, dto.password);
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }
  const payload = this.createPayload(user);
  const accessToken = await this.jwtService.signAsync(payload);
  const refreshToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    expiresIn: '30d', // Extended to 30 days for better user experience
  });
  return {
    accessToken,
    refreshToken,
    user: this.safeUser(user),
  };
}

async refresh(dto: RefreshTokenDto) {
  try {
    const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    const newPayload = this.createPayload(user);
    const accessToken = await this.jwtService.signAsync(newPayload);
    const refreshToken = await this.jwtService.signAsync(newPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });
    return { accessToken, refreshToken, user: this.safeUser(user) };
  } catch (err) {
    throw new UnauthorizedException('Invalid refresh token');
  }
}

private createPayload(user: User) {
  return {
    sub: user.id,
    email: user.email,
    roleAdmin: user.roleAdmin,
    roleCreator: user.roleCreator,
    roleSolver: user.roleSolver,
  };
}
```

### Explanation:
- **Lines 1-17**: Login flow generates two tokens with different lifetimes:
  - **Access Token** (line 7): Short-lived (15 minutes default), used for API requests. Signed with `JWT_SECRET`.
  - **Refresh Token** (lines 8-10): Long-lived (30 days), used only to get new access tokens. Signed with `JWT_REFRESH_SECRET`.
- **Line 6**: Create JWT payload from user data. Payload is base64-encoded JSON, NOT encrypted (anyone can decode it).
- **Line 7**: `jwtService.signAsync()` creates HMAC-SHA256 signature of payload. This prevents tampering but doesn't encrypt data.
- **Lines 8-10**: Refresh token uses separate secret. This security practice allows:
  - Rotating refresh secret without invalidating access tokens
  - Different expiration policies for access vs refresh
  - Isolating refresh token compromise from access token compromise
- **Line 10**: 30-day expiration balances security (shorter is better) with UX (longer avoids frequent re-login).
- **Lines 19-36**: Token refresh mechanism implements "sliding sessions":
  - **Lines 21-23**: Verify refresh token signature and expiration. Throws error if invalid or expired.
  - **Lines 24-25**: Check user still exists and is active. User may have been deleted or disabled since token was issued.
  - **Lines 26-31**: Generate NEW access and refresh tokens. This "refresh token rotation" prevents token replay attacks.
  - **Line 32**: Return new token pair along with updated user data (in case roles changed).
  - **Lines 33-35**: Catch verification errors (invalid signature, expired token, malformed token) and return 401.
- **Lines 38-46**: JWT payload structure:
  - `sub` (Subject): User ID, standard JWT claim for principal identifier
  - `email`: User email for display purposes
  - `roleAdmin`, `roleCreator`, `roleSolver`: Role flags for authorization checks
  - Note: No sensitive data (passwords, API keys) should be in JWT payload as it's not encrypted

### Key Takeaways:
- **Dual Token Strategy**: Short-lived access token + long-lived refresh token balances security and UX
- **Stateless Authentication**: Server doesn't store sessions, all auth state is in JWT claims
- **Refresh Token Rotation**: Each refresh generates new refresh token to prevent replay attacks
- **Separate Secrets**: Access and refresh tokens use different signing secrets for security isolation
- **User Re-validation**: Refresh flow checks user still exists and is active (not just token validity)
- **JWT Structure**: Header (algorithm) + Payload (claims) + Signature (HMAC), base64-encoded

**Security Considerations**:
- JWT payload is **not encrypted**, only signed. Don't store sensitive data in payload.
- Refresh tokens should be stored securely (httpOnly cookies or secure storage), not localStorage.
- Token expiration is checked, but there's no server-side revocation mechanism (would require Redis/database).
- Refresh token rotation helps mitigate token theft but doesn't prevent it entirely.

---

## 4. CSRF Protection Guard

**File**: [backend/src/common/guards/csrf.guard.ts](backend/src/common/guards/csrf.guard.ts) (Lines 1-66)

**Purpose**: Implement Double Submit Cookie pattern to prevent Cross-Site Request Forgery (CSRF) attacks on state-changing operations.

### Code Snippet:
```typescript
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
```

### Explanation:
- **Lines 5-13**: JSDoc explains the CSRF protection mechanism. "Double Submit Cookie" is OWASP-recommended pattern for stateless CSRF protection.
- **Lines 15-17**: Guard implements `CanActivate` interface. NestJS calls `canActivate()` before executing route handler.
- **Lines 19-26**: Skip CSRF validation for "safe" HTTP methods (GET, HEAD, OPTIONS). These methods should not change server state, so CSRF risk is low.
- **Lines 28-32**: Allow routes to opt-out of CSRF protection using `@SkipCsrf()` decorator. Useful for public webhooks or third-party integrations.
- **Lines 34-38**: Extract CSRF token from two sources:
  - **Cookie** (`csrf-token`): Set by server, readable by client JavaScript (`httpOnly: false`)
  - **Header** (`x-csrf-token`): Client must read cookie value and send it in custom header
- **Lines 40-43**: Double Submit Cookie validation:
  1. Both cookie AND header must exist (if either is missing, request is rejected)
  2. Cookie value MUST exactly match header value
  3. If validation fails, throw `ForbiddenException` (403 status code)
- **Lines 49-51**: Generate cryptographically random CSRF token:
  - `randomBytes(32)`: 32 bytes = 256 bits of entropy (sufficient for CSRF tokens)
  - `.toString('hex')`: Convert to hexadecimal string (64 characters)
- **Lines 58-63**: `@SkipCsrf()` decorator uses Reflect metadata to mark routes that should skip CSRF validation.

### Why This Works:
1. **Attacker Cannot Read Cookie**: Same-origin policy prevents attacker's site from reading victim's cookies
2. **Attacker Cannot Set Header**: Cross-origin requests from attacker's site cannot set custom headers (CORS restriction)
3. **Token Must Match**: Even if attacker guesses cookie value, they cannot set matching header
4. **Stateless**: No server-side session storage needed, token is in cookie

### Attack Scenarios Prevented:
- **Classic CSRF**: Attacker creates malicious form that POSTs to victim site. Attack fails because attacker cannot read CSRF cookie to set header.
- **XSS + CSRF**: If attacker has XSS, they can read cookie AND set header, so CSRF protection is bypassed. But XSS already gives full access, so CSRF protection is moot.
- **Subdomain Attacks**: If attacker controls subdomain (e.g., attacker.example.com), they might set cookie for parent domain. Mitigation: Use `sameSite: strict` cookie attribute.

### Key Takeaways:
- **Double Submit Cookie**: Client must send same token in cookie AND header
- **Stateless**: No server-side token storage, validation is purely comparison
- **Safe Methods Exempted**: GET/HEAD/OPTIONS don't need CSRF protection per HTTP semantics
- **Cryptographically Random**: 256 bits of entropy prevents brute-force guessing
- **Complement to CORS**: CSRF protection works alongside CORS, not replacement
- **XSS is Game Over**: If site has XSS vulnerability, CSRF protection doesn't help

---

## 5. JWT Authentication Guard

**File**: JWT authentication is handled by NestJS Passport integration (Lines N/A - standard library)

**Purpose**: Validate JWT tokens on protected routes and inject user context into request object.

### Code Snippet:
```typescript
// Note: This is standard NestJS Passport JWT strategy configuration
// File: backend/src/common/strategies/jwt.strategy.ts (conceptual, may not exist verbatim)

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Payload contains: { sub: userId, email, roleAdmin, roleCreator, roleSolver }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // This object is assigned to request.user
    return {
      userId: payload.sub,
      email: payload.email,
      roleAdmin: payload.roleAdmin,
      roleCreator: payload.roleCreator,
      roleSolver: payload.roleSolver,
    };
  }
}

// Usage in controllers:
@UseGuards(AuthGuard('jwt'))
@Get('profile')
getProfile(@Req() req: any) {
  // req.user is available here, populated by JwtStrategy.validate()
  return { user: req.user };
}
```

### Explanation:
- **Lines 13-24**: JWT strategy configuration:
  - **Line 20**: `ExtractJwt.fromAuthHeaderAsBearerToken()` extracts JWT from `Authorization: Bearer <token>` header
  - **Line 21**: `ignoreExpiration: false` means expired tokens are rejected (401 error)
  - **Line 22**: `secretOrKey` is the signing secret used to verify JWT signature
- **Lines 26-42**: `validate()` method is called after successful JWT verification:
  - **Line 28**: Load full user from database using user ID from JWT `sub` claim
  - **Lines 30-32**: Double-check user exists and is active. This catches cases where:
    - User was deleted after JWT was issued
    - User was disabled/banned after JWT was issued
    - Database and JWT state are out of sync
  - **Lines 34-41**: Return user context object that gets injected into `request.user`. This is available in all route handlers.
- **Lines 44-49**: Usage pattern - add `@UseGuards(AuthGuard('jwt'))` to any route that requires authentication.

### JWT Validation Flow:
1. **Extract Token**: Passport extracts JWT from Authorization header
2. **Verify Signature**: JWT library verifies HMAC-SHA256 signature using `JWT_SECRET`
3. **Check Expiration**: JWT library checks `exp` claim against current time
4. **Validate User**: Custom `validate()` method checks user still exists and is active
5. **Inject Context**: Passport attaches user object to `request.user`
6. **Execute Handler**: Route handler executes with authenticated user context

### Key Takeaways:
- **Automatic Extraction**: Passport handles token extraction from headers
- **Signature Verification**: Cryptographic verification ensures token wasn't tampered with
- **Expiration Enforcement**: Expired tokens are automatically rejected
- **User Re-validation**: Database check ensures user still exists and is active
- **Context Injection**: `request.user` is automatically populated for route handlers
- **Stateless Authentication**: No server-side session storage needed

**Security Considerations**:
- JWT signature verification prevents token tampering
- Expiration check prevents using old/stolen tokens indefinitely
- Database re-validation catches deleted/disabled users
- No server-side token revocation (would require Redis/database blacklist)

---

## 6. Role-Based Access Control (RBAC)

**File**: [backend/src/common/guards/roles.guard.ts](backend/src/common/guards/roles.guard.ts) (Lines 1-50)

**Purpose**: Enforce role-based authorization on routes using hierarchical role system (admin > creator > solver).

### Code Snippet:
```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Missing user context');
    }

    // Hierarchical roles:
    // - Admin implies creator and solver
    // - Creator implies solver
    // - Solver is solver only
    const userRoles: AppRole[] = [];
    if (user.roleAdmin) {
      userRoles.push('admin', 'creator', 'solver');
    } else if (user.roleCreator) {
      userRoles.push('creator', 'solver');
    } else if (user.roleSolver) {
      userRoles.push('solver');
    }

    const hasRole = requiredRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
```

### Explanation:
- **Lines 5-7**: Guard implements `CanActivate` interface. Executes after authentication but before route handler.
- **Lines 9-13**: Use Reflector to read `@Roles()` decorator metadata from route handler or controller class. This determines which roles are required.
- **Lines 15-17**: If no roles specified, allow access. This makes RolesGuard safe to apply globally without breaking public routes.
- **Lines 19-23**: Extract user from request (populated by JwtStrategy). If user is missing, authentication failed - throw 403.
- **Lines 25-36**: Hierarchical role system implementation:
  - **Admin**: Has all three roles (admin + creator + solver). Full platform access.
  - **Creator**: Has creator + solver roles. Can create scenarios AND attempt challenges.
  - **Solver**: Has only solver role. Can only attempt challenges, not create them.
- **Lines 30-31**: If user is admin, grant all three roles. Admins can access any endpoint.
- **Lines 32-33**: If user is creator (but not admin), grant creator + solver. Creators can access solver endpoints too.
- **Lines 34-35**: If user is only solver, grant only solver role. Cannot access creator/admin endpoints.
- **Line 38**: Check if user has ANY of the required roles (OR logic). For example, if route requires `['admin', 'creator']`, either role is sufficient.
- **Lines 40-42**: If user lacks required roles, throw `ForbiddenException` (403 status). This is different from `UnauthorizedException` (401) which means "not authenticated".

### Usage Pattern:
```typescript
// Example: Creator-only endpoint
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('creator')
@Post('scenarios')
createScenario() {
  // Only creators and admins can access this
  // Solvers get 403 Forbidden
}

// Example: Admin-only endpoint
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Delete('users/:id')
deleteUser() {
  // Only admins can access this
  // Creators and solvers get 403 Forbidden
}

// Example: Multiple allowed roles (OR logic)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'creator')
@Get('scenarios')
listScenarios() {
  // Admins and creators can access
  // Solvers get 403 Forbidden
}
```

### Role Hierarchy Visualization:
```
Admin (roleAdmin=true)
  ├─ Can access @Roles('admin') endpoints
  ├─ Can access @Roles('creator') endpoints (inherited)
  └─ Can access @Roles('solver') endpoints (inherited)

Creator (roleCreator=true)
  ├─ Can access @Roles('creator') endpoints
  └─ Can access @Roles('solver') endpoints (inherited)

Solver (roleSolver=true)
  └─ Can access @Roles('solver') endpoints
```

### Key Takeaways:
- **Hierarchical Roles**: Admin > Creator > Solver, higher roles inherit lower role permissions
- **Declarative Authorization**: Use `@Roles()` decorator to specify required roles at route level
- **Guard Composition**: RolesGuard works with AuthGuard (authentication) for defense in depth
- **Explicit Access Control**: Each route must explicitly specify allowed roles
- **403 vs 401**: Forbidden (403) means "authenticated but not authorized", Unauthorized (401) means "not authenticated"
- **OR Logic**: Route can specify multiple roles, user needs ANY one of them

**Security Considerations**:
- Roles are stored in JWT payload, so role changes require re-login or token refresh
- No dynamic role assignment - roles are static until next login
- Role hierarchy is coded in RolesGuard, not database-driven
- Privilege escalation requires modifying database `roleAdmin`/`roleCreator` columns

---

## Summary

This document covered RangeX's authentication and security implementation:

1. **Authentication Controller**: CSRF token generation, login endpoint with rate limiting, token refresh
2. **Argon2 Password Hashing**: Memory-hard algorithm resistant to GPU cracking, automatic salt generation
3. **JWT Token System**: Dual token strategy (access + refresh), stateless authentication, token rotation
4. **CSRF Protection**: Double Submit Cookie pattern prevents cross-site request forgery
5. **JWT Authentication**: Automatic token extraction, signature verification, user re-validation
6. **Role-Based Access Control**: Hierarchical roles (admin > creator > solver) with declarative authorization

**Security Highlights**:
- **Defense in Depth**: Multiple security layers (rate limiting, CSRF, JWT, RBAC)
- **Industry Best Practices**: Argon2id hashing, JWT tokens, OWASP CSRF pattern
- **Stateless Design**: No server-side session storage for horizontal scalability
- **Explicit Authorization**: Every route requires explicit role declaration
- **Token Rotation**: Refresh tokens are rotated to prevent replay attacks

**Next Steps**: See [CODE_PART3_API_ENDPOINTS.md](CODE_PART3_API_ENDPOINTS.md) for REST API endpoint implementation.
