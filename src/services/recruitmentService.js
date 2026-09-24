import api from '../config/api.js';

const recruitmentService = {
  // Job Openings
  getJobOpenings: (params) => api.get('/recruitment/job-openings', { params }),
  getJobOpeningOptions: () => api.get('/recruitment/job-openings/options'),
  getJobOpeningStats: () => api.get('/recruitment/job-openings/stats'),
  createJobOpening: (data) => api.post('/recruitment/job-openings', data),
  updateJobOpening: (id, data) => api.put(`/recruitment/job-openings/${id}`, data),
  deleteJobOpening: (id) => api.delete(`/recruitment/job-openings/${id}`),

  // Candidates
  getCandidates: (params) => api.get('/recruitment/candidates', { params }),
  getCandidateStats: () => api.get('/recruitment/candidates/stats'),
  getCandidate: (id) => api.get(`/recruitment/candidates/${id}`),
  createCandidate: (data) => api.post('/recruitment/candidates', data),
  updateCandidate: (id, data) => api.put(`/recruitment/candidates/${id}`, data),
  deleteCandidate: (id) => api.delete(`/recruitment/candidates/${id}`),
  updateCandidateStatus: (id, status, rejectionReason) => api.patch(`/recruitment/candidates/${id}/status`, { status, rejectionReason }),
  setTalentPool: (id, talentPool) => api.patch(`/recruitment/candidates/${id}/talent-pool`, { talentPool }),

  // Resume — multipart; the shared API client strips the JSON content-type so
  // the browser can add the multipart boundary itself.
  uploadResume: (id, file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.post(`/recruitment/candidates/${id}/resume`, formData);
  },
  // Authenticated blob download (the endpoint requires a JWT header, so a plain
  // <a href> link would fail auth) — caller turns this into an object URL.
  downloadResume: (id) => api.get(`/recruitment/candidates/${id}/resume`, { responseType: 'blob' }),

  // Interviews
  scheduleInterview: (id, data) => api.post(`/recruitment/candidates/${id}/interviews`, data),
  updateInterview: (id, interviewId, data) => api.patch(`/recruitment/candidates/${id}/interviews/${interviewId}`, data),

  // Conversion
  convertToEmployee: (id, data) => api.post(`/recruitment/candidates/${id}/convert`, data),
};

export default recruitmentService;
