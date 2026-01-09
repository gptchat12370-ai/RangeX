import { httpClient } from '../api/httpClient';

/**
 * Upload an image file directly to MinIO and return the URL
 * @param file Image file to upload
 * @param folder Folder in MinIO (e.g., 'editor-images')
 * @param scenarioId Optional scenario ID to organize images by scenario
 * @returns MinIO URL of the uploaded image
 */
export async function uploadImageToMinio(file: File, folder: string = 'editor-images', scenarioId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  // If scenarioId provided, organize images inside scenario folder
  const uploadFolder = scenarioId ? `${folder}/${scenarioId}` : folder;
  formData.append('folder', uploadFolder);
  
  const uploadResponse = await httpClient.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return uploadResponse.data.url;
}

/**
 * Delete an image from MinIO
 * @param imageUrl API proxy URL of the image to delete (e.g., /api/assets/file/path)
 */
export async function deleteImageFromMinio(imageUrl: string): Promise<void> {
  try {
    // Extract path from API proxy URL: /api/assets/file/{path}
    // Remove query params first (e.g., ?t=timestamp)
    const cleanUrl = imageUrl.split('?')[0];
    
    let objectPath: string;
    if (cleanUrl.includes('/api/assets/file/')) {
      // New format: /api/assets/file/scenarios/editor-images/uuid.png
      const parts = cleanUrl.split('/api/assets/file/');
      objectPath = parts[1] || '';
    } else if (cleanUrl.includes('/rangex-assets/')) {
      // Legacy format: http://localhost:9000/rangex-assets/scenarios/...
      const parts = cleanUrl.split('/rangex-assets/');
      objectPath = parts[1] || '';
    } else {
      console.error('[ImageUpload] Invalid URL format:', imageUrl);
      return;
    }
    
    if (!objectPath) {
      console.error('[ImageUpload] Could not extract path from URL:', imageUrl);
      return;
    }
    
    await httpClient.delete(`/upload/image/${encodeURIComponent(objectPath)}`);
    
    console.log('[ImageUpload] Successfully deleted:', objectPath);
  } catch (error) {
    console.error('[ImageUpload] Failed to delete image:', error);
  }
}