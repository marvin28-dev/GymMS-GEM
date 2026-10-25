import api from './api';

export const getAll = (params) =>
  api.get('/expenses', { params });

export const create = (data) =>
  api.post('/expenses', data);

// Desk expenses waiting on a manager, and the action that clears one.
export const getPending = () =>
  api.get('/expenses', { params: { pending: 1 } });

export const approve = (id) =>
  api.patch(`/expenses/${id}/approve`);

export const update = (id, data) =>
  api.patch(`/expenses/${id}`, data);

export const remove = (id) =>
  api.delete(`/expenses/${id}`);

// Attaches a receipt photo to an expense that has none
export const setReceipt = (id, receipt) =>
  api.put(`/expenses/${id}/receipt`, { receipt });
