// F-120: the message history says when cancelling a schedule or deleting a
// message was refused, instead of leaving it as if nothing had been tried.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const refuse = (status, error) => (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error }) });
const tomorrow = () => new Date(Date.now() + 864e5).toISOString();

// The message needs someone to go to
async function scheduled(owner, subject) {
  const day = new Date().toISOString().slice(0, 10);
  await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Reader', lastName: subject.split(' ')[0], email: `reader.${Date.now()}@example.test`, city: 'Douala', region: 'Littoral', startDate: day, endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), regFeeMethod: 'cash' },
  });
  return call('POST', '/communications', {
    token: owner.token,
    body: { action: 'schedule', channel: 'email', subject, body: 'We close at noon on Friday.', audience: { type: 'all' }, scheduledAt: tomorrow() },
  });
}

async function openRowMenu(page, subject) {
  await page.getByRole('row').filter({ hasText: subject }).getByRole('button', { name: 'Actions' }).click();
}

test('a refused schedule cancel says why and leaves it scheduled', async ({ page }) => {
  const owner = await registerGym();
  const message = await scheduled(owner, 'Holiday hours');
  await signIn(page, owner);
  await page.goto('/communication');
  await page.route(`**/api/communications/${message.id}/cancel`, refuse(409, 'It is not scheduled any more.'));
  await openRowMenu(page, 'Holiday hours');
  await page.getByRole('menuitem', { name: 'Cancel schedule' }).click();

  await expect(page.getByText('It is not scheduled any more.')).toBeVisible();
  expect((await call('GET', `/communications/${message.id}`, { token: owner.token })).status).toBe('scheduled');
});

test('a cancelled schedule turns the message back into a draft', async ({ page }) => {
  const owner = await registerGym();
  const message = await scheduled(owner, 'Gym closed Monday');
  await signIn(page, owner);
  await page.goto('/communication');
  await openRowMenu(page, 'Gym closed Monday');
  await page.getByRole('menuitem', { name: 'Cancel schedule' }).click();

  await expect(page.locator('[data-message-row="draft"]').filter({ hasText: 'Gym closed Monday' })).toBeVisible();
  expect((await call('GET', `/communications/${message.id}`, { token: owner.token })).status).toBe('draft');
});

test('a refused delete keeps the message and says why', async ({ page }) => {
  const owner = await registerGym();
  const message = await scheduled(owner, 'New classes');
  await signIn(page, owner);
  await page.goto('/communication');
  await page.route(`**/api/communications/${message.id}`, route => (route.request().method() === 'DELETE'
    ? refuse(500, 'Server is down for the test')(route)
    : route.fallback()));
  await openRowMenu(page, 'New classes');
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'New classes' })).toBeVisible();
  expect((await call('GET', `/communications/${message.id}`, { token: owner.token })).id).toBe(message.id);
});
