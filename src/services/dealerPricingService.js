import api from '../config/api.js';

const compactParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

const dealerPricingService = {
  // Generalized override CRUD (dealer type, individual dealer, or walk-in scope).
  getAll: (params) => api.get('/dealer-pricing', { params: compactParams(params) }),
  create: (data) => api.post('/dealer-pricing', data),
  update: (id, data) => api.put(`/dealer-pricing/${id}`, data),
  remove: (id) => api.delete(`/dealer-pricing/${id}`),

  // Server-resolved pricing catalog and effective-rate lookup.
  getCatalog: (params) => api.get('/dealer-pricing/catalog', { params: compactParams(params) }),
  getEffectiveRate: (paramsOrDealer, product) => {
    const params = typeof paramsOrDealer === 'object'
      ? paramsOrDealer
      : { dealer: paramsOrDealer, product };
    return api.get('/dealer-pricing/effective-rate', { params: compactParams(params) });
  },

  // Bulk preview/apply and scheduled operations.
  previewBulk: (data) => api.post('/dealer-pricing/preview-bulk', data),
  applyBulk: (data) => api.post('/dealer-pricing/apply-bulk', data),
  getSchedules: (params) => api.get('/dealer-pricing/schedules', { params: compactParams(params) }),
  cancelSchedule: (id) => api.delete(`/dealer-pricing/schedules/${id}`),
  applyDueSchedules: () => api.post('/dealer-pricing/apply-due-schedules'),
  getHistory: (params) => api.get('/dealer-pricing/history', { params: compactParams(params) }),

  // Retained for compatibility with existing consumers.
  getBulkByDealer: (dealerId) => api.get(`/dealer-pricing/bulk-by-dealer/${dealerId}`),
};

export default dealerPricingService;
