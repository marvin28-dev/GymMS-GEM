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
  SMS_PROVIDER: '',
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_FROM: '',
  TWILIO_MESSAGING_SERVICE_SID: '',
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

require(path.join(BACKEND, 'src/index.js'));
