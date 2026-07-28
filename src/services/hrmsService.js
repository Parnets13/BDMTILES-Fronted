import api from '../config/api.js';

const hrmsService = {
  // Employees
  getEmployees: (params) => api.get('/hrms/employees', { params }),
  getEmployee: (id) => api.get(`/hrms/employees/${id}`),
  createEmployee: (data) => api.post('/hrms/employees', data),
  updateEmployee: (id, data) => api.put(`/hrms/employees/${id}`, data),
  deleteEmployee: (id) => api.delete(`/hrms/employees/${id}`),
  getEmployeeStats: () => api.get('/hrms/employees/stats'),

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

  // Loans
  getLoans: (params) => api.get('/hrms/loans', { params }),
  createLoan: (data) => api.post('/hrms/loans', data),

  // Settings
  getSettings: () => api.get('/hrms/settings'),
  updateSettings: (data) => api.put('/hrms/settings', data),
};

export default hrmsService;
