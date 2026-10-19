import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox } from './helpers/server.mjs';
import { registerGym, uniqueCode, eventually, OWNER_PASSWORD } from './helpers/fixtures.mjs';

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
    expect((await api.post('/api/auth/reset-password', { token, password: 'Again-3' })).status).toBe(400);

    await api.post('/api/auth/change-password', { currentPassword: 'Brand-new-2', newPassword: OWNER_PASSWORD }, { token: login.body.token });
  });

  it('says when no account uses the email', async () => {
    const res = await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: 'nobody@example.test' });
    expect(res.status).toBe(404);
  });
});
