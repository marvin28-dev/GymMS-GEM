# GEM production-readiness audit: progress

This file is the source of truth for the audit. A new session starts by reading it top to bottom.

- **Branch:** `production-audit` (made from `main` at `69cefa8`). Nothing is pushed; `main` is never touched.
- **Current phase:** Phase 1 (baseline) done; Phase 2 (line-by-line review) next.
- **Started:** 2026-10-19. The owner replied "go" without answering the four Phase 0 questions, so the proposed defaults were used: a local `gem_test` database for tests, the baseline commit (D-9), tool downloads allowed, and the Railway details treated as unknown until the owner answers (see "Open questions").

### Open questions for the owner

1. Railway: the backend's Start Command, whether the live database holds the demo gym "elite", and which of `FRONTEND_URL`, `ALLOWED_ORIGINS`, `EMAIL_FROM_ADDRESS` are set (names only).

## Session log

| Date | Phase | What happened |
| :- | :- | :- |
| 2026-10-19 | 0 | Discovery. Branch created. Inventory, integration points, journeys and first findings written. Stopped for "go". |
| 2026-10-19 | 1 | "go" received. Baseline commit `e789a22` (earlier uncommitted work, minus `Documents/login.txt`). Commit `f194d32`: login notes untracked, every `.env.*` ignored. Baseline results recorded (section 5). The owner had added root tooling at 15:21 (Playwright 1.64.1 with browsers, knip 6.42.0, Vitest 5.0.5, TypeScript 7.0.2); it is now part of the inventory. |

### Commits on this branch

| Commit | What |
| :- | :- |
| `e789a22` | Baseline: work in progress before the audit (258 files). |
| `f194d32` | security: stop tracking sign-in notes; ignore every .env variant. |

## 1. Stack

| Part | What |
| :- | :- |
| Frontend | React 19 (`react@^19.2.0`), Vite 7, React Router 7, axios, lucide-react, recharts, jspdf. Inline styles with CSS tokens in `src/index.css`. Also installed: MUI 7 + Emotion, Tailwind 4, react-big-calendar, date-fns, @fontsource/inter (use to be checked in Phase 2). Plain JavaScript (`.js`/`.jsx`), no TypeScript. |
| Backend | Node.js (v24.14.0 here), Express 5, CommonJS, Prisma 7.8 with `@prisma/adapter-pg`, PostgreSQL. bcryptjs, jsonwebtoken, multer, cloudinary, pdfkit, resend. Plain JavaScript, no TypeScript. |
| Database | PostgreSQL (local `gem_db` on localhost:5432 for development). 23 models, 8 enums in `gem-backend/prisma/schema.prisma`. |
| Package manager | npm 11.9.0, one `package-lock.json` per app (no workspace at the root). |
| Hosting | Frontend on Vercel (`gem-frontend/vercel.json`: SPA rewrite only). Backend + Postgres on Railway (no Railway config in the repo, so Railway runs `npm start`; to be confirmed by the owner). |
| Tests | None in the repo. Lint only on the frontend (ESLint 9 flat config). No type-check (no TypeScript). Ad-hoc browser scripts from earlier sessions live outside the repo (Claude scratchpad) and are not part of the project. |

### Commands

Backend (`cd gem-backend`):

| Task | Command | Note |
| :- | :- | :- |
| Install | `npm install` | |
| Prisma client | `npx prisma generate` (`npm run build` does the same) | Stop the running server first on Windows (the engine DLL is locked). |
| Schema to local DB | `npx prisma db push` | Migrations folder is stale (see F-008), so `db push` is what keeps the schema current. |
| Seed demo data | `npm run db:seed` | Development only. |
| Run (dev) | `npm run dev` | nodemon, port 5000, needs `gem-backend/.env`. |
| Run (prod, as configured) | `npm start` | Runs `prisma db push`, then the seed, then the server (see F-001). |
| Lint | none | To add in Phase 2. |
| Type-check | none | JavaScript only. |
| Tests | none | To add in Phase 4. |

Frontend (`cd gem-frontend`):

| Task | Command | Note |
| :- | :- | :- |
| Install | `npm install` | |
| Run (dev) | `npm run dev` | Vite, port 5173, `VITE_API_URL` from `gem-frontend/.env` (falls back to `http://localhost:5000/api`). |
| Build | `npm run build` | Output in `gem-frontend/dist`. |
| Preview build | `npm run preview` | |
| Lint | `npm run lint` | ESLint 9. |
| Type-check | none | JavaScript only. |
| Tests | none | To add in Phase 4. |

### Environment variables (names only, never values)

| App | Set locally | Read by the code | Gap |
| :- | :- | :- | :- |
| Backend | DATABASE_URL, JWT_SECRET, PORT, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN | the same plus ALLOWED_ORIGINS, FRONTEND_URL, EMAIL_FROM_ADDRESS, SMS_PROVIDER, TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID | No `.env.example`; nothing checks required variables at startup (F-009). |
| Frontend | VITE_API_URL | VITE_API_URL | No `.env.example`. Only `VITE_API_URL` reaches the browser bundle (it is not a secret). |

Both `.env` files are ignored by git (root and per-app `.gitignore`), and no `.env` file is tracked.

## 2. Integration points

| # | Integration | Where | Notes for testing |
| :- | :- | :- | :- |
| I-1 | Frontend to API | `gem-frontend/src/services/*.service.js` through one axios client `services/api.js` (base URL `VITE_API_URL`, `Authorization: Bearer`, `X-Client-Id`). 26 route groups under `/api` in `gem-backend/src/app.js`. Errors come back as `{ error, field?, code? }`. | Contract checks per route group: fields sent, fields read, error shape, 401/403 handling (`signOut` on `ACCOUNT_DEACTIVATED`/`ACCOUNT_GONE`). |
| I-2 | API to database | Prisma 7 + `@prisma/adapter-pg` (`src/utils/prisma.js`). 4 raw SQL calls (`$executeRawUnsafe`/`$queryRaw`). Multi-step writes: approvals (serializable transaction), sales (stock taken with `updateMany ... gte`), notifications clear-all, calendar invites. | Injection check on raw SQL; transactions; constraints and indexes; migrations from scratch (F-008). |
| I-3 | Authentication | `auth.controller.js` + `middleware/auth.middleware.js`: JWT (HS256, 8 h, in `localStorage` key `gem_auth`), bcryptjs (cost 10), email-first login (`login-status`), first password with the 4-digit code, forgot / reset tokens, manager password and 4-digit code checks, account re-read on every request (5 s cache), client-side daily re-login and 15-minute inactivity logout. | Brute force, enumeration, token expiry, reuse, deactivated accounts, cross-gym tokens. |
| I-4 | Live updates | Server-Sent Events `GET /api/live?token=` (`routes/live.routes.js`, `utils/liveHub.js`), browser side `utils/live.js`, `hooks/useLiveRefresh.js`. Every successful write under `/api` is announced to the gym. | Token in the URL (F-006), reconnect, multi-tab, cross-gym isolation. |
| I-5 | Email (Resend) | `utils/sendEmail.js` (`deliver`, `deliverEach`), `memberEmail.js` (welcome, receipt with PDF, check-in code, membership change, coach intro), `welcomeEmail.js`, `taskEmail.js`, `staff.controller` (reset link), `auth.controller` (forgot password, new gym welcome), `jobs/payrollReminders.js`, `utils/messaging.js` (Communication page batches). Layout `utils/emailLayout.js`, PDF `utils/receiptPdf.js`. Sender `onboarding@resend.dev` unless `EMAIL_FROM_ADDRESS` is set. | Mock Resend in automated tests. Live tests only to Resend's test addresses (`delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`). Escaping in every template, failure handling, rate limits on every endpoint that sends. |
| I-6 | Text messages (SMS) | `utils/sms.js` (`SMS_PROVIDER` = `twilio` or `log`), used by `utils/messaging.js`. Paused by the owner (no provider budget): locally `SMS_PROVIDER` is unset. The check-in code "Text it" opens the device's own SMS app (`sms:` link). | Mocked Twilio only. No live SMS test possible here. |
| I-7 | File storage | `POST /api/upload` (multer memory, 20 MB) to Cloudinary (`utils/cloudinary.js`). Some photos and logos are stored as base64 data URIs in the database (JSON body limit 5 MB). Legacy `app.use('/uploads', express.static('uploads'))` serves an empty local folder. | Type, size and folder checks; Cloudinary down; base64 size. |
| I-8 | Payments | No payment gateway. Payments, sales and expenses are records of money taken by hand (cash, card, bank transfer, mobile money). Receipts are emailed and printable. | Business rules only (balances, receipts, refunds). Anything changing payment behaviour goes to "Needs my decision". |
| I-9 | Third parties in the browser | Google Fonts (`index.html`), `wa.me` WhatsApp links, `tel:` and `sms:` links. | CSP must allow Google Fonts if a CSP is added. |
| I-10 | Background jobs (in-process `setInterval`) | `jobs/payrollReminders.js` (6 h, also runs `autoPayroll`), `jobs/taskReminders.js` (15 min), `jobs/logRetention.js` (12 h), `jobs/freezeFees.js` (6 h), `jobs/scheduledMessages.js` (30 s), started in `src/index.js`. | Behaviour with two server instances, restarts, failures (a job must never crash the server). |
| I-11 | Webhooks | None (no Resend or Twilio delivery webhooks). | Nothing to test; note as a gap for delivery tracking. |
| I-12 | Hosting | Vercel SPA rewrite (no headers configured). Railway runs the backend (`npm start`). CORS allows `https://gym-ms-gem.vercel.app`, `ALLOWED_ORIGINS`, and anything containing "localhost" (F-004). Health check `GET /api/health`. | Security headers, CORS, health check, env validation. |

