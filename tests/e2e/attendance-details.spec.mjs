// F-126, F-154: Attendance details. The check-out time is picked with the
// shared time picker and sent as a 24-hour time (a "02:30 PM" sent back was
// read as 02:30 in the morning), and the phone says who checked in instead of
// flashing an empty red box.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('an edited check-out time is picked with the shared picker and sent as 24-hour', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { role: 'front_desk', firstName: 'Tara', lastName: 'Timed', employmentType: 'Part Time', salary: 1000 });
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600e3);
  test.skip(twoHoursAgo.getDate() !== now.getDate(), 'needs two hours of today behind it');
  await call('POST', '/timecards/punchin', { token: owner.token, body: { staffId: staff.id, at: hhmm(twoHoursAgo), note: 'Test clock-in' } });
  // A quarter hour between the clock-in and now, so the time counts as edited
  const pick = new Date(now.getTime() - 3600e3);
  pick.setMinutes(Math.floor(pick.getMinutes() / 15) * 15, 0, 0);

  await signIn(page, owner);
  await page.goto('/attendance');
  await page.getByRole('button', { name: /^Staff \(/ }).click();
  await page.getByRole('row').filter({ hasText: 'Tara Timed' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Check Out' }).click();
  await page.locator('[data-time-input]').click();
  await page.locator(`[data-time-panel] [data-time-option="${hhmm(pick)}"]`).click();
  await page.getByPlaceholder('Explain why the check-out time was adjusted...').fill('Left early, forgot to clock out');
  const adjusted = page.waitForRequest(r => /\/api\/timecards\/[^/]+\/adjust$/.test(r.url()));
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();

  expect((await adjusted).postDataJSON().punchOut).toBe(hhmm(pick));
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('a check-in says who came in', async ({ page }) => {
    const owner = await registerGym();
    await call('POST', '/members', { token: owner.token, body: { firstName: 'Fay', lastName: 'Flash', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), photo: 'https://res.cloudinary.test/gem/members/face.png' } });
    await signIn(page, owner);
    await page.goto('/attendance');
    const box = page.getByPlaceholder('Search name or member code...');
    await expect(async () => {
      await box.fill('');
      await box.fill('Flash');
      await expect(page.getByText('Fay Flash').first()).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.locator('div').filter({ hasText: 'Fay Flash' }).filter({ has: page.getByRole('button') }).last().getByRole('button', { name: 'Check In', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Fay Flash');
  });
});
