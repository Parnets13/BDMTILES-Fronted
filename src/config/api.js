import axios from 'axios';
import { notifyError } from './notify.js';

export const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ═══════════════════════════════════════════════════════════════
// Global human-readable error notification
// Every API failure surfaces a clear message for normal users
// instead of being silently logged to the console only.
// ═══════════════════════════════════════════════════════════════
const ERROR_TITLES = {
  400: 'Invalid Request',
  401: 'Session Expired',
  403: 'Access Denied',
  404: 'Not Found',
  409: 'Cannot Complete This Action',
  422: 'Validation Error',
  428: 'Action Required',
  429: 'Too Many Requests',
  500: 'Server Error',
  502: 'Server Unavailable',
  503: 'Server Unavailable',
};

const FALLBACK_MESSAGES = {
  400: 'The request could not be processed. Please check the details and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action. Contact your admin if you need access.',
  404: 'The requested item could not be found. It may have been deleted or moved.',
  409: 'This action conflicts with the current data. Refresh the page and try again.',
  422: 'Some details are invalid or missing. Please review the form and correct any issues.',
  428: 'A required condition was not met. Please select an active branch and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server ran into a problem. Please try again shortly.',
  502: 'The server is temporarily unavailable. Please try again in a few moments.',
  503: 'The server is temporarily unavailable. Please try again in a few moments.',
};

// Certain paths are handled locally (e.g. login shows its own error), skip the global toast.
const SILENT_PATHS = ['/auth/login', '/auth/refresh-token', '/auth/forgot-password', '/auth/reset-password'];

let lastNotificationKey = '';
let lastNotificationTime = 0;

function showGlobalError(status, serverMessage, url) {
  // Skip auth paths — they handle errors locally
  if (SILENT_PATHS.some(path => String(url || '').includes(path))) return;
  // Skip 401 — AuthContext already shows the session-expiry message
  if (status === 401) return;

  let title = ERROR_TITLES[status] || 'Something Went Wrong';
  let message = serverMessage || FALLBACK_MESSAGES[status] || 'An unexpected error occurred. Please try again.';

  // Make dependency-blocked delete messages extra clear for normal users.
  // Backend sends: "Cannot delete Dealer. Referenced by: sales orders, quotations, invoices."
  if (/cannot delete.*referenced by/i.test(message)) {
    title = 'Cannot Delete — Record Is In Use';
    // Extract the references and reformat
    const refs = message.match(/referenced by:\s*(.+?)\.?$/i)?.[1] || '';
    const model = message.match(/cannot delete\s+(\w+)/i)?.[1] || 'record';
    message = `This ${model.toLowerCase()} is linked to ${refs || 'other records'} and cannot be deleted until those references are removed or reassigned.`;
  }
  // "Cannot delete X in "status" status" → friendlier
  if (/cannot delete.*in ".*" status/i.test(message)) {
    title = 'Cannot Delete';
  }
  // 428 "Select an active branch before deleting" → friendlier
  if (status === 428) {
    title = 'Branch Not Selected';
    message = message || 'Please select an active branch from the header before performing this action.';
  }

  // Deduplicate rapid-fire identical toasts (e.g. parallel calls all failing)
  const key = `${status}:${message}`;
  const now = Date.now();
  if (key === lastNotificationKey && now - lastNotificationTime < 3000) return;
  lastNotificationKey = key;
  lastNotificationTime = now;

  notifyError({
    message: title,
    description: message,
    placement: 'topRight',
    duration: status >= 500 ? 6 : 4.5,
    style: { borderLeft: '4px solid #ef4444' },
  });
}

const PRODUCTION_API_URL = 'https://bdmtiles-backend.onrender.com/api/v1';
const DEVELOPMENT_API_URL = 'http://localhost:5000/api/v1';

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL
  || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? PRODUCTION_API_URL
    : DEVELOPMENT_API_URL);

const API_BASE_URL = getApiBaseUrl();

// Server origin (without the /api/v1 suffix) — used to resolve /uploads/... image URLs.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/** Resolve a possibly-relative upload path (e.g. /uploads/web/x.jpg) to an absolute URL. */
export const resolveUploadUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};
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
    // Web Management (storefront CMS) content is global — never branch-scoped —
    // so we skip the branch header for it (like /auth/).
    const url = String(config.url || '');
    const isBranchless = url.startsWith('/auth/') || url.startsWith('/web-management');
    if (activeBranchId && !isBranchless) {
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
    // Routes are inconsistent about where they put a failure payload: some send
    // `details`, others send it as `data` alongside the message. Read both so a
    // caller that needs the payload (a stale stock plan, say) always receives it.
    error.details = error.response?.data?.details ?? error.response?.data?.data ?? error.details;
    error.message = error.response?.data?.message || error.message || 'Something went wrong';

    // Show a user-facing notification for every API error so the user always
    // sees what went wrong, regardless of which page/modal they're on.
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      showGlobalError(0, 'Cannot reach the server. Check your internet connection and try again.', config.url);
    } else {
      showGlobalError(status, error.message, config.url);
    }

    return Promise.reject(error);
  }
);

export default api;
