import api from './api';

export const login = (gymCode, email, password) =>
  api.post('/auth/login', { gymCode, email, password });

export const register = (data) =>
  api.post('/auth/register', data);

export const getMe = () =>
  api.get('/auth/me');

export const verifyManager = (password) =>
  api.post('/auth/verify-manager', { password });
