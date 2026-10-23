// F-159: when a screen crashes, the app says so in the reader's language and
// offers a way to carry on, instead of printing the raw error in English.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

// A notification whose title is not text makes the page throw while drawing
// it, the same in the built app as on the dev server
const NOTIFICATIONS = '**/api/notifications';
async function breakNotificationsPage(page) {
  await page.route(NOTIFICATIONS, route => (route.request().method() === 'GET'
    ? route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'broken', title: { broken: true }, body: 'Broken for the test', type: 'system', isRead: false, createdAt: new Date().toISOString() }]),
    })
    : route.fallback()));
}

test('a crashed screen says so in French and offers Reload', async ({ page }) => {
  const owner = await registerGym();
  await breakNotificationsPage(page);
  await page.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('gem-lang', 'fr'); });
  await signIn(page, owner);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recharger' })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('Reload on the crash screen loads the page again', async ({ page }) => {
  const owner = await registerGym();
  await breakNotificationsPage(page);
  await signIn(page, owner);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await page.unroute(NOTIFICATIONS);
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/notifications$/);
});
