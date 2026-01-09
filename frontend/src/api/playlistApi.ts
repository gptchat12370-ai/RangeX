import { httpClient } from "./httpClient";
import type { Playlist } from "../types";

export interface PlaylistPayload {
  title: string;
  description?: string;
  isPublic?: boolean;
  scenarioVersionIds: string[];
}

export const playlistApi = {
  async list(): Promise<Playlist[]> {
    const { data } = await httpClient.get("/creator/playlists");
    return data.items ?? data;
  },
  async follow(id: string) {
    const { data } = await httpClient.post(`/creator/playlists/${id}/follow`);
    return data;
  },
  async get(id: string): Promise<Playlist> {
    const { data } = await httpClient.get(`/creator/playlists/${id}`);
    return data;
  },
  async create(payload: PlaylistPayload): Promise<Playlist> {
    const { data } = await httpClient.post("/creator/playlists", payload);
    return data;
  },
  async update(id: string, payload: PlaylistPayload): Promise<Playlist> {
    const { data } = await httpClient.put(`/creator/playlists/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    const { data } = await httpClient.delete(`/creator/playlists/${id}`);
    return data;
  },

  async replaceItems(id: string, items: { scenarioVersionId: string; sortOrder?: number }[]) {
    const { data } = await httpClient.post(`/creator/playlists/${id}/items`, { items });
    return data;
  },
};

export const playlistsApi = playlistApi;
