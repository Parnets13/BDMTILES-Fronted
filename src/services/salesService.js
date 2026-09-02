import api, { createIdempotencyKey } from '../config/api.js';

const salesService = {
  // Sales Orders
  getOrders: (params) => api.get('/sales-orders', { params }),
  getOrder: (id) => api.get(`/sales-orders/${id}`),
  updateOrder: (id, data) => api.put(`/sales-orders/${id}`, data),
  updateStatus: (id, data) => api.patch(`/sales-orders/${id}/status`, data),
  deleteOrder: (id) => api.delete(`/sales-orders/${id}`),
  getStats: () => api.get('/sales-orders/stats'),

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
  getDiscountMappings: (params) => api.get('/discount-mappings', { params }),
  getDiscountMappingStats: () => api.get('/discount-mappings/stats'),
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
  createQuotation: (data) => api.post('/quotations', data),
  updateQuotation: (id, data) => api.put(`/quotations/${id}`, data),
  previewQuotationPricing: (data) => api.post('/quotations/price-preview', data),
  updateQuotationStatus: (id, data) => api.patch(`/quotations/${id}/status`, data),
  convertQuotation: (id) => api.post(`/quotations/${id}/convert`),
  deleteQuotation: (id) => api.delete(`/quotations/${id}`),
  getQuotationStats: () => api.get('/quotations/stats'),
};

export default salesService;
