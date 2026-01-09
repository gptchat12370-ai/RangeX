import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { ScenarioRating } from '../entities/scenario-rating.entity';
import { Scenario } from '../entities/scenario.entity';
import { v4 as uuidv4 } from 'uuid';
import { IsInt, Min, Max } from 'class-validator';

class SubmitRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

@Controller('ratings')
@UseGuards(AuthGuard('jwt'))
export class RatingsController {
  constructor(
    @InjectRepository(ScenarioRating)
    private ratingsRepo: Repository<ScenarioRating>,
    @InjectRepository(Scenario)
    private scenarioRepo: Repository<Scenario>,
  ) {}

  @Post(':scenarioId')
  async submitRating(
    @Param('scenarioId') scenarioId: string,
    @Body() dto: SubmitRatingDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    
    // Check if user already rated
    let existing = await this.ratingsRepo.findOne({
      where: { userId, scenarioId },
    });
    
    if (existing) {
      // Update existing rating
      existing.rating = dto.rating;
      existing.updatedAt = new Date();
      await this.ratingsRepo.save(existing);
    } else {
      // Create new rating
      const rating = this.ratingsRepo.create({
        id: uuidv4(),
        userId,
        scenarioId,
        rating: dto.rating,
      });
      await this.ratingsRepo.save(rating);
    }
    
    // Recalculate scenario average rating
    await this.updateScenarioRatingStats(scenarioId);
    
    return { success: true, message: 'Rating submitted' };
  }

  @Get('scenario/:scenarioId')
  async getScenarioRating(@Param('scenarioId') scenarioId: string) {
    const scenario = await this.scenarioRepo.findOne({
      where: { id: scenarioId },
      select: ['averageRating', 'totalRatings'],
    });
    
    return {
      averageRating: scenario?.averageRating || 0,
      totalRatings: scenario?.totalRatings || 0,
    };
  }

  @Get('user/:scenarioId')
  async getUserRating(@Param('scenarioId') scenarioId: string, @Request() req: any) {
    const userId = req.user.userId;
    
    const rating = await this.ratingsRepo.findOne({
      where: { userId, scenarioId },
    });
    
    return {
      userRating: rating?.rating || null,
    };
  }

  private async updateScenarioRatingStats(scenarioId: string) {
    const result = await this.ratingsRepo
      .createQueryBuilder('rating')
      .select('AVG(rating.rating)', 'avg')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.scenarioId = :scenarioId', { scenarioId })
      .getRawOne();
    
    const averageRating = parseFloat(result.avg) || 0;
    const totalRatings = parseInt(result.count) || 0;
    
    await this.scenarioRepo.update(scenarioId, {
      averageRating: Math.round(averageRating * 100) / 100,
      totalRatings,
    });
  }
}
