import api from './api';

export const getGymByCode = (code) =>
  api.get(`/gyms/code/${encodeURIComponent(code)}`);

export const getMyGym = () =>
  api.get('/gyms/me');

export const updateMyGym = (data) =>
  api.patch('/gyms/me', data);

export const getSetupStatus = () =>
  api.get('/gyms/me/setup');

export const confirmSetupSection = (section) =>
  api.post('/gyms/me/setup/confirm', { section });
