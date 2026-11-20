// D-25: a progress entry, a single calendar event and a task raised at the
// desk were deleted the moment Delete was chosen; each now asks first.
// The check-in code is sent by email only (texting was taken out on 20
// November 2026). D-39: no scanner drawing with nothing behind it.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, mailTo, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

const newMember = (owner, extra = {}) => call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Asha', lastName: 'Askfirst', phone: '677112233', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), ...extra },
});

test('a progress entry is deleted only once the dialog is confirmed', async ({ page }) => {
  const owner = await registerGym();
  const member = await newMember(owner);
  await call('POST', `/coach/progress/${member.id}`, { token: owner.token, body: { kind: 'note', category: 'general', note: 'Keep or go' } });
  const entries = () => call('GET', `/coach/progress/${member.id}`, { token: owner.token });
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  const row = page.locator('div').filter({ hasText: 'Keep or go' }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last();

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const ask = page.getByRole('dialog', { name: 'Delete' });
  await expect(ask).toContainText('Delete this entry?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  expect((await entries()).some(e => e.note === 'Keep or go')).toBe(true);

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete' }).getByRole('button', { name: 'Delete' }).click();
  await expect.poll(async () => (await entries()).some(e => e.note === 'Keep or go')).toBe(false);
});

test('a task raised at the desk is deleted only once the dialog is confirmed', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  const due = localDay(new Date(Date.now() + 2 * 864e5));
  await call('POST', '/tasks', { token: desk.token, body: { title: 'Restock towels', assignedGroup: 'management', dueDate: due, category: 'Front Desk', priority: 'Medium' } });
  const raised = async () => (await call('GET', '/tasks', { token: owner.token })).some(tk => tk.title === 'Restock towels');
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  const row = page.locator('div').filter({ hasText: 'Restock towels' }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last();

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const ask = page.getByRole('dialog', { name: 'Delete' });
  await expect(ask).toContainText('Delete "Restock towels"?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  expect(await raised()).toBe(true);

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete' }).getByRole('button', { name: 'Delete' }).click();
  await expect.poll(raised).toBe(false);
});

test('a check-in code is sent by email only, to the address shown; no scanner drawing', async ({ page }) => {
  const owner = await registerGym();
  const email = `asha.${uniqueCode('c')}@example.test`;
  const member = await newMember(owner, { email });
  const noEmail = await newMember(owner);
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Send check-in code' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Send Access Code' });
  await expect(dialog).toContainText(email);
  await expect(dialog.getByRole('button', { name: /text/i })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Email it' }).click();
  await expect(dialog).toContainText(`Check-in code emailed to ${email}.`);
  await expect.poll(async () => (await mailTo(email)).some(m => m.subject.startsWith('Your check-in code'))).toBe(true);

  // Someone with no email: the dialog says so, and there is nothing to press
  await page.goto(`/members/${noEmail.id}`);
  await page.getByRole('button', { name: 'Send check-in code' }).first().click();
  await expect(dialog).toContainText('No email on file for this member.');
  await expect(dialog.getByRole('button', { name: 'Email it' })).toBeDisabled();

  await page.goto('/attendance');
  await expect(page.getByTitle('Scan QR Code')).toHaveCount(0);
});
