// F-107, F-102: the Notifications page removes a notice only when the server
// did, and says when the list could not be loaded instead of "No notifications".
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const failWith = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) });

test('a refused delete keeps the notification and says why', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/notifications');
  const first = page.getByRole('button', { name: 'Actions' }).first();
  await expect(first).toBeVisible();
  const before = await page.getByRole('button', { name: 'Actions' }).count();

  await page.route('**/api/notifications/*', route => (route.request().method() === 'DELETE' ? failWith(route) : route.fallback()));
  await first.click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(before);
});

test('a delete the server made removes the notification', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/notifications');
  await expect(page.getByRole('button', { name: 'Actions' }).first()).toBeVisible();
  const before = await page.getByRole('button', { name: 'Actions' }).count();
  await page.getByRole('button', { name: 'Actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(before - 1);
  expect((await call('GET', '/notifications', { token: owner.token })).length).toBe(before - 1);
});

test('a list that could not be loaded is not shown as empty', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.route('**/api/notifications', route => (route.request().method() === 'GET' ? failWith(route) : route.fallback()));
  await page.goto('/notifications');
  await expect(page.getByText('Could not load your notifications. Try again in a moment.')).toBeVisible();
  await expect(page.getByText('No notifications', { exact: true })).toHaveCount(0);
});
