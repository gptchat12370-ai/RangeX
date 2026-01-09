// NOTE: Legacy aggregator API. Prefer using the typed per-domain APIs in src/api/*.ts.
// This file exists only for compatibility with older imports.
import { httpClient } from "../api/httpClient";
import { creatorApi } from "../api/creatorApi";
import {
  Scenario,
  Playlist,
  CareerPath,
  UserProgress,
  EventSettings,
  Event,
  Team,
  LeaderboardEntry,
  TeamLeaderboardEntry,
  SessionState,
  Question,
  DockerImage,
  VMTemplate,
} from "../types";

// Scenarios API (wired to backend list endpoint)
export const scenariosApi = {
  getAll: async (): Promise<Scenario[]> => {
    const { data } = await httpClient.get("/solver/scenarios");
    if (!Array.isArray(data)) return [];
    return data.map(mapSolverScenario);
  },
  getById: async (id: string): Promise<Scenario | null> => {
    const { data } = await httpClient.get("/solver/scenarios");
    if (!Array.isArray(data)) return null;
    const found = data.find((s: any) => s.id === id);
    return found ? mapSolverScenario(found) : null;
  },
  create: async (_scenario: Partial<Scenario>): Promise<Scenario> => {
    // Map frontend shape to creator DTO and delegate to canonical API
    const payload = {
      title: _scenario.title || "Untitled Scenario",
      shortDescription: _scenario.shortDesc || "",
      difficulty: _scenario.difficulty || "Easy",
      category: _scenario.category || "General",
      tags: _scenario.tags || [],
      estimatedMinutes: _scenario.durationMinutes || 60,
      scenarioType: "challenge",
      missionText:
        (_scenario.mission && _scenario.mission[0]?.text) ||
        "Mission brief will be provided by the creator.",
      solutionWriteup: _scenario.rules?.codeOfEthics || "Solution will be provided by the creator.",
      machines: (_scenario.machines || []).map((m) => ({
        name: m.name || "Machine",
        role: (m.role as any) || "attacker",
        imageSourceType: m.imageName ? "custom_image" : "platform_library",
        imageRef: m.imageName || "ubuntu:22.04",
        registryCredentialId: undefined,
        networkGroup: "lab-net",
        resourceProfile: "micro",
        allowSolverEntry: m.solverCanAccess ?? true,
        allowFromAttacker: true,
        allowInternalConnections: true,
        isPivotHost: false,
        startupCommands: m.autoInstall?.scripts?.shell,
      })),
    };
    const res = await creatorApi.createScenario(payload);
    return {
      id: res.scenarioId,
      title: payload.title,
      shortDesc: payload.shortDescription,
      author: "you",
      tags: payload.tags,
      mode: "Single Player",
      type: "Cyber Challenge",
      difficulty: payload.difficulty as any,
      durationMinutes: payload.estimatedMinutes,
      category: payload.category,
      rating: 0,
      followers: 0,
      mission: _scenario.mission || [],
      rules: _scenario.rules || { codeOfEthics: "" },
      machines: _scenario.machines || [],
      questions: _scenario.questions || [],
      validationPolicy: _scenario.validationPolicy || "Instant",
      scoringPolicy: _scenario.scoringPolicy || "AllOrNothing",
      hintPolicy: _scenario.hintPolicy || "Disabled",
      status: "pending",
      version: 1,
    };
  },
  update: async (_id: string, _updates: Partial<Scenario>): Promise<Scenario | null> => {
    throw new Error("Scenario update not implemented yet.");
  },
  delete: async (_id: string): Promise<boolean> => {
    throw new Error("Scenario delete not implemented yet.");
  },
};

// Career Paths API (placeholder, no mock data)
export const careerPathsApi = {
  getAll: async (): Promise<CareerPath[]> => [],
  getById: async (_id: string): Promise<CareerPath | null> => null,
  create: async (_path: Partial<CareerPath>): Promise<CareerPath> => {
    throw new Error("Career path creation not implemented yet.");
  },
  update: async (_id: string, _updates: Partial<CareerPath>): Promise<CareerPath | null> => {
    throw new Error("Career path update not implemented yet.");
  },
  delete: async (_id: string): Promise<boolean> => {
    throw new Error("Career path delete not implemented yet.");
  },
  follow: async (_id: string): Promise<boolean> => false,
};

// Playlists API (placeholder, no mock data)
export const playlistsApi = {
  getAll: async (): Promise<Playlist[]> => [],
  getById: async (_id: string): Promise<Playlist | null> => null,
  create: async (_playlist: Partial<Playlist>): Promise<Playlist> => {
    throw new Error("Playlist creation not implemented yet.");
  },
  update: async (_id: string, _updates: Partial<Playlist>): Promise<Playlist | null> => {
    throw new Error("Playlist update not implemented yet.");
  },
  delete: async (_id: string): Promise<boolean> => {
    throw new Error("Playlist delete not implemented yet.");
  },
  follow: async (_id: string): Promise<boolean> => false,
  favorite: async (_id: string, _userId: string): Promise<boolean> => false,
  addScenario: async (_playlistId: string, _scenarioId: string): Promise<boolean> => false,
  removeScenario: async (_playlistId: string, _scenarioId: string): Promise<boolean> => false,
};

