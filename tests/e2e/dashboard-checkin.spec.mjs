// F-113: the Dashboard's quick check-in offers every member who matches what
// was typed, and checks in only the one picked.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const PHOTO = 'https://res.cloudinary.test/gem/members/face.png';
const visits = async (owner, id) => ((await call('GET', `/members/${id}`, { token: owner.token })).attendances || []).length;

test('two members with the same name are both offered, and only the one picked is checked in', async ({ page }) => {
  const owner = await registerGym();
  const body = { firstName: 'John', lastName: 'Smith', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), photo: PHOTO };
  const first = await call('POST', '/members', { token: owner.token, body });
  const second = await call('POST', '/members', { token: owner.token, body });
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Check In', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Quick Check-In' });
  await expect(async () => {
    await dialog.getByPlaceholder('Type code, name, phone, or ID...').fill('');
    await dialog.getByPlaceholder('Type code, name, phone, or ID...').fill('John Smith');
    await expect(dialog.getByText('2 people match. Pick one:')).toBeVisible({ timeout: 1000 });
  }).toPass();

  await dialog.locator('[data-match-list] button').filter({ hasText: second.memberCode }).click();
  await dialog.getByRole('button', { name: 'Check In', exact: true }).click();

  await expect.poll(() => visits(owner, second.id)).toBe(1);
  expect(await visits(owner, first.id)).toBe(0);
});
