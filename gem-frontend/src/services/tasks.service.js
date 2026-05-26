import api from './api';

export const getAll = () =>
  api.get('/tasks');

export const create = (data) =>
  api.post('/tasks', data);

export const update = (id, data) =>
  api.patch(`/tasks/${id}`, data);

export const remove = (id) =>
  api.delete(`/tasks/${id}`);
