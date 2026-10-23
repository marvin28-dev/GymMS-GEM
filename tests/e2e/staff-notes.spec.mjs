// F-162: editing someone from the Staff list with a note typed kept only that
// note (the list does not load anyone's notes, and the page sent its own short
// list). F-121: a note is added by the server, so earlier notes stay.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const notesOf = async (owner, id) => (await call('GET', `/staff/${id}`, { token: owner.token })).staffNotes || [];

test('a note added from the Staff list keeps the notes already there', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Nadia', lastName: 'Notes', street: 'Rue du Marché' });
  await call('PATCH', `/staff/${desk.id}`, { token: owner.token, body: { staffNotes: [{ id: 1, date: '2026-01-05', content: 'Older note', category: 'General', createdBy: 'Olive Owner' }] } });
  await signIn(page, owner);
  await page.goto('/staff');
  await page.getByRole('row').filter({ hasText: 'Nadia Notes' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const form = page.getByRole('dialog');
  await form.locator('textarea').last().fill('Newer note');
  await form.getByRole('button', { name: /^Save/ }).last().click();
  await expect(form).toHaveCount(0);
  await expect.poll(async () => (await notesOf(owner, desk.id)).map(n => n.content)).toEqual(['Older note', 'Newer note']);
});

test('a note added on the profile is saved by the server and shown', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Paco', lastName: 'Profile' });
  await signIn(page, owner);
  await page.goto(`/staff/${desk.id}`);
  await page.getByRole('button', { name: 'Notes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add Note' }).first().click();
  await page.getByRole('dialog').locator('textarea').fill('Covered the evening shift');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Note' }).click();
  // Saved once the dialog closes; the typed text would match while it is open
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('p', { hasText: 'Covered the evening shift' })).toBeVisible();
  // Another manager's note, added meanwhile, is not lost by the next one
  await call('POST', `/staff/${desk.id}/notes`, { token: owner.token, body: { content: 'Added elsewhere' } });
  await page.getByRole('button', { name: 'Add Note' }).first().click();
  await page.getByRole('dialog').locator('textarea').fill('Second from the page');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Note' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('p', { hasText: 'Second from the page' })).toBeVisible();
  expect((await notesOf(owner, desk.id)).map(n => n.content)).toEqual(['Covered the evening shift', 'Added elsewhere', 'Second from the page']);
});
