// F-102: a list or profile that could not be loaded says so, with a way to try
// again, instead of looking empty ("No notifications", "Member not found").
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const down = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) });
const onlyGet = (handler) => (route) => (route.request().method() === 'GET' ? handler(route) : route.fallback());
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function newMember(owner, lastName) {
  return call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Lena', lastName, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) },
  });
}

test('the header bell says when notifications could not be loaded, and tries again', async ({ page }) => {
  const owner = await registerGym();
  await page.route('**/api/notifications', onlyGet(down));
  await signIn(page, owner);
  await page.goto('/dashboard');
  await page.locator('svg.lucide-bell').first().click();

  await expect(page.getByText('Could not load your notifications. Try again in a moment.')).toBeVisible();
  await expect(page.getByText('No notifications')).toHaveCount(0);
  await page.unroute('**/api/notifications');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Could not load your notifications. Try again in a moment.')).toHaveCount(0);
});

test("the desk's bell says when notifications could not be loaded", async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Bella', lastName: 'Bell' });
  await page.addInitScript((staffId) => {
    if (/^https?:$/.test(location.protocol) && !sessionStorage.getItem('fd_session')) {
      sessionStorage.setItem('fd_session', JSON.stringify({ staffId, staffName: 'Bella Bell' }));
    }
  }, desk.id);
  await page.route('**/api/notifications', onlyGet(down));
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Notifications' }).first().click();

  await expect(page.getByText('Could not load your notifications. Try again in a moment.')).toBeVisible();
});

test('a member who could not be loaded is not called missing', async ({ page }) => {
  const owner = await registerGym();
  const member = await newMember(owner, 'Loadfail');
  await page.route(`**/api/members/${member.id}`, onlyGet(down));
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);

  await expect(page.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('Member not found')).toHaveCount(0);
  await page.unroute(`**/api/members/${member.id}`);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Lena Loadfail').first()).toBeVisible();
});

test('a member who does not exist is still "not found"', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/members/no-such-member');
  await expect(page.getByText('Member not found')).toBeVisible();
});

test("a member's progress, coaches and messages say when they could not be loaded", async ({ page }) => {
  const owner = await registerGym();
  const member = await newMember(owner, 'Partial');
  await page.route(`**/api/coach/progress/${member.id}`, onlyGet(down));
  await page.route('**/api/staff', onlyGet(down));
  await page.route(`**/api/communications/member/${member.id}`, onlyGet(down));
  await signIn(page, owner);
  await page.goto(`/members/${member.id}`);

  await expect(page.getByText('The list of coaches could not be loaded.')).toBeVisible();
  await page.getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByText("This member's progress could not be loaded.")).toBeVisible();
  await expect(page.getByText('No progress yet')).toHaveCount(0);
  await page.getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByText('The messages could not be loaded.')).toBeVisible();
});

test("a staff profile says when its tasks or calendar could not be loaded", async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Tess', lastName: 'Tasks' });
  await page.route('**/api/tasks', onlyGet(down));
  await page.route('**/api/calendar', onlyGet(down));
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);

  await page.getByRole('main').getByRole('button', { name: 'Tasks' }).first().click();
  await expect(page.getByText('Tasks could not be loaded, so this list may be incomplete.')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Calendar' }).first().click();
  await expect(page.getByText('The calendar could not be loaded, so this list may be incomplete.')).toBeVisible();
  await page.unroute('**/api/calendar');
  await page.unroute('**/api/tasks');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('The calendar could not be loaded, so this list may be incomplete.')).toHaveCount(0);
});
