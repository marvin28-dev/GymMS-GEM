// D-32 keeps member notes in the browser until the owner decides; meanwhile a
// note the browser refused to store is not shown as kept.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function memberProfile(page) {
  const owner = await registerGym();
  const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Nora', lastName: 'Notes', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
}

async function addNote(page, text) {
  await page.getByRole('button', { name: 'Add Note' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Note' });
  await dialog.locator('textarea').fill(text);
  await dialog.getByRole('button', { name: 'Save Note' }).click();
}

test('a note the browser refused to store is not shown as kept', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith('gem_member_notes_')) throw new DOMException('Quota exceeded for the test', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await memberProfile(page);
  await addNote(page, 'Knee injury, no squats');
  await expect(page.getByText('The note could not be kept: this browser refused to store it.', { exact: false })).toBeVisible();
  await expect(page.getByText('Knee injury, no squats')).toHaveCount(0);
});

test('a note the browser stored is shown', async ({ page }) => {
  await memberProfile(page);
  await addNote(page, 'Prefers mornings');
  await expect(page.getByText('Prefers mornings')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
