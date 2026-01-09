import { httpClient } from "./httpClient";

export interface Settings {
  theme: "light" | "dark" | "system";
  accentColor: "cyan" | "blue" | "purple" | "green" | "orange" | "red";
  contrast: number;
  reducedMotion: boolean;
  compactMode: boolean;
}

export const settingsApi = {
  async get(): Promise<Settings> {
    const { data } = await httpClient.get<Settings>("/settings");
    return data;
  },
  async updateAppearance(payload: Partial<Settings>) {
    const { data } = await httpClient.post<Settings>("/settings/appearance", payload);
    return data;
  },
  async updateNotifications(payload: Record<string, boolean>) {
    const { data } = await httpClient.post("/settings/notifications", payload);
    return data;
  },
};
