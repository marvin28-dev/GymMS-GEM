// Frontend fix plan step 3: what works on a desktop works on a phone too.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

test.use({ viewport: { width: 390, height: 844 } });

// F-101
test("the Sales page's Add product button shows only on the Products tab", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/sales');
  await expect(page.getByTitle('Add Product')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByTitle('Add Product')).toHaveCount(0);
});

// F-111
test('the phone\'s Delete task confirmation can be cancelled', async ({ page }) => {
  const owner = await registerGym();
  const task = await call('POST', '/tasks', {
    token: owner.token,
    body: { title: 'Keep this task', assignedGroup: 'management', dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), category: 'Front Desk', priority: 'Medium' },
  });
  await signIn(page, owner);
  await page.goto('/tasks');
  await page.getByText('Keep this task').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete Task' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Delete Task' }).getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog', { name: 'Delete Task' })).toHaveCount(0);
  const tasks = await call('GET', '/tasks', { token: owner.token });
  expect(tasks.some(tk => tk.id === task.id)).toBe(true);
});

test('the phone asks for the manager\'s code to deactivate, and can be cancelled', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Phoebe', lastName: 'Phone' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Account actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await expect(page.getByPlaceholder('••••')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByPlaceholder('••••')).toHaveCount(0);
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(true);

  await page.getByRole('button', { name: 'Account actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect.poll(async () => (await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(false);
});
