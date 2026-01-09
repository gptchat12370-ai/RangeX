import { Body, Controller, Get, Post, UseGuards, Req, BadRequestException, UseInterceptors, UploadedFile, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '../entities/user.entity';
import { IsOptional, IsString, Length, IsNotEmpty, MinLength } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as argon2 from 'argon2';
import * as multer from 'multer';
import { AssetStorageService } from '../services/asset-storage.service';
import { UserBadge } from '../entities/user-badge.entity';
import { Badge } from '../entities/badge.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { BadgeRequirement } from '../entities/badge-requirement.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(12)
  newPassword: string;
}

class Enable2FADto {
  @IsNotEmpty()
  @IsString()
  code: string;
}

@Controller('account')
@UseGuards(AuthGuard('jwt'))
export class AccountController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly assetStorage: AssetStorageService,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(BadgeRequirement) private readonly requirementRepo: Repository<BadgeRequirement>,
    @InjectRepository(ScenarioVersion) private readonly versionRepo: Repository<ScenarioVersion>,
  ) {}

  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    
    // Calculate points - ONLY count highest score per unique scenario
    // This prevents loop farming: if user does same challenge 3 times (30, 50, 70 points),
    // they only get 70 points total for that challenge
    const sessionScores = await this.sessionRepo
      .createQueryBuilder('session')
      .select('session.scenarioVersionId', 'scenarioVersionId')
      .addSelect('MAX(session.score)', 'maxScore')
      .where('session.userId = :userId', { userId })
      .andWhere('session.status = :status', { status: 'terminated' })
      .groupBy('session.scenarioVersionId')
      .getRawMany();
    
    const pointsTotal = sessionScores.reduce((sum, s) => sum + (parseInt(s.maxScore) || 0), 0);
    const challengesCompleted = sessionScores.length; // Count unique scenarios completed
    
    // Auto-grant badges based on challenges completed
    await this.checkAndGrantBadges(userId, challengesCompleted);
    
    // Get user badges
    const userBadges = await this.userBadgeRepo.find({
      where: { userId },
      relations: ['badge'],
    });
    
    // Get user session history including active sessions
    const sessions = await this.sessionRepo.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      take: 20,
    });
    
    // Load scenario versions for the sessions
    const scenarioVersionIds = sessions.map(s => s.scenarioVersionId);
    const versions = await this.versionRepo.find({
      where: scenarioVersionIds.map(id => ({ id })) as any,
      relations: ['scenario'],
    });
    const versionMap = new Map(versions.map(v => [v.id, v]));
    
    const history = sessions.map(session => {
      const version = versionMap.get(session.scenarioVersionId);
      
      // Map database session status to frontend status
      let frontendStatus: string;
      if (session.status === 'running' || session.status === 'starting') {
        frontendStatus = 'In Progress';
      } else if (session.status === 'terminated' || session.status === 'stopping') {
        frontendStatus = 'Completed';
      } else {
        frontendStatus = 'Completed'; // Default for error/unknown states
      }
      
      return {
        scenarioId: session.scenarioVersionId,
        sessionId: session.id,
        title: version?.title || 'Unknown',
        owner: version?.scenario?.createdByUserId || 'Unknown',
        mode: 'solo' as const,
        durationMinutes: version?.estimatedMinutes || 90,
        status: frontendStatus,
        startedAt: session.startedAt?.toISOString() || new Date().toISOString(),
        finishedAt: session.stoppedAt?.toISOString(),
        score: session.score || 0,
        currentScore: session.score || 0, // Add currentScore for dashboard display
        progressPct: session.status === 'terminated' ? 100 : Math.min(95, Math.floor((session.score || 0) / 10)), // Estimate progress from score
        eventId: session.eventId, // Include eventId so frontend can filter event sessions
        remainingSeconds: session.status === 'running' && session.startedAt 
          ? Math.max(0, ((version?.estimatedMinutes || 90) * 60) - Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
          : null,
      };
    });
    
    const { passwordHash, twofaSecret, ...safe } = user as any;
    return {
      ...safe,
      badges: userBadges.map(ub => ub.badge),
      pointsTotal,
      challengesCompleted,
      history,
    };
  }

  private async checkAndGrantBadges(userId: string, challengesCompleted: number) {
    // Get all badges
    const badges = await this.badgeRepo.find();

    for (const badge of badges) {
      // Check if user already has this badge
      const existing = await this.userBadgeRepo.findOne({ where: { userId, badgeId: badge.id } });
      if (existing) continue; // Skip if already earned

      // Get requirements for this badge
      const requirements = await this.requirementRepo.find({
        where: { badgeId: badge.id },
      });

      if (requirements.length === 0) {
        // Old system: count-based badges
        const criteriaMatch = badge.criteria?.match(/(\d+)\s*challenges?/i);
        if (criteriaMatch) {
          const requiredCount = parseInt(criteriaMatch[1]);
          if (challengesCompleted >= requiredCount) {
            // Grant badge
            const userBadge = this.userBadgeRepo.create({ userId, badgeId: badge.id });
            await this.userBadgeRepo.save(userBadge);
          }
        }
      } else {
        // New system: scenario-specific requirements
        let allRequirementsMet = true;

        for (const req of requirements) {
          if (req.scenarioId) {
            const completed = await this.sessionRepo.findOne({
              where: {
                userId,
                scenarioVersionId: req.scenarioId,
                status: 'terminated',
              },
            });

            if (!completed) {
              allRequirementsMet = false;
              break;
            }
          }
        }

        if (allRequirementsMet && requirements.length > 0) {
          // Grant badge
          const userBadge = this.userBadgeRepo.create({ userId, badgeId: badge.id });
          await this.userBadgeRepo.save(userBadge);
        }
      }
    }
  }

  @Post('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.sub || req.user?.userId;
    const dto = plainToInstance(UpdateProfileDto, body);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    if (dto.displayName) user.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    await this.userRepo.save(user);
    const { passwordHash, twofaSecret, ...safe } = user as any;
    return safe;
  }

  @Post('upload-avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
        }
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    console.log('[AccountController] uploadAvatar called - userId:', req.user.userId, 'fileSize:', file?.size, 'mimeType:', file?.mimetype);
    if (!file) throw new BadRequestException('No file uploaded');
    const user = await this.userRepo.findOne({ where: { id: req.user.userId } });
    if (!user) throw new NotFoundException('User not found');

    // Delete old avatar if exists and it's from our storage
    if (user.avatarUrl && !user.avatarUrl.includes('dicebear.com')) {
      try {
        console.log('[AccountController] User has existing avatar:', user.avatarUrl);
        // Extract the object path from the URL
        // URL format: /api/assets/file/{key} where {key} is the MinIO object path
        const match = user.avatarUrl.match(/\/api\/assets\/file\/(.+?)(\?|$)/);
        if (match) {
          const objectPath = match[1]; // Everything after /api/assets/file/ and before ? (if any)
          console.log(`[AccountController] ========== DELETING OLD AVATAR ==========`);
          console.log(`[AccountController] Deleting old avatar from MinIO: ${objectPath}`);
          await this.assetStorage.delete(objectPath);
          console.log(`[AccountController] Old avatar deleted successfully`);
        } else {
          console.log('[AccountController] Could not parse avatar URL for deletion:', user.avatarUrl);
        }
      } catch (err) {
        console.error('[AccountController] Error deleting old avatar:', err);
        // Continue with upload even if deletion fails
      }
    } else {
      console.log('[AccountController] No existing custom avatar to delete (using DiceBear or none)');
    }

    // Upload new avatar with organized path: users/{userId}/avatar.{ext}
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    // Validate extension matches MIME type
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    const validExt = mimeToExt[file.mimetype] || ext;
    const objectPath = `users/${req.user.userId}/avatar.${validExt}`;
    console.log('[AccountController] Uploading avatar to path:', objectPath);
    const result = await this.assetStorage.storeWithPath(file, objectPath);
    // Add timestamp for cache busting
    user.avatarUrl = `${result.url}?t=${Date.now()}`;
    console.log('[AccountController] Avatar uploaded successfully, URL:', user.avatarUrl);
    await this.userRepo.save(user);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @Post('change-password')
  async changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    const userId = req.user?.sub || req.user?.userId;
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'email', 'passwordHash'] });
    if (!user) throw new BadRequestException('User not found');

    // Verify current password
    const isValid = await argon2.verify(user.passwordHash, body.currentPassword);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    // Validate new password strength
    const validations = {
      length: body.newPassword.length >= 12,
      uppercase: /[A-Z]/.test(body.newPassword),
      lowercase: /[a-z]/.test(body.newPassword),
      number: /[0-9]/.test(body.newPassword),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(body.newPassword),
    };

    if (!validations.length || !validations.uppercase || !validations.lowercase || !validations.number || !validations.special) {
      throw new BadRequestException('Password must be at least 12 characters and contain uppercase, lowercase, number, and special character');
    }

    // Hash and save new password
    user.passwordHash = await argon2.hash(body.newPassword);
    user.passwordUpdatedAt = new Date();
    await this.userRepo.save(user);

    return { success: true, message: 'Password updated successfully' };
  }

  @Post('2fa/enable')
  async enable2FA(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // In production, this would be sent via email/SMS
    return { code, message: 'Verification code generated' };
  }

  @Post('2fa/verify')
  async verify2FA(@Req() req: any, @Body() body: Enable2FADto) {
    const userId = req.user?.sub || req.user?.userId;
    // In production, verify the code against stored value
    // For now, just enable 2FA
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    
    // Store 2FA secret (in production, this would be a real TOTP secret)
    user.twofaSecret = 'enabled';
    await this.userRepo.save(user);

    return { success: true, message: 'Two-factor authentication enabled' };
  }

  @Post('2fa/disable')
  async disable2FA(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    
    user.twofaSecret = null;
    await this.userRepo.save(user);

    return { success: true, message: 'Two-factor authentication disabled' };
  }

  @Get('badges')
  async getMyBadges(@Req() req: any) {
    const userId = req.user.sub;
    return this.userBadgeRepo.find({ where: { userId }, relations: ['badge'] });
  }
}
