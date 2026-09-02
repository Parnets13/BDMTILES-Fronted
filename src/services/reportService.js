import api from '../config/api.js';

const reportService = {
  getDashboard: (params = {}) => api.get('/reports/dashboard', { params }),
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getPurchaseReport: (params) => api.get('/reports/purchase', { params }),
  getInventoryReport: (params) => api.get('/reports/inventory', { params }),
  getGSTReport: (params) => api.get('/reports/gst', { params }),
  getAgingReport: () => api.get('/reports/aging'),
  getProfitReport: (params) => api.get('/reports/profit', { params }),
  getHRReport: (params) => api.get('/reports/hr', { params }),
  getDealerPerformance: (params) => api.get('/reports/dealer-performance', { params }),
  getSEPerformance: (params) => api.get('/reports/se-performance', { params }),
  getFinanceSummary: (params) => api.get('/reports/finance-summary', { params }),

  // Supplier Schemes — server-calculated rules and claims
  getSupplierSchemes: (params) => api.get('/schemes/supplier', { params }),
  getSupplierScheme: (id) => api.get(`/schemes/supplier/${id}`),
  getSupplierSchemeStats: () => api.get('/schemes/supplier/stats'),
  getSupplierSchemeAnalysis: (id) => api.get(`/schemes/supplier/${id}/analysis`),
  createSupplierScheme: (data) => api.post('/schemes/supplier', data),
  updateSupplierSchemeStatus: (id, data) => api.patch(`/schemes/supplier/${id}/status`, data),
  submitSupplierSchemeClaim: (id, data = {}) => api.post(`/schemes/supplier/${id}/submit`, data),

  // Dealer Schemes — server-calculated rules and settlements
  getDealerSchemes: (params) => api.get('/schemes/dealer', { params }),
  getDealerScheme: (id) => api.get(`/schemes/dealer/${id}`),
  getDealerSchemeAnalysis: (id, dealer) => api.get(`/schemes/dealer/${id}/analysis`, { params: { dealer } }),
  getDealerAnalysis: (dealer) => api.get('/schemes/dealer-analysis', { params: { dealer } }),
  createDealerScheme: (data) => api.post('/schemes/dealer', data),
  updateDealerSchemeStatus: (id, data) => api.patch(`/schemes/dealer/${id}/status`, data),
  submitDealerSchemeSettlement: (id, data) => api.post(`/schemes/dealer/${id}/submit`, data),

  // Shared maker-checker settlement workflow
  getSchemeSettlements: (params) => api.get('/schemes/settlements', { params }),
  getSchemeSettlement: (id) => api.get(`/schemes/settlements/${id}`),
  downloadSupplierCreditNote: (id) => api.get(`/schemes/settlements/${id}/supplier-credit-note/document`, { responseType: 'blob' }),
  approveSchemeSettlement: (id) => api.patch(`/schemes/settlements/${id}/approve`),
  createSchemeAdjustment: (id, data = {}) => api.post(`/schemes/settlements/${id}/adjustment`, data),
  reverseSchemeSettlement: (id, data) => api.patch(`/schemes/settlements/${id}/reverse`, data),
  uploadSupplierCreditNote: (id, data) => api.post(`/schemes/settlements/${id}/supplier-credit-note`, data),
  verifySupplierCreditNote: (id, data) => api.patch(`/schemes/settlements/${id}/supplier-credit-note/verify`, data),
};

export default reportService;
