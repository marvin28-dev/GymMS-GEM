// F-107, F-120: a staff profile shows a change only once the server made it,
// and offers Add note only to someone the server lets write notes.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const refusePatch = (page, path) => page.route(`**/api${path}`, route => (route.request().method() === 'PATCH'
  ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
  : route.fallback()));

async function confirmWithCode(page, code) {
  await page.getByPlaceholder('••••').fill(code);
  await page.getByRole('button', { name: 'Authorize' }).click();
}

test('a refused deactivation leaves the employee shown as active', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Dina', lastName: 'Deactivate' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await refusePatch(page, `/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await confirmWithCode(page, owner.accessCode);

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(true);
});

test('a deactivation the server made is shown', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Rhea', lastName: 'Retired' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await confirmWithCode(page, owner.accessCode);

  await expect(page.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(false);
});

test('an employee is not offered Add note on their own profile', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner);
  await signIn(page, staff);
  await page.goto('/front-desk/my-profile');
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByRole('button', { name: 'Add Note' })).toHaveCount(0);
});

test('a refused note stays in its dialog; a saved one is kept', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner);
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Notes' }).click();

  await refusePatch(page, `/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Add Note' }).click();
  await page.getByPlaceholder('Enter note...').fill('Always on time');
  await page.getByRole('button', { name: 'Save Note' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByPlaceholder('Enter note...')).toHaveValue('Always on time');

  await page.unroute(`**/api/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Save Note' }).click();
  await expect(page.getByPlaceholder('Enter note...')).toHaveCount(0);
  const saved = await call('GET', `/staff/${staff.id}`, { token: owner.token });
  expect((saved.staffNotes || []).map(n => n.content)).toContain('Always on time');
});

test('a refused rota save says so', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner);
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await refusePatch(page, `/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Save Schedule' }).click();
  await expect(page.getByText('Server is down for the test')).toBeVisible();
});

test('a refused task status change stays in the task dialog', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner);
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const task = await call('POST', '/tasks', { token: owner.token, body: { title: 'Restock towels', assignedToId: staff.id, dueDate: due, priority: 'medium', category: 'Front Desk' } });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: /^Tasks/ }).click();
  await page.getByRole('cell', { name: /Restock towels/ }).click();
  await refusePatch(page, `/tasks/${task.id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'In Progress', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Server is down for the test')).toBeVisible();
});
