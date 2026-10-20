// F-094: the receipt printed from the Payments page has its labels, not key
// names. F-080: the page tells the browser which language it is in.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, stubPrinting } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('the Payments receipt prints its labels in the chosen language', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Rhea', lastName: 'Receipt', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  const members = await call('GET', '/members', { token: owner.token });
  await call('POST', '/payments', { token: owner.token, body: { memberId: members[0].id, amount: 5000, method: 'cash', type: 'other' } });
  await page.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('gem-lang', 'fr'); });
  await signIn(page, owner);
  await stubPrinting(page);
  await page.goto('/payments');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('row').filter({ hasText: 'Rhea Receipt' }).first().click();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('dialog').getByRole('button').filter({ has: page.locator('svg.lucide-printer') }).click(),
  ]);
  await popup.waitForLoadState();
  const text = await popup.locator('body').innerText();
  expect(text).toContain('Reçu de paiement');
  expect(text).not.toMatch(/payments\.(receipt|paymentReceipt|thankYou)/);
});
