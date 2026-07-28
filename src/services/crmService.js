import api from '../config/api.js';

const crmService = {
  // Leads
  getLeads: (params) => api.get('/leads', { params }),
  getLead: (id) => api.get(`/leads/${id}`),
  getLeadStats: () => api.get('/leads/stats'),
  getDueToday: () => api.get('/leads/due-today'),
  createLead: (data) => api.post('/leads', data),
  updateLead: (id, data) => api.put(`/leads/${id}`, data),
  addFollowup: (id, data) => api.post(`/leads/${id}/followup`, data),
  updateLeadStatus: (id, data) => api.patch(`/leads/${id}/status`, data),

  // Complaints
  getComplaints: (params) => api.get('/complaints', { params }),
  getComplaint: (id) => api.get(`/complaints/${id}`),
  getComplaintStats: () => api.get('/complaints/stats'),
  createComplaint: (data) => api.post('/complaints', data),
  resolveComplaint: (id, data) => api.patch(`/complaints/${id}/resolve`, data),
  updateComplaintStatus: (id, data) => api.patch(`/complaints/${id}/status`, data),

  // Dispatch
  getDispatches: (params) => api.get('/dispatch', { params }),
  getDispatch: (id) => api.get(`/dispatch/${id}`),
  getDispatchStats: () => api.get('/dispatch/stats'),
  getPendingOrders: () => api.get('/dispatch/pending-orders'),
  createDispatch: (data) => api.post('/dispatch', data),
  updateDispatchStatus: (id, data) => api.patch(`/dispatch/${id}/status`, data),

  // Approvals
  getApprovals: (params) => api.get('/approvals', { params }),
  getApprovalStats: () => api.get('/approvals/stats'),
  createApproval: (data) => api.post('/approvals', data),
  approveRequest: (id, data) => api.patch(`/approvals/${id}/approve`, data),
  rejectRequest: (id, data) => api.patch(`/approvals/${id}/reject`, data),
};

export default crmService;
