import api from './api';

export const getAll = (params) =>
  api.get('/attendance', { params });

// Members' check-ins over the last 7, 30 or 90 days, counted by the server
export const getStats = (params) =>
  api.get('/attendance/stats', { params });

export const checkIn = (data) =>
  api.post('/attendance/checkin', data);

export const checkOut = (id) =>
  api.patch(`/attendance/${id}/checkout`);
