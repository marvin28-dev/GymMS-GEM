// Journey J-14 (a day at the desk) for a part-time front desk employee: the
// desk asks once whether to check in for the shift, and after the end-of-day
// report is printed it asks whether to check out. Both can be put off.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, stubPrinting } from './support/session.mjs';

test.describe.configure({ timeout: 120_000 });

const shiftOf = async (owner, staffId) => (await call('GET', `/timecards/shift?staffId=${staffId}`, { token: owner.token })).state;

test('J-14: the desk checks a part-time employee in when they say so, and out after the day\'s report', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', employmentType: 'Part Time', salary: 1000 });
  await stubPrinting(page);
  await signIn(page, desk);
  await page.goto('/front-desk');

  const start = page.getByRole('dialog', { name: 'Check in for your shift?' });
  await expect(start).toBeVisible();
  await start.getByRole('button', { name: 'Check in now' }).click();
  await expect(start).toHaveCount(0);
  await expect.poll(() => shiftOf(owner, desk.id)).toBe('in');

  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByText('EOD Report', { exact: true }).click();
  await page.getByRole('button', { name: 'Print / save PDF' }).click();
  const end = page.getByRole('dialog', { name: 'Check out now?' });
  await expect(end).toBeVisible();
  await end.getByRole('button', { name: 'Check out', exact: true }).click();
  await expect.poll(() => shiftOf(owner, desk.id)).toBe('done');
});

test('J-14: "Not now" leaves the shift alone, and the desk does not ask again on that sign-in', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', employmentType: 'Part Time', salary: 1000 });
  await signIn(page, desk);
  await page.goto('/front-desk');
  const start = page.getByRole('dialog', { name: 'Check in for your shift?' });
  await start.getByRole('button', { name: 'Not now' }).click();
  expect(await shiftOf(owner, desk.id)).toBe('none');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Operations', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Check in for your shift?' })).toHaveCount(0);
});

test('J-14: a full-time employee is never asked', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', employmentType: 'Full Time' });
  await signIn(page, desk);
  await page.goto('/front-desk');
  await expect(page.getByRole('button', { name: 'Operations', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog', { name: 'Check in for your shift?' })).toHaveCount(0);
});
