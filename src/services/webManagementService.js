import api from '../config/api.js';

const base = '/web-management';

/**
 * Storefront CMS (Web Management) service.
 * Manages global home-page content consumed by the customer website (bdm-tiles-web).
 */
const webManagementService = {
  // Hero / banner carousel slides
  getHero: (params) => api.get(`${base}/hero`, { params }),
  createHero: (data) => api.post(`${base}/hero`, data),
  updateHero: (id, data) => api.put(`${base}/hero/${id}`, data),
  deleteHero: (id) => api.delete(`${base}/hero/${id}`),

  // Promotional home banners
  getBanners: (params) => api.get(`${base}/banners`, { params }),
  createBanner: (data) => api.post(`${base}/banners`, data),
  updateBanner: (id, data) => api.put(`${base}/banners/${id}`, data),
  deleteBanner: (id) => api.delete(`${base}/banners/${id}`),

  // Shop-by-category cards
  getCategories: (params) => api.get(`${base}/categories`, { params }),
  createCategory: (data) => api.post(`${base}/categories`, data),
  updateCategory: (id, data) => api.put(`${base}/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`${base}/categories/${id}`),

  // Testimonials
  getTestimonials: (params) => api.get(`${base}/testimonials`, { params }),
  createTestimonial: (data) => api.post(`${base}/testimonials`, data),
  updateTestimonial: (id, data) => api.put(`${base}/testimonials/${id}`, data),
  deleteTestimonial: (id) => api.delete(`${base}/testimonials/${id}`),

  // Top-bar scrolling marquee items
  getMarquee: (params) => api.get(`${base}/marquee`, { params }),
  createMarquee: (data) => api.post(`${base}/marquee`, data),
  updateMarquee: (id, data) => api.put(`${base}/marquee/${id}`, data),
  deleteMarquee: (id) => api.delete(`${base}/marquee/${id}`),

  // Site header settings (singleton): logo, brand text, phone number
  getSiteSettings: () => api.get(`${base}/site-settings`),
  updateSiteSettings: (data) => api.put(`${base}/site-settings`, data),

  // Serviceable delivery pincodes
  getPincodes: (params) => api.get(`${base}/pincodes`, { params }),
  createPincode: (data) => api.post(`${base}/pincodes`, data),
  updatePincode: (id, data) => api.put(`${base}/pincodes/${id}`, data),
  deletePincode: (id) => api.delete(`${base}/pincodes/${id}`),

  // Shop by Room
  getTileRooms: (params) => api.get(`${base}/tile-rooms`, { params }),
  createTileRoom: (data) => api.post(`${base}/tile-rooms`, data),
  updateTileRoom: (id, data) => api.put(`${base}/tile-rooms/${id}`, data),
  deleteTileRoom: (id) => api.delete(`${base}/tile-rooms/${id}`),

  // Shop by Tile Type
  getTileTypes: (params) => api.get(`${base}/tile-types`, { params }),
  createTileType: (data) => api.post(`${base}/tile-types`, data),
  updateTileType: (id, data) => api.put(`${base}/tile-types/${id}`, data),
  deleteTileType: (id) => api.delete(`${base}/tile-types/${id}`),

  // Shop by Size
  getTileSizes: (params) => api.get(`${base}/tile-sizes`, { params }),
  createTileSize: (data) => api.post(`${base}/tile-sizes`, data),
  updateTileSize: (id, data) => api.put(`${base}/tile-sizes/${id}`, data),
  deleteTileSize: (id) => api.delete(`${base}/tile-sizes/${id}`),

  // Shared image upload — FormData; the api interceptor strips the JSON content-type.
  // Returns { success, data: ['/uploads/web/<file>', ...] }.
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post(`${base}/upload-images`, formData);
  },
};

export default webManagementService;
