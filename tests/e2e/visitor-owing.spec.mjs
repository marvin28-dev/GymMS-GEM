// D-42: the Add Visitor form asked "Rest due by" for a bundle paid in part,
// and the date was never saved. It now says what is left to pay, and the
// visitor is added owing it.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, uniqueCode } from './support/session.mjs';

test('a visitor paid in part is added owing the rest, with no date that is never kept', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Ten Visits', price: 10000, sessions: 10, isVisitor: true, durationDays: 30, status: 'active' } });
  const lastName = `Owing${uniqueCode('v').slice(-5)}`;
  await signIn(page, owner);
  await page.goto('/members');
  await page.getByRole('button', { name: 'Add Visitor' }).first().click();
  const d = page.getByRole('dialog');
  await d.getByPlaceholder('First Name').fill('Vera');
  await d.getByPlaceholder('Last Name').fill(lastName);
  await d.locator('select', { has: page.locator('option', { hasText: 'Female' }) }).selectOption({ label: 'Female' });
  await d.getByPlaceholder('email@example.com').fill(`${lastName.toLowerCase()}@example.test`);
  await d.locator('input[inputmode="tel"]').nth(0).fill('677445566');
  await d.getByPlaceholder('Full name').fill('Next Of Kin');
  await d.locator('input[inputmode="tel"]').nth(1).fill('677998877');
  await d.locator('input[data-address="street"]').fill('Rue du Marché');
  await d.locator('input[data-address="city"]').fill('Douala');
  await d.locator('input[data-address="region"]').fill('Littoral');
  await d.getByText('Ten Visits').click();
  await d.getByRole('button', { name: 'Collect payment' }).click();
  await d.locator('input[inputmode="numeric"]').last().fill('6000');
  await d.getByRole('button', { name: /Confirm Payment/ }).click();

  await expect(d.getByText('The visitor will be active, owing', { exact: false })).toBeVisible();
  await expect(d.getByText('Rest due by')).toHaveCount(0);
  await d.locator('select', { has: page.locator('option', { hasText: 'Walk-in' }) }).selectOption({ label: 'Walk-in' });
  await d.getByRole('button', { name: /Add Visitor|Create/ }).last().click();
  await expect.poll(async () => (await call('GET', '/members', { token: owner.token })).find(m => m.lastName === lastName)?.balance).toBe(4000);
});
