import api from './api';

export const getAll = () =>
  api.get('/equipment');

export const create = (data) =>
  api.post('/equipment', data);

export const update = (id, data) =>
  api.patch(`/equipment/${id}`, data);
