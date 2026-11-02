// "Powered by Ekoteksolutions Inc." as the owner asked: kept quiet, at the foot
// of the public pages, of every screen of the app and of the account menu,
// never in the sidebar or the middle of a form. The payslip PDF is checked
// here; the emails and the receipt PDF by tests/api/member-emails.test.mjs.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

// The landing and sign-up pages embed the walkthrough video; no test waits on YouTube
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
});

const CREDIT = 'Powered by Ekoteksolutions Inc.';
const credit = (page) => page.locator('[data-powered-by]:visible').first();
const thisMonth = () => { const d = new Date(); return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`; };

test('the public pages credit Ekoteksolutions Inc. at their foot (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  for (const path of ['/', '/signup', '/login', `/${owner.gymCode}/login`]) {
    await page.goto(path);
    await expect(credit(page), path).toHaveText(CREDIT);
  }
  // On the sign-in pages it sits below the form, not in it
  for (const path of ['/login', `/${owner.gymCode}/login`]) {
    await page.goto(path);
    const button = await page.getByRole('button', { name: 'Continue' }).first().boundingBox();
    const line = await credit(page).boundingBox();
    expect(line.y, path).toBeGreaterThan(button.y + button.height);
  }
});

// The owner, 30 October 2026: at the foot of every screen of the app, below
// the page, never in the sidebar or the phone's drawer
test('the app credits Ekoteksolutions Inc. at the foot of every screen and in the account menu (desk or phone)', async ({ page, isMobile }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  for (const path of ['/dashboard', '/members', '/settings']) {
    await page.goto(path);
    const foot = page.locator('[data-app-footer] [data-powered-by]');
    await expect(foot, path).toHaveText(CREDIT);
    await expect(page.locator('[data-powered-by]:visible'), path).toHaveCount(1);
    // Below everything the page shows, and once scrolled to the end of the
    // page, on screen, on a phone above the bottom bar (mid-scroll anything
    // passes under it). Scrolled again until it holds: a page still filling in
    // its data grows after the first scroll.
    const bottom = page.viewportSize().height;
    await expect.poll(async () => {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const line = await foot.boundingBox();
      const limit = isMobile ? (await page.locator('[data-bottom-bar]').boundingBox()).y : bottom;
      return line.y >= 0 && line.y + line.height <= limit;
    }, { message: path }).toBe(true);
    const main = await page.locator('main').boundingBox();
    expect((await foot.boundingBox()).y, path).toBeGreaterThanOrEqual(main.y);
  }
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(page.locator('[data-powered-by]:visible')).toHaveCount(2);
});

test('the front desk credits Ekoteksolutions Inc. at its foot (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/front-desk');
  const foot = page.locator('[data-app-footer] [data-powered-by]');
  await expect(foot).toHaveText(CREDIT);
  await foot.scrollIntoViewIfNeeded();
  await expect(foot).toBeInViewport();
});

test('the credit is in French on a French screen (desk or phone)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('gem-lang', 'fr'); } catch { /* the check below fails if French did not apply */ } });
  await page.goto('/');
  await expect(credit(page)).toHaveText('Propulsé par Ekoteksolutions Inc.');
});

test('the payslip PDF credits Ekoteksolutions Inc. at its foot', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Pia', lastName: 'Payslip', role: 'trainer', salary: 90000 });
  await call('POST', '/payroll', { token: owner.token, body: { staffId: staff.id, month: thisMonth() } });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}?tab=pay`);
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Actions' }) }).first();
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Paystub' }).click(),
  ]);
  const pdf = fs.readFileSync(await download.path()).toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(pdf).toContain(CREDIT);
});

// GEM's support contacts wherever someone may be stuck (the owner, 30 October
// 2026): the foot of every screen and of the desk, the account menu, and page
// not found. The number is for WhatsApp only, never a call.
test("GEM support's WhatsApp and email are at the foot of every screen and wherever someone may be stuck (desk or phone)", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const support = (scope) => scope.locator('[data-support]').filter({ has: page.locator('a[href="https://wa.me/13439889766"]') });
  for (const path of ['/dashboard', '/front-desk']) {
    await page.goto(path);
    const line = support(page.locator('[data-app-footer]'));
    await expect(line, path).toContainText('Something not working? Contact GEM support: WhatsApp +1 343 988 9766 · marvin.ekokobe01@gmail.com');
    await expect(line.locator('a[href="mailto:marvin.ekokobe01@gmail.com"]'), path).toHaveCount(1);
    await expect(page.locator('a[href^="tel:"]'), path).toHaveCount(0);
  }
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Your account' }).click();
  // The menu's line joins the one at the foot of the page
  await expect(page.locator('[data-support]:visible')).toHaveCount(2);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.locator('[data-support]').filter({ hasText: '+1 343 988 9766' }).first()).toBeVisible();
});
