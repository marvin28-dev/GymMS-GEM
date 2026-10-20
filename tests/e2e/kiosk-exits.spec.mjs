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

test("a coach's client opened from the desk stays inside the desk", async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer', firstName: 'Cora', lastName: 'Coach' });
  const today = new Date().toISOString().slice(0, 10);
  const member = await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Kiosk', lastName: 'Client', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: today, endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) },
  });
  await call('POST', '/coach/assign', { token: owner.token, body: { memberId: member.id, coachId: coach.id } });

  await signIn(page, owner);
  await page.goto(`/front-desk/staff/${coach.id}`);
  await page.getByRole('button', { name: 'Clients' }).click();
  await page.getByText('Kiosk Client').first().click();
  await expect(page).toHaveURL(new RegExp(`/front-desk/member/${member.id}$`));
});
