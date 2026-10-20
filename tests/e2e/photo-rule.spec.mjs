// F-114, F-109: one photo rule on every check-in button. With no photo to check
// by sight the person gives their check-in code first, member or visitor alike;
// with a photo they go straight in.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const PHOTO = 'https://res.cloudinary.test/gem/members/face.png';

async function withCode(owner, made) {
  return { ...made, accessCode: (await call('GET', `/members/${made.id}`, { token: owner.token })).accessCode };
}
const member = async (owner, lastName, extra = {}) => withCode(owner, await call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Rhoda', lastName, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), ...extra },
}));
const visitor = async (owner, lastName, extra = {}) => withCode(owner, await call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Vera', lastName, city: 'Douala', region: 'Littoral', isVisitor: true, status: 'visitor', passesTotal: 5, passesRemaining: 5, startDate: day(), endDate: day(30), initialPayment: { amount: 10000, method: 'cash' }, ...extra },
}));
const visits = async (owner, id) => ((await call('GET', `/members/${id}`, { token: owner.token })).attendances || []).length;

test.describe('the Attendance page on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // The search runs over the member list once it has loaded, so it is retried until the person shows
  async function find(page, lastName) {
    await page.goto('/attendance');
    const box = page.getByPlaceholder('Search name or member code...');
    await expect(async () => {
      await box.fill('');
      await box.fill(lastName);
      await expect(page.getByText(lastName).first()).toBeVisible({ timeout: 1000 });
    }).toPass();
  }
  const resultCard = (page, name) => page.locator('div').filter({ hasText: name }).filter({ has: page.getByRole('button') }).last();

  test('asks a member without a photo for their code', async ({ page }) => {
    const owner = await registerGym();
    const m = await member(owner, 'Nophoto');
    await signIn(page, owner);
    await find(page, 'Nophoto');

    const entry = page.locator('[data-code-entry]');
    await expect(entry).toBeVisible();
    await expect(resultCard(page, 'Rhoda Nophoto').getByRole('button', { name: 'Check In', exact: true })).toHaveCount(0);
    await entry.getByPlaceholder('Access code…').fill('0000');
    await entry.getByRole('button', { name: 'Verify & Check In' }).click();
    await expect(page.getByText('Incorrect access code. Try again.')).toBeVisible();
    expect(await visits(owner, m.id)).toBe(0);

    await entry.getByPlaceholder('Access code…').fill(m.accessCode);
    await entry.getByRole('button', { name: 'Verify & Check In' }).click();
    await expect.poll(() => visits(owner, m.id)).toBe(1);
  });

  test('asks a visitor without a photo for their code', async ({ page }) => {
    const owner = await registerGym();
    const v = await visitor(owner, 'Nopic');
    await signIn(page, owner);
    await find(page, 'Nopic');

    const entry = page.locator('[data-code-entry]');
    await entry.getByPlaceholder('Access code…').fill(v.accessCode);
    await entry.getByRole('button', { name: 'Verify & Check In' }).click();
    await expect.poll(() => visits(owner, v.id)).toBe(1);
  });

  test('lets a member with a photo straight in', async ({ page }) => {
    const owner = await registerGym();
    const m = await member(owner, 'Pictured', { photo: PHOTO });
    await signIn(page, owner);
    await find(page, 'Pictured');

    await expect(page.locator('[data-code-entry]')).toHaveCount(0);
    await resultCard(page, 'Rhoda Pictured').getByRole('button', { name: 'Check In', exact: true }).click();
    await expect.poll(() => visits(owner, m.id)).toBe(1);
  });
});

test.describe("the Members list's Check In", () => {
  async function openCheckIn(page, lastName) {
    await page.goto('/members');
    await page.getByRole('row').filter({ hasText: lastName }).getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Check In' }).click();
  }

  test('asks a member without a photo for their code', async ({ page }) => {
    const owner = await registerGym();
    await member(owner, 'Rowless');
    await signIn(page, owner);
    await openCheckIn(page, 'Rowless');
    const dialog = page.getByRole('dialog', { name: 'Check In Member' });
    await expect(dialog.getByPlaceholder('••••')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm Check-In' })).toHaveCount(0);
  });

  test('takes a visitor with a photo straight to the confirmation', async ({ page }) => {
    const owner = await registerGym();
    const v = await visitor(owner, 'Facevisit', { photo: PHOTO });
    await signIn(page, owner);
    await openCheckIn(page, 'Facevisit');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByPlaceholder('••••')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Confirm Check-In' }).click();
    await expect.poll(() => visits(owner, v.id)).toBe(1);
  });
});
