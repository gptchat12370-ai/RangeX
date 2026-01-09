import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreatorPreferencesService } from '../services/creator-preferences.service';
import {
  UpdatePreferencesDto,
  SaveDockerCredentialsDto,
} from '../dto/update-preferences.dto';

@Controller('creator/preferences')
@UseGuards(AuthGuard('jwt'))
export class CreatorPreferencesController {
  constructor(
    private readonly preferencesService: CreatorPreferencesService,
  ) {}

  /**
   * Get current user's preferences
   */
  @Get()
  async getPreferences(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.preferencesService.getPreferences(userId);
  }

  /**
   * Update preferences
   */
  @Put()
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: any
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.preferencesService.updatePreferences(userId, dto);
  }

  /**
   * Save Docker registry credentials (encrypted)
   */
  @Post('docker-credentials')
  async saveDockerCredentials(
    @Body() dto: SaveDockerCredentialsDto,
    @Req() req: any
  ) {
    const userId = req.user?.sub || req.user?.userId;
    await this.preferencesService.saveDockerCredentials(
      userId,
      dto.registryUrl,
      dto.username,
      dto.password
    );
    return {
      success: true,
      message: 'Docker credentials saved successfully',
    };
  }

  /**
   * Get Docker credentials (decrypted)
   */
  @Get('docker-credentials')
  async getDockerCredentials(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    const credentials = await this.preferencesService.getDockerCredentials(
      userId
    );
    
    if (!credentials) {
      return { hasCredentials: false };
    }

    return {
      hasCredentials: true,
      registryUrl: credentials.registryUrl,
      username: credentials.username,
      // Don't send password to frontend
    };
  }

  /**
   * Delete Docker credentials
   */
  @Delete('docker-credentials')
  async deleteDockerCredentials(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    await this.preferencesService.deleteDockerCredentials(userId);
    return {
      success: true,
      message: 'Docker credentials deleted successfully',
    };
  }

  /**
   * Get preferred variant for a role
   */
  @Get('preferred-variant/:role')
  async getPreferredVariant(
    @Req() req: any,
    @Param('role') role: 'attacker' | 'victim' | 'service'
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const variantId = await this.preferencesService.getPreferredVariantForRole(
      userId,
      role
    );
    return { variantId };
  }
}
