/**
 * Convert a relative image path to a full URL.
 * Handles: /uploads/products/xyz.jpg → https://<api-origin>/uploads/products/xyz.jpg
 * Already absolute URLs (http/https/data) are returned as-is.
 * Empty/null values return empty string.
 *
 * The origin comes from config/api.js rather than being re-derived from
 * VITE_API_BASE_URL: that variable is now the RELATIVE path `/api/v1`, so the old
 * derivation produced an empty prefix and every image silently fell back to
 * localhost. Uploads are served by the API origin, not by the app origin.
 */

import { API_ORIGIN } from '../config/api.js';

export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  // Relative path like /uploads/products/xyz.jpg
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default getImageUrl;
