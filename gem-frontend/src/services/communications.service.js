import api from './api';

export const getAll = () =>
  api.get('/communications');

export const create = (data) =>
  api.post('/communications', data);

export const remove = (id) =>
  api.delete(`/communications/${id}`);
