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
  // Status 0 is our own sentinel for "no HTTP response at all" — a dropped
  // connection, a CORS rejection or a timeout.
  0: 'Connection Problem',
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

const PRODUCTION_ORIGIN = 'https://bdmtiles-backend-tm6p.onrender.com';
const DEVELOPMENT_ORIGIN = 'http://localhost:5000';

const isLocalHost = () => ['localhost', '127.0.0.1'].includes(window.location.hostname);

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
// If someone deliberately points the app at an absolute API, the origin follows it.
const configuredOrigin = /^https?:\/\//i.test(configuredBaseUrl)
  ? configuredBaseUrl.replace(/\/api\/v1\/?$/, '')
  : '';

/**
 * Absolute backend origin.
 *
 * Used by the two things that CANNOT go through the same-origin proxy below: the
 * socket.io handshake (a Netlify redirect cannot upgrade a websocket) and the
 * absolute /uploads/... image URLs. Neither is credentialed — the socket carries
 * its own token in the handshake — so reaching the API cross-site is fine here.
 */
export const API_ORIGIN = (
  import.meta.env.VITE_API_ORIGIN
  || configuredOrigin
  || (isLocalHost() ? DEVELOPMENT_ORIGIN : PRODUCTION_ORIGIN)
).replace(/\/+$/, '');

/**
 * Request base URL for every axios call — RELATIVE on purpose.
 *
 * The refresh token is an httpOnly cookie scoped to `/api/v1/auth`. While the app
 * called the API on a different registrable domain (Netlify page -> onrender.com
 * API) that cookie was THIRD-PARTY, and browsers drop those (Safari by default,
 * Chrome and Brave increasingly). The silent refresh therefore always failed, so
 * the first request after the 15-minute access token expired signed the user out
 * — most visibly on a Save/Add POST, because filling the form is what took the time.
 *
 * Serving the API under this app's own origin makes the cookie first-party and the
 * refresh reliable: Netlify proxies /api/* to the backend (netlify.toml and
 * public/_redirects) and the Vite dev server proxies /api to localhost:5000.
 * Set VITE_API_BASE_URL only if you deliberately want a cross-origin API.
 */
const API_BASE_URL = configuredBaseUrl || '/api/v1';

/**
 * Absolute equivalent of API_BASE_URL.
 *
 * For transports that must NOT be proxied through a CDN edge: the lead event
 * stream is a long-lived response and an edge proxy may buffer it, which would
 * silently degrade live lead updates to the fallback poll. It authenticates with
 * a bearer header rather than a cookie, so it works cross-site.
 */
export const API_ABSOLUTE_BASE_URL = /^https?:\/\//i.test(configuredBaseUrl)
  ? configuredBaseUrl
  : `${API_ORIGIN}${API_BASE_URL}`;

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

// One retry, for transient failures only. A definitive 401 is never retried: the
// session is gone and the user needs to see that immediately.
const REFRESH_ATTEMPTS = 2;
const REFRESH_RETRY_DELAY_MS = 800;

/**
 * A 401 from the refresh endpoint is the ONLY answer that means "the session is
 * really over". Everything else — a CORS rejection, a dropped connection, a
 * 502/503 while the API restarts — is transient, and treating it as a dead session
 * signed the user out and threw away whatever was in the form they were submitting.
 */
const isSessionRejection = (error) => error?.response?.status === 401;

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let lastError;
      for (let attempt = 1; attempt <= REFRESH_ATTEMPTS; attempt += 1) {
        try {
          const { data } = await refreshClient.post('/auth/refresh-token');
          // A 200 with no token is as final as a 401 — there is nothing to retry against.
          if (!data?.success || !data.token) {
            throw Object.assign(new Error('Session refresh failed'), { response: { status: 401 } });
          }
          localStorage.setItem('bdmtiles_token', data.token);
          if (data.user) localStorage.setItem('bdmtiles_user', JSON.stringify(data.user));
          window.dispatchEvent(new CustomEvent('bdmtiles:auth-refreshed', { detail: data }));
          return data;
        } catch (error) {
          lastError = error;
          if (isSessionRejection(error)) break;
          if (attempt < REFRESH_ATTEMPTS) {
            await new Promise((resolve) => { setTimeout(resolve, REFRESH_RETRY_DELAY_MS); });
          }
        }
      }

      if (isSessionRejection(lastError)) {
        // The single authoritative unauthorized notification for the whole app.
        // The reason rides on the event because clearStoredAuth() below has already
        // removed the token by the time the listener runs — so the listener cannot
        // work out "was the user signed in?" for itself.
        clearStoredAuth();
        window.dispatchEvent(new CustomEvent('bdmtiles:auth-unauthorized', {
          detail: { reason: 'session_expired' },
        }));
      }
      throw lastError;
    })().finally(() => { refreshPromise = null; });
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
      // Multipart uploads go straight to the API instead of through the same-origin
      // proxy: they are large and long-lived (video uploads allow 10 minutes), and an
      // edge proxy may cap the request body. They authenticate with the bearer header,
      // not a cookie, so there is nothing to gain from proxying them — and this keeps
      // the behaviour that already worked.
      config.baseURL = API_ABSOLUTE_BASE_URL;
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
      } catch (refreshError) {
        if (isSessionRejection(refreshError)) {
          // refreshAccessToken already cleared the session and raised the single
          // authoritative "session expired" notification.
        } else {
          // Transient — a 502/503/504 while the API restarts, or a dropped connection.
          // We never reached the server, so the 401 below is NOT authoritative.
          //
          // It must be flagged, because the fall-through still sets
          // `error.status = 401` and AuthContext.checkAuth signs the user out on
          // exactly that. Without this flag a gateway timeout on the refresh became
          // a hard logout — with a perfectly valid token still sitting in
          // localStorage.
          error.sessionUnverified = true;
          showGlobalError(
            0,
            'We could not verify your session. Check your connection and try again.',
            config.url
          );
        }
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
