// F-120: a task the server refused shows the server's reason, not a generic
// "failed to save" under the title; a saved one closes the form.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

async function fillTask(page, title) {
  await page.getByRole('button', { name: 'Add Task' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Task title').fill(title);
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Management' }) }).first().selectOption({ label: 'Management' });
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Everyone in Management' }) }).selectOption({ label: 'Everyone in Management' });
  await dialog.locator('input[type="date"]').fill(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Select a category' }) }).selectOption({ index: 1 });
  return dialog;
}

test('a refused task shows the server\'s reason', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/tasks');
  await page.route('**/api/tasks', route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Refused for the test' }) })
    : route.fallback()));
  const dialog = await fillTask(page, 'Restock towels');
  await dialog.getByRole('button', { name: 'Save Task' }).click();

  await expect(dialog.getByText('Refused for the test')).toBeVisible();
  await expect(dialog.getByPlaceholder('Task title')).toHaveValue('Restock towels');
});

test('a saved task closes the form', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/tasks');
  const dialog = await fillTask(page, 'Check the sauna');
  await dialog.getByRole('button', { name: 'Save Task' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  const tasks = await call('GET', '/tasks', { token: owner.token });
  expect(tasks.some(tk => tk.title === 'Check the sauna')).toBe(true);
});
