// What can be tried, and how often. Each test uses its own gym, since the
// counters are kept per account and per address for the whole server.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox } from './helpers/server.mjs';
import { registerGym, OWNER_PASSWORD } from './helpers/fixtures.mjs';

let api, stop;

beforeAll(async () => { ({ api, stop } = await startServer()); });
afterAll(() => stop());

describe('the manager code check', () => {
  it('stops after 5 wrong codes, even for the right one, and says how long to wait', async () => {
    const gym = await registerGym(api);
    const wrong = gym.accessCode === '1111' ? '2222' : '1111';
    for (let i = 0; i < 5; i++) {
      expect((await api.post('/api/auth/verify-manager', { code: wrong }, { token: gym.token })).body).toEqual({ authorized: false });
    }
    const locked = await api.post('/api/auth/verify-manager', { code: gym.accessCode }, { token: gym.token });
    expect(locked.status).toBe(429);
    expect(locked.body).toMatchObject({ code: 'TOO_MANY_TRIES', retryInMinutes: expect.any(Number) });
    expect(locked.headers.get('retry-after')).toEqual(expect.any(String));
  });

  it('counts wrong passwords the same way', async () => {
    const gym = await registerGym(api);
    for (let i = 0; i < 5; i++) await api.post('/api/auth/verify-manager', { password: 'nope' }, { token: gym.token });
    expect((await api.post('/api/auth/verify-manager', { password: OWNER_PASSWORD }, { token: gym.token })).status).toBe(429);
  });

  it('lets a manager who gets it right carry on', async () => {
    const gym = await registerGym(api);
    const wrong = gym.accessCode === '1111' ? '2222' : '1111';
    for (let i = 0; i < 3; i++) await api.post('/api/auth/verify-manager', { code: wrong }, { token: gym.token });
    expect((await api.post('/api/auth/verify-manager', { code: gym.accessCode }, { token: gym.token })).body).toEqual({ authorized: true });
  });
});

describe('signing in', () => {
  it('stops an account after 10 wrong passwords, even for the right one', async () => {
    const gym = await registerGym(api);
    for (let i = 0; i < 10; i++) {
      expect((await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: `wrong-${i}` })).status).toBe(401);
    }
    const locked = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: OWNER_PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('TOO_MANY_TRIES');
  });
});

describe('password reset emails', () => {
  it('sends at most 5 an hour for one account', async () => {
    const gym = await registerGym(api);
    const before = outbox().filter(m => m.to === gym.email && /Reset/.test(m.subject)).length;
    for (let i = 0; i < 5; i++) {
      expect((await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: gym.email })).status).toBe(200);
    }
    expect((await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: gym.email })).status).toBe(429);
    expect(outbox().filter(m => m.to === gym.email && /Reset/.test(m.subject)).length - before).toBe(5);
  });
});
