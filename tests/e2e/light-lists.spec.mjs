// F-099: the sidebar's counts, the Daily Overview and the Dashboard ask for
// only what they show. The figures must not change, only what is downloaded.
import { test, expect } from '@playwright/test';
import { signIn, call } from './support/session.mjs';
import { gymWithPackage, localDay } from './support/forms.mjs';

const inDays = (n) => localDay(new Date(Date.now() + n * 864e5));
// 7 000 in any of the ways a currency writes its thousands
const amount = (n) => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1[\\s\\u202f\\u00a0.,]?'));

async function owingMember(owner, lastName, { balance = 10000, endsIn = 5 } = {}) {
  const [plan] = await call('GET', '/packages', { token: owner.token });
  return call('POST', '/members', { token: owner.token, body: { firstName: 'Owen', lastName, city: 'Douala', region: 'Littoral', packageId: plan.id, startDate: inDays(-10), endDate: inDays(endsIn), balance } });
}

test('the sidebar counts what needs attention without downloading every member', async ({ page }) => {
  const owner = await gymWithPackage();
  await owingMember(owner, 'Owing');
  const task = await call('POST', '/tasks', { token: owner.token, body: { title: 'Count me', assignedGroup: 'management', dueDate: inDays(1), category: 'Front Desk', priority: 'Medium' } });
  const asked = [];
  page.on('request', r => { const u = new URL(r.url()); if (/\/api\/(members|tasks)$/.test(u.pathname)) asked.push(u.pathname.replace(/^.*\/api/, '') + u.search); });

  await signIn(page, owner);
  await page.goto('/settings');
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('button', { name: 'Members 1' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Tasks 1' })).toBeVisible();
  expect(asked).toContain('/members?view=attention');
  expect(asked).toContain('/tasks?open=1');
  expect(asked.filter(u => u === '/members' || u === '/tasks')).toEqual([]);

  // Settled elsewhere, it leaves the count at once
  await call('PATCH', `/tasks/${task.id}`, { token: owner.token, body: { status: 'Done' } });
  await expect(nav.getByRole('button', { name: 'Tasks', exact: true })).toBeVisible();
});

test('the Daily Overview counts today\'s visits, who owes and who ends this week', async ({ page }) => {
  const owner = await gymWithPackage();
  const owing = await owingMember(owner, 'Ending');
  await owingMember(owner, 'Later', { balance: 0, endsIn: 40 });
  await call('POST', '/attendance/checkin', { token: owner.token, body: { memberId: owing.id } });
  await call('POST', '/payments', { token: owner.token, body: { memberId: owing.id, amount: 3000, method: 'cash', type: 'membership' } });

  await signIn(page, owner);
  await page.goto('/operations');
  const row = (label) => page.getByText(label, { exact: true }).locator('xpath=../..');
  await expect(row('Check-ins in the last hour')).toContainText(/1$/);
  await expect(row('Memberships ending this week')).toContainText(/1$/);
  await expect(row('Members owing')).toContainText('1 · ');
  await expect(row('Members owing')).toContainText(amount(7000));
});

test('the Dashboard lists the three latest payments', async ({ page }) => {
  const owner = await gymWithPackage();
  const m = await owingMember(owner, 'Payer', { balance: 50000 });
  for (const n of [1000, 2000, 3000, 4000]) {
    await call('POST', '/payments', { token: owner.token, body: { memberId: m.id, amount: n, method: 'cash', type: 'membership' } });
  }
  await signIn(page, owner);
  await page.goto('/dashboard');
  const rows = page.getByRole('row').filter({ hasText: 'Owen Payer' }).filter({ hasText: 'Cash' });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(amount(4000));
  await expect(rows.nth(1)).toContainText(amount(3000));
  await expect(rows.nth(2)).toContainText(amount(2000));
});
