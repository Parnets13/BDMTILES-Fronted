import api, { createIdempotencyKey } from '../config/api.js';

// Keep one key for an exact pending stock mutation intent. A response-loss retry
// replays the committed operation; successful requests release the key so a
// later, deliberate identical operation receives a fresh key.
const stockMutationKeys = new Map();

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
};

const postStockMutation = async (operation, url, data, idempotencyKey) => {
  const intent = `${operation}:${JSON.stringify(stableValue(data || {}))}`;
  const key = idempotencyKey || stockMutationKeys.get(intent) || createIdempotencyKey();
  stockMutationKeys.set(intent, key);
  const response = await api.post(url, data, { headers: { 'Idempotency-Key': key } });
  stockMutationKeys.delete(intent);
  return response;
};

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
  updatePurchaseRequisition: (id, data) => api.patch(`/purchase-requisitions/${id}`, data),
  deletePurchaseRequisition: (id) => api.delete(`/purchase-requisitions/${id}`),
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
  updateGRN: (id, data) => api.patch(`/purchase/grn/${id}`, data),
  deleteGRN: (id) => api.delete(`/purchase/grn/${id}`),
  verifyGRN: (id) => api.patch(`/purchase/grn/${id}/verify`),
  approveGRN: (id) => api.patch(`/purchase/grn/${id}/approve`),
  getAvailablePOs: () => api.get('/purchase/grn/available-pos'),

  // Stock dashboard (authoritative read contracts)
  getStock: (params) => api.get('/stock', { params }),
  getStockDashboard: (params) => api.get('/stock', { params }),
  listStock: (params) => api.get('/stock', { params }),
  getStockSummary: () => api.get('/stock/summary'),
  getStockFilterOptions: () => api.get('/stock/filter-options'),
  getStockDetail: (id) => api.get(`/stock/${id}/detail`),
  getStockMovements: (params) => api.get('/stock/movements', { params }),
  getStockMovementSummary: (params) => api.get('/stock/movements/summary', { params }),
  getStockBucketMovements: (id, params) => api.get(`/stock/${id}/movements`, { params }),
  getCanonicalStockAlerts: (params) => api.get('/stock/alerts', { params }),

  // Durable maker-checker stock adjustments
  getStockAdjustments: (params) => api.get('/stock-adjustments', { params }),
  getStockAdjustmentStats: (params) => api.get('/stock-adjustments/stats', { params }),
  getStockAdjustment: (id) => api.get(`/stock-adjustments/${id}`),
  createStockAdjustment: (data, idempotencyKey) => postStockMutation('stock-adjustment-draft', '/stock-adjustments', data, idempotencyKey),
  updateStockAdjustment: (id, data) => api.patch(`/stock-adjustments/${id}`, data),
  submitStockAdjustment: (id) => api.patch(`/stock-adjustments/${id}/submit`),
  approveStockAdjustment: (id, data = {}) => api.patch(`/stock-adjustments/${id}/approve`, data),
  rejectStockAdjustment: (id, data = {}) => api.patch(`/stock-adjustments/${id}/reject`, data),
  reverseStockAdjustment: (id, data) => api.patch(`/stock-adjustments/${id}/reverse`, data),

  // Durable maker-checker physical stock audits
  getPhysicalAudits: (params) => api.get('/physical-stock-audits', { params }),
  getPhysicalAuditStats: (params) => api.get('/physical-stock-audits/stats', { params }),
  getPhysicalAudit: (id) => api.get(`/physical-stock-audits/${id}`),
  createPhysicalAudit: (data, idempotencyKey) => postStockMutation('physical-audit-draft', '/physical-stock-audits', data, idempotencyKey),
  savePhysicalAuditCounts: (id, data) => api.patch(`/physical-stock-audits/${id}/counts`, data),
  submitPhysicalAudit: (id) => api.patch(`/physical-stock-audits/${id}/submit`),
  approvePhysicalAudit: (id, data = {}) => api.patch(`/physical-stock-audits/${id}/approve`, data),
  rejectPhysicalAudit: (id, data = {}) => api.patch(`/physical-stock-audits/${id}/reject`, data),
  reversePhysicalAudit: (id, data) => api.patch(`/physical-stock-audits/${id}/reverse`, data),

  adjustStock: (data, idempotencyKey) => postStockMutation(
    'manual-adjustment', '/purchase/stock/adjust', data, idempotencyKey
  ),
  transferStock: (data, idempotencyKey) => postStockMutation(
    'legacy-transfer', '/purchase/stock/transfer', data, idempotencyKey
  ),
  // Compatibility-only reads intentionally remain on the legacy purchase router.
  getStockAlerts: (params) => api.get('/purchase/stock/alerts', { params }),

  // Physical Audit (legacy router, authoritative atomic audit contract)
  getAuditPending: (warehouse) => api.get('/purchase/audit/pending', { params: { warehouse } }),
  submitAudit: (data, idempotencyKey) => postStockMutation(
    'physical-audit', '/purchase/audit/submit', data, idempotencyKey
  ),

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
