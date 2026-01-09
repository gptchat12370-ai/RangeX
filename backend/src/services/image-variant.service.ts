import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageVariant } from '../entities/image-variant.entity';
import { MachineRole } from '../entities/machine.entity';

@Injectable()
export class ImageVariantService {
  private readonly logger = new Logger(ImageVariantService.name);

  constructor(
    @InjectRepository(ImageVariant)
    private variantRepo: Repository<ImageVariant>,
  ) {}

  /**
   * Get all active image variants
   */
  async getActiveVariants(): Promise<ImageVariant[]> {
    return this.variantRepo.find({
      where: { isActive: true },
      order: { baseOs: 'ASC', variantType: 'ASC' },
    });
  }

  /**
   * Get variants suitable for a specific role
   */
  async getVariantsByRole(role: MachineRole): Promise<ImageVariant[]> {
    const allVariants = await this.getActiveVariants();
    
    return allVariants.filter(variant => 
      variant.suitableForRoles && variant.suitableForRoles.includes(role)
    );
  }

  /**
   * Get variants by base OS
   */
  async getVariantsByBaseOs(baseOs: string): Promise<ImageVariant[]> {
    return this.variantRepo.find({
      where: { baseOs, isActive: true },
      order: { variantType: 'ASC' },
    });
  }

  /**
   * Get a specific variant by ID
   */
  async getVariantById(id: string): Promise<ImageVariant> {
    const variant = await this.variantRepo.findOne({ where: { id } });
    
    if (!variant) {
      throw new NotFoundException(`Image variant with ID ${id} not found`);
    }

    return variant;
  }

  /**
   * Calculate total cost for multiple variants
   */
  async calculateTotalCost(variantIds: string[]): Promise<{
    hourly: number;
    daily: number;
    monthly: number;
  }> {
    if (!variantIds || variantIds.length === 0) {
      return { hourly: 0, daily: 0, monthly: 0 };
    }

    const variants = await this.variantRepo.findByIds(variantIds);
    
    const hourlyCost = variants.reduce((sum, v) => sum + Number(v.hourlyCostRm), 0);
    
    return {
      hourly: Number(hourlyCost.toFixed(4)),
      daily: Number((hourlyCost * 24).toFixed(4)),
      monthly: Number((hourlyCost * 24 * 30).toFixed(2)),
    };
  }

  /**
   * Get recommended variant for a role (lowest cost)
   */
  async getRecommendedVariant(role: MachineRole, preferLite: boolean = true): Promise<ImageVariant | null> {
    const variants = await this.getVariantsByRole(role);
    
    if (variants.length === 0) {
      return null;
    }

    // If preferLite, return lite variant if available
    if (preferLite) {
      const liteVariant = variants.find(v => v.variantType === 'lite');
      if (liteVariant) {
        return liteVariant;
      }
    }

    // Otherwise return lowest cost variant
    return variants.sort((a, b) => 
      Number(a.hourlyCostRm) - Number(b.hourlyCostRm)
    )[0];
  }

  /**
   * Get cost optimization suggestions
   */
  async getCostOptimizationSuggestions(currentVariantId: string): Promise<{
    canOptimize: boolean;
    currentCost: number;
    suggestedVariant?: ImageVariant;
    potentialSavings?: number;
    savingsPercentage?: number;
  }> {
    const currentVariant = await this.getVariantById(currentVariantId);
    
    // Check if there's a lite version available
    const liteVariants = await this.variantRepo.find({
      where: { 
        baseOs: currentVariant.baseOs,
        variantType: 'lite',
        isActive: true 
      },
    });

    if (liteVariants.length === 0 || currentVariant.variantType === 'lite') {
      return {
        canOptimize: false,
        currentCost: Number(currentVariant.hourlyCostRm),
      };
    }

    const liteVariant = liteVariants[0];
    const savings = Number(currentVariant.hourlyCostRm) - Number(liteVariant.hourlyCostRm);
    const savingsPercentage = (savings / Number(currentVariant.hourlyCostRm)) * 100;

    return {
      canOptimize: savings > 0,
      currentCost: Number(currentVariant.hourlyCostRm),
      suggestedVariant: liteVariant,
      potentialSavings: Number(savings.toFixed(4)),
      savingsPercentage: Number(savingsPercentage.toFixed(1)),
    };
  }

  /**
   * Get variant statistics (for admin dashboard)
   */
  async getVariantStatistics(): Promise<{
    totalVariants: number;
    activeVariants: number;
    approvedVariants: number;
    byBaseOs: Record<string, number>;
    byType: Record<string, number>;
    averageCost: number;
  }> {
    const allVariants = await this.variantRepo.find();
    const activeVariants = allVariants.filter(v => v.isActive);
    const approvedVariants = allVariants.filter(v => v.isAdminApproved);

    const byBaseOs: Record<string, number> = {};
    const byType: Record<string, number> = {};

    allVariants.forEach(v => {
      byBaseOs[v.baseOs] = (byBaseOs[v.baseOs] || 0) + 1;
      byType[v.variantType] = (byType[v.variantType] || 0) + 1;
    });

    const totalCost = activeVariants.reduce((sum, v) => sum + Number(v.hourlyCostRm), 0);
    const averageCost = activeVariants.length > 0 ? totalCost / activeVariants.length : 0;

    return {
      totalVariants: allVariants.length,
      activeVariants: activeVariants.length,
      approvedVariants: approvedVariants.length,
      byBaseOs,
      byType,
      averageCost: Number(averageCost.toFixed(4)),
    };
  }

  /**
   * Validate AWS Fargate compatibility
   */
  async validateFargateCompatibility(variantId: string): Promise<{
    compatible: boolean;
    errors: string[];
  }> {
    const variant = await this.getVariantById(variantId);
    const errors: string[] = [];

    // AWS Fargate valid CPU/RAM combinations
    const validCombos: Record<number, number[]> = {
      0.25: [512, 1024, 2048],
      0.5: [1024, 2048, 3072, 4096],
      1: [2048, 3072, 4096, 5120, 6144, 7168, 8192],
      2: [4096, 5120, 6144, 7168, 8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384],
      4: [8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384, 17408, 18432, 19456, 20480, 21504, 22528, 23552, 24576, 25600, 26624, 27648, 28672, 29696, 30720],
    };

    const cpu = Number(variant.cpuCores);
    const memory = variant.memoryMb;

    if (!validCombos[cpu]) {
      errors.push(`CPU value ${cpu} is not valid for AWS Fargate. Valid values: 0.25, 0.5, 1, 2, 4`);
    } else if (!validCombos[cpu].includes(memory)) {
      errors.push(`Memory ${memory}MB is not valid for CPU ${cpu}. Valid values: ${validCombos[cpu].join(', ')}`);
    }

    return {
      compatible: errors.length === 0,
      errors,
    };
  }
}