## 3. User journeys

Public and account:

- J-01 Landing page (`/`).
- J-02 Sign up a new gym (`/signup`): welcome, gym details with live gym-code check, owner account, success screen with gym code and 4-digit code.
- J-03 Demo login (`/elite/login`): role picker that signs in to the seeded demo gym.
- J-04 Find your gym (`/login`, gym code page).
- J-05 Sign in (`/:gymCode/login`): email first, then password (existing), create password with the 4-digit code (new), or "no account" (unknown); deactivated account.
- J-06 Forgot password (`/forgot-password`) and reset by email link (`/reset-password`); reset link sent by a manager.
- J-07 Email verification: does not exist (no sign-up or email-change verification). Logged as a gap.
- J-08 Daily re-login, expired token, 15-minute inactivity warning and logout; manual logout.

Core features (by role: general manager, manager, front desk, trainer/coach, other):

- J-10 Dashboard (management) and coach dashboard (coaches).
- J-11 Members: list, tabs and filters, needs attention, add member (registration fee taken first), add visitor (bundle or day pass taken first), edit details, delete or deactivate, bulk actions.
- J-12 Member profile: hero, check-in (photo rule, code entry), payments (add, receipt, refund), renew (balance first), freeze / unfreeze / extend / cancel / convert (approval engine and manager code at the desk), day pass, visitor bundle, check-in code (send by email or text), photo upload and removal, coach row, progress (sessions, measurements, notes, goals), messages, notes.
- J-13 Attendance page: check-in by code, name, phone or ID; staff clock-in; lists by day.
- J-14 Front desk kiosk (`/front-desk`): check-in keypad, sign up, product sale with daily sales panel, operations (quick expense for review, report issue, EOD report with check-out prompt), notifications bell, embedded member profile, shift check-in prompt, exit with the manager password.
- J-15 Calendar: gym and my calendar, month / week / day, add event (training, personal, class), invites accept / decline, busy warning, repeats.
- J-16 Tasks: create with the department-first picker, status rules (management only), calendar invite tasks.
- J-17 Sales and products: products (code, cost, offer, restock, retire), quick sale, sales by day, profit.
- J-18 Payments page: record a payment, filters, receipts.
- J-19 Accounting and reports: overview, expenses (review queue, edit and delete with the owner code), revenue, marketing, payroll.
- J-20 Packages: create, edit with the manager code, visitor bundles, day pass price.
- J-21 Communication: compose (email / text / both, audiences, see who and leave people out, fill-ins with preview), schedule, drafts, history, details, retry failed, delete.
- J-22 Staff: list (active / deactivated), add (welcome email), edit, deactivate / reactivate with the code, staff profile (details, schedule, pay and earnings, payroll, time cards, tasks, calendar, notes, photo ID, clients tab for coaches), reveal and renew the 4-digit code, send a reset link.
- J-23 Time cards: clock in / out, review, approve / reject, adjustments, end of day.
- J-24 Operations page: equipment issues, expenses, activity.
- J-25 Notifications: header dropdown, page, desk bell, clear all (own list only), deep links by role.
- J-26 Settings: gym profile (opening hours, country moves currency), payment settings, membership settings, notification preferences, activity log, theme and language.
- J-27 Global search, language switch (EN / FR), theme switch (dark / light), phone layout with the bottom bar and drawer.
- J-28 Log out (and a deactivated account being signed out on its next request).

## 4. File inventory

Every file in the repository except `node_modules`, build output (`dist`), lockfiles, the `.claude` tool folders and this file. 296 files, about 59,000 lines. Tick "Pass 1" in Phase 2 and "Pass 2" in Phase 8. The 17 files deleted on this branch (old pages and `DemoTour.jsx`) are not listed.

### Repository root (11 files, 1,530 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `.github/workflows/playwright.yml` | 27 | [x] | [ ] |
| `.gitignore` | 43 | [x] | [ ] |
| `CLAUDE.md` | 282 | [x] | [ ] |
| `Documents/future.txt` | 6 | [x] | [ ] |
| `Documents/todolist.txt` | 7 | [x] | [ ] |
| `Plan.txt` | 0 | [x] | [ ] |
| `TESTING_CHECKLIST.md` | 1047 | [x] | [ ] |
| `knip.json` | 6 | [x] | [ ] |
| `package.json` | 12 | [x] | [ ] |
| `playwright.config.js` | 81 | [x] | [ ] |
| `tests/e2e/example.spec.js` | 19 | [x] | [ ] |

### Backend: configuration and scripts (4 files, 81 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/.gitignore` | 5 | [x] | [ ] |
| `gem-backend/delete-all.js` | 25 | [x] | [ ] |
| `gem-backend/package.json` | 37 | [x] | [ ] |
| `gem-backend/prisma.config.ts` | 14 | [x] | [ ] |

### Backend: database (Prisma) (17 files, 1,285 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/prisma/migrations/20260427222958_gem/migration.sql` | 375 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260430153942_add_staff_emergency_contact/migration.sql` | 3 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000001_add_payment_reference_balance/migration.sql` | 2 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000002_add_member_address_emergency/migration.sql` | 7 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000003_add_attendance_staff/migration.sql` | 12 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000004_add_staff_schedule/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000005_add_calendar_staff_ids/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000006_add_calendar_description_repeat/migration.sql` | 2 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000007_add_calendar_series_id/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260508000008_add_calendar_repeat_until/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260512000001_add_task_due_time/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260514000001_add_expense_recorded_by/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260514000002_add_staff_salary/migration.sql` | 1 | [x] | [ ] |
| `gem-backend/prisma/migrations/20260515000001_add_member_how_heard_notes/migration.sql` | 2 | [x] | [ ] |
| `gem-backend/prisma/migrations/migration_lock.toml` | 3 | [x] | [ ] |
| `gem-backend/prisma/schema.prisma` | 743 | [x] | [ ] |
| `gem-backend/prisma/seed.js` | 129 | [x] | [ ] |

