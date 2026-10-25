import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox } from './helpers/server.mjs';
import { registerGym, uniqueCode, eventually, OWNER_PASSWORD, addStaff } from './helpers/fixtures.mjs';

let api, stop, gym;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('registering a gym', () => {
  it('creates the gym with its owner and signs the owner in', () => {
    expect(gym.token).toEqual(expect.any(String));
    expect(gym.accessCode).toMatch(/^\d{4}$/);
    expect(gym.user).toMatchObject({ role: 'general_manager', gymCode: gym.gymCode, gymCountry: 'Cameroon', gymCurrency: 'XAF' });
  });

  it('stores the gym code in lower case', async () => {
    const code = uniqueCode('Mixed');
    const res = await registerGym(api, { gymCode: code.toUpperCase() });
    expect(res.gymCode).toBe(code.toLowerCase());
  });

  it('refuses a gym code that is taken', async () => {
    const res = await api.post('/api/auth/register', { ...gym.body, email: 'other@example.test' });
    expect(res.status).toBe(409);
  });

  it('refuses a registration with a required field missing', async () => {
    const res = await api.post('/api/auth/register', { gymCode: uniqueCode(), gymName: 'X' });
    expect(res.status).toBe(400);
  });

  it('emails the owner a welcome with the gym code', async () => {
    const mail = await eventually(() => outbox().find(m => m.to === gym.email));
    expect(mail).toBeTruthy();
    expect(mail.subject).toContain('Welcome to GEM');
    expect(mail.html).toContain(gym.gymCode);
  });

  it('reports whether a gym code is free', async () => {
    expect((await api.get(`/api/auth/check-code/${gym.gymCode}`)).body).toEqual({ available: false });
    expect((await api.get(`/api/auth/check-code/${uniqueCode('free')}`)).body).toEqual({ available: true });
    expect((await api.get('/api/auth/check-code/has%20space')).body).toEqual({ available: false });
  });
});

describe('signing in', () => {
  it('signs the owner in with the right password', async () => {
    const res = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: OWNER_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: gym.email, role: 'general_manager', gymCode: gym.gymCode });
  });

  it('matches the email without regard to capitals or spaces', async () => {
    const res = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: `  ${gym.email.toUpperCase()} `, password: OWNER_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('refuses a wrong password and an unknown email the same way', async () => {
    const wrong = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: 'not-it' });
    const unknown = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: 'nobody@example.test', password: 'not-it' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('says when the gym does not exist', async () => {
    const res = await api.post('/api/auth/login', { gymCode: uniqueCode('none'), email: gym.email, password: OWNER_PASSWORD });
    expect(res.status).toBe(404);
  });

  it('asks for the email first and says what kind of account it is', async () => {
    expect((await api.post('/api/auth/login-status', { gymCode: gym.gymCode, email: gym.email })).body).toEqual({ status: 'existing', setPassword: false });
    expect((await api.post('/api/auth/login-status', { gymCode: gym.gymCode, email: 'nobody@example.test' })).body).toEqual({ status: 'unknown', setPassword: false });
  });
});

describe('a signed-in session', () => {
  it('reads back who is signed in, with the gym', async () => {
    const res = await api.get('/api/auth/me', { token: gym.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: gym.email, gymCode: gym.gymCode, gymCurrency: 'XAF' });
  });

  it('refuses a request with no token or a forged one', async () => {
    expect((await api.get('/api/auth/me')).status).toBe(401);
    expect((await api.get('/api/auth/me', { token: 'not.a.token' })).status).toBe(401);
  });

  it('confirms the signed-in manager\'s own 4-digit code', async () => {
    const ok = await api.post('/api/auth/verify-manager', { code: gym.accessCode, purpose: 'test' }, { token: gym.token });
    const wrongCode = String((Number(gym.accessCode) % 9000) + 1000 + (gym.accessCode === '1000' ? 1 : 0));
    const bad = await api.post('/api/auth/verify-manager', { code: wrongCode === gym.accessCode ? '0000' : wrongCode }, { token: gym.token });
    expect(ok.body).toEqual({ authorized: true });
    expect(bad.body).toEqual({ authorized: false });
  });

  it('answers a wrong current password with 400, not 401, so the session survives', async () => {
    const res = await api.post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'whatever1' }, { token: gym.token });
    expect(res.status).toBe(400);
  });
});

