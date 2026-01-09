import { httpClient, tokenStore } from "./httpClient";
import type { User } from "../types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user?: User;
  csrfToken?: string;
}

export const authApi = {
  async getCsrfToken() {
    const { data } = await httpClient.get<{ csrfToken: string }>("/auth/csrf-token");
    if (data.csrfToken) {
      tokenStore.setCsrf(data.csrfToken);
    }
    return data.csrfToken;
  },

  async login(payload: LoginRequest) {
    const { data } = await httpClient.post<AuthResponse>("/auth/login", payload);
    tokenStore.set(data.accessToken, data.refreshToken);
    if (data.csrfToken) {
      tokenStore.setCsrf(data.csrfToken);
    }
    return data;
  },

  async refresh() {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) throw new Error("No refresh token set");
    const { data } = await httpClient.post<AuthResponse>("/auth/refresh", { refreshToken });
    tokenStore.set(data.accessToken, data.refreshToken);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return httpClient.post("/auth/change-password", { currentPassword, newPassword });
  },
};
