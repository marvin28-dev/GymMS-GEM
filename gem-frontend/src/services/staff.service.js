import api from './api';

export const getAll = () =>
  api.get('/staff');

export const getOne = (id) =>
  api.get(`/staff/${id}`);

export const create = (data) =>
  api.post('/staff', data);

export const update = (id, data) =>
  api.patch(`/staff/${id}`, data);

export const remove = (id) =>
  api.delete(`/staff/${id}`);

export const getCode = (id) =>
  api.get(`/staff/${id}/code`);

export const regenerateCode = (id) =>
  api.post(`/staff/${id}/code/regenerate`);

export const resendInvite = (id) =>
  api.post(`/staff/${id}/resend-invite`);

// Access codes are checked on the server and never sent to the browser.
// purpose: 'frontdesk.signin' or 'frontdesk.exit', for the activity log
// Whether someone signed in at the front desk may carry on
export const checkActive = (id) => api.get(`/staff/${id}/active`);

export const verifyCode = (id, code, purpose) =>
  api.post(`/staff/${id}/verify-code`, { code, purpose });

// Resolves a code typed at the desk to the part-time staff member it belongs to
export const findByCode = (code) =>
  api.get(`/staff/by-code/${encodeURIComponent(code)}`);
