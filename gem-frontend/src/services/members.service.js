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

export const sendCode = (id) =>
  api.post(`/members/${id}/send-code`);

// A membership change with the money for it, in one request: renew,
// change-package, day-pass, visitor-bundle, convert-to-visitor, registration-fee
export const act = (id, action, data) =>
  api.post(`/members/${id}/${action}`, { ...data, tz: new Date().getTimezoneOffset() });
