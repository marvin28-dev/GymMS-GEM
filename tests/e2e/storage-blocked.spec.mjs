// F-082: a browser that refuses site storage (Firefox with cookies blocked
// for the site, some private modes) throws on any use of localStorage. The
// first reads were unguarded, so such a browser got a blank page.
import { test, expect } from '@playwright/test';
import { registerGym } from './support/session.mjs';

const blockStorage = (page) => page.addInitScript(() => {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
  }
});

test('with site storage blocked, the public pages still show', async ({ page }) => {
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, r => r.abort());
  const owner = await registerGym();
  await blockStorage(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const path of ['/', '/login', `/${owner.gymCode}/login`, '/signup']) {
    await page.goto(path);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('with site storage blocked, signing in says what to allow instead of failing', async ({ page }) => {
  const owner = await registerGym();
  await blockStorage(page);
  await page.goto(`/${owner.gymCode}/login`);
  await page.getByPlaceholder('Enter your email').fill(owner.email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Enter your password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('This browser is blocking site storage, which GEM needs to keep you signed in.', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${owner.gymCode}/login$`));
});
