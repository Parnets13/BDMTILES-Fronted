import api from '../config/api.js';

const masterService = {
  // Dealer Types
  getDealerTypes: (params) => api.get('/masters/dealer-types', { params }),
  createDealerType: (data) => api.post('/masters/dealer-types', data),
  updateDealerType: (id, data) => api.put(`/masters/dealer-types/${id}`, data),
  deleteDealerType: (id) => api.delete(`/masters/dealer-types/${id}`),

  // Dealer Categories
  getDealerCategories: (params) => api.get('/masters/dealer-categories', { params }),
  createDealerCategory: (data) => api.post('/masters/dealer-categories', data),
  updateDealerCategory: (id, data) => api.put(`/masters/dealer-categories/${id}`, data),
  deleteDealerCategory: (id) => api.delete(`/masters/dealer-categories/${id}`),

  // Regions
  getRegions: (params) => api.get('/masters/regions', { params }),
  createRegion: (data) => api.post('/masters/regions', data),
  updateRegion: (id, data) => api.put(`/masters/regions/${id}`, data),
  deleteRegion: (id) => api.delete(`/masters/regions/${id}`),

  // Routes
  getRoutes: (params) => api.get('/masters/routes', { params }),
  createRoute: (data) => api.post('/masters/routes', data),
  updateRoute: (id, data) => api.put(`/masters/routes/${id}`, data),
  deleteRoute: (id) => api.delete(`/masters/routes/${id}`),

  // Dealers
  getDealers: (params) => api.get('/masters/dealers', { params }),
  getDealer: (id) => api.get(`/masters/dealers/${id}`),
  createDealer: (data) => api.post('/masters/dealers', data),
  updateDealer: (id, data) => api.put(`/masters/dealers/${id}`, data),
  deleteDealer: (id) => api.delete(`/masters/dealers/${id}`),
  getDealerStats: () => api.get('/masters/dealers/stats'),

  // Suppliers
  getSuppliers: (params) => api.get('/masters/suppliers', { params }),
  getSupplier: (id) => api.get(`/masters/suppliers/${id}`),
  createSupplier: (data) => api.post('/masters/suppliers', data),
  updateSupplier: (id, data) => api.put(`/masters/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/masters/suppliers/${id}`),

  // Warehouses
  getWarehouses: (params) => api.get('/masters/warehouses', { params }),
  createWarehouse: (data) => api.post('/masters/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/masters/warehouses/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/masters/warehouses/${id}`),

  // Expense Categories
  getExpenseCategories: (params) => api.get('/masters/expense-categories', { params }),
  createExpenseCategory: (data) => api.post('/masters/expense-categories', data),
  updateExpenseCategory: (id, data) => api.put(`/masters/expense-categories/${id}`, data),
  deleteExpenseCategory: (id) => api.delete(`/masters/expense-categories/${id}`),

  // Vehicles
  getVehicles: (params) => api.get('/masters/vehicles', { params }),
  createVehicle: (data) => api.post('/masters/vehicles', data),
  updateVehicle: (id, data) => api.put(`/masters/vehicles/${id}`, data),
  deleteVehicle: (id) => api.delete(`/masters/vehicles/${id}`),
};

export default masterService;
