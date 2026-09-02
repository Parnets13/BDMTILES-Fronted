import api from '../config/api.js';

const crmService = {
  // Leads
  getLeads: (params) => api.get('/leads', { params }),
  getLead: (id) => api.get(`/leads/${id}`),
  getLeadStats: () => api.get('/leads/stats'),
  getSEStatus: () => api.get('/leads/se-status'),
  getLeadSettings: () => api.get('/leads/settings'),
  updateLeadSettings: (data) => api.patch('/leads/settings', data),
  processLeadAssignmentTimeouts: () => api.post('/leads/assignments/process-timeouts'),
  getMyLeads: () => api.get('/leads/my-leads'),
  getMyLeadAvailability: () => api.get('/leads/availability/me'),
  updateMyLeadAvailability: (data) => api.patch('/leads/availability/me', data),
  overrideLeadAvailability: (userId, data) => api.patch(`/leads/availability/${userId}`, data),
  getLeadVisits: (id) => api.get(`/leads/${id}/visits`),
  createLeadVisit: (id, data) => api.post(`/leads/${id}/visits`, data),
  updateLeadVisitStatus: (id, visitId, data) => api.patch(`/leads/${id}/visits/${visitId}/status`, data),
  createLead: (data) => api.post('/leads', data),
  updateLead: (id, data) => api.put(`/leads/${id}`, data),
  assignLead: (id, data) => api.patch(`/leads/${id}/assign`, data),
  acceptLead: (id, data) => api.patch(`/leads/${id}/accept`, data),
  declineLead: (id, data) => api.patch(`/leads/${id}/decline`, data),
  addFollowup: (id, data) => api.patch(`/leads/${id}/followup`, data),
  updateLeadStatus: (id, data) => api.patch(`/leads/${id}/status`, data),
  convertLead: (id, data) => api.patch(`/leads/${id}/convert`, data),

  // Complaints
  getComplaints: (params) => api.get('/complaints', { params }),
  getComplaint: (id) => api.get(`/complaints/${id}`),
  getComplaintStats: () => api.get('/complaints/stats'),
  createComplaint: (data) => api.post('/complaints', data),
  uploadComplaintEvidence: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/complaints/evidence', formData);
  },
  getComplaintSourcesForDealer: (dealerId) => api.get(`/complaints/sources/dealer/${dealerId}`),
  sendComplaintToWarehouse: (id, data = {}) => api.patch(`/complaints/${id}/send-to-warehouse`, data),
  getWarehouseComplaintQueue: () => api.get('/complaints/pending-verification'),
  verifyComplaintWarehouse: (id, data) => api.patch(`/complaints/${id}/warehouse-verify`, data),
  getFinanceComplaintQueue: () => api.get('/complaints/pending-finance'),
  reviewComplaintFinance: (id, data) => api.patch(`/complaints/${id}/finance-review`, data),

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
