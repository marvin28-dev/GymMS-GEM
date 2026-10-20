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

test('a late answer to an earlier load does not wipe what was typed', async ({ page }) => {
  const owner = await registerGym();
  // The first gym load answers last, after the form was filled and typed in
  let first = true;
  let lateDone;
  const late = new Promise(resolve => { lateDone = resolve; });
  await page.route('**/api/gyms/me', async route => {
    if (route.request().method() !== 'GET' || !first) return route.fallback();
    first = false;
    const response = await route.fetch();
    await new Promise(r => setTimeout(r, 2500));
    await route.fulfill({ response });
    lateDone();
  });
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  await expect(fieldAfter(page, 'Gym Name *')).toHaveValue(/E2E Gym/);
  await fieldAfter(page, 'Website').fill('https://typed.example.test');
  await late;
  // Give the late answer time to reach the screen
  await page.waitForTimeout(500);
  await expect(fieldAfter(page, 'Website')).toHaveValue('https://typed.example.test');
});
