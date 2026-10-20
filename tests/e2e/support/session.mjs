// Helpers for the browser tests: talk to the test backend the way the app does,
// make a gym of one's own for each test, and open the app already signed in.
import { createRequire } from 'node:module';

const { API_URL } = createRequire(import.meta.url)('./ports.cjs');

let n = 0;
export function uniqueCode(prefix = 'e') {
  n += 1;
  return `${prefix}${process.pid.toString(36)}${Date.now().toString(36)}${n}`.toLowerCase();
}

export async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
  if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}: ${text}`);
  return json;
}

export const OWNER_PASSWORD = 'Owner-pass-1';

// A new gym and its owner. Returns what the sign-in page would store.
export async function registerGym(overrides = {}) {
  const gymCode = overrides.gymCode || uniqueCode('gym');
  const body = {
    gymCode,
    gymName: `E2E Gym ${gymCode}`,
    location: 'Bonamoussadi',
    phone: '+237 670 000 000',
    city: 'Douala',
    country: 'Cameroon',
    firstName: 'Olive',
    lastName: 'Owner',
    email: `owner.${gymCode}@example.test`,
    password: OWNER_PASSWORD,
    ...overrides,
  };
  const res = await call('POST', '/auth/register', { body });
  return { token: res.token, user: res.user, gymCode: res.user.gymCode, email: body.email, password: body.password, accessCode: res.accessCode };
}

// Adds an employee as the owner and claims the account the way a new employee
// does, so the test can sign in as them.
export async function addStaff(owner, { role = 'front_desk', password = 'Staff-pass-1', ...overrides } = {}) {
  const code = uniqueCode(role.slice(0, 2));
  const body = {
    firstName: 'Sam', lastName: `Staff ${code}`, email: `${code}@example.test`, phone: '677000000',
    role, city: 'Douala', region: 'Littoral', ...overrides,
  };
  const made = await call('POST', '/staff', { token: owner.token, body });
  const { accessCode } = await call('GET', `/staff/${made.id}/code`, { token: owner.token });
  const session = await call('POST', '/auth/set-password', { body: { gymCode: owner.gymCode, email: body.email, password, code: accessCode } });
  return { ...made, accessCode, password, token: session.token, user: session.user, gymCode: owner.gymCode };
}

// Print windows call the browser's print dialog, which a test cannot answer.
// Windows the page opens get a print that does nothing, so the test can read
// what was written into them.
export async function stubPrinting(page) {
  await page.addInitScript(() => {
    const open = window.open;
    window.open = (...args) => {
      const win = open.apply(window, args);
      if (win) win.print = () => {};
      return win;
    };
  });
}

// Opens the app as this account: the session is put where the sign-in page
// puts it, before the app's own code runs.
export async function signIn(page, session) {
  await page.addInitScript(({ token, user }) => {
    // about:blank has no storage of its own; only the app's pages are seeded,
    // and only once per tab, so signing out during a test sticks.
    if (!/^https?:$/.test(location.protocol) || sessionStorage.getItem('e2e_signed_in')) return;
    sessionStorage.setItem('e2e_signed_in', '1');
    localStorage.setItem('gem_auth', JSON.stringify({ token, user, loginDate: new Date().toISOString().slice(0, 10) }));
    localStorage.setItem('gem_last_activity', String(Date.now()));
  }, { token: session.token, user: session.user });
}
