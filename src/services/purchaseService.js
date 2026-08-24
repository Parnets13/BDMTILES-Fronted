import api from '../config/api.js';

const purchaseService = {
  // Purchase Orders
  getPOs: (params) => api.get('/purchase/purchase-orders', { params }),
  getPO: (id) => api.get(`/purchase/purchase-orders/${id}`),
  createPO: (data) => api.post('/purchase/purchase-orders', data),
  updatePO: (id, data) => api.put(`/purchase/purchase-orders/${id}`, data),
  updatePOStatus: (id, data) => api.patch(`/purchase/purchase-orders/${id}/status`, data),
  deletePO: (id) => api.delete(`/purchase/purchase-orders/${id}`),
  getPOStats: () => api.get('/purchase/purchase-orders/stats'),

  // GRN
  getGRNs: (params) => api.get('/purchase/grn', { params }),
  getGRN: (id) => api.get(`/purchase/grn/${id}`),
  createGRN: (data) => api.post('/purchase/grn', data),
  approveGRN: (id) => api.patch(`/purchase/grn/${id}/approve`),
  getAvailablePOs: () => api.get('/purchase/grn/available-pos'),

  // Stock
  getStock: (params) => api.get('/purchase/stock', { params }),
  getStockSummary: () => api.get('/purchase/stock/summary'),
  adjustStock: (data) => api.post('/purchase/stock/adjust', data),
  transferStock: (data) => api.post('/purchase/stock/transfer', data),
  getStockAlerts: (params) => api.get('/purchase/stock/alerts', { params }),

  // Physical Audit
  getAuditPending: (warehouse) => api.get('/purchase/audit/pending', { params: { warehouse } }),
  submitAudit: (data) => api.post('/purchase/audit/submit', data),

  // Reorder Suggestions
  getReorderSuggestions: (params) => api.get('/purchase/stock/reorder-suggestions', { params }),
  createPOFromSuggestions: (data) => api.post('/purchase/stock/create-po-from-suggestions', data),

  // Purchase Returns (Debit Notes)
  getReturns: (params) => api.get('/purchase-returns', { params }),
  getReturn: (id) => api.get(`/purchase-returns/${id}`),
  createReturn: (data) => api.post('/purchase-returns', data),
  approveReturn: (id, data) => api.patch(`/purchase-returns/${id}/approve`, data),
  cancelReturn: (id) => api.patch(`/purchase-returns/${id}/cancel`),
  getReturnStats: () => api.get('/purchase-returns/stats'),
  getGRNsForSupplier: (supplierId) => api.get(`/purchase-returns/grns-for-supplier/${supplierId}`),
};

export default purchaseService;
