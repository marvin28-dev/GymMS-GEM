// Starts the real backend for the browser tests: the gem_test database, the
// same fake email and upload clients as the API tests, and no request to
// anything but this machine. Every variable that could reach a real service is
// set before the app loads, so its own dotenv call cannot pull a real key in.
const Module = require('module');
const path = require('path');
const { BACKEND, testDatabaseUrl, prepareTestDatabase } = require('../../support/testDb.cjs');
const { API_PORT, WEB_ORIGIN } = require('./ports.cjs');

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(API_PORT),
  DATABASE_URL: testDatabaseUrl(),
  JWT_SECRET: 'e2e-only-secret-not-used-anywhere-else',
  FRONTEND_URL: WEB_ORIGIN,
  ALLOWED_ORIGINS: '',
  RESEND_API_KEY: 're_test_not_a_real_key',
  EMAIL_FROM_ADDRESS: '',
  // GEM's admin dashboard (tests only; never a real account)
  ADMIN_EMAIL: 'admin@gem.test',
  ADMIN_PASSWORD: 'Admin-pass-for-tests-1',
  RAILWAY_ENVIRONMENT: '',
  // The helpers set up each test's gym from this one machine; behind a trusted
  // proxy hop each setup call can name its own address, so the real per-address
  // limits on sign-ups and sign-ins stay as they are (the API tests cover them)
  TRUST_PROXY: '1',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
});

prepareTestDatabase();

const appRequire = Module.createRequire(path.join(BACKEND, 'src/app.js'));
function replace(pkg, fakeFile) {
  const resolved = appRequire.resolve(pkg);
  const fake = new Module(resolved);
  fake.filename = resolved;
  fake.loaded = true;
  fake.exports = require(fakeFile);
  Module._cache[resolved] = fake;
}
replace('resend', '../../api/fakes/resend.cjs');
replace('cloudinary', '../../api/fakes/cloudinary.cjs');

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    return Promise.reject(new Error(`Blocked a request to ${url.origin} during the browser tests`));
  }
  return realFetch(input, init);
};

process.env.TZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
require(path.join(BACKEND, 'src/index.js'));

// What the fake mailer was given, for the tests that follow an email (a reset
// link, a welcome): GET /outbox?to=address. Only on this machine's loopback.
const { outbox } = require('../../api/fakes/resend.cjs');
const { OUTBOX_PORT } = require('./ports.cjs');
// POST /backdate?gym=code: the gym signed up 70 days ago and its members joined
// 40 days ago, so last month can be billed (GEM's admin dashboard tests)
const prisma = appRequire('./utils/prisma.js');
async function backdate(code) {
  const gym = await prisma.gym.findUnique({ where: { code }, select: { id: true } });
  if (!gym) return false;
  await prisma.gym.update({ where: { id: gym.id }, data: { createdAt: new Date(Date.now() - 70 * 864e5) } });
  await prisma.member.updateMany({ where: { gymId: gym.id, isVisitor: false }, data: { status: 'active', startDate: new Date(Date.now() - 40 * 864e5) } });
  return true;
}
require('http').createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/backdate' && req.method === 'POST') {
    backdate(String(url.searchParams.get('gym') || '')).then(ok => res.writeHead(ok ? 200 : 404).end(), err => res.writeHead(500).end(err.message));
    return;
  }
  if (url.pathname !== '/outbox') { res.writeHead(404).end(); return; }
  const to = url.searchParams.get('to');
  const list = to ? outbox.filter(m => [].concat(m.to || []).map(String).includes(to)) : outbox;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(list.map(m => ({ to: m.to, from: m.from, replyTo: m.replyTo, subject: m.subject, html: m.html, text: m.text }))));
}).listen(OUTBOX_PORT, '127.0.0.1');
