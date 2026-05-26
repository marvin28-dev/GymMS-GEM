import api from './api';

export const getGymByCode = (code) =>
  api.get(`/gyms/code/${code}`);

export const getMyGym = () =>
  api.get('/gyms/me');

export const updateMyGym = (data) =>
  api.patch('/gyms/me', data);
