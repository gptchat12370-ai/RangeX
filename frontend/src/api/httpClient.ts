import axios from "axios";

// Dynamic API URL: Auto-detect based on current hostname
const getApiBaseUrl = () => {
  // In development, use Vite proxy (relative URLs)
  // In production, construct full URL with current hostname
  if (import.meta.env.DEV) {
    console.log('[httpClient] API Base URL: /api (proxied to backend)');
    return '/api';
  }
  
  // Production: Use current hostname for network compatibility
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const url = `${protocol}//${hostname}:3000/api`;
  console.log('[httpClient] API Base URL:', url);
  return url;
};

const API_BASE_URL = getApiBaseUrl();
const ACCESS_TOKEN_KEY = "rangex_access_token";
const REFRESH_TOKEN_KEY = "rangex_refresh_token";
const CSRF_TOKEN_KEY = "rangex_csrf_token";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  get csrf() {
    // Read CSRF token from cookie (set by server)
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    return match ? match[1] : localStorage.getItem(CSRF_TOKEN_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
  },
  setCsrf(csrf: string) {
    localStorage.setItem(CSRF_TOKEN_KEY, csrf);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CSRF_TOKEN_KEY);
  },
};

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

httpClient.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) {
    if (!config.headers) {
      config.headers = {} as any;
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add CSRF token to POST, PUT, DELETE requests (EXCEPT login/register endpoints)
  const csrfToken = tokenStore.csrf;
  const isLoginOrRegister = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');
  
  if (csrfToken && !isLoginOrRegister && ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
    if (!config.headers) {
      config.headers = {} as any;
    }
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  
  // Log request data for debugging
  if (config.data && config.url?.includes('/scenarios/')) {
    console.log('[httpClient] Request URL:', config.url);
    console.log('[httpClient] Request data:', JSON.parse(JSON.stringify(config.data)));
    if (config.data.questions) {
      console.log('[httpClient] Questions being sent:', config.data.questions);
    }
  }
  
  return config;
});

httpClient.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const originalRequest: any = error.config;
    const status = error.response?.status;
    const refreshToken = tokenStore.refresh;

    // Attempt a single refresh on 401/403 when a refresh token exists.
    if ((status === 401 || status === 403) && refreshToken && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        tokenStore.set(data.accessToken, data.refreshToken);
        httpClient.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return httpClient(originalRequest);
      } catch (refreshErr) {
        tokenStore.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    if (status === 401 || status === 403) {
      tokenStore.clear();
    }
    return Promise.reject(error);
  }
);
