import { httpClient } from "./httpClient";
import type { LeaderboardEntry, TeamLeaderboardEntry } from "../types";

// Helper function to get rank title based on points
const getRankTitle = (points: number): string => {
  if (points >= 20000) return "🏆 Cyber Legend";
  if (points >= 10000) return "⚡ Elite Hacker";
  if (points >= 5000) return "🛡️ Security Expert";
  if (points >= 2000) return "💻 White Hat";
  if (points >= 500) return "🔰 Script Kiddie";
  return "🌱 Rookie";
};

export const leaderboardApi = {
  async getGlobal(timeframe?: string): Promise<LeaderboardEntry[]> {
    try {
      // Use the new teams endpoint for user leaderboard
      const { data } = await httpClient.get("/teams/leaderboard/users", { params: { timeframe } });
      const users = data?.items ?? data ?? [];
      return users.map((u: any, idx: number) => ({
        rank: idx + 1,
        userId: u.id,
        username: u.username || u.displayName || u.email,
        country: getRankTitle(u.points || 0),
        points: u.points || 0,
        challengesCompleted: u.challengesCompleted || 0,
        avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`,
      }));
    } catch {
      return [];
    }
  },

  async getTeams(timeframe?: string): Promise<TeamLeaderboardEntry[]> {
    try {
      // Use the new teams leaderboard endpoint
      const { data } = await httpClient.get("/teams/leaderboard", { params: { timeframe } });
      const teams = data?.items ?? data ?? [];
      return teams.map((t: any, idx: number) => ({
        rank: idx + 1,
        id: t.id || t.teamId,
        teamId: t.teamId || t.id,
        teamName: t.teamName || t.name,
        country: t.country || "Unknown",
        avatarUrl: t.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${t.id}`,
        totalPoints: t.totalPoints || t.points || 0,
        memberCount: t.memberCount || t.members || 0,
        recentWins: t.recentWins || 0,
        timeframe: timeframe as any,
      }));
    } catch {
      return [];
    }
  },
};
