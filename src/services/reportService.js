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

  // Supplier Schemes
  getSupplierSchemes: (params) => api.get('/schemes/supplier', { params }),
  getSupplierSchemeStats: () => api.get('/schemes/supplier/stats'),
  createSupplierScheme: (data) => api.post('/schemes/supplier', data),
  claimSupplierScheme: (id, data) => api.patch(`/schemes/supplier/${id}/claim`, data),
  settleSupplierScheme: (id, data) => api.patch(`/schemes/supplier/${id}/settle`, data),

  // Dealer Schemes
  getDealerSchemes: (params) => api.get('/schemes/dealer', { params }),
  createDealerScheme: (data) => api.post('/schemes/dealer', data),
  updateDealerSchemeStatus: (id, data) => api.patch(`/schemes/dealer/${id}/status`, data),
};

export default reportService;
