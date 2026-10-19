// Every test file builds its own gym, so files never share data and can run
// side by side against one test database.
let n = 0;
export function uniqueCode(prefix = 't') {
  n += 1;
  return `${prefix}${process.pid.toString(36)}${Date.now().toString(36)}${n}`.toLowerCase();
}

export const OWNER_PASSWORD = 'Owner-pass-1';

export async function registerGym(api, overrides = {}) {
  const gymCode = overrides.gymCode || uniqueCode('gym');
  const body = {
    gymCode,
    gymName: `Test Gym ${gymCode}`,
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
  const res = await api.post('/api/auth/register', body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  return { ...res.body, gymCode: res.body.user.gymCode, email: body.email, password: body.password, body };
}

// Waits for something the app does after it has answered (emails, notifications)
export async function eventually(check, { timeout = 3000, every = 50 } = {}) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await check();
    if (last) return last;
    await new Promise(r => setTimeout(r, every));
  }
  return last;
}
