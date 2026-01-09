import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/guards/roles.decorator';
import { CareerPath } from '../entities/career-path.entity';
import { CareerPathItem } from '../entities/career-path-item.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';

@Controller('creator/career-paths')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('solver', 'creator', 'admin')
export class CareerPathController {
  constructor(
    @InjectRepository(CareerPath) private readonly cpRepo: Repository<CareerPath>,
    @InjectRepository(CareerPathItem) private readonly itemRepo: Repository<CareerPathItem>,
    @InjectRepository(ScenarioVersion) private readonly versionRepo: Repository<ScenarioVersion>,
  ) {}

  /**
   * Normalizes cover image URL from MinIO format to assets API format
   * and provides fallback if no cover is available
   */
  private normalizeCoverImageUrl(url: string | null | undefined): string {
    if (!url) {
      return '/api/assets/file/defaults/career-path-cover.png';
    }
    
    // If already in assets API format, return as-is
    if (url.startsWith('/api/assets/file/')) {
      return url;
    }
    
    // Convert MinIO direct URL to assets API format
    // Format: http://localhost:9000/rangex-assets/path/to/file.png
    // Target: /api/assets/file/path/to/file.png
    const match = url.match(/\/rangex-assets\/(.+?)(\?|$)/);
    if (match) {
      return `/api/assets/file/${match[1]}`;
    }
    
    // If format is unknown, return fallback
    return '/api/assets/file/defaults/career-path-cover.png';
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.sub;
    // Return public career paths OR career paths owned by the current user
    const careerPaths = await this.cpRepo.find({ relations: ['items'] });
    
    // Filter out items with hidden/archived scenarios
    for (const cp of careerPaths) {
      if (cp.items && cp.items.length > 0) {
        // Get all scenario version IDs
        const scenarioIds = cp.items.map(it => it.scenarioVersionId);
        
        // Query visible scenarios (published and not archived)
        const visibleScenarios = await this.versionRepo.find({
          where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
        });
        
        const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
        
        // Filter items to only include those with visible scenarios
        cp.items = cp.items.filter(item => visibleScenarioIds.has(item.scenarioVersionId));
        
        // If no visible items remain, use fallback cover
        if (cp.items.length === 0) {
          cp.coverImageUrl = this.normalizeCoverImageUrl(null);
        } else {
          // Always use first scenario's cover (sorted by sortOrder)
          const firstItem = cp.items.sort((a, b) => a.sortOrder - b.sortOrder)[0];
          const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
          cp.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
        }
      } else {
        // Normalize cover image URL even if no items
        cp.coverImageUrl = this.normalizeCoverImageUrl(cp.coverImageUrl);
      }
    }
    
    return careerPaths.filter(cp => cp.isPublic || cp.ownerUserId === userId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    const path = await this.cpRepo.findOne({ where: { id }, relations: ['items'] });
    if (!path) return null;
    if (path.ownerUserId && path.ownerUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    
    // Filter out items with hidden/archived scenarios
    if (path.items && path.items.length > 0) {
      const scenarioIds = path.items.map(it => it.scenarioVersionId);
      
      // Query visible scenarios (published and not archived)
      const visibleScenarios = await this.versionRepo.find({
        where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
      });
      
      const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
      
      // Filter items to only include those with visible scenarios
      path.items = path.items.filter(item => visibleScenarioIds.has(item.scenarioVersionId));
      
      // If no visible items remain, use fallback cover
      if (path.items.length === 0) {
        path.coverImageUrl = this.normalizeCoverImageUrl(null);
      } else {
        // Always use first scenario's cover (sorted by sortOrder)
        const firstItem = path.items.sort((a, b) => a.sortOrder - b.sortOrder)[0];
        const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
        path.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
      }
    } else {
      // Normalize cover image URL even if no items
      path.coverImageUrl = this.normalizeCoverImageUrl(path.coverImageUrl);
    }
    
    return path;
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      isPublic?: boolean;
      items?: { scenarioVersionId: string; sortOrder?: number }[];
    },
    @Req() req: any,
  ) {
    const owner = req.user?.sub;
    const cp = this.cpRepo.create({
      title: body.title || 'Untitled Career Path',
      description: body.description || '',
      isPublic: body.isPublic !== undefined ? !!body.isPublic : true, // Default to public
      ownerUserId: owner,
    });
    const saved = await this.cpRepo.save(cp);
    if (body.items?.length) {
      const toInsert = body.items.map((it, idx) =>
        this.itemRepo.create({
          careerPathId: saved.id,
          scenarioVersionId: it.scenarioVersionId,
          sortOrder: it.sortOrder ?? idx,
        }),
      );
      await this.itemRepo.save(toInsert);
      
      // Auto-set cover from first visible scenario if no cover is set
      const firstScenario = await this.versionRepo.findOne({
        where: { id: toInsert[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
      });
      if (firstScenario?.coverImageUrl) {
        await this.cpRepo.update(saved.id, { coverImageUrl: firstScenario.coverImageUrl });
        saved.coverImageUrl = firstScenario.coverImageUrl; // Update in-memory object
      }
    }
    // Reload to ensure we have the latest data
    return this.cpRepo.findOne({ where: { id: saved.id }, relations: ['items'] });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CareerPath & { items?: { scenarioVersionId: string; sortOrder?: number }[] }>,
    @Req() req: any,
  ) {
    const cp = await this.cpRepo.findOne({ where: { id } });
    if (!cp) return null;
    if (cp.ownerUserId && cp.ownerUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    await this.cpRepo.update(id, {
      title: body.title ?? cp.title,
      description: body.description ?? cp.description,
      isPublic: body.isPublic ?? cp.isPublic,
      updatedAt: new Date(),
    });
    if (body.items) {
      await this.itemRepo.delete({ careerPathId: id });
      const toInsert = body.items.map((it, idx) =>
        this.itemRepo.create({
          careerPathId: id,
          scenarioVersionId: it.scenarioVersionId,
          sortOrder: it.sortOrder ?? idx,
        }),
      );
      if (toInsert.length) {
        await this.itemRepo.save(toInsert);
        
        // Auto-set cover from first visible scenario if no cover is currently set
        if (!cp.coverImageUrl) {
          const firstScenario = await this.versionRepo.findOne({
            where: { id: toInsert[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
          });
          if (firstScenario?.coverImageUrl) {
            await this.cpRepo.update(id, { coverImageUrl: firstScenario.coverImageUrl });
          }
        }
      }
    }
    // Reload to get updated coverImageUrl
    return this.cpRepo.findOne({ where: { id }, relations: ['items'] });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const cp = await this.cpRepo.findOne({ where: { id } });
    if (!cp) return { success: true };
    if (cp.ownerUserId && cp.ownerUserId !== req.user?.sub) {
      throw new ForbiddenException('Not allowed');
    }
    await this.cpRepo.delete(id);
    return { success: true };
  }

  @Post('backfill-covers')
  @Roles('admin')
  async backfillCovers() {
    // Get all career paths without covers
    const careerPaths = await this.cpRepo.find({
      where: { coverImageUrl: null as any },
      relations: ['items'],
    });

    let updated = 0;
    for (const cp of careerPaths) {
      if (cp.items && cp.items.length > 0) {
        // Sort by sortOrder
        const sortedItems = [...cp.items].sort((a, b) => a.sortOrder - b.sortOrder);
        
        // Find first visible scenario
        const firstScenario = await this.versionRepo.findOne({
          where: { id: sortedItems[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
        });
        
        if (firstScenario?.coverImageUrl) {
          await this.cpRepo.update(cp.id, { coverImageUrl: firstScenario.coverImageUrl });
          updated++;
        }
      }
    }

    return { success: true, updated };
  }
}
