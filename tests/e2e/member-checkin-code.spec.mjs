// F-107: on a member profile, the code check for a member without a photo says
// "Check-in confirmed" only when the server checked them in. CLAUDE.md: a
// second check-in within 30 minutes is refused with the time of the first.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

async function memberWithoutPhoto(owner) {
  const today = new Date().toISOString().slice(0, 10);
  const made = await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Nophoto', lastName: 'Member', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: today, endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) },
  });
  return call('GET', `/members/${made.id}`, { token: owner.token });
}

async function checkInWithCode(page, member) {
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Check In', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('••••').fill(member.accessCode);
  await dialog.getByRole('button', { name: 'Check In' }).click();
  return dialog;
}

test('a refused check-in is not confirmed in the code dialog', async ({ page }) => {
  const owner = await registerGym();
  const member = await memberWithoutPhoto(owner);
  await call('POST', '/attendance/checkin', { token: owner.token, body: { memberId: member.id } });
  await signIn(page, owner);
  const dialog = await checkInWithCode(page, member);

  await expect(dialog.getByText(/already checked in at/i)).toBeVisible();
  await expect(page.getByText('✓ Check-in confirmed!')).toHaveCount(0);
});

test('a check-in the server made is confirmed', async ({ page }) => {
  const owner = await registerGym();
  const member = await memberWithoutPhoto(owner);
  await signIn(page, owner);
  await checkInWithCode(page, member);

  await expect(page.getByText('✓ Check-in confirmed!').first()).toBeVisible();
  const after = await call('GET', `/members/${member.id}`, { token: owner.token });
  expect((after.attendances || []).length).toBe(1);
});

// F-120: approving or declining a membership request reports a refusal
async function waitingRequest() {
  const owner = await registerGym();
  const desk = await addStaff(owner);
  const member = await memberWithoutPhoto(owner);
  await call('POST', '/approvals', { token: desk.token, body: { memberId: member.id, action: 'extend_membership', params: { days: 7 }, note: 'Away for a week, needs more days' } });
  return { owner, member };
}

test('a refused approval stays in the list with the reason', async ({ page }) => {
  const { owner, member } = await waitingRequest();
  await signIn(page, owner);
  await page.route('**/api/approvals/*/approve', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) }));
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('“Away for a week, needs more days”')).toBeVisible();
});

test('an approval the server made leaves the list', async ({ page }) => {
  const { owner, member } = await waitingRequest();
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('“Away for a week, needs more days”')).toHaveCount(0);
  const requests = await call('GET', `/approvals/member/${member.id}`, { token: owner.token });
  expect(requests.filter(r => r.status === 'pending')).toEqual([]);
});
