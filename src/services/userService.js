import api from '../config/api.js';

const userService = {
  getUsers: (params = {}) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data),
  updatePermissions: (id, data) => api.put(`/users/${id}/permissions`, data),
  resetPermissions: (id) => api.put(`/users/${id}/permissions/reset`),
  getPermissionsConfig: () => api.get('/users/permissions-config'),
  getAssignmentOptions: () => api.get('/users/assignment-options'),
};

export default userService;
