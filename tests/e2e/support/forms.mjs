// Filling the Add Member form the way the staff do, shared by the tests that
// add someone (desktop and phone use the same form).
import { registerGym, call } from './session.mjs';

// A 1x1 PNG
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// `open` is whatever opens the form on the page in use (the Members page by default)
export async function fillNewMember(page, lastName, open = () => page.getByRole('button', { name: 'Add Member' }).first().click()) {
  await open();
  const d = page.getByRole('dialog');
  await d.locator('input[type="file"]').first().setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: PNG });
  await d.getByPlaceholder('First Name').fill('Photo');
  await d.getByPlaceholder('Last Name').fill(lastName);
  await d.locator('select', { has: page.locator('option', { hasText: 'Female' }) }).selectOption({ label: 'Female' });
  await d.getByPlaceholder('email@example.com').fill(`${lastName.toLowerCase()}.${Date.now()}@example.test`);
  await d.locator('input[inputmode="tel"]').nth(0).fill('677445566');
  await d.getByPlaceholder('Full name').fill('Next Of Kin');
  await d.locator('input[inputmode="tel"]').nth(1).fill('677998877');
  await d.locator('input[data-address="street"]').fill('Rue du Marché');
  await d.locator('input[data-address="city"]').fill('Douala');
  await d.locator('input[data-address="region"]').fill('Littoral');
  await d.locator('select', { has: page.locator('option', { hasText: 'Select package...' }) }).selectOption({ index: 1 });
  await d.locator('input[type="date"][min]').first().fill(localDay());
  await d.locator('select', { has: page.locator('option', { hasText: 'Walk-in' }) }).selectOption({ label: 'Walk-in' });
  return d;
}

// The Add Visitor form up to Create, with the bundle named and its price
// collected first
export async function fillNewVisitor(page, lastName, bundle, open = () => page.getByRole('button', { name: 'Add Visitor' }).first().click()) {
  await open();
  const d = page.getByRole('dialog');
  await d.getByPlaceholder('First Name').fill('Vera');
  await d.getByPlaceholder('Last Name').fill(lastName);
  await d.locator('select', { has: page.locator('option', { hasText: 'Female' }) }).selectOption({ label: 'Female' });
  await d.getByPlaceholder('email@example.com').fill(`${lastName.toLowerCase()}.${Date.now()}@example.test`);
  await d.locator('input[inputmode="tel"]').nth(0).fill('677445566');
  await d.getByPlaceholder('Full name').fill('Next Of Kin');
  await d.locator('input[inputmode="tel"]').nth(1).fill('677998877');
  await d.locator('input[data-address="street"]').fill('Rue du Marché');
  await d.locator('input[data-address="city"]').fill('Douala');
  await d.locator('input[data-address="region"]').fill('Littoral');
  await d.getByText(bundle).click();
  await d.getByRole('button', { name: 'Collect payment' }).click();
  await d.getByRole('button', { name: /Confirm Payment/ }).click();
  await d.locator('select', { has: page.locator('option', { hasText: 'Walk-in' }) }).selectOption({ label: 'Walk-in' });
  return d;
}

// A gym with one package and no registration fee, so the form can be completed
export async function gymWithPackage() {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: false } });
  await call('POST', '/packages', { token: owner.token, body: { name: 'Photo Plan', price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
  return owner;
}
