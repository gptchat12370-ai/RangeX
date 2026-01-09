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
