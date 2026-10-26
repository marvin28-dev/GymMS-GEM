# GEM production-readiness audit: progress

This file is the source of truth for the audit. A new session starts by reading it top to bottom.

- **Branch:** `production-audit` (made from `main` at `69cefa8`). Nothing is pushed; `main` is never touched.
- **Current stage (from 2026-10-24):** the owner said "make it ready for the gyms then, make the best decisions for me", so the section 7 decisions are being applied as recommended, most important first, each with tests and its own commit. Section 8 lists what is done; what only the owner can do is listed there too.
- **Audit phases:** All eight phases are done; `AUDIT_REPORT.md` is the summary for the owner. Findings F-001 to F-181, decisions D-1 to D-54. The two final runs on `bfa26e8` each passed everything: 63 unit tests (10 files), 278 API tests (30 files), and 798 browser tests in five profiles (Chromium 250, Firefox 250, WebKit 250, iPhone 15 24, Pixel 7 24; 66 spec files). What is left is the owner's: the decisions in section 7, the open questions above, and TESTING_CHECKLIST.md section 25.

### Browser checks owed (to run with the Phase 4 browser suite)

All four were run in Phase 4 and pass: 1 in `journey-calendar.spec.mjs`, 2 and 3 in `journey-staff.spec.mjs`, 4 in `journey-money-forms.spec.mjs`.

1. Calendar form: a repeating entry with a last date more than a year out shows the translated limit under "Repeat until" (EN and FR), and the date box stops at a year (fcd1b52).
2. A colleague (front desk) opening a trainer's profile sees "Photo ID on file" without Download; the owner and the trainer still see Download (4258be0).
3. Five wrong manager codes in the code box show "Too many tries. Try again in N min." in the chosen language (6fe825d).
4. Adding a member, a visitor and a payment still work from every form after the transaction changes (8d60de4).
- **Started:** 2026-10-19. The owner replied "go" without answering the four Phase 0 questions, so the proposed defaults were used: a local `gem_test` database for tests, the baseline commit (D-9), tool downloads allowed, and the Railway details treated as unknown until the owner answers (see "Open questions").

### Open questions for the owner

1. Railway: whether the backend service reads `gem-backend/railway.json` (its root directory is `gem-backend`, or the config path points to the file), whether the live database holds the demo gym "elite", and which of `FRONTEND_URL`, `ALLOWED_ORIGINS`, `EMAIL_FROM_ADDRESS` are set (names only).
2. Resolved on 2026-10-25: the CLAUDE.md lines that described removed or changed code (the system tour, the task toggle labels, the photo rule on the dashboard, the convert and drawer components, ManagerAuthSection, the Settings dots) were corrected, and a line for D-20 added.

## Session log

