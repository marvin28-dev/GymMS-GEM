// Runs before every API test file, in that file's own process, before the app
// is loaded. Every variable that could reach a real service is set here, so the
// app's own dotenv call (which never overwrites a variable already set) cannot
// pull a real key in from gem-backend/.env.
import Module, { createRequire } from 'node:module';

const local = createRequire(import.meta.url);
const { BACKEND, testDatabaseUrl } = local('../../support/testDb.cjs');

Object.assign(process.env, {
  NODE_ENV: 'test',
  TZ: process.env.TZ || 'UTC',
  DATABASE_URL: testDatabaseUrl(),
  JWT_SECRET: 'test-only-secret-not-used-anywhere-else',
  FRONTEND_URL: 'http://localhost:5175',
  ALLOWED_ORIGINS: '',
  RESEND_API_KEY: 're_test_not_a_real_key',
  EMAIL_FROM_ADDRESS: '',
  SMS_PROVIDER: '',
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_FROM: '',
  TWILIO_MESSAGING_SERVICE_SID: '',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
});

// The app's own require() would load the real clients. Placing the fakes in
// Node's module cache under the real packages' paths makes every require of
// them, in every file of the app, get the fake instead.
const appRequire = createRequire(`${BACKEND}/src/app.js`);
function replace(pkg, fakeFile) {
  const resolved = appRequire.resolve(pkg);
  const fake = new Module(resolved);
  fake.filename = resolved;
  fake.loaded = true;
  fake.exports = local(fakeFile);
  Module._cache[resolved] = fake;
}
replace('resend', '../fakes/resend.cjs');
replace('cloudinary', '../fakes/cloudinary.cjs');

// Nothing in the tests may reach the internet. Requests to the local test
// server go through; anything else fails loudly.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    return Promise.reject(new Error(`Blocked a request to ${url.origin} during tests`));
  }
  return realFetch(input, init);
};
