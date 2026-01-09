import { httpClient as api } from './httpClient';

export interface DockerImage {
  id: string;
  name: string;
  tag: string;
  registryUrl: string;
  description?: string;
  category?: string;
  isPublic: boolean;
  isVerified: boolean;
  isReadyImage: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    displayName: string;
  };
}

export interface DockerCredential {
  registryUrl: string;
  username: string;
}

export interface VerifyPublicImageDto {
  imageName: string;
  tag: string;
}

export interface VerifyPrivateImageDto {
  registryUrl: string;
  imageName: string;
  tag: string;
  username: string;
  password: string;
}

export interface CreateImageDto {
  name: string;
  tag: string;
  registryUrl: string;
  description?: string;
  category?: string;
  isPublic: boolean;
  isReadyImage: boolean;
}

export interface SaveCredentialDto {
  registryUrl: string;
  username: string;
  password: string;
}

// Verify public Docker Hub image
export const verifyPublicImage = async (data: VerifyPublicImageDto): Promise<{ verified: boolean }> => {
  const response = await api.post('/docker-images/verify/public', data);
  return response.data;
};

// Verify private registry image
export const verifyPrivateImage = async (data: VerifyPrivateImageDto): Promise<{ verified: boolean }> => {
  const response = await api.post('/docker-images/verify/private', data);
  return response.data;
};

// Save registry credentials
export const saveCredential = async (data: SaveCredentialDto): Promise<void> => {
  await api.post('/docker-images/credentials', data);
};

// Get saved credential for a registry
export const getCredential = async (registryUrl: string): Promise<DockerCredential | null> => {
  try {
    const response = await api.get(`/docker-images/credentials/${encodeURIComponent(registryUrl)}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

// Create a Docker image record
export const createImage = async (data: CreateImageDto): Promise<DockerImage> => {
  const response = await api.post('/docker-images', data);
  return response.data;
};

// Get ready images (admin-uploaded)
export const getReadyImages = async (): Promise<DockerImage[]> => {
  const response = await api.get('/docker-images/ready');
  return response.data;
};

// Get all images (admin only)
export const getAllImages = async (): Promise<DockerImage[]> => {
  const response = await api.get('/docker-images/all');
  return response.data;
};

// Update image
export const updateImage = async (id: string, data: Partial<CreateImageDto>): Promise<DockerImage> => {
  const response = await api.put(`/docker-images/${id}`, data);
  return response.data;
};

// Delete image
export const deleteImage = async (id: string): Promise<void> => {
  await api.delete(`/docker-images/${id}`);
};
