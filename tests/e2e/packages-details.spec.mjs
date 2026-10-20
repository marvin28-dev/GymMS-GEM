// F-147: a package's profile counts the members whose membership on it is
// running, not everyone ever put on it.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('a package counts its active members only', async ({ page }) => {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Counted Plan', price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
  const member = (lastName, extra = {}) => call('POST', '/members', { token: owner.token, body: { firstName: 'Cam', lastName, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: pkg.id, ...extra } });
  await member('Running');
  const lapsed = await member('Lapsed');
  await call('PATCH', `/members/${lapsed.id}`, { token: owner.token, body: { status: 'expired' } });
  await signIn(page, owner);
  await page.goto('/packages');
  await page.getByRole('row').filter({ hasText: 'Counted Plan' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  await expect(page.getByRole('dialog', { name: 'Package Profile' })).toContainText('1 active on this package');
});
