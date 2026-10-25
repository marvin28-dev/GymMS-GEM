// Brings the database up to the schema before the server starts (Railway runs
// it as the pre-deploy command, see railway.json). Changes go through the
// migrations in prisma/migrations and nothing else.
//
// Until October 2026 the live database was kept in shape by `prisma db push`
// and has no migration history. The first time, this works out which of the
// first three schemas the database already has, marks the migrations up to it
// as applied, and applies the rest. A database that matches none of them is
// left exactly as it is and the deploy stops, so the version already running
// stays up (D-1, D-4).
const path = require('path');
const { spawnSync } = require('child_process');

// `npm run db:deploy` on a developer's machine: DATABASE_URL is in .env there,
// as for the Prisma CLI (prisma.config.ts). Variables already set (Railway's)
// are never replaced.
require('dotenv').config({ quiet: true });

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'node_modules/prisma/build/index.js');

// The first three migrations, each with the schema a database has once it is
// applied. Later migrations are applied by `migrate deploy` in the usual way.
const FIRST = [
  { name: '20261024000000_baseline', schema: 'prisma/snapshots/1_main.prisma' },
  { name: '20261024000001_audit', schema: 'prisma/snapshots/2_audit.prisma' },
  { name: '20261024000002_indexes', schema: 'prisma/snapshots/3_indexes.prisma' },
];

function prisma(args, { quiet = false } = {}) {
  const run = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (run.error) throw run.error;
  return run.status;
}

// 0 when the database has exactly this schema
const matches = (schema) => {
  const status = prisma(['migrate', 'diff', '--from-config-datasource', `--to-schema=${schema}`, '--exit-code'], { quiet: true });
  if (status === 1) throw new Error(`Comparing the database with ${schema} failed`);
  return status === 0;
};

async function state() {
  const db = require('../src/utils/prisma');
  try {
    const [{ history }] = await db.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS history");
    const applied = history
      ? (await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).map(r => r.migration_name)
      : [];
    const [{ tables }] = await db.$queryRawUnsafe("SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'");
    return { applied, tables };
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const { applied, tables } = await state();
  const known = applied.filter(name => FIRST.some(step => step.name === name));

  if (!known.length && tables > 0) {
    // Newest first: a database pushed from the latest schema matches it alone
    const at = [...FIRST].reverse().findIndex(step => matches(step.schema));
    if (at < 0) {
      console.error('The database does not match any schema these migrations know, so nothing was changed.');
      console.error('Compare it with `npx prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma` and bring it in line by hand.');
      process.exit(1);
    }
    const upTo = FIRST.length - 1 - at;
    console.log(`The database has the schema of ${FIRST[upTo].name}: marking it and the ones before it as applied.`);
    for (const step of FIRST.slice(0, upTo + 1)) {
      if (prisma(['migrate', 'resolve', '--applied', step.name]) !== 0) process.exit(1);
    }
  }
  process.exit(prisma(['migrate', 'deploy']));
}

main().catch((err) => {
  console.error('Migrating failed:', err.message);
  process.exit(1);
});
