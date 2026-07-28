import api from '../config/api.js';

const financeService = {
  // Dealer Ledger
  getDealers: (params) => api.get('/ledger/dealers', { params }),
  getDealerLedger: (dealerId, params) => api.get(`/ledger/dealer/${dealerId}`, { params }),
  addDealerEntry: (data) => api.post('/ledger/dealer', data),

  // Supplier Ledger
  getSuppliers: (params) => api.get('/ledger/suppliers', { params }),
  getSupplierLedger: (supplierId, params) => api.get(`/ledger/supplier/${supplierId}`, { params }),

  // Cheques
  getCheques: (params) => api.get('/cheques', { params }),
  getCheque: (id) => api.get(`/cheques/${id}`),
  getChequeStats: () => api.get('/cheques/stats'),
  createCheque: (data) => api.post('/cheques', data),
  depositCheque: (id, data) => api.patch(`/cheques/${id}/deposit`, data),
  clearCheque: (id, data) => api.patch(`/cheques/${id}/clear`, data),
  bounceCheque: (id, data) => api.patch(`/cheques/${id}/bounce`, data),

  // Vouchers
  getVouchers: (params) => api.get('/vouchers', { params }),
  getVoucher: (id) => api.get(`/vouchers/${id}`),
  getVoucherStats: () => api.get('/vouchers/stats'),
  createVoucher: (data) => api.post('/vouchers', data),
  postVoucher: (id) => api.patch(`/vouchers/${id}/post`),
  cancelVoucher: (id) => api.patch(`/vouchers/${id}/cancel`),

  // Bank Accounts
  getBankAccounts: () => api.get('/vouchers/bank-accounts/list'),
  createBankAccount: (data) => api.post('/vouchers/bank-accounts', data),
  updateBankAccount: (id, data) => api.put(`/vouchers/bank-accounts/${id}`, data),

  // Cash/Bank Book
  getCashBankEntries: (params) => api.get('/vouchers/cash-bank-book/entries', { params }),
};

export default financeService;
