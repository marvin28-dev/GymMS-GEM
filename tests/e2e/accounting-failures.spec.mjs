// F-120: Accounting says when marking an expense reviewed or deleting one was
// refused, instead of leaving the screen as if nothing had been tried.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const failWith = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) });
const today = () => new Date().toISOString().slice(0, 10);

async function deskExpense(owner, title) {
  return call('POST', '/expenses', {
    token: owner.token,
    body: { title, category: 'Supplies', amount: 5000, date: today(), paidTo: 'Corner shop', method: 'cash', source: 'frontdesk' },
  });
}

async function openReviewMenu(page, title) {
  await expect(page.getByText('Expenses awaiting review')).toBeVisible();
  const row = page.locator('div').filter({ hasText: title }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last();
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Mark reviewed' }).click();
}

test('a refused review leaves the expense waiting and says why', async ({ page }) => {
  const owner = await registerGym();
  const expense = await deskExpense(owner, 'Cleaning cloths');
  await signIn(page, owner);
  await page.goto('/accounting');
  await page.route(`**/api/expenses/${expense.id}/approve`, failWith);
  await openReviewMenu(page, 'Cleaning cloths');

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('Expenses awaiting review')).toBeVisible();
  const waiting = await call('GET', '/expenses?pending=1', { token: owner.token });
  expect(waiting.some(e => e.id === expense.id)).toBe(true);
});

test('a review the server made takes the expense off the waiting list', async ({ page }) => {
  const owner = await registerGym();
  const expense = await deskExpense(owner, 'Light bulbs');
  await signIn(page, owner);
  await page.goto('/accounting');
  await openReviewMenu(page, 'Light bulbs');

  await expect(page.getByText('Expenses awaiting review')).toHaveCount(0);
  const waiting = await call('GET', '/expenses?pending=1', { token: owner.token });
  expect(waiting.some(e => e.id === expense.id)).toBe(false);
});

test('a refused deletion reopens the expense with the reason', async ({ page }) => {
  const owner = await registerGym();
  const expense = await call('POST', '/expenses', {
    token: owner.token,
    body: { title: 'Water bill', category: 'Utilities', amount: 12000, date: today(), paidTo: 'Water board', method: 'cash' },
  });
  await signIn(page, owner);
  await page.goto('/accounting');
  await page.route(`**/api/expenses/${expense.id}`, route => (route.request().method() === 'DELETE' ? failWith(route) : route.fallback()));
  await page.getByRole('row').filter({ hasText: 'Water bill' }).getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();

  const dialog = page.getByRole('dialog', { name: 'Expense Record' });
  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  const books = await call('GET', '/expenses', { token: owner.token });
  expect(books.some(e => e.id === expense.id)).toBe(true);
});
