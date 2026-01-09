export type Role = "solver" | "creator" | "admin";
export type Mode = "Single Player" | "Multi Player";
export type ScenarioType = "Open Range" | "Cyber Challenge";
export type Difficulty = "Easy" | "Intermediate" | "Hard" | "Impossible";
export type QuestionType = "MCQ" | "ShortAnswer" | "PracticalTask";
export type ValidationPolicy = "Instant" | "OnSubmit" | "Deferred";
export type ScoringPolicy = "AllOrNothing" | "Partial";
export type HintPolicy = "Disabled" | "ShowOnRequest" | "TimedUnlock";
export type AttemptPolicy = "Unlimited" | "Limited";
export type MachineRole = "attacker" | "victim";
export type MachineKind = "Docker" | "VM";
export type AccessType = "SSH" | "RDP" | "Web";
export type NetworkSubnet = "AttackerNet" | "VictimNet";
export type NetworkEgress = "Open" | "Restricted";
export type SessionStatus = "In Progress" | "Completed" | "Terminated";
export type EventStatus = "Scheduled" | "Live" | "Ended";
export type JoinPolicy = "Auto" | "RequireApproval" | "AllowLateJoin";
export type Privacy = "Visible" | "PasswordProtected";
export type LeaderboardScope = "global" | "event" | "org";
export type Timeframe = "all" | "month" | "week";

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  role: Role;
  roleAdmin?: boolean;
  roleCreator?: boolean;
  roleSolver?: boolean;
  displayName?: string; // optional display name
  twofaSecret?: string; // two-factor auth secret
  mfaEnabled: boolean;
  avatarUrl?: string;
  pointsTotal: number;
  badges: Badge[];
  followedPlaylists: string[];
  history: ScenarioHistory[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
  iconUrl?: string;
}

export interface RichBlock {
  kind: "heading" | "paragraph" | "image" | "table";
  text?: string;
  level?: 1 | 2 | 3;
  url?: string;
  caption?: string;
  table?: { headers: string[]; rows: string[][] };
}

export interface MachineSpec {
  id: string;
  name: string;
  role: MachineRole;
  kind: MachineKind;
  access: AccessType[];
  credentials?: { username: string; password: string };
  solverCanAccess: boolean;
  // Docker
  imageName?: string;
  imageTag?: string;
  entrypoint?: string;
  cmd?: string;
  exposePorts?: string[];
  env?: Record<string, string>;
  volumes?: string[];
  security?: { capDropAll: boolean; readOnlyRoot: boolean };
  // VM
  templateName?: string;
  size?: { vcpus: number; ramMb: number; diskGb: number };
  network?: {
    subnet: NetworkSubnet;
    egress: NetworkEgress;
    ingress: string[];
  };
  // Provisioning
  autoInstall?: {
    presets: string[];
    customPackages?: string[];
    scripts?: { cloudInit?: string; shell?: string; powershell?: string };
  };
  uploads?: {
    filename: string;
    dest: string;
    overwrite: boolean;
    chmodX: boolean;
    checksum?: string;
  }[];
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  body?: string;
  topicTags: string[];
  points: number;
  attemptPolicy: AttemptPolicy;
  maxAttempts?: number;
  hint?: { text: string; penaltyPoints?: number; unlockAfterSec?: number };
  mcq?: {
    options: { id: string; text: string; isCorrect: boolean }[];
    shuffle: boolean;
  };
  shortAnswer?: {
    acceptableAnswers: string[];
    match: "exact" | "regex" | "lowercaseTrim";
  };
  practical?: {
    steps: {
      id: string;
      text: string;
      verifier: "script" | "text" | "manual";
      points: number;
    }[];
  };
}

export interface Rules {
  codeOfEthics: string;
  learningOutcomes?: string;
  extraGuidance?: string;
}

export interface Scenario {
  id: string;
  scenarioId?: string; // Base scenario ID for ratings/favorites
  title: string;
  shortDesc: string;
  author: string;
  tags: string[];
  coverImageUrl?: string;
  mode: Mode;
  type: ScenarioType;
  difficulty: Difficulty;
  durationMinutes: number;
  category: string;
  rating: number;
  averageRating?: number;
  totalRatings?: number;
  followers: number;
  mission: RichBlock[];
  rules: Rules;
  labCredentials?: { username?: string; password?: string; notes?: string };
  machines: MachineSpec[];
  questions: Question[];
  assets?: { fileName: string; fileUrl: string; assetType: string; fileSize: number; uploadedAt?: string }[];
  hints?: { id: string; title: string; body: string; unlockAfter: number; penaltyPoints?: number }[];
  validationPolicy: ValidationPolicy;
  scoringPolicy: ScoringPolicy;
  hintPolicy: HintPolicy;
  // Creator/Admin fields
  status?: "draft" | "pending" | "approved" | "archived";
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  views?: number;
  starts?: number;
  completes?: number;
}

