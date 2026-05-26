import api from './api';

export const getAll = (params) =>
  api.get('/attendance', { params });

export const checkIn = (data) =>
  api.post('/attendance/checkin', data);

export const checkOut = (id) =>
  api.patch(`/attendance/${id}/checkout`);
