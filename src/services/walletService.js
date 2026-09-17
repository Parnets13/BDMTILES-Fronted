import api from '../config/api.js';

const walletService = {
  // List all customer wallets (with balance)
  getWallets: (params) => api.get('/wallets', { params }),

  // Single customer's wallet + transaction history
  getWallet: (customerId) => api.get(`/wallets/${customerId}`),
  getTransactions: (customerId, params) => api.get(`/wallets/${customerId}/transactions`, { params }),

  // Credit / debit BDM Cash
  credit: (customerId, data) => api.post(`/wallets/${customerId}/credit`, data),
  debit: (customerId, data) => api.post(`/wallets/${customerId}/debit`, data),
};

export default walletService;
