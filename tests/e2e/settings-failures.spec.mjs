// F-120: Settings says when the server refused the gym profile save.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const fieldAfter = (page, label) => page.getByText(label, { exact: true }).locator('xpath=..').locator('input');

test('a refused gym profile save says why', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  // The form is filled from the server once the gym has loaded
  await expect(fieldAfter(page, 'Gym Name *')).toHaveValue(/E2E Gym/);
  await page.route('**/api/gyms/me', route => (route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
    : route.fallback()));
  await fieldAfter(page, 'Website').fill('https://refused.example.test');
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('✓ Saved successfully')).toHaveCount(0);
});

test('a gym profile save the server made is confirmed', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  // The form is filled from the server once the gym has loaded
  await expect(fieldAfter(page, 'Gym Name *')).toHaveValue(/E2E Gym/);
  await fieldAfter(page, 'Website').fill('https://saved.example.test');
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect(page.getByText(/Saved successfully/)).toBeVisible();
  expect((await call('GET', '/gyms/me', { token: owner.token })).website).toBe('https://saved.example.test');
});
