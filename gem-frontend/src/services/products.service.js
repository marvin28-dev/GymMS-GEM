import api from './api';

export const getAll = () =>
  api.get('/products');

export const create = (data) =>
  api.post('/products', data);

export const update = (id, data) =>
  api.patch(`/products/${id}`, data);

export const remove = (id) =>
  api.delete(`/products/${id}`);

// Adds stock on the server in one step, so two restocks at once both count
export const restock = (id, quantity) =>
  api.post(`/products/${id}/restock`, { quantity });
