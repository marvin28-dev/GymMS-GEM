import api from './api';

// With a date, that whole local day
export const getAll = (params) =>
  api.get('/payments', { params: params?.date ? { ...params, tz: new Date().getTimezoneOffset() } : params });

export const create = (data) =>
  api.post('/payments', data);
