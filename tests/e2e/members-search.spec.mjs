// F-078 (screen part): the Members search never matches a member's secret
// check-in code, so typing four digits cannot reveal whose code it is. The
// front desk may search Members but must never learn a code.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

test('the members search does not find anyone by their check-in code', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  // A member whose code does not also appear in their member ID
  let member;
  for (let i = 0; i < 5 && !member; i += 1) {
    const made = await call('POST', '/members', {
      token: owner.token,
      body: { firstName: 'Secretcode', lastName: `Holder${i}`, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: today, endDate: later },
    });
    const full = await call('GET', `/members/${made.id}`, { token: owner.token });
    if (full.accessCode && !String(full.memberCode).includes(full.accessCode)) member = full;
  }
  expect(member, 'a member with a code not inside their member ID').toBeTruthy();

  await signIn(page, desk);
  await page.goto('/members');
  const search = page.getByPlaceholder('Search name, phone, email, ID...');
  await search.fill('Secretcode');
  await expect(page.getByText(member.lastName).first()).toBeVisible();

  await search.fill(member.accessCode);
  await expect(page.getByText(member.lastName)).toHaveCount(0);
});
