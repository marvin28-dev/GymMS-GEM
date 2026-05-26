import api from './api';

export const getAll = () =>
  api.get('/products');

export const create = (data) =>
  api.post('/products', data);

export const update = (id, data) =>
  api.patch(`/products/${id}`, data);

export const remove = (id) =>
  api.delete(`/products/${id}`);
