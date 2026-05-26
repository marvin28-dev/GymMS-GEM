import api from './api';

export const getAll = () =>
  api.get('/notifications');

export const markAllRead = () =>
  api.patch('/notifications/mark-read');

export const markOneRead = (id) =>
  api.patch(`/notifications/${id}/read`);

export const remove = (id) =>
  api.delete(`/notifications/${id}`);
