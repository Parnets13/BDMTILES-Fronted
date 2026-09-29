import api from '../config/api.js';

/**
 * Targets dealers have set for their own Dealer App employees.
 *
 * Read rides along with `dealer.master` on the server, so anyone who can already
 * open a dealer and see its staff can also see their targets. Writing needs the
 * explicit `dealer.employee.targets.manage` grant — overriding a target a dealer
 * set is a business decision, not an incidental one.
 *
 * The server computes achievement through the same service the dealer app uses,
 * so a figure here matches what the dealer and the employee see.
 */
const BASE = '/dealer-employee-targets';

export const dealerEmployeeTargetService = {
  list: (params) => api.get(BASE, { params }),
  summary: () => api.get(`${BASE}/summary`),
  meta: () => api.get(`${BASE}/meta`),
  // One dealer's targets — used by the Dealer Master detail modal.
  forDealer: (dealerId) => api.get(`${BASE}/dealers/${dealerId}`),
  create: (payload) => api.post(BASE, payload),
  update: (id, payload) => api.put(`${BASE}/${id}`, payload),
  setStatus: (id, status) => api.patch(`${BASE}/${id}/status`, { status }),
  remove: (id) => api.delete(`${BASE}/${id}`),
};

export default dealerEmployeeTargetService;
