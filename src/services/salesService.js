import api, { createIdempotencyKey } from '../config/api.js';

// Keep one key for an exact pending conversion intent. If the response is lost,
// retrying the same action replays the committed child instead of creating one.
const quotationConversionKeys = new Map();
const quotationReversalKeys = new Map();

const salesService = {
  // Sales Orders
  getOrders: (params) => api.get('/sales-orders', { params }),
  getOrder: (id, params) => api.get(`/sales-orders/${id}`, { params }),
  updateOrder: (id, data) => api.put(`/sales-orders/${id}`, data),
  updateStatus: (id, data) => api.patch(`/sales-orders/${id}/status`, data),
  requestRemainingCancellation: (id, data) => api.post(`/sales-orders/${id}/remaining-cancellation/request`, data),
  reviewRemainingCancellation: (id, action, data) => api.patch(`/sales-orders/${id}/remaining-cancellation/${action}`, data),
  extendReservation: (id, data) => api.patch(`/sales-orders/${id}/reservation/extend`, data),
  deleteOrder: (id) => api.delete(`/sales-orders/${id}`),
  getStats: (params) => api.get('/sales-orders/stats', { params }),
  // Dealer Order Requests
  getDealerOrderRequests: (params) => api.get('/dealer-order-requests', { params }),
  getDealerOrderRequestStats: () => api.get('/dealer-order-requests/stats'),
  getDealerOrderRequest: (id) => api.get(`/dealer-order-requests/${id}`),
  approveDealerOrderRequest: (id, data) => api.post(`/dealer-order-requests/${id}/approve`, data),
  rejectDealerOrderRequest: (id, data) => api.post(`/dealer-order-requests/${id}/reject`, data),
  getDealerOrderRequestQuotationPrefill: (id) => api.get(`/dealer-order-requests/${id}/quotation-prefill`),

  // Search helpers. Object arguments are preferred; positional arguments remain supported.
  searchDealers: (paramsOrQuery, page = 1, pricingTier) => {
    const source = typeof paramsOrQuery === 'object'
      ? paramsOrQuery
      : { q: paramsOrQuery, page, limit: 20, pricingTier };
    const params = { ...source, dealerTypeId: source.dealerTypeId || source.dealerType };
    return api.get('/sales-orders/search-dealers', { params });
  },
  searchProducts: (paramsOrQuery, page = 1, brand, category, dealerType, dealer) => {
    const source = typeof paramsOrQuery === 'object'
      ? paramsOrQuery
      : { q: paramsOrQuery, page, limit: 20, brand, category, dealerType, dealer };
    const params = {
      ...source,
      dealerTypeId: source.dealerTypeId || source.dealerType,
      dealerId: source.dealerId || source.dealer,
    };
    return api.get('/sales-orders/search-products', { params });
  },
  previewPricing: (data) => api.post('/sales-orders/price-preview', data),
  getDealerPrice: (dealer, product) => api.get('/dealer-pricing/effective-rate', { params: { dealer, product } }),
  calculateDiscount: (product, dealerType, rate, quantity) => api.get('/discount-mappings/calculate', { params: { product, dealerType, rate, quantity } }),

  // Customer Invoices
  getInvoices: (params) => api.get('/invoices', { params }),
  getInvoice: (id) => api.get(`/invoices/${id}`),
  getInvoiceStats: () => api.get('/invoices/stats'),
  generateInvoiceFromSalesOrder: (salesOrderId, idempotencyKey = createIdempotencyKey()) => api.post(
    `/invoices/generate-from-so/${salesOrderId}`,
    undefined,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  ),
  updateInvoiceStatus: (id, data) => api.patch(`/invoices/${id}/status`, data),
  deleteInvoice: (id) => api.delete(`/invoices/${id}`),

  // Discount Mappings
  calculatePurchaseDiscount: (product, supplier, rate) => api.get('/discount-mappings/calculate-purchase', { params: { product, supplier, rate } }),
  getDiscountMappings: (params) => api.get('/discount-mappings', { params }),
  getDiscountMappingStats: (params) => api.get('/discount-mappings/stats', { params }),
  createDiscountMapping: (data) => api.post('/discount-mappings', data),
  updateDiscountMapping: (id, data) => api.put(`/discount-mappings/${id}`, data),
  updateDiscountMappingStatus: (id, data) => api.patch(`/discount-mappings/${id}/status`, data),
  deleteDiscountMapping: (id) => api.delete(`/discount-mappings/${id}`),

  // Sales Returns
  getReturns: (params) => api.get('/sales-returns', { params }),
  getReturn: (id) => api.get(`/sales-returns/${id}`),
  createReturn: (data, idempotencyKey = createIdempotencyKey()) => api.post('/sales-returns', data, { headers: { 'Idempotency-Key': idempotencyKey } }),
  approveReturn: (id, data) => api.patch(`/sales-returns/${id}/approve`, data),
  reverseReturn: (id, data) => api.patch(`/sales-returns/${id}/reverse`, data),
  cancelReturn: (id) => api.patch(`/sales-returns/${id}/cancel`),
  getReturnStats: () => api.get('/sales-returns/stats'),
  getOrdersForDealer: (dealerId) => api.get(`/sales-returns/orders-for-dealer/${dealerId}`),

  // Payments
  getPayments: (params) => api.get('/payments', { params }),
  getPayment: (id) => api.get(`/payments/${id}`),
  createPayment: (data, idempotencyKey = createIdempotencyKey()) => api.post('/payments', data, { headers: { 'Idempotency-Key': idempotencyKey } }),
  confirmPayment: (id) => api.patch(`/payments/${id}/confirm`),
  bouncePayment: (id, data) => api.patch(`/payments/${id}/bounce`, data),
  getPaymentStats: () => api.get('/payments/stats'),
  getDealerInvoices: (dealerId) => api.get(`/payments/dealer-invoices/${dealerId}`),
  getSupplierInvoicesForPayment: (supplierId) => api.get(`/payments/supplier-invoices/${supplierId}`),
  // Quotations
  getQuotations: (params) => api.get('/quotations', { params }),
  getQuotation: (id) => api.get(`/quotations/${id}`),
  getQuotationProducts: (params) => api.get('/quotations/product-browser', { params }),
  createQuotation: (data) => api.post('/quotations', data),
  updateQuotation: (id, data) => api.put(`/quotations/${id}`, data),
  updateQuotationValidity: (id, data) => api.patch(`/quotations/${id}/validity`, data),
  previewQuotationPricing: (data) => api.post('/quotations/price-preview', data),
  updateQuotationStatus: (id, data) => api.patch(`/quotations/${id}/status`, data),
  convertQuotation: async (id, data = { mode: 'full' }, idempotencyKey) => {
    const intent = `${id}:${data.mode || 'full'}:${data.includePartialLines === true}`;
    const key = idempotencyKey || quotationConversionKeys.get(intent) || createIdempotencyKey();
    quotationConversionKeys.set(intent, key);
    const response = await api.post(
      `/quotations/${id}/convert`,
      data,
      { headers: { 'Idempotency-Key': key } }
    );
    quotationConversionKeys.delete(intent);
    return response;
  },
  checkQuotationStock: (id) => api.get(`/quotations/${id}/check-stock`),
  reverseQuotationConversion: async (id, conversionId, data, idempotencyKey) => {
    const intent = `${conversionId}:${data.reason}`;
    const key = idempotencyKey || quotationReversalKeys.get(intent) || createIdempotencyKey();
    quotationReversalKeys.set(intent, key);
    const response = await api.post(
      `/quotations/${id}/conversions/${conversionId}/reverse`,
      data,
      { headers: { 'Idempotency-Key': key } }
    );
    quotationReversalKeys.delete(intent);
    return response;
  },
  deleteQuotation: (id) => api.delete(`/quotations/${id}`),
  getQuotationStats: () => api.get('/quotations/stats'),

  // Order Assignments
  assignBranch: (orderId, branchId) => api.patch(`/sales-orders/${orderId}/assign-branch`, { branchId }),
  assignTransport: (orderId, vehicleId) => api.patch(`/sales-orders/${orderId}/assign-transport`, { vehicleId }),
};

export default salesService;
