import api from './api';

export const getAll = (params) =>
  api.get('/members', { params });

export const getOne = (id) =>
  api.get(`/members/${id}`);

export const create = (data) =>
  api.post('/members', data);

export const update = (id, data) =>
  api.patch(`/members/${id}`, data);

export const remove = (id) =>
  api.delete(`/members/${id}`);