### Backend: app entry (2 files, 100 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/app.js` | 84 | [x] | [ ] |
| `gem-backend/src/index.js` | 16 | [x] | [ ] |

### Backend: middleware (2 files, 119 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/middleware/access.js` | 35 | [x] | [ ] |
| `gem-backend/src/middleware/auth.middleware.js` | 84 | [x] | [ ] |

### Backend: routes (24 files, 358 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/routes/activityLog.routes.js` | 9 | [x] | [ ] |
| `gem-backend/src/routes/approval.routes.js` | 17 | [x] | [ ] |
| `gem-backend/src/routes/attendance.routes.js` | 12 | [x] | [ ] |
| `gem-backend/src/routes/auth.routes.js` | 17 | [x] | [ ] |
| `gem-backend/src/routes/calendar.routes.js` | 15 | [x] | [ ] |
| `gem-backend/src/routes/coach.routes.js` | 20 | [x] | [ ] |
| `gem-backend/src/routes/communication.routes.js` | 18 | [x] | [ ] |
| `gem-backend/src/routes/equipment.routes.js` | 11 | [x] | [ ] |
| `gem-backend/src/routes/expense.routes.js` | 16 | [x] | [ ] |
| `gem-backend/src/routes/gym.routes.js` | 12 | [x] | [ ] |
| `gem-backend/src/routes/live.routes.js` | 34 | [x] | [ ] |
| `gem-backend/src/routes/member.routes.js` | 14 | [x] | [ ] |
| `gem-backend/src/routes/notification.routes.js` | 13 | [x] | [ ] |
| `gem-backend/src/routes/package.routes.js` | 14 | [x] | [ ] |
| `gem-backend/src/routes/payAdjustment.routes.js` | 13 | [x] | [ ] |
| `gem-backend/src/routes/payment.routes.js` | 12 | [x] | [ ] |
| `gem-backend/src/routes/payroll.routes.js` | 13 | [x] | [ ] |
| `gem-backend/src/routes/product.routes.js` | 13 | [x] | [ ] |
| `gem-backend/src/routes/report.routes.js` | 9 | [x] | [ ] |
| `gem-backend/src/routes/sale.routes.js` | 10 | [x] | [ ] |
| `gem-backend/src/routes/staff.routes.js` | 22 | [x] | [ ] |
| `gem-backend/src/routes/task.routes.js` | 11 | [x] | [ ] |
| `gem-backend/src/routes/timecard.routes.js` | 19 | [x] | [ ] |
| `gem-backend/src/routes/upload.routes.js` | 14 | [x] | [ ] |

### Backend: controllers (23 files, 6,338 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/controllers/activityLog.controller.js` | 45 | [x] | [ ] |
| `gem-backend/src/controllers/approval.controller.js` | 254 | [x] | [ ] |
| `gem-backend/src/controllers/attendance.controller.js` | 391 | [x] | [ ] |
| `gem-backend/src/controllers/auth.controller.js` | 508 | [x] | [ ] |
| `gem-backend/src/controllers/calendar.controller.js` | 398 | [x] | [ ] |
| `gem-backend/src/controllers/coach.controller.js` | 400 | [ ] | [ ] |
| `gem-backend/src/controllers/communication.controller.js` | 208 | [ ] | [ ] |
| `gem-backend/src/controllers/equipment.controller.js` | 77 | [ ] | [ ] |
| `gem-backend/src/controllers/expense.controller.js` | 200 | [ ] | [ ] |
| `gem-backend/src/controllers/gym.controller.js` | 131 | [ ] | [ ] |
| `gem-backend/src/controllers/member.controller.js` | 472 | [ ] | [ ] |
| `gem-backend/src/controllers/notification.controller.js` | 60 | [ ] | [ ] |
| `gem-backend/src/controllers/package.controller.js` | 87 | [ ] | [ ] |
| `gem-backend/src/controllers/payAdjustment.controller.js` | 251 | [ ] | [ ] |
| `gem-backend/src/controllers/payment.controller.js` | 208 | [ ] | [ ] |
| `gem-backend/src/controllers/payroll.controller.js` | 275 | [ ] | [ ] |
| `gem-backend/src/controllers/product.controller.js` | 144 | [ ] | [ ] |
| `gem-backend/src/controllers/report.controller.js` | 200 | [ ] | [ ] |
| `gem-backend/src/controllers/sale.controller.js` | 151 | [ ] | [ ] |
| `gem-backend/src/controllers/staff.controller.js` | 745 | [ ] | [ ] |
| `gem-backend/src/controllers/task.controller.js` | 370 | [ ] | [ ] |
| `gem-backend/src/controllers/timecard.controller.js` | 737 | [ ] | [ ] |
| `gem-backend/src/controllers/upload.controller.js` | 26 | [x] | [ ] |

### Backend: utilities (23 files, 1,641 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/utils/activityLog.js` | 73 | [ ] | [ ] |
| `gem-backend/src/utils/assignees.js` | 21 | [ ] | [ ] |
| `gem-backend/src/utils/cloudinary.js` | 9 | [x] | [ ] |
| `gem-backend/src/utils/dates.js` | 17 | [ ] | [ ] |
| `gem-backend/src/utils/emailGuard.js` | 43 | [ ] | [ ] |
| `gem-backend/src/utils/emailLayout.js` | 203 | [ ] | [ ] |
| `gem-backend/src/utils/gymSetup.js` | 54 | [ ] | [ ] |
| `gem-backend/src/utils/hierarchy.js` | 138 | [ ] | [ ] |
| `gem-backend/src/utils/liveHub.js` | 39 | [ ] | [ ] |
| `gem-backend/src/utils/memberEmail.js` | 195 | [ ] | [ ] |
| `gem-backend/src/utils/membership.js` | 29 | [ ] | [ ] |
| `gem-backend/src/utils/messaging.js` | 183 | [ ] | [ ] |
| `gem-backend/src/utils/money.js` | 40 | [ ] | [ ] |
| `gem-backend/src/utils/notificationScope.js` | 45 | [ ] | [ ] |
| `gem-backend/src/utils/paymentMethod.js` | 13 | [ ] | [ ] |
| `gem-backend/src/utils/phone.js` | 38 | [ ] | [ ] |
| `gem-backend/src/utils/prisma.js` | 7 | [x] | [ ] |
| `gem-backend/src/utils/receiptPdf.js` | 135 | [ ] | [ ] |
| `gem-backend/src/utils/scheduleAlert.js` | 106 | [ ] | [ ] |
| `gem-backend/src/utils/sendEmail.js` | 31 | [x] | [ ] |
| `gem-backend/src/utils/sms.js` | 71 | [ ] | [ ] |
| `gem-backend/src/utils/taskEmail.js` | 94 | [ ] | [ ] |
| `gem-backend/src/utils/welcomeEmail.js` | 57 | [ ] | [ ] |

### Backend: background jobs (6 files, 502 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/jobs/autoPayroll.js` | 115 | [ ] | [ ] |
| `gem-backend/src/jobs/freezeFees.js` | 53 | [ ] | [ ] |
| `gem-backend/src/jobs/logRetention.js` | 24 | [ ] | [ ] |
| `gem-backend/src/jobs/payrollReminders.js` | 188 | [ ] | [ ] |
| `gem-backend/src/jobs/scheduledMessages.js` | 34 | [ ] | [ ] |
| `gem-backend/src/jobs/taskReminders.js` | 88 | [ ] | [ ] |

### Frontend: configuration and public files (10 files, 159 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/.gitignore` | 24 | [ ] | [ ] |
| `gem-frontend/README.md` | 16 | [ ] | [ ] |
| `gem-frontend/eslint.config.js` | 29 | [ ] | [ ] |
| `gem-frontend/index.html` | 16 | [ ] | [ ] |
| `gem-frontend/package.json` | 44 | [ ] | [ ] |
| `gem-frontend/postcss.config.js` | 6 | [ ] | [ ] |
| `gem-frontend/public/vite.svg` | 0 | [ ] | [ ] |
| `gem-frontend/tailwind.config.js` | 11 | [ ] | [ ] |
| `gem-frontend/vercel.json` | 5 | [ ] | [ ] |
| `gem-frontend/vite.config.js` | 8 | [ ] | [ ] |

