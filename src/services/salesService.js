import api from '../config/api.js';

const salesService = {
  // Sales Orders
  getOrders: (params) => api.get('/sales-orders', { params }),
  getOrder: (id) => api.get(`/sales-orders/${id}`),
  createOrder: (data) => api.post('/sales-orders', data),
  updateOrder: (id, data) => api.put(`/sales-orders/${id}`, data),
  updateStatus: (id, data) => api.patch(`/sales-orders/${id}/status`, data),
  deleteOrder: (id) => api.delete(`/sales-orders/${id}`),
  getStats: () => api.get('/sales-orders/stats'),

  // Search helpers
  searchDealers: (q) => api.get('/sales-orders/search-dealers', { params: { q } }),
  searchProducts: (q, brand, category) => api.get('/sales-orders/search-products', { params: { q, brand, category } }),
};

export default salesService;
