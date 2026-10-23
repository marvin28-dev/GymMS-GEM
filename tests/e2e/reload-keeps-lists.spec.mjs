// F-163: a list reloaded because something changed elsewhere, whose reload then
// failed (a server error, a dropped connection), was emptied, and so was its
// saved copy, so the page stayed empty even after the browser was reloaded.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const day = (n = 0) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const fail500 = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server is down for the test"}' });
const somethingElseChanges = (owner) => call('POST', '/equipment', { token: owner.token, body: { equipment: 'Bench', description: 'Wobbles', severity: 'low' } });

test('a Members list whose reload failed keeps its members', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Keep', lastName: 'Me', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  await signIn(page, owner);
  await page.goto('/members');
  await expect(page.getByText('Keep Me').first()).toBeVisible();

  await page.route(/\/api\/members(\?|$)/, route => (route.request().method() === 'GET' ? fail500(route) : route.fallback()));
  const failed = page.waitForResponse(r => /\/api\/members(\?|$)/.test(r.url()) && r.status() === 500);
  await somethingElseChanges(owner);
  await failed;
  await page.waitForTimeout(500);
  await expect(page.getByText('Keep Me').first()).toBeVisible();

  // Its saved copy is intact: a fresh page whose load fails still has them
  await page.reload();
  await expect(page.getByText('Keep Me').first()).toBeVisible();
});

test('a Tasks list whose reload failed keeps its tasks', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Keep this task', assignedGroup: 'management', dueDate: day(2), category: 'Front Desk', priority: 'Low' } });
  await signIn(page, owner);
  await page.goto('/tasks');
  await expect(page.getByText('Keep this task').first()).toBeVisible();

  await page.route(/\/api\/tasks(\?|$)/, route => (route.request().method() === 'GET' ? fail500(route) : route.fallback()));
  const failed = page.waitForResponse(r => /\/api\/tasks(\?|$)/.test(r.url()) && r.status() === 500);
  await somethingElseChanges(owner);
  await failed;
  await page.waitForTimeout(500);
  await expect(page.getByText('Keep this task').first()).toBeVisible();
});
