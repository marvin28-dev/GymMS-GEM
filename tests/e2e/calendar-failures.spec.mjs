// F-120: deleting a calendar event says when the server refused, and keeps the
// event open, instead of closing as if done.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

async function openEvent(page, owner, title) {
  const day = new Date(Date.now() + 864e5);
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  await call('POST', '/calendar', { token: owner.token, body: { title, date, time: '07:00', duration: '08:00' } });
  await signIn(page, owner);
  await page.goto('/calendar');
  if (day.getMonth() !== new Date().getMonth()) await page.getByRole('button', { name: 'Next' }).first().click();
  await page.getByText(title).first().click();
  return page.getByRole('dialog');
}

test('a refused delete keeps the event open with the reason', async ({ page }) => {
  const owner = await registerGym();
  const dialog = await openEvent(page, owner, 'Spin class refused');
  await page.route('**/api/calendar/*', route => (route.request().method() === 'DELETE'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
    : route.fallback()));
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  expect((await call('GET', '/calendar', { token: owner.token })).some(e => e.title === 'Spin class refused')).toBe(true);
});

test('a delete the server made closes the event', async ({ page }) => {
  const owner = await registerGym();
  const dialog = await openEvent(page, owner, 'Spin class deleted');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await call('GET', '/calendar', { token: owner.token })).some(e => e.title === 'Spin class deleted')).toBe(false);
});
