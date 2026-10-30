import api from '../config/api.js';

const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  getStats: () => api.get('/products/stats'),
  getFilterOptions: () => api.get('/products/filter-options'),

  /**
   * Every specification dropdown's list — the built-in seeds plus anything this branch has
   * added. Returns `{ tileSize: [...], finish: [...], ... }`, keyed by Product field name.
   */
  getSpecOptions: () => api.get('/products/options'),

  /**
   * Add a value to one dropdown. Resolves to the WHOLE refreshed option map, so the caller
   * updates every list from one response instead of following up with a second GET.
   */
  addSpecOption: (field, value) => api.post('/products/options', { field, value }),

  /**
   * Remove a value this branch added. Refused with 409 while products still use it — the
   * message names the count, so surface it rather than a generic failure.
   */
  deleteSpecOption: (id) => api.delete(`/products/options/${id}`),

  // Shared API client removes the JSON content type so the browser can add the multipart boundary.
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/products/upload-images', formData);
  },

  // Bulk price update — brand/category/product-wise
  bulkPriceUpdate: (data) => api.post('/products/bulk-price-update', data),

  // Bulk min stock / reorder level update — up to 500 rows at once
  // `updates` is [{ productId, minStockLevel?, reorderLevel? }]
  bulkMinStockUpdate: (updates) => api.patch('/products/bulk-min-stock', { updates }),
};

export default productService;
