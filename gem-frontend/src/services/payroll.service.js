import api from './api';

export const getForStaff = (staffId) => api.get(`/payroll/staff/${staffId}`);

export const getAll = (params) => api.get('/payroll', { params });

export const create = (data) => api.post('/payroll', data);

// Marking pay paid books its salary expense on the server in the same step;
// marking it unpaid takes that expense out again
export const setStatus = (id, status, extra = {}) => api.patch(`/payroll/${id}/status`, { status, ...extra });

export const update = (id, data) => api.patch(`/payroll/${id}`, data);

export const linkExpense = (id, expenseId) => api.post(`/payroll/${id}/expense`, { expenseId });

export const remove = (id) => api.delete(`/payroll/${id}`);
