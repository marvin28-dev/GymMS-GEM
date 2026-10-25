// Journey J-12 (member profile actions): a renewal waits until what the
// member owes is paid, and a freeze asked for at the desk goes to a manager
// and is applied when they approve it.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

async function memberOn(owner, extra = {}) {
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: `Plan ${uniqueCode('p').slice(-4)}`, price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
  return call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Rae', lastName: `Member${uniqueCode('m').slice(-5)}`, city: 'Douala', region: 'Littoral', packageId: pkg.id, startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), ...extra },
  });
}

test('J-12: a renewal waits until the balance is settled', async ({ page }) => {
  const owner = await registerGym();
  const member = await memberOn(owner, { balance: 5000 });
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();
  await page.getByRole('button', { name: 'Renew', exact: true }).first().click();
  await expect(page.getByText('Settle balance before renewing')).toBeVisible();
  await page.getByRole('button', { name: 'Settle balance' }).click();
  const pay = page.getByRole('dialog').filter({ hasText: 'Add Payment' });
  await pay.locator('input[inputmode="numeric"]').first().fill('5000');
  await pay.getByRole('button', { name: 'Save Payment' }).click();
  await expect.poll(async () => (await call('GET', `/members/${member.id}`, { token: owner.token })).balance).toBe(0);

  await page.getByRole('button', { name: 'Renew', exact: true }).first().click();
  await expect(page.getByText('Settle balance before renewing')).toHaveCount(0);
  await expect(page.getByRole('dialog').filter({ hasText: 'Renew' }).locator('select').first()).toBeVisible();
});

test('J-12: a freeze asked for at the desk is applied once a manager approves it', async ({ page, browser }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  const member = await memberOn(owner);
  await signIn(page, desk);
  await page.goto(`/front-desk/member/${member.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();
  await page.getByRole('button', { name: 'Freeze', exact: true }).first().click();
  const freeze = page.getByRole('dialog', { name: 'Freeze Membership' });
  await expect(freeze.getByText('Manager approval needed')).toBeVisible();
  await freeze.locator('textarea').fill('Travelling for two weeks');
  await page.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByText('Request sent. A manager will be notified to approve it.')).toBeVisible();
  expect((await call('GET', `/members/${member.id}`, { token: owner.token })).status).not.toBe('frozen');

  const office = await browser.newPage();
  await signIn(office, owner);
  await office.goto(`/members/${member.id}`);
  await expect(office.getByText('“Travelling for two weeks”')).toBeVisible();
  await office.getByRole('button', { name: 'Approve' }).click();
  await expect(office.getByText('“Travelling for two weeks”')).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `/members/${member.id}`, { token: owner.token })).status).toBe('frozen');
  await office.close();
});

// D-17: days added to an end date weeks back gave fewer days of access, or none
test('J-12: extending a membership that has ended counts the days from today', async ({ page }) => {
  const owner = await registerGym();
  const member = await memberOn(owner);
  await call('PATCH', `/members/${member.id}`, { token: owner.token, body: { startDate: localDay(new Date(Date.now() - 50 * 864e5)), endDate: localDay(new Date(Date.now() - 20 * 864e5)), status: 'active' } });
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();
  await page.getByRole('button', { name: 'Extend', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Extend Membership' });
  await dialog.getByRole('button', { name: '+7 Days' }).click();
  await expect(dialog.getByText('This membership has ended, so the days count from today.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm Extension' }).click();
  await expect.poll(async () => String((await call('GET', `/members/${member.id}`, { token: owner.token })).endDate).slice(0, 10)).toBe(localDay(new Date(Date.now() + 6 * 864e5)));
});
