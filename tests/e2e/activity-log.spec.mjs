// F-052: the activity log's From and To are the reader's own days, wherever
// the server runs (UTC on Railway, an hour behind Cameroon).
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test.use({ timezoneId: 'Africa/Douala' });

const doualaDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });

test('a day picked in the activity log is the reader\'s day', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Logged Plan', price: 9000, dayPassPrice: 900, duration: '1 Months', durationDays: 30, status: 'active' } });
  await signIn(page, owner);
  await page.goto('/settings?section=logs');
  await expect(page.getByText(/Logged Plan/).first()).toBeVisible();

  const from = page.getByRole('textbox', { name: 'From', exact: true });
  const to = page.getByRole('textbox', { name: 'To', exact: true });
  await from.fill(doualaDay());
  await to.fill(doualaDay());
  await expect(page.getByText(/Logged Plan/).first()).toBeVisible();
  await from.fill(doualaDay(-1));
  await to.fill(doualaDay(-1));
  await expect(page.getByText(/Logged Plan/)).toHaveCount(0);
});
