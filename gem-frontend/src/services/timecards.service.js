import api from './api';

export const getAll = (params) =>
  api.get('/timecards', { params });

export const create = (data) =>
  api.post('/timecards', data);

export const punchIn = (data) =>
  api.post('/timecards/punchin', data);

export const punchOut = (id) =>
  api.patch(`/timecards/${id}/punchout`);

export const remove = (id) =>
  api.delete(`/timecards/${id}`);
