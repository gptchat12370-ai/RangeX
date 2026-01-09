import { httpClient } from "./httpClient";

export interface SystemSettings {
  max_active_users: number;
  max_envs_per_user: number;
  max_concurrent_envs_global: number;
  env_default_duration_minutes: number;
  soft_usage_limit_rm: number;
  hard_usage_limit_rm: number;
  fargate_vcpu_price_per_hour_rm: number;
  fargate_memory_price_per_gb_hour_rm: number;
  maintenance_mode: boolean;
}

export interface UsageDailyRow {
  date: string;
  envHoursMicro: number;
  envHoursSmall: number;
  envHoursMedium: number;
  envHoursLarge: number;
  totalEstimatedCostRm: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  roleAdmin: boolean;
  roleCreator: boolean;
  roleSolver: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  avatarUrl?: string;
}

export const adminApi = {
  async getSettings(): Promise<SystemSettings> {
    const { data } = await httpClient.get<Record<string, string>>("/admin/settings");
    return {
      max_active_users: Number(data.max_active_users ?? 5),
      max_envs_per_user: Number(data.max_envs_per_user ?? 1),
      max_concurrent_envs_global: Number(data.max_concurrent_envs_global ?? 5),
      env_default_duration_minutes: Number(data.env_default_duration_minutes ?? 90),
      soft_usage_limit_rm: Number(data.soft_usage_limit_rm ?? 250),
      hard_usage_limit_rm: Number(data.hard_usage_limit_rm ?? 300),
      fargate_vcpu_price_per_hour_rm: Number(data.fargate_vcpu_price_per_hour_rm ?? 0.25),
      fargate_memory_price_per_gb_hour_rm: Number(data.fargate_memory_price_per_gb_hour_rm ?? 0.03),
      maintenance_mode: data.maintenance_mode === "1" || data.maintenance_mode === "true" || (data.maintenance_mode as any) === true,
    };
  },

  async updateSettings(payload: Partial<SystemSettings>) {
    const { data } = await httpClient.put("/admin/settings", payload);
    return data;
  },

  // Approvals
  async listPendingScenarios() {
    const { data } = await httpClient.get("/admin/scenario-approvals");
    return data;
  },
  async listApprovedScenarios() {
    const { data } = await httpClient.get("/admin/scenarios/approved");
    return data;
  },
  async listTestingScenarios() {
    const { data } = await httpClient.get("/admin/scenarios/testing");
    return data;
  },
  async getScenarioVersionDetails(versionId: string) {
    const { data } = await httpClient.get(`/admin/scenarios/${versionId}/details`);
    return data;
  },
  async toggleScenarioVisibility(versionId: string) {
    console.log('[adminApi] toggleScenarioVisibility called with versionId:', versionId);
    try {
      const { data } = await httpClient.patch(`/admin/scenarios/${versionId}/toggle-visibility`);
      console.log('[adminApi] toggleScenarioVisibility response:', data);
      return data;
    } catch (error: any) {
      console.error('[adminApi] toggleScenarioVisibility error:', error);
      console.error('[adminApi] Error response:', error?.response?.data);
      throw error;
    }
  },
  async pendingScenarioCount() {
    const { data } = await httpClient.get("/admin/scenario-approvals/count");
    return data?.pending ?? 0;
  },
  async approveScenario(versionId: string, notes?: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/approve`, { notes });
    return data;
  },
  async rejectScenario(versionId: string, reason: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/reject`, { reason });
    return data;
  },
  async disableScenario(versionId: string, reason: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/disable`, { reason });
    return data;
  },
  async unapproveScenario(versionId: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/unapprove`);
    return data;
  },
  async publishScenario(versionId: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/publish`);
    return data;
  },
  async deleteScenarioVersion(versionId: string) {
    const { data } = await httpClient.delete(`/admin/scenario-versions/${versionId}`);
    return data;
  },
  async archiveOldVersions(scenarioId: string) {
    const { data } = await httpClient.post(`/admin/scenarios/${scenarioId}/archive-old-versions`);
    return data;
  },
  async deleteScenario(scenarioId: string) {
    const { data } = await httpClient.delete(`/admin/scenarios/${scenarioId}`);
    return data;
  },
  async revertToDraft(versionId: string, reason?: string) {
    const { data } = await httpClient.post(`/admin/scenario-approvals/${versionId}/revert-to-draft`, { reason });
    return data;
  },

  // Registry credentials
  async listRegistryCreds() {
    const { data } = await httpClient.get("/admin/registry");
    return data;
  },
  async createRegistryCred(payload: any) {
    const { data } = await httpClient.post("/admin/registry", payload);
    return data;
  },
  async updateRegistryCred(id: string, payload: any) {
    const { data } = await httpClient.put(`/admin/registry/${id}`, payload);
    return data;
  },
  async deleteRegistryCred(id: string) {
    const { data } = await httpClient.delete(`/admin/registry/${id}`);
    return data;
  },
  async testRegistryCred(id: string) {
    const { data } = await httpClient.post(`/admin/registry/${id}/test`);
    return data;
  },

  // Assets (admin delete)
  async deleteAsset(id: string) {
    const { data } = await httpClient.delete(`/admin/assets/${id}`);
    return data;
  },

  async terminateSession(sessionId: string) {
    return httpClient.post(`/admin/sessions/${sessionId}/terminate`);
  },

  async getActiveTestSessions() {
    const { data } = await httpClient.get("/admin/test-sessions/active");
    return data;
  },

  async dailyUsage(): Promise<UsageDailyRow[]> {
    const { data } = await httpClient.get<UsageDailyRow[]>("/admin/usage/daily");
    return data;
  },

  async listPlatformImages() {
    const { data } = await httpClient.get("/admin/platform-images");
    return data;
  },

  async createPlatformImage(payload: {
    label: string;
    imageRef: string;
    compatibleAttacker: boolean;
    compatibleInternal: boolean;
    compatibleService: boolean;
    resourceProfile: string;
    isActive?: boolean;
  }) {
    const { data } = await httpClient.post("/admin/platform-images", payload);
    return data;
  },

  async updatePlatformImage(id: string, payload: Partial<{ label: string; imageRef: string; resourceProfile: string; isActive: boolean }>) {
    const { data } = await httpClient.put(`/admin/platform-images/${id}`, payload);
    return data;
  },

  async listUsers(): Promise<AdminUser[]> {
    const { data } = await httpClient.get<AdminUser[]>("/admin/users");
    return data;
  },

  async createUser(payload: {
    email: string;
    displayName: string;
    password: string;
    role: "solver" | "creator" | "admin";
    isActive?: boolean;
    avatarUrl?: string;
  }): Promise<AdminUser> {
    const { data } = await httpClient.post("/admin/users", payload);
    return data;
  },

  async updateUser(
    id: string,
    payload: Partial<{ displayName: string; role: "solver" | "creator" | "admin"; isActive: boolean; avatarUrl?: string }>
  ): Promise<AdminUser> {
    const { data } = await httpClient.put(`/admin/users/${id}`, payload);
    return data;
  },

  async listSessions() {
    const { data } = await httpClient.get("/admin/sessions");
    return data;
  },

  // Audit logs
  async listAuditLogs(params?: { limit?: number; offset?: number; actionType?: string }) {
    const { data } = await httpClient.get("/admin/audit-logs", { params });
    return data;
  },
  async auditStats() {
    const { data } = await httpClient.get("/admin/audit-logs/stats");
    return data;
  },

  // Badges
  async listBadges() {
    const { data } = await httpClient.get("/admin/badges");
    return data;
  },

  async createBadge(payload: any) {
    const { data } = await httpClient.post("/admin/badges", payload);
    return data;
  },

  async updateBadge(id: string, payload: any) {
    const { data } = await httpClient.put(`/admin/badges/${id}`, payload);
    return data;
  },

  // ...existing code...
  async deleteBadge(id: string) {
    const { data } = await httpClient.delete(`/admin/badges/${id}`);
    return data;
  },

  async getAuditLogs() {
    const { data } = await httpClient.get("/admin/audit-logs");
    return data;
  },

  // Tools Management
  async listTools() {
    const { data } = await httpClient.get("/admin/tools");
    return data;
  },

  async createTool(payload: any) {
    const { data } = await httpClient.post("/admin/tools", payload);
    return data;
  },

  async updateTool(id: string, payload: any) {
    const { data } = await httpClient.put(`/admin/tools/${id}`, payload);
    return data;
  },

  async deleteTool(id: string) {
    const { data } = await httpClient.delete(`/admin/tools/${id}`);
    return data;
  },

  // Admin Cloud Tests
  async startAdminTest(versionId: string) {
    const { data } = await httpClient.post(`/admin/scenarios/${versionId}/test`);
    return data;
  },

  async getAdminTestResult(testId: string) {
    const { data } = await httpClient.get(`/admin/scenarios/tests/${testId}`);
    return data;
  },

  async getLatestAdminTest(versionId: string) {
    const { data } = await httpClient.get(`/admin/scenarios/${versionId}/latest-test`);
    return data;
  },

  async terminateAdminTestSession(testId: string) {
    const { data } = await httpClient.post(`/admin/scenarios/tests/${testId}/terminate`);
    return data;
  },
};
