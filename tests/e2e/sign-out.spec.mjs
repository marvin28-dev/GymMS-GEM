// F-105: signing out on a shared computer leaves none of the gym's lists in
// the browser for the next person.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test('signing out removes the member list the page kept', async ({ page }) => {
  const owner = await registerGym();
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Cachetest', lastName: 'Member', phone: '677112233', city: 'Douala', region: 'Littoral', startDate: today, endDate: later, regFeeMethod: 'cash' },
  });
  await signIn(page, owner);
  await page.goto('/members');
  await expect(page.getByText('Cachetest').first()).toBeVisible();

  const gymId = owner.user.gymId;
  const kept = () => page.evaluate((id) => Object.keys(localStorage).filter(k => k.startsWith('gem_') && k.includes(`_${id}_`)), gymId);
  expect((await kept()).length).toBeGreaterThan(0);

  // The header's avatar (the sidebar shows the same initials); it has no name
  // of its own yet (F-100)
  await page.getByText('OO', { exact: true }).last().click();
  await page.getByText('Sign Out', { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await kept()).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('gem_auth'))).toBeNull();
});
