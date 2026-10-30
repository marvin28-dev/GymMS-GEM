// F-120: the Staff list says when a (de)activation was refused, and a photo
// that could not be saved after adding someone is reported on their profile.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const failWith = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) });
// A 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('a refused deactivation from the list says why', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Listed', lastName: 'Worker' });
  await signIn(page, owner);
  await page.goto('/staff');
  await page.route(`**/api/staff/${staff.id}`, route => (route.request().method() === 'PATCH' ? failWith(route) : route.fallback()));
  await page.getByRole('row').filter({ hasText: 'Listed Worker' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(true);
});

test('a photo that failed after adding someone is reported on their profile', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/staff');
  await page.route('**/api/upload**', failWith);
  await page.getByRole('button', { name: 'Add Staff Member' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: PNG });
  await dialog.getByPlaceholder('First Name').fill('Photo');
  await dialog.getByPlaceholder('Last Name').fill('Problem');
  await dialog.locator('input[inputmode="tel"]').first().fill('677123456');
  await dialog.getByPlaceholder('email@gemgym.cm').fill(`photo.${Date.now()}@example.test`);
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Front Desk' }) }).first().selectOption({ label: 'Front Desk' });
  await dialog.locator('input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
  await dialog.locator('input[data-address="street"]').fill('Rue de la Joie');
  await dialog.locator('input[data-address="city"]').fill('Douala');
  await dialog.locator('input[data-address="region"]').fill('Littoral');
  await dialog.getByRole('button', { name: 'Add Staff Member' }).click();

  await expect(page).toHaveURL(/\/staff\/[a-z0-9]+$/);
  await expect(page.getByText('The employee was added, but their photo could not be saved. Add it from this profile.').first()).toBeVisible();
});
