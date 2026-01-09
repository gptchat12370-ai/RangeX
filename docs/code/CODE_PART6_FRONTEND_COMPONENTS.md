# Code Documentation - Part 6: Frontend Components

[← Back to Code Documentation Index](CODE_DOCUMENTATION_INDEX.md)

This document showcases critical frontend React components that implement the user interface, state management, and real-time features.

---

## 📑 Table of Contents
1. [Zustand Global State Store - Application State](#1-zustand-global-state-store---application-state)
2. [ScenarioCard Component - Challenge Display](#2-scenariocard-component---challenge-display)
3. [SshTerminal Component - Real-Time Terminal](#3-sshterminal-component---real-time-terminal)
4. [Solver API Client - Backend Communication](#4-solver-api-client---backend-communication)
5. [InChallengePage - Challenge UI Logic](#5-inchallengepage---challenge-ui-logic)

---

## 1. Zustand Global State Store - Application State

**File:** `frontend/src/lib/store.ts`

### Code Snippet (Complete File)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { tokenStore } from "../api/httpClient";
import { User, SessionState } from "../types";

interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  contrast: number;
  reducedMotion: boolean;
  compactMode: boolean;
}

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  currentSession: SessionState | null;
  setCurrentSession: (session: SessionState | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  appearance: AppearanceSettings;
  setAppearance: (settings: Partial<AppearanceSettings>) => void;
  logout: () => void;
}

const defaultAppearance: AppearanceSettings = {
  theme: "dark",
  accentColor: "cyan",
  contrast: 100,
  reducedMotion: false,
  compactMode: false,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      isAuthenticated: typeof localStorage !== "undefined" && Boolean(localStorage.getItem("rangex_access_token")),
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated: isAuthenticated }),
      currentSession: null,
      setCurrentSession: (session) => set({ currentSession: session }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      appearance: defaultAppearance,
      setAppearance: (settings) => set((state) => ({
        appearance: { ...state.appearance, ...settings }
      })),
      logout: () => {
        tokenStore.clear();
        set({ currentUser: null, isAuthenticated: false, currentSession: null });
      },
    }),
    {
      name: "rangex-storage",
      partialize: (state) => ({
        appearance: state.appearance,
        currentSession: state.currentSession,
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### Line-by-Line Explanation

**Lines 1-4:** Imports
- `zustand` - Lightweight state management (alternative to Redux)
- `persist` - Middleware to save state to localStorage
- `tokenStore` - Token management from httpClient

**Lines 6-12:** AppearanceSettings interface
- `theme` - Light/dark mode
- `accentColor` - Primary color (cyan/blue/purple/etc.)
- `contrast` - Accessibility setting (100 = normal)
- `reducedMotion` - Disable animations for accessibility
- `compactMode` - Reduce spacing for small screens

**Lines 14-29:** AppState interface
- `currentUser` - Logged-in user data
- `isAuthenticated` - Boolean flag (faster than checking token)
- `currentSession` - Active challenge session (null if none)
- `sidebarOpen` - Left navigation visibility
- `commandPaletteOpen` - Ctrl+K command palette state
- `appearance` - UI customization settings
- `logout` - Function to clear all state

**Lines 31-36:** Default appearance
- Dark theme by default (cybersecurity aesthetic)
- Cyan accent color (hacker theme)
- Normal contrast and motion

**Lines 38-68:** Zustand store creation
- **Line 38**: `create<AppState>()()` - TypeScript-safe store
- **Line 39**: `persist()` - Persist state to localStorage
- **Line 42**: Initial `currentUser: null`
- **Line 43**: Check localStorage for existing token on page load
- **Lines 45**: `currentSession: null` - No active challenge on load
- **Lines 47**: Sidebar open by default on desktop
- **Lines 53-55**: `setAppearance` - Merges partial settings (doesn't overwrite all)
- **Lines 56-59**: `logout()` - Clears tokens AND state
- **Lines 61-67**: Persistence config
  - `name: "rangex-storage"` - localStorage key
  - `partialize` - Only persist specific fields (not all)

### WHY This Matters

- **Global State**: No prop drilling (components access state directly)
- **Persistence**: User stays logged in after page refresh
- **Type Safety**: TypeScript ensures correct state usage
- **Performance**: Zustand is faster than Redux (no boilerplate)

### Key Takeaways

✅ **Zustand > Redux**: Simpler API, less boilerplate, similar performance  
✅ **Persistent Auth**: Token checked from localStorage on page load  
✅ **Partial Persistence**: Only persists `appearance`, `currentUser`, `isAuthenticated`, `currentSession`  
✅ **Logout Cleanup**: Clears tokens AND state in single function

---

## 2. ScenarioCard Component - Challenge Display

**File:** `frontend/src/components/ScenarioCard.tsx`

### Code Snippet (Lines 1-100)

```tsx
import React, { useState } from "react";
import { Clock, Users, Star, Heart, Play, ListPlus } from "lucide-react";
import { Scenario } from "../types";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { favoritesApi } from "../api/favoritesApi";
import { toast } from "sonner";
import { getDifficultyColor, getModeColor, formatDuration } from "../lib/utils";
import { getAssetUrl } from "../utils/assetUrl";

interface ScenarioCardProps {
  scenario: Scenario;
  onStart?: (scenarioId: string) => void;
  onView?: (scenarioId: string) => void;
  hasRunningSession?: boolean;
  onFavoritesChange?: () => void;
}

export function ScenarioCard({ scenario, onStart, onView, hasRunningSession = false, onFavoritesChange }: ScenarioCardProps) {
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    // Use version ID (s.id) for favorites, not parent ID
    const idToCheck = scenario.id; // Always use version ID for playlist_item FK
    if (idToCheck) {
      checkFavoriteStatus(idToCheck);
    } else {
      console.warn('[ScenarioCard] No scenario ID available:', scenario);
    }
  }, [scenario.id]);

  const checkFavoriteStatus = async (scenarioId: string) => {
    try {
      const response = await favoritesApi.checkFavorite(scenarioId);
      setIsFavorited(response.isFavorited);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    const scenarioId = scenario.id; // Use version ID for playlist_item FK
    if (favLoading || !scenarioId) {
      console.warn('[ScenarioCard] Cannot toggle favorite - no scenario ID');
      return;
    }
    try {
      setFavLoading(true);
      if (isFavorited) {
        await favoritesApi.removeFavorite(scenarioId);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(scenarioId);
        setIsFavorited(true);
        toast.success('Added to favorites');
      }
      // Trigger callback to reload favorites list
      if (onFavoritesChange) {
        onFavoritesChange();
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <>
      <Card className="group overflow-hidden hover:border-primary/50 transition-all duration-300 cyber-border">
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
        {scenario.coverImageUrl && !imageError ? (
          <img
            src={getAssetUrl(scenario.coverImageUrl)}
            alt={scenario.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => {
              console.warn(`Failed to load cover image: ${scenario.coverImageUrl}`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center cyber-grid">
            <Play className="h-16 w-16 text-primary/30" />
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <Badge className={getDifficultyColor(scenario.difficulty)}>
            {scenario.difficulty}
          </Badge>
          <Badge className={getModeColor(scenario.mode)}>{scenario.mode}</Badge>
        </div>
```

### Line-by-Line Explanation

**Lines 1-12:** Imports
- `lucide-react` - Icon library (Clock, Star, Heart, etc.)
- Shadcn UI components (Card, Button, Badge, Tooltip)
- `toast` - Toast notifications (success/error messages)
- Utility functions for colors and formatting

**Lines 14-20:** Component props
- `scenario` - Scenario data (title, difficulty, cover image, etc.)
- `onStart` - Callback when user clicks "Start" button
- `onView` - Callback when user clicks "View Details"
- `hasRunningSession` - If true, show "Resume" instead of "Start"
- `onFavoritesChange` - Callback to reload favorites list

**Lines 22-26:** Component state
- `showAddToPlaylist` - Show/hide playlist dialog
- `isFavorited` - Is this scenario in favorites?
- `favLoading` - Prevent double-click on favorite button
- `imageError` - Fallback if cover image fails to load

**Lines 28-36:** Check favorite status on mount
- **CRITICAL**: Uses `scenario.id` (version ID, not parent ID)
- Runs on component mount and when `scenario.id` changes
- Prevents unnecessary API calls

**Lines 38-45:** Check favorite status API call
- Calls `favoritesApi.checkFavorite()` endpoint
- Updates `isFavorited` state (heart icon filled/empty)
- Error handling with console.error

**Lines 47-71:** Toggle favorite (add/remove)
- **Lines 48-52**: Prevent action if loading or no ID
- **Lines 54-60**: If favorited, remove; else add
- **Lines 62-65**: Trigger `onFavoritesChange` callback (reload parent list)
- **Lines 66-69**: Error handling with toast notification
- **Line 70**: Always clear loading state (`finally` block)

**Lines 75-77:** Card container
- `group` - Tailwind group hover state (for child animations)
- `hover:border-primary/50` - Glow effect on hover
- `cyber-border` - Custom cybersecurity theme styling

**Lines 79-99:** Cover image section
- **Lines 79**: Fixed height 48 (12rem = 192px)
- **Lines 80-88**: Display cover image if available
  - `getAssetUrl()` - Converts MinIO path to full URL
  - `group-hover:scale-110` - Zoom effect on card hover
  - `onError` - Fallback to placeholder on load failure
- **Lines 90-93**: Fallback placeholder (Play icon)
- **Lines 95-99**: Difficulty and mode badges
  - `getDifficultyColor()` - Maps difficulty → Tailwind color class
  - Positioned in top-right corner

### WHY This Matters

- **Favorites Feature**: Users can bookmark favorite scenarios
- **Image Optimization**: Fallback handling for broken images
- **Hover Effects**: Smooth animations improve UX
- **State Management**: Optimistic UI updates (immediate feedback)

### Key Takeaways

✅ **Optimistic UI**: Toast appears immediately before API completes  
✅ **Fallback Handling**: Shows placeholder if cover image fails  
✅ **Hover Animations**: `group-hover:scale-110` creates zoom effect  
✅ **Loading States**: `favLoading` prevents double-clicks

---

## 3. SshTerminal Component - Real-Time Terminal

**File:** `frontend/src/components/SshTerminal.tsx`

### Code Snippet (Lines 1-120)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import 'xterm/css/xterm.css';

interface SshTerminalProps {
  sessionId: string;
  machineId: string;
  machineName: string;
  username?: string;
  password?: string;
  onClose?: () => void;
}

export const SshTerminal: React.FC<SshTerminalProps> = ({
  sessionId,
  machineId,
  machineName,
  username = 'root',
  password = 'changeme',
  onClose,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const socket = useRef<Socket | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      rows: 24,
      cols: 80,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.open(terminalRef.current);
    
    // Fit terminal to container
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 100);

    // Connect to SSH gateway
    terminal.current.writeln('\x1b[1;36m>>> Connecting to SSH gateway...\x1b[0m');
    
    // SECURITY FIX: Use session-scoped WebSocket endpoint instead of hardcoded localhost
    // Get base URL from window.location for production compatibility
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const wsUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/ssh' // Development fallback
      : `${wsProtocol}//${wsHost}:${wsPort}/ssh`; // Production
    
    socket.current = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      query: {
        sessionId, // Pass sessionId for server-side validation
      },
    });

    socket.current.on('connect', () => {
      terminal.current?.writeln('\x1b[1;32m>>> Connected to gateway\x1b[0m');
      terminal.current?.writeln(`\x1b[1;36m>>> Connecting to ${machineName}...\x1b[0m`);
      
      // Validate credentials before sending
      if (!sessionId || !machineId) {
        terminal.current?.writeln('\r\n\x1b[1;31m>>> Error: Invalid session or machine ID\x1b[0m\r\n');
        setError('Invalid connection parameters');
        return;
      }
      
      socket.current?.emit('ssh-connect', {
        sessionId,
        machineId,
        username: username || 'root',
        password: password || '',
      });
    });

    socket.current.on('ssh-ready', () => {
      terminal.current?.writeln('\x1b[1;32m>>> SSH connection established!\x1b[0m\r\n');
```

### Line-by-Line Explanation

**Lines 1-8:** Imports
- `xterm` - Terminal emulator library (like in VS Code)
- `xterm-addon-fit` - Auto-resize terminal to fit container
- `socket.io-client` - WebSocket client for real-time communication
- Lucide icons for close/maximize buttons

**Lines 10-16:** Component props
- `sessionId` - Environment session UUID (for authorization)
- `machineId` - Which container to connect to
- `machineName` - Display name (e.g., "Attacker Machine")
- `username/password` - SSH credentials (from backend)
- `onClose` - Callback to close terminal

**Lines 27-32:** React refs
- `terminalRef` - DOM element for xterm.js
- `terminal` - Xterm Terminal instance
- `socket` - Socket.IO connection
- `fitAddon` - FitAddon instance (resize terminal)
- State: `isConnected`, `isFullscreen`, `error`

**Lines 38-63:** Initialize xterm.js terminal
- **Lines 39-42**: Terminal configuration
  - `cursorBlink: true` - Blinking cursor like real terminal
  - `fontSize: 14` - Readable size
  - `fontFamily` - Monospace fonts
- **Lines 43-61**: VS Code dark theme colors
  - Matches RangeX cybersecurity theme
- **Lines 62-63**: Default size (24 rows × 80 cols)

**Lines 65-67:** Load FitAddon
- `fitAddon` - Automatically resizes terminal to fit container
- Required for responsive design

**Lines 70-74:** Fit terminal on mount
- `setTimeout` - Wait for DOM to render
- `fitAddon.fit()` - Calculate optimal size

**Lines 76-77:** Connection status message
- `\x1b[1;36m` - ANSI cyan color
- `\x1b[0m` - Reset color

**Lines 79-87:** WebSocket URL construction
- **CRITICAL SECURITY FIX**: Don't hardcode `localhost:3000`
- **Production**: Use `window.location.hostname` (works with any domain)
- **Development**: Fallback to `localhost:3000`
- `wss://` for HTTPS, `ws://` for HTTP

**Lines 89-96:** Connect to Socket.IO server
- `transports: ['websocket', 'polling']` - Try WebSocket first, fallback to polling
- `reconnection: true` - Auto-reconnect on disconnect
- `query: { sessionId }` - Pass session ID for server-side authorization

**Lines 98-115:** Handle connection events
- **Line 98**: `connect` event - Gateway connection established
- **Line 99-100**: Print success messages in green
- **Lines 103-107**: Validate session/machine IDs before sending credentials
- **Lines 109-113**: Emit `ssh-connect` event with credentials
  - Backend will validate session ID matches user
  - Backend will SSH into container

**Lines 117-118:** Handle SSH ready event
- Terminal is now connected to container
- User can type commands

### WHY This Matters

- **Real-Time Terminal**: WebSocket enables low-latency SSH
- **Security**: Session ID passed in WebSocket query prevents unauthorized access
- **Production Ready**: Dynamic WebSocket URL works with any domain
- **User Experience**: xterm.js provides native terminal feel

### Key Takeaways

✅ **WebSocket for SSH**: Low-latency real-time terminal (not polling)  
✅ **Dynamic URL**: Uses `window.location` for production compatibility  
✅ **Session Authorization**: `sessionId` query parameter validates user owns session  
✅ **FitAddon**: Auto-resizes terminal to fit container (responsive design)

---

## 4. Solver API Client - Backend Communication

**File:** `frontend/src/api/solverApi.ts`

### Code Snippet (Lines 1-110)

```typescript
import { httpClient } from "./httpClient";
import type { SessionState } from "../types";

export interface ScenarioSummary {
  id: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  tags?: string[];
}

export interface StartEnvironmentResponse {
  sessionId: string;
  softBudgetWarning: boolean;
}

export interface ApiErrorBody {
  code?: string;
  message: string;
  details?: Record<string, any>;
}

export interface MachineEntrypoint {
  protocol: string;
  containerPort: number;
  exposedToSolver: boolean;
  description?: string;
  proxyPath?: string;
  connectionUrl?: string;
  sshCommand?: string;
}

export interface MachineConnectionDetails {
  machineId: string;
  machineName: string;
  role: string;
  status: string;
  privateIp?: string;
  entrypoints: MachineEntrypoint[];
  credentials: {
    username: string;
    password: string;
  };
  canAccess: boolean;
}

export interface SessionConnectionInfo {
  sessionId: string;
  status: string;
  gatewayIp?: string;
  sessionToken?: string;
  machines: MachineConnectionDetails[];
}

export const solverApi = {
  async listScenarios() {
    const { data } = await httpClient.get<ScenarioSummary[]>("/solver/scenarios");
    return data;
  },

  async getScenarioDetail(id: string) {
    const { data } = await httpClient.get(`/solver/scenarios/${id}/detail`);
    return data;
  },

  async startScenario(
    scenarioVersionId: string,
    options?: { ttlMinutes?: number; envProfile?: string; isTest?: boolean; eventId?: string; teamId?: string }
  ) {
    try {
      const { data } = await httpClient.post<StartEnvironmentResponse>(
        `/solver/scenarios/${scenarioVersionId}/start`,
        options || {}
      );
      return data;
    } catch (err: any) {
      const body: ApiErrorBody | undefined = err.response?.data;
      if (body?.code) {
        throw body;
      }
      throw err;
    }
  },

  async getSession(sessionId: string) {
    const { data } = await httpClient.get<SessionState>(`/solver/sessions/${sessionId}`);
    return data;
  },

  async answerQuestion(sessionId: string, questionId: string, payload: any) {
    const { data } = await httpClient.post<SessionState>(`/solver/sessions/${sessionId}/questions/${questionId}/answer`, payload);
    return data;
  },

  async heartbeat(sessionId: string) {
    const { data } = await httpClient.post<SessionState>(`/solver/sessions/${sessionId}/heartbeat`, {});
    return data;
  },

  async stopSession(sessionId: string) {
    const { data } = await httpClient.post<{ sessionId: string; status: string }>(`/solver/sessions/${sessionId}/stop`, {});
    return data;
  },

  async getSessionConnections(sessionId: string) {
    const { data } = await httpClient.get<SessionConnectionInfo>(`/solver/sessions/${sessionId}/connection`);
    return data;
  },

  async getMachineConnection(sessionId: string, machineId: string) {
    const { data } = await httpClient.get<MachineConnectionDetails>(`/solver/sessions/${sessionId}/machines/${machineId}/connection`);
    return data;
  },
};
```

### Line-by-Line Explanation

**Lines 1-2:** Imports
- `httpClient` - Axios instance with auth headers
- `SessionState` - TypeScript type for session data

**Lines 4-10:** ScenarioSummary interface
- Minimal scenario data for list view
- Used in Challenges page cards

**Lines 12-15:** StartEnvironmentResponse
- `sessionId` - UUID of new session
- `softBudgetWarning` - If true, show budget warning to user

**Lines 17-21:** ApiErrorBody interface
- `code` - Error code (e.g., "BUDGET_EXCEEDED")
- `message` - Human-readable error
- `details` - Extra context (e.g., `{ budgetLimitRm: 10 }`)

**Lines 23-31:** MachineEntrypoint interface
- `protocol` - "ssh", "http", "vnc"
- `containerPort` - Port inside container (e.g., 22 for SSH)
- `exposedToSolver` - Can user access this port?
- `connectionUrl` - Full URL (e.g., `https://rangex.com/proxy/abc123/8080`)

**Lines 33-45:** MachineConnectionDetails
- Complete connection info for one machine
- `credentials` - Username/password for SSH/VNC
- `canAccess` - If false, machine is internal (no access)

**Lines 47-53:** SessionConnectionInfo
- All machines in session
- `gatewayIp` - Private IP of gateway container
- `sessionToken` - JWT for WebSocket auth

**Lines 55-58:** List scenarios
- GET `/solver/scenarios`
- Returns array of scenario summaries

**Lines 60-63:** Get scenario detail
- GET `/solver/scenarios/:id/detail`
- Returns full scenario (mission, questions, machines, etc.)

**Lines 65-80:** Start scenario
- POST `/solver/scenarios/:id/start`
- **Options**: TTL, resource profile, test mode, event/team IDs
- **Error handling**: Extracts error code (e.g., budget exceeded)

**Lines 82-85:** Get session state
- GET `/solver/sessions/:id`
- Returns current status, score, answers, etc.

**Lines 87-90:** Submit answer
- POST `/solver/sessions/:id/questions/:qid/answer`
- Returns updated session state (with new score)

**Lines 92-95:** Heartbeat (keep-alive)
- POST `/solver/sessions/:id/heartbeat`
- Updates `lastActivityAt` timestamp (prevents timeout)

**Lines 97-100:** Stop session
- POST `/solver/sessions/:id/stop`
- Triggers graceful shutdown of containers

**Lines 102-105:** Get connection info
- GET `/solver/sessions/:id/connection`
- Returns gateway IP, session token, machine credentials

**Lines 107-110:** Get single machine connection
- GET `/solver/sessions/:id/machines/:mid/connection`
- Returns SSH command, VNC URL, etc.

### WHY This Matters

- **Type Safety**: TypeScript interfaces prevent API misuse
- **Error Handling**: Extracts structured error codes from responses
- **Centralized API**: All backend calls in one file (easy to maintain)
- **Reusable**: Components import `solverApi` instead of calling httpClient directly

### Key Takeaways

✅ **TypeScript Interfaces**: Strongly typed API responses (catch errors at compile time)  
✅ **Error Handling**: Extracts `code` from API errors (e.g., `BUDGET_EXCEEDED`)  
✅ **Heartbeat Endpoint**: Prevents auto-logout during challenges  
✅ **Connection Info**: Provides SSH commands, VNC URLs, HTTP proxy paths

---

## 5. InChallengePage - Challenge UI Logic

**File:** `frontend/src/pages/InChallengePage.tsx`

### Code Snippet (Lines 1-150)

```tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Timer,
  Trophy,
  HelpCircle,
  LogOut,
  Server,
  ListChecks,
  BookOpen,
  RotateCw,
  Power,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Lightbulb,
  Shield,
  Zap,
  Info,
  Network,
  Activity,
  Cpu,
  Download,
  FileText,
  ArrowRight,
  GripVertical,
  Clock,
  Lock,
  Monitor,
  ArrowLeft,
} from "lucide-react";
import { Scenario, Question, SessionState } from "../types";
import { solverApi } from "../api/solverApi";
import { useStore } from "../lib/store";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Alert, AlertDescription } from "../components/ui/alert";
import { getDifficultyColor, formatDuration, copyToClipboard, cn } from "../lib/utils";
import { SshTerminal } from "../components/SshTerminal";

// Fisher-Yates shuffle algorithm to randomize question order
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface InChallengePageProps {
  onExit: () => void;
}

export function InChallengePage({ onExit }: InChallengePageProps) {
  const { sessionId, scenarioId } = useParams<{ sessionId: string; scenarioId: string }>();
  const { currentUser, setCurrentUser, currentSession, setCurrentSession } = useStore();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [machineConnections, setMachineConnections] = useState<Record<string, any>>({});
  const [sshTerminals, setSshTerminals] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [passwordsVisible, setPasswordsVisible] = useState<Record<string, boolean>>({});
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exitMode, setExitMode] = useState<"keep" | "terminate">("keep");
  const [viewedHints, setViewedHints] = useState<Set<string>>(new Set());
  const [hintPenaltyTotal, setHintPenaltyTotal] = useState(0);

  // Add styles for mission content images
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .mission-content img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
      }
      .mission-content p {
        margin: 0.75rem 0;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!scenarioId) return;
      
      // Check if we need to load session first to determine if it's a test
      let sessionData = session;
      if (!sessionData && sessionId) {
        try {
          sessionData = await solverApi.getSession(sessionId);
          setSession(sessionData);
          setCurrentSession(sessionData);
        } catch (err) {
          toast.error("Failed to load session");
          return;
        }
      }
      
      try {
        let scenarioData;
        
        // For admin test sessions, fetch from admin API
        if (sessionData?.isTest) {
          const adminApi = await import('../api/adminApi');
          const rawData = await adminApi.adminApi.getScenarioVersionDetails(scenarioId);
          
          // Transform machines to include expected frontend fields
          const transformedMachines = (rawData.machines || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            kind: m.role === 'attacker' ? 'Attacker' : m.role === 'internal' ? 'Internal Server' : 'Server',
            access: m.entrypoints?.map((e: any) => e.protocol.toUpperCase()) || [],
            solverCanAccess: m.allowSolverEntry || false,
            icon: m.role === 'attacker' ? 'laptop' : 'server',
          }));
          
          // Transform to match expected format
          scenarioData = {
            id: rawData.id,
            title: rawData.title || "Untitled",
            shortDesc: rawData.shortDescription || "",
```

### Line-by-Line Explanation

**Lines 1-57:** Massive imports
- React Router for URL params
- Lucide icons (30+ icons imported)
- Shadcn UI components (Card, Button, Tabs, etc.)
- `solverApi` for backend calls
- `useStore` for global state

**Lines 60-68:** Fisher-Yates shuffle
- Randomizes question order
- Prevents memorization of answer positions
- Used in some scenarios (configurable)

**Lines 73-90:** Component state
- `scenario` - Full scenario data (mission, questions, machines)
- `session` - Session state (score, answers, timer)
- `machineConnections` - SSH credentials, connection URLs
- `sshTerminals` - Which terminals are open (Record<machineId, boolean>)
- `answers` - User's typed answers (Record<questionId, string>)
- `passwordsVisible` - Show/hide password fields
- `showExitDialog` - Confirm exit popup
- `viewedHints` - Which hints user has viewed (Set<hintId>)
- `hintPenaltyTotal` - Points lost from viewing hints

**Lines 93-107:** Inject CSS for mission content
- Styles for images in mission text (HTML content)
- `max-width: 100%` - Prevent overflow
- `border-radius: 0.5rem` - Rounded corners
- Cleanup on unmount (remove style tag)

**Lines 109-150:** Load scenario and session data
- **Lines 113-121**: Load session first if not already loaded
  - `sessionId` from URL params
  - `setCurrentSession()` - Save to Zustand store
- **Lines 126-148**: Load scenario data
  - **If `isTest` (admin testing)**: Use admin API endpoint
  - **Else**: Use solver API endpoint
  - **Transform machines**: Map backend format to frontend format
    - `role: 'attacker'` → `kind: 'Attacker'`, `icon: 'laptop'`
    - `role: 'internal'` → `kind: 'Internal Server'`, `icon: 'server'`

### WHY This Matters

- **Complex State**: Manages session, scenario, machines, answers, hints, terminals
- **Admin Testing**: Supports testing unpublished scenarios
- **Machine Transformation**: Backend and frontend use different field names
- **Hint Tracking**: Tracks which hints viewed for scoring penalties

### Key Takeaways

✅ **Fisher-Yates Shuffle**: Randomizes question order (prevents memorization)  
✅ **Admin Test Mode**: Uses admin API if `session.isTest === true`  
✅ **Machine Transformation**: Maps `role` → `kind` and `icon`  
✅ **Hint Penalty**: Tracks viewed hints for score reduction

---

## Related Documentation

- **← [Part 5: Business Logic Services](CODE_PART5_BUSINESS_LOGIC.md)** - Backend services called by frontend
- **[Part 3: Core API Endpoints](CODE_PART3_API_ENDPOINTS.md)** - REST endpoints used by `solverApi`
- **[UI Documentation Index](../ui/UI_DOCUMENTATION_INDEX.md)** - All frontend pages and features
- **[Architecture Overview](../ARCHITECTURE_OVERVIEW.md)** - How frontend fits into system

---

## Quick Reference: Component Purposes

| Component/File | Purpose | Key Feature |
|----------------|---------|-------------|
| **store.ts** | Global state management | Persists auth and appearance to localStorage |
| **ScenarioCard.tsx** | Challenge card display | Favorites, hover effects, cover images |
| **SshTerminal.tsx** | Real-time SSH terminal | WebSocket-based xterm.js integration |
| **solverApi.ts** | Backend API client | Type-safe API calls with error handling |
| **InChallengePage.tsx** | Challenge UI | Manages session, answers, hints, machines |

---

**Last Updated:** 2025  
**Status:** ✅ Complete
