// F-088: a session the server no longer accepts goes back to the gym's own
// sign-in page, not the generic one that asks for the gym code first.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

test("an expired session returns to the gym's own sign-in page", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.route('**/api/members**', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token expired' }) }));
  await page.goto('/members');
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));
});
