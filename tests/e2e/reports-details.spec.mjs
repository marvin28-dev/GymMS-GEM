// F-124: Reports details. Outstanding is what members owe, an expense in a
// category outside the usual six still counts, and payment methods show by name.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('Outstanding is what members owe', async ({ page }) => {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Owing Plan', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Owen', lastName: 'Owing', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: pkg.id, balance: 15000 } });
  await signIn(page, owner);
  await page.goto('/accounting');
  const card = page.locator('div').filter({ has: page.getByText('Outstanding', { exact: true }) }).filter({ hasText: /\d/ }).last();
  await expect(card).toContainText(/15[\s\u202f\u00a0.,]?000/);
});

test('an expense outside the usual categories counts, and its method shows by name', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/expenses', { token: owner.token, body: { title: 'Leg press cable', category: 'Equipment', amount: 9000, date: day(), paidTo: 'Gym parts shop', method: 'mobile_money' } });
  await signIn(page, owner);
  await page.goto('/accounting');
  await expect(page.locator('select').filter({ has: page.locator('option[value="Equipment"]') })).toHaveCount(1);
  await page.getByRole('row').filter({ hasText: 'Leg press cable' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  const record = page.getByRole('dialog', { name: 'Expense Record' });
  await expect(record.getByText('Mobile Money')).toBeVisible();
  await expect(record.getByText('mobile_money')).toHaveCount(0);
});
