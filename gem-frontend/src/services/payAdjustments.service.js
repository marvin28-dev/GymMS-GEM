import api from './api';

export const getForStaff = (staffId) => api.get(`/pay-adjustments/staff/${staffId}`);

export const previewMonth = (staffId, month) =>
  api.get(`/pay-adjustments/staff/${staffId}/preview`, { params: { month } });

export const create = (data) => api.post('/pay-adjustments', data);

export const update = (id, data) => api.patch(`/pay-adjustments/${id}`, data);

export const remove = (id) => api.delete(`/pay-adjustments/${id}`);
