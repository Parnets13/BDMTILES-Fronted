import api from '../config/api.js';

const hrTemplateService = {
  getTemplates: (params) => api.get('/hr-templates/templates', { params }),
  getTemplate: (id) => api.get(`/hr-templates/templates/${id}`),
  createTemplate: (data) => api.post('/hr-templates/templates', data),
  updateTemplate: (id, data) => api.put(`/hr-templates/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/hr-templates/templates/${id}`),

  getFieldMap: () => api.get('/hr-templates/field-map'),
  previewTemplate: (id, employeeId) => api.post(`/hr-templates/templates/${id}/preview`, { employeeId }),
  generateDocument: (id, employeeId) => api.post(`/hr-templates/templates/${id}/generate`, { employeeId }),

  // Authenticated blob download for a generated PDF.
  downloadDocument: (fileName) => api.get(`/hr-templates/documents/${fileName}`, { responseType: 'blob' }),
};

export default hrTemplateService;
