import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';

let api, stop, prisma;

beforeAll(async () => { ({ api, stop, prisma } = await startServer()); });
afterAll(() => stop());

describe('requests the client got wrong', () => {
  it('answers 400, not 500, when a request has no body at all', async () => {
    const res = await api.call('POST', '/api/auth/login');
    expect(res.status).toBe(400);
  });

  it('answers 400 with a plain message when the JSON cannot be read', async () => {
    const res = await api.call('POST', '/api/auth/login', { raw: '{"gymCode": ', headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The request body is not valid JSON.' });
  });

  it('answers 413 when the body is over the limit', async () => {
    const big = JSON.stringify({ notes: 'x'.repeat(6 * 1024 * 1024) });
    const res = await api.call('POST', '/api/auth/login', { raw: big, headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'The request is too large.' });
  });

  it('answers an unknown API path in JSON', async () => {
    const res = await api.get('/api/no-such-thing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

// F-179: the health check answered "ok" whatever the database's state, so a
// deploy that could not reach it looked healthy
describe('the health check', () => {
  it('answers ok when the database answers', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers 503 when the database cannot be reached', async () => {
    const real = prisma.$queryRaw;
    prisma.$queryRaw = () => Promise.reject(new Error('connection refused (test)'));
    try {
      const res = await api.get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'unavailable' });
    } finally {
      prisma.$queryRaw = real;
    }
    expect((await api.get('/api/health')).status).toBe(200);
  });
});

describe('which sites may call the API from a browser', () => {
  const allowOrigin = (res) => res.headers.get('access-control-allow-origin');

  it('allows the live site and a local development server', async () => {
    expect(allowOrigin(await api.get('/api/health', { headers: { origin: 'https://gym-ms-gem.vercel.app' } }))).toBe('https://gym-ms-gem.vercel.app');
    expect(allowOrigin(await api.get('/api/health', { headers: { origin: 'http://localhost:5173' } }))).toBe('http://localhost:5173');
  });

  it('does not allow a site that only has "localhost" somewhere in its name, and does not fail for it', async () => {
    const res = await api.get('/api/health', { headers: { origin: 'https://localhost.attacker.example' } });
    expect(res.status).toBe(200);
    expect(allowOrigin(res)).toBeNull();
  });
});
