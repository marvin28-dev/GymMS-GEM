// Journey J-16 (tasks): a task for a whole department is raised through the
// department-first picker, the people in it see it but cannot change its
// status, and management moves it to In Progress and then Done with a note.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

const inDays = (n) => localDay(new Date(Date.now() + n * 864e5));

async function openTask(page, title) {
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View Details' }).click();
  return page.getByRole('dialog');
}

test('J-16: a task for everyone at the front desk reaches them, and only management settles it', async ({ page, browser }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Fay', lastName: 'Desk' });
  const title = `Restock the towels ${uniqueCode('k')}`;

  await signIn(page, owner);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Add Task' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByPlaceholder('Task title').fill(title);
  await form.locator('select', { has: page.locator('option', { hasText: 'Any department' }) }).selectOption({ label: 'Front Desk' });
  // Picking a department starts on everyone in it; one person there can be picked instead
  const who = form.locator('select', { has: page.locator('option', { hasText: 'Everyone in Front Desk' }) });
  await expect(who).toHaveValue('role:front_desk');
  await expect(who.locator('option', { hasText: 'Fay Desk' })).toHaveCount(1);
  await form.locator('input[type="date"]').fill(inDays(2));
  await form.locator('select', { has: page.locator('option', { hasText: 'Select a category' }) }).selectOption({ index: 1 });
  await form.getByRole('button', { name: 'Save Task' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const task = (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.title === title);
  expect(task.assignedRole).toBe('front_desk');

  // The desk sees it, with nothing to change its status, and the server agrees
  const deskPage = await browser.newPage();
  await signIn(deskPage, desk);
  await deskPage.goto('/tasks');
  const seen = await openTask(deskPage, title);
  await expect(seen.getByText(title)).toBeVisible();
  await expect(seen.getByText('Update status')).toHaveCount(0);
  await expect(seen.getByRole('button', { name: 'In Progress', exact: true })).toHaveCount(0);
  await expect(call('PATCH', `/tasks/${task.id}`, { token: desk.token, body: { status: 'Done' } })).rejects.toThrow(/answered 403/);
  await deskPage.close();

  const details = await openTask(page, title);
  await details.getByRole('button', { name: 'In Progress', exact: true }).click();
  await expect.poll(async () => (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.id === task.id)?.status).toBe('In Progress');
  await details.getByRole('button', { name: 'Done', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Mark as Done' });
  await done.getByPlaceholder('Notes on how this was completed...').fill('Forty towels on the shelf');
  await done.getByRole('button', { name: /Mark Done/ }).click();
  await expect.poll(async () => (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.id === task.id)?.status).toBe('Done');
  const settled = (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.id === task.id);
  expect(settled.notes).toBe('Forty towels on the shelf');
  await expect(page.getByRole('row').filter({ hasText: title }).getByText('Done')).toBeVisible();
});

test('J-16: a task form will not save without an assignee and a due date', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Add Task' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByPlaceholder('Task title').fill('Nobody to do it');
  await form.locator('select', { has: page.locator('option', { hasText: 'Select a category' }) }).selectOption({ index: 1 });
  await form.getByRole('button', { name: 'Save Task' }).click();
  await expect(form.getByText('Choose a department and who it goes to')).toBeVisible();
  await expect(form.getByText('Due date is required')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect((await call('GET', '/tasks', { token: owner.token })).some(tk => tk.title === 'Nobody to do it')).toBe(false);
});
