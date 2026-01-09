import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Badge } from '../entities/badge.entity';
import { BadgeRequirement } from '../entities/badge-requirement.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssetStorageService } from '../services/asset-storage.service';
import * as multer from 'multer';

@Controller('admin/badges')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminBadgeController {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(BadgeRequirement) private readonly requirementRepo: Repository<BadgeRequirement>,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
    private readonly assetStorage: AssetStorageService,
  ) {}

  @Get()
  async listBadges() {
    const badges = await this.badgeRepo.find({ order: { createdAt: 'ASC' } });
    
    // For each badge, get requirements
    const badgesWithRequirements = await Promise.all(
      badges.map(async (badge) => {
        const requirements = await this.requirementRepo.find({
          where: { badgeId: badge.id },
          relations: ['scenario'],
        });
        return { ...badge, requirements };
      })
    );
    
    return badgesWithRequirements;
  }

  @Get(':id')
  async getBadge(@Param('id') id: string) {
    const badge = await this.badgeRepo.findOne({ where: { id } });
    if (!badge) throw new BadRequestException('Badge not found');
    
    const requirements = await this.requirementRepo.find({
      where: { badgeId: id },
      relations: ['scenario'],
    });
    
    return { ...badge, requirements };
  }

  @Post()
  async createBadge(@Body() body: { name: string; description: string; iconUrl?: string; criteria: string }) {
    const badge = this.badgeRepo.create({
      name: body.name,
      description: body.description,
      iconUrl: body.iconUrl || 'https://api.dicebear.com/7.x/icons/svg?seed=badge&icon=shield',
      criteria: body.criteria,
    });
    return this.badgeRepo.save(badge);
  }

  @Put(':id')
  async updateBadge(@Param('id') id: string, @Body() body: { name?: string; description?: string; iconUrl?: string; criteria?: string }) {
    const badge = await this.badgeRepo.findOne({ where: { id } });
    if (!badge) throw new BadRequestException('Badge not found');
    
    if (body.name) badge.name = body.name;
    if (body.description) badge.description = body.description;
    if (body.iconUrl !== undefined) badge.iconUrl = body.iconUrl;
    if (body.criteria) badge.criteria = body.criteria;
    
    return this.badgeRepo.save(badge);
  }

  @Delete(':id')
  async deleteBadge(@Param('id') id: string) {
    console.log(`[AdminBadgeController] ========== DELETE BADGE CALLED ==========`);
    console.log(`[AdminBadgeController] Badge ID: ${id}`);
    
    const badge = await this.badgeRepo.findOne({ where: { id } });
    
    if (!badge) {
      console.log(`[AdminBadgeController] Badge not found with ID: ${id}`);
      await this.badgeRepo.delete(id); // Try to delete anyway in case of orphan
      return { deleted: true };
    }
    
    console.log(`[AdminBadgeController] Badge found:`, {
      id: badge.id,
      name: badge.name,
      iconUrl: badge.iconUrl
    });
    
    // Delete entire badge folder from MinIO if icon exists and it's from our storage
    if (badge.iconUrl && !badge.iconUrl.includes('dicebear.com')) {
      try {
        console.log(`[AdminBadgeController] Icon URL detected (not DiceBear): ${badge.iconUrl}`);
        
        // Delete the entire badges/{badgeId}/ folder
        const folderPrefix = `badges/${badge.id}/`;
        console.log(`[AdminBadgeController] Deleting entire badge folder: ${folderPrefix}`);
        
        await this.assetStorage.deleteFolder(folderPrefix);
        
        console.log(`[AdminBadgeController] ✅ Successfully deleted badge folder from MinIO: ${folderPrefix}`);
      } catch (err) {
        console.error('[AdminBadgeController] ❌ Error deleting badge folder from MinIO:', err);
        if (err instanceof Error) {
          console.error('[AdminBadgeController] Error stack:', err.stack);
        }
        // Continue with badge deletion even if folder deletion fails
      }
    } else {
      console.log(`[AdminBadgeController] No custom icon to delete (iconUrl: ${badge.iconUrl || 'null'})`);
    }
    
    console.log(`[AdminBadgeController] Deleting badge from database: ${id}`);
    await this.badgeRepo.delete(id);
    console.log(`[AdminBadgeController] ✅ Badge deleted successfully from database`);
    console.log(`[AdminBadgeController] ========== DELETE BADGE COMPLETED ==========`);
    
    return { deleted: true };
  }

  @Post(':id/upload-icon')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid file type. Only images allowed.'), false);
        }
      },
    }),
  )
  async uploadIcon(@UploadedFile() file: Express.Multer.File, @Param('id') id: string) {
    console.log(`[AdminBadgeController] uploadIcon called - badgeId: ${id}, fileSize: ${file?.size}, mimeType: ${file?.mimetype}`);
    const badge = await this.badgeRepo.findOne({ where: { id } });
    if (!badge) throw new BadRequestException('Badge not found');

    // Delete old icon if exists and it's from our storage
    if (badge.iconUrl) {
      try {
        console.log('[AdminBadgeController] Badge has existing icon:', badge.iconUrl);
        // Extract the object path from the URL
        // URL format: /api/assets/file/{key} where {key} is the MinIO object path
        const match = badge.iconUrl.match(/\/api\/assets\/file\/(.+?)(\?|$)/);
        if (match) {
          const objectPath = match[1]; // Everything after /api/assets/file/ and before ? (if any)
          console.log(`[AdminBadgeController] ========== DELETING OLD BADGE ICON ==========`);
          console.log(`[AdminBadgeController] Deleting old icon from MinIO: ${objectPath}`);
          await this.assetStorage.delete(objectPath);
          console.log(`[AdminBadgeController] Old icon deleted successfully`);
        } else {
          console.log('[AdminBadgeController] Could not parse icon URL for deletion:', badge.iconUrl);
        }
      } catch (err) {
        console.error('[AdminBadgeController] Error deleting old icon:', err);
        // Continue with upload even if deletion fails
      }
    } else {
      console.log('[AdminBadgeController] No existing icon to delete (using default DiceBear)');
    }

    // Upload new icon with organized path: badges/{badgeId}/icon.{ext}
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    // Validate extension matches MIME type
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    const validExt = mimeToExt[file.mimetype] || ext;
    const objectPath = `badges/${id}/icon.${validExt}`;
    const result = await this.assetStorage.storeWithPath(file, objectPath);
    // Add timestamp for cache busting
    badge.iconUrl = `${result.url}?t=${Date.now()}`;
    await this.badgeRepo.save(badge);

    return { iconUrl: badge.iconUrl };
  }

  // Badge Requirements Management
  @Post(':badgeId/requirements')
  async addRequirement(@Param('badgeId') badgeId: string, @Body() body: { scenarioId: string }) {
    const requirement = this.requirementRepo.create({
      badgeId,
      scenarioId: body.scenarioId,
      requirementType: 'scenario_completion',
    });
    return this.requirementRepo.save(requirement);
  }

  @Delete('requirements/:requirementId')
  async deleteRequirement(@Param('requirementId') requirementId: string) {
    await this.requirementRepo.delete(requirementId);
    return { deleted: true };
  }

  // Grant badge to user manually
  @Post(':badgeId/grant/:userId')
  async grantBadge(@Param('badgeId') badgeId: string, @Param('userId') userId: string) {
    const existing = await this.userBadgeRepo.findOne({ where: { userId, badgeId } });
    if (existing) throw new BadRequestException('User already has this badge');

    const userBadge = this.userBadgeRepo.create({ userId, badgeId });
    return this.userBadgeRepo.save(userBadge);
  }

  // Get user's badge progress
  @Get('progress/:userId')
  async getUserBadgeProgress(@Param('userId') userId: string) {
    const badges = await this.badgeRepo.find({ order: { createdAt: 'ASC' } });
    
    const progress = await Promise.all(
      badges.map(async (badge) => {
        const requirements = await this.requirementRepo.find({
          where: { badgeId: badge.id },
          relations: ['scenario'],
        });

        const hasEarned = await this.userBadgeRepo.findOne({ where: { userId, badgeId: badge.id } });
        
        // Check completion status for each requirement
        const requirementProgress = await Promise.all(
          requirements.map(async (req) => {
            if (req.scenarioId) {
              const completed = await this.sessionRepo.findOne({
                where: {
                  userId,
                  scenarioVersionId: req.scenarioId,
                  status: 'terminated',
                },
              });
              return {
                scenarioId: req.scenarioId,
                scenarioName: req.scenario?.title || 'Unknown Scenario',
                completed: !!completed,
              };
            }
            return null;
          })
        );

        return {
          badge,
          requirements: requirementProgress.filter(r => r !== null),
          earned: !!hasEarned,
          earnedAt: hasEarned?.earnedAt,
        };
      })
    );
    
    return progress;
  }
}