describe('resetting a forgotten password', () => {
  it('emails a one-time link that sets a new password', async () => {
    const asked = await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: gym.email });
    expect(asked.status).toBe(200);
    const mail = outbox().filter(m => m.to === gym.email && /Reset your GEM password/.test(m.subject)).at(-1);
    const token = /reset-password\?token=([a-f0-9]{64})/.exec(mail.html)[1];

    expect((await api.get(`/api/auth/verify-reset-token/${token}`)).body).toEqual({ valid: true });
    const reset = await api.post('/api/auth/reset-password', { token, password: 'Brand-new-2' });
    expect(reset.status).toBe(200);

    const login = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: 'Brand-new-2' });
    expect(login.status).toBe(200);
    expect((await api.post('/api/auth/reset-password', { token, password: 'Again-333' })).status).toBe(400);

    await api.post('/api/auth/change-password', { currentPassword: 'Brand-new-2', newPassword: OWNER_PASSWORD }, { token: login.body.token });
  });

  it('says when no account uses the email', async () => {
    const res = await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: 'nobody@example.test' });
    expect(res.status).toBe(404);
  });

  it('sends the link to the address on the account, not the one as typed', async () => {
    const asked = await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode.toUpperCase(), email: `  ${gym.email.toUpperCase()}  ` });
    expect(asked.status).toBe(200);
    const mail = outbox().filter(m => /Reset your GEM password/.test(m.subject)).at(-1);
    expect(mail.to).toBe(gym.email);
  });

  it('keeps only a hash of the token, so the database alone holds no working link', async () => {
    await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: gym.email });
    const mail = outbox().filter(m => m.to === gym.email && /Reset your GEM password/.test(m.subject)).at(-1);
    const token = /reset-password\?token=([a-f0-9]{64})/.exec(mail.html)[1];
    const { prisma } = await import('./helpers/server.mjs').then(m => ({ prisma: m.backend('./utils/prisma.js') }));
    const stored = await prisma.staff.findFirst({ where: { email: gym.email }, select: { resetToken: true } });
    expect(stored.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.resetToken).not.toBe(token);
    expect((await api.get(`/api/auth/verify-reset-token/${stored.resetToken}`)).body.valid).toBe(false);
    expect((await api.get(`/api/auth/verify-reset-token/${token}`)).body.valid).toBe(true);
  });
});

describe('gym codes typed another way', () => {
  it('signs in, looks up and sets up whatever the capitals', async () => {
    const upper = gym.gymCode.toUpperCase();
    expect((await api.post('/api/auth/login', { gymCode: upper, email: gym.email, password: OWNER_PASSWORD })).status).toBe(200);
    expect((await api.post('/api/auth/login-status', { gymCode: ` ${upper} `, email: gym.email })).body.status).toBe('existing');
  });
});

describe('what a new gym must have', () => {
  const body = (over) => ({ ...gym.body, gymCode: uniqueCode('rule'), email: `${uniqueCode('r')}@example.test`, ...over });

  // D-36: the minimum rose from 6 to 8
  it('refuses a password shorter than 8, as every other password box does', async () => {
    for (const password of ['12345', 'Seven-7']) {
      const res = await api.post('/api/auth/register', body({ password }));
      expect(res.status, password).toBe(400);
      expect(res.body.field).toBe('password');
    }
    expect((await api.post('/api/auth/register', body({ password: 'Eight-88' }))).status).toBe(201);
  });

  it('refuses a gym code with spaces or symbols, which would break the sign-in address', async () => {
    for (const gymCode of ['my gym', 'gym/../x', 'café!']) {
      const res = await api.post('/api/auth/register', body({ gymCode }));
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('gymCode');
    }
  });

  it('refuses an email that is not an address', async () => {
    expect((await api.post('/api/auth/register', body({ email: 'not-an-email' }))).body.field).toBe('email');
  });

  it('gives a new gym its country\'s currency when the one named is not a currency code', async () => {
    const res = await api.post('/api/auth/register', body({ currency: 'francs' }));
    expect(res.status).toBe(201);
    expect(res.body.user.gymCurrency).toBe('XAF');
  });
});

