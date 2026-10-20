// F-127: package access types and the shop's categories are the gym's, not one
// browser's; and Settings says "Copied" only when the gym code was copied.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const settingsOf = async (owner) => (await call('GET', '/gyms/me', { token: owner.token })).settings || {};

test('an access type added in Settings is offered on Packages in another browser', async ({ page, browser }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=packages');
  await page.getByPlaceholder('e.g. Cardio Zone Only').fill('Climbing wall');
  await page.getByPlaceholder('e.g. Cardio Zone Only').press('Enter');
  await expect.poll(async () => (await settingsOf(owner)).accessTypes || []).toContain('Climbing wall');

  // A computer that never saw Settings
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await signIn(fresh, owner);
  await fresh.goto('/packages');
  await fresh.getByRole('button', { name: 'Add Package' }).first().click();
  await expect(fresh.getByRole('dialog').getByText('Climbing wall')).toBeVisible();
  await other.close();
});

test('the desk adds a product category to the gym, and a refusal says why', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Cat', lastName: 'Egory' });
  await signIn(page, desk);
  await page.goto('/sales');
  const name = page.getByPlaceholder('New category name...');
  await name.fill('Towels');
  await name.press('Enter');
  await expect.poll(async () => (await settingsOf(owner)).productCategories || []).toContain('Towels');

  await page.route('**/api/gyms/me/product-categories', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) }));
  await name.fill('Gloves');
  await name.press('Enter');
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  expect((await settingsOf(owner)).productCategories).not.toContain('Gloves');
});

test('Copy says so when the gym code could not be copied', async ({ page }) => {
  const owner = await registerGym();
  await page.addInitScript(() => {
    if (navigator.clipboard) navigator.clipboard.writeText = () => Promise.reject(new Error('blocked for the test'));
  });
  await signIn(page, owner);
  await page.goto('/settings?section=gym-identity');
  await page.getByRole('button', { name: 'Reveal' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Not copied' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copied' })).toHaveCount(0);
});
