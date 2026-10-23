// Phase 3. F-005: the API's answers carry security headers. F-019: nothing is
// served from a local uploads folder. F-006: the live stream is opened with a
// one-use ticket, never with the sign-in token in the URL.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

const { BACKEND } = createRequire(import.meta.url)('../support/testDb.cjs');
let api, stop;
beforeAll(async () => { ({ api, stop } = await startServer()); });
afterAll(() => stop());

// Opens the stream and reads only its headers, then hangs up
async function openStream(query) {
  const controller = new AbortController();
  const res = await fetch(`${api.base}/api/live?${query}`, { signal: controller.signal });
  const out = { status: res.status, type: res.headers.get('content-type') || '' };
  controller.abort();
  return out;
}

describe('security headers', () => {
  it('every answer forbids framing, sniffing and loading anything', async () => {
    const res = await api.get('/api/health');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('a refusal carries them too', async () => {
    const res = await api.get('/api/members');
    expect(res.status).toBe(401);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('asks browsers for HTTPS only when the request came over HTTPS', async () => {
    const res = await api.get('/api/health');
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('no local uploads folder', () => {
  it('a file put in uploads/ is not served', async () => {
    // express.static('uploads') read the folder of the directory the server
    // runs from: gem-backend in production, here wherever the tests run
    const dirs = [path.join(BACKEND, 'uploads'), path.resolve('uploads')];
    const made = dirs.filter(d => !fs.existsSync(d));
    const name = `probe-${process.pid}.txt`;
    for (const d of dirs) { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), 'should not be public'); }
    try {
      const res = await api.get(`/uploads/${name}`);
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('should not be public');
    } finally {
      for (const d of dirs) fs.rmSync(path.join(d, name), { force: true });
      for (const d of made) fs.rmSync(d, { recursive: true, force: true });
    }
  });
});

describe('live stream tickets', () => {
  it('the sign-in token in the URL no longer opens the stream', async () => {
    const gym = await registerGym(api);
    expect((await openStream(`token=${encodeURIComponent(gym.token)}`)).status).toBe(401);
  });

  it('a ticket needs a signed-in request', async () => {
    expect((await api.post('/api/live/ticket', {})).status).toBe(401);
  });

  it('a ticket opens one stream, once', async () => {
    const gym = await registerGym(api);
    const res = await api.post('/api/live/ticket', {}, { token: gym.token });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const first = await openStream(`ticket=${res.body.ticket}`);
    expect(first.status).toBe(200);
    expect(first.type).toContain('text/event-stream');
    expect((await openStream(`ticket=${res.body.ticket}`)).status).toBe(401);
  });

  it('an unknown ticket is refused', async () => {
    expect((await openStream(`ticket=${'0'.repeat(64)}`)).status).toBe(401);
  });

  it('a ticket stops working once its account is switched off', async () => {
    const gym = await registerGym(api);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const { body } = await api.post('/api/live/ticket', {}, { token: desk.token });
    await api.patch(`/api/staff/${desk.id}`, { isActive: false }, { token: gym.token });
    expect((await openStream(`ticket=${body.ticket}`)).status).toBe(401);
  });

  it('an "Other" account, kept to its own corner of the API, still gets live updates', async () => {
    const gym = await registerGym(api);
    const cleaner = await addStaff(api, gym, { role: 'other' });
    const res = await api.post('/api/live/ticket', {}, { token: cleaner.token });
    expect(res.status).toBe(200);
    expect((await openStream(`ticket=${res.body.ticket}`)).status).toBe(200);
  });
});
