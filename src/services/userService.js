import api from '../config/api.js';

const userService = {
  getUsers: (params = {}) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  updatePermissions: (id, data) => api.put(`/users/${id}/permissions`, data),
  getPermissionsConfig: () => api.get('/users/permissions-config'),
};

export default userService;
