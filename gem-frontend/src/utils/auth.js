const KEY          = 'gem_auth';
const ACTIVITY_KEY = 'gem_last_activity';

// Inactivity timeout — 5 minutes of no user interaction triggers the warning
const INACTIVITY_MS = 5 * 60 * 1000;

const today = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(payload) {
  // Stamp the login date so we can enforce daily re-login
  localStorage.setItem(KEY, JSON.stringify({ ...payload, loginDate: today() }));
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
    localStorage.removeItem('gem_fd_staff');
    localStorage.removeItem('gem_fd_gym');
  } catch {}
  localStorage.removeItem(KEY);
  localStorage.removeItem('gem_demo_mode');
  localStorage.removeItem('gem_tour_done');
  localStorage.removeItem(ACTIVITY_KEY);
}

// Returns true (and clears auth) when the stored loginDate is not today.
// Called inside every ProtectedRoute render so the check is transparent.
export function checkDailyExpiry() {
  const auth = getAuth();
  if (!auth) return false;
  if (auth.loginDate !== today()) {
    clearAuth();
    return true;
  }
  return false;
}

// ── Inactivity helpers ────────────────────────────────────────────────────────

export function touchActivity() {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

// Returns true when the last recorded activity exceeds INACTIVITY_MS.
// Returns false when no activity timestamp exists yet (fresh login).
export function isInactive() {
  const last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
  if (!last) return false;
  return Date.now() - last > INACTIVITY_MS;
}

export function isDemoMode() {
  return localStorage.getItem('gem_demo_mode') === '1';
}

export function setDemoMode(val) {
  if (val) localStorage.setItem('gem_demo_mode', '1');
  else localStorage.removeItem('gem_demo_mode');
}

export function isAuthed() {
  return !!getAuth();
}
