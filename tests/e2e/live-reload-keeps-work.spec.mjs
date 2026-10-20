// F-112: screens reload whenever something happens elsewhere in the gym, but
// never over work that is not saved yet.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// A write by someone else: the server tells every open screen of the gym. An
// expense by default; a screen that follows only some kinds of change is
// given one of those.
const anExpense = (owner) => call('POST', '/expenses', { token: owner.token, body: { title: 'Elsewhere', category: 'Other', amount: 1000, date: day(), paidTo: 'Someone', method: 'cash' } });
async function somethingHappensElsewhere(page, owner, reloadedUrl, write = anExpense) {
  const reloaded = page.waitForResponse(r => reloadedUrl.test(r.url()) && r.request().method() === 'GET');
  await write(owner);
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

const newMember = (owner, body = {}) => call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Lena', lastName: 'Livetest', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), ...body },
});

test("a member's details being edited survive a change elsewhere in the gym", async ({ page }) => {
  const owner = await registerGym();
  const m = await newMember(owner);
  await signIn(page, owner);
  await page.goto(`/members/${m.id}`);
  await page.getByRole('button', { name: 'Edit Personal Details' }).click();
  const firstName = page.getByRole('dialog').getByPlaceholder('First Name');
  await expect(firstName).toHaveValue('Lena');
  await firstName.fill('Lenora');

  await somethingHappensElsewhere(page, owner, new RegExp(`/api/members/${m.id}$`));
  await expect(firstName).toHaveValue('Lenora');
});

test('a renewal being chosen survives a change elsewhere in the gym', async ({ page }) => {
  const owner = await registerGym();
  const pkgBody = (name, price) => ({ name, price, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' });
  const basic = await call('POST', '/packages', { token: owner.token, body: pkgBody('Basic Live', 10000) });
  await call('POST', '/packages', { token: owner.token, body: pkgBody('Gold Live', 20000) });
  const m = await newMember(owner, { packageId: basic.id, balance: 0 });
  await signIn(page, owner);
  await page.goto(`/members/${m.id}`);
  await page.getByRole('button', { name: 'Membership', exact: true }).click();
  await page.getByRole('button', { name: 'Renew', exact: true }).first().click();
  const pkgSelect = page.getByRole('dialog').locator('select').first();
  await pkgSelect.selectOption('Gold Live');

  await somethingHappensElsewhere(page, owner, new RegExp(`/api/members/${m.id}$`));
  await expect(pkgSelect).toHaveValue('Gold Live');
});

test("a client's goals being set survive a change elsewhere in the gym", async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Gia', lastName: 'Goals' });
  const m = await newMember(owner);
  await call('POST', '/coach/assign', { token: owner.token, body: { memberId: m.id, coachId: coach.id } });
  await signIn(page, coach);
  await page.goto(`/members/${m.id}`);
  await page.getByRole('button', { name: 'Set goals' }).first().click();
  const dialog = page.getByRole('dialog');
  const firstFigure = dialog.locator('input[inputmode="decimal"]').first();
  await firstFigure.fill('82');

  await somethingHappensElsewhere(page, owner, new RegExp(`/api/members/${m.id}$`));
  await expect(firstFigure).toHaveValue('82');
});

test("the coach's Log menu stays open through a change elsewhere in the gym", async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Lou', lastName: 'Logger' });
  const m = await newMember(owner, { firstName: 'Cleo', lastName: 'Client' });
  // Goals and a check-in this week, so the client's main button is the Log menu
  await call('POST', '/coach/assign', {
    token: coach.token,
    body: { memberId: m.id, coachId: coach.id, goals: { goalType: 'lose_weight', goalWeight: 70, goalWaist: 80, goalSessionsPerWeek: 3 }, baseline: { weight: 80, waist: 90 } },
  });
  await signIn(page, coach);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Log', exact: true }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Session' })).toBeVisible();

  await somethingHappensElsewhere(page, owner, /\/api\/coach\/overview/, o => newMember(o, { firstName: 'Other', lastName: 'Joiner' }));
  await expect(page.getByRole('menuitem', { name: 'Session' })).toBeVisible();
});
