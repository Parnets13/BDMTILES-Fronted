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

  /**
   * Who holds a mobile number.
   *
   * Admin-only, and deliberately so — the shared mobile-uniqueness message never names
   * the owner, because a dealer-facing form that did would become an enumeration tool.
   * This endpoint exists only behind `users.manage`, where the caller can already list
   * every user and employee.
   */
  mobileOwner: (mobile, params = {}) => api.get('/users/mobile-owner', { params: { mobile, ...params } }),

  /** Attach an existing HRMS employee to a login. Mirror of hrmsService.linkUser. */
  linkEmployee: (id, employeeId) => api.post(`/users/${id}/link-employee`, { employeeId }),
  // Deactivation needs a reason, and returns 409 with a dealer list when the target
  // still holds dealers — the caller must pass a handover decision to proceed.
  deactivateUser: (id, data) => api.delete(`/users/${id}`, { data }),

  // Role & permission insight (read-only analysis over the permission model)
  getRoleCatalogue: () => api.get('/users/roles'),
  getPermissionHolders: (permissionId) => api.get(`/users/permission-holders/${encodeURIComponent(permissionId)}`),
  getPermissionDrift: () => api.get('/users/permission-drift'),
};

export default userService;
