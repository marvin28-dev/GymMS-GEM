// F-006: the page opens the live stream with a one-use ticket, never with the
// sign-in token in the URL, and the stream still carries changes made elsewhere.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test('the live stream is opened with a ticket, not the sign-in token', async ({ page }) => {
  const owner = await registerGym();
  const streams = [];
  page.on('request', req => { if (req.url().includes('/api/live?')) streams.push(req.url()); });
  await signIn(page, owner);
  await page.goto('/tasks');
  await expect.poll(() => streams.length).toBeGreaterThan(0);
  expect(streams.every(u => /\/api\/live\?ticket=[0-9a-f]{64}$/.test(u))).toBe(true);
  expect(streams.some(u => u.includes(owner.token))).toBe(false);

  // A change made by someone else still reaches the open page
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Arrived live', assignedGroup: 'management', dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), category: 'Front Desk', priority: 'Low' } });
  await expect(page.getByText('Arrived live').first()).toBeVisible({ timeout: 15000 });
});
