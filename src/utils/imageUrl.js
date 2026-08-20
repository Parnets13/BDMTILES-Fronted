/**
 * Convert a relative image path to a full URL.
 * Handles: /uploads/products/xyz.jpg → http://localhost:5000/uploads/products/xyz.jpg
 * Already absolute URLs (http/https) are returned as-is.
 * Empty/null values return empty string.
 */

const getBackendBaseUrl = () => {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://bdmtiles-backend.onrender.com';
  }
  return import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';
};

const BACKEND_URL = getBackendBaseUrl();

export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  // Relative path like /uploads/products/xyz.jpg
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default getImageUrl;
