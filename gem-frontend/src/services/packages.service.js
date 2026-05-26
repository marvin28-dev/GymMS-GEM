import api from './api';

export const getAll = () =>
  api.get('/packages');

export const create = (data) =>
  api.post('/packages', data);

export const update = (id, data) =>
  api.patch(`/packages/${id}`, data);

export const remove = (id) =>
  api.delete(`/packages/${id}`);
