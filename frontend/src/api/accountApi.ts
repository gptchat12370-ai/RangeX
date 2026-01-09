import { httpClient } from "./httpClient";
import type { User, ScenarioHistory } from "../types";

export const accountApi = {
  async me(): Promise<User> {
    const { data } = await httpClient.get<User>("/account/me");
    return data;
  },
  async updateProfile(payload: { displayName?: string; avatarUrl?: string }): Promise<User> {
    const { data } = await httpClient.post<User>("/account/profile", payload);
    return data;
  },
  async history(): Promise<ScenarioHistory[]> {
    const { data } = await httpClient.get<ScenarioHistory[]>("/account/history");
    return data;
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const { data } = await httpClient.post("/account/change-password", payload);
    return data;
  },
  async enable2FA(): Promise<{ code: string; message: string }> {
    const { data } = await httpClient.post("/account/2fa/enable");
    return data;
  },
  async verify2FA(payload: { verificationCode: string }): Promise<{ success: boolean; message: string }> {
    const { data } = await httpClient.post("/account/2fa/verify", payload);
    return data;
  },
  async disable2FA(): Promise<{ success: boolean; message: string }> {
    const { data } = await httpClient.post("/account/2fa/disable");
    return data;
  },
  async uploadAvatar(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post<User>("/account/upload-avatar", formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getMyBadges(): Promise<any[]> {
    const { data } = await httpClient.get("/account/badges");
    return data;
  },
};
