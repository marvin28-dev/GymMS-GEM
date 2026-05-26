import api from './api';

export const getAll = (params) =>
  api.get('/payments', { params });

export const create = (data) =>
  api.post('/payments', data);
