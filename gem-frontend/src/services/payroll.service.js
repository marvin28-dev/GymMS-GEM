import api from './api';

export const getForStaff = (staffId) => api.get(`/payroll/staff/${staffId}`);

export const getAll = (params) => api.get('/payroll', { params });

export const create = (data) => api.post('/payroll', data);

export const setStatus = (id, status) => api.patch(`/payroll/${id}/status`, { status });

export const remove = (id) => api.delete(`/payroll/${id}`);
