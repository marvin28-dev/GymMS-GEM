// F-011: an upload goes only to a folder the app files pictures in, must be an
// image by its own bytes (the declared type comes from the client), and is
// limited per account. Uses the fake Cloudinary, so nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym } from './helpers/fixtures.mjs';

let api, stop, gym;
beforeAll(async () => { ({ api, stop } = await startServer()); gym = await registerGym(api); });
afterAll(() => stop());
beforeEach(() => backend('cloudinary').reset());

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

async function send(bytes, { folder = 'gem/members', type = 'image/png', name = 'photo.png', token = gym.token } = {}) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${api.base}/api/upload?folder=${encodeURIComponent(folder)}`, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('uploads', () => {
  it('stores a picture in one of the app\'s folders', async () => {
    for (const folder of ['gem', 'gem/members', 'gem/staff', 'gem/staff/ids', 'gem/logos']) {
      const res = await send(PNG, { folder });
      expect(res.status, folder).toBe(200);
      expect(res.body.url).toContain(folder);
    }
    expect((await send(JPEG, { type: 'image/jpeg', name: 'p.jpg' })).status).toBe(200);
  });

  it('refuses any other folder, and stores nothing', async () => {
    for (const folder of ['other-site', 'gem/../evil', 'gem/members/../../x', '']) {
      const res = await send(PNG, { folder: folder || ' ' });
      expect(res.status, folder).toBe(400);
    }
    expect(backend('cloudinary').uploads).toHaveLength(0);
  });

  it('refuses a file that is not a picture, whatever it claims to be', async () => {
    const res = await send(Buffer.from('<html><script>alert(1)</script></html>'), { type: 'image/png', name: 'x.png' });
    expect(res.status).toBe(415);
    expect(backend('cloudinary').uploads).toHaveLength(0);
  });

  it('needs a signed-in account', async () => {
    expect((await send(PNG, { token: null })).status).toBe(401);
  });

  it('answers a file over the limit with 413, not 500', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(21 * 1024 * 1024)]);
    expect((await send(big)).status).toBe(413);
  });

  it('limits how many uploads one account makes in a short time', async () => {
    const other = await registerGym(api);
    const statuses = [];
    for (let i = 0; i < 61; i += 1) statuses.push((await send(PNG, { token: other.token })).status);
    expect(statuses.slice(0, 60).every(s => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