export interface CareerPath {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  coverImageUrl?: string;
  rating: number;
  totalRatings?: number;
  followers: number;
  playlists?: string[]; // ordered list of playlist IDs
  items?: { scenarioVersionId: string; sortOrder?: number }[]; // backend returns items
  requiredBadges?: string[]; // badge IDs awarded on completion
  createdBy?: string; // admin userId
  ownerUserId?: string; // userId of the owner
  updatedAt: string;
  isPublic?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  rating: number;
  followers: number;
  scenarios: string[]; // ordered scenario IDs
  items?: { scenarioVersionId: string; sortOrder?: number }[]; // alternative format from backend
  isCareerPath: boolean; // deprecated - use kind instead
  ownerUserId: string; // userId (for custom/favorites), or admin for curated
  isPublic: boolean; // matches backend
  visibility?: "private" | "public"; // deprecated, use isPublic
  kind?: "custom" | "favorites" | "curated"; // curated used by admin-made playlists
}

export interface UserProgress {
  userId: string;
  entityType: "careerPath" | "playlist";
  entityId: string;
  progressPct: number; // 0–100
  earnedBadgeIds: string[];
  completedScenarioIds: string[];
  lastUpdated: string;
}

export interface ScenarioHistory {
  scenarioId: string;
  sessionId?: string;
  title: string;
  owner: string;
  mode: Mode;
  durationMinutes: number;
  status: SessionStatus;
  startedAt: string;
  finishedAt?: string;
  score: number;
  progressPct: number;
  eventId?: string; // Optional: Indicates if this is an event challenge session
  currentScore?: number; // Current score for in-progress sessions
  remainingSeconds?: number | null; // Time remaining for running sessions
}

export interface EventSettings {
  id: string;
  name: string;
  tags: string[];
  scenarioId: string;
  author: string;
  observers: string[];
  category: "Player vs Player";
  multiplayerMode: "Event";
  startAt: string;
  autoStart: boolean;
  durationMinutes: number;
  minParticipants: number;
  maxParticipants: number;
  allowTeamSwapping: boolean;
  joinPolicy: JoinPolicy;
  privacy: Privacy;
  password?: string;
  allowServerReset: boolean;
  hideAnswerFeedback: boolean;
  isCommunityEvent: boolean;
  freeSlots: number;
  participants: string[];
  status: EventStatus;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  format: "Player vs Player" | "Team vs Team";
  startDate: string;
  endDate: string;
  durationMinutes: number;
  maxParticipants: number;
  registrations?: any[]; // registration records with user details
  participants?: string[]; // user IDs or team IDs depending on format
  scenarios?: any[]; // scenario objects with details
  tags?: string[];
}

export interface EventChallengeProgress {
  eventId: string;
  challengeId: string;
  userId: string;
  pointsEarned: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface EventParticipation {
  eventId: string;
  userId: string;
  teamId?: string; // For team events
  totalPoints: number;
  challengesCompleted: string[];
  rank?: number;
}

export interface Team {
  id: string;
  name: string;
  motto?: string;
  country: string;
  isOpen: boolean;
  registrationsOpen: boolean;
  description?: string;
  members: string[]; // Array of user IDs
  owner: string; // userId of team owner (same as leader initially)
  leader: string; // userId of team leader (can be transferred)
  leaderId?: string; // Alternative field name used by backend
  avatarUrl?: string;
  totalPoints: number;
  challengesCompleted: number;
  eventPoints?: number; // Points earned from events only
  rank?: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  scope: LeaderboardScope;
  refId?: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  country: string;
  points: number;
  avgCompletionTimeMin: number;
  timeframe: Timeframe;
  rank: number;
}

export interface TeamLeaderboardEntry {
  id: string;
  teamId: string;
  teamName: string;
  country: string;
  avatarUrl?: string;
  totalPoints: number;
  memberCount: number;
  recentWins: number;
  timeframe: Timeframe;
  rank: number;
}

export interface DockerImage {
  id: string;
  name: string;
  tags: string[];
  description: string;
  category: string;
  allowedByDefault: boolean;
}

export interface VMTemplate {
  id: string;
  name: string;
  os: string;
  version: string;
  description: string;
  category: string;
  allowedByDefault: boolean;
}

export interface SessionState {
  id: string;
  scenarioId: string;
  userId: string;
  status: SessionStatus;
  startedAt: string;
  finishedAt?: string;
  remainingSeconds: number;
  score: number;
  progressPct: number;
  answers: Record<string, any>;
  machinesStatus: Record<string, "running" | "stopped" | "restarting">;
  eventId?: string; // Optional: Indicates if this is an event challenge session
  isTest?: boolean; // Optional: Indicates if this is an admin test session
}

// Event Participation System Types
export interface EventParticipation {
  id: string;
  eventId: string;
  userId?: string;
  teamId?: string;
  participantType: 'player' | 'team';
  totalPoints: number;
  challengesCompleted: number;
  rank: number | null;
  registeredAt: string;
}

export interface EventSession {
  id: string;
  eventId: string;
  participationId: string;
  scenarioVersionId: string;
  mode: 'solo' | 'team';
  status: 'InProgress' | 'Completed' | 'Failed';
  score: number;
  progressPct: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface EventLeaderboardEntry {
  rank: number;
  participantType: 'player' | 'team';
  participantId: string;
  participantName: string;
  avatarUrl?: string;
  country?: string;
  totalPoints: number;
  challengesCompleted: number;
  memberCount?: number; // For teams
}

export interface RegistrationStatus {
  registered: boolean;
  type?: 'player' | 'team';
  participationId?: string;
}