import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, BadRequestException, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TeamsService } from '../services/teams.service';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';

@Controller('teams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Roles('admin', 'creator', 'solver')
  @Get('leaderboard')
  async getLeaderboard() {
    return this.teamsService.getLeaderboard();
  }

  @Roles('admin', 'creator', 'solver')
  @Get('leaderboard/users')
  async getUserLeaderboard() {
    return this.teamsService.getUserLeaderboard();
  }

  @Roles('admin', 'creator', 'solver')
  @Get()
  async list() {
    return this.teamsService.list();
  }

  @Get('mine')
  async getMyTeam(@Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.getMyTeam(userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Get(':teamId')
  async getOne(@Param('teamId') teamId: string) {
    return this.teamsService.getOne(teamId);
  }

  @Roles('admin', 'creator', 'solver')
  @Post()
  async create(@Req() req: any, @Body() body: { name: string; description?: string; motto?: string; country?: string; maxMembers?: number; openTeam?: boolean; isOpen?: boolean; registrationsOpen?: boolean }) {
    const userId = req.user?.userId;
    // Map isOpen to openTeam if provided
    const teamData = {
      ...body,
      openTeam: body.openTeam ?? body.isOpen ?? false,
    };
    return this.teamsService.create(teamData, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Put(':teamId')
  async update(@Param('teamId') teamId: string, @Req() req: any, @Body() body: { name?: string; description?: string; motto?: string; country?: string; avatarUrl?: string; isOpen?: boolean; openTeam?: boolean; registrationsOpen?: boolean }) {
    const userId = req.user?.userId;
    return this.teamsService.update(teamId, userId, body);
  }

  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/members')
  async addMember(@Param('teamId') teamId: string, @Req() req: any, @Body() body: { userId: string; role?: string }) {
    const userId = req.user?.userId;
    return this.teamsService.addMember(teamId, userId, body.userId, body.role);
  }

  @Roles('admin', 'creator', 'solver')
  @Delete(':teamId/members/:memberId')
  async removeMember(@Param('teamId') teamId: string, @Param('memberId') memberId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.removeMember(teamId, memberId, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Delete(':teamId/leave')
  async leaveTeam(@Param('teamId') teamId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.leaveTeam(teamId, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Delete(':teamId')
  async deleteTeam(@Param('teamId') teamId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.deleteTeam(teamId, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/transfer-leadership')
  async transferLeadership(@Param('teamId') teamId: string, @Req() req: any, @Body() body: { newOwnerId: string }) {
    const userId = req.user?.userId;
    return this.teamsService.transferLeadership(teamId, userId, body.newOwnerId);
  }

  @Roles('admin', 'creator', 'solver')
  @Get(':teamId/activity')
  async getTeamActivity(@Param('teamId') teamId: string) {
    return this.teamsService.getTeamActivity(teamId);
  }

  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/upload-logo')
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
  async uploadTeamLogo(@UploadedFile() file: Express.Multer.File, @Param('teamId') teamId: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.teamsService.uploadTeamLogo(file, teamId, userId);
  }

  // Join request endpoints
  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/request-join')
  async requestToJoin(@Param('teamId') teamId: string, @Req() req: any, @Body() body: { message?: string }) {
    const userId = req.user?.userId;
    return this.teamsService.requestToJoin(teamId, userId, body.message);
  }

  @Roles('admin', 'creator', 'solver')
  @Get(':teamId/join-requests')
  async getJoinRequests(@Param('teamId') teamId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.getJoinRequests(teamId, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/join-requests/:requestId/approve')
  async approveJoinRequest(@Param('teamId') teamId: string, @Param('requestId') requestId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.approveJoinRequest(teamId, requestId, userId);
  }

  @Roles('admin', 'creator', 'solver')
  @Post(':teamId/join-requests/:requestId/reject')
  async rejectJoinRequest(@Param('teamId') teamId: string, @Param('requestId') requestId: string, @Req() req: any) {
    const userId = req.user?.userId;
    return this.teamsService.rejectJoinRequest(teamId, requestId, userId);
  }
}