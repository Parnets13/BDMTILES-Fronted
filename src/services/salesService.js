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

  // Sales Returns
  getReturns: (params) => api.get('/sales-returns', { params }),
  getReturn: (id) => api.get(`/sales-returns/${id}`),
  createReturn: (data) => api.post('/sales-returns', data),
  approveReturn: (id, data) => api.patch(`/sales-returns/${id}/approve`, data),
  cancelReturn: (id) => api.patch(`/sales-returns/${id}/cancel`),
  getReturnStats: () => api.get('/sales-returns/stats'),
  getOrdersForDealer: (dealerId) => api.get(`/sales-returns/orders-for-dealer/${dealerId}`),

  // Payments
  getPayments: (params) => api.get('/payments', { params }),
  getPayment: (id) => api.get(`/payments/${id}`),
  createPayment: (data) => api.post('/payments', data),
  confirmPayment: (id) => api.patch(`/payments/${id}/confirm`),
  bouncePayment: (id, data) => api.patch(`/payments/${id}/bounce`, data),
  getPaymentStats: () => api.get('/payments/stats'),
  getDealerOrders: (dealerId) => api.get(`/payments/dealer-orders/${dealerId}`),
  // Quotations
  getQuotations: (params) => api.get('/quotations', { params }),
  getQuotation: (id) => api.get(`/quotations/${id}`),
  createQuotation: (data) => api.post('/quotations', data),
  updateQuotationStatus: (id, data) => api.patch(`/quotations/${id}/status`, data),
  convertQuotation: (id) => api.post(`/quotations/${id}/convert`),
  deleteQuotation: (id) => api.delete(`/quotations/${id}`),
  getQuotationStats: () => api.get('/quotations/stats'),
};

export default salesService;
