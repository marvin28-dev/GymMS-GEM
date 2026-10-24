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

// D-26: the forms started on Cash. Where the gym takes no cash the box showed
// the first method it does take, and the payment was saved as cash.
test('a gym that takes no cash never has a payment saved as cash', async ({ page }) => {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { settings: { payment: { methods: ['Mobile Money'] } } } });
  const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Nora', lastName: 'Nocash', city: 'Douala', region: 'Littoral', regFeeMethod: 'mobile_money', startDate: day(), endDate: day(30), balance: 8000 } });
  await signIn(page, owner);

  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(form.locator('select').filter({ has: page.locator('option', { hasText: 'Mobile Money' }) }).first()).toHaveValue('Mobile Money');
  await form.locator('input[inputmode="numeric"]').first().fill('3000');
  await form.getByRole('button', { name: /Save Payment|Record Payment/ }).click();
  await expect.poll(async () => (await call('GET', '/payments', { token: owner.token })).filter(p => p.memberId === member.id && p.amount === 3000).map(p => p.method)).toEqual(['mobile_money']);
});