// D-3: signing out left the token working on the server for up to 8 hours,
// so a copy of it (another tab, a session taken from the computer) went on
describe('signing out', () => {
  it('ends that token on the server, and only that one', async () => {
    const own = await registerGym(api);
    const signIn = async () => (await api.post('/api/auth/login', { gymCode: own.gymCode, email: own.email, password: OWNER_PASSWORD })).body.token;
    const first = await signIn();
    const second = await signIn();
    expect((await api.get('/api/auth/me', { token: first })).status).toBe(200);

    expect((await api.post('/api/auth/logout', {}, { token: first })).status).toBe(200);
    const after = await api.get('/api/auth/me', { token: first });
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SIGNED_OUT');
    expect((await api.get('/api/members', { token: first })).status).toBe(401);
    expect((await api.get('/api/auth/me', { token: second })).status).toBe(200);
    expect((await api.post('/api/auth/logout', {}, { token: first })).status).toBe(401);
  });

  it('needs a signed-in account', async () => {
    expect((await api.post('/api/auth/logout', {})).status).toBe(401);
  });
});

// D-8: nothing confirmed that a new owner's address, or a changed one, was theirs
describe('confirming an email address', () => {
  const linkIn = (mail) => /verify-email\?token=([a-f0-9]{64})/.exec(mail?.html || '')?.[1];
  const me = async (token) => (await api.get('/api/auth/me', { token })).body;

  it("is asked of a new owner in the welcome email, and the link works once", async () => {
    const own = await registerGym(api);
    expect(own.user.emailUnconfirmed).toBe(true);
    expect((await me(own.token)).emailUnconfirmed).toBe(true);
    const token = linkIn(await eventually(() => outbox().find(m => m.to === own.email && /Welcome to GEM/.test(m.subject))));
    expect(token).toBeTruthy();

    const res = await api.post('/api/auth/verify-email', { token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ confirmed: true, email: own.email });
    expect((await me(own.token)).emailUnconfirmed).toBe(false);
    expect((await me(own.token)).emailVerifyHash).toBeUndefined();
    expect((await api.post('/api/auth/verify-email', { token })).status).toBe(400);
    const again = await api.post('/api/auth/login', { gymCode: own.gymCode, email: own.email, password: OWNER_PASSWORD });
    expect(again.body.user.emailUnconfirmed).toBe(false);
  });

  it('sends a new link on request, and the old one stops working', async () => {
    const own = await registerGym(api);
    const first = linkIn(await eventually(() => outbox().find(m => m.to === own.email && /Welcome to GEM/.test(m.subject))));
    const res = await api.post('/api/auth/resend-confirmation', {}, { token: own.token });
    expect(res.status).toBe(200);
    const second = linkIn(await eventually(() => outbox().filter(m => m.to === own.email && /Confirm your email/.test(m.subject)).at(-1)));
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect((await api.post('/api/auth/verify-email', { token: first })).status).toBe(400);
    expect((await api.post('/api/auth/verify-email', { token: second })).status).toBe(200);
    expect((await api.post('/api/auth/resend-confirmation', {})).status).toBe(401);
  });

  it('is asked again of a new address, at that address', async () => {
    const own = await registerGym(api);
    const desk = await addStaff(api, own);
    expect((await me(desk.token)).emailUnconfirmed).toBe(false);
    const address = `moved.${uniqueCode('m')}@example.test`;
    expect((await api.patch(`/api/staff/${desk.id}`, { email: address }, { token: own.token })).status).toBe(200);
    const token = linkIn(await eventually(() => outbox().find(m => m.to === address && /Confirm your email/.test(m.subject))));
    expect(token).toBeTruthy();
    expect((await me(desk.token)).emailUnconfirmed).toBe(true);
    expect((await api.post('/api/auth/verify-email', { token })).status).toBe(200);
    expect((await me(desk.token)).emailUnconfirmed).toBe(false);

    // The same address written in capitals is not a new one
    const before = outbox().length;
    await api.patch(`/api/staff/${desk.id}`, { email: address.toUpperCase() }, { token: own.token });
    expect((await me(desk.token)).emailUnconfirmed).toBe(false);
    expect(outbox().slice(before).some(m => /Confirm your email/.test(m.subject))).toBe(false);
  });

  it('refuses a link that is not one', async () => {
    for (const token of [undefined, '', 'abc', 'f'.repeat(64)]) {
      expect((await api.post('/api/auth/verify-email', { token })).status).toBe(400);
    }
  });
});
