import api from '../config/api.js';

const notificationService = {
  getInbox: (params = {}) => api.get('/notifications/inbox', { params }),
  getUnreadCount: () => api.get('/notifications/inbox/unread-count'),
  markRead: (id) => api.patch(`/notifications/inbox/${id}/read`),
  markAllRead: () => api.patch('/notifications/inbox/read-all'),
  getTemplates: (params = {}) => api.get('/notifications/templates', { params }),
  createTemplate: (data) => api.post('/notifications/templates', data),
  updateTemplate: (id, data) => api.put(`/notifications/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/notifications/templates/${id}`),
  sendTest: (data) => api.post('/notifications/send', data),
  getSettings: () => api.get('/notifications/settings'),
  getModuleSettings: (module) => api.get(`/notifications/settings/${module}`),
  updateModuleSettings: (module, data) => api.put(`/notifications/settings/${module}`, data),
  initializeSettings: () => api.post('/notifications/settings/initialize'),
  getDeliveryAudit: (params = {}) => api.get('/notifications/delivery-audit', { params }),
  getAccessPolicies: () => api.get('/access-policies'),
  saveAccessPolicy: (module, resourceKey, data) => api.put(`/access-policies/${module}/${encodeURIComponent(resourceKey || '*')}`, data),
  deleteAccessPolicy: (id) => api.delete(`/access-policies/${id}`),
};

export default notificationService;
