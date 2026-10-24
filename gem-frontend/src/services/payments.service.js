import api from './api';
import { getAuth } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// A best-effort refund that still goes out while the tab is closing. Normal
// axios/fetch is cancelled on unload; `keepalive` lets this one survive so a
// payment collected inside an aborted transaction isn't left in the books.
export const removeKeepalive = (id) => {
  try {
    const token = getAuth()?.token;
    return fetch(`${API_BASE}/payments/${id}`, {
      method: 'DELETE',
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch { return Promise.resolve(); }
};

// With a date, that whole local day
export const getAll = (params) =>
  api.get('/payments', { params: params?.date ? { ...params, tz: new Date().getTimezoneOffset() } : params });

export const create = (data) =>
  api.post('/payments', data);

export const remove = (id) =>
  api.delete(`/payments/${id}`);

export const sendReceipt = (id) =>
  api.post(`/payments/${id}/receipt`);
