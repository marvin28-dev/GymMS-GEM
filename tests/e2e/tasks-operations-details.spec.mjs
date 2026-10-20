// F-122: Tasks and Operations details. A task due today is not overdue, the
// phone shows how many are pending, and Operations shows names (not stored
// codes) and only the links the person's role can open.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const localDay = (offset = 0) => { const d = new Date(Date.now() + offset * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const task = (owner, title, dueDate) => call('POST', '/tasks', { token: owner.token, body: { title, assignedGroup: 'management', dueDate, category: 'Front Desk', priority: 'Medium' } });

test('a task due today is not overdue', async ({ page }) => {
  const owner = await registerGym();
  await task(owner, 'Due today', localDay());
  await signIn(page, owner);
  await page.goto('/tasks');
  await expect(page.getByText('Due today').first()).toBeVisible();
  await page.getByRole('button', { name: 'Overdue', exact: true }).click();
  await expect(page.getByText('Due today')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the Tasks header says how many are pending', async ({ page }) => {
    const owner = await registerGym();
    await task(owner, 'First pending', localDay(2));
    await task(owner, 'Second pending', localDay(3));
    await signIn(page, owner);
    await page.goto('/tasks');
    await expect(page.getByText('2 pending tasks')).toBeVisible();
  });
});

test('Operations shows the names of severity and status, and the desk only its own links', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Opal', lastName: 'Ops' });
  await call('POST', '/equipment', { token: owner.token, body: { equipment: 'Rowing machine', location: 'Cardio room', severity: 'critical', description: 'The seat is loose' } });
  await signIn(page, desk);
  await page.goto('/operations');
  await expect(page.getByText('Rowing machine').first()).toBeVisible();
  await expect(page.getByText('Critical', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('critical', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record Payment' })).toHaveCount(0);
  await page.getByText('Payments Received').click();
  await expect(page).toHaveURL(/\/operations$/);
});