### Frontend: entry, app shell and styles (14 files, 1,388 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/App.css` | 42 | [ ] | [ ] |
| `gem-frontend/src/App.jsx` | 300 | [ ] | [ ] |
| `gem-frontend/src/app/App.jsx` | 5 | [ ] | [ ] |
| `gem-frontend/src/assets/react.svg` | 0 | [ ] | [ ] |
| `gem-frontend/src/contexts/LanguageContext.jsx` | 61 | [ ] | [ ] |
| `gem-frontend/src/index.css` | 164 | [ ] | [ ] |
| `gem-frontend/src/layouts/AppLayout.jsx` | 77 | [ ] | [ ] |
| `gem-frontend/src/main.jsx` | 43 | [ ] | [ ] |
| `gem-frontend/src/routes/AppRoutes.jsx` | 65 | [ ] | [ ] |
| `gem-frontend/src/routes/ProtectedRoute.jsx` | 28 | [ ] | [ ] |
| `gem-frontend/src/routes/routeConfig.jsx` | 42 | [ ] | [ ] |
| `gem-frontend/src/styles/calendar.css` | 78 | [ ] | [ ] |
| `gem-frontend/src/styles/globals.css` | 316 | [ ] | [ ] |
| `gem-frontend/src/styles/theme.js` | 167 | [ ] | [ ] |

### Frontend: services (API calls) (24 files, 528 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/services/api.js` | 80 | [ ] | [ ] |
| `gem-frontend/src/services/approvals.service.js` | 10 | [ ] | [ ] |
| `gem-frontend/src/services/attendance.service.js` | 14 | [ ] | [ ] |
| `gem-frontend/src/services/auth.service.js` | 39 | [ ] | [ ] |
| `gem-frontend/src/services/calendar.service.js` | 17 | [ ] | [ ] |
| `gem-frontend/src/services/coach.service.js` | 13 | [ ] | [ ] |
| `gem-frontend/src/services/communications.service.js` | 33 | [ ] | [ ] |
| `gem-frontend/src/services/equipment.service.js` | 10 | [ ] | [ ] |
| `gem-frontend/src/services/expenses.service.js` | 20 | [ ] | [ ] |
| `gem-frontend/src/services/gym.service.js` | 16 | [ ] | [ ] |
| `gem-frontend/src/services/logs.service.js` | 4 | [ ] | [ ] |
| `gem-frontend/src/services/members.service.js` | 19 | [ ] | [ ] |
| `gem-frontend/src/services/notifications.service.js` | 16 | [ ] | [ ] |
| `gem-frontend/src/services/packages.service.js` | 13 | [ ] | [ ] |
| `gem-frontend/src/services/payAdjustments.service.js` | 12 | [ ] | [ ] |
| `gem-frontend/src/services/payments.service.js` | 30 | [ ] | [ ] |
| `gem-frontend/src/services/payroll.service.js` | 11 | [ ] | [ ] |
| `gem-frontend/src/services/products.service.js` | 17 | [ ] | [ ] |
| `gem-frontend/src/services/reports.service.js` | 6 | [ ] | [ ] |
| `gem-frontend/src/services/sales.service.js` | 11 | [ ] | [ ] |
| `gem-frontend/src/services/staff.service.js` | 37 | [ ] | [ ] |
| `gem-frontend/src/services/tasks.service.js` | 13 | [ ] | [ ] |
| `gem-frontend/src/services/timecards.service.js` | 37 | [ ] | [ ] |
| `gem-frontend/src/services/upload.service.js` | 50 | [ ] | [ ] |

### Frontend: hooks (4 files, 180 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/hooks/useGymSettings.js` | 70 | [ ] | [ ] |
| `gem-frontend/src/hooks/useIsMobile.js` | 16 | [ ] | [ ] |
| `gem-frontend/src/hooks/useLiveRefresh.js` | 33 | [ ] | [ ] |
| `gem-frontend/src/hooks/useSetupStatus.js` | 61 | [ ] | [ ] |

### Frontend: utilities (32 files, 1,578 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/utils/address.js` | 33 | [ ] | [ ] |
| `gem-frontend/src/utils/attention.js` | 79 | [ ] | [ ] |
| `gem-frontend/src/utils/auth.js` | 227 | [ ] | [ ] |
| `gem-frontend/src/utils/checkin.js` | 69 | [ ] | [ ] |
| `gem-frontend/src/utils/coaching.js` | 146 | [ ] | [ ] |
| `gem-frontend/src/utils/contact.js` | 26 | [ ] | [ ] |
| `gem-frontend/src/utils/countries.js` | 51 | [ ] | [ ] |
| `gem-frontend/src/utils/currency.js` | 48 | [ ] | [ ] |
| `gem-frontend/src/utils/date.js` | 62 | [ ] | [ ] |
| `gem-frontend/src/utils/departments.js` | 55 | [ ] | [ ] |
| `gem-frontend/src/utils/events.js` | 20 | [ ] | [ ] |
| `gem-frontend/src/utils/formErrors.js` | 24 | [ ] | [ ] |
| `gem-frontend/src/utils/gymAddress.js` | 16 | [ ] | [ ] |
| `gem-frontend/src/utils/gymCache.js` | 38 | [ ] | [ ] |
| `gem-frontend/src/utils/hierarchy.js` | 56 | [ ] | [ ] |
| `gem-frontend/src/utils/live.js` | 58 | [ ] | [ ] |
| `gem-frontend/src/utils/loadAll.js` | 9 | [ ] | [ ] |
| `gem-frontend/src/utils/number.js` | 5 | [ ] | [ ] |
| `gem-frontend/src/utils/numberGuard.js` | 43 | [ ] | [ ] |
| `gem-frontend/src/utils/packages.js` | 10 | [ ] | [ ] |
| `gem-frontend/src/utils/paymentDescription.js` | 21 | [ ] | [ ] |
| `gem-frontend/src/utils/paymentMethods.js` | 36 | [ ] | [ ] |
| `gem-frontend/src/utils/paystubPdf.js` | 177 | [ ] | [ ] |
| `gem-frontend/src/utils/productCode.js` | 12 | [ ] | [ ] |
| `gem-frontend/src/utils/productPrice.js` | 29 | [ ] | [ ] |
| `gem-frontend/src/utils/receipt.js` | 78 | [ ] | [ ] |
| `gem-frontend/src/utils/revenue.js` | 23 | [ ] | [ ] |
| `gem-frontend/src/utils/rolePages.js` | 42 | [ ] | [ ] |
| `gem-frontend/src/utils/sessionPhoto.js` | 25 | [ ] | [ ] |
| `gem-frontend/src/utils/smsCount.js` | 24 | [ ] | [ ] |
| `gem-frontend/src/utils/taskCategories.js` | 25 | [ ] | [ ] |
| `gem-frontend/src/utils/useIsMobile.js` | 11 | [ ] | [ ] |

### Frontend: translations (1 files, 4,229 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/i18n/translations.js` | 4229 | [ ] | [ ] |

### Frontend: data (mock and constants) (6 files, 463 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/data/mockCommunications.js` | 42 | [ ] | [ ] |
| `gem-frontend/src/data/mockData.js` | 211 | [ ] | [ ] |
| `gem-frontend/src/data/mockGym.js` | 72 | [ ] | [ ] |
| `gem-frontend/src/data/mockMembers.js` | 93 | [ ] | [ ] |
| `gem-frontend/src/data/mockPackages.js` | 30 | [ ] | [ ] |
| `gem-frontend/src/data/mockProducts.js` | 15 | [ ] | [ ] |

