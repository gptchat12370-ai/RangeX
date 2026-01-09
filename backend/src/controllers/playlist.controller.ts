import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistItem } from '../entities/playlist-item.entity';
import { ScenarioVersion, ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('creator/playlists')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('solver', 'creator', 'admin')
export class PlaylistController {
  constructor(
    @InjectRepository(Playlist)
    private readonly repo: Repository<Playlist>,
    @InjectRepository(PlaylistItem)
    private readonly itemRepo: Repository<PlaylistItem>,
    @InjectRepository(ScenarioVersion)
    private readonly versionRepo: Repository<ScenarioVersion>,
  ) {}

  /**
   * Normalizes cover image URL from MinIO format to assets API format
   * and provides fallback if no cover is available
   */
  private normalizeCoverImageUrl(url: string | null | undefined): string {
    if (!url) {
      return '/api/assets/file/defaults/playlist-cover.png';
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
    return '/api/assets/file/defaults/playlist-cover.png';
  }

  @Get()
  async list(@Request() req: any) {
    const userId = req.user?.userId;
    // Return public playlists OR playlists owned by the current user
    const playlists = await this.repo.find({ relations: ['items'] });
    
    // Filter out items with hidden/archived scenarios
    for (const playlist of playlists) {
      if (playlist.items && playlist.items.length > 0) {
        // Get all scenario version IDs
        const scenarioIds = playlist.items.map(it => it.scenarioVersionId);
        
        // Query visible scenarios (published and not archived)
        const visibleScenarios = await this.versionRepo.find({
          where: scenarioIds.map(id => ({ id, status: ScenarioVersionStatus.PUBLISHED as const, isArchived: false })),
        });
        
        const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
        
        // Filter items to only include those with visible scenarios
        playlist.items = playlist.items.filter(item => visibleScenarioIds.has(item.scenarioVersionId));
        
        // If no visible items remain, use fallback cover
        if (playlist.items.length === 0) {
          playlist.coverImageUrl = this.normalizeCoverImageUrl(null);
        } else {
          // Always use first scenario's cover (sorted by sortOrder)
          const firstItem = playlist.items.sort((a, b) => a.sortOrder - b.sortOrder)[0];
          const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
          playlist.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
        }
      } else {
        // Normalize cover image URL even if no items
        playlist.coverImageUrl = this.normalizeCoverImageUrl(playlist.coverImageUrl);
      }
    }
    
    return playlists.filter(p => p.isPublic || p.ownerUserId === userId);
  }

  @Get('ensure-favorites/:userId')
  async ensureFavorites(@Param('userId') userId: string) {
    // Check if Favorites already exists (case-insensitive)
    const existing = await this.repo
      .createQueryBuilder('playlist')
      .where('LOWER(playlist.title) = :title', { title: 'favorites' })
      .andWhere('playlist.ownerUserId = :userId', { userId })
      .leftJoinAndSelect('playlist.items', 'items')
      .getOne();
    
    if (existing) {
      return existing;
    }
    
    // Create new Favorites playlist
    const favorites = this.repo.create({
      title: 'Favorites',
      description: 'My favorite challenges',
      isPublic: false,
      ownerUserId: userId,
    });
    return await this.repo.save(favorites);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const playlist = await this.repo.findOne({ where: { id }, relations: ['items'] });
    if (!playlist) return null;
    
    // Filter out items with hidden/archived scenarios
    if (playlist.items && playlist.items.length > 0) {
      const scenarioIds = playlist.items.map(it => it.scenarioVersionId);
      
      // Query visible scenarios (published only, and not archived)
      const visibleScenarios = await this.versionRepo
        .createQueryBuilder('version')
        .where('version.id IN (:...ids)', { ids: scenarioIds })
        .andWhere('version.status IN (:...statuses)', { 
          statuses: [ScenarioVersionStatus.PUBLISHED] 
        })
        .andWhere('version.isArchived = :isArchived', { isArchived: false })
        .getMany();
      
      const visibleScenarioIds = new Set(visibleScenarios.map(s => s.id));
      
      // Filter items to only include those with visible scenarios
      playlist.items = playlist.items.filter(item => visibleScenarioIds.has(item.scenarioVersionId));
      
      // If no visible items remain, use fallback cover
      if (playlist.items.length === 0) {
        playlist.coverImageUrl = this.normalizeCoverImageUrl(null);
      } else {
        // Always use first scenario's cover (sorted by sortOrder)
        const firstItem = playlist.items.sort((a, b) => a.sortOrder - b.sortOrder)[0];
        const firstScenario = visibleScenarios.find(s => s.id === firstItem.scenarioVersionId);
        playlist.coverImageUrl = this.normalizeCoverImageUrl(firstScenario?.coverImageUrl);
      }
    } else {
      // Normalize cover image URL even if no items
      playlist.coverImageUrl = this.normalizeCoverImageUrl(playlist.coverImageUrl);
    }
    
    return playlist;
  }
  @Post()
  async create(@Body() body: Partial<Playlist>, @Request() req: any) {
    console.log('[PlaylistController] CREATE called');
    console.log('[PlaylistController] body.items:', body.items);
    
    const playlist = this.repo.create({
      title: body.title || 'Untitled Playlist',
      description: body.description || '',
      isPublic: !!body.isPublic,
      ownerUserId: req.user.userId, // Use authenticated user ID from JWT
    });
    const saved = await this.repo.save(playlist);
    
    // Create playlist items directly
    if (body.items?.length) {
      const items = body.items.map((it, idx) => 
        this.itemRepo.create({
          playlistId: saved.id,
          scenarioVersionId: it.scenarioVersionId,
          sortOrder: it.sortOrder ?? idx,
        })
      );
      await this.itemRepo.save(items);
      console.log('[PlaylistController] Created', items.length, 'playlist items');
      
      // Auto-set cover from first visible scenario if no cover is set
      if (!saved.coverImageUrl && items.length > 0) {
        const firstScenario = await this.versionRepo.findOne({
          where: { id: items[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
        });
        if (firstScenario?.coverImageUrl) {
          await this.repo.update(saved.id, { coverImageUrl: firstScenario.coverImageUrl });
          saved.coverImageUrl = firstScenario.coverImageUrl; // Update in-memory object
        }
      }
    }
    
    return this.repo.findOne({ where: { id: saved.id }, relations: ['items'] });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<Playlist>, @Request() req: any) {
    console.log('[PlaylistController] UPDATE called for ID:', id);
    console.log('[PlaylistController] body:', JSON.stringify(body, null, 2));
    console.log('[PlaylistController] body.items:', body.items);
    
    await this.repo.update(id, {
      title: body.title,
      description: body.description,
      isPublic: body.isPublic,
      // Don't allow changing owner
    });
    // Optional: replace items
    if (body.items) {
      console.log('[PlaylistController] Deleting existing items for playlist:', id);
      await this.repo.query('DELETE FROM playlist_item WHERE playlistId = ?', [id]);
      const insertValues = body.items.map((it: any, idx: number) => ({
        playlistId: id,
        scenarioVersionId: it.scenarioVersionId,
        sortOrder: it.sortOrder ?? idx,
      }));
      console.log('[PlaylistController] Inserting new items:', JSON.stringify(insertValues, null, 2));
      if (insertValues.length) {
        await this.repo
          .createQueryBuilder()
          .insert()
          .into('playlist_item')
          .values(insertValues as any)
          .execute();
      }
    } else {
      console.log('[PlaylistController] No items in body, skipping item update');
    }
    const result = await this.repo.findOne({ where: { id }, relations: ['items'] });
    console.log('[PlaylistController] Returning playlist with items count:', result?.items?.length);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  @Post('backfill-covers')
  @Roles('admin')
  async backfillCovers() {
    // Get all playlists without covers
    const playlists = await this.repo.find({
      where: { coverImageUrl: null as any },
      relations: ['items'],
    });

    let updated = 0;
    for (const playlist of playlists) {
      if (playlist.items && playlist.items.length > 0) {
        // Sort by sortOrder
        const sortedItems = [...playlist.items].sort((a, b) => a.sortOrder - b.sortOrder);
        
        // Find first visible scenario
        const firstScenario = await this.versionRepo.findOne({
          where: { id: sortedItems[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
        });
        
        if (firstScenario?.coverImageUrl) {
          await this.repo.update(playlist.id, { coverImageUrl: firstScenario.coverImageUrl });
          updated++;
        }
      }
    }

    return { success: true, updated };
  }

  @Post(':id/items')
  async replaceItems(@Param('id') id: string, @Body() body: { items: { scenarioVersionId: string; sortOrder?: number }[] }) {
    console.log('[PlaylistController] REPLACE ITEMS called for ID:', id);
    console.log('[PlaylistController] items:', JSON.stringify(body.items, null, 2));
    
    await this.itemRepo.delete({ playlistId: id });
    const toInsert = (body.items || []).map((it, idx) =>
      this.itemRepo.create({
        playlistId: id,
        scenarioVersionId: it.scenarioVersionId,
        sortOrder: it.sortOrder ?? idx,
      }),
    );
    console.log('[PlaylistController] Creating items:', toInsert.length);
    if (toInsert.length) {
      const saved = await this.itemRepo.save(toInsert);
      console.log('[PlaylistController] Saved items:', saved.length);
      
      // Auto-set cover from first visible scenario if playlist has no cover
      const playlist = await this.repo.findOne({ where: { id } });
      if (!playlist?.coverImageUrl && toInsert.length > 0) {
        const firstScenario = await this.versionRepo.findOne({
          where: { id: toInsert[0].scenarioVersionId, status: ScenarioVersionStatus.PUBLISHED, isArchived: false },
        });
        if (firstScenario?.coverImageUrl) {
          await this.repo.update(id, { coverImageUrl: firstScenario.coverImageUrl });
        }
      }
    }
    // Reload to get updated coverImageUrl
    const result = await this.repo.findOne({ where: { id }, relations: ['items'] });
    console.log('[PlaylistController] Returning playlist with items count:', result?.items?.length);
    return result;
  }
}
