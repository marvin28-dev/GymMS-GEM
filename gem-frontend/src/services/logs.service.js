import api from './api';

// The gym's activity log. The server only answers the general manager.
// Days in the filter are this browser's days
export const getLogs = (params) => api.get('/logs', { params: { ...params, tz: new Date().getTimezoneOffset() } });
