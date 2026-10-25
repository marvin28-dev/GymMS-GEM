import { countryByName } from './countries';
import { pagesFor } from './rolePages';
import { todayStr } from './date';
import { readStored, readStoredJson, store, storeJson, storedKeys, unstore } from './storage';

const KEY          = 'gem_auth';
const ACTIVITY_KEY = 'gem_last_activity';

// The shortest new password the server accepts (D-36)
export const MIN_PASSWORD = 8;

// Inactivity timeout - 15 minutes of no user interaction triggers the warning
const INACTIVITY_MS = 15 * 60 * 1000;

// The local day: the UTC one began at 01:00 in Douala, so someone who signed in
// at 00:30 was signed out half an hour later
const today = todayStr; // 'YYYY-MM-DD'

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Says whether the session could be kept: a browser that blocks site storage
// cannot hold one, and the sign-in pages say so (F-082)
export function setAuth(payload) {
  // Stamp the login date so we can enforce daily re-login
  if (!storeJson(KEY, { ...payload, loginDate: today() })) return false;
  // Signing in is activity. Typing on the sign-in page is not counted (nobody is
  // signed in yet), so a page left open over 15 minutes before a first password
  // was chosen used to land the new account straight on "Are you still there?".
  touchActivity();
  // Signing in says where the gym is, which is what the forms suggest from
  const country = payload?.user?.gymCountry;
  if (country) store(COUNTRY_KEY, country);
  return true;
}

