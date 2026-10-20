// F-107: the Attendance page says "checked out" only when the server ended the
// shift; a refusal is shown in the dialog, which stays open. On this page the
// check-out is for part-time staff on the clock (their time card).
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

async function staffOnTheClock() {
  const owner = await registerGym();
  const staff = await addStaff(owner, { role: 'front_desk', firstName: 'Leaving', lastName: 'Staffer', employmentType: 'Part Time', salary: 1000 });
  // Clocked in a few minutes ago: the dialog refuses a check-out in the same
  // minute as the check-in
  const earlier = new Date(Date.now() - 5 * 60000);
  const sameDay = earlier.getDate() === new Date().getDate();
  const at = sameDay ? `${String(earlier.getHours()).padStart(2, '0')}:${String(earlier.getMinutes()).padStart(2, '0')}` : '00:00';
  const card = await call('POST', '/timecards/punchin', { token: owner.token, body: { staffId: staff.id, at, note: 'Test clock-in' } });
  return { owner, staff, card };
}

async function openCheckOut(page) {
  await page.goto('/attendance');
  await page.getByRole('button', { name: /^Staff \(/ }).click();
  const row = page.getByRole('row').filter({ hasText: 'Leaving Staffer' });
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Check Out' }).click();
}

test('a check-out the server refused is not shown as done', async ({ page }) => {
  const { owner } = await staffOnTheClock();
  await signIn(page, owner);
  await page.route('**/api/timecards/*/punchout', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) }));
  await openCheckOut(page);
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Check-Out' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Leaving Staffer' }).getByText('Inside')).toBeVisible();
});

test('a check-out the server made is shown as done', async ({ page }) => {
  const { owner, staff, card } = await staffOnTheClock();
  await signIn(page, owner);
  await openCheckOut(page);
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();

  await expect(page.getByRole('button', { name: 'Confirm Check-Out' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Leaving Staffer' }).getByText('Left')).toBeVisible();
  const cards = await call('GET', `/timecards?staffId=${staff.id}`, { token: owner.token });
  expect(cards.find(c => c.id === card.id)?.punchOut).toBeTruthy();
});
