import api from './api';

export const getAll = (params) =>
  api.get('/expenses', { params });

export const create = (data) =>
  api.post('/expenses', data);

export const update = (id, data) =>
  api.patch(`/expenses/${id}`, data);

export const remove = (id) =>
  api.delete(`/expenses/${id}`);
