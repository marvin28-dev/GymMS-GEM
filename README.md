# GEM (GymElite Manager)

Gym management for gyms in Cameroon and across Africa: members and visitors,
payments and receipts, the front desk, staff and time cards, coaching, the
calendar, tasks, the shop, accounting and messages to members. In English and
French, with money in each gym's own currency.

## What is here

| Folder | What |
| :- | :- |
| `gem-frontend` | The web app: React 19 and Vite. Hosted on Vercel. |
| `gem-backend` | The API: Node.js, Express 5, Prisma and PostgreSQL. Hosted on Railway. |
| `tests` | Unit, API and browser tests (see below). |

`CLAUDE.md` describes how the product behaves, rule by rule. `AUDIT_PROGRESS.md`
is the production-readiness audit: what was found, what was fixed, and the
decisions still waiting for the owner.

## Run it on your computer

You need Node.js (it is developed on 24), npm and a PostgreSQL server.

Backend:

```sh
cd gem-backend
cp .env.example .env      # then set DATABASE_URL and JWT_SECRET at least
npm install
npm run db:deploy         # creates the tables from the migrations
npm run db:seed           # optional: the demo gym "elite"
npm run dev               # http://localhost:5000
```

After pulling new code, run `npm run db:deploy` again: the dev server does not
migrate, and a missing column stops sign-in with "The column ... does not exist
in the current database". A database made earlier with `prisma db push` is
recognised the same way as the live one (below); if it is told the database
matches no known schema, compare the two with
`npx prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --script`
and add what is missing by hand.

Web app, in a second terminal:

```sh
cd gem-frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

The server stops at start if `DATABASE_URL` or `JWT_SECRET` is missing, and
warns about settings that only switch a feature off (email, photo uploads,
links in emails). Every setting is listed in `gem-backend/.env.example`.

## Tests

Install the test tools once, from the repository root:

```sh
npm install
npx playwright install chromium firefox
```

| Command | What it runs |
| :- | :- |
| `npm test` | Unit and API tests (Vitest). |
| `npm run test:unit` | Unit tests only. |
| `npm run test:api` | API tests only: the real app against a test database. |
| `npx playwright test` | Browser tests in Chromium and Firefox, on a production build of the web app with the real backend. |

The API and browser tests use their own database: `TEST_DATABASE_URL` if set,
otherwise the server in `gem-backend/.env` with the database name changed to
`gem_test`. They refuse any database whose name does not end in `_test`, and a
server that is not on this computer unless `TEST_DATABASE_URL` names it. Its
tables follow the schema automatically. Email and photo uploads are replaced by
fakes, so no email, text or upload leaves the computer; the browser tests
only fetch the web fonts from Google (the demo videos are blocked).
`npm run test:db:reset`
empties the test database, for when a schema change cannot be applied in place.

Browser test options: `E2E_DEV=1` uses the Vite dev server instead of a build,
`E2E_WORKERS=n` sets how many browsers run at once (3 by default, which an 8 GB
machine can take).

`TESTING_CHECKLIST.md` is the manual check list, for what automated tests
cannot cover (real phones, real email delivery).

Lint: `npm run lint` in `gem-frontend` and in `gem-backend`.

## Deploying

The web app builds with `npm run build` (set `VITE_API_URL` to the API's
address) and is served by Vercel.

The backend runs on Railway. `npm start` (what Railway runs unless the service
has a start command of its own) first runs `node scripts/migrate.js`, which
applies the migrations in `prisma/migrations`, then starts the server
(`scripts/start.js`); a database it does not recognise stops the start.

`gem-backend/railway.json` holds the same settings as code, but Railway reads it
only when the service's config file path is set to `/gem-backend/railway.json`
(it does not follow the root directory), and Railway is retiring config files:
they work until 1 December 2026, and only for services already using one. Set
these in the backend service's settings instead:

- Pre-deploy command `node scripts/migrate.js`: an update that cannot be
  applied then stops the deploy while the running version stays up.
- Healthcheck path `/api/health` (it answers 503 when the database cannot be
  reached), so a server that cannot work is never put in front of users.
- Variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=15`: the old server gets 15
  seconds to finish its requests.

The first time, the live database has no migration history (it was kept by
`prisma db push`). `migrate.js` then finds which known schema it has, marks
those migrations as applied and applies the rest; a database it does not
recognise is left as it is and the deploy stops, so the running version stays
up. Take a backup before that first deploy.

Changing the schema: edit `prisma/schema.prisma`, then
`npx prisma migrate dev --name what-changed` on your own database, and commit
the new folder in `prisma/migrations`. Never `db push` to the live database.

The server's clock is Cameroon's (`Africa/Douala`) unless `TZ` is set. The demo
gym "elite" is made only by `npm run db:seed`, which refuses to run on Railway
unless `SEED_DEMO=yes`; nothing is ever emailed or texted for it.
