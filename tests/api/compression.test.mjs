// F-177: lists travel compressed (a member list is several times smaller), but
// the live stream never is, since compressing would hold its events back.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember } from './helpers/fixtures.mjs';

let api, stop, gym;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  for (let i = 0; i < 15; i++) await addMember(api, gym.token);
});
afterAll(() => stop());

describe('answers', () => {
  it('a long list comes compressed for a browser that accepts it, and reads the same', async () => {
    const res = await api.get('/api/members', { token: gym.token, headers: { 'accept-encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.body.length).toBeGreaterThanOrEqual(15);
  });

  it('a short answer is sent as it is', async () => {
    const res = await api.get('/api/health', { headers: { 'accept-encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
  });
});

describe('the live stream', () => {
  it('is never compressed, and its first line arrives at once', async () => {
    const { body: { ticket } } = await api.post('/api/live/ticket', {}, { token: gym.token });
    const controller = new AbortController();
    const res = await fetch(`${api.base}/api/live?ticket=${ticket}`, { signal: controller.signal, headers: { 'accept-encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
    const reader = res.body.getReader();
    const first = await Promise.race([
      reader.read().then(({ value }) => new TextDecoder().decode(value)),
      new Promise(resolve => setTimeout(() => resolve('nothing within 2 seconds'), 2000)),
    ]);
    controller.abort();
    expect(first).toContain('retry: 3000');
  });
});
