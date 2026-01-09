import axios from "axios";
import { tokenStore } from "./httpClient";

const API_BASE = "http://localhost:3000/api/creator/testing/docker";

export interface DockerImage {
  repository: string;
  tag: string;
  imageId: string;
  created: string;
  size: string;
  isLocal: boolean;
}

export interface RecommendedImage {
  repository: string;
  tag: string;
  displayName: string;
  category: string;
  description: string;
  size: string;
  isPublic: boolean;
  tags: string[];
}

export interface Container {
  id: string;
  names: string;
  image: string;
  status: string;
  ports: string;
}

export const dockerApi = {
  /**
   * Get available Docker images
   */
  async getImages(): Promise<{ local: DockerImage[]; recommended: RecommendedImage[]; dockerAvailable: boolean }> {
    const { data } = await axios.get(`${API_BASE}/images`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Pull a Docker image from Docker Hub
   */
  async pullImage(repository: string, tag: string = "latest"): Promise<{ message: string; image: string }> {
    const { data } = await axios.post(
      `${API_BASE}/images/pull`,
      { repository, tag },
      {
        headers: { Authorization: `Bearer ${tokenStore.access}` },
      }
    );
    return data;
  },

  /**
   * Get running Docker containers
   */
  async getContainers(): Promise<{ containers: Container[]; count: number }> {
    const { data } = await axios.get(`${API_BASE}/containers`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Test run a Docker container
   */
  async testContainer(imageName: string, imageTag: string): Promise<{ message: string; containerId: string }> {
    const { data } = await axios.post(
      `${API_BASE}/containers/test`,
      { imageName, imageTag },
      {
        headers: { Authorization: `Bearer ${tokenStore.access}` },
      }
    );
    return data;
  },

  /**
   * Stop a test container
   */
  async stopContainer(containerId: string): Promise<{ message: string }> {
    const { data } = await axios.delete(`${API_BASE}/containers/test/${containerId}`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },
};
