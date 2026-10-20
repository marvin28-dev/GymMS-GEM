import { countryByName } from './countries';
import { pagesFor } from './rolePages';
import { todayStr } from './date';

const KEY          = 'gem_auth';
const ACTIVITY_KEY = 'gem_last_activity';

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

export function setAuth(payload) {
  // Stamp the login date so we can enforce daily re-login
  localStorage.setItem(KEY, JSON.stringify({ ...payload, loginDate: today() }));
  // Signing in is activity. Typing on the sign-in page is not counted (nobody is
  // signed in yet), so a page left open over 15 minutes before a first password
  // was chosen used to land the new account straight on "Are you still there?".
  touchActivity();
  // Signing in says where the gym is, which is what the forms suggest from
  try {
    const country = payload?.user?.gymCountry;
    if (country) localStorage.setItem(COUNTRY_KEY, country);
  } catch {}
}

export function clearAuth() {
  try {
    const auth = getAuth();
    const gymId = auth?.user?.gymId;
    // Every page's copy of the gym's lists (gem_<page>_<gymId>_...) goes with
    // the session: on a shared desk computer they hold members' phones,
    // addresses and balances. Member notes are left alone, because today this
    // browser holds their only copy.
    if (gymId) {
      const scoped = `_${gymId}_`;
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('gem_') && key.includes(scoped)) localStorage.removeItem(key);
      }
    }
    localStorage.removeItem('gem_fd_staff');
    localStorage.removeItem('gem_fd_gym');
    // An old, unscoped copy of desk expenses that nothing writes any more
    localStorage.removeItem('gem_expenses');
  } catch {}
  localStorage.removeItem(KEY);
  localStorage.removeItem('gem_gym_logo');
  // Superseded by columns on the gym record - cleared so stale values from a
  // previous account can't surface in the gym profile
  localStorage.removeItem('gem_gym_extra');
  localStorage.removeItem('gem_demo_mode');
  localStorage.removeItem(ACTIVITY_KEY);
  // Anything about the gym itself belongs to the account that just left. Left
  // behind, it shows the next person to sign in here the last gym's country,
  // currency and settings.
  ['gem_gym_country', 'gem_currency_choice', 'gem_currency_symbol',
   'gem_payment_settings', 'gem_notif_prefs', 'gem_expense_limit',
   'gem_settings_visited'].forEach(k => localStorage.removeItem(k));
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
  localStorage.setItem('gem_setup_pending', '1');
  localStorage.removeItem('gem_setup_confirmed');
}
export function clearSetupPending() {
  localStorage.removeItem('gem_setup_pending');
}
export function isSetupPending() {
  return localStorage.getItem('gem_setup_pending') === '1';
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
  try { return getAuth()?.user?.gymCountry || localStorage.getItem(COUNTRY_KEY) || ''; } catch { return ''; }
}

// The gym's currency code (GHS, NGN, XAF...), straight off the gym record.
export function getGymCurrency() {
  try { return getAuth()?.user?.gymCurrency || ''; } catch { return ''; }
}

// Everything the gym record says about where it is and what it charges in.
// Called after Settings saves so the change is felt without signing in again.
export function updateSessionGym(gym) {
  try {
    const auth = getAuth();
    if (!auth?.user || !gym) return;
    const next = { ...auth, user: { ...auth.user } };
    if (gym.country !== undefined) next.user.gymCountry = gym.country || null;
    if (gym.city !== undefined) next.user.gymCity = gym.city || null;
    if (gym.currency !== undefined) next.user.gymCurrency = gym.currency || null;
    if (gym.name !== undefined) next.user.gymName = gym.name || null;
    localStorage.setItem(KEY, JSON.stringify(next));
    if (gym.country) localStorage.setItem(COUNTRY_KEY, gym.country);
  } catch {}
}

// A street address the way people in that country write one. Falls back to
// something neutral rather than to a Cameroonian street.
export function getAddressPlaceholder() {
  return countryByName(getGymCountry())?.addressPh || 'Street, area';
}

export function setPhoneFormat(dial, placeholder) {
  try { localStorage.setItem(PHONE_FORMAT_KEY, JSON.stringify({ dial, placeholder })); } catch {}
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
  try {
    const fmt = JSON.parse(localStorage.getItem(PHONE_FORMAT_KEY) || 'null');
    if (fmt?.dial && fmt?.placeholder) return `${fmt.dial} ${fmt.placeholder}`;
  } catch {}
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt = TZ_PHONE[tz];
    if (fmt) return `${fmt.dial} ${fmt.placeholder}`;
  } catch {}
  return 'Phone number';
}

// Currency lives on the gym record and is read through utils/currency.js.
