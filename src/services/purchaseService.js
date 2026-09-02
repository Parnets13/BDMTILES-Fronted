import api, { createIdempotencyKey } from '../config/api.js';

const purchaseService = {
  // Purchase Orders
  getPOs: (params) => api.get('/purchase/purchase-orders', { params }),
  getPO: (id) => api.get(`/purchase/purchase-orders/${id}`),
  updatePO: (id, data) => api.put(`/purchase/purchase-orders/${id}`, data),
  updatePOStatus: (id, data) => api.patch(`/purchase/purchase-orders/${id}/status`, data),
  deletePO: (id) => api.delete(`/purchase/purchase-orders/${id}`),
  getPOStats: () => api.get('/purchase/purchase-orders/stats'),
  submitPO: (id, data = {}) => api.patch(`/purchase/purchase-orders/${id}/submit`, data),
  approvePO: (id, data = {}) => api.patch(`/purchase/purchase-orders/${id}/approve`, data),
  rejectPO: (id, data = {}) => api.patch(`/purchase/purchase-orders/${id}/reject`, data),
  printPO: (id) => api.get(`/purchase/purchase-orders/${id}/print`),

  // Purchase Requisitions
  getPurchaseRequisitions: (params) => api.get('/purchase-requisitions', { params }),
  getPurchaseRequisitionStats: () => api.get('/purchase-requisitions/stats'),
  getPurchaseRequisition: (id) => api.get(`/purchase-requisitions/${id}`),
  createPurchaseRequisition: (data) => api.post('/purchase-requisitions', data),
  submitPurchaseRequisition: (id) => api.patch(`/purchase-requisitions/${id}/submit`),
  approvePurchaseRequisition: (id, data = {}) => api.patch(`/purchase-requisitions/${id}/approve`, data),
  rejectPurchaseRequisition: (id, data = {}) => api.patch(`/purchase-requisitions/${id}/reject`, data),

  // Supplier Quotation Comparisons
  getSupplierQuotations: (params) => api.get('/supplier-quotations', { params }),
  getSupplierQuotation: (id) => api.get(`/supplier-quotations/${id}`),
  createSupplierQuotation: (data) => api.post('/supplier-quotations', data),
  updateSupplierQuotation: (id, data) => api.put(`/supplier-quotations/${id}`, data),
  deleteSupplierQuotation: (id) => api.delete(`/supplier-quotations/${id}`),
  submitSupplierQuotation: (id) => api.patch(`/supplier-quotations/${id}/submit`),
  compareSupplierQuotation: (id) => api.post(`/supplier-quotations/${id}/compare`),
  selectFinalSupplier: (id, data) => api.patch(`/supplier-quotations/${id}/select-final-supplier`, data),
  convertSupplierQuotationToPO: (id) => api.post(`/supplier-quotations/${id}/convert-to-po`),

  // Supplier Invoices
  getSupplierInvoices: (params) => api.get('/supplier-invoices', { params }),
  getSupplierInvoice: (id) => api.get(`/supplier-invoices/${id}`),
  createSupplierInvoice: (data, idempotencyKey = createIdempotencyKey()) => api.post(
    '/supplier-invoices',
    data,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  ),
  verifySupplierInvoice: (id) => api.patch(`/supplier-invoices/${id}/verify`),
  getSupplierInvoiceStats: () => api.get('/supplier-invoices/stats'),
  getAvailableSupplierInvoiceGRNs: (supplier) => api.get('/supplier-invoices/available-grns', { params: { supplier } }),

  // GRN
  getGRNs: (params) => api.get('/purchase/grn', { params }),
  getGRN: (id) => api.get(`/purchase/grn/${id}`),
  createGRN: (data, idempotencyKey = createIdempotencyKey()) => api.post('/purchase/grn', data, { headers: { 'Idempotency-Key': idempotencyKey } }),
  verifyGRN: (id) => api.patch(`/purchase/grn/${id}/verify`),
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

  // Purchase Returns (Debit Notes)
  getReturns: (params) => api.get('/purchase-returns', { params }),
  getReturn: (id) => api.get(`/purchase-returns/${id}`),
  createReturn: (data, idempotencyKey = createIdempotencyKey()) => api.post('/purchase-returns', data, { headers: { 'Idempotency-Key': idempotencyKey } }),
  approveReturn: (id, data) => api.patch(`/purchase-returns/${id}/approve`, data),
  reverseReturn: (id, data) => api.patch(`/purchase-returns/${id}/reverse`, data),
  cancelReturn: (id) => api.patch(`/purchase-returns/${id}/cancel`),
  getReturnStats: () => api.get('/purchase-returns/stats'),
  getGRNsForSupplier: (supplierId) => api.get(`/purchase-returns/grns-for-supplier/${supplierId}`),
};

export default purchaseService;