### Frontend: shared UI components (26 files, 1,627 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/components/ui/Avatar.jsx` | 36 | [ ] | [ ] |
| `gem-frontend/src/components/ui/CodeInput.jsx` | 35 | [ ] | [ ] |
| `gem-frontend/src/components/ui/ConfirmModal.jsx` | 77 | [ ] | [ ] |
| `gem-frontend/src/components/ui/DayStepper.jsx` | 39 | [ ] | [ ] |
| `gem-frontend/src/components/ui/EmptyState.jsx` | 45 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemButton.jsx` | 5 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemCard.jsx` | 11 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemDialog.jsx` | 45 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemInput.jsx` | 75 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemSelect.jsx` | 107 | [ ] | [ ] |
| `gem-frontend/src/components/ui/GemTextField.jsx` | 40 | [ ] | [ ] |
| `gem-frontend/src/components/ui/ManagerAuthModal.jsx` | 241 | [ ] | [ ] |
| `gem-frontend/src/components/ui/MemberStatusTags.jsx` | 29 | [ ] | [ ] |
| `gem-frontend/src/components/ui/Modal.jsx` | 114 | [ ] | [ ] |
| `gem-frontend/src/components/ui/PageHeader.jsx` | 45 | [ ] | [ ] |
| `gem-frontend/src/components/ui/PriceTag.jsx` | 15 | [ ] | [ ] |
| `gem-frontend/src/components/ui/RevenueSplit.jsx` | 15 | [ ] | [ ] |
| `gem-frontend/src/components/ui/RowMenu.jsx` | 119 | [ ] | [ ] |
| `gem-frontend/src/components/ui/Sparkline.jsx` | 21 | [ ] | [ ] |
| `gem-frontend/src/components/ui/StatusBadge.jsx` | 63 | [ ] | [ ] |
| `gem-frontend/src/components/ui/TimeInput.jsx` | 175 | [ ] | [ ] |
| `gem-frontend/src/components/ui/TrackPill.jsx` | 43 | [ ] | [ ] |
| `gem-frontend/src/components/ui/TrendChart.jsx` | 94 | [ ] | [ ] |
| `gem-frontend/src/components/ui/VisitKindBadge.jsx` | 19 | [ ] | [ ] |
| `gem-frontend/src/components/ui/VisitorCodeModal.jsx` | 83 | [ ] | [ ] |
| `gem-frontend/src/components/ui/WeekBars.jsx` | 36 | [ ] | [ ] |

### Frontend: components (42 files, 8,086 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/components/AddressInputs.jsx` | 48 | [ ] | [ ] |
| `gem-frontend/src/components/BottomSheet.jsx` | 94 | [ ] | [ ] |
| `gem-frontend/src/components/BottomTabBar.jsx` | 161 | [ ] | [ ] |
| `gem-frontend/src/components/BusyWarning.jsx` | 44 | [ ] | [ ] |
| `gem-frontend/src/components/CheckinStats.jsx` | 328 | [ ] | [ ] |
| `gem-frontend/src/components/CoachClientsPanel.jsx` | 124 | [ ] | [ ] |
| `gem-frontend/src/components/CollectPaymentStep.jsx` | 108 | [ ] | [ ] |
| `gem-frontend/src/components/EodReport.jsx` | 383 | [ ] | [ ] |
| `gem-frontend/src/components/FAB.jsx` | 37 | [ ] | [ ] |
| `gem-frontend/src/components/FillInPreview.jsx` | 28 | [ ] | [ ] |
| `gem-frontend/src/components/FrontDeskTour.jsx` | 228 | [ ] | [ ] |
| `gem-frontend/src/components/GlobalSearch.jsx` | 299 | [ ] | [ ] |
| `gem-frontend/src/components/GoalsModal.jsx` | 160 | [ ] | [ ] |
| `gem-frontend/src/components/Header.jsx` | 462 | [ ] | [ ] |
| `gem-frontend/src/components/LangToggle.jsx` | 110 | [ ] | [ ] |
| `gem-frontend/src/components/LogProgressModal.jsx` | 204 | [ ] | [ ] |
| `gem-frontend/src/components/MemberCoachRow.jsx` | 121 | [ ] | [ ] |
| `gem-frontend/src/components/MemberProgressTab.jsx` | 480 | [ ] | [ ] |
| `gem-frontend/src/components/NavDrawer.jsx` | 249 | [ ] | [ ] |
| `gem-frontend/src/components/NextDayHint.jsx` | 44 | [ ] | [ ] |
| `gem-frontend/src/components/NotificationBell.jsx` | 153 | [ ] | [ ] |
| `gem-frontend/src/components/OpenShiftsWarning.jsx` | 57 | [ ] | [ ] |
| `gem-frontend/src/components/ScrollToTop.jsx` | 12 | [ ] | [ ] |
| `gem-frontend/src/components/SendMessageModal.jsx` | 160 | [ ] | [ ] |
| `gem-frontend/src/components/Sidebar.jsx` | 401 | [ ] | [ ] |
| `gem-frontend/src/components/Skeleton.jsx` | 54 | [ ] | [ ] |
| `gem-frontend/src/components/TaskAssigneeField.jsx` | 64 | [ ] | [ ] |
| `gem-frontend/src/components/dashboard/GymCalendar.jsx` | 674 | [ ] | [ ] |
| `gem-frontend/src/components/dashboard/KpiCard.jsx` | 121 | [ ] | [ ] |
| `gem-frontend/src/components/dashboard/NotificationsPanel.jsx` | 39 | [ ] | [ ] |
| `gem-frontend/src/components/dashboard/TasksTable.jsx` | 583 | [ ] | [ ] |
| `gem-frontend/src/components/members/AddMemberVisitorPage.jsx` | 593 | [ ] | [ ] |
| `gem-frontend/src/components/members/AddPackageDialog.jsx` | 149 | [ ] | [ ] |
| `gem-frontend/src/components/members/CommunicationsTable.jsx` | 138 | [ ] | [ ] |
| `gem-frontend/src/components/members/CreateCommunicationPanel.jsx` | 295 | [ ] | [ ] |
| `gem-frontend/src/components/members/MembersTable.jsx` | 109 | [ ] | [ ] |
| `gem-frontend/src/components/members/PackagesTable.jsx` | 149 | [ ] | [ ] |
| `gem-frontend/src/components/navigation/NavItem.jsx` | 51 | [ ] | [ ] |
| `gem-frontend/src/components/navigation/Sidebar.jsx` | 63 | [ ] | [ ] |
| `gem-frontend/src/components/navigation/Topbar.jsx` | 23 | [ ] | [ ] |
| `gem-frontend/src/components/products/AddCategoryDialog.jsx` | 121 | [ ] | [ ] |
| `gem-frontend/src/components/products/AddProductDialog.jsx` | 365 | [ ] | [ ] |

