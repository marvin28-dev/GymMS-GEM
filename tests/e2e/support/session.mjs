// Helpers for the browser tests: talk to the test backend the way the app does,
// make a gym of one's own for each test, and open the app already signed in.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const local = createRequire(import.meta.url);
const { API_URL, OUTBOX_URL } = local('./ports.cjs');

// The demo gym "elite" is made by the seed, as on a demo server (sign-up
// refuses its code). The seed only adds what is missing, so running it again is
// harmless; two browsers seeding at once may clash, so it is tried again.
export function seedDemoGym() {
  const { BACKEND, testDatabaseUrl, redact } = local('../../support/testDb.cjs');
  let run;
  for (let i = 0; i < 4; i += 1) {
    run = spawnSync(process.execPath, ['prisma/seed.js'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: testDatabaseUrl() }, encoding: 'utf8' });
    if (run.status === 0 && !/Error/.test(run.stderr)) return;
  }
  throw new Error(`The demo seed failed:
${redact(run.stdout)}
${redact(run.stderr)}`);
}

// The emails the test backend's fake mailer was given for one address
export async function mailTo(address) {
  const res = await fetch(`${OUTBOX_URL}?to=${encodeURIComponent(address)}`);
  return res.json();
}

let n = 0;
let calls = 0;
export function uniqueCode(prefix = 'e') {
  n += 1;
  return `${prefix}${process.pid.toString(36)}${Date.now().toString(36)}${n}`.toLowerCase();
}

export async function call(method, path, { token, body } = {}) {
  // A fresh address for each setup call (see TRUST_PROXY in backend.cjs)
  calls += 1;
  const headers = { 'x-forwarded-for': `10.${process.pid % 250}.${Math.floor(calls / 250) % 250}.${calls % 250}` };
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
    // The app stamps the local day it was signed in on
    const d = new Date();
    const loginDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('gem_auth', JSON.stringify({ token, user, loginDate }));
    localStorage.setItem('gem_last_activity', String(Date.now()));
  }, { token: session.token, user: session.user });
}

// Wait for the web fonts the screens use. document.fonts.ready resolves at once
// while the page has not asked for a font yet, and a font arriving after it
// re-wraps the text: a button can move half its height between the press and
// the release, and the click is lost (seen in Firefox on sign-up).
export function fontsLoaded(page) {
  return page.evaluate(async () => {
    const faces = ['400 14px "DM Sans"', '500 14px "DM Sans"', '600 14px "DM Sans"', '700 14px "DM Sans"', '700 14px Manrope', '800 28px Manrope'];
    await Promise.all(faces.map(face => document.fonts.load(face)));
    await document.fonts.ready;
  });
}
