import api from './api';

export const getAll = () =>
  api.get('/staff');

export const getOne = (id) =>
  api.get(`/staff/${id}`);

export const create = (data) =>
  api.post('/staff', data);

export const update = (id, data) =>
  api.patch(`/staff/${id}`, data);

export const remove = (id) =>
  api.delete(`/staff/${id}`);

export const getCode = (id) =>
  api.get(`/staff/${id}/code`);
