import axios from 'axios';

const PRODUCTION_API_URL = 'https://bdmtiles-backend.onrender.com/api/v1';
const DEVELOPMENT_API_URL = 'http://localhost:5000/api/v1';

const getApiBaseUrl = () => {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return PRODUCTION_API_URL;
  }
  return import.meta.env.VITE_API_BASE_URL || DEVELOPMENT_API_URL;
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bdmtiles_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't redirect on auth/me (initial check) — let AuthContext handle it
      if (!url.includes('/auth/me')) {
        localStorage.removeItem('bdmtiles_token');
        localStorage.removeItem('bdmtiles_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';

    return Promise.reject(new Error(message));
  }
);

export default api;
