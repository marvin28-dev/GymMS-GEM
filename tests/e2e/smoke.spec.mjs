// The harness itself: a new gym's owner opens the app signed in and lands on
// their dashboard, and the sign-in page works with a real password.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

test('a new owner opens the dashboard signed in', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByText(owner.user.gymName || `E2E Gym ${owner.gymCode}`).first()).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('the owner signs in through the sign-in page', async ({ page }) => {
  const owner = await registerGym();
  await page.goto(`/${owner.gymCode}/login`);
  await page.getByPlaceholder(/email/i).fill(owner.email);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/password/i).first().fill(owner.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
