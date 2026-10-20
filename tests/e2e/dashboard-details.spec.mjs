// F-123: Dashboard details. "Active" counts the way the Members page's Active
// tab does, the mini calendar starts on Monday and does not pretend its days
// can be clicked, and the code box is the shared code input.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('a visitor with passes counts as active, as on the Members page', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Ada', lastName: 'Active', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Vik', lastName: 'Visitor', city: 'Douala', region: 'Littoral', isVisitor: true, status: 'visitor', passesTotal: 3, passesRemaining: 3, startDate: day(), endDate: day(30), initialPayment: { amount: 3000, method: 'cash' } } });
  await signIn(page, owner);
  // The count is worked out from the member list, so it is read once that list has come
  const members = page.waitForResponse(r => /\/api\/members(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.ok());
  await page.goto('/dashboard');
  await members;
  await expect(page.getByText('2 active').first()).toBeVisible();
});

test('the mini calendar starts on Monday and its days do not look clickable', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  const mon = page.getByText('Mon', { exact: true }).first();
  const sun = page.getByText('Sun', { exact: true }).first();
  await expect(mon).toBeVisible();
  expect((await mon.boundingBox()).x).toBeLessThan((await sun.boundingBox()).x);
  const today = String(new Date().getDate());
  const cell = page.getByText(today, { exact: true }).locator('xpath=..').first();
  expect(await cell.evaluate(el => getComputedStyle(el).cursor)).not.toBe('pointer');
});

test('the check-in code box is the shared code input', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Nora', lastName: 'Nophoto', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Check In', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Quick Check-In' });
  await expect(async () => {
    await dialog.getByPlaceholder('Type code, name, phone, or ID...').fill('');
    await dialog.getByPlaceholder('Type code, name, phone, or ID...').fill('Nophoto');
    await expect(dialog.getByText('Nora Nophoto')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(dialog.locator('input[data-1p-ignore="true"]')).toHaveCount(1);
});
