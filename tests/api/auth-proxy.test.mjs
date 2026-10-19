// Behind a proxy, each visitor is counted on their own address. Set before the
// app is loaded, as Railway's environment would be.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym } from './helpers/fixtures.mjs';

let api, stop, gym;

beforeAll(async () => {
  process.env.TRUST_PROXY = '1';
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

const lookup = (address) => api.post('/api/auth/login-status', { gymCode: gym.gymCode, email: gym.email }, { headers: { 'x-forwarded-for': address } });

describe('the sign-in lookup limit', () => {
  it('belongs to each visitor: one using up theirs does not stop the next', async () => {
    for (let i = 0; i < 30; i++) expect((await lookup('203.0.113.7')).status).toBe(200);
    expect((await lookup('203.0.113.7')).status).toBe(429);
    expect((await lookup('198.51.100.23')).status).toBe(200);
  });
});
