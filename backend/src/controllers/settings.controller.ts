import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  accentColor: 'cyan' | 'blue' | 'purple' | 'green' | 'orange' | 'red';
  contrast: number;
  reducedMotion: boolean;
  compactMode: boolean;
}

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  // In-memory storage for demo (should use database in production)
  private settings: Map<string, Settings> = new Map();

  @Get()
  async getSettings() {
    // Return default settings for now
    return {
      theme: 'dark' as const,
      accentColor: 'cyan' as const,
      contrast: 100,
      reducedMotion: false,
      compactMode: false,
    };
  }

  @Post('appearance')
  async updateAppearance(@Body() payload: Partial<Settings>) {
    // Return updated settings
    return {
      theme: payload.theme || 'dark',
      accentColor: payload.accentColor || 'cyan',
      contrast: payload.contrast || 100,
      reducedMotion: payload.reducedMotion || false,
      compactMode: payload.compactMode || false,
    };
  }

  @Post('notifications')
  async updateNotifications(@Body() payload: Record<string, boolean>) {
    return { success: true, settings: payload };
  }
}
