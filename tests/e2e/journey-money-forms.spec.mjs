// Journeys J-11, J-12, J-14 and J-18, and the browser check owed for 8d60de4
// (a member and their first payment written together): a member with a
// registration fee and a visitor with a bundle are added from every form that
// adds them (Members, Dashboard, Front Desk), and a payment is taken from every
// form that takes one (member profile, Dashboard, Payments page).
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { fillNewMember, fillNewVisitor, gymWithPackage, localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

async function gymWithFees() {
  const owner = await registerGym();
  await call('PATCH', '/gyms/me', { token: owner.token, body: { registrationFeeRequired: true, registrationFee: 2000 } });
  await call('POST', '/packages', { token: owner.token, body: { name: 'Photo Plan', price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
  await call('POST', '/packages', { token: owner.token, body: { name: 'Five Visits', price: 5000, sessions: 5, isVisitor: true, durationDays: 30, status: 'active' } });
  return owner;
}

const SURFACES = {
  members: { path: '/members', member: null, visitor: null },
  dashboard: {
    path: '/dashboard',
    member: (page) => page.getByRole('button', { name: 'Add Member' }).first().click(),
    visitor: (page) => page.getByRole('button', { name: 'Add Visitor' }).first().click(),
  },
  'front desk': {
    path: '/front-desk',
    desk: true,
    member: async (page) => { await page.getByRole('button', { name: 'Sign Up', exact: true }).click(); await page.getByRole('button', { name: /New Member/ }).click(); },
    visitor: async (page) => { await page.getByRole('button', { name: 'Sign Up', exact: true }).click(); await page.getByRole('button', { name: /New Visitor/ }).click(); },
  },
};

const paymentsOf = async (owner, memberId) => (await call('GET', '/payments', { token: owner.token })).filter(p => p.memberId === memberId);
const memberNamed = async (owner, lastName) => (await call('GET', '/members', { token: owner.token })).find(m => m.lastName === lastName);

for (const [where, s] of Object.entries(SURFACES)) {
  test(`J-11: a member added from the ${where} has their registration fee recorded with them`, async ({ page }) => {
    const owner = await gymWithFees();
    await signIn(page, s.desk ? await addStaff(owner, { role: 'front_desk' }) : owner);
    await page.goto(s.path);
    const lastName = `Feepaid${uniqueCode('m').slice(-6)}`;
    const d = await fillNewMember(page, lastName, s.member ? () => s.member(page) : undefined);
    const create = d.getByRole('button', { name: 'Create Member →' });
    // The fee comes first
    await expect(create).toBeDisabled();
    await d.getByRole('button', { name: 'Collect payment' }).click();
    await d.getByRole('button', { name: /Confirm Payment/ }).click();
    await create.click();

    await expect.poll(async () => !!(await memberNamed(owner, lastName))).toBe(true);
    const made = await memberNamed(owner, lastName);
    const fee = (await paymentsOf(owner, made.id)).find(p => p.type === 'registration');
    expect(Number(fee.amount)).toBe(2000);
    expect(fee.reference).toMatch(/^TXN-/);
    expect((await call('GET', `/members/${made.id}`, { token: owner.token })).regFeeDate).toBeTruthy();
  });

  test(`J-11: a visitor added from the ${where} has their bundle paid for with them`, async ({ page }) => {
    const owner = await gymWithFees();
    await signIn(page, s.desk ? await addStaff(owner, { role: 'front_desk' }) : owner);
    await page.goto(s.path);
    const lastName = `Bundled${uniqueCode('v').slice(-6)}`;
    const d = await fillNewVisitor(page, lastName, 'Five Visits', s.visitor ? () => s.visitor(page) : undefined);
    await d.getByRole('button', { name: 'Create Visitor →' }).click();

    await expect.poll(async () => !!(await memberNamed(owner, lastName))).toBe(true);
    const made = await call('GET', `/members/${(await memberNamed(owner, lastName)).id}`, { token: owner.token });
    expect(made.isVisitor).toBe(true);
    expect(made.passesTotal).toBe(5);
    const paid = await paymentsOf(owner, made.id);
    expect(paid.map(p => Number(p.amount))).toEqual([5000]);
    expect(paid[0].reference).toMatch(/^TXN-/);
  });
}

async function memberOwing(owner, lastName) {
  const [pkg] = await call('GET', '/packages', { token: owner.token });
  return call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Owen', lastName, phone: '677112233', city: 'Douala', region: 'Littoral', packageId: pkg.id, startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), balance: 10000 },
  });
}

async function expectPaid(owner, member, amount, after) {
  await expect.poll(async () => (await paymentsOf(owner, member.id)).length).toBe(1);
  const [p] = await paymentsOf(owner, member.id);
  expect(Number(p.amount)).toBe(amount);
  expect(p.reference).toMatch(/^TXN-/);
  expect(Number(p.balanceAfter)).toBe(after);
  expect((await call('GET', `/members/${member.id}`, { token: owner.token })).balance).toBe(after);
}

test('J-12: a payment taken on the member profile comes off what they owe', async ({ page }) => {
  const owner = await gymWithPackage();
  const member = await memberOwing(owner, `Profilepay${uniqueCode('p').slice(-5)}`);
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog');
  await form.locator('input[inputmode="numeric"]').first().fill('4000');
  await form.getByRole('button', { name: 'Save Payment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectPaid(owner, member, 4000, 6000);
});

async function payFromSearch(page, form, member, amount, { date } = {}) {
  await expect(async () => {
    await form.getByPlaceholder('Name or member code...').fill('');
    await form.getByPlaceholder('Name or member code...').fill(member.lastName);
    await expect(form.getByText(`Owen ${member.lastName}`)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByText(`Owen ${member.lastName}`).click();
  // A manager on the Payments page may give an earlier day; it starts on today
  if (date) await form.getByLabel('Payment Date').fill(date);
  await form.locator('input[inputmode="numeric"]').first().fill(String(amount));
  await form.getByRole('button', { name: 'Save Payment' }).click();
}

test('J-18: a payment taken from the Dashboard comes off what the member owes', async ({ page }) => {
  const owner = await gymWithPackage();
  const member = await memberOwing(owner, `Dashpay${uniqueCode('d').slice(-5)}`);
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  await payFromSearch(page, page.getByRole('dialog', { name: 'Add Payment' }), member, 10000);
  await expectPaid(owner, member, 10000, 0);
});

test('J-18: a payment taken on the Payments page comes off what the member owes', async ({ page }) => {
  const owner = await gymWithPackage();
  const member = await memberOwing(owner, `Paypage${uniqueCode('q').slice(-5)}`);
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await payFromSearch(page, form, member, 2500);
  await expectPaid(owner, member, 2500, 7500);
  // The new payment is listed with the member's name
  await expect(page.getByRole('row').filter({ hasText: `Owen ${member.lastName}` })).toBeVisible();
});

// D-27: the form asked for a date, "Received by" and "Package for" and sent
// none of them; a manager's earlier day is now kept
test('J-18: a manager records on the Payments page money taken on an earlier day', async ({ page }) => {
  const owner = await gymWithPackage();
  const member = await memberOwing(owner, `Backdate${uniqueCode('q').slice(-5)}`);
  const twoDaysAgo = localDay(new Date(Date.now() - 2 * 864e5));
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(form.getByText('Received By')).toHaveCount(0);
  await payFromSearch(page, form, member, 4000, { date: twoDaysAgo });
  await expectPaid(owner, member, 4000, 6000);
  const [p] = await paymentsOf(owner, member.id);
  expect(localDay(new Date(p.createdAt))).toBe(twoDaysAgo);
  await expect(page.getByRole('row').filter({ hasText: `Owen ${member.lastName}` })).toContainText(twoDaysAgo);
});
