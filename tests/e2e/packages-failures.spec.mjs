// F-120: the Packages page says when the server refused a save or a delete.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const failWith = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) });

test('a refused package save stays in the form with the reason', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/packages');
  await page.route('**/api/packages', route => (route.request().method() === 'POST' ? failWith(route) : route.fallback()));
  await page.getByRole('button', { name: 'Add Package' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g. Premium 12M').fill('Gold Monthly');
  const amounts = dialog.getByPlaceholder('0.00');
  await amounts.nth(0).fill('20000');
  await amounts.nth(1).fill('2000');
  await dialog.getByRole('button', { name: 'Add Package' }).click();

  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  await expect(dialog.getByPlaceholder('e.g. Premium 12M')).toHaveValue('Gold Monthly');
});

test('a refused package delete keeps the package and says why', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Silver Monthly', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  await signIn(page, owner);
  await page.goto('/packages');
  await page.route('**/api/packages/*', route => (route.request().method() === 'DELETE' ? failWith(route) : route.fallback()));
  const row = page.getByRole('row').filter({ hasText: 'Silver Monthly' });
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: /delete/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Silver Monthly' })).toBeVisible();
});
