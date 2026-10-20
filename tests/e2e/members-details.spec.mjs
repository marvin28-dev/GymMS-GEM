// F-119: the visitors' "Sessions left" filter reads their real passes, and a
// member added on a phone shows in the list at once.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';
import { fillNewMember, gymWithPackage } from './support/forms.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const visitor = (owner, lastName, passes) => call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Vic', lastName, city: 'Douala', region: 'Littoral', isVisitor: true, status: 'visitor', passesTotal: passes, passesRemaining: passes, startDate: day(), endDate: day(30), initialPayment: { amount: 5000, method: 'cash' } },
});

test("the visitors' Sessions left filter keeps the visitors with that many passes", async ({ page }) => {
  const owner = await registerGym();
  await visitor(owner, 'Lastpass', 1);
  await visitor(owner, 'Manypass', 8);
  await signIn(page, owner);
  await page.goto('/members');
  await expect(page.getByText('Vic Manypass').first()).toBeVisible();
  await page.getByRole('group', { name: /type/i }).getByRole('button', { name: 'Visitors' }).click();
  await page.getByRole('button', { name: 'Sessions Left' }).click();
  await page.getByText('1 left', { exact: true }).click();

  await expect(page.getByText('Vic Lastpass').first()).toBeVisible();
  await expect(page.getByText('Vic Manypass')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a member just added shows in the list at once', async ({ page }) => {
    const owner = await gymWithPackage();
    await signIn(page, owner);
    await page.goto('/members');
    await expect(page.getByTitle('Add Member')).toBeVisible();
    // The list must show the new member by itself, not only after the live
    // reload that follows (which this blocks)
    await page.route(/\/api\/members(\?|$)/, route => (route.request().method() === 'GET' ? route.abort() : route.fallback()));
    const d = await fillNewMember(page, 'Phoneadd');
    await d.getByRole('button', { name: 'Create Member →' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Photo Phoneadd').first()).toBeVisible();
  });
});
