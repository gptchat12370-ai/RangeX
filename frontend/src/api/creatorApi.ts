import { httpClient } from "./httpClient";

export interface RegistryCredentialInput {
  label: string;
  registryUrl: string;
  username: string;
  passwordOrToken: string;
}

export const creatorApi = {
  async listScenarios(opts?: { all?: boolean }) {
    const { data } = await httpClient.get("/creator/scenarios", {
      params: opts?.all ? { all: 1 } : {},
    });
    return data;
  },

  async getScenarioVersion(scenarioId: string, versionId: string) {
    const { data } = await httpClient.get(`/creator/scenarios/${scenarioId}/versions/${versionId}`);
    return data;
  },

  async deleteScenario(id: string) {
    const { data } = await httpClient.delete(`/creator/scenarios/${id}`);
    return data;
  },

  async deleteScenarioVersion(scenarioId: string, versionId: string) {
    const { data } = await httpClient.delete(`/creator/scenarios/${scenarioId}/versions/${versionId}`);
    return data;
  },

  async duplicateScenario(id: string) {
    const { data } = await httpClient.post(`/creator/scenarios/${id}/duplicate`, {});
    return data;
  },

  async listPlaylists() {
    const { data } = await httpClient.get("/creator/playlists");
    return data;
  },

  async ensureFavoritesPlaylist(userId: string) {
    const { data } = await httpClient.get(`/creator/playlists/ensure-favorites/${userId}`);
    return data;
  },

  async createPlaylist(payload: {
    title: string;
    description?: string;
    isPublic?: boolean;
    items?: { scenarioVersionId: string; sortOrder?: number }[];
  }) {
    const { data } = await httpClient.post("/creator/playlists", payload);
    return data;
  },

  async updatePlaylist(id: string, payload: {
    title?: string;
    description?: string;
    isPublic?: boolean;
    items?: { scenarioVersionId: string; sortOrder?: number }[];
  }) {
    const { data } = await httpClient.put(`/creator/playlists/${id}`, payload);
    return data;
  },

  async deletePlaylist(id: string) {
    const { data } = await httpClient.delete(`/creator/playlists/${id}`);
    return data;
  },

  async replacePlaylistItems(id: string, items: { scenarioVersionId: string; sortOrder?: number }[]) {
    const { data } = await httpClient.post(`/creator/playlists/${id}/items`, { items });
    return data;
  },

  // ===== Image Variant & Environment Management =====
  async getImageVariants() {
    const { data } = await httpClient.get("/creator/environment/image-variants");
    return data;
  },

  async getImageVariantsByRole(role: string) {
    const { data } = await httpClient.get(`/creator/environment/image-variants/role/${role}`);
    return data;
  },

  async getImageVariantById(id: string) {
    const { data } = await httpClient.get(`/creator/environment/image-variants/${id}`);
    return data;
  },

  async calculateImageVariantCost(payload: { variantIds: string[]; hours: number }) {
    const { data } = await httpClient.post("/creator/environment/image-variants/calculate-cost", payload);
    return data;
  },

  async generateDockerCompose(scenarioVersionId: string) {
    const { data } = await httpClient.post(`/creator/environment/scenario/${scenarioVersionId}/generate-compose`);
    return data;
  },

  async validateDockerComposeSync(scenarioVersionId: string, dockerCompose: string) {
    const { data } = await httpClient.post(`/creator/environment/scenario/${scenarioVersionId}/validate-sync`, {
      dockerCompose,
    });
    return data;
  },

  async getScenarioMachines(scenarioVersionId: string) {
    const { data } = await httpClient.get(`/creator/environment/scenario/${scenarioVersionId}/machines`);
    return data;
  },

  async updateMachine(machineId: string, payload: any) {
    const { data } = await httpClient.put(`/creator/machines/${machineId}`, payload);
    return data;
  },

  async createScenario(payload: any, parentScenarioId?: string | null) {
    const body = parentScenarioId ? { ...payload, baseScenarioId: parentScenarioId } : payload;
    console.log('[creatorApi] createScenario called');
    console.log('[creatorApi] parentScenarioId:', parentScenarioId);
    console.log('[creatorApi] body keys:', Object.keys(body));
    console.log('[creatorApi] questions count:', body.questions?.length || 0);
    
    try {
      const { data } = await httpClient.post("/creator/scenarios", body);
      console.log('[creatorApi] createScenario response:', data);
      return {
        scenarioId: data.scenarioId ?? data.id,
        versionId: data.versionId ?? data.latestVersionId ?? data.latestVersion?.id,
        raw: data,
      };
    } catch (error: any) {
      console.error('[creatorApi] createScenario error:', error);
      console.error('[creatorApi] Error response:', error?.response?.data);
      console.error('[creatorApi] Error status:', error?.response?.status);
      throw error;
    }
  },

  async updateScenarioVersion(scenarioId: string, versionId: string, payload: any) {
    const { data } = await httpClient.put(`/creator/scenarios/${scenarioId}/versions/${versionId}`, payload);
    return data;
  },

  async validateImage(imageRef: string) {
    // Backend validation lives server-side; this endpoint can be added later.
    return httpClient.post("/creator/images/validate", { imageRef });
  },

  async createRegistryCredential(input: RegistryCredentialInput) {
    const { data } = await httpClient.post("/admin/registry", input);
    return data;
  },

  // Career paths
  async listCareerPaths() {
    const { data } = await httpClient.get("/creator/career-paths");
    return data;
  },
  async getCareerPath(id: string) {
    const { data } = await httpClient.get(`/creator/career-paths/${id}`);
    return data;
  },
  async createCareerPath(payload: {
    title: string;
    description?: string;
    isPublic?: boolean;
    items?: { scenarioVersionId: string; sortOrder?: number }[];
  }) {
    const { data } = await httpClient.post("/creator/career-paths", payload);
    return data;
  },
  async updateCareerPath(id: string, payload: {
    title?: string;
    description?: string;
    isPublic?: boolean;
    items?: { scenarioVersionId: string; sortOrder?: number }[];
  }) {
    const { data } = await httpClient.put(`/creator/career-paths/${id}`, payload);
    return data;
  },
  async deleteCareerPath(id: string) {
    const { data } = await httpClient.delete(`/creator/career-paths/${id}`);
    return data;
  },

  // Events
  async listEvents() {
    const { data } = await httpClient.get("/events");
    return data;
  },
  async getEvent(id: string) {
    const { data } = await httpClient.get(`/events/${id}`);
    return data;
  },
  async createEvent(payload: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    timezone?: string;
    maxParticipants?: number;
    format?: string;
    registrationRequired?: boolean;
    scenarios?: { scenarioVersionId: string; sortOrder?: number }[];
  }) {
    const { data } = await httpClient.post("/events", payload);
    return data;
  },
  async updateEvent(id: string, payload: Partial<{
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    timezone?: string;
    maxParticipants?: number;
    format?: string;
    registrationRequired?: boolean;
    scenarios?: { scenarioVersionId: string; sortOrder?: number }[];
  }>) {
    const { data } = await httpClient.put(`/events/${id}`, payload);
    return data;
  },
  async deleteEvent(id: string) {
    const { data } = await httpClient.delete(`/events/${id}`);
    return data;
  },

  async registerForEvent(id: string) {
    const { data } = await httpClient.post(`/events/${id}/register`);
    return data;
  },

  async unregisterFromEvent(id: string) {
    const { data } = await httpClient.delete(`/events/${id}/register`);
    return data;
  },

  async submitScenarioVersion(scenarioId: string, versionId: string) {
    const { data } = await httpClient.post(`/creator/scenario/${versionId}/submit-for-review`, {});
    return data;
  },

  async uploadCoverImage(scenarioId: string, versionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await httpClient.post(
      `/creator/scenarios/${scenarioId}/versions/${versionId}/upload-cover`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },

  async uploadAsset(scenarioId: string, versionId: string, formData: FormData) {
    const { data } = await httpClient.post(
      `/creator/scenarios/${scenarioId}/versions/${versionId}/upload-asset`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },

  async deleteAsset(scenarioId: string, versionId: string, fileUrl: string) {
    const { data } = await httpClient.delete(
      `/creator/scenarios/${scenarioId}/versions/${versionId}/asset`,
      { data: { fileUrl } }
    );
    return data;
  },

  // Helper for builder: fetch a single scenario + latest version for editing
  async getScenarioForEdit(id: string) {
    try {
      const list = await this.listScenarios({ all: true });
      const found = (list || []).find((s: any) => s.id === id);
      if (!found?.latestVersion) return null;
      return {
        scenarioId: found.id,
        versionId: found.latestVersion.id,
        ...found.latestVersion,
        status: found.latestVersion.status,
      };
    } catch {
      return null;
    }
  },
};