### Frontend: pages (25 files, 28,970 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/pages/AccountingPage.jsx` | 2199 | [ ] | [ ] |
| `gem-frontend/src/pages/AttendancePage.jsx` | 1397 | [ ] | [ ] |
| `gem-frontend/src/pages/CalendarPage.jsx` | 798 | [ ] | [ ] |
| `gem-frontend/src/pages/CoachDashboard.jsx` | 376 | [ ] | [ ] |
| `gem-frontend/src/pages/CommunicationPage.jsx` | 710 | [ ] | [ ] |
| `gem-frontend/src/pages/DashboardPage.jsx` | 1624 | [ ] | [ ] |
| `gem-frontend/src/pages/ForgotPasswordPage.jsx` | 184 | [ ] | [ ] |
| `gem-frontend/src/pages/FrontDeskPage.jsx` | 2409 | [ ] | [ ] |
| `gem-frontend/src/pages/GymCodePage.jsx` | 327 | [ ] | [ ] |
| `gem-frontend/src/pages/GymLoginPage.jsx` | 712 | [ ] | [ ] |
| `gem-frontend/src/pages/LandingPage.jsx` | 379 | [ ] | [ ] |
| `gem-frontend/src/pages/LogsPage.jsx` | 299 | [ ] | [ ] |
| `gem-frontend/src/pages/MemberProfilePage.jsx` | 3767 | [ ] | [ ] |
| `gem-frontend/src/pages/MembersPage.jsx` | 2532 | [ ] | [ ] |
| `gem-frontend/src/pages/NotificationsPage.jsx` | 305 | [ ] | [ ] |
| `gem-frontend/src/pages/OperationsPage.jsx` | 704 | [ ] | [ ] |
| `gem-frontend/src/pages/PackagesPage.jsx` | 696 | [ ] | [ ] |
| `gem-frontend/src/pages/PaymentsPage.jsx` | 763 | [ ] | [ ] |
| `gem-frontend/src/pages/ResetPasswordPage.jsx` | 245 | [ ] | [ ] |
| `gem-frontend/src/pages/SalesPage.jsx` | 901 | [ ] | [ ] |
| `gem-frontend/src/pages/SettingsPage.jsx` | 1389 | [ ] | [ ] |
| `gem-frontend/src/pages/SignUpPage.jsx` | 1026 | [ ] | [ ] |
| `gem-frontend/src/pages/StaffPage.jsx` | 908 | [ ] | [ ] |
| `gem-frontend/src/pages/StaffProfilePage.jsx` | 3612 | [ ] | [ ] |
| `gem-frontend/src/pages/TasksPage.jsx` | 708 | [ ] | [ ] |

## 5. Baseline (Phase 1, before any change)

Recorded on 2026-10-19 at commit `f194d32`, before any application code was changed.

