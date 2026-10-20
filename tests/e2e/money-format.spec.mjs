// F-132: money is written in the gym's own style everywhere (formatMoney). A
// gym in naira reads "₦15,000"; amounts built by hand read "15,000 ₦".
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test("a naira gym's payment form writes what is owed as ₦15,000", async ({ page }) => {
  const owner = await registerGym({ country: 'Nigeria', city: 'Lagos', phone: '+234 801 000 0000' });
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Naira Plan', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Ngozi', lastName: 'Naira', city: 'Lagos', region: 'Lagos', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: pkg.id, balance: 15000 } });
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(async () => {
    await form.getByPlaceholder('Name or member code...').fill('');
    await form.getByPlaceholder('Name or member code...').fill('Naira');
    await expect(form.getByText('Ngozi Naira')).toBeVisible({ timeout: 1000 });
  }).toPass();

  await expect(form.getByText('₦15,000').first()).toBeVisible();
  await expect(form.getByText('15,000 ₦')).toHaveCount(0);
});
