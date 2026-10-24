// F-180: a deploy stops the old server with SIGTERM. Without a handler Node
// quit on the spot, cutting off whatever was under way; the server now stops
// taking connections, ends the live streams (screens reconnect to the new
// server) and lets requests under way finish first.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { once } from 'node:events';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym } from './helpers/fixtures.mjs';

let api, stop, gym;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('stopping the server', () => {
  it('ends the live streams, stops taking connections, and does not wait out its time limit', async () => {
    const server = backend('./app.js').listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const { body: { ticket } } = await api.post('/api/live/ticket', {}, { token: gym.token });
    const stream = await fetch(`${base}/api/live?ticket=${ticket}`);
    expect(stream.status).toBe(200);
    const reader = stream.body.getReader();
    await reader.read(); // "retry: 3000"

    const started = Date.now();
    const closing = backend('./utils/shutdown.js').closeGracefully(server, { timeoutMs: 8000 });
    const ended = await Promise.race([
      (async () => { for (;;) { const { done } = await reader.read(); if (done) return 'ended'; } })().catch(() => 'ended'),
      new Promise(resolve => setTimeout(() => resolve('still open'), 3000)),
    ]);
    expect(ended).toBe('ended');
    await closing;
    expect(Date.now() - started).toBeLessThan(3000);
    await expect(fetch(`${base}/api/health`)).rejects.toThrow();
  });
});
