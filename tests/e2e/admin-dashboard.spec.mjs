// GEM's admin dashboard (the owner, 20 November 2026): its own sign-in, every
// gym, pausing an account (the gym's staff see why), a month's bills from
// draft to paid with the owner seeing them in Settings, leads from the landing
// page's "Book a free demo", answering problem reports, and every screen
// readable in both themes.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { registerGym, signIn, signInAdmin, adminToken, backdateGym, call, mailTo, uniqueCode, ADMIN } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

// Requests from this page come from an address of their own, so the sign-in
// and demo-form limits per address belong to this test alone
let addr = 0;
const ownAddress = (page) => page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.250.${process.pid % 250}.${(addr += 1) % 250}` });

// The admin menu is a sidebar on a computer and behind a button on a phone
async function openNav(page, key) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.locator(`[data-admin-nav="${key}"]`).click();
}

const member = (owner, firstName) => call('POST', '/members', {
  token: owner.token,
  body: { firstName, lastName: 'Billed', city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) },
});

test('GEM\'s admin signs in apart from any gym, and sees every gym and its details (desk or phone)', async ({ page }) => {
  await ownAddress(page);
  const owner = await registerGym();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('[data-admin-login] [role="alert"]')).toHaveText('That email and password do not match.');
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.locator('[data-stat="gyms"]')).toBeVisible();
  // A gym's session never opens the dashboard: this is the admin's own
  expect(await page.evaluate(() => localStorage.getItem('gem_auth'))).toBeNull();

  await openNav(page, 'navGyms');
  await page.getByPlaceholder('Search gyms, owners, cities').fill(owner.gymCode);
  const row = page.locator(`[data-gym-row="${owner.gymCode}"]`);
  await expect(row.locator('[data-gym-state]')).toHaveText('Trial: 7 days left');
  await row.click({ position: { x: 24, y: 14 } });
  await expect(page.locator(`[data-admin-gym="${owner.gymCode}"]`)).toBeVisible();
  await expect(page.getByRole('link', { name: owner.email })).toBeVisible();

  // Its own price per member
  await page.locator('#plan-rate').fill('200');
  await page.locator('[data-save-rate]').click();
  await expect(page.locator('[data-plan-card] [role="status"]')).toHaveText('Saved.');
  await expect(page.locator('[data-plan-card]')).toContainText('Pays 200 FCFA a member a month');

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize().width);
});

test('a paused gym\'s owner sees why and what is due, and is let back in once GEM reopens it (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const token = await adminToken();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.locator('main')).toBeVisible();
  await call('POST', `/admin/gyms/${owner.user.gymId}/lock`, { token, body: { reason: 'November bill unpaid' } });

  // The first refused request moves the page itself, which can cut this one short
  await page.goto('/members').catch(() => {});
  await expect(page).toHaveURL(/\/account-paused$/);
  await expect(page.locator('[data-paused-reason]')).toContainText('November bill unpaid');
  await expect(page.getByText('Nothing to pay right now.')).toBeVisible();
  await expect(page.locator('a[href^="https://wa.me/"]')).toBeVisible();
  await expect.poll(async () => (await mailTo(owner.email)).some(m => m.subject.startsWith('Your GEM account for'))).toBe(true);

  await call('POST', `/admin/gyms/${owner.user.gymId}/unlock`, { token });
  // The screen hears it is reopened; "Check again" does the same by hand
  const again = page.locator('[data-check-again]');
  if (await again.isVisible().catch(() => false)) await again.click().catch(() => {});
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a month\'s bill is prepared, changed, sent, seen by the gym\'s owner in Settings, and marked paid', async ({ page, context }) => {
  const owner = await registerGym();
  await member(owner, 'Ann');
  await member(owner, 'Ben');
  await backdateGym(owner.gymCode);
  await signInAdmin(page);
  await page.goto('/admin/billing');
  await page.locator('[data-prepare]').click();
  await expect(page.locator('[data-notice]')).toContainText('prepared');
  await page.getByPlaceholder('Search by gym').fill(owner.gymCode);
  const row = page.locator(`[data-bill-row="${owner.gymCode}"]`);
  await expect(row.locator('[data-bill-state]')).toHaveAttribute('data-bill-state', 'draft');
  await expect(row).toContainText('500 FCFA');

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.locator('[data-edit-bill]');
  await edit.getByLabel('Discount').fill('100');
  await expect(edit.locator('[data-bill-amount]')).toHaveText('400 FCFA');
  await page.locator('[data-edit-save]').click();
  await expect(row).toContainText('400 FCFA');

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Send', exact: true }).click();
  await page.getByRole('dialog', { name: 'Send this bill?' }).getByRole('button', { name: 'Send' }).click();
  await expect(row.locator('[data-bill-state]')).toHaveAttribute('data-bill-state', 'sent');
  await expect.poll(async () => (await mailTo(owner.email)).some(m => m.subject.startsWith('Your GEM bill for'))).toBe(true);

  // The owner signs in on another tab of the same browser: the admin's tab
  // stays on the dashboard (it used to be sent to the gym's home)
  const ownerPage = await context.newPage();
  await signIn(ownerPage, owner);
  await ownerPage.goto('/settings?section=billing');
  const bill = ownerPage.locator('[data-gem-billing] [data-gem-bill]').first();
  await expect(bill).toContainText('400 FCFA');
  await expect(bill.locator('[data-bill-state]')).toHaveAttribute('data-bill-state', 'sent');

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Mark paid' }).click();
  await page.locator('[data-paid-save]').click();
  await expect(row.locator('[data-bill-state]')).toHaveAttribute('data-bill-state', 'paid');
  await ownerPage.reload();
  await expect(ownerPage.locator('[data-gem-billing] [data-gem-bill]').first().locator('[data-bill-state]')).toHaveAttribute('data-bill-state', 'paid');
});

test('a gym asking for a demo on the landing page is a lead on the dashboard, and moves on a stage (desk or phone)', async ({ page, context }) => {
  await ownAddress(page);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
  const gymName = `Iron Club ${uniqueCode('l')}`;
  await page.goto('/');
  await page.locator('[data-demo-link]').click();
  const form = page.locator('[data-demo-form]');
  await form.locator('[data-demo-send]').click();
  await expect(form.locator('[data-field-error]')).toHaveText(['Tell us your name.', 'Tell us your gym’s name.', 'Give an email or a phone number so we can reach you.']);
  await form.getByLabel('Your name').fill('Paul Prospect');
  await form.getByLabel('Gym name').fill(gymName);
  await form.getByLabel('Phone or WhatsApp').fill('+237 677 111 222');
  await form.getByLabel('About how many members?').fill('120');
  await form.locator('[data-demo-send]').click();
  await expect(page.locator('[data-demo-sent]')).toContainText('Thank you!');

  const admin = await context.newPage();
  await signInAdmin(admin);
  await admin.goto('/admin/leads');
  const lead = admin.locator('[data-lead-row]').filter({ hasText: gymName });
  await expect(lead).toHaveAttribute('data-lead-row', 'new');
  await lead.getByText(gymName).click();
  const modal = admin.locator('[data-lead-form]');
  await modal.getByLabel('Stage').selectOption('contacted');
  await modal.locator('[data-lead-save]').click();
  await expect(admin.locator('[data-lead-row]').filter({ hasText: gymName })).toHaveAttribute('data-lead-row', 'contacted');
});

test('a problem a gym reports is answered from the dashboard, and the answer shows on the gym\'s Support page (desk or phone)', async ({ page, context }) => {
  const owner = await registerGym();
  const subject = `Printer jams ${uniqueCode('p')}`;
  await call('POST', '/support', { token: owner.token, body: { kind: 'problem', subject, message: 'Every morning it jams.' } });
  await signInAdmin(page);
  await page.goto('/admin/problems');
  await page.locator('[data-report]').filter({ hasText: subject }).click();
  const detail = page.locator('[data-report-detail]');
  await expect(detail).toContainText('Every morning it jams.');
  await detail.locator('#report-reply').fill('Fixed: update the printer driver.');
  await detail.locator('[data-send-reply]').click();
  await expect(detail.getByRole('status')).toHaveText('Answer sent.');

  const gymPage = await context.newPage();
  await signIn(gymPage, owner);
  await gymPage.goto('/support');
  const report = gymPage.locator('[data-support-report]').filter({ hasText: subject });
  await expect(report.locator('[data-support-status]')).toHaveAttribute('data-support-status', 'resolved');
  await expect(report.locator('[data-support-reply]')).toContainText('Fixed: update the printer driver.');
  await expect.poll(async () => (await mailTo(owner.email)).some(m => m.subject === `Re: ${subject}`)).toBe(true);
});

async function problems(page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`);
}

for (const theme of ['dark', 'light']) {
  test(`every admin screen passes axe in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((th) => { try { localStorage.setItem('gem-theme', th); } catch { /* the check below fails if it did not apply */ } }, theme);
    const owner = await registerGym();
    await page.goto('/admin/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await problems(page), '/admin/login').toEqual([]);
    await signInAdmin(page);
    for (const path of ['/admin', '/admin/gyms', `/admin/gyms/${owner.user.gymId}`, '/admin/billing', '/admin/leads', '/admin/problems', '/admin/announcements', '/admin/settings']) {
      await page.goto(path);
      // WebKit here can take over 10 s to draw the next page after axe has
      // worked through a list of 200 gyms (the test database holds thousands);
      // on its own each page draws in one or two seconds
      await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(500);
      expect(await problems(page), path).toEqual([]);
    }
  });
}
