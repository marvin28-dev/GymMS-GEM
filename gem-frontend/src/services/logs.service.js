import api from './api';

// The gym's activity log. The server only answers the general manager.
export const getLogs = (params) => api.get('/logs', { params });