// Progress API (placeholder)
export const progressApi = {
  get: async (_userId: string, _entityType: string, _entityId: string): Promise<UserProgress | null> => null,
  getAll: async (_userId: string): Promise<UserProgress[]> => [],
  markComplete: async (_userId: string, _entityType: "careerPath" | "playlist", _entityId: string, _scenarioId: string): Promise<UserProgress> => {
    throw new Error("Progress tracking not implemented yet.");
  },
};

// Events API (placeholder)
export const eventsApi = {
  getAll: async (): Promise<EventSettings[]> => [],
  getById: async (_id: string): Promise<Event | null> => null,
  create: async (_event: Partial<EventSettings>): Promise<EventSettings> => {
    throw new Error("Event creation not implemented yet.");
  },
  join: async (_id: string, _userId: string): Promise<boolean> => false,
  start: async (_id: string): Promise<boolean> => false,
  end: async (_id: string): Promise<boolean> => false,
};

// Teams API (placeholder)
export const teamsApi = {
  // Deprecated: use src/api/teamsApi.ts
  getAll: async (): Promise<Team[]> => [],
  getById: async (_id: string): Promise<Team | null> => null,
  create: async (_team: Partial<Team>): Promise<Team> => {
    throw new Error("Team creation not implemented yet.");
  },
  update: async (_id: string, _updates: Partial<Team>): Promise<Team | null> => {
    throw new Error("Team update not implemented yet.");
  },
  join: async (_teamId: string, _userId: string): Promise<boolean> => false,
  leave: async (_teamId: string, _userId: string): Promise<boolean> => false,
  transferLeadership: async (_teamId: string, _newLeaderId: string): Promise<boolean> => false,
  getUserTeam: async (_userId: string): Promise<Team | null> => null,
  requestToJoin: async (_teamId: string, _userId: string): Promise<boolean> => false,
};

// Leaderboard API (placeholder)
export const leaderboardApi = {
  getGlobal: async (_timeframe: "all" | "month" | "week" = "all"): Promise<LeaderboardEntry[]> => [],
  getForEvent: async (_eventId: string): Promise<LeaderboardEntry[]> => [],
  getTeams: async (_timeframe: "all" | "month" | "week" = "all"): Promise<TeamLeaderboardEntry[]> => [],
};

// Session API (placeholder)
export const sessionApi = {
  launch: async (_scenarioId: string, _userId: string): Promise<SessionState> => {
    throw new Error("Use solverApi.startScenario for launching environments.");
  },
  getById: async (_id: string): Promise<SessionState | null> => null,
  submitAnswer: async (_sessionId: string, _questionId: string, _answer: any) => {
    return {
      correct: false,
      earnedPoints: 0,
      remainingAttempts: 0,
      revealFeedback: true,
    };
  },
  resetMachine: async (_sessionId: string, _machineId: string): Promise<boolean> => false,
  restartMachine: async (_sessionId: string, _machineId: string): Promise<boolean> => false,
  terminate: async (_sessionId: string): Promise<boolean> => false,
};

// Admin API (placeholder)
export const adminApi = {
  // Deprecated: use src/api/adminApi.ts
  getDockerImages: async (): Promise<DockerImage[]> => [],
  getVMTemplates: async (): Promise<VMTemplate[]> => [],
  addDockerImage: async (_image: Partial<DockerImage>): Promise<DockerImage> => {
    throw new Error("Docker image management not implemented yet.");
  },
  addVMTemplate: async (_template: Partial<VMTemplate>): Promise<VMTemplate> => {
    throw new Error("VM template management not implemented yet.");
  },
};

// Uploads API (placeholder)
export const uploadsApi = {
  upload: async (_file: File): Promise<string> => {
    throw new Error("Uploads not implemented yet.");
  },
};

function mapSolverScenario(raw: any): Scenario {
  return {
    id: raw.id,
    title: raw.title,
    shortDesc: raw.shortDesc || raw.shortDescription || "",
    author: raw.author || "creator",
    tags: raw.tags || [],
    coverUrl: raw.coverUrl || raw.coverImageUrl,
    mode: raw.mode || "Single Player",
    type: raw.type || "Cyber Challenge",
    difficulty: raw.difficulty || "Easy",
    durationMinutes: raw.durationMinutes || raw.estimatedMinutes || 60,
    category: raw.category || "General",
    rating: raw.rating || 0,
    followers: raw.followers || 0,
    mission: raw.mission || [],
    rules: raw.rules || { codeOfEthics: "" },
    machines: raw.machines || [],
    questions: raw.questions || [],
    validationPolicy: raw.validationPolicy || "Instant",
    scoringPolicy: raw.scoringPolicy || "AllOrNothing",
    hintPolicy: raw.hintPolicy || "Disabled",
    status: raw.status,
    version: raw.version,
  };
}