| Check | Command | Result |
| :- | :- | :- |
| Dependencies | `npm ls --depth=0` in `gem-frontend`, `gem-backend`, root | All installed and matching the lockfiles (exit 0). The backend has 3 extraneous packages not in `package.json`: `pdf-to-img`, `pdfjs-dist`, `@napi-rs/canvas` (F-026). Not reinstalled, because the dev servers were running. |
| Frontend build | `cd gem-frontend && npx vite build` | Pass, 9 s, 2,809 modules. Main chunk `index-*.js` 2,639 kB (705.7 kB gzip), above the 500 kB warning; no code splitting (F-024). Browserslist data 7 months old. |
| Frontend lint | `cd gem-frontend && npx eslint .` | Fail: 198 errors, 34 warnings, 48 of 173 files. By rule: `no-unused-vars` 81, `react-hooks/static-components` 36, `react-hooks/set-state-in-effect` 32, `no-empty` 30, `react-hooks/exhaustive-deps` 27 (warnings), `react-refresh/only-export-components` 8, unused `eslint-disable` directives 7 (warnings), `no-dupe-keys` 4, `react-hooks/refs` 2, `react-hooks/preserve-manual-memoization` 2, `react-hooks/immutability` 1, `no-useless-escape` 1, `no-irregular-whitespace` 1 (F-025). |
| Backend lint | none configured | N/A. |
| Type-check | none configured | N/A (JavaScript only). TypeScript 7.0.2 is installed at the root, but there is no `tsconfig`/`jsconfig`. |
| Backend schema | `cd gem-backend && npx prisma validate` | Valid. |
| Backend load and syntax | `node -e "require('./src/app')"`, `node --check` on every tracked `.js` | Loads in 581 ms; no syntax errors. `GET /api/health` answers `{"status":"ok"}`. |
| npm audit, frontend | `cd gem-frontend && npm audit` | 24: 0 critical, 17 high, 5 moderate, 2 low. All fixable with `npm audit fix` (no major upgrades), including `react-router` / `react-router-dom`, `axios`, `vite`, `postcss`, `rollup`, `lodash`, `form-data`, `minimatch`, `nanoid` (F-023). |
| npm audit, backend | `cd gem-backend && npm audit` | 17: 1 critical (`proxy-addr`, IP spoofing through Express), 11 high (including `multer` DoS on the upload endpoint, `prisma` / `@prisma/config` transitive, `fast-uri`, `hono`, `mysql2` inside Prisma's dev tools), 4 moderate, 1 low. All fixable with `npm audit fix` except `nodemon` (dev only), where npm suggests a major change (F-023, D-11). |
| npm audit, root tooling | `npm audit` at the root | 0. |
| Existing tests | `npx playwright test` at the root | 6 passed in 19.3 s (Chromium, Firefox, WebKit). These are Playwright's sample tests against playwright.dev, not GEM tests. |
| Behaviour baseline (outside the repo) | session script `smoke.js` (62 GEM screens, Edge and Firefox) | 62/62 screens clean. Kept as a reference only; the real suite is added in Phase 4. |

## 6. Findings log

Severity: Critical, High, Medium, Low. Status: Open, Fixed, Needs decision, Won't fix, Verified. Discovery findings are first impressions from Phase 0 and are confirmed or corrected during Phase 2 and Phase 3.

| ID | Severity | Area | File:line | Issue | Proposed fix | Status |
| :- | :- | :- | :- | :- | :- | :- |
| F-001 | Critical | Deployment, security | `gem-backend/package.json:7` | `npm start` runs `prisma db push && node prisma/seed.js` before the server. On Railway (no other start command in the repo) every deploy pushes the schema straight to the production database and seeds the demo gym "elite" with the general manager password `admin123` and the manager code `9721`. | Start with `node src/index.js` only; apply schema changes deliberately (migrations, see F-008); seed only in development. Deployment config, so the owner decides. | Needs decision |
| F-002 | High | Security, privacy | `gem-frontend/src/pages/GymLoginPage.jsx:24-26`, `gem-backend/prisma/seed.js` | The demo accounts' passwords are written into the frontend bundle, so anyone can sign in to the demo gym as its general manager. The seeded members have real-looking Gmail addresses (`armand.k@gmail.com` and others) and the staff use `@elite.cm`. On a live server, using the demo can send real receipts, check-in codes and broadcasts to whoever owns those addresses. | Keep the demo on a separate demo deployment, or make demo data use `@example.com` addresses and block email and SMS for the demo gym. Feature and data change, so the owner decides. | Needs decision |
| F-003 | High | Security | `gem-backend/src/controllers/auth.controller.js` (login, register, forgot-password, set-first-password) and other endpoints that send email or are expensive | Rate limiting exists only on the email lookup and the 4-digit code checks. Password login, sign-up, forgot password (sends email), first-password setup, message sending and uploads have none. | Add per-IP and per-account limits (with `trust proxy` for Railway) and tests. | Open |
| F-004 | Medium | Security | `gem-backend/src/app.js:41` | CORS accepts any origin that contains "localhost", for example `https://localhost.attacker.example`. Impact is limited because sign-in uses a bearer token, not cookies. | Allow exact local origins in development only, plus the configured production origins. | Open |
| F-005 | Medium | Security | `gem-backend/src/app.js`, `gem-frontend/vercel.json` | No security headers: no CSP, HSTS, X-Content-Type-Options, frame-ancestors or Referrer-Policy, on the API or on the Vercel site. | Add headers to the API (for example `helmet`). Headers for the Vercel site are deployment config, so that part goes to the owner. | Open |
| F-006 | Medium | Security | `gem-backend/src/routes/live.routes.js:8`, `gem-frontend/src/utils/live.js` | The live-updates stream sends the sign-in token in the URL (`/api/live?token=...`), where it can end up in proxy and server logs. | Exchange the token for a short-lived, single-purpose stream ticket. | Open |
| F-007 | Medium | Security | `gem-frontend/src/utils/auth.js` | The token is kept in `localStorage` (readable by any script that runs on the page) and is not revoked on the server at logout; it stays valid until it expires (8 h). | Server-side revocation (token version on the staff record) and a strict CSP; moving to httpOnly cookies is a larger design change. | Needs decision |
| F-008 | High | Database | `gem-backend/prisma/migrations/` | The last migration is from May 2026; the schema has changed many times since through `db push`. The migrations cannot rebuild the current database from scratch, and one adds `Task.dueTime`, which the schema no longer has (D-18). | Create a baseline migration from the current schema and use `prisma migrate deploy` in production. Schema and deployment, so the owner decides. | Needs decision |
| F-009 | Medium | Configuration | `gem-backend/src/index.js`, no `.env.example` | Required variables (`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `FRONTEND_URL`) are not checked at startup. A missing `FRONTEND_URL` makes every email link point to `http://localhost:5173`. There is no `.env.example` for either app. | Validate at startup with clear messages; add `.env.example` files with names and safe placeholders only. | Open |
| F-010 | High | Data safety | `gem-backend/delete-all.js` | A script that deletes every record of every gym, with no confirmation and no check of which database `DATABASE_URL` points to. It also misses newer tables: pay adjustments still point at staff, so it stops partway on that foreign key and leaves a half-deleted database (approval requests would simply remain). | Delete it, or guard it (refuse unless the database is local and a confirmation flag is given). Removing a file, so the owner decides. | Needs decision |
| F-011 | Medium | Uploads | `gem-backend/src/controllers/upload.controller.js:6` | The Cloudinary folder comes straight from the query string, the file type is not checked on the server (only Cloudinary's image handling), and there is no rate limit. | Allow-list the folders, check the MIME type and size, limit the rate. | Open |
| F-012 | Low | Accessibility | `gem-frontend/index.html:6` | `maximum-scale=1.0` stops people zooming in on phones. | Remove it. User-visible, so the owner decides. | Needs decision |
| F-013 | Low | Public pages | `gem-frontend/index.html` | No meta description or social sharing tags; the favicon is the default Vite logo; the title contains a long dash. | Add meta tags (no behaviour change); favicon and title wording go to the owner. | Open |
| F-014 | Low | Usability | `gem-frontend/src/main.jsx:17`, `gem-frontend/src/routes/AppRoutes.jsx:59` | If a screen crashes, the user sees the raw technical error. Unknown addresses silently send people to the home page; there is no "page not found". | A friendly error screen with a reload button, and a 404 page. User-visible, so the owner decides. | Needs decision |
| F-015 | Low | Documentation | `CLAUDE.md` | Says React 18 (it is 19), describes `DemoTour.jsx` (deleted), and says "no CSS framework" while Tailwind and MUI are installed. No root README; `gem-frontend/README.md` is the Vite template. | Correct the docs; write a README in Phase 7. | Open |
| F-016 | Medium | Dependencies, dead code | `gem-frontend/package.json`, `src/components/members/*`, `src/components/dashboard/GymCalendar.jsx`, `src/components/products/*`, `src/data/mock*.js`, `src/app/App.jsx` | MUI, Emotion, Tailwind and react-big-calendar look used only by leftover components, and several files look unused. To be proven with knip and by hand before anything is removed. | Remove what is proven unused, in small commits. | Open |
| F-017 | Medium | Quality | whole repo | No automated tests at all, no backend lint, no type-check. | Add Vitest (unit and API integration with a test database) and Playwright (end to end, Chromium, Firefox, WebKit, mobile, axe). | Open |
| F-018 | Low | Secrets | Twilio account | The Twilio Auth Token was pasted into a chat on 2026-10-19 (it is now only in the ignored `gem-backend/.env`). | Regenerate the token in the Twilio Console before using it. Owner action. | Needs decision |
| F-019 | Low | Leftover | `gem-backend/src/app.js:50` | `app.use('/uploads', express.static('uploads'))` serves an empty local folder; uploads go to Cloudinary. | Remove once confirmed unused. | Open |
| F-020 | Info | Security | git history (41 commits) | Not scanned for secrets yet. | Scan with gitleaks in Phase 3. | Open |
| F-021 | Info | Product gap | auth | There is no email verification for a new gym owner or for a changed email address. | Product decision. | Needs decision |
| F-022 | High | Secrets | `Documents/login.txt` (git history, commit `2c4881c`) | A file with a sign-in (email, gym code, password) was tracked from the first commit. | Untracked and ignored in `f194d32`. It is still in the history: change that password (owner), and decide whether to rewrite history (needs a force-push, which this audit never does). | Fixed (file); history needs decision |
| F-023 | High | Dependencies | `gem-frontend/package-lock.json`, `gem-backend/package-lock.json` | 24 frontend and 17 backend known vulnerabilities (see baseline), including a critical one in `proxy-addr` and a high one in `multer`. | `npm audit fix` in both apps (patch and minor only) in Phase 3, then build and full tests. `nodemon`'s suggested fix is a major change (D-11). | Open |
| F-024 | Medium | Performance | `gem-frontend/src/routes/routeConfig.jsx` | The whole app is one 2.6 MB JavaScript file (706 kB gzip); every page loads every other page's code. | Lazy-load pages by route (`React.lazy`), Phase 7. | Open |
| F-025 | Medium | Quality | 48 frontend files | Lint fails with 198 errors (baseline). Some are real bugs: 4 objects with a duplicated key (one value silently wins), 30 empty `catch` blocks that swallow errors, 36 components defined inside other components (remounted on every render, which can drop typed input). | Fix by hand during Phase 2, file by file, without disabling rules. | Open |
| F-026 | Low | Dependencies | `gem-backend/node_modules` | Three extraneous packages (`pdf-to-img`, `pdfjs-dist`, `@napi-rs/canvas`) are installed but not declared. | `npm prune` (local only, no repo change). | Open |
| F-027 | Low | Portability | repository | Files mix LF and CRLF line endings (git warns on every commit); there is no `.gitattributes`. | Add `.gitattributes` (`* text=auto`), Phase 5. | Open |
| F-028 | Medium | CI | `.github/workflows/playwright.yml` | The workflow the owner added runs `npm ci` and the sample tests on pushes to `main`. GEM's real end-to-end tests will need a PostgreSQL service, both apps installed and started, and secrets kept out. | Rewrite the workflow once the suite exists. CI is infrastructure, so the owner decides. | Needs decision |
| F-029 | High | Security | `gem-backend/src/controllers/auth.controller.js:226`, `app.js` | The sign-in lookup limit (30 per 10 min) is keyed by `req.ip`, and Express is not told it sits behind Railway's proxy, so every visitor shares one bucket: 30 lookups lock the sign-in lookup for every gym. | Read the client address through the proxy (`trust proxy`, D-14) and key limits by address plus gym. | Open |
| F-030 | High | Security | `auth.controller.js:354-395` | `POST /api/auth/verify-manager` has no attempt limit: anyone at a signed-in screen can try all 10,000 four-digit codes (or guess the password, which also unlocks exiting the kiosk). | Count wrong tries per account and lock for 15 minutes after 5, like first sign-in. | Open |
| F-031 | Medium | Bug | `app.js`, most controllers | Express 5 leaves `req.body` undefined when a request has no JSON body, so handlers that read `req.body.x` throw and answer 500 instead of 400. | Default `req.body` to `{}` once in `app.js`. | Open |
| F-032 | Low | Bug | `app.js:79-82` | The error handler answers 500 and logs a stack trace for client mistakes too: malformed JSON (should be 400), a body over 5 MB (413), and a refused CORS origin. | Keep the client error's own status with a plain message. | Open |
| F-033 | Low | Bug | `auth.controller.js:128,232,274` | Sign-in, the email lookup and first-password setup look the gym code up with exact case; registration stores it in lower case and the public lookup ignores case. | Match the code without regard to case everywhere. | Open |
| F-034 | Low | Bug | `auth.controller.js:429` | The reset email goes to the address as typed (stray spaces included) instead of the account's stored address. | Send to `staff.email`. | Open |
| F-035 | Low | Security | `auth.controller.js:24` | Registration accepts a 1-character password (every other password path needs 6) and any characters in the gym code (`check-code` allows only a-z, 0-9 and hyphens, and codes appear in URLs). | Apply the same two rules on registration. | Open |
| F-036 | Low | Security | `auth.controller.js:420-423`, `staff.controller.js` | Password reset tokens are stored as written, so a database leak exposes links that work for 15 minutes. | Store a SHA-256 of the token; compare hashes. | Open |
| F-037 | Medium | Data | `gem-backend/prisma/schema.prisma` | Money is stored as floating point (`Float`: balances, prices, payments, salaries). It is exact for whole francs, but GEM supports currencies with cents (NGN, GHS, USD...), where floats round. | Store whole minor units (`Int`) or `Decimal`. Schema change. | Needs decision |
| F-038 | Medium | Performance | `schema.prisma` | Most tables have no index on `gymId` (Payment, Sale, SaleItem, Attendance, Task, Expense, TimeCard, CalendarEvent, Notification, Package, EquipmentIssue), so every list reads the whole table as gyms grow. | Add `@@index([gymId, <date>])` to each. Schema change, but additive. | Needs decision |
| F-039 | High | Bug | `approval.controller.js:16-49,194-249` | Approving, declining and cancelling a request check "still pending" and then act, so two managers at once apply a change twice. No action checks the member's state: freezing a frozen member compounds the dates, and "unfreeze" reactivates a cancelled member (reachable when a desk request is approved after a manager already acted directly). | Claim the request atomically; refuse actions that do not fit the member's state. | Open |
| F-040 | Medium | Bug | `approval.controller.js:18-27` | Days to extend or freeze are not checked: negative, fractional or huge values shorten a membership or produce an invalid date (500). A freeze start date is not checked either. | Whole days between 1 and 3,650; a real date. | Open |
| F-041 | Medium | Product | `approval.controller.js:19` | Extending a membership that already ended counts from the old end date, which can still be in the past, while setting the status to active. | Decide whether an extension of an ended membership counts from today. | Needs decision |
| F-042 | Medium | Bug | `payment.controller.js:109,188`, `approval.controller.js:79`, `jobs/freezeFees.js:36` | A member's balance is read, changed in JavaScript and written back. Two desks taking payments for one member at once (or a payment during the freeze-fee job) lose one of the updates. | Change the balance in one SQL statement (`GREATEST(0, balance - x)`). | Open |
| F-043 | Medium | Bug | `attendance.controller.js:179-223` | Two check-ins for one member at the same moment (a double click, two desks) both pass the 30-minute guard and both spend a pass. | Lock the member row for the check-in. | Open |
| F-044 | High | Security | `attendance.controller.js:237-243` | `PATCH /api/attendance/:id/checkout` updates by id with no gym check: one gym's desk can check out another gym's visit. An unknown id answers 500. | Find within the gym first; 404 otherwise. | Open |
| F-045 | Medium | Security | `attendance.controller.js:42` | The attendance list sends every visiting member's 4-digit check-in code and balance to every role, including the front desk (which the screens deliberately never show a code) and trainers (who are not shown money). | Leave the code out; leave the balance to roles that handle money. | Open |
| F-046 | Medium | Security | `attendance.controller.js:72-98` | Member check-in by code also accepts a staff code and answers with that employee's name, with no attempt limit: the desk can find every staff code by trying them all. | Limit wrong codes per account, as `staff.controller` does for the desk sign-in. | Open |
| F-047 | High | Security | `calendar.controller.js:180-192` | Creating a repeating calendar entry with an unreadable date or end date loops forever (`current > until` is never true for an invalid date), so any staff account can stop the API for every gym. A far-off end date creates thousands of entries in one request. | Validate both dates; cap a series at one year. | Open |
| F-048 | Medium | Security | `calendar.controller.js:273-303` | Updating an event passes the request body to the database except for a few named fields (mass assignment): any other column can be set, and an unknown field answers 500. | List the fields an update may change. | Open |
| F-049 | Low | Bug | `calendar.controller.js:287-297` | An event update without `staffIds` clears the event's staff and deletes their invites. To check: whether the calendar page always sends the list. | Keep the staff when the list is not sent. | Open |
| F-050 | Low | Quality | backend, 37 places | `.catch(() => {})` swallows failures of notifications, emails and tasks without a trace, so a broken side effect goes unnoticed in production. | One helper that logs what failed. | Open |
| F-051 | Low | Performance | `attendance.controller.js:30-49`, `calendar.controller.js:46-68` | Without a date, the attendance and calendar lists return every row the gym has ever made. | Check the callers; give each a default range or a limit. | Open |
| F-052 | Low | i18n | `attendance.controller.js:132,164`, `activityLog.controller.js:5` | Server messages format dates in the server's locale and time zone, and the activity log filters days by server time (UTC on Railway, an hour off for Cameroon). | Format with the gym's language and the caller's time zone. | Open |

## 7. Needs my decision

| ID | Decision needed | Recommendation |
| :- | :- | :- |
| D-1 (F-001) | How production starts and changes its schema. | Start command `node src/index.js`; schema changes through migrations (`prisma migrate deploy`); never seed production. |
| D-2 (F-002) | What to do with the public demo. | Run the demo as its own deployment with its own database, or keep it but switch off email and SMS for the demo gym and use `@example.com` addresses in the seed. |
| D-3 (F-007) | Token storage and logout. | Keep bearer tokens for now, add server-side revocation on logout and a strict CSP; consider httpOnly cookies later. |
| D-4 (F-008) | Migrations. | Baseline migration from the current schema, then migrations only. |
| D-5 (F-010) | `delete-all.js`. | Delete it. |
| D-6 (F-012, F-013, F-014) | Zoom on phones, favicon and title, friendly error and 404 pages. | Allow zoom; a GEM favicon; a friendly error screen and a 404 page. |
| D-7 (F-018) | Twilio token. | Regenerate it. |
| D-8 (F-021) | Email verification. | Add verification for new owners (and for email changes) before launch. |
| D-9 | The 244 uncommitted changes from earlier sessions (now on this branch). | Done as recommended after "go": baseline commit `e789a22`. Undo with `git reset --soft 69cefa8` if unwanted. |
| D-10 (F-022) | `Documents/login.txt` is still in git history. | Change that password now. Rewriting history needs a force-push; only worth it if the repository is or becomes public. |
| D-11 (F-023) | `nodemon` audit fix is a major version change (dev only). | Upgrade `nodemon` to its latest major manually and check `npm run dev`; low risk, dev only. |
| D-12 (F-028) | The CI workflow. | A workflow with a PostgreSQL service that installs both apps, runs the unit and API tests, then the end-to-end suite. |
| D-13 | Type-checking for a JavaScript codebase. | Not now: adding `checkJs` across 59,000 lines is a project of its own. Keep lint strict and the tests broad instead. |
| D-14 (F-029) | Telling Express it runs behind Railway's proxy (`app.set('trust proxy', 1)`), so limits see each visitor's own address. | Yes. It is the only way per-visitor limits work on Railway. It is set through an environment variable (`TRUST_PROXY`, default 1 in production), so a server that is not behind a proxy can turn it off. |
| D-15 (F-037) | How money is stored. | Move to whole minor units (`Int`) before more currencies with cents sign up. Needs a data migration, so plan it as its own change. |
| D-16 (F-038) | Adding indexes on `gymId` (and the date each list sorts by). | Yes: additive and safe, and the schema already goes out with `db push`. Best done together with D-4 (migrations). |
| D-17 (F-041) | What extending an ended membership means. | Count the extra days from today when the membership has already ended, so an extension always gives the member that many days of access. |
| D-18 (F-008) | A migration once added `Task.dueTime`, which the schema no longer has. If that column holds data on Railway, `prisma db push` in the start command refuses, and the backend does not start. | Check the live column; drop it on purpose (or keep it in the schema) before the next deploy. |
