// F-112: screens reload whenever something happens elsewhere in the gym, but
// never over work that is not saved yet.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// A write by someone else: the server tells every open screen of the gym
async function somethingHappensElsewhere(page, owner, reloadedUrl) {
  const reloaded = page.waitForResponse(r => reloadedUrl.test(r.url()) && r.request().method() === 'GET');
  await call('POST', '/expenses', { token: owner.token, body: { title: 'Elsewhere', category: 'Other', amount: 1000, date: day(), paidTo: 'Someone', method: 'cash' } });
  await reloaded;
  // The reload has landed; give the screen a moment to apply it
  await page.waitForTimeout(500);
}

test('a rota being edited survives a change elsewhere in the gym', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Rota', lastName: 'Kept' });
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  await call('PATCH', `/staff/${staff.id}`, { token: owner.token, body: { schedule: Object.fromEntries(days.map(d => [d, { start: '09:00', end: '17:00', off: false }])) } });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Schedule' }).first().click();
  const monday = page.locator('input[type="checkbox"][id^="off-"]').first();
  const before = await monday.isChecked();
  await monday.click();
  await expect(monday).toBeChecked({ checked: !before });

  await somethingHappensElsewhere(page, owner, new RegExp(`/api/staff/${staff.id}$`));
  await expect(monday).toBeChecked({ checked: !before });
});

test("in one-week mode a reload keeps that week's rota, not the repeating one", async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Week', lastName: 'Kept' });
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const thisWeek = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  // Monday is worked in the repeating pattern and off in this week's exception
  await call('PATCH', `/staff/${staff.id}`, {
    token: owner.token,
    body: {
      schedule: Object.fromEntries(days.map(d => [d, { start: '09:00', end: '17:00', off: false }])),
      scheduleOverrides: { [thisWeek]: Object.fromEntries(days.map(d => [d, { start: '09:00', end: '17:00', off: d === 'Monday' }])) },
    },
  });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Schedule' }).first().click();
  await page.getByRole('button', { name: 'One week' }).click();
  const mondayOff = page.locator('input[type="checkbox"][id^="off-"]').first();
  await expect(mondayOff).toBeChecked();

  await somethingHappensElsewhere(page, owner, new RegExp(`/api/staff/${staff.id}$`));
  await expect(mondayOff).toBeChecked();
});
