// F-087: older roles get the right pages. An "accountant" account (the role is
// still in the schema) used to see every page, each of them empty.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff } from './support/session.mjs';

const as = (session, role) => ({ ...session, user: { ...session.user, role } });

test('an account with an unknown role lands on its own profile, with no other pages', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { role: 'other', firstName: 'Acc', lastName: 'Ountant' });
  await signIn(page, as(staff, 'accountant'));
  await page.goto('/accounting');
  await expect(page).toHaveURL(/\/my-profile$/);
  await expect(page.getByRole('link', { name: 'Accounting' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accounting' })).toHaveCount(0);
});

test('an instructor can open Members, as a trainer can', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Ina', lastName: 'Instructor' });
  await signIn(page, as(trainer, 'instructor'));
  await page.goto('/members');
  await expect(page).toHaveURL(/\/members$/);
});
