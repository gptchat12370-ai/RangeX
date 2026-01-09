import axios from 'axios';
import { tokenStore } from '../store/tokenStore';

const API_BASE = 'http://localhost:3000/api/admin/image-variants';

export const adminImageVariantsApi = {
  /**
   * Get all image variants (admin view)
   */
  async getAll() {
    const { data } = await axios.get(API_BASE, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Get single image variant
   */
  async getById(id: string) {
    const { data } = await axios.get(`${API_BASE}/${id}`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Create new image variant
   */
  async create(variant: {
    baseOs: string;
    variantType: 'lite' | 'standard' | 'full';
    imageRef: string;
    displayName: string;
    description: string;
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    hourlyCostRm: number;
    suitableForRoles: string;
    includedTools?: string;
    tags?: string;
    hasGui?: boolean;
    accessMethod?: 'ssh' | 'rdp' | 'vnc' | 'http';
  }) {
    const { data } = await axios.post(API_BASE, variant, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Update image variant
   */
  async update(id: string, updates: {
    displayName?: string;
    description?: string;
    hourlyCostRm?: number;
    isActive?: boolean;
    includedTools?: string;
    tags?: string;
  }) {
    const { data } = await axios.put(`${API_BASE}/${id}`, updates, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Delete (deactivate) image variant
   */
  async delete(id: string) {
    const { data } = await axios.delete(`${API_BASE}/${id}`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Permanently delete image variant
   */
  async permanentDelete(id: string) {
    const { data } = await axios.delete(`${API_BASE}/${id}/permanent`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },

  /**
   * Toggle active status
   */
  async toggleActive(id: string) {
    const { data } = await axios.patch(`${API_BASE}/${id}/toggle-active`, {}, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    return data;
  },
};
