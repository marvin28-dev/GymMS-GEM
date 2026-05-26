import api from './api';

export const getAll = () => api.get('/sales');
export const create = (data) => api.post('/sales', data);
