// F-093: the manager code box is not a password field (browsers fill saved
// logins into those). F-136: the sign-in box says it holds the current
// password, so password managers fill and save it; a first password is new.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

test('the manager code box is a code box, not a password field', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Cody', lastName: 'Box' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'View Code' }).click();
  const box = page.getByPlaceholder('••••');
  await expect(box).toHaveAttribute('type', 'text');
  await expect(box).toHaveAttribute('autocomplete', 'off');
  await box.fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect(page.getByPlaceholder('••••')).toHaveCount(0);
});

async function signInBoxFor(page, owner, email) {
  await page.goto(`/${owner.gymCode}/login`);
  const box = page.locator('input[type="email"]').first();
  await expect(box).toHaveAttribute('autocomplete', 'username');
  await box.fill(email);
  await box.press('Enter');
  return page.locator('input[name="password"]').first();
}

test('the sign-in box is for the current password', async ({ page }) => {
  const owner = await registerGym();
  const password = await signInBoxFor(page, owner, owner.email);
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await expect(password).not.toHaveAttribute('data-lpignore', 'true');
});

test('choosing a first password is a new password', async ({ page }) => {
  const owner = await registerGym();
  // An employee added but not yet signed in has no password of their own
  const made = await call('POST', '/staff', { token: owner.token, body: { firstName: 'New', lastName: 'Starter', email: `new.${Date.now()}@example.test`, phone: '677000000', role: 'front_desk', city: 'Douala', region: 'Littoral' } });
  const password = await signInBoxFor(page, owner, made.email);
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
});
