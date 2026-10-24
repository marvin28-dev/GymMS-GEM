// F-153, F-138: on a phone a payment in the list opens its details and
// receipt, as a desktop row does; a gym with no payments says so.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test('the payments table says when there are none', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/payments');
  await expect(page.getByText('No payments recorded yet.')).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a payment opens its details', async ({ page }) => {
    const owner = await registerGym();
    const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Tap', lastName: 'Payer', city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), balance: 9000 } });
    const paid = await call('POST', '/payments', { token: owner.token, body: { memberId: member.id, amount: 4000, method: 'cash', type: 'membership' } });
    await signIn(page, owner);
    await page.goto('/payments');
    await page.getByRole('button', { name: /Tap Payer/ }).click();
    const details = page.getByRole('dialog', { name: 'Transaction Details' });
    await expect(details).toBeVisible();
    await expect(details).toContainText(paid.reference);
  });
});
