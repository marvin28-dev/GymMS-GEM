// "Powered by Ekoteksolutions" wherever GEM introduces itself (asked for by the
// owner on 26 October 2026): the public pages, the foot of the app's menu and
// the payslip PDF. The emails and the receipt PDF are checked by
// tests/api/member-emails.test.mjs.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const credit = (page) => page.locator('[data-powered-by]:visible').first();
const thisMonth = () => { const d = new Date(); return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`; };

test('the public pages credit Ekoteksolutions (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  for (const path of ['/', '/signup', '/login', `/${owner.gymCode}/login`]) {
    await page.goto(path);
    await expect(credit(page), path).toHaveText('Powered by Ekoteksolutions');
  }
});

test("the app credits Ekoteksolutions at the foot of its menu (desk or phone)", async ({ page, isMobile }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  if (isMobile) await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(credit(page)).toHaveText('Powered by Ekoteksolutions');
  await credit(page).scrollIntoViewIfNeeded();
  await expect(credit(page)).toBeInViewport();
});

test('the credit is in French on a French screen (desk or phone)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('gem-lang', 'fr'); } catch { /* the check below fails if French did not apply */ } });
  await page.goto('/');
  await expect(credit(page)).toHaveText('Propulsé par Ekoteksolutions');
});

test('the payslip PDF credits Ekoteksolutions at its foot', async ({ page }) => {
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
  expect(pdf).toContain('Powered by Ekoteksolutions');
});
