import axios from 'axios';
import { getAuth, clearAuth } from '../utils/auth';
import { notifyDataChanged, CLIENT_ID, LIVE_CHANGED } from '../utils/events';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  config.headers['X-Client-Id'] = CLIENT_ID;
  const auth = getAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// The account itself was deactivated or removed: sign out and go to this gym's
// login page, with no message. Trying to sign in again is what tells them why.
// This applies to every request, including the credential checks that are
// otherwise allowed to fail without signing out.
const SIGN_OUT_CODES = new Set(['ACCOUNT_DEACTIVATED', 'ACCOUNT_GONE']);

// A screen's requests all fail at once. Only the first may act: by the time
// the second arrives the gym code has been cleared with the rest of the
// session, and it would send the person to the club code page instead.
let signingOut = false;
function signOut() {
  if (signingOut) return;
  signingOut = true;
  const gymCode = getAuth()?.user?.gymCode;
  clearAuth();
  try { sessionStorage.removeItem('fd_session'); } catch { /* signing out still goes ahead */ }
  const target = gymCode ? `/${gymCode}/login` : '/login';
  if (window.location.pathname !== target) window.location.href = target;
}

// On 401, clear auth and redirect to login - but not if already on a login page
api.interceptors.response.use(
  (response) => {
    // Any successful write may have raised a notification or moved a count, so
    // announce it once here rather than from every call site.
    const method = (response.config?.method || '').toLowerCase();
    if (['post', 'patch', 'put', 'delete'].includes(method)) {
      notifyDataChanged();
      // Screens in THIS tab refresh at once too: a pass bought on the profile the
      // front desk has open must show on the desk's own list without a reload.
      // (The server's announcement of this same write is ignored here, see utils/live.js.)
      const resource = String(response.config?.url || '').split('?')[0].split('/').filter(Boolean)[0];
      if (resource && resource !== 'auth') {
        try { window.dispatchEvent(new CustomEvent(LIVE_CHANGED, { detail: { resource, local: true } })); } catch { /* non-browser */ }
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && SIGN_OUT_CODES.has(error.response?.data?.code)) {
      signOut();
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      const onLoginPage = path === '/login' || path.endsWith('/login');
      // Some endpoints use 401 to reject a credential supplied in the body
      // rather than to signal an expired session. Logging out on those would
      // throw the user to the login screen for a simple typo.
      const url = error.config?.url || '';
      const isCredentialCheck = /\/auth\/(change-password|verify-manager)/.test(url);
      if (!onLoginPage && !isCredentialCheck && !signingOut) {
        clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
