// F-120: a new member is created with the photo chosen for them. When the
// photo cannot be uploaded, nothing is saved yet and the form says so.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const failWith = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Upload service down for the test' }) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function fillNewMember(page, lastName) {
  await page.getByRole('button', { name: 'Add Member' }).first().click();
  const d = page.getByRole('dialog');
  await d.locator('input[type="file"]').first().setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: PNG });
  await d.getByPlaceholder('First Name').fill('Photo');
  await d.getByPlaceholder('Last Name').fill(lastName);
  await d.locator('select', { has: page.locator('option', { hasText: 'Female' }) }).selectOption({ label: 'Female' });
  await d.getByPlaceholder('email@example.com').fill(`${lastName.toLowerCase()}.${Date.now()}@example.test`);
  await d.locator('input[inputmode="tel"]').nth(0).fill('677445566');
  await d.getByPlaceholder('Full name').fill('Next Of Kin');
  await d.locator('input[inputmode="tel"]').nth(1).fill('677998877');
  await d.locator('input[autocomplete="street-address"]').fill('Rue du Marché');
  await d.locator('input[autocomplete="address-level2"]').fill('Douala');
  await d.locator('input[autocomplete="address-level1"]').fill('Littoral');
  await d.locator('select', { has: page.locator('option', { hasText: 'Select package...' }) }).selectOption({ index: 1 });
  await d.locator('input[type="date"][min]').first().fill(localDay());
  await d.locator('select', { has: page.locator('option', { hasText: 'Walk-in' }) }).selectOption({ label: 'Walk-in' });
  return d;
}

async function gymWithPackage() {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: false } });
  await call('POST', '/packages', { token: owner.token, body: { name: 'Photo Plan', price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
  return owner;
}

test('a member whose photo could not be uploaded is not created yet', async ({ page }) => {
  const owner = await gymWithPackage();
  await signIn(page, owner);
  await page.goto('/members');
  await page.route('**/api/upload**', failWith);
  const d = await fillNewMember(page, 'Refused');
  await d.getByRole('button', { name: 'Create Member →' }).click();

  await expect(d.getByText('Upload service down for the test')).toBeVisible();
  const members = await call('GET', '/members', { token: owner.token });
  expect(members.some(m => m.lastName === 'Refused')).toBe(false);
});

test('a new member is created with their photo', async ({ page }) => {
  const owner = await gymWithPackage();
  await signIn(page, owner);
  await page.goto('/members');
  const d = await fillNewMember(page, 'Pictured');
  await d.getByRole('button', { name: 'Create Member →' }).click();

  // The new member's profile opens once they are created
  await expect(page.getByRole('heading', { name: 'Photo Pictured' })).toBeVisible();
  const members = await call('GET', '/members', { token: owner.token });
  const made = members.find(m => m.lastName === 'Pictured');
  expect(made).toBeTruthy();
  expect((await call('GET', `/members/${made.id}`, { token: owner.token })).photo).toMatch(/^https:\/\/res\.cloudinary\.test\//);
});

test('a refused check-in right after adding a visitor says why', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Five Visits', price: 5000, sessions: 5, isVisitor: true, durationDays: 30, status: 'active' } });
  await signIn(page, owner);
  await page.goto('/members');
  await page.route('**/api/attendance/checkin', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Refused at the door for the test' }) }));
  await page.getByRole('button', { name: 'Add Visitor' }).first().click();
  const d = page.getByRole('dialog');
  await d.getByPlaceholder('First Name').fill('Door');
  await d.getByPlaceholder('Last Name').fill('Visitor');
  await d.locator('select', { has: page.locator('option', { hasText: 'Female' }) }).selectOption({ label: 'Female' });
  await d.getByPlaceholder('email@example.com').fill(`door.${Date.now()}@example.test`);
  await d.locator('input[inputmode="tel"]').nth(0).fill('677445566');
  await d.getByPlaceholder('Full name').fill('Next Of Kin');
  await d.locator('input[inputmode="tel"]').nth(1).fill('677998877');
  await d.locator('input[autocomplete="street-address"]').fill('Rue du Marché');
  await d.locator('input[autocomplete="address-level2"]').fill('Douala');
  await d.locator('input[autocomplete="address-level1"]').fill('Littoral');
  await d.getByText('Five Visits').click();
  await d.getByRole('button', { name: 'Collect payment' }).click();
  await d.getByRole('button', { name: /Confirm Payment/ }).click();
  await d.locator('select', { has: page.locator('option', { hasText: 'Walk-in' }) }).selectOption({ label: 'Walk-in' });
  await d.getByRole('button', { name: 'Create Visitor →' }).click();
  await d.getByRole('button', { name: 'Check in now' }).click();

  await expect(d.getByText('Refused at the door for the test')).toBeVisible();
  await expect(d.getByRole('button', { name: 'Check in now' })).toBeVisible();
});
