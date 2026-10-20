// F-089: days are the gym's local days. In Douala (UTC+1) the UTC day starts at
// 01:00, which signed people out half an hour after signing in at 00:30 and
// showed a registration fee's renewal a day early.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test.use({ timezoneId: 'Africa/Douala' });

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('signing in just after midnight does not sign you out at 01:00', async ({ page }) => {
  const owner = await registerGym();
  // 00:30 in Douala: still the previous day in UTC
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Douala' }));
  const halfPastMidnight = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 0, 30) - 3600e3);
  await page.clock.setFixedTime(halfPastMidnight);
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a registration fee's renewal is a year on, not a day early", async ({ page }) => {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: true, registrationFee: 5000, registrationFeeFrequency: 'yearly' } });
  const m = await call('POST', '/members', { token: owner.token, body: { firstName: 'Rena', lastName: 'Renewal', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  const { regFeeDate } = await call('GET', `/members/${m.id}`, { token: owner.token });
  const [y, mo, d] = String(regFeeDate).slice(0, 10).split('-').map(Number);
  const yearOn = new Date(Date.UTC(y + 1, mo - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  await signIn(page, owner);
  await page.goto(`/members/${m.id}`);
  await expect(page.getByText(yearOn).first()).toBeVisible();
});
