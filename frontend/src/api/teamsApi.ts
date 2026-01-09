import { httpClient } from "./httpClient";
import type { Team, TeamLeaderboardEntry } from "../types";

export const teamsApi = {
  async list(params?: any): Promise<Team[]> {
    const { data } = await httpClient.get("/teams", { params });
    return (data.items ?? data)?.map(normalizeTeam) as Team[];
  },

  async getById(teamId: string): Promise<Team | null> {
    const { data } = await httpClient.get(`/teams/${teamId}`);
    return data ? normalizeTeam(data) : null;
  },

  async create(payload: { name: string; description?: string; country?: string; isOpen?: boolean; registrationsOpen?: boolean }) {
    const { data } = await httpClient.post("/teams", {
      name: payload.name,
      description: payload.description,
      country: payload.country,
      openTeam: payload.isOpen, // Map isOpen to openTeam for backend
      registrationsOpen: payload.registrationsOpen,
    });
    return normalizeTeam(data);
  },

  async update(teamId: string, payload: Partial<{ name: string; motto?: string; description?: string; country?: string; isOpen?: boolean; registrationsOpen?: boolean; avatarUrl?: string }>) {
    const { data } = await httpClient.put(`/teams/${teamId}`, payload);
    return normalizeTeam(data);
  },

  async addMember(teamId: string, payload: { userId: string; role?: string }) {
    const { data } = await httpClient.post(`/teams/${teamId}/members`, payload);
    return data;
  },

  async removeMember(teamId: string, memberId: string) {
    const { data } = await httpClient.delete(`/teams/${teamId}/members/${memberId}`);
    return data;
  },

  async deleteTeam(teamId: string) {
    const { data } = await httpClient.delete(`/teams/${teamId}`);
    return data;
  },

  async join(teamId: string) {
    const { data } = await httpClient.post(`/teams/${teamId}/request-join`, {});
    return data;
  },

  async requestToJoin(teamId: string, message?: string) {
    const { data } = await httpClient.post(`/teams/${teamId}/request-join`, { message });
    return data;
  },

  async getJoinRequests(teamId: string) {
    const { data } = await httpClient.get(`/teams/${teamId}/join-requests`);
    return data;
  },

  async approveJoinRequest(teamId: string, requestId: string) {
    const { data } = await httpClient.post(`/teams/${teamId}/join-requests/${requestId}/approve`);
    return data;
  },

  async rejectJoinRequest(teamId: string, requestId: string) {
    const { data } = await httpClient.post(`/teams/${teamId}/join-requests/${requestId}/reject`);
    return data;
  },

  async leave(teamId: string) {
    const { data } = await httpClient.delete(`/teams/${teamId}/leave`);
    return data;
  },

  async getUserTeam(userId: string) {
    const { data } = await httpClient.get(`/teams/mine`);
    return data ? normalizeTeam(data) : null;
  },

  async transferLeadership(teamId: string, newLeaderId: string) {
    const { data } = await httpClient.post(`/teams/${teamId}/transfer-leadership`, { 
      newOwnerId: newLeaderId 
    });
    return data;
  },

  async leaderboard(params?: any): Promise<TeamLeaderboardEntry[]> {
    const { data } = await httpClient.get("/teams/leaderboard", { params });
    return data?.items ?? data ?? [];
  },

  async getTeamActivity(teamId: string) {
    const { data } = await httpClient.get(`/teams/${teamId}/activity`);
    return data ?? [];
  },

  async getUserLeaderboard(params?: any) {
    const { data } = await httpClient.get("/teams/leaderboard/users", { params });
    return data?.items ?? data ?? [];
  },

  async uploadTeamLogo(teamId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post(`/teams/${teamId}/upload-logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

function normalizeTeam(raw: any): Team {
  if (!raw) return raw;
  const openTeam = raw.openTeam ?? raw.isOpen ?? true;
  return {
    id: raw.id,
    name: raw.name,
    motto: raw.motto || raw.teamMotto,
    country: raw.country || "Unknown",
    isOpen: openTeam,
    openTeam: openTeam, // Add for compatibility with pages using openTeam
    registrationsOpen: raw.registrationsOpen ?? raw.registrationOpen ?? true,
    description: raw.description || "",
    members: raw.members || [], // Keep full member objects with user data and role
    owner: raw.ownerUserId || raw.owner || raw.leader,
    leader: raw.ownerUserId || raw.leader || raw.owner,
    avatarUrl: raw.avatarUrl,
    totalPoints: raw.totalPoints ?? 0,
    challengesCompleted: raw.challengesCompleted ?? 0,
    rank: raw.rank,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}
