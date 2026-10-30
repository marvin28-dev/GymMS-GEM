// F-093: the manager code box is not a password field (browsers fill saved
// logins into those). The owner asked on 30 October 2026 that the browser fill
// in nothing on its own: not the sign-in pages, not sign-up, not any form, not
// the password that shows your own code. utils/autofillGuard.js marks every box
// "off", and a password box "new-password", the one mark browsers do not fill
// a saved password into.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const NOT_TYPED = ['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];

// Every box on the page the browser would fill on its own, if any
async function boxesTheBrowserFills(page) {
  return page.evaluate((notTyped) => [...document.querySelectorAll('input, textarea, select')]
    .filter(el => !notTyped.includes(el.type))
    .filter(el => el.getAttribute('autocomplete') !== (el.type === 'password' ? 'new-password' : 'off'))
    .map(el => `${el.tagName.toLowerCase()} ${el.type} "${el.name || el.placeholder}": ${el.getAttribute('autocomplete')}`), NOT_TYPED);
}

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
  await expect(box).toHaveAttribute('autocomplete', 'off');
  await box.fill(email);
  await box.press('Enter');
  return page.locator('input[name="password"]').first();
}

test('the browser fills in nothing on the sign-in pages (desk or phone)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByPlaceholder('e.g. elite-fitness')).toBeVisible();
  expect(await boxesTheBrowserFills(page)).toEqual([]);

  const owner = await registerGym();
  const password = await signInBoxFor(page, owner, owner.email);
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  expect(await boxesTheBrowserFills(page)).toEqual([]);
});

test('choosing a first password is a new password', async ({ page }) => {
  const owner = await registerGym();
  // An employee added but not yet signed in has no password of their own
  const made = await call('POST', '/staff', { token: owner.token, body: { firstName: 'New', lastName: 'Starter', email: `new.${Date.now()}@example.test`, phone: '677000000', role: 'front_desk', city: 'Douala', region: 'Littoral' } });
  const password = await signInBoxFor(page, owner, made.email);
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  expect(await boxesTheBrowserFills(page)).toEqual([]);
});

test('the browser fills in nothing on sign-up or in the forms inside the app (desk or phone)', async ({ page }) => {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Start free trial' }).click();
  await expect(page.locator('input').first()).toBeVisible();
  expect(await boxesTheBrowserFills(page)).toEqual([]);

  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/members');
  await page.getByRole('button', { name: 'Add Member' }).first().click();
  await expect(page.getByRole('dialog').locator('input[data-address="street"]')).toBeVisible();
  expect(await boxesTheBrowserFills(page)).toEqual([]);

  await page.goto('/settings?section=gym-profile');
  await expect(page.locator('[data-save-gym-profile]')).toBeVisible();
  expect(await boxesTheBrowserFills(page)).toEqual([]);
});

test('the password that shows your own code is not filled in by the browser', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/my-profile');
  await page.getByRole('button', { name: 'View Code' }).click();
  const box = page.getByRole('dialog').locator('input').first();
  await expect(box).toHaveAttribute('type', 'password');
  await expect(box).toHaveAttribute('autocomplete', 'new-password');
});
