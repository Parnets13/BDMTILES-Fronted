import api from '../config/api.js';

const hrmsService = {
  // Employees
  getEmployees: (params) => api.get('/hrms/employees', { params }),
  getAllActiveEmployees: async () => {
    const employees = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await api.get('/hrms/employees', { params: { status: 'Active', page, limit: 100 } });
      if (!response.success) return response;
      employees.push(...(response.data || []));
      totalPages = response.pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);
    return { success: true, data: employees };
  },
  getEmployee: (id) => api.get(`/hrms/employees/${id}`),
  createEmployee: (data) => api.post('/hrms/employees', data),
  updateEmployee: (id, data) => api.put(`/hrms/employees/${id}`, data),
  /**
   * Attach an existing login to this employee.
   *
   * Attendance and field tracking resolve the signed-in user through Employee.userId, so
   * an employee with no login — or a login with no employee — cannot punch in. Mirror of
   * userService.linkEmployee; both hit the same service so the two directions cannot
   * drift apart.
   */
  linkUser: (id, userId) => api.post(`/hrms/employees/${id}/link-user`, { userId }),
  deactivateEmployee: (id) => api.delete(`/hrms/employees/${id}`),
  // Backward-compatible alias: the backend now deactivates and never physically deletes.
  deleteEmployee: (id) => api.delete(`/hrms/employees/${id}`),
  exitEmployee: (id, data) => api.post(`/hrms/employees/${id}/exit`, data),
  getEmployeeStats: () => api.get('/hrms/employees/stats'),
  // Authenticated blob download for a file in employee.documents (candidate resumes
  // carried over on conversion, or HR-generated offer/appointment letters etc.).
  downloadEmployeeDocument: (employeeId, fileName) => api.get(`/hrms/employees/${employeeId}/documents/${fileName}`, { responseType: 'blob' }),

  // Attendance
  getAttendance: (params) => api.get('/hrms/attendance', { params }),
  punchIn: (data) => api.post('/hrms/attendance/punch-in', data),
  punchOut: (data) => api.post('/hrms/attendance/punch-out', data),
  markAttendance: (data) => api.post('/hrms/attendance/mark', data),

  // Leaves
  getLeaves: (params) => api.get('/hrms/leaves', { params }),
  applyLeave: (data) => api.post('/hrms/leaves', data),
  approveLeave: (id) => api.patch(`/hrms/leaves/${id}/approve`),
  rejectLeave: (id, reason) => api.patch(`/hrms/leaves/${id}/reject`, { reason }),

  // Salary
  getSalarySlips: (params) => api.get('/hrms/salary-slips', { params }),
  generateSalarySlip: (data) => api.post('/hrms/salary-slips/generate', data),
  generateSalarySlipsBulk: (data) => api.post('/hrms/salary-slips/generate-bulk', data),

  // Loans
  getLoans: (params) => api.get('/hrms/loans', { params }),
  createLoan: (data) => api.post('/hrms/loans', data),

  // Settings
  getSettings: () => api.get('/hrms/settings'),
  updateSettings: (data) => api.put('/hrms/settings', data),

  // Employee exit — resignation, clearance, full & final
  getExits: (params) => api.get('/hrms/exits', { params }),
  getExitStats: () => api.get('/hrms/exits/stats'),
  getExit: (id) => api.get(`/hrms/exits/${id}`),
  createExit: (data) => api.post('/hrms/exits', data),
  decideExit: (id, data) => api.patch(`/hrms/exits/${id}/decision`, data),
  withdrawExit: (id, data) => api.patch(`/hrms/exits/${id}/withdraw`, data),
  updateExitClearance: (id, key, data) => api.patch(`/hrms/exits/${id}/clearance/${key}`, data),
  getSettlementDraft: (id) => api.get(`/hrms/exits/${id}/settlement-draft`),
  saveSettlement: (id, data) => api.post(`/hrms/exits/${id}/settlement`, data),
  updateSettlementStatus: (id, data) => api.patch(`/hrms/exits/${id}/settlement/status`, data),
  recordExitInterview: (id, data) => api.patch(`/hrms/exits/${id}/exit-interview`, data),
  completeExit: (id, data) => api.post(`/hrms/exits/${id}/complete`, data),

  // Performance appraisal
  getPerformanceComponents: () => api.get('/hrms/performance/components'),
  getPerformanceReviews: (params) => api.get('/hrms/performance', { params }),
  getPerformanceStats: () => api.get('/hrms/performance/stats'),
  getPerformanceReview: (id) => api.get(`/hrms/performance/${id}`),
  previewPerformance: (params) => api.get('/hrms/performance/preview', { params }),
  createPerformanceReview: (data) => api.post('/hrms/performance', data),
  updatePerformanceReview: (id, data) => api.put(`/hrms/performance/${id}`, data),
  acknowledgePerformanceReview: (id, data) => api.patch(`/hrms/performance/${id}/acknowledge`, data),
};

export default hrmsService;
