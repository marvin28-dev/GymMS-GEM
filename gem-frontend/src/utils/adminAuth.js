// GEM's own admin session, kept apart from any gym's (gem_admin_auth, not
// gem_auth): signing in to the admin dashboard never touches a gym sign-in on
// the same browser, and the other way round.
const KEY = 'gem_admin_auth';

export function getAdminAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAdminAuth({ token, admin }) {
  try { localStorage.setItem(KEY, JSON.stringify({ token, admin })); } catch { /* the session lasts as long as the page */ }
}

// The token's own expiry, read before anything is drawn
function expired(token) {
  try {
    const exp = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.exp;
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function isAdminAuthed() {
  const auth = getAdminAuth();
  if (!auth?.token) return false;
  if (expired(auth.token)) { forgetAdminAuth(); return false; }
  return true;
}

export function forgetAdminAuth() {
  try { localStorage.removeItem(KEY); } catch { /* nothing kept */ }
}
