import api from './api';

// No argument: the latest 100. A 'YYYY-MM-DD' string: that whole local day.
// { from, to }: every sale between those local days. tz makes it the gym's
// day, not UTC's.
export const getAll = (when) => {
  if (!when) return api.get('/sales');
  const tz = new Date().getTimezoneOffset();
  return api.get('/sales', { params: typeof when === 'string' ? { date: when, tz } : { ...when, tz } });
};
export const create = (data) => api.post('/sales', data);
