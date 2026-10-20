// F-086: a gym that has not chosen its payment methods yet takes every one of
// them, Mobile Money included, on the forms and in Settings.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test("a new gym's payment form offers Mobile Money", async ({ page }) => {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Method Plan', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Mona', lastName: 'Momo', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: pkg.id, balance: 15000 } });
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(async () => {
    await form.getByPlaceholder('Name or member code...').fill('');
    await form.getByPlaceholder('Name or member code...').fill('Momo');
    await expect(form.getByText('Mona Momo')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByText('Mona Momo').click();
  await expect(form.locator('select option', { hasText: 'Mobile Money' })).toHaveCount(1);
});

test("a new gym's Settings start with every payment method ticked", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=payment');
  await expect(page.getByLabel('Mobile Money')).toBeChecked();
  await expect(page.getByLabel('Cash')).toBeChecked();
});
