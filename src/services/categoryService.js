import api from '../config/api.js';

const base = '/category-setup';

const categoryService = {
  // Brands
  getBrands: (params) => api.get(`${base}/brands`, { params }),
  createBrand: (data) => api.post(`${base}/brands`, data),
  updateBrand: (id, data) => api.put(`${base}/brands/${id}`, data),
  deleteBrand: (id) => api.delete(`${base}/brands/${id}`),

  // Categories (under brand)
  getCategories: (brandId, params) => api.get(`${base}/brands/${brandId}/categories`, { params }),
  createCategory: (brandId, data) => api.post(`${base}/brands/${brandId}/categories`, data),
  updateCategory: (id, data) => api.put(`${base}/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`${base}/categories/${id}`),

  // Subcategories (under brand + category)
  getSubcategories: (brandId, categoryId, params) => api.get(`${base}/brands/${brandId}/categories/${categoryId}/subcategories`, { params }),
  createSubcategory: (brandId, categoryId, data) => api.post(`${base}/brands/${brandId}/categories/${categoryId}/subcategories`, data),
  updateSubcategory: (id, data) => api.put(`${base}/subcategories/${id}`, data),
  deleteSubcategory: (id) => api.delete(`${base}/subcategories/${id}`),
};

export default categoryService;
