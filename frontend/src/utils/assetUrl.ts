/**
 * Utility functions for handling MinIO asset URLs
 */

/**
 * Converts a relative MinIO URL to an absolute URL pointing to the backend API.
 * This is necessary because <img> tags and other HTML elements need absolute URLs
 * when the frontend (port 5173) and backend (port 3000) are on different ports.
 * 
 * The backend now ALWAYS returns relative URLs like "/api/assets/file/...",
 * and this function converts them to absolute URLs with the correct port.
 * 
 * @param url - The URL from API response (e.g., "/api/assets/file/...")
 * @returns Absolute URL with correct hostname and port
 * 
 * @example
 * getAssetUrl("/api/assets/file/users/123/avatar.jpg")
 * // Returns: "http://10.112.95.18:3000/api/assets/file/users/123/avatar.jpg"
 */
export const getAssetUrl = (url: string | undefined): string => {
  if (!url) {
    console.log('[getAssetUrl] No URL provided');
    return '';
  }
  
  // If already absolute URL (http:// or https://), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log('[getAssetUrl] Already absolute:', url);
    return url;
  }
  
  // If it's a relative MinIO URL starting with /api/, convert to absolute
  if (url.startsWith('/api/')) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const absoluteUrl = `${protocol}//${hostname}:3000${url}`;
    console.log('[getAssetUrl] Converted to absolute:', url, '=>', absoluteUrl);
    return absoluteUrl;
  }
  
  // For external URLs (DiceBear, team logo presets, data: URLs, blob: URLs), return as-is
  console.log('[getAssetUrl] Returning as-is:', url);
  return url;
};
