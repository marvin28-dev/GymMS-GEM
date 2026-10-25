// F-106: nothing on the front desk leads into the app without the manager's
// exit password. CLAUDE.md: profiles opened from the desk stay on /front-desk.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

test("the desk's sign-in screen asks for the password before leaving", async ({ page }) => {
  const owner = await registerGym();
  // The desk's session ends when the person working it is deactivated, and the
  // desk falls back to its sign-in screen
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Dana', lastName: 'Desk' });
  await call('PATCH', `/staff/${desk.id}`, { token: owner.token, body: { isActive: false } });
  await page.addInitScript((staffId) => {
    if (/^https?:$/.test(location.protocol) && !sessionStorage.getItem('fd_session')) {
      sessionStorage.setItem('fd_session', JSON.stringify({ staffId, staffName: 'Dana Desk' }));
    }
  }, desk.id);
  await signIn(page, owner);
  await page.goto('/front-desk');

  const back = page.getByText('← Back to Dashboard');
  await back.click();
  await expect(page.getByText('Enter your password to leave the front desk')).toBeVisible();
  await expect(page).toHaveURL(/\/front-desk$/);
});

// D-41: this test followed a coach's client from the coach's profile on the
// desk into the desk's member page. The desk no longer shows a colleague's
// clients, pay or notes (anyone standing at it sees the screen, whoever is
// signed in); a manager reads them in the app, and the desk shows only your own.
test("a colleague's clients, pay and notes are not shown on the desk, only in the app", async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Cora', lastName: 'Coach' });
  const tab = (name) => page.getByRole('button', { name, exact: true });

  await signIn(page, owner);
  await page.goto(`/front-desk/staff/${coach.id}`);
  await expect(tab('Schedule').first()).toBeVisible();
  for (const name of ['Clients', 'Pay & Earnings', 'Notes']) await expect(tab(name), name).toHaveCount(0);

  await page.goto(`/staff/${coach.id}`);
  for (const name of ['Clients', 'Pay & Earnings', 'Notes']) await expect(tab(name).first(), name).toBeVisible();

  await page.goto('/front-desk/my-profile');
  await expect(tab('Pay & Earnings').first()).toBeVisible();
});
