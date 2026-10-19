// Where the automated tests keep their data. Never the development or the live
// database: TEST_DATABASE_URL when it is given (CI), otherwise the development
// server named in gem-backend/.env with the database swapped for gem_test.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND = path.resolve(__dirname, '../../gem-backend');
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

function readDevUrl() {
  const file = path.join(BACKEND, '.env');
  if (!fs.existsSync(file)) return null;
  const dotenv = require(path.join(BACKEND, 'node_modules/dotenv'));
  return dotenv.parse(fs.readFileSync(file)).DATABASE_URL || null;
}

function testDatabaseUrl() {
  const given = process.env.TEST_DATABASE_URL;
  let url = given;
  if (!url) {
    const dev = readDevUrl();
    if (!dev) throw new Error('Set TEST_DATABASE_URL, or DATABASE_URL in gem-backend/.env, so the tests know which server to use.');
    const u = new URL(dev);
    u.pathname = '/gem_test';
    url = u.toString();
  }
  const u = new URL(url);
  const name = decodeURIComponent(u.pathname.slice(1));
  if (!/_test$/.test(name)) {
    throw new Error(`Refusing to run the tests against the database "${name}": its name must end in _test.`);
  }
  if (!given && !LOCAL_HOSTS.includes(u.hostname)) {
    throw new Error(`Refusing to run the tests against a server on ${u.hostname}: only a local server is used unless TEST_DATABASE_URL names one.`);
  }
  return url;
}

function redact(text) {
  return String(text || '').replace(/postgres(?:ql)?:\/\/\S+/gi, '<database url>');
}

function prisma(args) {
  const url = testDatabaseUrl();
  const cli = path.join(BACKEND, 'node_modules/prisma/build/index.js');
  const run = spawnSync(process.execPath, [cli, ...args], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error(`Prisma could not update the test database:\n${redact(run.stdout)}\n${redact(run.stderr)}`);
  }
  return url;
}

// Brings the test database's tables up to the schema without deleting
// anything. Tests never need an empty database: each test file makes its own
// gym under a new code, so rows left by earlier runs are never read again.
function prepareTestDatabase() {
  return prisma(['db', 'push']);
}

// Empties the test database and rebuilds it. Only for a person to run
// (npm run test:db:reset), when a schema change cannot be applied in place.
function resetTestDatabase() {
  return prisma(['db', 'push', '--force-reset']);
}

module.exports = { BACKEND, testDatabaseUrl, prepareTestDatabase, resetTestDatabase, redact };
