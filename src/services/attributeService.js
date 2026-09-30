import api from '../config/api.js';

/**
 * Attribute definitions — the fields a category's products carry.
 *
 * Each category declares its own attributes, and children inherit their ancestors'. That is
 * what lets one Product schema describe tiles (size, finish, surface) and cement (grade, pack
 * size, setting time) without a column per vertical. These definitions drive both the Product
 * Master form and the storefront filter rail.
 *
 * `getEffective` is the one the Product form should use: it returns the inherited set for a
 * category, so the form renders exactly the fields that category supports.
 */
const attributeService = {
  /** Definitions declared directly on a category. */
  list: (params) => api.get('/attributes', { params }),

  /** Everything a category inherits, ancestors included. Pass filterableOnly for the storefront. */
  getEffective: (categoryId, params) => api.get(`/attributes/effective/${categoryId}`, { params }),

  get: (id) => api.get(`/attributes/${id}`),
  create: (data) => api.post('/attributes', data),
  update: (id, data) => api.put(`/attributes/${id}`, data),
  remove: (id) => api.delete(`/attributes/${id}`),

  /** Declare several attributes on one category in a single call. */
  createBulk: (categoryId, attributes) => api.post('/attributes/bulk', { category: categoryId, attributes }),
};

export default attributeService;