| Date | Phase | What happened |
| :- | :- | :- |
| 2026-10-26 | After | The owner's requests, each tested before it was committed: GEM's logo is the cut gem the owner chose from three drawn options (1d71493; their own artwork, a PNG named .svg, was tried and reverted at their request); a screen on its way shows a loader and a page waiting for its data shows placeholders, never an empty state (e1dc447; found by opening every page with each answer held back 3 s); "Powered by Ekoteksolutions" on the public pages, the menu, emails and PDFs (9e83df4). Found on the way: a new payment's row read "-" for its member until the list reloaded (0d7138f); the dialogs accessibility test ran past its time when tests ran side by side (d7a5efb, one test per dialog); the logo test read two different marks once the loader showed one (fe899fd). Final runs on fe899fd: unit 74/74 twice, API 341/341 twice, browser 1048 of 1057 (3 timeouts that passed 20 of 20 when rerun) and 1051 of 1057 (6 skipped by design, none failed). Browser runs took about an hour: with 1.8 of 7.8 GB free the computer swaps (the dialogs test takes the same 1.4 minutes on the commit before these changes), so the second run used two workers. |
| 2026-10-25 | 8 | The owner's local database (gem_db) stopped sign-in: "The column Staff.emailVerifiedAt does not exist". It had been kept by prisma db push, had none of the audit's migrations, and had lost Task.dueTime to an old push, so migrate.js (rightly) recognised no schema. After a pg_dump and a rehearsal on a copy (same row counts, schema identical afterwards), Task.dueTime was put back and migrate.js marked the baseline and audit migrations and applied the other six. On the way: npm run db:deploy never read .env locally (9e0456d, with a test that fails without it; API 339/339). The same can happen to the live database if it was ever pushed from a schema without Task.dueTime: the first deploy then stops without changing anything (TESTING_CHECKLIST 25.11). |
| 2026-10-25 | 8 | Final runs on 019525c, twice in a row: unit 74/74 and 74/74, API 338/338 and 338/338, the browser suite in all five profiles 936 passed and 6 skipped by design both times (21.7 and 22.4 minutes). Lint unchanged (backend clean, frontend 47 for D-50). AUDIT_REPORT.md rebuilt for the state after the decisions: the verdict, the owner's steps, every finding's outcome, the decisions applied and the pre-launch list. |
| 2026-10-25 | 8 | Final runs after the decisions. The first browser run in all five profiles on 336f7c9 passed 928 of 937 (6 skipped by design) and found 3 failures: J-27 in Chromium and Firefox clicked the only "Français" on Settings, Language, and D-23 had added a second (7e59805: each choice is now a labelled group of buttons, which also gives the screen's language choice to the keyboard; it was a clickable box); and sign-up's light-theme test in Firefox lost a click, 1 in 30 when repeated alone, because a web font arriving after document.fonts.ready moved the button half its height between the press and the release (0f1904d: the tests wait for the fonts by name; 60 of 60 after). CLAUDE.md's stale lines corrected (open question 2), TESTING_CHECKLIST updated for the decisions (sections 1, 20 and 25). |
| 2026-10-25 | Decisions | D-23 and D-40 (4b26885, d2b63ae): members' emails in English or French, and Settings on a phone as an accordion of the desk's panels (the first phone layout opened the desk's default section below the whole list, out of sight, so the first tap closed it; the browser test caught it). Findings whose decision was applied now carry that status in section 6. Unit 74/74, API 338/338. |
| 2026-10-25 | Decisions | Security, privacy and screens (section 8): D-3, D-45, D-24, D-36, D-41, D-34, D-33, D-46, D-12, D-51, D-8, D-37, D-43, D-42, D-39, D-38, D-25, D-6, D-49, D-53, D-48, c41eea1 to 2ff9f88. Three more additive migrations (revoked tokens, notification reads, email confirmation). A full browser run with the D-8 reminder in place found two problems of mine (the reminder's live region doubled a test's status message; a calendar test file edited mid-run) and Firefox timeouts under load; all fixed or passing on rerun. Unit 74/74, API 334/334 on the final code. |
| 2026-10-24 | Decisions | Applying the section 7 decisions (see section 8): deployment (D-1, D-2, D-4, D-5, D-16, D-18, D-19, D-52) and money and data (D-17, D-20, D-21, D-22, D-26 to D-32, D-35, D-47, D-54) done, ee5155c to 5b053a9. Two additive migrations (payroll link and receipts, member notes). Prisma's AI guard refused `db push --force-reset` on gem_test for the unique index on PayRecord.expenseId; instead of a reset, that migration's own SQL (two added columns, an index, a foreign key) was applied to gem_test, which `migrate deploy` will do in production. A test of the old browser-kept member notes was replaced by its server-side form (5b053a9). |
| 2026-10-24 | 8 | Final runs. Unit, API and the browser suite in all five profiles, twice in a row on one commit. Four earlier final runs each found one failure, fixed before starting again: an API race under full load (one of eight clock-ins at once answered 500; 99eaf9c, up to ten tries with growing random waits), and the light theme test on a phone three times (a click most likely lost to a late web font, 2a6d66b; then the dial-code button left partly below the screen, so the click's own scroll closed the list, bfa26e8). The two final runs on bfa26e8: 63 of 63 unit, 278 of 278 API, 798 of 798 browser, both times, in 15.5 and 15.1 minutes. AUDIT_REPORT.md written. |
| 2026-10-24 | 8 | Second pass over the open findings. Fixed, each with a test that fails without the change: F-054 (6a853d3, two Sends or Retries at once mailed people twice), F-180 (fc97141), F-130 (c6c3ab5), F-153 and F-138 (c987473), F-082 (f5d2e41, a browser blocking site storage got the crash screen; it is now told what to allow), F-131 (983f298, the rest was done in step 10), F-173 (a) (5daf55a, the inactivity sign-out lands on the gym's own page), (b) and (g) (aaeb74a), (c) (29b3d3c), (e) (63ff34d, time card history is the person's or management's), F-091 in part (aeb7419), F-129 (4cea0be, checked on screenshots in light mode on desktop and phone), F-052 in part (afa39a4), F-013 in part (99d8947). Left for decisions: D-53 (the two phone-layout hooks), D-54 (an unknown payment method filed as cash), F-181 with D-28 (a refund that fails silently). A re-read of this session's server changes found one empty catch of my own in the shutdown (6613847). Seen once under load and not again in 6 runs alone: the J-12 renewal dialog not opening after a payment in Firefox; watch it in the final runs. Full browser run: 500 of 500 passed in 11.1 minutes, 250 in each browser, before 6613847. |
| 2026-10-23 | 5, 6, 7 | Phase 5 (cross-browser): WebKit (Safari's engine) ran every browser test at desktop size, and an iPhone 15 (WebKit) and a Pixel 7 (Chromium) profile ran the 22 phone tests: 254 of 255 passed the first time; the one failure was the countdown test's own timing in WebKit (1100b16). Real iPhones, Android phones, Safari on a Mac, email in real inboxes, printing and screen readers are on the manual checklist (TESTING_CHECKLIST.md section 25). Phase 6 (accessibility, 8c1211d): axe (WCAG 2.1 A and AA) found 417 problems on 20 screens before any change: 356 colour contrast, 20 zoom switched off, 15 scrollable regions with nothing to focus, 11 buttons with no name, 9 fields with no label, 6 selects with no name. Fixed: labels tied to their boxes (the shared fields, and utils/labelLinker.js for the hand-made labels), 44 error lines announced, the sidebar, phone drawer and header menus as real buttons, 37 icon buttons named, dialogs that take focus, keep it and give it back (hooks/useDialogFocus.js), Escape closing only the dialog on top, row menus usable from the keyboard, the inactivity warning an alert dialog, switches, theme cards and text links as buttons, the hand-built pop-ups as dialogs (components/ui/DialogBox.jsx). After: on 20 screens, 9 dialogs and the desk's tabs nothing is left but colour contrast and zoom, which change how the app looks (D-48, D-49); tests/e2e/accessibility.spec.mjs checks it, with keyboard checks. The first full run had 9 failures: three tests (in both browsers) picked the sidebar's new Tasks button over a profile tab and one booked an event without its time zone, all fixed in the same commit, plus one Firefox miss of a 2.5-second "Saved" message that passed in the next run. The second run passed 441 of 442; the one failure, a clock-in answering 500, was F-176 (a6f0739: seven of eight approval requests sent together failed the same way). Phase 7: F-099 and F-051 in part (90162ea: the sidebar's counts, Daily Overview and the Dashboard ask only for what they show; a member in the sidebar's list went from about 1,060 to 240 bytes), F-128 (f2ceee0), F-177 (037421e: compressed answers; a 100-member list went from 105.7 KB to 4.4 KB), the Notifications page's times (85d13f8), and a pass over how the server starts and stops: F-178 (bad5abf, a message cut off while sending stayed "sending" for good), F-179 (5062324, the health check asks the database), F-180 (fc97141, a deploy lets requests under way finish). The accessibility test's screen sweep timed out once in Firefox (16 axe scans in one test); it is now one test a screen. The 47 lint problems left were checked one by one: none gives a wrong result (D-50). Earlier in Phase 7: F-009, F-015, F-024, F-027. |
| 2026-10-23 | 4 | Phase 4 (tests) done (88b83c7 to the docs commit). The full browser run (Chromium and Firefox, three workers, production build) passed 422 of 422 in 19.6 minutes; the pages-on-demand change (b509a23) came after it and is covered by the Phase 5 and final runs. New browser journeys: packages, settings, search, language, theme and phone navigation, coaching, member actions (renewal after the balance, a desk freeze approved by a manager), the desk's day (shift check-in and check-out prompts). New API tests: the activity log, time cards (14), equipment tasks, expense review notices; 27 unit tests for the shared rules, with the browser and server copies checked against each other. Fixed with a test that fails without the fix: F-168 (the code box wiped a code typed while it shook), F-169 (Settings sections could be changed before the gym loaded, then were replaced), F-170 (two clock-ins at once made two cards), F-171 (a night-shift correction was refused). Logged: F-172 (Reject on an earlier day's hand-set time writes today's time, D-47), F-173 (small things). Test infrastructure: the browser tests run on a production build (vite build and preview) with three workers; on the dev server with four, Firefox page loads took 10 to 30 seconds and this 8 GB machine ran short of memory (Firefox killed our main script as too slow). E2E_DEV=1 and E2E_WORKERS override. |
| 2026-10-23 | 4 | Phase 4 (tests) under way (46dbf29 to fb0334c). Browser journeys: account (landing, sign-up through the form, demo, find your gym, the four sign-in answers, reset by the emailed link, a manager's reset link, the inactivity warning and countdown, an expired token, a deactivated account signed out by an open screen, Back after signing out), staff, calendar invites and the busy warning, money forms on every surface, tasks, sales, Communication. The browser test backend now shows its fake outbox on the loopback so a test can follow an email. API: products and sales, communications, the end-of-day report, notifications, coaching. Fixed with a test that fails without the fix: F-165 (a cost price that is not a number stored as NaN; a product code clash answered 500) and F-167 (two coaches taking one member at once both got them). Found and logged: F-164 (form errors not announced, Phase 6), F-166 (one person reading a gym-wide notice reads it for everyone, D-46). The four owed browser checks pass. Checked and not a bug: Back pressed in Firefox 80 ms after Sign Out (before the sign-in page was drawn) showed the old page; the setup notices are already the owner's. Load note: a full page load from the Vite dev server takes 10 to 30 seconds in Firefox when every test runs at once, and the landing and sign-up pages wait for the YouTube embed (F-141), so journey specs allow 120 seconds and block YouTube. |
| 2026-10-23 | 3 | Phase 3 (security) done (fae29e3 to d73e5e7), each change with a test that fails without it. API security headers and no public uploads folder (F-005 API part, F-019); the live stream opened by a one-use ticket instead of the sign-in token in the URL (F-006); uploads to the app's folders only, pictures by their own bytes, a limit per account, 413 for a large file (F-011); staff notes appended by the server (F-121), which also fixed an edit from the Staff list wiping every earlier note (F-162, found here); the manager code box is a code box and password managers can fill the sign-in (F-093, F-136; the desk's exit box and re-authentication keep opting out on purpose); npm audit fix in both apps, patch and minor only, with the Prisma client aligned to the CLI (F-023, 7.8.0 to 7.10.1). A sweep from another gym's owner over about fifty id routes and a dozen creates that name another record found nothing leaking (`tests/api/cross-gym.test.mjs`). The secrets scan (working tree and every commit, values masked) found nothing beyond F-022 (F-020). Raw SQL is only tagged templates, nothing injects HTML into React, errors other than deliberate ones answer a plain 500. Found on the way and fixed first: F-163, a failed reload emptied a list and its saved copy on every screen that loads through softAll. Corrections: ae39fe6's message says 6 upload tests fail without the change; it was 4 (the other two pass either way). D-11 needs nothing now: npm audit is clean with nodemon 3.1.14 unchanged. |
| 2026-10-23 | 2, 4 | Frontend fix plan step 10 done (205341e to 69ad022). Dead code removed (F-134, c6133e3): 840 lines across 17 pages, including Members' fake edit modal and unreachable freeze / cancel / delete actions, two member profile modals nothing opened (one wrote a status the database lacks), the desk's never-shown drawer, and the Dashboard's notification and own-task loads made on every visit for cards trainers never see. Unused translation keys removed (F-150, 69ad022): 274 per language, checked by a script that every other key and value stayed the same, and guarded from now on by `tests/unit/translation-keys.test.mjs` (every key the code names exists in both languages). Empty catch blocks replaced by `utils/storage.js`; components declared inside components moved out; refs no longer written during render; files that export components export only components. Found on the way, each fixed with a test that fails without it: F-158 (the header's and the desk's notification actions failed silently), F-159 (crash screen), F-160 (payments shown with no status). The lint config now ignores capitalised parameters as it already did capitalised variables, because ESLint 9 does not count <Icon /> as a use (D-44 for the upgrade that would let both go); a separate scan found and removed 40 unused capitalised imports. Corrections: c6133e3's message says lint went to 92 problems; it was 94. F-134 overstated two items: PKG_MONTHS is still a reachable fallback and Members' generateRef is used; both kept. Full browser runs between the commits: 281/284 and 288/292 passed, with two date-guarded skips each time; the failures were a dev server connection refusal and two test races, all fixed or passing on rerun. |
| 2026-10-20 | 2, 4 | Frontend fix plan steps 6 to 9 done (70f15bb to 0bd373b), each with a test that failed without the change. Step 6: the local day everywhere the UTC day was used, including the attendance list by local day (F-089). Step 7: money through `formatMoney` (F-132). Step 8: package access types and product categories saved on the gym (F-127), with an honest Copy button. Step 9: translations (F-080, F-094, F-095, F-104, F-133, F-148, F-149). F-133 went page by page with French browser tests (`tests/e2e/i18n-pages.spec.mjs`) and shared display helpers: `utils/packageText.js` (a package's stored "6 Months" and "Unlimited"), `utils/departments.js assigneeName` (role and department tasks, named in English by the server), `utils/expenseCategories.js`, `utils/date.js payMonthText` (pay periods stay stored as "Sep 2026"). Found on the way: F-155 (a refused logo save stayed on screen), F-156 (the desk's view names cut to "Wee", "Mon"), F-157 (member notes signed "Staff"), all fixed; D-43 (an auto-renew switch nothing reads). Correction: F-149 said the sign-up screen's "4-digit code to log into the Front Desk" was untrue; it is true (the desk signs people in with the code, `verifyStaffCode`), so that text was kept. A full browser run (252 tests at the time) had one Firefox timeout under load (accounting-failures, "a review the server made"), which passed 9 times out of 9 when rerun alone. |
| 2026-10-20 | 2, 4 | Frontend fix plan steps 4 and 5 done (77813f9 to 109ca47), each with a test that failed without the fix. Step 4: a live reload no longer wipes a rota, a form or a coach's goals being filled in, or closes the coach's Log menu (`hooks/useOnOpen.js`). Step 5: F-113, F-086, F-087, F-088, F-119, F-121, F-122, F-123, F-124, F-125, F-126, F-147; shared rules added (`taskOverdue`, `isActiveMember` in utils/attention.js, `utils/pager.js`, `utils/roleNames.js`). Found on the way: F-154 (High), clock times sent as "02:30 PM" read as 02:30 by the server (7fb6ee6, b84f991). The message of 7fb6ee6 says clock-ins were affected; they were not (the check-in dialog sent 24-hour time): only an edited check-out and the Edit time dialog. Also D-42 (the visitor form's unsaved "Remainder due by" date). A full browser run showed one load-only failure (the Dashboard count read before its data came), fixed in the test (109ca47). |
| 2026-10-20 | 2, 4 | Frontend fix plan step 3 done (bfdf6fb to db8ee4b), each fix with a phone-sized browser test that failed without it. Dialogs drawn only by the desktop layout are now drawn by both (Tasks, Packages, Accounting, staff profile); the phone's cut-down add sheets on Accounting, Payments and Packages are replaced by the desktop's full forms, which fixes F-110; the phone's Delete task and Deactivate dialogs close, and Deactivate asks for the code (F-111); one photo rule for every check-in (`needsCheckInCode`, F-114). Found on the way: the floating + button covered the bottom row's 3-dot menu on every phone list (F-152, fixed e0a85d2), and the phone's Payments list does not open a payment's details (F-153). CLAUDE.md says the photo rule is "off on the dashboard", but the Dashboard applies it like everywhere else; the sentence is out of date (left for the owner to edit). |
| 2026-10-20 | 2, 4 | Frontend fix plan step 2 done (d9ab86d to 1b04b85), each fix with a browser test that failed without it: no screen reports a change the server refused or never made (F-084, F-107), refusals show the server's reason where the action was taken (F-120), and a failed load says so with Try again instead of looking empty (F-102, shared `components/ui/LoadFailed.jsx`). A flaky Settings test exposed a real race: an earlier gym load answering late wiped typed text (F-151, fixed e898903). The salary and pay-day change now waits for the server (ec4da1f); that was the first part of D-31, done because it only reports a failure and changes nothing when the save succeeds; the owner can still overrule it. |
| 2026-10-19 | 2, 4 | Browser test harness (bb6abf4): Playwright starts the backend on gem_test with fake email and uploads and the Vite dev server on ports 5055 and 5176; each test makes its own gym. Frontend fix plan step 1 done, each fix with a browser test that failed first: print windows escaped (cdd7ff2), sign-out clears the gym caches (46a75fd), search per account (f28549f), desk exits through the gate (d3265d4), no search by check-in code (fbe0891). 13 browser tests and 9 unit tests pass in Chromium and Firefox. |
| 2026-10-19 | 2 | Frontend Pass 1: shell, services, hooks, utilities, shared UI, components and all 25 pages read in full (findings F-080 to F-147, decisions D-25 to D-40). Dead code removed first (8b95823). The page review found the recurring patterns that drive the frontend fix plan: fake success, phone layouts without the desktop's dialogs, forms wiped by live updates, and the UTC day. |
| 2026-10-19 | 0 | Discovery. Branch created. Inventory, integration points, journeys and first findings written. Stopped for "go". |
| 2026-10-19 | 2 | Backend fixes 7 to 10: check-in (63ad2d7), staff (4258be0), sign-in security (6fe825d), gym settings, tasks, reminders, logging (0ad220f). F-053 and F-069 were overstated and are corrected in the log. 138 API tests; backend lint 0. |
| 2026-10-19 | 2 | Backend fixes 1 to 6 of the plan done, each with tests that failed first: app-wide handling and CORS (2e7672d), approvals (ec355dd), calendar crash and update (fcd1b52), tenancy and mass assignment (719f080), payments and new members (8d60de4), expenses, payroll and freeze fees (ee6805d). 102 API tests pass; backend lint 29 to 15. Next: plan step 7 (check-in). |
| 2026-10-19 | 2 | Test harness (Vitest on a local gem_test database; Resend and Cloudinary faked), backend ESLint (29 errors), knip with real entry points. Pass 1 of 112 root and backend files. Prisma refused to reset a database from an AI session without the owner's consent, so the harness never resets: it only pushes the schema, and `npm run test:db:reset` is left for a person to run. |
| 2026-10-19 | 1 | "go" received. Baseline commit `e789a22` (earlier uncommitted work, minus `Documents/login.txt`). Commit `f194d32`: login notes untracked, every `.env.*` ignored. Baseline results recorded (section 5). The owner had added root tooling at 15:21 (Playwright 1.64.1 with browsers, knip 6.42.0, Vitest 5.0.5, TypeScript 7.0.2); it is now part of the inventory. |

### Commits on this branch

| Commit | What |
| :- | :- |
| `e789a22` | Baseline: work in progress before the audit (258 files). |
| `f194d32` | security: stop tracking sign-in notes; ignore every .env variant. |
| `9e979af` | docs: audit progress file with the Phase 1 baseline. |
| `de699b0` | test: API test harness on a local gem_test database. |
| `b2370c2` | chore: lint the backend; knip with each app's entry points. |
| `0caef7b`, `1523799`, `78d69d4`, `8ad80a0` | docs: backend review findings F-029 to F-079, decisions to D-24, fix plan. |
| `2e7672d` | fix(api): proper answers for client mistakes; exact CORS host match. |
| `ec355dd` | fix(approvals): apply a request once, only when it still fits the member. |
| `eeaf004` | docs: F-053 downgraded after testing; fixed items marked. |
| `fcd1b52` | fix(calendar): a bad repeat date no longer crashes the server. |
| `719f080` | security: no gym can write into another; request bodies set only their fields. |
| `8d60de4` | fix(money): payments never lost; members and their first payment together. |
| `ee6805d` | fix(money): checked expenses, a month paid once, freeze fees that keep payments. |
| `7e2aecb` | docs: progress after backend fix steps 1 to 6. |
| `63ad2d7` | fix(check-in): one visit, one pass; no codes in the visit list; guessing limited. |
| `4258be0` | security(staff): own fields only, unique codes, private ID scans, owner-only deactivation. |
| `6fe825d` | security(auth): limits on guessing and email floods; hashed reset links. |
| `0ad220f` | fix(backend): gym settings checked, task rules, reminders, no silent failures. |
| `e623964` | docs: progress after the backend fix plan (steps 7 to 10). |
| `8b95823` | chore(frontend): remove 4,900 lines of dead code and 8 unused packages. |
| `a315848`, `1bb3f3b`, `148fcfe`, `72afca4` | docs: frontend shell, services, utilities, shared UI and components reviewed (F-080 to F-104). |
| `0fa009f`, `aa3d83b` | docs: pages and translations reviewed (F-105 to F-150, D-25 to D-40); Pass 1 complete. |
| `bb6abf4` | test(e2e): browser tests against the real app on the test database. |
| `cdd7ff2` | security(frontend): print windows show typed text as text (F-085, F-090). |
| `46a75fd` | security(frontend): signing out removes the gym's lists from the browser (F-105). |
| `f28549f` | security(frontend): header search forgets the last account's people (F-098). |
| `d3265d4` | security(frontend): the front desk's two side doors go through the exit gate (F-106). |
| `fbe0891` | security(frontend): the Members search no longer matches check-in codes (F-078). |
| `4c0d2cd` | docs: frontend fix plan step 1 done; decision D-41. |
| `d9ab86d` | fix(front desk): a refused expense or issue report is not shown as done (F-084, F-107). |
| `c8b1eca` | fix(attendance): a refused check-out is not shown as done (F-107). |
| `757a1ca` | fix(operations): Add task and issue status changes report refusals (F-107, F-120). |
| `dd94b29` | test(e2e): each setup call names its own address (sign-up limit per address). |
| `e9b9573` | fix(staff profile): changes show only once the server has made them (F-107, F-120). |
| `e4ef386` | fix(member profile): check-ins and approvals confirmed only by the server (F-107, F-120). |
| `ac15a5b` | fix(notifications): changes and loads report failures (F-102, F-107). |
| `74c1262` | fix(packages): refused saves and deletes say why (F-120). |
| `1bf5418` | fix(calendar): refused deletes and invite answers say why (F-120). |
| `fd153dc` | fix(settings): refused gym profile and registration fee saves say why (F-120). |
| `0fdabf3` | fix(staff): refused status changes and lost photos are reported (F-120). |
| `0e4a7ed` | fix(members): new members are created with their photo; a refused visitor check-in says why (F-120). |
| `ec4da1f` | fix(staff): pay changes and bonus removals wait for the server (F-118 part, F-120). |
| `915b346` | fix(accounting): refused expense reviews and deletions say why (F-120). |
| `f4676a0` | fix(communication): refused unschedule, delete and retry say why (F-120). |
| `a138a42` | fix(tasks): a refused task shows the server's reason (F-120). |
| `e898903` | fix(settings): a late gym load no longer wipes what was typed (F-151). |
| `a1b12dc` | fix: a failed load says so instead of looking empty (F-102). |
| `df7b9fd` | fix(staff): an access code that could not be shown or replaced says why (F-120). |
| `1b04b85` | fix(settings): say when the gym could not be loaded (F-102). |
| `4628f2d` | docs: frontend fix plan step 2 done; F-151. |
| `bfdf6fb` | fix(sales): the phone's Add product button shows only on Products (F-101). |
| `0a46ff3` | fix(phone): Delete task and Deactivate can be cancelled; Deactivate asks for the code (F-111). |
| `189479d` | fix(tasks): Mark as done works on a phone (F-109). |
| `5f64502` | fix(packages): view, edit, delete and visitor bundles work on a phone (F-109). |
| `e0a85d2` | fix(phone): Accounting dialogs and the full expense form work on a phone; + no longer covers the bottom row (F-109, F-110, F-152). |
| `431377f` | fix(staff profile): task details and Mark as done work on a phone (F-109). |
| `ba78ba7` | fix(check-in): one photo rule on every check-in button, phones included (F-114, F-109). |
| `ac5357c` | fix(payments): a payment can be added on a phone (F-110). |
| `db8ee4b` | fix(packages): a package added on a phone keeps the duration chosen (F-110). |
| `d29060c` | docs: frontend fix plan step 3 done; F-152, F-153. |
| `77813f9` | fix(staff profile): a live reload no longer wipes a rota being edited (F-112). |
| `8937f06` | fix: live reloads no longer wipe forms being filled in or close the coach's menu (F-112). |
| `747b5bf` | docs: frontend fix plan step 4 done. |
| `b99aac7` | fix(dashboard): quick check-in offers every match instead of the first (F-113). |
| `ae5894a` | fix(payments): a gym that has not chosen its methods takes Mobile Money too (F-086). |
| `458df04` | fix(roles): older roles get the right pages; an unknown role gets only its profile (F-087). |
| `5bb3b33` | fix(auth): an expired session returns to the gym's own sign-in page (F-088). |
| `d256d09` | fix(members): passes filter, a new member on a phone, and every page numbered (F-119). |
| `e3f4d61` | fix(staff profile): own role in the edit form, a true task count, ID download (F-121). |
| `7d73961` | fix(tasks, operations): due today is not overdue; names instead of stored codes (F-122). |
| `e93a1fe` | fix(dashboard): active count as on Members, Monday-first calendar, code input (F-123). |
| `164d5c1` | fix(reports): Outstanding is what members owe; one category list; names (F-124). |
| `ca48768` | fix(front desk): refusal reasons, staff on duty in French, 24/48h, phone panels (F-125). |
| `7fb6ee6` | fix(timecards): a 12-hour clock time is read as the clock means it (F-154; see the session log for its message). |
| `b84f991` | fix(attendance): shared time picker, 24-hour times, refused edits, phone flash (F-126, F-154). |
| `984f301` | fix(packages): count active members only; whole-number placeholders (F-147). |
| `109ca47` | test(e2e): follow the new package placeholder; read the active count once members load. |
| `04369d3` | docs: frontend fix plan step 5 done; F-154, D-42. |
| `70f15bb` | fix(attendance): a day's check-ins can be asked for by the gym's local day (F-089). |
| `07e72e1` | fix: the gym's local day everywhere the UTC day was used (F-089). |
| `2fa6b28` | fix: money always in the gym's own style (F-132). |
| `2b01f0e` | feat(gym): keep package access types and product categories on the gym (F-127). |
| `e4cc4ae` | fix(settings): access types and product categories are the gym's; honest Copy (F-127). |
| `2ac04ac` | fix(i18n): Payments receipt labels, no duplicate keys, the page's language (F-094, F-104, F-080). |
| `d62c103` | fix(i18n): French that reads as French; help texts that tell the truth (F-148, F-149). |
| `d0fa65a` | fix(i18n): shared dialogs, buttons and labels in French too (F-095). |
| `147e437` | fix(i18n): sign-in, packages, operations, sales, staff and task assignees in French (F-133). |
| `506a4eb` | fix(i18n): Settings, Dashboard and Accounting in French; a failed logo save is not shown as saved (F-133, F-155). |
| `2ed501c` | fix(i18n): Members and the front desk in French; desk view names no longer cut (F-133, F-156). |
| `332e01f` | fix(i18n): the staff profile's pay, notes and prompts in French (F-133). |
| `9289bff` | fix(i18n): the member profile in French; a note says who wrote it (F-133, F-157). |
| `0bd373b` | fix(i18n): Payments examples and Attendance's photo label in French; one role name table for the sidebar (F-133). |
| `12d283d` | docs: frontend fix plan steps 6 to 9 done; F-155 to F-157, D-43. |
| `205341e` | fix(notifications): the header and the desk's bell report a refused change (F-158). |
| `c6133e3` | chore(frontend): remove dead code inside pages (F-134). |
| `f191633` | fix(frontend): crash screen in the reader's language; no silent storage failures; lint clean-up (F-159). |
| `f1a61ae` | fix(payments): a payment's status by name; safe start-up storage reads (F-133, F-160). |
| `69ad022` | chore(i18n): remove 274 unused translation keys; guard every named key (F-150). |
| `d4cf51d` | docs: frontend fix plan step 10 done; F-158 to F-161, D-44. |
| `fae29e3` | fix(frontend): a failed reload no longer empties a list and its saved copy (F-163). |
| `6577a7f` | security: API headers; live stream by one-use ticket; no public uploads folder (F-005, F-006, F-019). |
| `9633465` | fix(staff): notes added one at a time on the server; an edit no longer wipes them (F-121, F-162); cross-gym sweep. |
| `ae39fe6` | security(uploads): app folders only, pictures by their own bytes, a limit per account (F-011). |
| `c22e5a2` | fix(auth): the code box is a code box; password managers can fill the sign-in (F-093, F-136). |
| `d73e5e7` | chore(deps): npm audit fix in both apps; Prisma client aligned with the CLI (F-023). |
| `2a1f590` | docs: Phase 3 (security) done; F-162, F-163, D-45. |
| `46dbf29` | test(e2e): account journeys J-01 to J-08 and J-28 (and the outbox on the browser test backend). |
| `f32f019` | test(e2e): staff journey J-22 and two owed browser checks. |
| `cd19a98` | test(e2e): calendar journey J-15 and the owed repeat-limit check. |
| `2374a7e` | test(e2e): money forms on every surface (owed check for 8d60de4). |
| `2590bf7` | test(e2e): tasks journey J-16. |
| `69c9dec` | fix(products): a cost price that is not a number is refused; a code clash is 409 (F-165). |
| `5ca4e54` | test(e2e): sales journey J-17. |
| `f9d4511` | test(api): communications J-21. |
| `b351685` | test(e2e): Communication page journey J-21. |
| `2298970` | test(api): the end-of-day report. |
| `0aba136` | test(api): notifications J-25. |
| `fb0334c` | fix(coach): two coaches taking one member at once leaves one coach (F-167). |
| `b8ca172` | docs: Phase 4 progress; F-164 to F-167, D-46; owed browser checks done. |
| `88b83c7` | fix(code box): a code typed while the box shakes is kept (F-168); packages journey J-20. |
| `b036c8a` | test(api): the activity log. |
| `f7ebbe9` | fix(timecards): one card a day when two desks clock in at once; night-shift corrections roll forward (F-170, F-171). |
| `d2a87ad` | test(e2e): run the browser tests on a production build, three at a time. |
| `1df9434` | fix(settings): sections wait for the gym before anything can be changed (F-169); settings journey J-26. |
| `dbe79a7` | test(e2e): journeys J-27, J-10, J-12 and J-14. |
| `938465d` | test(api): an equipment fault raises a maintenance task; a desk expense review is announced both ways. |
| `55c400e` | test(unit): the rules the screens share, and the browser and server copies agreeing. |
| `b00b7d3` | chore(repo): .gitattributes stores text with LF on every machine (F-027). |
| `bdc92a3` | chore(config): check the settings at start; .env.example for both apps (F-009). |
| `68c0ab6` | docs: a README for the repository (F-015). |
| `4274220` | test(e2e): E2E_BROWSERS=all adds WebKit and phone profiles. |
| `45b7f02` | chore(test): add @axe-core/playwright 4.13.0 for the accessibility checks. |
| `b509a23` | perf(frontend): pages load as they are first opened (F-024). |
| `7f47af6` | test(e2e): the deactivated-account test resends its focus signal until the page listens. |
| `c329eef` | docs: Phase 4 (tests) done; F-168 to F-173, D-47; journey coverage map. |
| `1100b16` | test(e2e): the inactivity countdown test leaves room for slow steps. |
| `8c1211d` | fix(a11y): labels, names, errors, keyboard and dialogs (F-083, F-092, F-096, F-100, F-135, F-164); accessibility test; manual checklist section 25. |
| `a6f0739` | fix(api): a clock-in or approval request refused by a busy database is tried again (F-176). |
| `90162ea` | perf: the sidebar, Daily Overview and Dashboard fetch only what they show (F-099, F-051). |
| `85d13f8` | chore(frontend): notification times are worked out as they are shown. |
| `f2ceee0` | perf: a gym's logo is uploaded like the photos, and the gym keeps its address (F-128). |
| `037421e` | perf(api): answers are compressed, except the live stream (F-177). |
| `bad5abf` | fix(api): a message cut off while sending no longer stays "sending" for good (F-178). |
| `5062324` | fix(api): the health check asks the database (F-179). |
| `fc97141` | fix(api): a deploy lets requests under way finish (F-180); the accessibility sweep is one test a screen. |
| `6a853d3` | fix(api): a message is sent once when Send or Retry is pressed twice at once (F-054). |
| `c6c3ab5` | fix(member-profile): a coach can look at a member's photo but not change it (F-130). |
| `c987473` | fix(payments): on a phone a payment opens its details; an empty list says so (F-153, F-138). |
| `f5d2e41` | fix(frontend): a browser that blocks site storage gets the app, and is told what to allow (F-082). |
| `983f298` | fix(member-profile): the dismissible tips go through the guarded storage helpers (F-131). |
| `29b3d3c` | fix(coach): the dashboard counts tasks given to the trainers for older accounts (F-173 c). |
| `63ff34d` | fix(timecards): a person's time card history is theirs or management's (F-173 e). |
| `5daf55a` | fix(frontend): an inactivity sign-out lands on the gym's own sign-in page (F-173 a). |
| `aaeb74a` | fix(frontend): no "add your first staff member" for a gym with staff; the renewal's amount added is translated (F-173 b, g). |
| `aeb7419` | fix(frontend): the browser's access ladder has the "other" role (F-091, in part). |
| `4cea0be` | fix(public pages): the landing navbar and sign-up page follow the light theme (F-129). |
| `afa39a4` | fix(api): the activity log's days are the reader's, and check-in refusals write dates in full (F-052, in part). |
| `99d8947` | chore(frontend): a page description and sharing tags; no long dash in the title (F-013, in part). |
| `6613847` | fix(api): a failure to close the database connections at shutdown is logged. |
| `3a7c79b` | docs: Phases 5 to 7 done, Phase 8 second pass; F-174 to F-181, D-48 to D-54. |
| `99eaf9c` | fix(api): a refused serializable transaction waits longer, at random, before trying again (F-176). |
| `77c5aa5` | docs: F-176 retries made sturdier after the first final run. |
| `2a6d66b` | test(e2e): the light theme test waits for the web fonts before clicking; the README says what the tests fetch. |
| `bfa26e8` | test(e2e): the dial-code list is opened from the middle of the screen. |

### Plan for the backend fixes (Phase 2 and 3 work on the backend)

Each fix gets a test in `tests/api/` that fails before it and passes after, then its own commit. Order:

1. App-wide: `req.body` defaults to `{}` (F-031); client errors keep their status, unknown `/api` routes answer JSON 404 (F-032). Test: `tests/api/robustness.test.mjs`.
2. Missing ids (F-053) in approvals, coach assign, payments. Test: `approvals.test.mjs`, `payments.test.mjs`.
3. Calendar: date and series validation (F-047), field list on update (F-048), staff kept when not sent (F-049), 400 for unreadable input (F-071). Test: `calendar.test.mjs`.
4. Tenancy and mass assignment: attendance checkout (F-044), equipment (F-055), packages (F-067). Tests per file.
5. Approvals: atomic claim and state checks (F-039), day validation (F-040).
6. Money: atomic balance (F-042, F-077), payment transaction and finite amounts (F-064), expenses validation (F-063), payroll duplicate guard (F-065), member and first payment in one transaction (F-064).
7. Check-in: row lock (F-043), attendance list without codes (F-045 part), code attempt limit (F-046).
8. Staff: unique codes (F-059), DELETE owner-only (F-060), ID scan private (F-061), role map (F-062), placeholder password and error text (F-073), raw SQL removed (F-072).
9. Auth: verify-manager attempt limit (F-030), gym code case (F-033), reset email address (F-034), registration rules (F-035), hashed reset tokens (F-036), rate limits (F-003, F-029 with `TRUST_PROXY`).
10. Smaller: gym response without `managerCode` (F-068), currency and number checks (F-069), task content rule (F-070), task reminders (F-076), member codes (F-056), payroll job helper (F-079), every silent `.catch(() => {})` logs (F-050), backend lint to zero.

### Plan for the frontend fixes (Phase 2 work on the frontend)

Only findings marked Open; "Needs decision" items wait for the owner. Pure logic gets a Vitest unit test first; screen behaviour gets a Playwright test against the local app and `gem_test` (the Phase 4 suite starts here). One commit per step.

1. Security: XSS in print and export windows (F-085), sign-out clears the gym's caches (F-105), the search cache per account (F-098), kiosk links through the exit gate (F-106), no search by check-in code (F-078, frontend part).
2. Fake success and silent failures: F-084, F-107, F-120, F-102. **Done** (d9ab86d to 1b04b85; F-151 found on the way).
3. Phone gaps: dialogs in both layouts (F-109), phone forms (F-110), confirm dialogs that close (F-111), the photo rule on every check-in (F-114), the Sales button (F-101). **Done** (bfdf6fb to db8ee4b; F-152 and F-153 found on the way).
4. Work wiped by live updates (F-112). **Done** (77813f9, 8937f06).
5. Wrong person and wrong figures: F-113, F-119, F-121 to F-126, F-147, F-086, F-087, F-088. **Done** (b99aac7 to 109ca47; F-154 found on the way; F-119's remainder date waits for D-42, F-121's notes server action moves to Phase 3).
6. Local day everywhere (F-089). **Done** (70f15bb, 07e72e1).
7. Money through `formatMoney` (F-132), the gym's name on exports and receipts (F-090). **Done** (2fa6b28; F-090 was fixed in step 1).
8. Settings on the gym record instead of the browser (F-127). **Done** (2b01f0e, e4cc4ae; D-43 found on the way).
9. Translations: F-094, F-095, F-104, F-133, F-148, F-149, F-080. **Done** (2ac04ac to 0bd373b; F-155 to F-157 found on the way).
10. Dead code (F-134, F-150) and the frontend lint errors (190 at baseline). **Done** (205341e to 69ad022; F-158 to F-160 found on the way; 48 lint problems left as F-161).
Phase 6 then takes the accessibility findings (F-083, F-092, F-093, F-096, F-100, F-135, F-136) and Phase 7 the performance ones (F-051, F-099, F-128).

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

## 3a. Test coverage by journey (Phase 4)

Browser specs are in `tests/e2e`, API tests in `tests/api`, unit tests in `tests/unit`. A journey spec is named `journey-*.spec.mjs`.

| Journey | Browser | API and unit |
| :- | :- | :- |
| J-01 Landing | journey-account | |
| J-02 Sign up | journey-account | auth |
| J-03 Demo | journey-account | |
| J-04 Find your gym | journey-account | auth |
| J-05 Sign in | journey-account, password-fields, smoke | auth, auth-limits, auth-proxy |
| J-06 Forgot and reset | journey-account | auth, auth-limits |
| J-07 Email verification | does not exist (gap logged in Phase 0) | |
| J-08 Re-login, expiry, inactivity | journey-account, local-day, session-expiry | unit auth-signout |
| J-10 Dashboards | dashboard-details, dashboard-checkin, journey-coach | coach |
| J-11 Members | journey-money-forms, members-create, members-details, members-search, reload-keeps-lists, print-escaping | members, unit rules |
| J-12 Member profile | journey-member-actions, journey-money-forms, journey-coach, member-checkin-code, member-notes, photo-rule, live-reload-keeps-work | approvals, payments, coach, unit checkin-rule |
| J-13 Attendance | attendance-checkout, attendance-details, photo-rule, dashboard-checkin | attendance, timecards |
| J-14 Front desk | journey-desk-day, journey-money-forms, journey-sales, desk-details, desk-failures, kiosk-exits | timecards, reports |
| J-15 Calendar | journey-calendar, calendar-failures | calendar |
| J-16 Tasks | journey-tasks, tasks-save, tasks-operations-details, phone-gaps | gym-tasks, unit rules |
| J-17 Sales and products | journey-sales, phone-gaps | sales, unit rules |
| J-18 Payments | journey-money-forms, payment-methods, money-format, i18n-basics, phone-gaps | payments, unit receipt |
| J-19 Accounting and payroll | accounting-failures, reports-details, i18n-pages, phone-gaps | expenses, payroll, reports |
| J-20 Packages | journey-packages, packages-details, packages-failures, phone-gaps, gym-lists | tenancy |
| J-21 Communication | journey-communication, communication-failures | communications, unit rules |
| J-22 Staff | journey-staff, staff-page-failures, staff-profile-details, staff-profile-failures, staff-notes | staff, staff-notes |
| J-23 Time cards | journey-desk-day, attendance-checkout | timecards |
| J-24 Operations | operations-task, tasks-operations-details, desk-failures | tenancy, expenses |
| J-25 Notifications | notifications | notifications |
| J-26 Settings | journey-settings, settings-failures, payment-methods, gym-lists | gym-lists, gym-tasks |
| J-27 Search, language, theme, phone | journey-shell, search-accounts, role-pages, i18n-basics, i18n-pages | unit translations, translation-keys, role-pages |
| J-28 Log out | journey-account, sign-out | security (a stopped account's live stream) |

Across all journeys: cross-gym (one gym can never reach another), security (headers, live stream ticket, uploads), robustness (bad bodies, unknown paths), crash-screen, load-failures.

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
| `gem-backend/src/controllers/coach.controller.js` | 400 | [x] | [ ] |
| `gem-backend/src/controllers/communication.controller.js` | 208 | [x] | [ ] |
| `gem-backend/src/controllers/equipment.controller.js` | 77 | [x] | [ ] |
| `gem-backend/src/controllers/expense.controller.js` | 200 | [x] | [ ] |
| `gem-backend/src/controllers/gym.controller.js` | 131 | [x] | [ ] |
| `gem-backend/src/controllers/member.controller.js` | 472 | [x] | [ ] |
| `gem-backend/src/controllers/notification.controller.js` | 60 | [x] | [ ] |
| `gem-backend/src/controllers/package.controller.js` | 87 | [x] | [ ] |
| `gem-backend/src/controllers/payAdjustment.controller.js` | 251 | [x] | [ ] |
| `gem-backend/src/controllers/payment.controller.js` | 208 | [x] | [ ] |
| `gem-backend/src/controllers/payroll.controller.js` | 275 | [x] | [ ] |
| `gem-backend/src/controllers/product.controller.js` | 144 | [x] | [ ] |
| `gem-backend/src/controllers/report.controller.js` | 200 | [x] | [ ] |
| `gem-backend/src/controllers/sale.controller.js` | 151 | [x] | [ ] |
| `gem-backend/src/controllers/staff.controller.js` | 745 | [x] | [ ] |
| `gem-backend/src/controllers/task.controller.js` | 370 | [x] | [ ] |
| `gem-backend/src/controllers/timecard.controller.js` | 737 | [x] | [ ] |
| `gem-backend/src/controllers/upload.controller.js` | 26 | [x] | [ ] |

### Backend: utilities (23 files, 1,641 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/utils/activityLog.js` | 73 | [x] | [ ] |
| `gem-backend/src/utils/assignees.js` | 21 | [x] | [ ] |
| `gem-backend/src/utils/cloudinary.js` | 9 | [x] | [ ] |
| `gem-backend/src/utils/dates.js` | 17 | [x] | [ ] |
| `gem-backend/src/utils/emailGuard.js` | 43 | [x] | [ ] |
| `gem-backend/src/utils/emailLayout.js` | 203 | [x] | [ ] |
| `gem-backend/src/utils/gymSetup.js` | 54 | [x] | [ ] |
| `gem-backend/src/utils/hierarchy.js` | 138 | [x] | [ ] |
| `gem-backend/src/utils/liveHub.js` | 39 | [x] | [ ] |
| `gem-backend/src/utils/memberEmail.js` | 195 | [x] | [ ] |
| `gem-backend/src/utils/membership.js` | 29 | [x] | [ ] |
| `gem-backend/src/utils/messaging.js` | 183 | [x] | [ ] |
| `gem-backend/src/utils/money.js` | 40 | [x] | [ ] |
| `gem-backend/src/utils/notificationScope.js` | 45 | [x] | [ ] |
| `gem-backend/src/utils/paymentMethod.js` | 13 | [x] | [ ] |
| `gem-backend/src/utils/phone.js` | 38 | [x] | [ ] |
| `gem-backend/src/utils/prisma.js` | 7 | [x] | [ ] |
| `gem-backend/src/utils/receiptPdf.js` | 135 | [x] | [ ] |
| `gem-backend/src/utils/scheduleAlert.js` | 106 | [x] | [ ] |
| `gem-backend/src/utils/sendEmail.js` | 31 | [x] | [ ] |
| `gem-backend/src/utils/sms.js` | 71 | [x] | [ ] |
| `gem-backend/src/utils/taskEmail.js` | 94 | [x] | [ ] |
| `gem-backend/src/utils/welcomeEmail.js` | 57 | [x] | [ ] |

### Backend: background jobs (6 files, 502 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-backend/src/jobs/autoPayroll.js` | 115 | [x] | [ ] |
| `gem-backend/src/jobs/freezeFees.js` | 53 | [x] | [ ] |
| `gem-backend/src/jobs/logRetention.js` | 24 | [x] | [ ] |
| `gem-backend/src/jobs/payrollReminders.js` | 188 | [x] | [ ] |
| `gem-backend/src/jobs/scheduledMessages.js` | 34 | [x] | [ ] |
| `gem-backend/src/jobs/taskReminders.js` | 88 | [x] | [ ] |

### Frontend: configuration and public files (10 files, 159 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/.gitignore` | 24 | [x] | [ ] |
| `gem-frontend/README.md` | 16 | [x] | [ ] |
| `gem-frontend/eslint.config.js` | 29 | [x] | [ ] |
| `gem-frontend/index.html` | 16 | [x] | [ ] |
| `gem-frontend/package.json` | 44 | [x] | [ ] |
| `gem-frontend/postcss.config.js` | 6 | [x] | [ ] |
| `gem-frontend/public/vite.svg` | 0 | [x] | [ ] |
| `gem-frontend/tailwind.config.js` | 11 | [x] | [ ] |
| `gem-frontend/vercel.json` | 5 | [x] | [ ] |
| `gem-frontend/vite.config.js` | 8 | [x] | [ ] |

### Frontend: entry, app shell and styles (14 files, 1,388 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/App.css` | 42 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/App.jsx` | 300 | [x] | [ ] |
| `gem-frontend/src/app/App.jsx` | 5 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/assets/react.svg` | 0 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/contexts/LanguageContext.jsx` | 61 | [x] | [ ] |
| `gem-frontend/src/index.css` | 164 | [x] | [ ] |
| `gem-frontend/src/layouts/AppLayout.jsx` | 77 | [x] | [ ] |
| `gem-frontend/src/main.jsx` | 43 | [x] | [ ] |
| `gem-frontend/src/routes/AppRoutes.jsx` | 65 | [x] | [ ] |
| `gem-frontend/src/routes/ProtectedRoute.jsx` | 28 | [x] | [ ] |
| `gem-frontend/src/routes/routeConfig.jsx` | 42 | [x] | [ ] |
| `gem-frontend/src/styles/calendar.css` | 78 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/styles/globals.css` | 316 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/styles/theme.js` | 167 | deleted (8b95823) | deleted (8b95823) |

### Frontend: services (API calls) (24 files, 528 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/services/api.js` | 80 | [x] | [ ] |
| `gem-frontend/src/services/approvals.service.js` | 10 | [x] | [ ] |
| `gem-frontend/src/services/attendance.service.js` | 14 | [x] | [ ] |
| `gem-frontend/src/services/auth.service.js` | 39 | [x] | [ ] |
| `gem-frontend/src/services/calendar.service.js` | 17 | [x] | [ ] |
| `gem-frontend/src/services/coach.service.js` | 13 | [x] | [ ] |
| `gem-frontend/src/services/communications.service.js` | 33 | [x] | [ ] |
| `gem-frontend/src/services/equipment.service.js` | 10 | [x] | [ ] |
| `gem-frontend/src/services/expenses.service.js` | 20 | [x] | [ ] |
| `gem-frontend/src/services/gym.service.js` | 16 | [x] | [ ] |
| `gem-frontend/src/services/logs.service.js` | 4 | [x] | [ ] |
| `gem-frontend/src/services/members.service.js` | 19 | [x] | [ ] |
| `gem-frontend/src/services/notifications.service.js` | 16 | [x] | [ ] |
| `gem-frontend/src/services/packages.service.js` | 13 | [x] | [ ] |
| `gem-frontend/src/services/payAdjustments.service.js` | 12 | [x] | [ ] |
| `gem-frontend/src/services/payments.service.js` | 30 | [x] | [ ] |
| `gem-frontend/src/services/payroll.service.js` | 11 | [x] | [ ] |
| `gem-frontend/src/services/products.service.js` | 17 | [x] | [ ] |
| `gem-frontend/src/services/reports.service.js` | 6 | [x] | [ ] |
| `gem-frontend/src/services/sales.service.js` | 11 | [x] | [ ] |
| `gem-frontend/src/services/staff.service.js` | 37 | [x] | [ ] |
| `gem-frontend/src/services/tasks.service.js` | 13 | [x] | [ ] |
| `gem-frontend/src/services/timecards.service.js` | 37 | [x] | [ ] |
| `gem-frontend/src/services/upload.service.js` | 50 | [x] | [ ] |

### Frontend: hooks (4 files, 180 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/hooks/useGymSettings.js` | 70 | [x] | [ ] |
| `gem-frontend/src/hooks/useIsMobile.js` | 16 | [x] | [ ] |
| `gem-frontend/src/hooks/useLiveRefresh.js` | 33 | [x] | [ ] |
| `gem-frontend/src/hooks/useSetupStatus.js` | 61 | [x] | [ ] |

### Frontend: utilities (32 files, 1,578 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/utils/address.js` | 33 | [x] | [ ] |
| `gem-frontend/src/utils/attention.js` | 79 | [x] | [ ] |
| `gem-frontend/src/utils/auth.js` | 227 | [x] | [ ] |
| `gem-frontend/src/utils/checkin.js` | 69 | [x] | [ ] |
| `gem-frontend/src/utils/coaching.js` | 146 | [x] | [ ] |
| `gem-frontend/src/utils/contact.js` | 26 | [x] | [ ] |
| `gem-frontend/src/utils/countries.js` | 51 | [x] | [ ] |
| `gem-frontend/src/utils/currency.js` | 48 | [x] | [ ] |
| `gem-frontend/src/utils/date.js` | 62 | [x] | [ ] |
| `gem-frontend/src/utils/departments.js` | 55 | [x] | [ ] |
| `gem-frontend/src/utils/events.js` | 20 | [x] | [ ] |
| `gem-frontend/src/utils/formErrors.js` | 24 | [x] | [ ] |
| `gem-frontend/src/utils/gymAddress.js` | 16 | [x] | [ ] |
| `gem-frontend/src/utils/gymCache.js` | 38 | [x] | [ ] |
| `gem-frontend/src/utils/hierarchy.js` | 56 | [x] | [ ] |
| `gem-frontend/src/utils/live.js` | 58 | [x] | [ ] |
| `gem-frontend/src/utils/loadAll.js` | 9 | [x] | [ ] |
| `gem-frontend/src/utils/number.js` | 5 | [x] | [ ] |
| `gem-frontend/src/utils/numberGuard.js` | 43 | [x] | [ ] |
| `gem-frontend/src/utils/packages.js` | 10 | [x] | [ ] |
| `gem-frontend/src/utils/paymentDescription.js` | 21 | [x] | [ ] |
| `gem-frontend/src/utils/paymentMethods.js` | 36 | [x] | [ ] |
| `gem-frontend/src/utils/paystubPdf.js` | 177 | [x] | [ ] |
| `gem-frontend/src/utils/productCode.js` | 12 | [x] | [ ] |
| `gem-frontend/src/utils/productPrice.js` | 29 | [x] | [ ] |
| `gem-frontend/src/utils/receipt.js` | 78 | [x] | [ ] |
| `gem-frontend/src/utils/revenue.js` | 23 | [x] | [ ] |
| `gem-frontend/src/utils/rolePages.js` | 42 | [x] | [ ] |
| `gem-frontend/src/utils/sessionPhoto.js` | 25 | [x] | [ ] |
| `gem-frontend/src/utils/smsCount.js` | 24 | [x] | [ ] |
| `gem-frontend/src/utils/taskCategories.js` | 25 | [x] | [ ] |
| `gem-frontend/src/utils/useIsMobile.js` | 11 | [x] | [ ] |

### Frontend: translations (1 files, 4,229 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/i18n/translations.js` | 4229 | [x] | [ ] |

### Frontend: data (mock and constants) (6 files, 463 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/data/mockCommunications.js` | 42 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/data/mockData.js` | 211 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/data/mockGym.js` | 72 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/data/mockMembers.js` | 93 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/data/mockPackages.js` | 30 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/data/mockProducts.js` | 15 | deleted (8b95823) | deleted (8b95823) |

### Frontend: shared UI components (26 files, 1,627 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/components/ui/Avatar.jsx` | 36 | [x] | [ ] |
| `gem-frontend/src/components/ui/CodeInput.jsx` | 35 | [x] | [ ] |
| `gem-frontend/src/components/ui/ConfirmModal.jsx` | 77 | [x] | [ ] |
| `gem-frontend/src/components/ui/DayStepper.jsx` | 39 | [x] | [ ] |
| `gem-frontend/src/components/ui/EmptyState.jsx` | 45 | [x] | [ ] |
| `gem-frontend/src/components/ui/GemButton.jsx` | 5 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/ui/GemCard.jsx` | 11 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/ui/GemDialog.jsx` | 45 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/ui/GemInput.jsx` | 75 | [x] | [ ] |
| `gem-frontend/src/components/ui/GemSelect.jsx` | 107 | [x] | [ ] |
| `gem-frontend/src/components/ui/GemTextField.jsx` | 40 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/ui/ManagerAuthModal.jsx` | 241 | [x] | [ ] |
| `gem-frontend/src/components/ui/MemberStatusTags.jsx` | 29 | [x] | [ ] |
| `gem-frontend/src/components/ui/Modal.jsx` | 114 | [x] | [ ] |
| `gem-frontend/src/components/ui/PageHeader.jsx` | 45 | [x] | [ ] |
| `gem-frontend/src/components/ui/PriceTag.jsx` | 15 | [x] | [ ] |
| `gem-frontend/src/components/ui/RevenueSplit.jsx` | 15 | [x] | [ ] |
| `gem-frontend/src/components/ui/RowMenu.jsx` | 119 | [x] | [ ] |
| `gem-frontend/src/components/ui/Sparkline.jsx` | 21 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/ui/StatusBadge.jsx` | 63 | [x] | [ ] |
| `gem-frontend/src/components/ui/TimeInput.jsx` | 175 | [x] | [ ] |
| `gem-frontend/src/components/ui/TrackPill.jsx` | 43 | [x] | [ ] |
| `gem-frontend/src/components/ui/TrendChart.jsx` | 94 | [x] | [ ] |
| `gem-frontend/src/components/ui/VisitKindBadge.jsx` | 19 | [x] | [ ] |
| `gem-frontend/src/components/ui/VisitorCodeModal.jsx` | 83 | [x] | [ ] |
| `gem-frontend/src/components/ui/WeekBars.jsx` | 36 | [x] | [ ] |

### Frontend: components (42 files, 8,086 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/components/AddressInputs.jsx` | 48 | [x] | [ ] |
| `gem-frontend/src/components/BottomSheet.jsx` | 94 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/BottomTabBar.jsx` | 161 | [x] | [ ] |
| `gem-frontend/src/components/BusyWarning.jsx` | 44 | [x] | [ ] |
| `gem-frontend/src/components/CheckinStats.jsx` | 328 | [x] | [ ] |
| `gem-frontend/src/components/CoachClientsPanel.jsx` | 124 | [x] | [ ] |
| `gem-frontend/src/components/CollectPaymentStep.jsx` | 108 | [x] | [ ] |
| `gem-frontend/src/components/EodReport.jsx` | 383 | [x] | [ ] |
| `gem-frontend/src/components/FAB.jsx` | 37 | [x] | [ ] |
| `gem-frontend/src/components/FillInPreview.jsx` | 28 | [x] | [ ] |
| `gem-frontend/src/components/FrontDeskTour.jsx` | 228 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/GlobalSearch.jsx` | 299 | [x] | [ ] |
| `gem-frontend/src/components/GoalsModal.jsx` | 160 | [x] | [ ] |
| `gem-frontend/src/components/Header.jsx` | 462 | [x] | [ ] |
| `gem-frontend/src/components/LangToggle.jsx` | 110 | [x] | [ ] |
| `gem-frontend/src/components/LogProgressModal.jsx` | 204 | [x] | [ ] |
| `gem-frontend/src/components/MemberCoachRow.jsx` | 121 | [x] | [ ] |
| `gem-frontend/src/components/MemberProgressTab.jsx` | 480 | [x] | [ ] |
| `gem-frontend/src/components/NavDrawer.jsx` | 249 | [x] | [ ] |
| `gem-frontend/src/components/NextDayHint.jsx` | 44 | [x] | [ ] |
| `gem-frontend/src/components/NotificationBell.jsx` | 153 | [x] | [ ] |
| `gem-frontend/src/components/OpenShiftsWarning.jsx` | 57 | [x] | [ ] |
| `gem-frontend/src/components/ScrollToTop.jsx` | 12 | [x] | [ ] |
| `gem-frontend/src/components/SendMessageModal.jsx` | 160 | [x] | [ ] |
| `gem-frontend/src/components/Sidebar.jsx` | 401 | [x] | [ ] |
| `gem-frontend/src/components/Skeleton.jsx` | 54 | [x] | [ ] |
| `gem-frontend/src/components/TaskAssigneeField.jsx` | 64 | [x] | [ ] |
| `gem-frontend/src/components/dashboard/GymCalendar.jsx` | 674 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/dashboard/KpiCard.jsx` | 121 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/dashboard/NotificationsPanel.jsx` | 39 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/dashboard/TasksTable.jsx` | 583 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/AddMemberVisitorPage.jsx` | 593 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/AddPackageDialog.jsx` | 149 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/CommunicationsTable.jsx` | 138 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/CreateCommunicationPanel.jsx` | 295 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/MembersTable.jsx` | 109 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/members/PackagesTable.jsx` | 149 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/navigation/NavItem.jsx` | 51 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/navigation/Sidebar.jsx` | 63 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/navigation/Topbar.jsx` | 23 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/products/AddCategoryDialog.jsx` | 121 | deleted (8b95823) | deleted (8b95823) |
| `gem-frontend/src/components/products/AddProductDialog.jsx` | 365 | deleted (8b95823) | deleted (8b95823) |

### Frontend: pages (25 files, 28,970 lines)

| File | Lines | Pass 1 | Pass 2 |
| :- | -: | :-: | :-: |
| `gem-frontend/src/pages/AccountingPage.jsx` | 2199 | [x] | [ ] |
| `gem-frontend/src/pages/AttendancePage.jsx` | 1397 | [x] | [ ] |
| `gem-frontend/src/pages/CalendarPage.jsx` | 798 | [x] | [ ] |
| `gem-frontend/src/pages/CoachDashboard.jsx` | 376 | [x] | [ ] |
| `gem-frontend/src/pages/CommunicationPage.jsx` | 710 | [x] | [ ] |
| `gem-frontend/src/pages/DashboardPage.jsx` | 1624 | [x] | [ ] |
| `gem-frontend/src/pages/ForgotPasswordPage.jsx` | 184 | [x] | [ ] |
| `gem-frontend/src/pages/FrontDeskPage.jsx` | 2409 | [x] | [ ] |
| `gem-frontend/src/pages/GymCodePage.jsx` | 327 | [x] | [ ] |
| `gem-frontend/src/pages/GymLoginPage.jsx` | 712 | [x] | [ ] |
| `gem-frontend/src/pages/LandingPage.jsx` | 379 | [x] | [ ] |
| `gem-frontend/src/pages/LogsPage.jsx` | 299 | [x] | [ ] |
| `gem-frontend/src/pages/MemberProfilePage.jsx` | 3767 | [x] | [ ] |
| `gem-frontend/src/pages/MembersPage.jsx` | 2532 | [x] | [ ] |
| `gem-frontend/src/pages/NotificationsPage.jsx` | 305 | [x] | [ ] |
| `gem-frontend/src/pages/OperationsPage.jsx` | 704 | [x] | [ ] |
| `gem-frontend/src/pages/PackagesPage.jsx` | 696 | [x] | [ ] |
| `gem-frontend/src/pages/PaymentsPage.jsx` | 763 | [x] | [ ] |
| `gem-frontend/src/pages/ResetPasswordPage.jsx` | 245 | [x] | [ ] |
| `gem-frontend/src/pages/SalesPage.jsx` | 901 | [x] | [ ] |
| `gem-frontend/src/pages/SettingsPage.jsx` | 1389 | [x] | [ ] |
| `gem-frontend/src/pages/SignUpPage.jsx` | 1026 | [x] | [ ] |
| `gem-frontend/src/pages/StaffPage.jsx` | 908 | [x] | [ ] |
| `gem-frontend/src/pages/StaffProfilePage.jsx` | 3612 | [x] | [ ] |
| `gem-frontend/src/pages/TasksPage.jsx` | 708 | [x] | [ ] |

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
| F-001 | Critical | Deployment, security | `gem-backend/package.json:7` | `npm start` runs `prisma db push && node prisma/seed.js` before the server. On Railway (no other start command in the repo) every deploy pushes the schema straight to the production database and seeds the demo gym "elite" with the general manager password `admin123` and the manager code `9721`. | Start with `node src/index.js` only; apply schema changes deliberately (migrations, see F-008); seed only in development. Deployment config, so the owner decides. | Fixed (ee5155c, 1985258) by D-1: migrations run before the server, no seed on start |
| F-002 | High | Security, privacy | `gem-frontend/src/pages/GymLoginPage.jsx:24-26`, `gem-backend/prisma/seed.js` | The demo accounts' passwords are written into the frontend bundle, so anyone can sign in to the demo gym as its general manager. The seeded members have real-looking Gmail addresses (`armand.k@gmail.com` and others) and the staff use `@elite.cm`. On a live server, using the demo can send real receipts, check-in codes and broadcasts to whoever owns those addresses. | Keep the demo on a separate demo deployment, or make demo data use `@example.com` addresses and block email and SMS for the demo gym. Feature and data change, so the owner decides. | Fixed (1985258, ee5155c) by D-2 |
| F-003 | High | Security | `gem-backend/src/controllers/auth.controller.js` (login, register, forgot-password, set-first-password) and other endpoints that send email or are expensive | Rate limiting exists only on the email lookup and the 4-digit code checks. Password login, sign-up, forgot password (sends email), first-password setup, message sending and uploads have none. | Add per-IP and per-account limits (with `trust proxy` for Railway) and tests. | Fixed for sign-in, reset, registration and manager codes (6fe825d); messages and uploads in Phase 3 |
| F-004 | Medium | Security | `gem-backend/src/app.js:41` | CORS accepts any origin that contains "localhost", for example `https://localhost.attacker.example`. Impact is limited because sign-in uses a bearer token, not cookies. | Allow exact local origins in development only, plus the configured production origins. | Fixed (2e7672d) |
| F-005 | Medium | Security | `gem-backend/src/app.js`, `gem-frontend/vercel.json` | No security headers: no CSP, HSTS, X-Content-Type-Options, frame-ancestors or Referrer-Policy, on the API or on the Vercel site. | Add headers to the API (for example `helmet`). Headers for the Vercel site are deployment config, so that part goes to the owner. | Fixed for the API (6577a7f); the site's own headers are deployment config (D-45) |
| F-006 | Medium | Security | `gem-backend/src/routes/live.routes.js:8`, `gem-frontend/src/utils/live.js` | The live-updates stream sends the sign-in token in the URL (`/api/live?token=...`), where it can end up in proxy and server logs. | Exchange the token for a short-lived, single-purpose stream ticket. | Fixed (6577a7f) |
| F-007 | Medium | Security | `gem-frontend/src/utils/auth.js` | The token is kept in `localStorage` (readable by any script that runs on the page) and is not revoked on the server at logout; it stays valid until it expires (8 h). | Server-side revocation (token version on the staff record) and a strict CSP; moving to httpOnly cookies is a larger design change. | Fixed (c41eea1) by D-3; the content policy half is D-45 (2a0978c) |
| F-008 | High | Database | `gem-backend/prisma/migrations/` | The last migration is from May 2026; the schema has changed many times since through `db push`. The migrations cannot rebuild the current database from scratch, and one adds `Task.dueTime`, which the schema no longer has (D-18). | Create a baseline migration from the current schema and use `prisma migrate deploy` in production. Schema and deployment, so the owner decides. | Fixed (ee5155c) by D-4 and D-18 |
| F-009 | Medium | Configuration | `gem-backend/src/index.js`, no `.env.example` | Required variables (`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `FRONTEND_URL`) are not checked at startup. A missing `FRONTEND_URL` makes every email link point to `http://localhost:5173`. There is no `.env.example` for either app. | Validate at startup with clear messages; add `.env.example` files with names and safe placeholders only. | Fixed (bdc92a3): stops without DATABASE_URL or JWT_SECRET, warns about the rest; .env.example in both apps |
| F-010 | High | Data safety | `gem-backend/delete-all.js` | A script that deletes every record of every gym, with no confirmation and no check of which database `DATABASE_URL` points to. It also misses newer tables: pay adjustments still point at staff, so it stops partway on that foreign key and leaves a half-deleted database (approval requests would simply remain). | Delete it, or guard it (refuse unless the database is local and a confirmation flag is given). Removing a file, so the owner decides. | Fixed (1985258, 8b99e03) by D-5 |
| F-011 | Medium | Uploads | `gem-backend/src/controllers/upload.controller.js:6` | The Cloudinary folder comes straight from the query string, the file type is not checked on the server (only Cloudinary's image handling), and there is no rate limit. | Allow-list the folders, check the MIME type and size, limit the rate. | Fixed (ae39fe6) |
| F-012 | Low | Accessibility | `gem-frontend/index.html:6` | `maximum-scale=1.0` stops people zooming in on phones. | Remove it. User-visible, so the owner decides. | Fixed (f85c41b) by D-6 |
| F-013 | Low | Public pages | `gem-frontend/index.html` | No meta description or social sharing tags; the favicon is the default Vite logo; the title contains a long dash. | Add meta tags (no behaviour change); favicon and title wording go to the owner. | Partly fixed (99d8947): description, sharing tags, a hyphen in the title. The title's wording and the favicon are the owner's |
| F-014 | Low | Usability | `gem-frontend/src/main.jsx:17`, `gem-frontend/src/routes/AppRoutes.jsx:59` | If a screen crashes, the user sees the raw technical error. Unknown addresses silently send people to the home page; there is no "page not found". | A friendly error screen with a reload button, and a 404 page. User-visible, so the owner decides. | Fixed (f85c41b) by D-6 and D-49: a not-found page |
| F-015 | Low | Documentation | `CLAUDE.md` | Says React 18 (it is 19), describes `DemoTour.jsx` (deleted), and says "no CSS framework" while Tailwind and MUI are installed. No root README; `gem-frontend/README.md` is the Vite template. | Correct the docs; write a README in Phase 7. | Fixed: README written (68c0ab6); the stale CLAUDE.md lines corrected on 2026-10-25 (open question 2) |
| F-016 | Medium | Dead code | `gem-frontend/src`, `gem-frontend/package.json` | 34 files nothing imported (an older MUI-based interface, template leftovers, mock data with real-looking gmail addresses, two stylesheets never loaded) and 8 packages only they used. Tailwind is not dead: `index.css` imports it and its reset shapes every page. | Deleted after knip and an import scan of every live file; build and the 62-screen smoke test unchanged. | Fixed (8b95823) |
| F-017 | Medium | Quality | whole repo | No automated tests at all, no backend lint, no type-check. | Add Vitest (unit and API integration with a test database) and Playwright (end to end, Chromium, Firefox, WebKit, mobile, axe). | Fixed: Vitest unit and API suites on gem_test, Playwright on Chromium and Firefox (WebKit, real phones and axe still to come in Phases 4 to 6) |
| F-018 | Low | Secrets | Twilio account | The Twilio Auth Token was pasted into a chat on 2026-10-19 (it is now only in the ignored `gem-backend/.env`). | Regenerate the token in the Twilio Console before using it. Owner action. | Needs decision: owner action (D-7), regenerate the token in the Twilio Console |
| F-019 | Low | Leftover | `gem-backend/src/app.js:50` | `app.use('/uploads', express.static('uploads'))` serves an empty local folder; uploads go to Cloudinary. | Remove once confirmed unused. | Fixed (6577a7f) |
| F-020 | Info | Security | git history (41 commits) | Not scanned for secrets yet. | Scan with gitleaks in Phase 3. | Verified: no secret in the tracked files or in any commit beyond F-022 (masked scan, Phase 3) |
| F-021 | Info | Product gap | auth | There is no email verification for a new gym owner or for a changed email address. | Product decision. | Fixed (ca815ca) by D-8 |
| F-022 | High | Secrets | `Documents/login.txt` (git history, commit `2c4881c`) | A file with a sign-in (email, gym code, password) was tracked from the first commit. | Untracked and ignored in `f194d32`. It is still in the history: change that password (owner), and decide whether to rewrite history (needs a force-push, which this audit never does). | Fixed (file); history needs decision |
| F-023 | High | Dependencies | `gem-frontend/package-lock.json`, `gem-backend/package-lock.json` | 24 frontend and 17 backend known vulnerabilities (see baseline), including a critical one in `proxy-addr` and a high one in `multer`. | `npm audit fix` in both apps (patch and minor only) in Phase 3, then build and full tests. `nodemon`'s suggested fix is a major change (D-11). | Fixed (d73e5e7); D-11 needs nothing now |
| F-024 | Medium | Performance | `gem-frontend/src/routes/routeConfig.jsx` | The whole app is one 2.6 MB JavaScript file (706 kB gzip); every page loads every other page's code. | Lazy-load pages by route (`React.lazy`), Phase 7. | Fixed (b509a23): a 612 kB shared start (202 kB compressed, from 706 kB), pages fetched as opened, the payslip PDF maker only on download |
| F-025 | Medium | Quality | 48 frontend files | Lint fails with 198 errors (baseline). Some are real bugs: 4 objects with a duplicated key (one value silently wins), 30 empty `catch` blocks that swallow errors, 36 components defined inside other components (remounted on every render, which can drop typed input). | Fix by hand during Phase 2, file by file, without disabling rules. | Fixed in part: 198 problems to 48 (step 10); the rest is F-161 |
| F-026 | Low | Dependencies | `gem-backend/node_modules` | Three extraneous packages (`pdf-to-img`, `pdfjs-dist`, `@napi-rs/canvas`) are installed but not declared. | `npm prune` (local only, no repo change). | Fixed (pruned with b2370c2; `npm ls` shows none) |
| F-027 | Low | Portability | repository | Files mix LF and CRLF line endings (git warns on every commit); there is no `.gitattributes`. | Add `.gitattributes` (`* text=auto`), Phase 5. | Fixed (b00b7d3) |
| F-028 | Medium | CI | `.github/workflows/playwright.yml` | The workflow the owner added runs `npm ci` and the sample tests on pushes to `main`. GEM's real end-to-end tests will need a PostgreSQL service, both apps installed and started, and secrets kept out. | Rewrite the workflow once the suite exists. CI is infrastructure, so the owner decides. | Fixed (c41cbc9) by D-12; the workflow has not run on GitHub yet (nothing is pushed) |
| F-029 | High | Security | `gem-backend/src/controllers/auth.controller.js:226`, `app.js` | The sign-in lookup limit (30 per 10 min) is keyed by `req.ip`, and Express is not told it sits behind Railway's proxy, so every visitor shares one bucket: 30 lookups lock the sign-in lookup for every gym. | Read the client address through the proxy (`trust proxy`, D-14) and key limits by address plus gym. | Fixed (6fe825d) |
| F-030 | High | Security | `auth.controller.js:354-395` | `POST /api/auth/verify-manager` has no attempt limit: anyone at a signed-in screen can try all 10,000 four-digit codes (or guess the password, which also unlocks exiting the kiosk). | Count wrong tries per account and lock for 15 minutes after 5, like first sign-in. | Fixed (6fe825d) |
| F-031 | Medium | Bug | `app.js`, most controllers | Express 5 leaves `req.body` undefined when a request has no JSON body, so handlers that read `req.body.x` throw and answer 500 instead of 400. | Default `req.body` to `{}` once in `app.js`. | Fixed (2e7672d) |
| F-032 | Low | Bug | `app.js:79-82` | The error handler answers 500 and logs a stack trace for client mistakes too: malformed JSON (should be 400), a body over 5 MB (413), and a refused CORS origin. | Keep the client error's own status with a plain message. | Fixed (2e7672d) |
| F-033 | Low | Bug | `auth.controller.js:128,232,274` | Sign-in, the email lookup and first-password setup look the gym code up with exact case; registration stores it in lower case and the public lookup ignores case. | Match the code without regard to case everywhere. | Fixed (6fe825d) |
| F-034 | Low | Bug | `auth.controller.js:429` | The reset email goes to the address as typed (stray spaces included) instead of the account's stored address. | Send to `staff.email`. | Fixed (6fe825d) |
| F-035 | Low | Security | `auth.controller.js:24` | Registration accepts a 1-character password (every other password path needs 6) and any characters in the gym code (`check-code` allows only a-z, 0-9 and hyphens, and codes appear in URLs). | Apply the same two rules on registration. | Fixed (6fe825d) |
| F-036 | Low | Security | `auth.controller.js:420-423`, `staff.controller.js` | Password reset tokens are stored as written, so a database leak exposes links that work for 15 minutes. | Store a SHA-256 of the token; compare hashes. | Fixed (6fe825d) |
| F-037 | Medium | Data | `gem-backend/prisma/schema.prisma` | Money is stored as floating point (`Float`: balances, prices, payments, salaries). It is exact for whole francs, but GEM supports currencies with cents (NGN, GHS, USD...), where floats round. | Store whole minor units (`Int`) or `Decimal`. Schema change. | Won't fix for now (D-15): whole francs are exact; revisit before a gym with cents |
| F-038 | Medium | Performance | `schema.prisma` | Most tables have no index on `gymId` (Payment, Sale, SaleItem, Attendance, Task, Expense, TimeCard, CalendarEvent, Notification, Package, EquipmentIssue), so every list reads the whole table as gyms grow. | Add `@@index([gymId, <date>])` to each. Schema change, but additive. | Fixed (ee5155c) by D-16 |
| F-039 | High | Bug | `approval.controller.js:16-49,194-249` | Approving, declining and cancelling a request check "still pending" and then act, so two managers at once apply a change twice. No action checks the member's state: freezing a frozen member compounds the dates, and "unfreeze" reactivates a cancelled member (reachable when a desk request is approved after a manager already acted directly). | Claim the request atomically; refuse actions that do not fit the member's state. | Fixed (ec355dd) |
| F-040 | Medium | Bug | `approval.controller.js:18-27` | Days to extend or freeze are not checked: negative, fractional or huge values shorten a membership or produce an invalid date (500). A freeze start date is not checked either. | Whole days between 1 and 3,650; a real date. | Fixed (ec355dd) |
| F-041 | Medium | Product | `approval.controller.js:19` | Extending a membership that already ended counts from the old end date, which can still be in the past, while setting the status to active. | Decide whether an extension of an ended membership counts from today. | Fixed (a50fe40) by D-17 |
| F-042 | High | Bug | `payment.controller.js:109,188`, `approval.controller.js:79`, `jobs/freezeFees.js:36` | A member's balance is read, changed in JavaScript and written back. Two desks taking payments for one member at once (or a payment during the freeze-fee job) lose one of the updates. | Change the balance in one SQL statement (`GREATEST(0, balance - x)`). | Fixed (8d60de4, ee6805d) |
| F-043 | Medium | Bug | `attendance.controller.js:179-223` | Two check-ins for one member at the same moment (a double click, two desks) both pass the 30-minute guard and both spend a pass. | Lock the member row for the check-in. | Fixed (63ad2d7) |
| F-044 | High | Security | `attendance.controller.js:237-243` | `PATCH /api/attendance/:id/checkout` updates by id with no gym check: one gym's desk can check out another gym's visit. An unknown id answers 500. | Find within the gym first; 404 otherwise. | Fixed (719f080) |
| F-045 | Medium | Security | `attendance.controller.js:42` | The attendance list sends every visiting member's 4-digit check-in code and balance to every role, including the front desk (which the screens deliberately never show a code) and trainers (who are not shown money). | Leave the code out; leave the balance to roles that handle money. | Fixed: the attendance list (63ad2d7); the members list is F-078 |
| F-046 | Medium | Security | `attendance.controller.js:72-98` | Member check-in by code also accepts a staff code and answers with that employee's name, with no attempt limit: the desk can find every staff code by trying them all. | Limit wrong codes per account, as `staff.controller` does for the desk sign-in. | Fixed (63ad2d7) |
| F-047 | High | Security | `calendar.controller.js:180-192` | Creating a repeating calendar entry with an unreadable date or end date loops forever (`current > until` is never true for an invalid date), so any staff account can stop the API for every gym. A far-off end date creates thousands of entries in one request. | Validate both dates; cap a series at one year. | Fixed (fcd1b52) |
| F-048 | Medium | Security | `calendar.controller.js:273-303` | Updating an event passes the request body to the database except for a few named fields (mass assignment): any other column can be set, and an unknown field answers 500. | List the fields an update may change. | Fixed (fcd1b52) |
| F-049 | Low | Bug | `calendar.controller.js:287-297` | An event update without `staffIds` clears the event's staff and deletes their invites. To check: whether the calendar page always sends the list. | Keep the staff when the list is not sent. | Fixed (fcd1b52) |
| F-050 | Low | Quality | backend, 37 places | `.catch(() => {})` swallows failures of notifications, emails and tasks without a trace, so a broken side effect goes unnoticed in production. | One helper that logs what failed. | Fixed (0ad220f) |
| F-051 | Low | Performance | `attendance.controller.js:30-49`, `calendar.controller.js:46-68` | Without a date, the attendance and calendar lists return every row the gym has ever made. | Check the callers; give each a default range or a limit. | Partly fixed (90162ea): Daily Overview, the one screen that asked for every check-in, asks for today's. Without a date the endpoints still answer everything, which the calendar pages and the desk's programme panel use to page to any day |
| F-052 | Low | i18n | `attendance.controller.js:132,164`, `activityLog.controller.js:5` | Server messages format dates in the server's locale and time zone, and the activity log filters days by server time (UTC on Railway, an hour off for Cameroon). | Format with the gym's language and the caller's time zone. | Partly fixed (afa39a4): the activity log's days and the check-in refusals. Times in time-card notes ("set by hand to 08:00") and the rostered-day check still use the server's zone (UTC on Railway), since those requests do not carry the reader's; send `tz` with the time card requests and use it there |
| F-053 | Low | Bug | `approval.controller.js:55,93,103`, `coach.controller.js:240-245`, `payment.controller.js:41` | A request that leaves out the member answers 404 or 500 instead of saying what is missing. (First logged as High: Prisma drops an `undefined` filter, so `findFirst({ id: undefined, gymId })` does find the gym's first member; tests showed the payment then fails on create, so nothing is changed, and the `OR` form matches nobody.) | Refuse a missing id with 400 before looking anything up. | Fixed (ec355dd, 0ad220f) |
| F-054 | Low | Bug | `communication.controller.js:108-113,171-186` | Two retries at once, or an edit of a scheduled message while the scheduler picks it up, can send the same message twice. | Claim the message with a conditional update before sending. | Fixed (6a853d3) |
| F-055 | High | Security | `equipment.controller.js:56-75` | Reporting and updating an equipment issue pass the request body to the database: an update can set `gymId` and move the issue into another gym, and any column can be set. A missing equipment name or description answers 500. | List the fields; validate the required ones. | Fixed (719f080) |
| F-056 | Medium | Bug | `member.controller.js:36-49` | Member codes are `GEM-` plus a count of every member on the platform: each new member counts the whole table, two gyms adding members at once get the same code (the unique index then answers 500), and after 20 collisions a taken code is used anyway. | Try the next code when the database refuses a duplicate. | Fixed (8d60de4) |
| F-057 | High | Security | `member.controller.js:337-392`, `routes/member.routes.js:11` | The front desk may PATCH a member's `balance`, `status`, `startDate`, `endDate`, `passesRemaining` and `dayPasses` directly. Renewals and pass purchases are worked out in the browser and saved this way, so anyone at the desk can wipe a debt without a payment, or unfreeze and extend a membership without the manager approval the app otherwise requires. | Move renewals and pass purchases to server actions that take the payment and apply the change in one transaction; keep direct edits of these fields to management. Touches payments. | Fixed (a636e22) by D-20 |
| F-058 | Medium | Security | `payment.controller.js:180-206`, `routes/payment.routes.js:11` | The front desk may delete any payment, of any age, by anyone (it exists to undo a payment when an action is cancelled). Deleting restores the debt for membership payments only. | Limit the desk to its own payments from the last few minutes; anything else to management. Touches payments. | Fixed (a9725bb) by D-21 |
| F-059 | Medium | Bug | `staff.controller.js:60-62,183,387,639`, `auth.controller.js:18-20` | Staff 4-digit codes are drawn at random without checking the gym (staff create, code reveal, reactivation, gym owner). Two people can share a code, and the desk's sign-in by code then signs in whoever is found first. `uniqueStaffCode()` already exists for regeneration. | Use `uniqueStaffCode()` everywhere a code is issued, with `crypto.randomInt`. | Fixed (4258be0) |
| F-060 | Medium | Security | `staff.controller.js:477-519`, `routes/staff.routes.js:21` | Only the owner may (de)activate staff through PATCH, but `DELETE /api/staff/:id` (management) deactivates anyone below the caller, so a manager can do it anyway. Nothing in the app calls it. | Hold DELETE to the owner, like PATCH. | Fixed (4258be0) |
| F-061 | Medium | Privacy | `staff.controller.js:73-96,98-150` | The staff list and profile send `photoId` (the scan of an employee's identity document) to every colleague, while pay and notes are kept to those who outrank them. | Treat the ID scan like pay: self or someone senior. | Fixed (4258be0) |
| F-062 | Low | Bug | `staff.controller.js:64-67` | The role map turns the label "Other" into `coach` (a fitness role). If a form ever sends the label rather than `other`, a cleaner gets a coach's access. To check: what the staff form sends. | Map "Other" to `other`. | Fixed (4258be0) |
| F-063 | Medium | Bug | `expense.controller.js:26-38,50-113,152-183` | Amounts go through `parseFloat`: a non-number is stored as NaN and "Infinity" as Infinity (PostgreSQL keeps both), so the books total NaN; negative amounts are accepted; a missing title or date answers 500; and an edit that leaves out `category` resets it to "Other" (out `amount`: NaN). | Validate amount (finite, above 0), title and date; edit only the fields sent. | Fixed (ee6805d) |
| F-064 | Medium | Bug | `payment.controller.js:34-114`, `member.controller.js:214-311` | A payment is written in three steps (the row, a raw SQL patch for reference and balance-after, then the member's balance), so a failure in between leaves a payment that never reduced the debt. A new visitor and their first payment are not one transaction either, although the code says neither can exist without the other. "Infinity" passes the amount check. | One transaction per payment; validate the amount as finite. Touches payments, but only makes the existing behaviour reliable. | Fixed (8d60de4) |
| F-065 | Medium | Bug | `payroll.controller.js:144-185` | Issuing pay checks for a duplicate and then creates, with no unique key: a double click pays the same month twice. Months are free text, so "Sep 2026" and "sep 2026" are different months. | Normalise the month; check and write in one serializable transaction (a unique index later, with D-4). | Fixed (ee6805d) |
| F-066 | Medium | Data | `package.controller.js:73-85` | Deleting a package silently takes it off every member on it (`ON DELETE SET NULL`), unlike products, which are retired once they have history. | Refuse while members use it and offer Inactive instead. | Fixed (345932f) by D-22 |
| F-067 | Medium | Security | `package.controller.js:13-18,56-59` | A package update passes the body to the database, so it can set `gymId` (owner only, but a write into another gym) and any column; an unknown field answers 500. | List the fields. | Fixed (719f080) |
| F-068 | Low | Security | `gym.controller.js:34-39` | `GET /api/gyms/me` returns the whole gym record to every role, including the unused `managerCode` (in the seeded demo gym it equals the owner's own 4-digit code). | Leave `managerCode` out. | Fixed (0ad220f) |
| F-069 | Low | Bug | `gym.controller.js:41-91` | Gym settings are saved without checks: an unknown currency code is stored, then ignored by the screens (they fall back to the country's currency) and printed as a bare code on receipts and emails (first logged as making `Intl.NumberFormat` throw: neither side formats with Intl currency styles, so it does not); a non-number fee answers 500. | Accept only the supported currency codes and numbers where numbers belong. | Fixed (6fe825d, 0ad220f) |
| F-070 | Low | Security | `task.controller.js:245-289` | The check on who may change a task's content leaves out `assignedRole` and `assignedGroup`, so anyone can hand someone else's task to a whole role or to management. | Count both as content. | Fixed (0ad220f) |
| F-071 | Low | Bug | `calendar.controller.js:146,287`, `timecard.controller.js:139,256,421-427`, `staff.controller.js:350` | Unreadable input answers 500 instead of 400 in several places: `staffIds` that is not JSON, an unreadable date, a time like 25:99 (rolls into the next day). | Validate and answer 400 with the field. | Partly fixed: calendar (fcd1b52), staff create (4258be0), expenses (ee6805d); time card dates and hours still open |
| F-072 | Low | Quality | `staff.controller.js:123-137,205-218,390-429`, `payment.controller.js:92-102` | Four raw SQL statements work around "a stale Prisma client" that no longer exists: the generated client has these columns. | Use the client; drop the raw SQL. | Fixed in staff (4258be0) and payments (8d60de4) |
| F-073 | Low | Security | `staff.controller.js:173,202` | A new account's placeholder password is `GEM` plus the creation time in milliseconds (unusable while `mustSetPassword` is set, but guessable), and a failed staff create returns the database's error text to the browser. | A random placeholder; a plain error message. | Fixed (4258be0) |
| F-074 | High | Bug | `utils/scheduleAlert.js`, `controllers/timecard.controller.js` and 12 more files (59 places) | Days and times are worked out in the server's own time zone (`setHours`, `getHours`, `toLocaleDateString` with no zone). Railway runs in UTC unless `TZ` is set, and Cameroon is UTC+1: an employee clocking in on time at 08:00 is measured as 07:00, flagged "1 h early" and sent for review every day; a time the desk types as 09:00 is stored as 09:00 UTC and shown back as 10:00; reminders and pay days turn over at 01:00. The developer's own machine runs on Cameroon time, which hides it. Endpoints that take the browser's `tz` (attendance stats, sales, reports, coach) are right. Also: the activity log's from and to day filter, and a coach's "membership ended" check (the browser compares local days, the server UTC days, so for an hour around midnight east of GMT the screen may say ended while the server still accepts). | Quick: set `TZ=Africa/Douala` on Railway (right for Cameroon and Nigeria, not for Ghana, Senegal or Kenya). Proper: a time zone on each gym (from its country) used for every day and time. | Fixed (6099f67) by D-19 |
| F-075 | Low | i18n | `utils/memberEmail.js`, `utils/welcomeEmail.js`, `utils/taskEmail.js`, `utils/receiptPdf.js`, server messages | Every email, the receipt PDF and the server's error messages are in English only, although the app is bilingual and most Cameroonian members read French. | Send emails and the PDF in the gym's language (a language setting on the gym). A feature. | Fixed for members (4b26885, d2b63ae) by D-23; staff emails and server messages stay English |
| F-076 | Low | Bug | `jobs/taskReminders.js:138-151` | Reminders go to every task not marked `done`, which includes calendar invites (they end as `accepted` or `declined`): someone who declined, or accepted, a class gets "Task Overdue: 'Yoga' was due 12 Oct and is still open" the day after. | Remind only ordinary open tasks (`todo`, `in_progress`, no `eventId`). | Fixed (0ad220f) |
| F-077 | Low | Bug | `jobs/freezeFees.js:25-39` | The freeze-fee job reads the balance and the last charge date, then writes both: run on two servers at once (or beside a payment) it charges twice or loses a payment. | Charge with a conditional, atomic update (part of F-042). | Fixed (ee6805d) |
| F-078 | Medium | Security | `controllers/member.controller.js:61-128`, `pages/AttendancePage.jsx:557,649`, `pages/DashboardPage.jsx:534,576`, `pages/FrontDeskPage.jsx:961`, `components/ui/VisitorCodeModal.jsx:28`, `pages/MembersPage.jsx:309,590`, `pages/MemberProfilePage.jsx:943` | Every member's 4-digit check-in code is sent to every signed-in browser in the members list, because several screens compare a typed code with it locally (the Members row check-in and the member profile's code check too). Anyone with the developer tools open at the desk, or any trainer's account, can read every code and check in as someone else. The Members search also matches the code, so typing four digits there shows whose code it is. | Check codes on the server (a rate-limited endpoint), then send codes only to management, and stop searching by code. | Partly fixed: no search by code (fbe0891); checking codes on the server is Phase 3 |
| F-079 | Low | Quality | `jobs/payrollReminders.js:23,136-151` | `ordinal` is never used. The "overdue email sent" marker is stored as a notification, so it shows in the owner's list ("Overdue payroll email sent for Oct 2026"). | Remove the helper; keep the marker out of the visible list. | Fixed (0ad220f) |
| F-080 | Low | Accessibility | `gem-frontend/index.html:2`, `contexts/LanguageContext.jsx` | The page's `lang` stays `en` when the app is switched to French, so screen readers read French text with English pronunciation. | Set `document.documentElement.lang` from the chosen language. | Fixed (2ac04ac) |
| F-081 | Low | Bug | `gem-frontend/src/components/Sidebar.jsx:169`, `pages/SettingsPage.jsx:712` | The amber "still to set up" dots were meant to pulse, but their keyframe lived only in `styles/globals.css`, which nothing loads. | Keyframe moved to `index.css`. | Fixed (8b95823) |
| F-082 | Low | Robustness | `gem-frontend/src/main.jsx:14`, `contexts/LanguageContext.jsx:7` | The first `localStorage` reads are not guarded: a browser that blocks site storage (Firefox with cookies blocked) gets a blank page instead of a message. | Guard the reads; say that GEM needs site storage to sign in. | Fixed (f5d2e41): the reads on the way in go through utils/storage.js; signing in says to allow site storage |
| F-083 | Low | Accessibility | `gem-frontend/src/App.jsx:163-277` | The "Are you still there?" warning is a plain overlay, not a dialog: no `role="dialog"`, no focus moved into it, and keyboard focus stays on the page behind. | Build it on the shared `Modal` (a real dialog). Phase 6. | Fixed (8c1211d) |
| F-084 | Medium | Bug | `gem-frontend/src/pages/FrontDeskPage.jsx:1267-1276` | Reporting an equipment issue at the desk shows "Issue reported" and adds it to the activity list even when saving failed: the error is only written to the console. The same "fake success" pattern CLAUDE.md forbids elsewhere. | Show the server's error and keep the form. Frontend review. | Fixed (d9ab86d) |
| F-085 | High | Security | `gem-frontend/src/pages/AccountingPage.jsx:747,794,1891-1919`, `pages/MembersPage.jsx:1681-1704` | Stored XSS in print and export windows. These build HTML from records and write it into a window opened from the app (same origin, so it can read the signed-in token in localStorage) without escaping: an expense's title, category, paid-to, method, recorded-by and note (all typed by the front desk at the kiosk), the financial overview's category labels, payroll names, and every cell of the members export. A front desk employee can save an expense titled with a script that runs when the owner prints it, with the owner's session in reach. The receipt image address goes into an attribute unescaped as well. Receipts on the member profile and Payments page already escape. | Escape every value (`escapeHtml` from `utils/receipt.js`) and allow only http(s) or data:image addresses for the image. | Fixed (cdd7ff2) |
| F-086 | Medium | Bug | `gem-frontend/src/hooks/useGymSettings.js:10,27`, `utils/paymentMethods.js:28-34`, `pages/SettingsPage.jsx` (`DEFAULT_PAYMENT_SETTINGS`) | A gym that has not saved its payment settings is meant to be offered all four methods, but `useGymSettings` fills in a default of three (no Mobile Money), so `enabledMethods()` never reaches its "all four" fallback: a new gym's payment forms leave out Mobile Money, the most common way to pay in Cameroon, until the owner visits Settings. The Settings page's own default list leaves it out as well. | Default to all four methods, in both places. | Fixed (ae5894a) |
| F-087 | Low | Bug | `gem-frontend/src/utils/rolePages.js:22`, `routes/ProtectedRoute.jsx:16-19`, `components/Sidebar.jsx:215-222`, `NavDrawer.jsx:59-70`, `GlobalSearch.jsx:81` | Legacy roles get the wrong pages. `instructor` accounts cannot open Members, although instructors and coaches are meant to be treated as trainers everywhere. An `accountant` account (the role is still in the schema) matches no entry, and the route guard, sidebar, drawer and search read "no entry" as the owner's "everything": every page is listed and opens, and each one comes up empty because the server refuses the data. A missing role falls back to `general_manager` the same way. | Give instructor the trainer's pages; an unknown or missing role gets only its own profile. | Fixed (458df04) |
| F-088 | Low | Bug | `gem-frontend/src/services/api.js:76-86`, `services/gym.service.js:4` | An expired session sends the person to the generic `/login` (gym code first) instead of their own gym's sign-in page, as the deactivation path already does; the gym code is put into the lookup address without encoding. | Use the same sign-out path; encode the code. | Fixed (5bb3b33) |
| F-089 | Medium | Bug | `gem-frontend/src/utils/auth.js:9`, `pages/PaymentsPage.jsx`, `TasksPage.jsx`, `AttendancePage.jsx`, `DashboardPage.jsx`, `FrontDeskPage.jsx`, `MembersPage.jsx`, `StaffProfilePage.jsx:1988,3573`, `MemberProfilePage.jsx:860,1065-1066,1208,1446,1543,1555,1966,2879` | The UTC day (`toISOString().slice(0, 10)`) is used where CLAUDE.md requires the local day (`todayStr()`, `dayStr()`). The daily re-login: in Cameroon the "new day" begins at 01:00, so someone signing in at 00:30 is signed out half an hour later. The pages: "today" for the Payments totals, overdue tasks, the Attendance and Dashboard lists and the desk's loads is yesterday until 01:00; the Add member form's earliest start date disagrees with its own check; staff notes and registration fee dates are stamped with the UTC day; and the member profile's registration expiry is always shown a day early (a local midnight turned into UTC). | Use `todayStr()` and `dayStr()` everywhere. | Fixed (70f15bb, 07e72e1) |
| F-090 | Low | Bug | `gem-frontend/src/pages/AccountingPage.jsx:765,804`, `pages/MemberProfilePage.jsx:581` | The Financial Overview and Payroll exports are headed "GEM Fitness", and the member profile's receipt dialog "GEM GYM" (`memberProfile.gemGym`), instead of the gym's own name (the printed receipt already uses it). | Use the gym's name. | Fixed (cdd7ff2) |
| F-091 | Low | Quality | `gem-frontend/src/hooks/useIsMobile.js`, `utils/useIsMobile.js`, `utils/hierarchy.js:9-16` | Two `useIsMobile` hooks with different breakpoints (800 px media query, 768 px resize listener), so pages switch to their phone layout at different widths; the frontend copy of the access ladder has no `other` role (the server's does). | One hook; the same ladder. | Partly fixed (aeb7419): the two ladders agree, with a unit test; the two hooks are D-53 |
| F-092 | Medium | Accessibility | `gem-frontend/src/components/ui/GemInput.jsx:15`, `GemSelect.jsx:16` | Every form's labels are drawn but not connected to their fields (no `htmlFor`/`id`): screen readers do not announce them, clicking a label does not focus its box, and errors are not tied to the field (`aria-describedby`, `aria-invalid`). | Give each field an id (`useId`) and connect label, field and error. Phase 6. | Fixed (8c1211d): the shared fields carry ids, labels and errors; utils/labelLinker.js ties the hand-made labels to their boxes |
| F-093 | Medium | Bug | `gem-frontend/src/components/ui/ManagerAuthModal.jsx:143-157` | The manager code box is a `type="password"` field, which CLAUDE.md forbids for codes because browsers (Firefox above all) fill saved logins into it; `autocomplete="off"` does not stop Firefox for password fields. | Use `CodeInput` for the code (the password mode keeps a password field). Confirm in Firefox, Phase 5. | Fixed (c22e5a2) |
| F-094 | Medium | Bug | `gem-frontend/src/pages/PaymentsPage.jsx:68-80` | The receipt printed from the Payments page asks for seven translation keys that do not exist (`payments.paymentReceiptTitle`, `receiptReference`, `receiptDate`, `receiptDescription`, `receiptMethod`, `receiptRecordedBy`, `thankYouReceipt`), so it prints the key names instead of labels. The member profile's receipt has working keys. | Add the keys in EN and FR. | Fixed (2ac04ac) |
| F-095 | Low | i18n | `components/ui/ConfirmModal.jsx:45,63`, `ui/Modal.jsx:86`, `utils/paystubPdf.js`, `components/AddressInputs.jsx:19`, `OpenShiftsWarning.jsx:27`, `NavDrawer.jsx:167-170`, `Sidebar.jsx:385`, `Header.jsx:46,49`, `EodReport.jsx:117`, `pages/MembersPage.jsx:85,377,1926`, `StaffPage.jsx:760`, `TasksPage.jsx:438` | Text that stays English in French: the confirm dialog's Cancel and default Delete, the dialog close button's label, the whole payslip PDF, the "e.g. 12B" placeholder, "A staff member", the "Manager" name fallback, the role name in the phone drawer, the add buttons' labels on Members, Staff and Tasks, and equipment severities in the end-of-day report (shown as stored codes). | Translate them (the payslip with F-075). | Fixed (d0fa65a); the payslip PDF's English waits with F-075 |
| F-096 | Low | Accessibility | `gem-frontend/src/components/ui/Modal.jsx`, `ManagerAuthModal.jsx`, `RowMenu.jsx` | Dialogs do not move focus in, keep it in, or give it back on close; the code dialog is not a dialog to assistive technology; the row menu has no arrow-key navigation; the eye button has no label. | Phase 6. | Fixed (8c1211d): hooks/useDialogFocus.js; the row menu takes focus and answers the arrow keys; Escape closes only the top dialog |
| F-097 | Medium | Bug | `gem-frontend/src/components/CollectPaymentStep.jsx:20-24`, `pages/DashboardPage.jsx:704,713`, `MembersPage.jsx` (`MemberPaymentModal`), `FrontDeskPage.jsx` (cart, expense), `MemberProfilePage.jsx:390,1058,1281` | Payment forms start on "Cash" without checking it against the gym's accepted methods. When the gym does not take cash, the box shows another method (or nothing) while the form still holds Cash, so a payment saved without touching the box is recorded as Cash, which also puts it in the desk's "cash in the drawer". The Dashboard and member profile Add payment dialogs reset to Cash every time they open; the Add member and Add visitor step does it when the gym's settings arrive after it opened. The Payments and Sales forms already re-check. | Start on the gym's first accepted method and re-check when the settings arrive, in every form (D-26). Touches payments. | Fixed (32d78b6) by D-26 |
| F-098 | Medium | Privacy | `gem-frontend/src/components/GlobalSearch.jsx:52-67` | The search keeps the members, staff and packages it fetched for 60 seconds in a module-level copy that does not know who is signed in. Signing out and signing in to another account (or another gym) in the same tab within that minute lists the previous account's members and staff, including staff records the new role may not read. | Key the copy by gym and user, and drop it on sign-out. | Fixed (f28549f) |
| F-099 | Medium | Performance | `gem-frontend/src/components/Sidebar.jsx:200-211`, `utils/live.js:21-27`, `pages/OperationsPage.jsx`, `DashboardPage.jsx`, `FrontDeskPage.jsx`, `StaffProfilePage.jsx:550,577` | The sidebar's two badges download the gym's whole member list and whole task list on every page change and after every write anywhere in the gym (live events from other desks arrive as data-changed). Each open tab does it, so a busy front desk makes every screen in the gym re-download every member several times a minute. Pages do the same on each live event: Operations re-downloads seven whole tables (all attendance ever, F-051), the Dashboard every payment the gym ever took, the desk everything it shows, and each open staff profile the whole task list and calendar. | Small server endpoints for counts and date-bounded lists. Phase 7. | Partly fixed (90162ea): the sidebar's counts (a light member list, open tasks only), Daily Overview (today's check-ins and payments) and the Dashboard (today's payments and the latest three). Still whole lists on each live event, now compressed (F-177): the desk's members and calendar, a staff profile's tasks and calendar, and the Members, Payments and Attendance pages, which show them |
| F-100 | Medium | Accessibility | `gem-frontend/src/components/Sidebar.jsx:88-123`, `NavDrawer.jsx:195-244`, `Header.jsx:204-209,352-455` | The app's navigation can only be used with a mouse or finger: the sidebar items, the phone drawer's items and Sign out, the header bell, the avatar menu, My Profile and Sign out are `div`s with click handlers, so they cannot be reached with Tab or used with Enter (WCAG 2.1.1, level A). The kiosk's bell and the phone's bottom bar use real buttons. | Make them links or buttons, with names on the icon-only ones. Phase 6. | Fixed (8c1211d) |
| F-101 | Low | Bug | `gem-frontend/src/pages/SalesPage.jsx:723`, `components/FAB.jsx:3` | On a phone the Sales page's round Add product button is meant to show only on the Products tab, but it passes a `style` that FAB ignores, so the button floats over every tab, History included. | Render it only on the Products tab. | Fixed (bfdf6fb) |
| F-102 | Low | Bug | `gem-frontend/src/components/MemberProgressTab.jsx:83`, `NotificationBell.jsx:47`, `Header.jsx:62`, `MemberCoachRow.jsx:39`, `pages/NotificationsPage.jsx`, `StaffProfilePage.jsx:456,465,471,528,602`, `MemberProfilePage.jsx:2632-2639,2724,2751` | A failed load is shown as an empty list: the Progress tab says "No progress yet", the bells and the Notifications page say there are no notifications, the coach list offers no coaches, a staff profile shows no pay records, bonuses or time cards, and a member profile that could not be loaded says "Member not found", when the server could not be reached or refused. | Show that loading failed, with a retry. | Fixed (ac15a5b, a1b12dc, 1b04b85); a manager's refused pay records and bonuses are left as they are until D-31 |
| F-103 | Low | UX | `gem-frontend/src/components/MemberProgressTab.jsx:161-165,429`, `pages/CalendarPage.jsx` (single event), `pages/FrontDeskPage.jsx` (raised task) | Some deletions happen the moment Delete is chosen, with no confirmation, unlike other deletions in the app: a progress entry (a session, measurements or a note), a single calendar event (a series already asks which ones), and a task raised at the desk. | Ask first (D-25). | Fixed (0e575f2, 6dfca63) by D-25 |
| F-104 | Low | Quality | `gem-frontend/src/i18n/translations.js` (EN about lines 1246 and 1427, 1534 and 1643; FR 3357 and 3538, 3650 and 3764) | Two keys are defined twice in each language (`frontDesk.checkInFailed`, `memberProfile.unlimited`; lint reports them as `no-dupe-keys`). The later copy silently wins, so the earlier text is dead and misleads whoever edits it. | Remove the earlier copies after checking which text is shown today. | Fixed (2ac04ac) |
| F-105 | Medium | Privacy | `gem-frontend/src/utils/auth.js:34-60`, `utils/gymCache.js`, `pages/PackagesPage.jsx` | Signing out leaves the gym's data in the browser. `clearAuth` removes the dashboard caches and some settings keys, but not the page caches (`gem_<page>_<gymId>_*` for Members, Staff, Payments, Sales, Accounting, Attendance, Calendar, Tasks, Operations, Communication, the desk and the coach dashboard) nor the Packages page's copy of the whole member list (`gem_pkg_<gymId>_*`). Those lists hold every member's phone, email, address and balance (and code, F-078). On a shared desk computer they stay after sign-out, and the next account of the same gym signed in on that browser is first shown the previous account's copy, which can hold what its role may not read. | Clear every `gem_*_<gymId>_*` key in `clearAuth`. Member notes stay until F-117 moves them to the server, because the browser holds the only copy. | Fixed (46a75fd) |
| F-106 | Medium | Security | `gem-frontend/src/pages/FrontDeskPage.jsx:1434`, `components/CoachClientsPanel.jsx:92`, `pages/StaffProfilePage.jsx:189,266-276` | The front desk can be left without the exit password, and on a manager's session it shows what the manager may see. CLAUDE.md: leaving the desk for the app always goes through the manager's password (`requestExit`). Two ways round it: the desk's sign-in screen has a "Back to dashboard" link straight to `/dashboard`; and a coach's profile opened from the desk (`/front-desk/staff/:id`) shows the Clients tab when a manager works the desk, where each client opens `/members/:id` inside the app. On that session, anyone at the desk who opens a colleague's profile sees their pay and private notes, because the profile reads the signed-in role. | Send both links through `requestExit`, or keep kiosk links inside `/front-desk`; inside the kiosk, show private tabs and Clients only on the person's own profile. | Partly fixed (d3265d4): both links go through the exit gate; the private tabs wait on D-41 |
| F-107 | Medium | Bug | `gem-frontend/src/pages/FrontDeskPage.jsx:1280-1317`, `AttendancePage.jsx:770-789`, `OperationsPage.jsx:209-210`, `StaffProfilePage.jsx:1074-1084,1988,3569-3580`, `MemberProfilePage.jsx:942-946`, `NotificationsPage.jsx:93-110` | More "fake success" (F-084): screens that report a change the server refused or never made. A desk expense says "sent for review" when saving failed, so money left the drawer with no record. Checking someone out says "checked out" when the server refused, so a staff shift stays open and keeps counting hours. Add task on Operations closes before the server answers. Deactivate and Reactivate on a staff profile show the new state whatever the server says. A staff note appears, then vanishes on the next reload when refused; a non-owner adding one on their own profile is always refused (notes are not theirs to edit), yet the button is there. The member profile's code check says "Check-in confirmed" before asking the server, which can then refuse it (the 30-minute rule). Notifications marked read or deleted disappear even when the server refused. | Wait for the server; on a refusal keep the form and show its message. Hide Add note where it cannot work. | Fixed (d9ab86d, c8b1eca, 757a1ca, e9b9573, e4ef386, ac15a5b) |
| F-108 | Medium | Bug | `gem-frontend/src/pages/MemberProfilePage.jsx:740,1116-1126,1527,1596,2299,2502` | The member profile's money dialogs say nothing when the change fails after the payment was taken. Convert to visitor, change package, renew, day pass and visitor bundle catch the error and only re-enable the button, so the staff cannot tell whether the member got what they paid for. Renewing the registration records the payment and then updates the member; if the second step fails it says "Payment failed. Try again." although the payment went through, and trying again charges twice. | Show the server's error now (display only); then do the payment and the change in one server action (D-20, D-28). Touches payments. | Fixed (a636e22) by D-28 |
| F-109 | Medium | Bug | `gem-frontend/src/pages/PackagesPage.jsx:222-318`, `TasksPage.jsx:683-705`, `AccountingPage.jsx:831`, `AttendancePage.jsx:844,1389`, `StaffProfilePage.jsx:1408-2150,3216,3249` | On a phone, buttons that open a dialog drawn only in the desktop layout do nothing (each page returns its phone layout early, without those dialogs). Packages: view, edit, delete and add a visitor bundle. Tasks: mark as done. Accounting: view an expense, a pending expense or a paystub, edit pay, mark paid. Attendance: the code dialog for a visitor without a photo, so such a visitor cannot be checked in from a phone. Staff profile: a task's details and mark as done. | Render the dialogs in both layouts (or once, outside the layout switch). | Fixed (189479d, 5f64502, e0a85d2, 431377f, ba78ba7) |
| F-110 | Medium | Bug | `gem-frontend/src/pages/PaymentsPage.jsx:389-426`, `AccountingPage.jsx` (phone add expense), `PackagesPage.jsx` (phone add sheet) | Phone forms that cannot save, or save the wrong thing. The Payments page's add sheet has no member picker, so the server refuses every payment from it. Accounting's add-expense sheet has no "Paid to" box, which every expense requires, so Save does nothing (and a salary cannot be booked from it). The Packages add sheet labels its box "Duration (Days)" but saves the number as months: 30 becomes 900 days. | Add the missing fields; save the duration in days. | Fixed (e0a85d2, ac5357c, db8ee4b): phones use the desktop forms |
| F-111 | Medium | Bug | `gem-frontend/src/pages/TasksPage.jsx:501`, `StaffProfilePage.jsx:1975`, `components/ui/ConfirmModal.jsx` | Two confirmation dialogs cannot be cancelled. `ConfirmModal` closes through `onClose`, but the phone's Delete task and the phone's Deactivate staff pass `onCancel`: Cancel, the close button, the backdrop and Escape do nothing, and Confirm works and then throws. The only way out is to confirm (delete the task, deactivate the person) or reload. The phone's Deactivate also asks for no manager code, which the desktop asks for. | Pass `onClose`; use the code dialog on the phone as on the desktop. | Fixed (0a46ff3) |
| F-112 | Medium | Bug | `gem-frontend/src/pages/StaffProfilePage.jsx:495-542`, `MemberProfilePage.jsx:153-170,1550-1560,2728`, `components/GoalsModal.jsx:28-36`, `pages/CoachDashboard.jsx:122,148` | Unsaved work is wiped whenever anything happens elsewhere in the gym. Pages reload on every live event (a check-in, sale or payment at any desk), and some forms refill themselves from the reloaded record. On a staff profile, the rota being edited snaps back; in one-week mode the grid switches to the repeating pattern while the toggle still says one week, and Save then stores that pattern as the week's exception. On a member profile, Edit personal details refills its form, Renew resets the chosen package and start date, and a coach's goals and starting measurements are cleared. On the coach dashboard the Log menu closes under the coach's finger (its parts are defined inside the page, so each reload remounts them). | Fill a form only when it opens (or the record changes identity); define row components outside the page. | Fixed (77813f9, 8937f06); forms fill once when they open (hooks/useOnOpen.js) |
| F-113 | Medium | Bug | `gem-frontend/src/pages/DashboardPage.jsx:532-539` | The Dashboard's quick check-in checks in the first member whose name or phone contains what was typed. With two members called John Smith, or "Ann" typed when Anna comes first, the wrong person is checked in and their pass is spent. CLAUDE.md: every check-in search offers every match (the Attendance page and the desk do). | List every match and let the staff pick, as the other check-ins do. | Fixed (b99aac7) |
| F-114 | Medium | Bug | `gem-frontend/src/pages/MembersPage.jsx:573-707`, `AttendancePage.jsx:844` | The photo rule (a member with no photo enters their code) is not applied on every path, although CLAUDE.md says no ungated check-in button is left. The Members row's Check in lets a member without a photo straight in, and always asks a visitor for the code, photo or not. The Attendance page on a phone checks members without a photo straight in, and cannot check in a visitor without one (F-109). | One shared rule for every check-in button. | Fixed (ba78ba7) |
| F-115 | Medium | Bug | `gem-frontend/src/pages/PaymentsPage.jsx:290-298`, `gem-backend/src/controllers/payment.controller.js:32` | The Payments page's form loses what is typed. Notes are sent as `notes` but the server reads `note`, so they are dropped. The form also asks for a payment date (required), "Received by" and "Package for", and sends none of them: every payment is dated now and recorded under the signed-in person. | Send the note under the right name; then send the other three or remove them (D-27). Touches payments. | Fixed (838f7f8, 8996939) by D-27 |
| F-116 | High | Bug | `gem-frontend/src/pages/AccountingPage.jsx:166,305,620-655,678-700` | Payroll in Reports is not saved where it looks saved. Editing a paystub (behind the owner's code) only changes the screen: nothing is sent, a reload shows the old pay, and the edit form starts without the existing deductions, so saving an unchanged paystub shows net equal to gross. When that pay is already marked paid, the same save does update the linked salary expense on the server, so the books and the payroll then disagree. Marking pay paid books the salary expense in a second request from the browser (a failure leaves the pay paid with no expense) and keeps the pay-to-expense link only in that browser (`gem_paystub_expense_map`): marking it unpaid on another computer leaves the expense in the books, and paying again books it twice. Expense receipt images are kept only in the browser (`gem_expense_receipt_<id>`). | On the server: one action that marks pay paid and books the expense, with a link column; paystub edits saved through the API; receipts stored with the expense (D-30). Schema and payments. | Fixed (0058736) by D-30 |
| F-117 | Medium | Bug | `gem-frontend/src/pages/MemberProfilePage.jsx:2747-2756,3713-3719` | A member's notes are kept only in the browser that wrote them (`localStorage`, "no DB model"). Other staff and other devices never see them, clearing the browser loses them, they stay on a shared computer after sign-out, and every note is signed "Staff". | A notes table on the server, like staff notes (D-32). Schema. | Fixed (5b053a9) by D-32 |
| F-118 | Medium | Bug | `gem-frontend/src/pages/StaffProfilePage.jsx:454-466,1272-1284,2765` | The staff profile's pay screens mislead. Changing the salary or the pay day shows the new figure at once and ignores a refusal or a lost connection, so the pay-day job can pay the old salary while the owner believes it changed. A manager (not the owner) sees a subordinate's Pay tab, but pay records and bonuses are the owner's alone on the server: both refusals are swallowed, so the tab says "No pay records yet" and shows a net pay without bonuses or deductions. "Total paid (YTD)" adds every pay record of every year, including ones issued and not paid. | Wait for the server and show its refusal; history and bonuses for the owner and the person themself only; total this year's paid records (D-31). Touches pay. | Partly fixed (ec4da1f): a refused salary or pay-day change is shown. Who sees pay history and bonuses, and the YTD total, wait for D-31 |
| F-119 | Low | Bug | `gem-frontend/src/pages/MembersPage.jsx:267-269,1931-1935` | Members page details. The visitors' "Sessions left" filter reads `sessionsRemaining`, which does not exist (the model has `passesRemaining`), so any choice empties the list. On a phone, adding a member or a visitor puts the new id into the list instead of the member (a blank card until the next reload). The visitor form's "Remainder due by" date is never sent. Page numbers stop at 5; later pages are reached only with the arrow. | Read `passesRemaining`; pass the member; send or remove the date; number every page. | Fixed (d256d09) except the visitor form's "Remainder due by" date, which the server has no field for (D-42) |
| F-120 | Low | Bug | many pages | Saves that fail without a word (the button just stops): Packages save and delete (other than a duplicate name), Calendar invite answers and deletes, Settings gym profile and registration fee, Staff photo and ID uploads after creating someone, staff profile photo upload and removal, rota save, task status changes and bonus or deduction removal, photos chosen in the staff edit form (dropped while the rest saves), Members check-in right after adding someone and photo upload after create, Operations "in progress" and "resolved", Accounting reviews, desk expense actions and deletion, member profile approve and decline, Communication unschedule and delete; Tasks replaces the server's reason with a generic message. | Show the server's message where the action was taken. | Fixed (757a1ca to df7b9fd, see the commit list; Accounting payroll actions are left to D-30) |
| F-121 | Low | Bug | `gem-frontend/src/pages/StaffProfilePage.jsx:742,957-960,1923,1983,2911,3566`, `i18n/translations.js:1125` | Staff profile details. The edit form's role list holds display names ("Front Desk") while the record holds the stored role (`front_desk`), so it shows "Manager" for every front desk and trainer (nothing changes unless someone "corrects" it). The Tasks tab's red count includes answered calendar invites, so it never clears. Non-managers read "Only the person this task is assigned to can update it", which is wrong: only management can. Download on a photo ID is ignored for a Cloudinary address (another site), so the tab, or the kiosk, navigates to the image. Note categories differ between phone and desktop, and the whole notes list is written from the browser, so two managers adding notes at once overwrite each other. | Stored roles as values; count Pending and In Progress only; correct the hint; download through a blob or a new tab; one category list; notes added by a server action. | Fixed (e3f4d61, 9633465) |
| F-122 | Low | Bug | `gem-frontend/src/pages/TasksPage.jsx`, `OperationsPage.jsx` | Tasks and Operations details. The phone header asks for "pending tasks" with a count, but the text has no `{count}`, so no number shows. A task due today reads Overdue all day (its due date is midnight UTC). The phone shows the stored priority and the desktop the stored category. Operations shows stored codes (severity, `in_progress`, priority), its phone list prints a field that does not exist (`issue.issue`, so the status code shows), has no colour for critical, counts answered calendar invites as pending, and offers the front desk cards and links to pages that send them back. | Add the count; compare by local day; show names; show only the links the role can open. | Fixed (7d73961) |
| F-123 | Low | Bug | `gem-frontend/src/pages/DashboardPage.jsx` | Dashboard details. "Active members" counts status `active` only, while the Members page counts its Active tab (visitors with passes included), so the two numbers differ. The mini calendar starts on Sunday (the Calendar page on Monday) and its days look clickable but do nothing. The check-in code box is a plain input, not `CodeInput`. | Use the Members rule; Monday first; no pointer; `CodeInput`. | Fixed (e93a1fe) |
| F-124 | Low | Bug | `gem-frontend/src/pages/AccountingPage.jsx` | Reports details. "Outstanding" adds payments whose status is Pending, but payments have no status, so it is always 0. The category breakdown and filter use a fixed list of six while the phone form offers others (Equipment, Marketing), so those expenses never appear in the breakdown. Payment methods and roles show as stored codes (`mobile_money`, `front_desk`). | Outstanding from member balances (or drop the card); one category list; names. | Fixed (164d5c1) |
| F-125 | Low | Bug | `gem-frontend/src/pages/FrontDeskPage.jsx:1179,1388,1451` and others | Front desk details. The code dialog says "Incorrect code" for any refusal, so "already checked in at 10:15" or "membership frozen" read as a wrong code. "Working today" compares the day name in the app's language with English schedule keys, so in French everyone reads as on duty (in the PIN picker too). The time filter offers the last 24 and 48 hours, but only today's check-ins are loaded. On a phone there is no programme panel and no recent check-ins. The programme panel starts its week on Monday and its month on Sunday. | Show the server's reason; compare weekday numbers; load the longer ranges or drop them; add the panels to the phone layout; Monday first. | Fixed (ca48768) |
| F-126 | Low | Bug | `gem-frontend/src/pages/AttendancePage.jsx:653,943` and others | Attendance details. On a phone every check-in and check-out flashes an empty red box (it reads fields that are never set). The page has its own time picker with arrows and AM/PM, the kind of control the owner rejected (CLAUDE.md: every time uses `components/ui/TimeInput`), and times added on screen read "09:42 AM" while loaded ones use the gym's format. The title makes a plural by adding "s" to a translated word. | Read the right fields; the shared `TimeInput`; a translated plural. | Fixed (b84f991) |
| F-127 | Low | Bug | `gem-frontend/src/pages/SettingsPage.jsx`, `PackagesPage.jsx`, `SalesPage.jsx` | Settings kept in one browser, against CLAUDE.md (gym settings live on the Gym record): package access types (`gem_access_types`), product categories (`gem_product_categories`; removing one asks for the manager's code although it only edits that browser's list) and auto-renew (`gem_auto_renew`). Each computer has its own list. Also, Copy says "Copied" when the clipboard write failed. | Keep the lists in `Gym.settings`; say when copying failed. | Fixed (2b01f0e, e4cc4ae) |
| F-128 | Low | Performance | `gem-frontend/src/pages/SettingsPage.jsx`, `gem-backend/src/controllers/gym.controller.js` | The gym's logo is stored on the gym record as a data URL (up to about 200 KB) and travels with every request for the gym (each page load, the public gym lookup) and into emails, where many mail clients block data: images. | Upload it like photos and store the address. Phase 7. | Fixed (f2ceee0) for new logos; logos saved before stay on the record until replaced (D-51) |
| F-129 | Low | Bug | `gem-frontend/src/pages/LandingPage.jsx`, `SignUpPage.jsx` | Light theme gaps: the landing navbar is fixed dark, the sign-up dial-code list uses fixed dark colours, and the welcome step's Sign in button border cannot be seen on a light background. CLAUDE.md: components read theme tokens. | Use the tokens. | Fixed (4cea0be) |
| F-130 | Low | Bug | `gem-frontend/src/pages/MemberProfilePage.jsx:3505-3513,3726-3764` | On a member profile a coach is offered the photo upload and removal. Editing a member is the desk's (the server refuses a coach), and the failure is only logged, so the coach sees nothing happen. CLAUDE.md: a coach does nothing to members but train them. | Hide the photo actions from coaches. | Fixed (c6c3ab5) |
| F-131 | Low | Quality | `gem-frontend/src/pages/MemberProfilePage.jsx:2208,2632,2846`, `StaffProfilePage.jsx:334` | The member profile loads with a bare `Promise.all` (CLAUDE.md: `softAll`). Its tab bodies, and the staff profile's photo, are components defined inside the page, so every reload remounts them and resets what they hold. The dismissible tips read `localStorage` unguarded, so a browser that blocks storage breaks the dialog they sit in. | `softAll`; move the components out; guard the reads. | Fixed (983f298 and step 10) |
| F-132 | Low | Bug | `gem-frontend/src/pages/PaymentsPage.jsx:644,699`, `PackagesPage.jsx:663`, `MembersPage.jsx` (package options, visitor bundles), `SettingsPage.jsx` (freeze summary), `MemberProfilePage.jsx:3479`, `StaffProfilePage.jsx:1954,2942`, `i18n/translations.js` (`members.payFullDayPass`, `minPctRequired`, `minPctRequiredMsg`) | Money written with `toLocaleString` and a symbol instead of `formatMoney`, so the gym's own style is lost (NGN reads "15,000 ₦" instead of "₦15,000"). Three translations build it the same way ("{amount} {currency}"). CLAUDE.md: money always goes through `formatMoney`. | Use `formatMoney` and pass the formatted amount. | Fixed (2fa6b28) |
| F-133 | Low | i18n | pages | English text on pages that stays English in French: password reset validation; the sign-in page's "Welcome back"; Packages (column, session and subscriber text, code dialog actions); Operations ("{n} open", "Pending Tasks", "Equipment Issues", "Unassigned"); Tasks ("Overdue"); Sales (code dialog actions, category dialogs); Staff (file hint, "General Manager / Owner", note author); sign-up ("GEM: How it works"); Settings (theme names, logo texts, day names, placeholders); Dashboard ("{n} spots", "View All"); Accounting (period options, categories, sources, payroll labels, settlement lines, salary expense titles); the desk (badge, activity lines, "Click anywhere to close", times in en-US, day initials); Members (paid lines, "{n} days", export titles, placeholders); staff profile (pay lines, bonus and deduction dialogs, Issue pay, history table, time log, desktop code dialog actions, status, priority, week labels); member profile (payment and renewal messages, the unfreeze sentence, "{n}d left", code toggles, "Photo", note categories, and the payment description "Annual registration fee renewal" stored in English). | Translation keys in English and French. | Fixed (147e437 to 0bd373b) |
| F-134 | Low | Quality | pages | Dead code inside pages (knip does not see it): Operations' `staffActivity` mock; Staff's `compressImage`; the Dashboard's fitness-role branch; Accounting's `PAY_RATES`, `PAYSTUB_MONTHS`, `loadFrontDeskExpenses`, `saveFrontDeskExpenses`; the desk's `PRODUCTS`, `PRODUCT_CATS`, `tPm`, `dayExpenses` (still reads the old `gem_expenses` key), a fake sign-up form and `MemberDrawer` (never opened); Members' `MemberEditModal` (a fake save), `MANAGER_ACTIONS` and its handlers, a second `generateRef`; Attendance's `TYPE_FILTERS` and member edit branch; the staff profile's `compressImage`, `PAY_RATES`, `HOURLY_RATES`, `MOCK_PAY_HISTORY`, `needsPasswordForCode` (always true), a photo viewer that never opens and a hidden photo ID box; the member profile's `EditMembershipModal` and `ConvertToMemberModal` (never opened), `ManagerAuthSection`, `PAYMENT_METHOD_MAP`, the "registered" branch (not a status) and `PKG_MONTHS`. | Remove it. | Fixed (c6133e3). PKG_MONTHS and Members' generateRef are in use and were kept |
| F-135 | Low | Accessibility | pages | Keyboard and screen-reader gaps on pages (F-100 covers the shell): links and steps that are spans or divs (gym code page, sign-in page, sign-up steps, Settings switches and theme and language cards), icon buttons with no name (password eyes, back arrows, hide code), and overlays that are not dialogs (Attendance's, the registration fee dialog, both photo viewers, the desk's exit). | Real buttons and links, names, the shared `Modal`. Phase 6. | Fixed (8c1211d) for every control that was the only way to do something; clickable rows and calendar cells that also have a button or menu are left as they are |
| F-136 | Low | Security | `gem-frontend/src/pages/GymLoginPage.jsx`, `ResetPasswordPage.jsx`, `StaffProfilePage.jsx:1594-1596`, `FrontDeskPage.jsx` (exit box) | Password boxes are labelled wrongly for password managers. The sign-in box says `new-password` and opts out of password managers (`data-lpignore`, `data-1p-ignore`), so they neither fill nor save it and browsers offer to invent a new password at sign-in (WCAG 3.3.8); the desk's exit box does the same. The reset and change-password boxes have no `autocomplete`. This was probably done to stop Firefox filling the code boxes (F-093). | `current-password` for sign-in and exit, `new-password` for new ones, once code boxes use `CodeInput` (F-093). | Fixed (c22e5a2); the desk exit box and re-authentication prompts still opt out of autofill on purpose |
| F-137 | Low | Privacy | `gem-frontend/src/pages/MemberProfilePage.jsx:1022-1027` | "Text it" puts the member's check-in code into an `sms:` link, so whoever is at the desk reads it in the messaging app, although CLAUDE.md says the desk never sees a code. On a computer the link usually does nothing, and the dialog still says the messaging app was opened. | Send texts from the server once texting is funded; until then say what the button does (D-38). | Fixed (dce8d5f, 6dfca63) by D-38 |
| F-138 | Low | Bug | `gem-frontend/src/pages/PaymentsPage.jsx` | Payments page display. On a phone, rows open nothing (no details, no receipt). The desktop table has no empty state. The printed receipt has a status line (payments have no status, so it prints blank) and an English title, besides the missing keys of F-094. | Details on a phone; `EmptyState`; drop the status line. | Fixed (c987473; the status line prints "Completed" since F-160 and the title is translated since F-094) |
| F-139 | Low | Bug | `gem-frontend/src/pages/MemberProfilePage.jsx:1057,3479` | A gym whose registration fee is unset or 0 is shown, and charged, 5,000 when a member renews their registration (the code falls back to a fixed 5000). | The gym's own fee; no payment step when it charges none (D-29). Touches payments. | Fixed (a636e22) by D-29 |
| F-140 | Medium | Bug | `gem-frontend/src/pages/LandingPage.jsx:247-266`, `SignUpPage.jsx:573-576`, `GymCodePage.jsx:314-317`, `GymLoginPage.jsx:698-701`, `ForgotPasswordPage.jsx:170-173` | Support contacts are placeholders on five pages: `hello@gymgem.io` and WhatsApp `wa.me/237600000000` ("+237 6XX XXX XXX"). A gym owner who needs help writes to an address and a number that may not be GEM's. | The owner's real contacts, kept in one place (D-33). | Fixed (3069e22) by D-33 |
| F-141 | Medium | UX | `gem-frontend/src/pages/LandingPage.jsx`, `SignUpPage.jsx:411,550`, `i18n/translations.js` (landing) | The landing page and the sign-up welcome step are not ready for real visitors. The "how it works" video is a placeholder YouTube video (`dQw4w9WgXcQ`, a well-known prank video); the figures (500+ gyms, 120k+ members, 99.9% uptime) and three named five-star testimonials are made up; the page claims "#1 Gym Management Platform in Central Africa"; and it offers a free 30-day trial while everything else says 7 days. The server has no trial logic at all. | Remove the video, figures and testimonials until real ones exist; one trial length (D-34). | Fixed (3069e22) by D-34 |
| F-142 | Medium | Security | `gem-backend/src/routes/product.routes.js`, `gem-frontend/src/pages/SalesPage.jsx` | The front desk may create products and change a product's price, cost price and discount (only deleting is management's). A desk employee can put an item at 99% off, or change its cost to move the profit figures that Revenue is built on. Package prices are the owner's. Also, a sale-wide discount of up to 100% can be typed at Quick Sale and in the desk cart, and the server accepts it (`sale.controller` `discountPct`), so any desk can give a sale away (seen in Phase 4). | Price, cost and discount for management; the desk keeps restocking (D-35). | Fixed (d0c28a6) by D-35 |
| F-143 | Low | Security | `gem-backend/src/controllers/auth.controller.js:16`, `gem-frontend/src/pages/SignUpPage.jsx`, `ResetPasswordPage.jsx`, `StaffProfilePage.jsx:1089` | New passwords need only 6 characters, on the server and in the forms. | 8 for new passwords (D-36). | Fixed (3069e22) by D-36 |
| F-144 | Medium | Bug | `gem-frontend/src/pages/SettingsPage.jsx`, `gem-backend/src/jobs/taskReminders.js` | Settings that look saved but change nothing. "Grace period (days)" and "Max freeze days" are never loaded or saved. Auto-renew is kept in one browser and nothing reads it (there is no renewal job). Tax rate, late fee and payment due days are saved and used nowhere. The expiry reminder, low-stock and end-of-day summary switches have no job behind them, and "task overdue" is ignored by the reminder job, so reminders keep coming when it is off. Only the welcome email switch works. | Remove the controls with no behaviour (or mark them "coming"); make the reminder job read "task overdue" (D-37). | Fixed (662008d) by D-37 |
| F-145 | Low | UX | `gem-frontend/src/pages/AttendancePage.jsx`, `FrontDeskPage.jsx` | The QR scanner is a drawing (a viewfinder and a moving line, "hold the barcode up"): there is no camera and no decoder; only the typed box works. | Remove the scanner look, or build real scanning (D-39). | Fixed (947ac56) by D-39 |
| F-146 | Low | UX | `gem-frontend/src/pages/SettingsPage.jsx` | On a phone only Appearance, Language and the activity log can be used; every other section says to open it on a computer, although GEM is meant to work phone first. | The main sections usable on a phone (D-40). | Fixed (d2b63ae) by D-40 |
| F-147 | Low | Bug | `gem-frontend/src/pages/PackagesPage.jsx` | Packages details: "active subscribers" counts every member on the package whatever their status, and whole-number money boxes show a "0.00" placeholder. | Count active memberships only; "0". | Fixed (984f301) |
| F-148 | Low | i18n | `gem-frontend/src/i18n/translations.js` (French) | French mistakes users see. Thirteen strings lost their apostrophes ("s entraîner", "n est", "qu il", "L accueil", "d accès", "l heure": `stats.perDaySub`, `staff.roleHint_none`, `roleHint_front_desk`, `roleHint_other`, `joinDateRequired`, `newCodeAction`, `newCodeIssued`, `newCodeFailed`, `attendance.cameToTrain`, `tasks.allOf_front_desk`, `frontDesk.hereToTrain`, `clockNoteRequired`, `clockNotePlaceholder`). "Geler pause l'adhésion" (`memberProfile.freezeInfo`) is not French; `suspendedMsg` says "Ils ne peuvent pas" about one member; tasks raised by the system are signed "System" in English; the grace period line is built as "3-jours de grâce actifs". The same thing has two names in places: "gymnase" and "salle", "Email" and "E-mail", "Coach" and "Entraîneur" for the trainer role, "Revenus" and "Recettes" for revenue. | Correct the strings; one word per thing. | Fixed (d62c103, 2ed501c) |
| F-149 | Low | Bug | `gem-frontend/src/i18n/translations.js` | Help texts that say something untrue. Settings' expense limit: "Staff can log front desk expenses up to this amount without prior approval", but every desk expense goes for review and anything above the limit is refused. The suspended-member banner: "Membership timer is paused. No days are being lost.", but nothing pauses it. The day pass for a lapsed member: "charged at the visitor rate", but it is the package's day-pass price. A failed staff profile load: "Try restarting the backend server", shown to gym staff. The sign-up success screen says the 4-digit code is needed "to log into the Front Desk", which is signed into with email and password. The sign-up address examples are Yaoundé streets whatever the country chosen (CLAUDE.md: examples follow the gym's country). | Correct the texts; examples from the chosen country. | Fixed (d62c103). Correction: the sign-up sentence about the 4-digit code is true (the desk signs people in with it) and was kept |
| F-150 | Low | Quality | `gem-frontend/src/i18n/translations.js` | About 281 keys in each language are referred to by no code (a lower bound: whole namespaces used with computed keys are counted as used). They include the whole front-desk tour (66 keys, its component is gone), the old time-card page (30), the old time picker's arrow labels, a roles page and two-factor authentication that do not exist, "YTD Earnings (2026)" and a "Default PIN" note. They mislead whoever translates or searches the file. | Remove them after checking each against computed keys. | Fixed (69ad022) |
| F-151 | Low | Bug | `gem-frontend/src/pages/SettingsPage.jsx:422-486` | The gym profile form is filled from the gym record when Settings opens. An earlier load answering after a later one refilled the form and erased what had been typed since: React runs the effect twice in development, and a slow network can reorder answers. Found because the Settings refusal test failed once under the full suite's load. | Only the current load fills the form. | Fixed (e898903) |
| F-152 | Medium | Bug | `gem-frontend/src/components/FAB.jsx` | On a phone the round + button floats over the bottom right of the screen, where the last row's 3-dot menu sits, and the page cannot scroll any further, so that row's actions cannot be opened (seen on Accounting's expense list; every page with the button is exposed). Found because a phone test could not press that menu. | The button leaves room under the page for the last row to scroll clear of it. | Fixed (e0a85d2) |
| F-153 | Low | Bug | `gem-frontend/src/pages/PaymentsPage.jsx` (phone list) | On a phone, a payment in the list cannot be opened: the desktop's rows open the transaction details (and its receipt), the phone's cards do nothing. | Open the same details dialog from the phone's cards (the dialog is now drawn by both layouts). | Fixed (c987473) |
| F-154 | High | Bug | `gem-backend/src/controllers/timecard.controller.js:422`, `gem-frontend/src/pages/AttendancePage.jsx` | The Attendance page sent an edited check-out time, and every time from its Edit time dialog, as "02:30 PM", while the server read only the digits: an afternoon or evening time was stored twelve hours early (02:30 instead of 14:30), which throws off a part-time employee's hours and so their pay. Clock-ins were not affected (that dialog sent 24-hour time). Found while replacing the page's own time picker (F-126). | The server reads a 12-hour time as the clock means it; the page sends 24-hour time. | Fixed (7fb6ee6, b84f991). Owner: check time cards edited on the Attendance page in the afternoon for times twelve hours early |
| F-155 | Low | Bug | `gem-frontend/src/pages/SettingsPage.jsx` (`handleLogoFile`, `removeLogo`) | A logo the server refused to save stayed on screen as if it were the gym's, with axios's "Request failed with status code 500" as the message; a refused removal hid a logo the gym still has. | Put back what the gym has and say why in the reader's language. | Fixed (506a4eb) |
| F-156 | Low | Bug | `gem-frontend/src/pages/FrontDeskPage.jsx` (program panel) | The Day / Week / Month buttons were the translations cut to three letters: "Wee" and "Mon" (which reads as Monday) in English, "Moi" in French. | Short names written for the buttons. | Fixed (2ed501c) |
| F-157 | Low | Bug | `gem-frontend/src/pages/MemberProfilePage.jsx` (Add note) | A note added on a member's profile was always signed "Staff", whoever wrote it. | Sign it with the signed-in person's name, as staff profile notes do. | Fixed (9289bff) |
| F-158 | Low | Bug | `gem-frontend/src/components/Header.jsx`, `NotificationBell.jsx` | The Notifications page was fixed in ac15a5b, but the header's dropdown and the desk's bell were not: Mark all read showed everything read when the server refused, and Clear all or deleting one quietly put the list back with no word. | Keep what the server has and say why, as the page does. | Fixed (205341e) |
| F-159 | Low | UX | `gem-frontend/src/main.jsx` | When a screen crashed, the app printed the raw error in English, in fixed dark colours, with no way to carry on. | The reader's language, the theme's colours, Reload; the error's text in development only. | Fixed (f191633) |
| F-160 | Low | Bug | `gem-frontend/src/pages/PaymentsPage.jsx` (payment details) | A recorded payment has no status field, so the details pill showed a tick with no word and the printed receipt an empty status line in an unrelated colour. | Show Completed, the status the icon already assumed, by name. | Fixed (f1a61ae) |
| F-161 | Low | Quality | frontend (24 places) | Lint left after step 10: 24 react-hooks/set-state-in-effect errors, nearly all a dialog resetting its form when it opens or closes, and 24 exhaustive-deps warnings on effects meant to run once. They cost an extra render, not a wrong result. | Case by case: key the dialog so it mounts fresh, or adjust state during render; leave the run-once effects with a comment. Phase 7. | Partly fixed (85d13f8 removed one warning); the rest checked one by one, none gives a wrong result (D-50) |
| F-162 | Medium | Bug | `gem-frontend/src/pages/StaffPage.jsx` (edit form) | Editing someone from the Staff list with a note typed sent that note as the whole notes list, and the list page does not load anyone's notes, so every earlier note on the person's file was lost. | Add the note through the server's append (F-121). | Fixed (9633465) |
| F-163 | Medium | Bug | `gem-frontend/src/utils/loadAll.js` and the 11 screens that use it | softAll turned every failed request into an empty list. That is right for a role that may not read something (403) and wrong otherwise: screens reload when something changes elsewhere, so a server error or a dropped connection during a reload emptied the list on screen and wrote the empty list over its saved copy, which stayed empty after a browser reload. | Mark the result failed(); every screen keeps what it shows for it. | Fixed (fae29e3) |
| F-164 | Low | Accessibility | `gem-frontend/src/pages/AccountingPage.jsx` (8), `DashboardPage.jsx` (7), `TasksPage.jsx` (6), `GymLoginPage.jsx` (4), `PackagesPage.jsx` (3), `OperationsPage.jsx` (3), `PaymentsPage.jsx` (2), `MembersPage.jsx` (1); the `Field` components of `SignUpPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx` | 34 form error lines (and the three pages' own field components) show the error under the field without `role="alert"` or `data-field-error`, which CLAUDE.md says every error line carries: a screen reader does not announce them, and `revealFirstError()` cannot find them to scroll to. Seen when the task form refused a task with no assignee (J-16). | Add both attributes, with F-092's label and error wiring, in Phase 6. | Fixed (8c1211d) |
| F-165 | Medium | Bug | `gem-backend/src/controllers/product.controller.js` (`invalid`, `create`, `update`) | An edit sending a cost price that is not a number answered 200 and stored NaN, which wiped the product's cost (it reads back as null) and every profit worked out from it. Two products given one code at the same moment both passed the check and the unique index refused the later ones, which reached the error handler as 500 (six at once: 201 and up to five 500s). | Refuse a cost that is not a number on edit as on create; answer the index's refusal with the same 409. | Fixed (69c9dec) |
| F-166 | Medium | Bug | `gem-backend/src/controllers/notification.controller.js` (`markRead`, `markOneRead`), `prisma/schema.prisma` (`Notification.isRead`) | Whether a notice has been read is one column on the notice, and a gym-wide notice is shared by everyone it reaches. So one person's Mark all read (or opening one) marks it read for everybody: the owner's unread "New Member Joined" went from 1 to 0 after the desk pressed Mark all read. Clearing was made per person (`NotificationDismissal`), reading was not. | A per-person read row like the dismissals (schema change, D-46). | Fixed (a43ffd3) by D-46 |
| F-167 | Medium | Bug | `gem-backend/src/controllers/coach.controller.js` (`assign`) | Two coaches taking the same member at the same moment both got 200: both passed the "already coached" check, both wrote goals and a starting measurement, the member was emailed two different coaches, and the first coach silently lost the client. | Claim the member in the same transaction only while they are free (or already this coach's). | Fixed (fb0334c) |
| F-168 | Low | Bug | `gem-frontend/src/components/ui/ManagerAuthModal.jsx` (`fail`) | After a wrong code the shared code box (every manager approval) shook and cleared itself 600 ms later, wiping a code typed in the meantime: a quick second try went in empty ("Enter all four digits") and the action was never applied. | Clear only the refused code. | Fixed (88b83c7) |
| F-169 | Low | Bug | `gem-frontend/src/pages/SettingsPage.jsx` | Until the gym's settings arrived, the gym profile, payment, membership and notification sections showed defaults that looked real and could be changed; the load then replaced them without a word (an unticked payment method came back ticked). | A skeleton until the gym has loaded. | Fixed (1df9434) |
| F-170 | Medium | Bug | `gem-backend/src/controllers/timecard.controller.js` (`punchIn`, `autoClockIn`) | Two clock-ins for one person at the same moment (a double tap at the desk, or two desks) both found no card and both wrote one, so the day could be counted twice in part-time pay. | Check and write in one serializable transaction; the second gets the same 409. | Fixed (f7ebbe9) |
| F-171 | Medium | Bug | `gem-backend/src/controllers/timecard.controller.js` (`adjust`, `approve`) | Correcting a night shift's check-out to the early morning (01:30 after a 22:00 start), by an edit or while approving, was refused as "before check-in", although clocking out and manual entry roll such a time to the next day as CLAUDE.md says. | Roll it forward the same way (`endOfShift`). | Fixed (f7ebbe9) |
| F-172 | Medium | Bug | `gem-backend/src/controllers/timecard.controller.js` (`punchIn`, `punchOut`, `reject`) | A time set by hand keeps the moment it was typed as the card's "original" time, and Reject puts the originals back. For a live clock that is right (the real moment). For a card of an earlier day it is not: someone who forgot to clock out yesterday is clocked out today at "17:00"; if a manager rejects that, the card's check-out becomes today's moment, and the shift runs into today and is paid as such. | Keep an original only when the card is today's; otherwise Reject marks the card rejected (its hours not paid), as for an unrostered shift (D-47). | Fixed (8f606b0) by D-47 |
| F-173 | Low | UX, Quality | several | Small things seen in Phase 4: (a) the inactivity sign-out goes to the gym-code page while a server sign-out goes to the gym's own sign-in page (F-088), so at a shared desk the next person types the gym code again; (b) the Staff list with only deactivated staff still says "Add your first staff member" above the tabs; (c) the coach dashboard counts open tasks given to the account's own role, so an older instructor or coach account misses tasks given to trainers; (d) a time card entered by hand never checks for a card already on that day (perhaps meant for split shifts); (e) `GET /api/timecards` returns every card to every role (the Attendance page shows the day's staff clock-ins on purpose, but a trainer can read anyone's history); (f) `toPaymentMethod` files a method name it does not know as cash instead of refusing it; (g) the renewal form says "(+N added)" in English. | (a) go to the gym's own sign-in page; (b) the empty-state card only when there are no staff at all; (c) count by job (`jobOf`); (d) the owner's call; (e) limit history to the person, management and the day's list; (f) refuse an unknown method; (g) translate. | Partly fixed: (a) 5daf55a, (b) and (g) aaeb74a, (c) 29b3d3c, (e) 63ff34d; (d) is the owner's call; (f) is D-54 |
| F-174 | Medium | Accessibility | `gem-frontend/src/index.css` (`--text-muted` in both themes, the light theme's gold, green and amber) | Text contrast falls short of WCAG AA (4.5:1): the dark theme's muted text (`#5a5a6a`) reads at 2.4 to 2.9:1 on its surfaces, the light theme's muted text (`#857d6e`) at 3.0 to 3.9:1, and the light theme's gold, green and amber at 3.7 to 4.8:1 (4.2:1 on their own pale chips). axe counted 356 places on 20 screens. Hard to read in a bright gym or on a phone in the sun. | New values for those tokens (D-48). It changes how every screen looks, so it is the owner's call. | Fixed (2ff9f88) by D-48 |
| F-175 | Low | Accessibility | `gem-frontend/index.html` (`maximum-scale=1.0`) | Zoom is switched off: on Android a person cannot pinch to enlarge the page (WCAG 1.4.4). It was likely added so an iPhone does not zoom into a small input box when it is touched. | Remove `maximum-scale`, and give input text 16 pixels on phones so iPhones do not zoom on their own (D-49). | Fixed (f85c41b) by D-49 |
| F-176 | High | Bug | `gem-backend/src/controllers/timecard.controller.js` (`createDayCard`), `approval.controller.js` (`create`) | Clocking in and sending a request for approval check and write in one serializable transaction. Postgres refuses one of two such transactions that touch the same table at once, even for different people or gyms, and asks for a retry; the app answered 500. Eight approval requests sent together: seven 500s. With every gym on one database, two desks anywhere working at the same moment could hit it. The clock-in half came with F-170's fix (f7ebbe9); the approval half was older. Found by the Phase 6 browser run. | Run the transaction again on that refusal (`utils/serializable.js`); Prisma reports it as P2034, or passes on the driver's 40001 when the refusal comes at the commit. | Fixed (a6f0739; 99eaf9c after a final run under full load still found one 500: up to ten tries with growing random waits). An index on the time card lookup would cut the refusals (with F-038) |
| F-177 | Medium | Performance | `gem-backend/src/app.js` | Answers were sent uncompressed: a test gym's 100-member list was 105.7 KB, 4.4 KB with gzip. On a phone's data that is most of the wait. | `compression`, leaving out the live stream (compressing holds its events back). | Fixed (037421e) |
| F-178 | Medium | Bug | `gem-backend/src/jobs/scheduledMessages.js`, `utils/messaging.js` | A message cut off while sending (the server restarted or stopped part way, as on every deploy) kept the status "sending" for good, and Retry and Edit refuse a message being sent. Deliveries are recorded once all have gone, so it cannot be resumed without mailing people twice. | Mark it failed an hour after it began, and tell open screens. | Fixed (bad5abf) |
| F-179 | Low | Operations | `gem-backend/src/app.js` (`/api/health`) | The health check answered "ok" whatever the database's state, so a deploy that could not reach it looked healthy. | Run `SELECT 1`; 503 when it fails or takes over three seconds. | Fixed (5062324) |
| F-180 | Low | Operations | `gem-backend/src/index.js` | Nothing handled SIGTERM, which a deploy sends: Node quit on the spot, cutting off requests under way and leaving the live streams to time out. | Stop taking connections, end the live streams (screens reconnect to the new server), let requests under way finish for up to 10 seconds, stop the jobs, close the database connections. Tested by calling the shutdown directly; Windows cannot deliver SIGTERM, so the signal itself is on the manual checklist (25.12). | Fixed (fc97141) |
| F-181 | Low | Quality, payments | `gem-frontend/src/pages/MemberProfilePage.jsx` (`usePaymentRefund`, about lines 504 and 538), and 27 background loads in 13 files | 30 promise failures in the web app are dropped without a word (`.catch(() => {})`). 27 are background reloads (the sidebar's counts, the desk's lists, Communication's progress), where keeping what is on screen is right. Three are not: when a member profile dialog is cancelled after its payment was taken, the payment is removed in the background, and a removal that fails is not shown, so the money stays recorded while the screen says nothing. | Show a failed removal and keep the dialog open (part of D-28); have the background loads log to the console so a failure can be found. Touches payments, so it goes with D-28. | Fixed (a636e22) by D-20, D-28 and D-29 |

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
| D-14 (F-029) | Telling Express it runs behind Railway's proxy, so limits see each visitor's own address. | Done in 6fe825d: one hop is trusted when Railway's own `RAILWAY_ENVIRONMENT` variable is present, and `TRUST_PROXY` overrides it. To confirm on Railway: two people on different networks are not limited together. |
| D-15 (F-037) | How money is stored. | Move to whole minor units (`Int`) before more currencies with cents sign up. Needs a data migration, so plan it as its own change. |
| D-16 (F-038) | Adding indexes on `gymId` (and the date each list sorts by). | Yes: additive and safe, and the schema already goes out with `db push`. Best done together with D-4 (migrations). |
| D-17 (F-041) | What extending an ended membership means. | Count the extra days from today when the membership has already ended, so an extension always gives the member that many days of access. |
| D-18 (F-008) | A migration once added `Task.dueTime`, which the schema no longer has. If that column holds data on Railway, `prisma db push` in the start command refuses, and the backend does not start. | Check the live column; drop it on purpose (or keep it in the schema) before the next deploy. |
| D-19 (F-074) | Time zones. | Now: set `TZ=Africa/Douala` on the Railway backend (one variable, no code). Next: a `timezone` on each gym, filled from its country, used by every day and time calculation. |
| D-20 (F-057) | The desk can change a member's balance, status, dates and passes directly. | Server actions for renew, buy passes and day pass that take the payment and apply the change in one transaction; direct edits of those fields kept to management. The screens stay the same. |
| D-21 (F-058) | The desk can delete any payment. | The desk may undo only its own payment from the last 15 minutes (the cancelled-action case); anything older or anyone else's goes to management. |
| D-22 (F-066) | Deleting a package that members are on. | Refuse with the number of members on it, and offer "Inactive" (already supported) instead. |
| D-23 (F-075) | Emails and receipts in French. | A language setting on the gym (English / French) that emails, the receipt PDF and server messages follow. |
| D-24 | Reads by role. The API answers some reads to roles whose screens never show them: trainers can read the books (`/api/expenses`, `/api/sales`), every time card (`/api/timecards`) and members' balances through the attendance list. CLAUDE.md says "the books read the same for everyone" as a deliberate choice. | Keep reads to the roles whose pages show them (the page list in `rolePages.js`), so the API matches the screens. |
| D-25 (F-103) | Some deletions ask nothing first: a progress entry, a single calendar event, a task raised at the desk. | Ask "Delete this?" like the other deletions; one tap more. |
| D-26 (F-097) | Payment forms start on Cash, even where the gym does not take cash. | Start on the gym's first accepted method and re-check when its settings arrive, in every payment form. |
| D-27 (F-115) | The Payments page asks for a date, "Received by" and "Package for", and sends none of them; its notes are lost. | Send the note under the name the server reads now. Remove "Received by" (the server already records who is signed in) and "Package for"; keep the date only if back-dating is wanted, and then for management only. |
| D-28 (F-108) | Member profile money dialogs that fail without a word after the payment was taken. | Show the server's error now (no change to amounts or flow); then give each one server action that takes the payment and applies the change together (D-20). |
| D-29 (F-139) | A registration fee of 5,000 when the gym has none set. | Use the gym's own fee; when it charges none, no payment step. |
| D-30 (F-116) | Payroll in Reports: edits not saved, salary expenses booked from the browser, receipts kept in the browser. | One server action that marks pay paid and books the salary expense, with a link column on the pay record; paystub edits saved through the API (owner only); receipt images stored with the expense like photos. Needs a schema change. |
| D-31 (F-118) | The staff profile's pay screens. | Show a refused salary or pay-day change (done in ec4da1f: it only reports a failure and changes nothing when the save succeeds; say if it should be undone); show pay history and bonuses to the owner and the person themself only (as the server already decides); "Total paid" for this year's paid records. |
| D-32 (F-117) | Member notes kept in the browser. | A member notes table (author, category, text, date) for the desk and management, like staff notes; copy each browser's notes in the first time a profile is opened there. |
| D-33 (F-140) | Placeholder support contacts on five pages. | Send the real support email and WhatsApp number; they go in one setting that all five pages read. |
| D-34 (F-141) | Landing page content and the trial length. | Remove the placeholder video, the made-up figures and testimonials, and "#1" until real ones exist. Say 7 days everywhere, or build the trial logic first if 30 is wanted. |
| D-35 (F-142) | Who may change product prices. | Management changes price, cost and discount; the desk adds products and restocks. |
| D-36 (F-143) | The password minimum. | 8 characters for new passwords; existing passwords keep working. |
| D-37 (F-144) | Settings that change nothing. | Remove grace period, max freeze days, auto-renew, tax rate, late fee, due days and the three reminder switches with no job (or mark them "coming soon"); make the task reminder job honour "task overdue". |
| D-38 (F-137) | Texting a member their code shows it to the desk. | Keep the phone's messaging app while texting is paused, and say in the dialog that it opens it; send from the server once texting is funded. |
| D-39 (F-145) | The QR scanner that is only a drawing. | Remove the scanner look until real scanning is built. |
| D-40 (F-146) | Settings on a phone. | Make the gym profile, payment methods and packages usable on a phone first. |
| D-41 (F-106) | On a desk opened by a manager, anyone standing at it can open a colleague's profile and read their pay and private notes, because the profile follows the signed-in manager's role. | Inside the kiosk, show the Pay, Notes and Clients tabs only on the person's own profile; managers read the rest in the app. |
| D-42 (F-119) | The Add Visitor form has a "Remainder due by" date for a bundle paid in part, but the server has no field for it, so it is never saved; the form's own message quotes it. | Remove the box and its sentence: what a visitor still owes is already chased by the Needs attention rule. Keeping it means a new column on the member (a schema change). |
| D-43 (F-127) | Settings, Membership has an "auto-renew" switch kept only in this browser (`gem_auto_renew` in localStorage). Nothing reads it: no membership renews itself. A manager who turns it on believes renewals will happen. | Remove the switch until auto-renewal exists, or build auto-renewal (a job that renews on the end date and charges or records the balance) and keep the setting on the gym record. Left as it is until the owner chooses. |
| D-44 | ESLint 9 does not count `<Icon />` as a use of `Icon`, so the config does not report unused capitalised names at all (variables already, parameters since step 10). | Upgrade the frontend to ESLint 10, which tracks JSX references, then drop both exemptions. A major dev-tool upgrade, so it is the owner's call. |
| D-45 (F-005) | The site itself (Vercel) sends no security headers. | Add to `gem-frontend/vercel.json`: `Content-Security-Policy` (self for scripts and styles, Google Fonts, the API's address and Cloudinary images in connect-src and img-src, frame-ancestors 'none'), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera only, for check-in photos). Deployment config, so it is the owner's to apply and check on a preview deploy first. |
| D-46 (F-166) | One person reading a gym-wide notification marks it read for everyone. | Add a `NotificationRead` table (notification, staff, unique pair, cascades with the notification) like `NotificationDismissal`, have the list report `isRead` from it for the asking person, and have Mark all read and opening one write rows instead of updating the notice. A notice addressed to one person can keep its own column. Schema change, so it is yours to approve; nothing is lost if it waits, the unread counts are only less accurate. |
| D-47 (F-172) | Rejecting a hand-set time on an earlier day's card writes today's moment onto it. | Record an "original" time only when the card is today's (a live clock-in or clock-out); for an earlier day the card is a hand entry, and Reject marks it rejected so its hours are not paid, as it already does for an unrostered shift. It changes what Reject does to paid hours, so it is yours to approve. |
| D-48 (F-174) | Text colours most people can read. | Dark theme: `--text-muted` `#8c8c9c` (5.0 to 6.0:1, from 2.4 to 2.9) and, so muted stays a step below it, `--text-secondary` `#a8a8b6` (7.0 to 8.4:1, from 4.9 to 5.8). Light theme: `--text-muted` `#675f52` (4.7 to 6.0:1, from 3.0 to 3.9), gold `#7a5d1e`, green `#166534`, amber `#92400e` (each at least 4.6:1 on every surface, and 5.1 to 6.0:1 on their pale chips). Every screen becomes a little more readable and a little less muted; look at a preview first. Then remove `color-contrast` from the rules left out in `tests/e2e/accessibility.spec.mjs`. |
| D-49 (F-175) | Let people zoom on phones. | Remove `maximum-scale=1.0` from `index.html`, and give inputs, selects and text boxes 16-pixel text on phones (one rule in `index.css`) so an iPhone does not zoom in when a box is touched. Then remove `meta-viewport` from the rules left out in the accessibility test. |
| D-50 (F-161) | The 47 lint problems left: 24 `set-state-in-effect` (dialogs resetting their own form as they open or close, and a few effects that fetch) and 23 `exhaustive-deps` (effects meant to run once, or on open). | Leave them for launch: each costs one extra render, and none gives a wrong result (checked one by one; the one that could, the Notifications page's times, is fixed). Rewrite each dialog to mount fresh when it opens as it is next changed, with a test. Meanwhile, set `react-hooks/set-state-in-effect` to a warning in `eslint.config.js` so `npm run lint` can stop new problems. Rewriting 24 money and membership dialogs now would carry more risk than it removes, and loosening a rule is your call. |
| D-51 (F-128) | Logos saved before f2ceee0 are still data URLs on the gym record. | If any gym has one, run a one-off script that uploads each to `gem/logos` and saves its address (a data change, so yours to run). Otherwise nothing to do: the next logo a gym saves is uploaded. |
| D-52 (F-180) | How long Railway lets the old server finish when it deploys. | The server now finishes requests under way for up to 10 seconds after SIGTERM, but only if the signal reaches it and Railway waits. (1) Start it with `node src/index.js`, not `npm start` (D-1): Railway's forum notes that `npm start` can swallow SIGTERM. (2) Set the service's draining time (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS`) to about 15; Railway's own answers give its default as 0 or 3 seconds. (3) Set the health check path to `/api/health`, so a deploy that cannot reach the database is not put in front of users (F-179). All three are deployment settings, so yours; TESTING_CHECKLIST.md 25.12 checks them. |
| D-53 (F-091) | Two `useIsMobile` hooks switch to the phone layout at different widths (`hooks/useIsMobile.js` at 800 pixels, `utils/useIsMobile.js` at 768). | Keep one, at 768 (the usual tablet width, so a tablet held upright gets the full layout), and point every page at it. Pages on the 800 hook would then show their desktop layout between 768 and 800 pixels; look at those widths before and after. |
| D-54 (F-173 f) | `toPaymentMethod` files a payment method name it does not know as cash. | Refuse an unknown method with 400 and `field: 'method'`. Every form sends one of the four names today, so nothing changes for them; a mistyped method from anything else would stop being counted as cash in the drawer. It changes what the server accepts for payments, so it is yours. |

## 8. Decisions applied

The owner asked for the recommended decisions to be made for them. Each one that changes behaviour came with a test that fails without it; the two removals (delete-all.js, D-5; the QR scanner drawing, D-39), the CI workflow (D-12) and the wording of D-38 had none.

| Decision | Done | Commit |
| :- | :- | :- |
| D-1, D-4, D-16, D-18, D-52 | Migrations instead of db push: a baseline and the audit's changes as migrations, `scripts/migrate.js` as Railway's pre-deploy step (detects a database with no history, refuses one that matches nothing), indexes, `Task.dueTime` kept. | ee5155c |
| D-2 | Nothing is sent for the demo gym; its code is reserved; the seed refuses production and uses example.com. | 1985258, ee5155c |
| D-5 | delete-all.js removed. | 1985258, 8b99e03 |
| D-19 | The server's clock is Africa/Douala unless TZ is set. | 6099f67 |
| D-20, D-28, D-29 (F-181) | Membership changes take their payment in one server action; balance, status, dates and passes set directly by management only. | a636e22 |
| D-26 | Every payment form holds a method the gym takes. | 32d78b6 |
| D-54 | An unknown payment method is refused, not filed as cash. | 118654c |
| D-21 | The desk may remove only its own payment from the last 15 minutes. | a9725bb |
| D-27 | Payments page: the note is saved; "Received by" and "Package for" removed; management may date a payment up to 90 days back. | 838f7f8, 8996939 |
| D-30 | Payroll settled, edited and reversed on the server with its salary expense (PayRecord.expenseId); receipts kept with the expense; browser-kept links and receipts handed over once. | 0058736 |
| D-35 | Prices, cost, offers and sale discounts are management's. | d0c28a6 |
| D-22 | A package members are on is not deleted; set Inactive instead. | 345932f |
| D-17 | Extending an ended membership counts from today. | a50fe40 |
| D-47 | Reject on an earlier day's hand-set card stops its hours. | 8f606b0 |
| D-31 | Pay history and bonuses for the owner and the person; "Paid this year". | 5877f7c (and ec4da1f earlier) |
| D-32 | Member notes on the server (MemberNote), browser notes handed over once. | 5b053a9 |
| D-3 | Signing out ends the token on the server (jti, RevokedToken, POST /api/auth/logout from clearAuth). The CSP half is D-45. | c41eea1 |
| D-45 | Security headers in vercel.json (frame-ancestors, HSTS, nosniff, Referrer-Policy, Permissions-Policy); the content policy built into the page from VITE_API_URL and VITE_PHOTO_HOST. A full browser run found it blocked the ID Download (fixed in the same commit). | 2a0978c |
| D-24 | GET /api/expenses and /api/sales for management and the desk only. | b1ee43b |
| D-36, D-41, D-34, D-33 | 8-character passwords; a colleague's Pay, Notes and Clients off the desk; no placeholder video, figures, testimonials or "#1", 7-day trial everywhere; support contacts from VITE_SUPPORT_EMAIL / VITE_SUPPORT_WHATSAPP, hidden until set. | 3069e22 |
| D-46 | Reading a gym-wide notice is per person (NotificationRead). | a43ffd3 |
| D-12 | CI workflow (lint, unit, API on a PostgreSQL service; Chromium and Firefox jobs). Not run on GitHub from here. | c41cbc9 |
| D-51 | scripts/move-logos.js lists, and with --apply moves, logos kept as data URLs. For the owner to run. | 0013c8c |
| D-8 | New owners and changed addresses confirm by an emailed link; a reminder in the app; nothing locked. | ca815ca |
| D-37, D-43 | Settings without behaviour removed; "task overdue" obeyed; the welcome email switch says it is the staff one. | 662008d |
| D-42 | "Rest due by" removed from Add Visitor. | 2dcfb36 |
| D-39 | The fake QR scanner removed. | 947ac56 |
| D-38 | "Text from this device", and the dialog says the code shows in the message. | dce8d5f, 6dfca63 |
| D-25 | A progress entry, a single event and a desk task ask before deleting. | 0e575f2, 6dfca63 |
| D-6, D-49 | Zoom allowed, 16px form text on phones, GEM favicon, a not-found page. | f85c41b |
| D-53 | One phone width, 768. | d7d6784 |
| D-48 | Contrast tokens (light gold one step darker than decided, measured), --on-accent-gold, axe checks every rule in dark and light. | 2ff9f88 |
| D-23 | Members are written to in English or French, the gym's choice (Settings, Language, "Emails to members"): the welcome, receipt and its PDF, check-in code, membership change and coach emails. Staff emails and server messages stay English (staff read GEM in their own language). | 4b26885, d2b63ae |
| D-40 | Every Settings section works on a phone: the desk's panels in an accordion, each opening under the item tapped. | d2b63ae |
| D-11 | Nothing to do: npm audit has been clean since Phase 3 with nodemon unchanged. | - |

Not applied, and why:

- D-50 (lint): the recommendation was to turn `react-hooks/set-state-in-effect` into a warning. That loosens a check, which the audit's rules forbid; the 47 problems stay as they are (none gives a wrong result, Phase 7), and CI lints the backend only until they are fixed properly.
- D-13, D-15, D-44: deliberately not done (type-checking, money in minor units, ESLint 10), as recommended.
- D-7, D-10 and the other owner actions: listed in the report, for the owner to do.

A slip in this stage, corrected: staging parts of a file by hunk with zero context put the D-38 hint between two buttons and left out D-25's desk row-menu line (6dfca63 corrects both). The browser tests had passed against the working copy. After that, partial files were staged from the committed version plus explicit edits, and the translations were compared key by key (6,450 keys, identical).
