import api from './api';

// What you have sent to GEM support, newest first
export const getMine = () =>
  api.get('/support');

// { kind, subject, message, page } -> { report, emailed }
export const send = (data) =>
  api.post('/support', data);
