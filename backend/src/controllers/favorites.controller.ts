import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { UserFavorite } from '../entities/user-favorite.entity';
import { Scenario } from '../entities/scenario.entity';
import { ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistItem } from '../entities/playlist-item.entity';
import { v4 as uuidv4 } from 'uuid';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(
    @InjectRepository(UserFavorite)
    private favoritesRepo: Repository<UserFavorite>,
    @InjectRepository(Scenario)
    private scenarioRepo: Repository<Scenario>,
    @InjectRepository(Playlist)
    private playlistRepo: Repository<Playlist>,
    @InjectRepository(PlaylistItem)
    private playlistItemRepo: Repository<PlaylistItem>,
  ) {}

  @Post(':scenarioId')
  async addFavorite(@Param('scenarioId') scenarioId: string, @Request() req: any) {
    const userId = req.user.userId;
    console.log('[FavoritesController] ADD FAVORITE called');
    console.log('[FavoritesController] userId:', userId);
    console.log('[FavoritesController] scenarioId:', scenarioId);
    
    try {
      // Check if already favorited
      const existing = await this.favoritesRepo.findOne({
        where: { userId, scenarioId },
      });
      
      if (existing) {
        console.log('[FavoritesController] Already favorited');
        return { success: true, message: 'Already favorited' };
      }

      const favorite = this.favoritesRepo.create({
        id: uuidv4(),
        userId,
        scenarioId,
      });
      
      await this.favoritesRepo.save(favorite);
      console.log('[FavoritesController] Saved to user_favorite table');
      
      // Also add to Favorites playlist (ensure it exists first)
      let favPlaylist = await this.playlistRepo
        .createQueryBuilder('p')
        .where('LOWER(p.title) = :title', { title: 'favorites' })
        .andWhere('p.ownerUserId = :userId', { userId })
        .leftJoinAndSelect('p.items', 'items')
        .getOne();
      
      if (!favPlaylist) {
        console.log('[FavoritesController] Favorites playlist not found, creating it');
        favPlaylist = this.playlistRepo.create({
          id: uuidv4(),
          title: 'Favorites',
          description: 'My favorite challenges',
          isPublic: false,
          ownerUserId: userId,
        });
        favPlaylist = await this.playlistRepo.save(favPlaylist);
        console.log('[FavoritesController] Created Favorites playlist:', favPlaylist.id);
      } else {
        console.log('[FavoritesController] Found Favorites playlist:', favPlaylist.id);
        console.log('[FavoritesController] Existing items count:', favPlaylist.items?.length || 0);
      }
      
      // Check if already in playlist
      const existingItem = await this.playlistItemRepo.findOne({
        where: {
          playlistId: favPlaylist.id,
          scenarioVersionId: scenarioId,
        },
      });
      
      if (!existingItem) {
        const playlistItem = this.playlistItemRepo.create({
          id: uuidv4(),
          playlistId: favPlaylist.id,
          scenarioVersionId: scenarioId,
          sortOrder: (favPlaylist.items?.length || 0),
        });
        const savedItem = await this.playlistItemRepo.save(playlistItem);
        console.log('[FavoritesController] Added to Favorites playlist, item ID:', savedItem.id);
      } else {
        console.log('[FavoritesController] Already in Favorites playlist');
      }
      
      return { success: true, message: 'Added to favorites' };
    } catch (error) {
      console.error('[FavoritesController] Error adding favorite:', error);
      throw error;
    }
  }

  @Delete(':scenarioId')
  async removeFavorite(@Param('scenarioId') scenarioId: string, @Request() req: any) {
    const userId = req.user.userId;
    
    // Remove from user_favorite table
    const result = await this.favoritesRepo.delete({ userId, scenarioId });
    
    // Also remove from Favorites playlist if exists
    const favPlaylist = await this.playlistRepo
      .createQueryBuilder('p')
      .where('LOWER(p.title) = :title', { title: 'favorites' })
      .andWhere('p.ownerUserId = :userId', { userId })
      .getOne();
    
    if (favPlaylist) {
      await this.playlistItemRepo.delete({
        playlistId: favPlaylist.id,
        scenarioVersionId: scenarioId,
      });
    }
    
    return {
      success: true,
      message: (result.affected ?? 0) > 0 ? 'Removed from favorites' : 'Not in favorites',
    };
  }

  @Get()
  async listFavorites(@Request() req: any) {
    const userId = req.user.userId;
    
    const favorites = await this.favoritesRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    
    const scenarioIds = favorites.map(f => f.scenarioId);
    
    if (scenarioIds.length === 0) {
      return [];
    }
    
    const scenarios = await this.scenarioRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.versions', 'v', 'v.status = :status', { status: ScenarioVersionStatus.APPROVED })
      .where('s.id IN (:...ids)', { ids: scenarioIds })
      .getMany();
    
    return scenarios.map(s => ({
      id: s.id,
      slug: s.slug,
      title: s.versions?.[0]?.title || 'Untitled',
      shortDescription: s.versions?.[0]?.shortDescription || '',
      difficulty: s.versions?.[0]?.difficulty || 'beginner',
      category: s.versions?.[0]?.category || 'general',
      coverImageUrl: s.versions?.[0]?.coverImageUrl,
      averageRating: s.averageRating,
      totalRatings: s.totalRatings,
      favoritedAt: favorites.find(f => f.scenarioId === s.id)?.createdAt,
    }));
  }

  @Get('check/:scenarioId')
  async checkFavorite(@Param('scenarioId') scenarioId: string, @Request() req: any) {
    const userId = req.user.userId;
    
    const favorite = await this.favoritesRepo.findOne({
      where: { userId, scenarioId },
    });
    
    return { isFavorited: !!favorite };
  }
}
