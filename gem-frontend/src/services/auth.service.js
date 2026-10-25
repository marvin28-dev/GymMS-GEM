import api from './api';

// Whether an email is a new account that still has to choose its password
export const loginStatus = (gymCode, email) =>
  api.post('/auth/login-status', { gymCode, email });

// A new account's first password. The reply signs them in and carries their 4-digit code.
export const setFirstPassword = (gymCode, email, password, code) =>
  api.post('/auth/set-password', { gymCode, email, password, code });

export const login = (gymCode, email, password) =>
  api.post('/auth/login', { gymCode, email, password });

export const register = (data) =>
  api.post('/auth/register', data);

// Confirming an email address (D-8)
export const verifyEmail = (token) => api.post('/auth/verify-email', { token });
export const resendConfirmation = () => api.post('/auth/resend-confirmation');

export const getMe = () =>
  api.get('/auth/me');

// The manager's own 4-digit access code, checked server-side. Revealing an
// access code is the one gate that cannot use a code, so it sends a password.
// `purpose` is what the screen says the code is for, so the activity log can say it too
export const verifyManager = (code, purpose) =>
  api.post('/auth/verify-manager', { code, purpose });

export const verifyManagerPassword = (password, purpose) =>
  api.post('/auth/verify-manager', { password, purpose });

export const checkGymCode = (code) =>
  api.get(`/auth/check-code/${encodeURIComponent(code)}`);

export const forgotPassword = (gymCode, email) =>
  api.post('/auth/forgot-password', { gymCode, email });

export const resetPassword = (token, password) =>
  api.post('/auth/reset-password', { token, password });

export const verifyResetToken = (token) =>
  api.get(`/auth/verify-reset-token/${encodeURIComponent(token)}`);
