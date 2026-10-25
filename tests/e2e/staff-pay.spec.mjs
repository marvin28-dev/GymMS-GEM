// D-31: a staff profile's pay history, bonuses and deductions are the owner's
// and the person's own. A manager read "No pay records yet" and a net pay
// without bonuses, because the server refuses them those; and "Total paid"
// added every record of every year, paid or not.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

test.describe.configure({ timeout: 120_000 });

const monthLabel = (d) => `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
const amount = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?'));

async function trainerWithPay(owner) {
  const trainer = await addStaff(owner, { firstName: 'Tess', lastName: 'Trainer', role: 'trainer', salary: 90000 });
  const now = new Date();
  const paid = await call('POST', '/payroll', { token: owner.token, body: { staffId: trainer.id, month: monthLabel(now) } });
  await call('PATCH', `/payroll/${paid.id}/status`, { token: owner.token, body: { status: 'paid' } });
  await call('POST', '/payroll', { token: owner.token, body: { staffId: trainer.id, month: monthLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1)) } });
  return trainer;
}

test("a manager sees a colleague's salary, and is told pay history and bonuses are the owner's (desk or phone)", async ({ page }) => {
  const owner = await registerGym();
  const manager = await addStaff(owner, { role: 'manager' });
  const trainer = await trainerWithPay(owner);
  await signIn(page, manager);
  await page.goto(`/staff/${trainer.id}`);
  await page.getByRole('button', { name: 'Pay & Earnings' }).first().click();
  await expect(page.getByText('Pay history, bonuses and deductions are seen by the gym owner and the employee only.')).toBeVisible();
  await expect(page.locator('[data-pay-tile="base"]')).toContainText(amount(90000));
  await expect(page.locator('[data-pay-tile="net"]')).toHaveCount(0);
  await expect(page.getByText('No pay records yet')).toHaveCount(0);
});

test('the owner sees the pay history, and "Paid this year" counts only pay handed over (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await trainerWithPay(owner);
  await signIn(page, owner);
  await page.goto(`/staff/${trainer.id}`);
  await page.getByRole('button', { name: 'Pay & Earnings' }).first().click();
  await expect(page.locator('[data-pay-tile]')).toHaveCount(4);
  const total = page.getByText('Paid this year').locator('..');
  await expect(total).toContainText(amount(90000));
  await expect(total).not.toContainText(amount(180000));
});
