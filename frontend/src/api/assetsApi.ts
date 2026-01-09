import { httpClient } from "./httpClient";

export interface Asset {
  id: string;
  name: string;
  sizeBytes: number;
  storageKey: string;
  type: string;
  createdAt: string;
  url?: string;
}

export const assetsApi = {
  async upload(file: File): Promise<Asset> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await httpClient.post<Asset>(
      "/assets/upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },
  async list(): Promise<Asset[]> {
    const { data } = await httpClient.get<Asset[]>("/assets");
    return data;
  },
  async delete(id: string) {
    const { data } = await httpClient.delete(`/assets/${id}`);
    return data;
  },
};
