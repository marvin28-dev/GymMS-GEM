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

// F-158: the header's dropdown and the desk's bell said nothing when the
// server refused, and the header showed everything read anyway
test('a refused Mark all read in the header keeps them unread and says why', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.route('**/api/notifications/**', route => (route.request().method() === 'PATCH' || route.request().method() === 'PUT' || route.request().method() === 'POST' ? failWith(route) : route.fallback()));
  await page.locator('svg.lucide-bell').first().click();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible();
});

test('a refused Clear all in the header keeps the list and says why', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.route('**/api/notifications/all', route => (route.request().method() === 'DELETE' ? failWith(route) : route.fallback()));
  await page.locator('svg.lucide-bell').first().click();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible();
});

test('a refused Clear all on the desk bell keeps the list and says why', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/front-desk');
  await page.route('**/api/notifications/all', route => (route.request().method() === 'DELETE' ? failWith(route) : route.fallback()));
  await page.getByRole('button', { name: 'Notifications' }).first().click();
  await page.locator('[data-clear-all]').click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.locator('[data-clear-all]')).toBeVisible();
});

test('on the desk bell, notices the server did not mark read stay unread', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/front-desk');
  const bell = page.getByRole('button', { name: 'Notifications' }).first();
  await expect(bell.locator('span')).toHaveCount(1);
  await page.route('**/api/notifications/mark-read', route => failWith(route));
  await bell.click();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(bell.locator('span')).toHaveCount(1);
});
