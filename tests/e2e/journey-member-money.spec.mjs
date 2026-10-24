// Journey J-12 (money on the member profile, D-20): a day pass, a visitor
// bundle and a renewal take the money and make the change in one request when
// confirmed. Nothing is recorded before then, so cancelling leaves no payment
// behind, and a refusal from the server is said in the dialog.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

const inDays = (n) => localDay(new Date(Date.now() + n * 864e5));
const paymentsOf = async (owner, memberId) => (await call('GET', '/payments', { token: owner.token })).filter(p => p.memberId === memberId);

async function setUp() {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: false } });
  const plan = await call('POST', '/packages', { token: owner.token, body: { name: `Plan ${uniqueCode('p').slice(-4)}`, price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30 } });
  const bundle = await call('POST', '/packages', { token: owner.token, body: { name: `Bundle ${uniqueCode('b').slice(-4)}`, price: 6000, isVisitor: true, sessions: '8', durationDays: 30 } });
  const member = async (lastName, change) => {
    const m = await call('POST', '/members', { token: owner.token, body: { firstName: 'Ola', lastName, city: 'Douala', region: 'Littoral', packageId: plan.id, startDate: localDay(), endDate: inDays(30) } });
    return call('PATCH', `/members/${m.id}`, { token: owner.token, body: change });
  };
  return { owner, plan, bundle, member };
}

async function collect(dialog, amount, method) {
  await dialog.getByRole('button', { name: 'Collect payment' }).click();
  await dialog.locator('input[inputmode="numeric"]').fill(String(amount));
  if (method) await dialog.getByLabel('Method').selectOption({ label: method });
  await dialog.getByRole('button', { name: 'Confirm Payment' }).click();
  await expect(dialog.getByText('taken when you confirm', { exact: false }).last()).toBeVisible();
}

test('J-12: a day pass is taken with its payment on confirm; cancelling first records nothing', async ({ page }) => {
  const { owner, member } = await setUp();
  const lapsed = await member('Lapsed', { status: 'expired', startDate: inDays(-40), endDate: inDays(-10) });
  await signIn(page, owner);
  await page.goto(`/members/${lapsed.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();

  await page.getByRole('button', { name: 'Day Pass', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Buy Day Pass' });
  await collect(dialog, 1000);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await paymentsOf(owner, lapsed.id)).toEqual([]);

  await page.getByRole('button', { name: 'Day Pass', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Buy Day Pass' });
  await collect(dialog, 1000);
  await dialog.getByRole('button', { name: 'Confirm day pass' }).click();
  await dialog.getByRole('button', { name: 'Check in later' }).click();
  await expect.poll(async () => (await call('GET', `/members/${lapsed.id}`, { token: owner.token })).dayPasses).toBe(1);
  expect((await paymentsOf(owner, lapsed.id)).map(p => [p.amount, p.type])).toEqual([[1000, 'product']]);
});

// Each payment in a dialog must reach the gym's minimum share (50% here), so a
// bundle is paid in one go, by whichever method, and the rest is owed
test('J-12: a visitor bundle is taken with its payment by mobile money, the rest owed', async ({ page }) => {
  const { owner, bundle, member } = await setUp();
  const visitor = await member('Visitor', { isVisitor: true, status: 'visitor', packageId: bundle.id, passesRemaining: 0, passesTotal: 0, endDate: null });
  await signIn(page, owner);
  await page.goto(`/members/${visitor.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();

  await page.getByRole('button', { name: 'Buy visitor bundle' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Buy a visitor bundle' });
  await collect(dialog, 3500, 'Mobile Money');
  await dialog.getByRole('button', { name: 'Buy visitor bundle' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `/members/${visitor.id}`, { token: owner.token })).passesRemaining).toBe(8);
  expect((await call('GET', `/members/${visitor.id}`, { token: owner.token })).balance).toBe(2500);
  expect((await paymentsOf(owner, visitor.id)).map(p => [p.amount, p.method, p.type])).toEqual([[3500, 'mobile_money', 'product']]);
});

test('J-12: a renewal the server refuses says why, and records nothing', async ({ page }) => {
  const { owner, member } = await setUp();
  const due = await member('Renewal', {});
  await page.route('**/api/members/*/renew', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Refused for the test' }) }));
  await signIn(page, owner);
  await page.goto(`/members/${due.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();
  await page.getByRole('button', { name: 'Renew', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Renew Membership' });
  await dialog.getByRole('button', { name: 'Confirm & Activate' }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'Refused for the test' })).toBeVisible();
  expect(await paymentsOf(owner, due.id)).toEqual([]);
});
