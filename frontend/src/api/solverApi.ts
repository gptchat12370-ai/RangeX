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
