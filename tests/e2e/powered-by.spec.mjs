// "Powered by Ekoteksolutions Inc." as the owner asked: kept quiet, at the foot
// of the public pages and of the account menu, never in the sidebar or the
// middle of a form. The payslip PDF is checked here; the emails and the
// receipt PDF by tests/api/member-emails.test.mjs.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

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

test('the app credits Ekoteksolutions Inc. in the account menu, and nowhere else on screen (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Your account' })).toBeVisible();
  await expect(page.locator('[data-powered-by]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Your account' }).click();
  await expect(credit(page)).toHaveText(CREDIT);
  await expect(credit(page)).toBeInViewport();
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
