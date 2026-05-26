import api from './api';

export const getAll = (params) =>
  api.get('/calendar', { params });

export const create = (data) =>
  api.post('/calendar', data);

export const update = (id, data) =>
  api.patch(`/calendar/${id}`, data);

export const remove = (id, { series = false } = {}) =>
  api.delete(`/calendar/${id}`, { params: series ? { series: 'true' } : {} });
