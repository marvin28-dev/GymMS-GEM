const KEY = "gem_auth";

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(payload) {
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearAuth() {
  try {
    const auth = getAuth();
    const gymId = auth?.user?.gymId;
    if (gymId) {
      ['members','staff','checkins','payments','events','notifs','packages','gym',
       'fd_staff','fd_gym'].forEach(k => {
        localStorage.removeItem(`gem_dash_${gymId}_${k}`);
      });
    }
    // Also clear unscoped front-desk cache
    localStorage.removeItem('gem_fd_staff');
    localStorage.removeItem('gem_fd_gym');
  } catch {}
  localStorage.removeItem(KEY);
}

export function isAuthed() {
  return !!getAuth();
}
