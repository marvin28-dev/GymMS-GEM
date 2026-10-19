import api from './api';

export const getAll = (params) =>
  api.get('/timecards', { params });

export const create = (data) =>
  api.post('/timecards', data);

export const punchIn = (data) =>
  api.post('/timecards/punchin', data);

// Where someone's shift stands today: { clockable, state: 'none' | 'in' | 'done', punchIn, name }
export const shiftStatus = (staffId) =>
  api.get('/timecards/shift', { params: staffId ? { staffId } : {} });

// Starts the shift of someone who chose to check in when the desk asked
export const startShift = (staffId) =>
  api.post('/timecards/shift/start', { staffId });

// Clocks out the part-time front desk employee working the desk, if still clocked in
export const endOfDay = (staffId) =>
  api.post('/timecards/end-of-day', { staffId });

export const punchOut = (id, data) =>
  api.patch(`/timecards/${id}/punchout`, data);

export const adjust = (id, data) =>
  api.patch(`/timecards/${id}/adjust`, data);

export const approve = (id, data) =>
  api.patch(`/timecards/${id}/approve`, data);

export const reject = (id, data) =>
  api.patch(`/timecards/${id}/reject`, data);

export const remove = (id) =>
  api.delete(`/timecards/${id}`);
