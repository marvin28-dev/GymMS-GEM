// Starts the real Express app on a free port for one test file and talks to it
// over HTTP, the way the browser does.
import { createRequire } from 'node:module';
import { once } from 'node:events';

const local = createRequire(import.meta.url);
const { BACKEND } = local('../../support/testDb.cjs');
export const backend = createRequire(`${BACKEND}/src/app.js`);

export async function startServer() {
  const app = backend('./app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { token, body, headers = {}, raw } = {}) {
    const init = { method, headers: { ...headers } };
    if (token) init.headers.authorization = `Bearer ${token}`;
    if (raw !== undefined) {
      init.body = raw;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    return { status: res.status, body: json, text, headers: res.headers };
  }

  const api = {
    base,
    call,
    get: (path, opts) => call('GET', path, opts),
    post: (path, body, opts = {}) => call('POST', path, { ...opts, body }),
    patch: (path, body, opts = {}) => call('PATCH', path, { ...opts, body }),
    put: (path, body, opts = {}) => call('PUT', path, { ...opts, body }),
    del: (path, opts) => call('DELETE', path, opts),
  };

  async function stop() {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    await backend('./utils/prisma.js').$disconnect();
  }

  return { api, stop, prisma: backend('./utils/prisma.js') };
}

export const outbox = () => backend('resend').outbox;
export const resetFakes = () => { backend('resend').reset(); backend('cloudinary').reset(); };
