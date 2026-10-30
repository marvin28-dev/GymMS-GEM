// The owner's requests of 30 October 2026: a new employee's pay is for the
// next pay day, never overdue from the day they were added; the gym profile's
// Save confirms it during setup even with nothing changed; a new gym has no
// access types but Full Access, which greys out the others in a package.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const monthName = (d) => d.toLocaleString('en-US', { month: 'short' });

test("someone added after this month's pay day is first paid next month, not overdue (desk or phone)", async ({ page }) => {
  const today = new Date();
  test.skip(today.getDate() === 1, 'no day of this month is before today');
  const owner = await registerGym();
  // Pay days run 1 to 28 (staff.controller)
  const payDay = Math.min(28, today.getDate() - 1);
  const staff = await addStaff(owner, { firstName: 'Nina', lastName: 'Newhire', role: 'trainer', salary: 90000, payDay });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}?tab=pay`);
  const next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(payDay, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));
  await expect(page.getByText(new RegExp(`Due in \\d+ days, ${next.getDate()} ${monthName(next)}`)).first()).toBeVisible();
  await expect(page.getByText(/Overdue since/)).toHaveCount(0);
});

test('the gym profile saves and confirms during setup with nothing changed (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  await expect(page.getByText('Complete your gym profile')).toBeVisible();
  const save = page.locator('[data-save-gym-profile]');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
  await expect(page.getByText('Complete your gym profile')).toHaveCount(0);
  expect((await call('GET', '/gyms/me/setup', { token: owner.token })).confirmedSections).toContain('gym-profile');
});

test('a new gym offers only Full Access, which greys out the gym\'s own types in a package (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);

  await page.goto('/settings?section=packages');
  await expect(page.locator('[data-access-type-fixed]')).toContainText('Full Access');
  await expect(page.getByText('No access types of your own yet. Add one below.')).toBeVisible();
  for (const example of ['Gym Only', 'Classes Only', 'Pool Access', 'Premium (All-Inclusive)']) {
    await expect(page.getByText(example, { exact: true }), example).toHaveCount(0);
  }
  // Full Access can't be added twice; the gym's own types can
  const box = page.getByPlaceholder('e.g. Cardio Zone Only');
  await box.fill('full access');
  await box.press('Enter');
  await expect(page.getByText('Full Access is always offered. Add your own types here.')).toBeVisible();
  await box.fill('Pool');
  await box.press('Enter');
  await expect(page.getByText('Pool', { exact: true })).toBeVisible();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).settings?.accessTypes).toEqual(['Pool']);

  await page.goto('/packages');
  await page.getByRole('button', { name: 'Add Package' }).first().click();
  const dialog = page.getByRole('dialog');
  const full = dialog.locator('[data-access-option="Full Access"] input');
  const pool = dialog.locator('[data-access-option="Pool"] input');
  await pool.check();
  await full.check();
  await expect(pool).toBeDisabled();
  await expect(pool).not.toBeChecked();
  await expect(dialog.getByText('Full Access includes everything, so no other type is needed.')).toBeVisible();
  await full.uncheck();
  await expect(pool).toBeEnabled();
});
