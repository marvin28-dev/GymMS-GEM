// What `npm start` runs: the database is brought up to date (scripts/migrate.js),
// then the server starts in this same process, so a deploy's stop signal still
// reaches it (F-180). Railway runs `npm start` unless the service has a start
// command of its own, and it reads gem-backend/railway.json (with its
// pre-deploy migration) only when the service is pointed at that file; Railway
// is also retiring the file. The schema must never depend on it being read.
// A database migrate.js does not recognise stops the start, as it stops a deploy.
const path = require('path');
const { spawnSync } = require('child_process');

const run = spawnSync(process.execPath, [path.join(__dirname, 'migrate.js')], { stdio: 'inherit' });
if (run.error) {
  console.error('Migrating failed:', run.error.message);
  process.exit(1);
}
if (run.status !== 0) process.exit(run.status ?? 1);

require('../src/index.js');
