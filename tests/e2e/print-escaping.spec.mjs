// F-085: what people type is printed as text, never run as page code. The
// print windows share the app's origin, so a script in them could read the
// signed-in session.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, stubPrinting } from './support/session.mjs';

const payload = (tag) => `<img src=x onerror="document.body.dataset.xss='${tag}'">`;

test('an expense prints its title, payee and note as text', async ({ page }) => {
  const owner = await registerGym();
  const title = `Rent ${payload('title')}`;
  await call('POST', '/expenses', {
    token: owner.token,
    body: { title, category: 'Rent', amount: 15000, date: new Date().toISOString().slice(0, 10), paidTo: payload('paidTo'), method: 'cash', note: payload('note') },
  });
  await signIn(page, owner);
  await stubPrinting(page);
  await page.goto('/accounting');
  const row = page.getByRole('row').filter({ hasText: 'Rent <img' });
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  await popup.waitForLoadState();
  expect(await popup.locator('img[src="x"]').count()).toBe(0);
  await expect(popup.getByText(title)).toBeVisible();
  await expect(popup.getByText(payload('paidTo'))).toBeVisible();
  await expect(popup.getByText(payload('note'))).toBeVisible();
  expect(await popup.evaluate(() => document.body.dataset.xss || null)).toBeNull();
});

test('the members export prints names as text', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', {
    token: owner.token,
    body: { firstName: payload('name'), lastName: 'Zedprint', city: 'Douala', region: 'Littoral', startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), regFeeMethod: 'cash' },
  });
  await signIn(page, owner);
  await stubPrinting(page);
  await page.goto('/members');
  await expect(page.getByText('Zedprint').first()).toBeVisible();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /export/i }).first().click(),
  ]);
  await popup.waitForLoadState();
  expect(await popup.locator('img[src="x"]').count()).toBe(0);
  await expect(popup.getByText(payload('name'))).toBeVisible();
  expect(await popup.evaluate(() => document.body.dataset.xss || null)).toBeNull();
});
