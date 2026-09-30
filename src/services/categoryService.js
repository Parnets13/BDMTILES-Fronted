import api from '../config/api.js';

const base = '/category-setup';

/**
 * Category setup — the product taxonomy.
 *
 * The taxonomy is one self-referencing tree: level 1 is a department, level 2 a category,
 * level 3 a subcategory. Brand is a LINK on a node (`brands`), never a parent, which is what
 * lets a single "Tiles" node serve Kajaria, Somany and AGL at once.
 *
 * The `brands/:brandId/...` methods at the bottom are the LEGACY shape. They still work —
 * the backend serves them as thin wrappers over the tree — so existing screens keep
 * functioning while they are migrated across. Prefer the `/nodes` methods for anything new.
 */
const categoryService = {
  // ── Tree ────────────────────────────────────────────────────────────────
  /** The whole taxonomy, nested, each node carrying a productCount. */
  getTree: (params) => api.get(`${base}/tree`, { params }),
  /** Flat list, filterable by level / parent / status. */
  getNodes: (params) => api.get(`${base}/nodes`, { params }),
  /** One node, with its breadcrumb, inherited attributes and children. */
  getNode: (id) => api.get(`${base}/nodes/${id}`),

  createNode: (data) => api.post(`${base}/nodes`, data),
  updateNode: (id, data) => api.put(`${base}/nodes/${id}`, data),
  deleteNode: (id) => api.delete(`${base}/nodes/${id}`),

  /**
   * The default names from the seeded taxonomy, for autocomplete. The caller subtracts
   * whatever already exists, so a name is offered exactly until it has been created.
   */
  getSuggestions: () => api.get(`${base}/suggestions`),

  /** Upload a category image; the returned path goes into Category.image. */
  uploadCategoryImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`${base}/upload-image`, formData);
  },

  /** Set which brands carry this category — a link, not a copy. */
  setNodeBrands: (id, brands) => api.put(`${base}/nodes/${id}/brands`, { brands }),
  /** The attribute definitions this node inherits from its ancestors. */
  getNodeAttributes: (id, params) => api.get(`${base}/nodes/${id}/attributes`, { params }),

  // ── Brands ──────────────────────────────────────────────────────────────
  getBrands: (params) => api.get(`${base}/brands`, { params }),
  uploadBrandImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`${base}/brands/upload-image`, formData);
  },
  createBrand: (data) => api.post(`${base}/brands`, data),
  updateBrand: (id, data) => api.put(`${base}/brands/${id}`, data),
  deleteBrand: (id) => api.delete(`${base}/brands/${id}`),

  // ── Legacy shape (still served, still used by older screens) ────────────
  getWebCategories: () => api.get(`${base}/web-categories`),
  getCategories: (brandId, params) => api.get(`${base}/brands/${brandId}/categories`, { params }),
  createCategory: (brandId, data) => api.post(`${base}/brands/${brandId}/categories`, data),
  updateCategory: (id, data) => api.put(`${base}/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`${base}/categories/${id}`),
  getSubcategories: (brandId, categoryId, params) => api.get(`${base}/brands/${brandId}/categories/${categoryId}/subcategories`, { params }),
  createSubcategory: (brandId, categoryId, data) => api.post(`${base}/brands/${brandId}/categories/${categoryId}/subcategories`, data),
  updateSubcategory: (id, data) => api.put(`${base}/subcategories/${id}`, data),
  deleteSubcategory: (id) => api.delete(`${base}/subcategories/${id}`),
};

export default categoryService;
