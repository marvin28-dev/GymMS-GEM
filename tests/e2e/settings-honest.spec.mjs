// D-37, D-43: Settings offered controls that changed nothing (tax rate, late
// fee, due days, grace period, max freeze days, auto-renew, and three
// notification switches with nothing behind them). Only what works is left.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test('Settings offers only what changes something (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);

  await page.goto('/settings?section=payment');
  await expect(page.getByText('Mobile Money').first()).toBeVisible();
  for (const gone of ['Tax Rate (%)', 'Late Fee (%)', 'Payment Due Days']) await expect(page.getByText(gone), gone).toHaveCount(0);

  await page.goto('/settings?section=membership');
  await expect(page.getByText('Membership Defaults').first()).toBeVisible();
  for (const gone of ['Grace Period (days)', 'Max Freeze Days / Year', 'Auto-Renew by Default']) await expect(page.getByText(gone), gone).toHaveCount(0);

  await page.goto('/settings?section=notifications');
  await expect(page.getByText('Task overdue alerts')).toBeVisible();
  await expect(page.getByText('New staff welcome email')).toBeVisible();
  for (const gone of ['Membership expiry reminders', 'Low stock alerts', 'Daily EOD summary email']) await expect(page.getByText(gone), gone).toHaveCount(0);

  await page.getByRole('switch', { name: 'Task overdue alerts' }).click();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).settings?.notifications).toEqual({ taskOverdue: false, welcomeEmail: true });
});
