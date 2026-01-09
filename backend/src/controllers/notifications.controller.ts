import { Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { Notification } from '../entities/notification.entity';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  @Get('unread')
  async unread(@Req() req: any) {
    const userId = req.user?.userId;
    return this.repo.find({ 
      where: { userId, isRead: false }, 
      order: { createdAt: 'DESC' } 
    });
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    await this.repo.update(id, { isRead: true });
    return { id, isRead: true };
  }
}
