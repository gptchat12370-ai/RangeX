import { User, Scenario, Playlist, CareerPath, UserProgress, EventSettings, Team, LeaderboardEntry, TeamLeaderboardEntry, DockerImage, VMTemplate } from "../types";

// Empty placeholders to avoid mock data
export const mockUsers: User[] = [];
export const mockScenarios: Scenario[] = [];
export const mockCareerPaths: CareerPath[] = [];
export const mockPlaylists: Playlist[] = [];
export const mockUserProgress: UserProgress[] = [];
export const mockEvents: EventSettings[] = [];
export const mockTeams: Team[] = [];
export const mockLeaderboard: LeaderboardEntry[] = [];
export const mockTeamLeaderboard: TeamLeaderboardEntry[] = [];
export const mockDockerImages: DockerImage[] = [];
export const mockVMTemplates: VMTemplate[] = [];

// Base user shape used as fallback
export let currentUser: User = {
  id: "",
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  country: "",
  role: "solver",
  mfaEnabled: false,
  avatarUrl: "",
  pointsTotal: 0,
  badges: [],
  followedPlaylists: [],
  history: [],
};

export function setCurrentUser(userId: string) {
  const user = mockUsers.find((u) => u.id === userId);
  if (user) {
    currentUser = user;
  }
}
