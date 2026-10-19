import api from './api';

// The signed-in coach's day; tz makes "today" and "this month" the gym's own
export const getOverview = () => api.get('/coach/overview', { params: { tz: new Date().getTimezoneOffset() } });
// coachId null removes the coach
export const assignCoach = (memberId, coachId, extra = {}) => api.post('/coach/assign', { memberId, coachId, ...extra });
// What a member is working towards; baseline holds measurements to record with it
export const setGoals = (memberId, goals, baseline) => api.put(`/coach/goals/${memberId}`, { goals, baseline });
export const getProgress = (memberId) => api.get(`/coach/progress/${memberId}`);
export const addProgress = (memberId, data) => api.post(`/coach/progress/${memberId}`, data);
export const removeProgress = (id) => api.delete(`/coach/progress/entry/${id}`);
// One coach's clients, for a manager (or the coach themself)
export const getCoachClients = (staffId) => api.get(`/coach/clients/${staffId}`, { params: { tz: new Date().getTimezoneOffset() } });
