// D-1, D-4: the schema goes out through migrations, run by scripts/migrate.js
// before each start. The live database was kept by `db push` and has no
// migration history, so the script must recognise the schema it already has,
// keep every row, and stop without touching a database it does not recognise.
// Each case gets its own empty database on the local test server.
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const local = createRequire(import.meta.url);
const { BACKEND, testDatabaseUrl, redact } = local('../support/testDb.cjs');
const { Client } = createRequire(`${BACKEND}/package.json`)('pg');
const CLI = `${BACKEND}/node_modules/prisma/build/index.js`;

const base = new URL(testDatabaseUrl());
const urlOf = (name) => { const u = new URL(base); u.pathname = `/${name}`; return u.toString(); };
const made = [];

async function sql(url, text) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { return (await client.query(text)).rows; } finally { await client.end(); }
}
async function freshDatabase(name) {
  if (!/_test$/.test(name)) throw new Error('test databases end in _test');
  await sql(urlOf('postgres'), `DROP DATABASE IF EXISTS "${name}"`);
  await sql(urlOf('postgres'), `CREATE DATABASE "${name}"`);
  made.push(name);
  return urlOf(name);
}
function run(url, args) {
  const r = spawnSync(process.execPath, args, {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
    encoding: 'utf8',
  });
  return { status: r.status, out: redact(`${r.stdout}\n${r.stderr}`) };
}
const migrate = (url) => run(url, ['scripts/migrate.js']);
const pushSchema = (url, schema) => {
  const r = run(url, [CLI, 'db', 'push', `--schema=${schema}`, `--url=${url}`]);
  if (r.status !== 0) throw new Error(r.out);
};
const sameAsSchema = (url) => run(url, [CLI, 'migrate', 'diff', '--from-config-datasource', '--to-schema=prisma/schema.prisma', '--exit-code']).status === 0;

afterAll(async () => {
  for (const name of made) await sql(urlOf('postgres'), `DROP DATABASE IF EXISTS "${name}"`);
});

describe('migrating the database', () => {
  it('builds an empty database to exactly the schema, and has nothing to do the second time', async () => {
    const url = await freshDatabase('gem_mig_empty_test');
    const first = migrate(url);
    expect(first.status, first.out).toBe(0);
    expect(sameAsSchema(url)).toBe(true);
    const again = migrate(url);
    expect(again.status, again.out).toBe(0);
    expect(again.out).toMatch(/No pending migrations/);

    // The demo is made only by the seed, and never on a live server by accident
    const live = spawnSync(process.execPath, ['prisma/seed.js'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: url, RAILWAY_ENVIRONMENT: 'production' }, encoding: 'utf8' });
    expect(live.status).toBe(1);
    expect(live.stderr).toMatch(/Not seeding/);
    expect(await sql(url, `SELECT count(*)::int AS n FROM "Gym" WHERE code = 'elite'`)).toEqual([{ n: 0 }]);
    const seeded = run(url, ['prisma/seed.js']);
    expect(seeded.status, seeded.out).toBe(0);
    expect(await sql(url, `SELECT count(*)::int AS n FROM "Member" m JOIN "Gym" g ON g.id = m."gymId" WHERE g.code = 'elite' AND m.email NOT LIKE '%@example.com'`)).toEqual([{ n: 0 }]);
  }, 180_000);

  it('takes a database pushed from main\'s schema (the live one today), keeping its rows and old task times', async () => {
    const url = await freshDatabase('gem_mig_main_test');
    pushSchema(url, 'prisma/snapshots/1_main.prisma');
    await sql(url, `INSERT INTO "Gym" (id, code, name, "updatedAt") VALUES ('g1', 'keepme', 'Kept Gym', now())`);
    await sql(url, `INSERT INTO "Task" (id, "gymId", title, "dueTime", "updatedAt") VALUES ('t1', 'g1', 'Old task', '09:30', now())`);
    const r = migrate(url);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/schema of 20261024000000_baseline/);
    expect(sameAsSchema(url)).toBe(true);
    expect(await sql(url, `SELECT name FROM "Gym" WHERE id = 'g1'`)).toEqual([{ name: 'Kept Gym' }]);
    expect(await sql(url, `SELECT "dueTime" FROM "Task" WHERE id = 't1'`)).toEqual([{ dueTime: '09:30' }]);
  }, 180_000);

  it('takes a database pushed from this branch before its indexes', async () => {
    const url = await freshDatabase('gem_mig_audit_test');
    pushSchema(url, 'prisma/snapshots/2_audit.prisma');
    const r = migrate(url);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/schema of 20261024000001_audit/);
    expect(sameAsSchema(url)).toBe(true);
  }, 180_000);

  // `npm run db:deploy` failed on a developer's machine ("client password must
  // be a string"): the script never read .env. It is run here from a folder
  // whose .env names a fresh test database, with DATABASE_URL unset.
  it('reads the database from .env when DATABASE_URL is not set', async () => {
    const url = await freshDatabase('gem_mig_envfile_test');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gem-migrate-'));
    try {
      fs.writeFileSync(path.join(folder, '.env'), `DATABASE_URL="${url}"\n`);
      const withoutUrl = { ...process.env };
      delete withoutUrl.DATABASE_URL;
      const r = spawnSync(process.execPath, [`${BACKEND}/scripts/migrate.js`], {
        cwd: folder,
        env: { ...withoutUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
        encoding: 'utf8',
      });
      const out = redact(`${r.stdout}\n${r.stderr}`);
      expect(r.status, out).toBe(0);
      expect(sameAsSchema(url)).toBe(true);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }, 180_000);

  it('leaves a database it does not recognise exactly as it is, and fails the deploy', async () => {
    const url = await freshDatabase('gem_mig_drift_test');
    pushSchema(url, 'prisma/snapshots/1_main.prisma');
    await sql(url, 'ALTER TABLE "Gym" ADD COLUMN "oddity" TEXT');
    const r = migrate(url);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/does not match any schema/);
    expect(await sql(url, `SELECT to_regclass('public._prisma_migrations') IS NULL AS untouched`)).toEqual([{ untouched: true }]);
    expect((await sql(url, `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'Gym' AND column_name = 'oddity'`))[0].n).toBe(1);
  }, 180_000);
});
