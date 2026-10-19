import api from './api';

export const getAll = () =>
  api.get('/communications');

export const getOne = (id) =>
  api.get(`/communications/${id}`);

// Whether email and texting are set up (and whether either is in test mode)
export const getChannels = () =>
  api.get('/communications/channels');

// How many people an audience reaches, and how many have an email or a phone
// With list, everyone it reaches: { people: [{ id, name, memberCode, email, phone }] }
export const previewAudience = (audience, { list = false } = {}) =>
  api.post('/communications/audience', { audience, ...(list ? { list: true } : {}) });

// { id?, action: 'send' | 'schedule' | 'draft', channel: 'email' | 'sms' | 'both', subject, body, audience, scheduledAt }
export const create = (data) =>
  api.post('/communications', data);

export const retry = (id) =>
  api.post(`/communications/${id}/retry`);

export const cancelSchedule = (id) =>
  api.post(`/communications/${id}/cancel`);

export const remove = (id) =>
  api.delete(`/communications/${id}`);

// Every message one member was sent, for their profile
export const getForMember = (memberId) =>
  api.get(`/communications/member/${memberId}`);
