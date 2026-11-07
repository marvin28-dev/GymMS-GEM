// A screen on its way used to be empty: a page's code arriving the first time
// it is opened left a blank area (Suspense fallback={null}), and a profile
// waiting for its record showed one line of text. components/ui/PageLoader.jsx
// now stands in: the page's shape in the app, the GEM mark for a whole screen,
// and after ten seconds an offer to reload.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

// Holds the requests matching `pattern` until release() is called. A page opened
// while one is held is not waited on to finish loading: WebKit on a busy machine
// starts the request before the page's load event and holds that event with it.
const OPEN = { waitUntil: 'domcontentloaded' };
async function hold(page, pattern) {
  let release;
  const gate = new Promise(r => { release = r; });
  await page.route(pattern, async (route) => { await gate; await route.continue(); });
  return () => release();
}

test('a page still arriving shows its shape in the app, then the page (desk or phone)', async ({ page, isMobile }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  // The dashboard has arrived once its own loader is gone
  await expect(page.locator('[data-page-loader]')).toHaveCount(0);

  // Sales has code of its own (Members comes with the dashboard)
  const release = await hold(page, /SalesPage[^/]*\.js(\?|$)/);
  // The sidebar on a desk, the bottom bar on a phone (its menu is closed)
  await page.getByRole('button', { name: isMobile ? 'Sales' : 'Sales & Products', exact: true }).click();
  const loader = page.locator('[data-page-loader="page"]');
  await expect(loader).toBeVisible();
  await expect(loader).toHaveAttribute('role', 'status');
  await expect(loader).toContainText('Loading');
  // The frame stays while the page arrives
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();

  release();
  await expect(loader).toHaveCount(0);
  await expect(page.getByRole('heading', { name: isMobile ? 'Sales' : 'Sales & Products', exact: true })).toBeVisible();
});

test('a whole screen still arriving shows the GEM loader, then the screen (desk or phone)', async ({ page }) => {
  const release = await hold(page, /GymCodePage[^/]*\.js(\?|$)/);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('[data-page-loader="screen"]');
  await expect(loader).toBeVisible();
  await expect(loader.locator('svg[data-gem-mark]')).toBeVisible();
  release();
  await expect(loader).toHaveCount(0);
  await expect(page.getByPlaceholder('e.g. elite-fitness')).toBeVisible();
});

test('a member profile shows its shape while the record loads (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const member = await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Lena', lastName: 'Loader', phone: '677445566', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) },
  });
  await signIn(page, owner);
  const release = await hold(page, new RegExp(`/api/members/${member.id}(\\?|$)`));
  await page.goto(`/members/${member.id}`, OPEN);
  const loader = page.locator('[data-page-loader="profile"]');
  await expect(loader).toBeVisible();
  release();
  await expect(loader).toHaveCount(0);
  await expect(page.getByText('Lena Loader').first()).toBeVisible();
});

test('a staff profile shows its shape while the record loads (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, new RegExp(`/api/staff/${owner.user.id}(\\?|$)`));
  await page.goto(`/staff/${owner.user.id}`, OPEN);
  const loader = page.locator('[data-page-loader="profile"]');
  await expect(loader).toBeVisible();
  release();
  await expect(loader).toHaveCount(0);
  await expect(page.getByText(owner.user.firstName).first()).toBeVisible();
});

// Pages that are drawn but wait for their data used to say "nothing here"
// (no notifications, no payments, 0 FCFA, no check-ins) before it arrived

test('Notifications says nothing about the list until it has come back (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, /\/api\/notifications(\?|$)/);
  await page.goto('/notifications', OPEN);
  await expect(page.locator('main [style*="gem-skeleton"]').first()).toBeVisible();
  await expect(page.getByText('No notifications')).toHaveCount(0);
  await expect(page.getByText('All caught up!')).toHaveCount(0);
  release();
  // A new gym is told to finish its setup
  await expect(page.getByText('Finish your gym setup').first()).toBeVisible();
  await expect(page.locator('main [style*="gem-skeleton"]')).toHaveCount(0);
});

test('Payments shows placeholders, not 0 and an empty history, until the payments arrive (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, /\/api\/payments(\?|$)/);
  await page.goto('/payments', OPEN);
  await expect(page.locator('main [style*="gem-skeleton"]').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('0 FCFA');
  await expect(page.locator('main')).not.toContainText('Showing 0');
  release();
  await expect(page.locator('main [style*="gem-skeleton"]')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('0 FCFA');
  await expect(page.getByText('No payments recorded yet.').first()).toBeVisible();
});

test('Members shows placeholder rows until the list arrives (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, /\/api\/members(\?|$)/);
  await page.goto('/members', OPEN);
  await expect(page.locator('main [style*="gem-skeleton"]').first()).toBeVisible();
  await expect(page.getByText('No members found')).toHaveCount(0);
  release();
  await expect(page.getByText('No members found').first()).toBeVisible();
  await expect(page.locator('main [style*="gem-skeleton"]')).toHaveCount(0);
});

test('Daily Overview shows placeholders, not zeros, until the day is counted (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const releaseReport = await hold(page, /\/api\/reports\/eod/);
  const releaseTasks = await hold(page, /\/api\/tasks(\?|$)/);
  await page.goto('/operations', OPEN);
  await expect(page.locator('main [style*="gem-skeleton"]').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('0 FCFA');
  releaseReport();
  releaseTasks();
  await expect(page.locator('main').getByText('0 FCFA').first()).toBeVisible();
});

test('the Calendar says it is loading until its events arrive (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, /\/api\/calendar(\?|$)/);
  await page.goto('/calendar', OPEN);
  const loading = page.locator('[data-inline-loader]');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('role', 'status');
  await expect(loading).toContainText('Loading');
  release();
  await expect(loading).toHaveCount(0);
});

test("the front desk's panels show placeholders, not 'no check-ins', until the desk has loaded (desk or phone)", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const release = await hold(page, /\/api\/attendance(\?|$)/);
  await page.goto('/front-desk', OPEN);
  await expect(page.getByRole('button', { name: 'Check In', exact: true })).toBeVisible();
  await expect(page.locator('[style*="gem-skeleton"]').first()).toBeVisible();
  await expect(page.getByText('No check-ins in this period')).toHaveCount(0);
  await expect(page.getByText('No classes scheduled')).toHaveCount(0);
  release();
  await expect(page.getByText('No check-ins in this period')).toBeVisible();
});

test('a screen that takes too long says so and offers to reload (desk or phone)', async ({ page }) => {
  await page.clock.install();
  const release = await hold(page, /GymCodePage[^/]*\.js(\?|$)/);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page-loader="screen"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0);
  await page.clock.fastForward(10_500);
  await expect(page.getByText('This is taking longer than usual')).toBeVisible();
  const reloaded = page.waitForEvent('framenavigated');
  await page.getByRole('button', { name: 'Reload' }).click();
  await reloaded;
  release();
  await expect(page.getByPlaceholder('e.g. elite-fitness')).toBeVisible();
});