// The gym's own sign-in page for whoever is signed in, read before the
// session is cleared; the gym-code page when nobody is
export function signInPath() {
  const code = getAuth()?.user?.gymCode;
  return code ? `/${encodeURIComponent(code)}/login` : '/login';
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Signing out ends the token on the server too, so a copy of it (another tab,
// a session taken from this computer) stops working at once (D-3). keepalive
// lets the request finish while the page moves on to the sign-in screen.
function revokeOnServer(token) {
  if (!token || typeof fetch !== 'function') return;
  fetch(`${API_BASE}/auth/logout`, { method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${token}` } })
    .catch(err => console.warn('Sign-out could not reach the server; the session still ends in this browser.', err?.message));
}

export function clearAuth() {
  revokeOnServer(getAuth()?.token);
  const gymId = getAuth()?.user?.gymId;
  // Every page's copy of the gym's lists (gem_<page>_<gymId>_...) goes with
  // the session: on a shared desk computer they hold members' phones,
  // addresses and balances. Member notes are left alone, because today this
  // browser holds their only copy.
  if (gymId) {
    const scoped = `_${gymId}_`;
    for (const key of storedKeys()) {
      if (key.startsWith('gem_') && key.includes(scoped)) unstore(key);
    }
  }
  unstore('gem_fd_staff');
  unstore('gem_fd_gym');
  // An old, unscoped copy of desk expenses that nothing writes any more
  unstore('gem_expenses');
  unstore(KEY);
  unstore('gem_gym_logo');
  // Superseded by columns on the gym record - cleared so stale values from a
  // previous account can't surface in the gym profile
  unstore('gem_gym_extra');
  unstore('gem_demo_mode');
  unstore(ACTIVITY_KEY);
  // Anything about the gym itself belongs to the account that just left. Left
  // behind, it shows the next person to sign in here the last gym's country,
  // currency and settings.
  ['gem_gym_country', 'gem_currency_choice', 'gem_currency_symbol',
   'gem_payment_settings', 'gem_notif_prefs', 'gem_expense_limit',
   'gem_settings_visited'].forEach(unstore);
}

// Returns true (and clears auth) when the stored loginDate is not today.
// Called inside every ProtectedRoute render so the check is transparent.
export function checkDailyExpiry() {
  const auth = getAuth();
  if (!auth) return false;
  if (auth.loginDate !== today() || tokenExpired(auth)) {
    clearAuth();
    return true;
  }
  return false;
}

// ── Setup / onboarding flag ───────────────────────────────────────────────────

export function setSetupPending() {
  store('gem_setup_pending', '1');
  unstore('gem_setup_confirmed');
}
export function clearSetupPending() {
  unstore('gem_setup_pending');
}
export function isSetupPending() {
  return readStored('gem_setup_pending') === '1';
}

// ── Inactivity helpers ────────────────────────────────────────────────────────

export function touchActivity() {
  store(ACTIVITY_KEY, String(Date.now()));
}

// Returns true when the last recorded activity exceeds INACTIVITY_MS.
// Returns false when no activity timestamp exists yet (fresh login).
export function isInactive() {
  const last = parseInt(readStored(ACTIVITY_KEY, '0'), 10);
  if (!last) return false;
  return Date.now() - last > INACTIVITY_MS;
}

export function isDemoMode() {
  return readStored('gem_demo_mode') === '1';
}

export function setDemoMode(val) {
  if (val) store('gem_demo_mode', '1');
  else unstore('gem_demo_mode');
}

// A token is only good for 8 hours. Sign in at nine in the morning, come back
// to the same computer after six, and the stored session still looks fine by
// date while the token behind it has expired: the app would draw the dashboard,
// the first request would come back 401, and the screen would snap to the login
// page. Reading the expiry out of the token here decides it before anything is
// drawn, so there is nothing to flash.
function tokenExpired(auth) {
  const token = auth?.token;
  if (typeof token !== 'string') return false;
  const body = token.split('.')[1];
  if (!body) return false;
  try {
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json)?.exp;
    // A token with no expiry, or one we cannot read, is left to the server
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function isAuthed() {
  const auth = getAuth();
  if (!auth) return false;
  if (tokenExpired(auth)) { clearAuth(); return false; }
  return true;
}

export function getRole() {
  return getAuth()?.user?.role || null;
}

export function getHomeRoute() {
  const role = getRole();
  if (role === 'front_desk') return '/front-desk';
  // A role with no dashboard ("Other", or one the app does not know) lands on
  // its own record; sending it to the dashboard would bounce off the guard
  const pages = pagesFor(role).pages;
  if (pages && !pages.includes('dashboard')) return '/my-profile';
  return '/dashboard';
}

// ── Phone format ──────────────────────────────────────────────────────────────

const PHONE_FORMAT_KEY = 'gem_phone_format';
const COUNTRY_KEY = 'gem_gym_country';


// The country the gym is in, by name, as the gym record holds it. The signed-in
// session wins: the stored copy is only a leftover for sessions that predate it,
// and reading it first would show one account the previous account's country.
export function getGymCountry() {
  return getAuth()?.user?.gymCountry || readStored(COUNTRY_KEY, '');
}

// The gym's currency code (GHS, NGN, XAF...), straight off the gym record.
export function getGymCurrency() {
  try { return getAuth()?.user?.gymCurrency || ''; } catch { return ''; }
}

// Everything the gym record says about where it is and what it charges in.
// Called after Settings saves so the change is felt without signing in again.
// A change to the signed-in person's own details, kept with the session
export function updateSessionUser(patch) {
  const auth = getAuth();
  if (!auth?.user || !patch) return;
  storeJson(KEY, { ...auth, user: { ...auth.user, ...patch } });
}

export function updateSessionGym(gym) {
  const auth = getAuth();
  if (!auth?.user || !gym) return;
  const next = { ...auth, user: { ...auth.user } };
  if (gym.country !== undefined) next.user.gymCountry = gym.country || null;
  if (gym.city !== undefined) next.user.gymCity = gym.city || null;
  if (gym.currency !== undefined) next.user.gymCurrency = gym.currency || null;
  if (gym.name !== undefined) next.user.gymName = gym.name || null;
  storeJson(KEY, next);
  if (gym.country) store(COUNTRY_KEY, gym.country);
}

// A street address the way people in that country write one. Falls back to
// something neutral rather than to a Cameroonian street.
export function getAddressPlaceholder() {
  return countryByName(getGymCountry())?.addressPh || 'Street, area';
}

export function setPhoneFormat(dial, placeholder) {
  storeJson(PHONE_FORMAT_KEY, { dial, placeholder });
}

// An old browser may not say which time zone it is in
function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
}

const TZ_PHONE = {
  'Africa/Douala':       { dial: '+237', placeholder: '6XX XXX XXX' },
  'Africa/Lagos':        { dial: '+234', placeholder: '8XX XXX XXXX' },
  'Africa/Accra':        { dial: '+233', placeholder: '2X XXX XXXX' },
  'Africa/Dakar':        { dial: '+221', placeholder: '7X XXX XXXX' },
  'Africa/Abidjan':      { dial: '+225', placeholder: '07 XX XX XX XX' },
  'Africa/Nairobi':      { dial: '+254', placeholder: '7XX XXX XXX' },
  'Africa/Johannesburg': { dial: '+27',  placeholder: '7X XXX XXXX' },
  'Europe/Paris':        { dial: '+33',  placeholder: '6X XX XX XX' },
  'Europe/London':       { dial: '+44',  placeholder: '7XXX XXX XXX' },
  'America/New_York':    { dial: '+1',   placeholder: '(XXX) XXX-XXXX' },
  'America/Chicago':     { dial: '+1',   placeholder: '(XXX) XXX-XXXX' },
  'America/Los_Angeles': { dial: '+1',   placeholder: '(XXX) XXX-XXXX' },
  'America/Denver':      { dial: '+1',   placeholder: '(XXX) XXX-XXXX' },
};

export function getPhonePlaceholder() {
  // The gym's own country wins: a Nigerian gym should not be offered +237
  // because the browser happens to sit in another time zone.
  const home = countryByName(getGymCountry());
  if (home) return `${home.dial} ${home.placeholder}`;
  const saved = readStoredJson(PHONE_FORMAT_KEY, null);
  if (saved?.dial && saved?.placeholder) return `${saved.dial} ${saved.placeholder}`;
  const fmt = TZ_PHONE[browserTimeZone()];
  if (fmt) return `${fmt.dial} ${fmt.placeholder}`;
  return 'Phone number';
}

// Currency lives on the gym record and is read through utils/currency.js.
