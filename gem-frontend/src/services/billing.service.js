import api from './api';

// What the gym pays GEM: its plan, its bills and how to pay (the owner's alone)
export const getBilling = () => api.get('/billing');

// Whether GEM has paused the gym's account, for anyone signed in
export const getBillingStatus = () => api.get('/billing/status');

// The landing page's "Book a demo" form
export const sendLead = (data) => api.post('/leads', data);
