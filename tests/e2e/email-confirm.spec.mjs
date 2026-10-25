// D-8: a new owner's address was never confirmed. The welcome email carries a
// link; GEM reminds them until it is used, and can send it again.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, mailTo } from './support/session.mjs';

const linkIn = (mail) => /\/verify-email\?token=([a-f0-9]{64})/.exec(mail?.html || '')?.[0];

test('a new owner confirms their email from the welcome email, and the reminder goes (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  const reminder = page.locator('[data-email-confirm]');
  await expect(reminder).toContainText(`we sent a link to ${owner.email}`);

  await expect.poll(async () => (await mailTo(owner.email)).length).toBeGreaterThan(0);
  const link = linkIn((await mailTo(owner.email)).find(m => /Welcome to GEM/.test(m.subject)));
  expect(link).toBeTruthy();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Your email is confirmed' })).toBeVisible();
  await page.getByRole('button', { name: 'Open GEM' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(reminder).toHaveCount(0);

  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'This link does not work' })).toBeVisible();
});

test('the reminder sends the link again, and can be hidden', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  const reminder = page.locator('[data-email-confirm]');
  await reminder.getByRole('button', { name: 'Send it again' }).click();
  await expect(reminder).toContainText('Sent. Check your inbox.');
  await expect.poll(async () => (await mailTo(owner.email)).filter(m => /Confirm your email/.test(m.subject)).length).toBe(1);

  await reminder.getByRole('button', { name: 'Hide this reminder' }).click();
  await expect(reminder).toHaveCount(0);
  await page.goto('/members');
  await expect(page.getByRole('heading', { name: /Members/ }).first()).toBeVisible();
  await expect(reminder).toHaveCount(0);
});
