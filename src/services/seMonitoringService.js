import api from '../config/api.js';

/**
 * Sales Executive field-monitoring endpoints (SOW 18.10).
 *
 * All of these return coordinates, addresses and timestamps rather than map tiles, so
 * the monitoring screens work with no map provider configured at all. The map is a
 * renderer layered on top; it is never the source of truth.
 */
const seMonitoringService = {
  /** Where each executive was last seen, plus battery and staleness. */
  live: () => api.get('/sales-executive/monitoring/live'),

  /** One executive's breadcrumb trail for a day. */
  trail: (executiveId, day) =>
    api.get('/sales-executive/monitoring/trail', { params: { executive: executiveId, day } }),

  routeHistory: (params) => api.get('/sales-executive/monitoring/route-history', { params }),

  missedVisits: (params) => api.get('/sales-executive/monitoring/missed-visits', { params }),

  productivity: (params) => api.get('/sales-executive/monitoring/productivity', { params }),

  /** Visits summary, now including the missed count. */
  visitSummary: (params) => api.get('/sales-executive/visits/summary', { params }),
};

export default seMonitoringService;
