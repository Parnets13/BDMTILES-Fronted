import axios from 'axios';

export const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const PRODUCTION_API_URL = 'https://bdmtiles-backend.onrender.com/api/v1';
const DEVELOPMENT_API_URL = 'http://localhost:5000/api/v1';

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL
  || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? PRODUCTION_API_URL
    : DEVELOPMENT_API_URL);

const API_BASE_URL = getApiBaseUrl();
const NO_AUTO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];
let refreshPromise = null;

const clearStoredAuth = () => {
  localStorage.removeItem('bdmtiles_token');
  localStorage.removeItem('bdmtiles_user');
  localStorage.removeItem('bdmtiles_active_branch');
};

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient.post('/auth/refresh-token')
      .then(({ data }) => {
        if (!data?.success || !data.token) throw new Error('Session refresh failed');
        localStorage.setItem('bdmtiles_token', data.token);
        if (data.user) localStorage.setItem('bdmtiles_user', JSON.stringify(data.user));
        window.dispatchEvent(new CustomEvent('bdmtiles:auth-refreshed', { detail: data }));
        return data;
      })
      .catch((error) => {
        clearStoredAuth();
        window.dispatchEvent(new Event('bdmtiles:auth-unauthorized'));
        throw error;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bdmtiles_token');
    const activeBranchId = localStorage.getItem('bdmtiles_active_branch');
    if (config.data instanceof FormData) {
      config.headers?.delete?.('Content-Type');
      delete config.headers?.['Content-Type'];
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (activeBranchId && !String(config.url || '').startsWith('/auth/')) {
      config.headers['X-Branch-Id'] = activeBranchId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const config = error.config || {};
    const url = String(config.url || '');
    const canRefresh = status === 401
      && !config._authRetry
      && !config.skipAuthRefresh
      && !NO_AUTO_REFRESH_PATHS.some((path) => url.includes(path));

    if (canRefresh) {
      config._authRetry = true;
      try {
        const refreshed = await refreshAccessToken();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${refreshed.token}`;
        return api(config);
      } catch {
        // refreshAccessToken performs the single authoritative unauthorized notification.
      }
    }

    error.status = status;
    error.code = error.response?.data?.code || error.code;
    error.message = error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(error);
  }
);

export default api;
