import api from '../config/api.js';

const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  getStats: () => api.get('/products/stats'),
  getFilterOptions: () => api.get('/products/filter-options'),

  // Shared API client removes the JSON content type so the browser can add the multipart boundary.
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/products/upload-images', formData);
  },

  // Bulk price update — brand/category/product-wise
  bulkPriceUpdate: (data) => api.post('/products/bulk-price-update', data),
};

export default productService;
