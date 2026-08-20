import api from '../config/api.js';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  getStats: () => api.get('/products/stats'),
  getFilterOptions: () => api.get('/products/filter-options'),

  // Upload images — uses FormData (multipart)
  uploadImages: async (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));

    const token = localStorage.getItem('bdmtiles_token');
    const res = await axios.post(`${API_BASE}/products/upload-images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  },

  // Bulk price update — brand/category/product-wise
  bulkPriceUpdate: (data) => api.post('/products/bulk-price-update', data),
};

export default productService;
