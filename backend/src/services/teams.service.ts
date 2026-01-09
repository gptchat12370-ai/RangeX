import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { TeamJoinRequest } from '../entities/team-join-request.entity';
import { Notification } from '../entities/notification.entity';
import { ScenarioVersionStatus } from '../entities/scenario-version.entity';
import { AssetStorageService } from './asset-storage.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private readonly memberRepo: Repository<TeamMember>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(EnvironmentSession) private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(TeamJoinRequest) private readonly joinRequestRepo: Repository<TeamJoinRequest>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    private readonly assetStorage: AssetStorageService,
  ) {}

  async getLeaderboard() {
    const teams = await this.teamRepo.find({ relations: ['members', 'members.user'] });
    
    // Team leaderboard now uses eventPoints only (points earned from events)
    const teamScores = teams.map((team) => {
      return {
        id: team.id,
        teamId: team.id,
        teamName: team.name,
        avatarUrl: team.avatarUrl,
        country: team.country,
        memberCount: team.members?.length || 0,
        totalPoints: (team as any).eventPoints || 0, // eventPoints = points from events only
        points: (team as any).eventPoints || 0,
        challengesCompleted: 0, // Will be calculated from event_participation
        recentWins: 0,
      };
    });

    return teamScores.sort((a, b) => b.points - a.points);
  }

  async getUserLeaderboard() {
    const users = await this.userRepo.find();
    
    const userScores = await Promise.all(
      users.map(async (user) => {
        // Get MAX score per scenario (prevents loop farming)
        const sessionScores = await this.sessionRepo
          .createQueryBuilder('session')
          .select('session.scenarioVersionId', 'scenarioVersionId')
          .addSelect('MAX(session.score)', 'maxScore')
          .where('session.userId = :userId', { userId: user.id })
          .andWhere('session.status = :status', { status: 'terminated' })
          .groupBy('session.scenarioVersionId')
          .getRawMany();
        
        const pointsTotal = sessionScores.reduce((sum, s) => sum + (parseInt(s.maxScore) || 0), 0);
        
        return {
          id: user.id,
          username: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          points: pointsTotal,
          challengesCompleted: sessionScores.length,
        };
      })
    );

    return userScores.sort((a, b) => b.points - a.points);
  }

  async list() {
    const teams = await this.teamRepo.find({ relations: ['members', 'members.user'] });
    return teams.map(team => ({
      ...team,
      memberCount: team.members?.length || 0,
    }));
  }

  async getOne(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members', 'members.user'] });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    
    // Add user stats (points and challenges completed) to each member
    if (team.members && team.members.length > 0) {
      for (const member of team.members) {
        if (member.user) {
          // Count unique scenarios completed
          const completedSessions = await this.sessionRepo
            .createQueryBuilder('session')
            .select('DISTINCT session.scenarioVersionId')
            .where('session.userId = :userId', { userId: member.user.id })
            .andWhere('session.status = :status', { status: 'terminated' })
            .getRawMany();
          
          // Calculate points using MAX score per scenario
          const sessionScores = await this.sessionRepo
            .createQueryBuilder('session')
            .select('session.scenarioVersionId', 'scenarioVersionId')
            .addSelect('MAX(session.score)', 'maxScore')
            .where('session.userId = :userId', { userId: member.user.id })
            .andWhere('session.status = :status', { status: 'terminated' })
            .groupBy('session.scenarioVersionId')
            .getRawMany();
          
          const pointsTotal = sessionScores.reduce((sum, s) => sum + (parseInt(s.maxScore) || 0), 0);
          
          (member.user as any).challengesCompleted = completedSessions.length;
          (member.user as any).pointsTotal = pointsTotal;
        }
      }
    }
    
    return team;
  }

  async getMyTeam(userId: string) {
    if (!userId) {
      return null;
    }
    const member = await this.memberRepo.findOne({ where: { userId }, relations: ['team', 'team.members', 'team.members.user'] });
    return member ? member.team : null;
  }

  async create(createTeamDto: { name: string; description?: string; motto?: string; country?: string; maxMembers?: number; openTeam?: boolean; registrationsOpen?: boolean }, userId: string) {
    // Check if user already has a team
    const existing = await this.memberRepo.findOne({ where: { userId } });
    if (existing) {
      throw new BadRequestException('You can only be a member of one team');
    }

    const team = this.teamRepo.create({
      ...createTeamDto,
      ownerUserId: userId,
      leaderId: userId, // Set leaderId for event registration
    });
    const saved = await this.teamRepo.save(team);
    
    // Create the creator as owner/leader
    const member = this.memberRepo.create({ teamId: saved.id, userId, role: 'owner' });
    await this.memberRepo.save(member);
    
    return this.teamRepo.findOne({ where: { id: saved.id }, relations: ['members', 'members.user'] });
  }

  async update(teamId: string, userId: string, updateDto: { name?: string; description?: string; motto?: string; country?: string; avatarUrl?: string; isOpen?: boolean; openTeam?: boolean; registrationsOpen?: boolean }) {
    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members', 'members.user'] });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only the team owner can update team settings');
    }

    // Map isOpen to openTeam if provided
    const openTeam = updateDto.isOpen !== undefined ? updateDto.isOpen : updateDto.openTeam;

    const updates: any = {};
    if (updateDto.name !== undefined) updates.name = updateDto.name;
    if (updateDto.description !== undefined) updates.description = updateDto.description;
    if (updateDto.motto !== undefined) updates.motto = updateDto.motto;
    if (updateDto.country !== undefined) updates.country = updateDto.country;
    if (updateDto.avatarUrl !== undefined) updates.avatarUrl = updateDto.avatarUrl;
    if (openTeam !== undefined) updates.openTeam = openTeam;
    if (updateDto.registrationsOpen !== undefined) updates.registrationsOpen = updateDto.registrationsOpen;

    await this.teamRepo.update(teamId, updates);
    return this.teamRepo.findOne({ where: { id: teamId }, relations: ['members', 'members.user'] });
  }

  async addMember(teamId: string, userId: string, newMemberId: string, role: string = 'member') {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only the team owner can add members');
    }
    
    // Check if user is already in another team
    const existingMembership = await this.memberRepo.findOne({ where: { userId: newMemberId } });
    if (existingMembership) {
      throw new BadRequestException('User is already a member of another team');
    }
    
    const member = this.memberRepo.create({ teamId, userId: newMemberId, role });
    return this.memberRepo.save(member);
  }

  async removeMember(teamId: string, memberId: string, userId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only the team owner can remove members');
    }
    await this.memberRepo.delete({ id: memberId, teamId });
    return { deleted: true };
  }

  async deleteTeam(teamId: string, userId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only the team owner can delete the team');
    }
    await this.memberRepo.delete({ teamId });
    await this.teamRepo.delete(teamId);
    return { deleted: true };
  }

  async leaveTeam(teamId: string, userId: string) {
    console.log(`[LeaveTeam] User ${userId} leaving team ${teamId}`);
    
    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members'] });
    if (!team) {
      console.log('[LeaveTeam] Team not found');
      throw new NotFoundException('Team not found');
    }

    const leavingMember = team.members?.find((m) => m.userId === userId);
    if (!leavingMember) {
      console.log('[LeaveTeam] Member not found in team');
      throw new NotFoundException('Member not found in team');
    }
    
    const wasOwner = leavingMember.role === 'owner';
    console.log(`[LeaveTeam] Member found, wasOwner: ${wasOwner}`);
    
    // Delete the member first
    const deleteResult = await this.memberRepo.delete({ teamId, userId });
    console.log(`[LeaveTeam] Member deleted, affected: ${deleteResult.affected}`);
    
    // Get remaining members
    const remainingMembers = await this.memberRepo.find({ 
      where: { teamId },
      relations: ['user']
    });
    console.log(`[LeaveTeam] Remaining members: ${remainingMembers.length}`);
    
    if (remainingMembers.length === 0) {
      // No members left, delete the team
      await this.teamRepo.delete(teamId);
      console.log('[LeaveTeam] Team deleted - no members left');
      return { success: true, teamDeleted: true };
    } else if (wasOwner && remainingMembers.length > 0) {
      // Transfer to oldest member (first to join after owner)
      const newOwner = remainingMembers[0];
      console.log(`[LeaveTeam] Transferring ownership to user ${newOwner.userId}`);
      
      newOwner.role = 'owner';
      await this.memberRepo.save(newOwner);
      
      // Reload team without relations to avoid stale data
      const teamToUpdate = await this.teamRepo.findOne({ where: { id: teamId } });
      if (teamToUpdate) {
        teamToUpdate.ownerUserId = newOwner.userId;
        await this.teamRepo.save(teamToUpdate);
        console.log(`[LeaveTeam] Team owner updated to ${newOwner.userId}`);
      }
      
      console.log(`[LeaveTeam] Leadership transferred successfully`);
      return { success: true, newOwnerId: newOwner.userId };
    }
    
    console.log('[LeaveTeam] Member left successfully');
    return { success: true };
  }

  async transferLeadership(teamId: string, currentOwnerId: string, newOwnerId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members'] });
    if (!team) throw new NotFoundException('Team not found');

    // Verify current user is owner
    const currentOwner = team.members?.find((m) => m.userId === currentOwnerId && m.role === 'owner');
    if (!currentOwner) {
      throw new BadRequestException('Only team owner can transfer leadership');
    }

    // Verify new owner is a member
    const newOwner = team.members?.find((m) => m.userId === newOwnerId);
    if (!newOwner) {
      throw new NotFoundException('New owner must be a team member');
    }

    // Update roles
    currentOwner.role = 'member';
    newOwner.role = 'owner';

    await this.memberRepo.save([currentOwner, newOwner]);

    // Update team owner
    team.ownerUserId = newOwnerId;
    await this.teamRepo.save(team);

    return { success: true, newOwnerId };
  }

  async getTeamActivity(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members', 'members.user'] });
    if (!team) throw new NotFoundException('Team not found');

    const memberUserIds = (team.members || []).map((m) => m.userId);
    
    if (memberUserIds.length === 0) {
      return [];
    }
    
    const sessions = await this.sessionRepo
      .createQueryBuilder('session')
      .where('session.userId IN (:...userIds)', { userIds: memberUserIds })
      .andWhere('session.status IN (:...statuses)', { statuses: ['terminated', 'running'] })
      .orderBy('session.createdAt', 'DESC')
      .limit(50)
      .getMany();

    const userMap = new Map((team.members || []).map((m) => [m.userId, m.user]));

    const activities = sessions.map((s) => {
      const user = userMap.get(s.userId);
      return {
        id: s.id,
        userId: s.userId,
        username: user?.displayName || 'Unknown',
        action: s.status === 'terminated' ? 'completed' : 'started',
        scenarioId: s.scenarioVersionId,
        timestamp: s.createdAt,
        points: s.status === 'terminated' ? (s.score || 0) : 0,
      };
    });

    return activities;
  }

  async uploadTeamLogo(file: Express.Multer.File, teamId: string, userId: string) {
    console.log('[TeamsService] uploadTeamLogo called - teamId:', teamId, 'userId:', userId, 'fileSize:', file?.size);
    if (!file) throw new BadRequestException('No file uploaded');

    const team = await this.teamRepo.findOne({ where: { id: teamId }, relations: ['members'] });
    if (!team) throw new NotFoundException('Team not found');

    const member = team.members?.find((m) => m.userId === userId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenException('Only team owners can upload team logos');
    }

    // Delete old logo if exists and it's from our storage
    if (team.avatarUrl && !team.avatarUrl.includes('dicebear.com')) {
      try {
        console.log('[TeamsService] Team has existing logo:', team.avatarUrl);
        // Extract the object path from the URL
        // URL format: /api/assets/file/{key} where {key} is the MinIO object path
        const match = team.avatarUrl.match(/\/api\/assets\/file\/(.+?)(\?|$)/);
        if (match) {
          const objectPath = match[1]; // Everything after /api/assets/file/ and before ? (if any)
          console.log(`[TeamsService] ========== DELETING OLD TEAM LOGO ==========`);
          console.log(`[TeamsService] Deleting old logo from MinIO: ${objectPath}`);
          await this.assetStorage.delete(objectPath);
          console.log(`[TeamsService] Old logo deleted successfully`);
        } else {
          console.log('[TeamsService] Could not parse logo URL for deletion:', team.avatarUrl);
        }
      } catch (err) {
        console.error('[TeamsService] Error deleting old logo:', err);
        // Continue with upload even if deletion fails
      }
    } else {
      console.log('[TeamsService] No existing custom logo to delete (using DiceBear or none)');
    }

    // Upload new logo with organized path: teams/{teamId}/logo.{ext}
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    // Validate extension matches MIME type
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    const validExt = mimeToExt[file.mimetype] || ext;
    const objectPath = `teams/${teamId}/logo.${validExt}`;
    console.log('[TeamsService] Uploading team logo to path:', objectPath);
    const result = await this.assetStorage.storeWithPath(file, objectPath);

    // Add timestamp for cache busting
    team.avatarUrl = `${result.url}?t=${Date.now()}`;
    console.log('[TeamsService] Team logo uploaded successfully, URL:', team.avatarUrl);
    await this.teamRepo.save(team);

    return team;
  }

  // Join request methods
  async requestToJoin(teamId: string, userId: string, message?: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    // Check if user is already a member
    const existing = await this.memberRepo.findOne({ where: { userId } });
    if (existing) {
      throw new BadRequestException('You are already a member of a team');
    }

    // Check if there's already a pending request
    const existingRequest = await this.joinRequestRepo.findOne({
      where: { teamId, userId, status: 'pending' },
    });
    if (existingRequest) {
      throw new BadRequestException('You already have a pending request for this team');
    }

    // If team is open, join directly (auto-accept)
    if (team.openTeam) {
      const member = this.memberRepo.create({ teamId, userId, role: 'member' });
      await this.memberRepo.save(member);
      return { joined: true, message: 'Successfully joined the team' };
    }

    // Check if registrations are open (for approval-required mode)
    if (!team.registrationsOpen) {
      throw new BadRequestException('This team is not accepting new members at this time');
    }

    // Create join request for approval
    const request = this.joinRequestRepo.create({ teamId, userId, message, status: 'pending' });
    await this.joinRequestRepo.save(request);
    
    // Create notification for team owner
    const requestingUser = await this.userRepo.findOne({ where: { id: userId } });
    if (team.ownerUserId && requestingUser) {
      const notification = this.notificationRepo.create({
        userId: team.ownerUserId,
        title: 'New Team Join Request',
        body: `${requestingUser.displayName || requestingUser.email} has requested to join ${team.name}`,
        type: 'team',
        isRead: false,
      });
      await this.notificationRepo.save(notification);
    }
    
    return { joined: false, message: 'Join request submitted' };
  }

  async getJoinRequests(teamId: string, userId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only team owner can view join requests');
    }

    return this.joinRequestRepo.find({
      where: { teamId, status: 'pending' },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async approveJoinRequest(teamId: string, requestId: string, userId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only team owner can approve requests');
    }

    const request = await this.joinRequestRepo.findOne({ where: { id: requestId, teamId } });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException('This request has already been processed');
    }

    // Check if user is already in another team
    const existingMembership = await this.memberRepo.findOne({ where: { userId: request.userId } });
    if (existingMembership) {
      request.status = ScenarioVersionStatus.REJECTED;
      await this.joinRequestRepo.save(request);
      throw new BadRequestException('User is already a member of another team');
    }

    const member = this.memberRepo.create({ teamId, userId: request.userId, role: 'member' });
    await this.memberRepo.save(member);

    request.status = ScenarioVersionStatus.APPROVED;
    await this.joinRequestRepo.save(request);

    return { success: true, message: 'User added to team' };
  }

  async rejectJoinRequest(teamId: string, requestId: string, userId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerUserId !== userId) {
      throw new ForbiddenException('Only team owner can reject requests');
    }

    const request = await this.joinRequestRepo.findOne({ where: { id: requestId, teamId } });
    if (!request) throw new NotFoundException('Join request not found');

    request.status = ScenarioVersionStatus.REJECTED;
    await this.joinRequestRepo.save(request);

    return { success: true, message: 'Request rejected' };
  }
}
