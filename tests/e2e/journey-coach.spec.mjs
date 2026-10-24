// Journeys J-10 and J-12 (coaching): a coach takes a member on from the
// profile with their starting measurements and goals, logs a session on the
// Progress tab, and finds the client on their own dashboard.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { localDay, PNG } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

// A field by its label (the labels are not yet tied to their boxes, F-092)
const field = (scope, label) => scope.locator(`div:has(> label:text-matches("^${label.replace(/[()]/g, '\\\\$&')}( [*])?$")) > input`);

test('J-10: a coach takes a member on with goals, logs a session, and sees them on their dashboard', async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Kai', lastName: 'Coach' });
  const lastName = `Client${uniqueCode('k').slice(-5)}`;
  const member = await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Lou', lastName, city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) },
  });

  await signIn(page, coach);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Coach this member' }).click();
  const form = page.getByRole('dialog');
  await field(form, 'Weight (kg)').fill('82,5');
  await field(form, 'Waist (cm)').fill('90');
  await form.getByRole('radio', { name: 'Lose weight' }).click();
  await field(form, 'Goal weight (kg)').fill('75');
  await field(form, 'Goal waist (cm)').fill('80');
  await form.getByRole('radio', { name: '3', exact: true }).click();
  await form.getByRole('button', { name: 'Start coaching' }).click();
  await expect(page.getByText('You coach this member')).toBeVisible();
  const saved = await call('GET', `/members/${member.id}`, { token: owner.token });
  expect(saved).toMatchObject({ coachId: coach.id, goalType: 'lose_weight', goalWeight: 75, goalSessionsPerWeek: 3 });

  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.locator('[data-log-open="session"]').click();
  const log = page.getByRole('dialog');
  await log.getByRole('button', { name: /^45/ }).click();
  await log.getByRole('button', { name: 'Upper body' }).click();
  await log.getByRole('radio', { name: 'Hard' }).click();
  await log.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-log-row="session"]')).toHaveCount(1);
  const entries = await call('GET', `/coach/progress/${member.id}`, { token: owner.token });
  expect(entries.find(e => e.kind === 'session')).toMatchObject({ durationMin: 45, effort: 'hard', focus: 'upper' });
  // The starting measurements were saved with the decimal comma read as a point
  expect(entries.find(e => e.kind === 'measure')).toMatchObject({ weight: 82.5, waist: 90 });

  await page.goto('/dashboard');
  await expect(page.getByText(`Lou ${lastName}`).first()).toBeVisible();
});

// F-130: editing a member is the desk's and management's. A coach was offered
// the photo upload and removal, which the server refuses, and saw nothing happen.
test('J-10: a coach can look at a member\'s photo but not change it; a manager can', async ({ page, browser }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Pia', lastName: 'Coach' });
  const body = { city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) };
  const pictured = await call('POST', '/members', { token: owner.token, body: { ...body, firstName: 'Pat', lastName: 'Pictured', photo: 'https://res.cloudinary.test/gem/members/face.png' } });
  const plain = await call('POST', '/members', { token: owner.token, body: { ...body, firstName: 'Nia', lastName: 'Nophoto' } });
  await page.route('https://res.cloudinary.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));

  await signIn(page, coach);
  await page.goto(`/members/${pictured.id}`);
  await page.getByAltText('Pat').first().click();
  await expect(page.getByRole('dialog', { name: 'Profile Photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload New Photo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto(`/members/${plain.id}`);
  await expect(page.getByRole('heading', { name: 'Nia Nophoto' })).toBeVisible();
  await expect(page.getByTitle('Upload profile photo')).toHaveCount(0);

  const office = await browser.newContext();
  const manager = await office.newPage();
  await manager.route('https://res.cloudinary.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await signIn(manager, owner);
  await manager.goto(`/members/${pictured.id}`);
  await manager.getByAltText('Pat').first().click();
  await expect(manager.getByRole('button', { name: 'Upload New Photo' })).toBeVisible();
  await expect(manager.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await manager.goto(`/members/${plain.id}`);
  await expect(manager.getByTitle('Upload profile photo')).toBeVisible();
  await office.close();
});
