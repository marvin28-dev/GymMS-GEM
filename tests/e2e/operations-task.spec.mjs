// F-107: Daily Overview's Add task waits for the server. A refused task keeps
// the dialog open with the reason; a saved one closes it and joins the list.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

async function fillTask(page, title) {
  await page.getByText('Add Task', { exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Task title').fill(title);
  const selects = dialog.getByRole('combobox');
  await selects.nth(0).selectOption({ label: 'Management' });
  await selects.nth(1).selectOption({ label: 'Everyone in Management' });
  await dialog.locator('input[type="date"]').fill(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  await selects.nth(2).selectOption({ index: 1 });
  return dialog;
}

test('a task the server refused keeps the dialog open with the reason', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/operations');
  await page.route('**/api/tasks', route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
    : route.fallback()));
  const dialog = await fillTask(page, 'Fix the fan');
  await dialog.getByRole('button', { name: 'Save Task' }).click();

  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  await expect(dialog.getByPlaceholder('Task title')).toHaveValue('Fix the fan');
});

test('a task the server saved closes the dialog', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/operations');
  const dialog = await fillTask(page, 'Mop the floor');
  await dialog.getByRole('button', { name: 'Save Task' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  const tasks = await call('GET', '/tasks', { token: owner.token });
  expect(tasks.map(x => x.title)).toContain('Mop the floor');
});

// F-120: moving an equipment issue on says so when the server refuses
test('a refused issue status change is shown under the issue', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/equipment', { token: owner.token, body: { equipment: 'Bench press', description: 'Bolt loose', severity: 'medium' } });
  await signIn(page, owner);
  await page.goto('/operations');
  await page.route('**/api/equipment/*', route => (route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
    : route.fallback()));
  await page.getByRole('button', { name: 'Mark In Progress' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
});

test('an issue status change the server made is kept', async ({ page }) => {
  const owner = await registerGym();
  const issue = await call('POST', '/equipment', { token: owner.token, body: { equipment: 'Squat rack', description: 'Pin missing', severity: 'low' } });
  await signIn(page, owner);
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Mark In Progress' }).click();
  await expect(page.getByRole('button', { name: 'Mark Resolved' })).toBeVisible();
  const list = await call('GET', '/equipment', { token: owner.token });
  expect(list.find(i => i.id === issue.id)?.status).toBe('in_progress');
});
