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

// Adds an employee as the owner, then claims the account the way a new employee
// does (the 4-digit code read out by the manager, and a password of their own)
export async function addStaff(api, gym, { role = 'front_desk', password = 'Staff-pass-1', ...overrides } = {}) {
  const code = uniqueCode(role.slice(0, 2));
  const body = {
    firstName: 'Sam', lastName: `Staff ${code}`, email: `${code}@example.test`, phone: '677000000',
    role, city: 'Douala', region: 'Littoral', ...overrides,
  };
  const made = await api.post('/api/staff', body, { token: gym.token });
  if (made.status !== 201) throw new Error(`staff create failed: ${made.status} ${made.text}`);
  const { body: { accessCode } } = await api.get(`/api/staff/${made.body.id}/code`, { token: gym.token });
  const session = await api.post('/api/auth/set-password', { gymCode: gym.gymCode, email: body.email, password, code: accessCode });
  if (session.status !== 200) throw new Error(`set-password failed: ${session.status} ${session.text}`);
  return { ...made.body, accessCode, password, token: session.body.token };
}

const ymd = (d) => d.toISOString().slice(0, 10);
export const daysFromNow = (n) => ymd(new Date(Date.now() + n * 864e5));

export async function addMember(api, token, overrides = {}) {
  const code = uniqueCode('m');
  const body = {
    firstName: 'Mia', lastName: `Member ${code}`, city: 'Douala', region: 'Littoral',
    startDate: daysFromNow(-10), endDate: daysFromNow(20), ...overrides,
  };
  const res = await api.post('/api/members', body, { token });
  if (res.status !== 201) throw new Error(`member create failed: ${res.status} ${res.text}`);
  return res.body;
}

export const getMember = async (api, token, id) => (await api.get(`/api/members/${id}`, { token })).body;

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
