import api from './api';

// A manager applying a member change directly.
export const applyDirect = (data) => api.post('/approvals/apply', data);
// The front desk asking a manager to approve a change.
export const create = (data) => api.post('/approvals', data);
export const listForMember = (memberId, params) => api.get(`/approvals/member/${memberId}`, { params });
export const approve = (id, data) => api.post(`/approvals/${id}/approve`, data);
export const reject = (id, data) => api.post(`/approvals/${id}/reject`, data);
export const cancel = (id) => api.post(`/approvals/${id}/cancel`);
