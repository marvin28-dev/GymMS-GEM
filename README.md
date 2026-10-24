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
npx prisma db push        # creates the tables in the database named in .env
npm run db:seed           # optional: the demo gym "elite"
npm run dev               # http://localhost:5000
```

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
address). The backend's `npm start` currently pushes the schema and seeds the
demo gym before starting; read F-001 and D-1 in `AUDIT_PROGRESS.md` before the
next deploy.
