import axios from 'axios';
import { getAdminAuth, forgetAdminAuth } from '../utils/adminAuth';

// GEM's admin dashboard talks to /api/admin with the admin's own token. Its
// own client: a gym's interceptors (sign out to the gym's login page, the
// paused-account screen) have nothing to do with it.
const admin = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin`,
  headers: { 'Content-Type': 'application/json' },
});

admin.interceptors.request.use((config) => {
  const token = getAdminAuth()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A session that ended (expired, signed out elsewhere) goes back to sign-in
admin.interceptors.response.use((r) => r, (error) => {
  const isLogin = String(error.config?.url || '').includes('/login');
  if (error.response?.status === 401 && !isLogin) {
    forgetAdminAuth();
    if (!window.location.pathname.startsWith('/admin/login')) window.location.href = '/admin/login';
  }
  return Promise.reject(error);
});

export const login = (email, password) => admin.post('/login', { email, password });
export const logout = () => admin.post('/logout');
export const getOverview = () => admin.get('/overview');
export const getCounts = () => admin.get('/counts');

export const getGyms = (params = {}) => admin.get('/gyms', { params });
export const getGym = (id) => admin.get(`/gyms/${id}`);
export const updateGym = (id, data) => admin.patch(`/gyms/${id}`, data);
export const lockGym = (id, reason) => admin.post(`/gyms/${id}/lock`, { reason });
export const unlockGym = (id) => admin.post(`/gyms/${id}/unlock`);

export const getInvoices = (params = {}) => admin.get('/invoices', { params });
export const prepareInvoices = (period) => admin.post('/invoices/prepare', { period });
export const sendAllInvoices = (period) => admin.post('/invoices/send-all', { period });
export const updateInvoice = (id, data) => admin.patch(`/invoices/${id}`, data);
export const sendInvoice = (id) => admin.post(`/invoices/${id}/send`);
export const markInvoicePaid = (id, data) => admin.post(`/invoices/${id}/paid`, data);
export const remindInvoice = (id) => admin.post(`/invoices/${id}/remind`);
export const voidInvoice = (id, reason) => admin.post(`/invoices/${id}/void`, { reason });

export const getLeads = () => admin.get('/leads');
export const createLead = (data) => admin.post('/leads', data);
export const updateLead = (id, data) => admin.patch(`/leads/${id}`, data);

export const getReports = () => admin.get('/support');
export const updateReport = (id, data) => admin.patch(`/support/${id}`, data);
export const replyToReport = (id, reply, resolve) => admin.post(`/support/${id}/reply`, { reply, resolve });

export const getAnnouncements = () => admin.get('/announcements');
export const createAnnouncement = (data) => admin.post('/announcements', data);

export const getSettings = () => admin.get('/settings');
export const saveSettings = (data) => admin.put('/settings', data);
