import { httpClient } from "./httpClient";

export const eventsApi = {
  // List all events - uses public endpoint accessible to all authenticated users
  async listEvents() {
    const { data } = await httpClient.get("/events");
    return data;
  },

  // Get single event - uses public endpoint
  async getEvent(id: string) {
    const { data } = await httpClient.get(`/events/${id}`);
    return data;
  },

  // Create event
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

  // Update event
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

  // Delete event
  async deleteEvent(id: string) {
    const { data } = await httpClient.delete(`/events/${id}`);
    return data;
  },

  // OLD: Register for event (legacy endpoint)
  async registerForEvent(id: string) {
    const { data } = await httpClient.post(`/events/${id}/register`);
    return data;
  },

  // OLD: Unregister from event (legacy endpoint)
  async unregisterFromEvent(id: string) {
    const { data } = await httpClient.delete(`/events/${id}/register`);
    return data;
  },

  // NEW: Register player for event
  async registerPlayerForEvent(eventId: string) {
    const { data } = await httpClient.post(
      `/events/${eventId}/register-player`
    );
    return data;
  },

  // NEW: Register team for event
  async registerTeamForEvent(eventId: string, teamId: string) {
    const { data } = await httpClient.post(
      `/events/${eventId}/register-team`,
      { teamId }
    );
    return data;
  },

  // NEW: Unregister from event (new participation system)
  async unregisterFromEventNew(eventId: string) {
    const { data } = await httpClient.delete(
      `/events/${eventId}/unregister-participation`
    );
    return data;
  },

  // NEW: Get event leaderboard
  async getEventLeaderboard(eventId: string) {
    const { data } = await httpClient.get(
      `/events/${eventId}/leaderboard`
    );
    return data;
  },

  // NEW: Get registration status
  async getRegistrationStatus(eventId: string) {
    const { data } = await httpClient.get(
      `/events/${eventId}/registration-status`
    );
    return data;
  },

  // NEW: Start event session
  async startEventSession(eventId: string, scenarioVersionId: string) {
    const { data } = await httpClient.post(
      `/events/${eventId}/start-session`,
      { scenarioVersionId }
    );
    return data;
  },

  // NEW: Complete event session
  async completeEventSession(
    eventId: string, 
    sessionId: string, 
    score: number, 
    status: 'Completed' | 'Failed'
  ) {
    const { data } = await httpClient.put(
      `/events/${eventId}/complete-session/${sessionId}`,
      { score, status }
    );
    return data;
  },

  async getEventParticipants(eventId: string) {
    const { data } = await httpClient.get(`/events/${eventId}/participants`);
    return data;
  },

  // NEW: Get active event session for user
  async getActiveEventSession(eventId: string) {
    const { data } = await httpClient.get(`/events/${eventId}/active-session`);
    return data;
  },

  // Get all user sessions for an event (for progress tracking)
  async getMyEventSessions(eventId: string) {
    const { data } = await httpClient.get(`/events/${eventId}/my-sessions`);
    return data;
  },
};
