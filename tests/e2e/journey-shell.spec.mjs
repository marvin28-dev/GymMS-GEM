// Journey J-27 (the app around the pages): the header search finds pages and
// people and only what the role may open, the language and the theme stick
// after a reload, and on a phone the bottom bar's More opens every page.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

test('J-27: Ctrl+K searches pages and members, and Enter opens the first', async ({ page }) => {
  const owner = await registerGym();
  const lastName = `Findme${uniqueCode('f').slice(-5)}`;
  const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Sara', lastName, city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) } });
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.keyboard.press('Control+k');
  const box = page.getByPlaceholder('Search pages, settings, people…').first();
  await expect(box).toBeFocused();
  await box.fill('Payments');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/payments$/);

  await page.keyboard.press('Control+k');
  await box.fill(lastName);
  await page.getByText(`Sara ${lastName}`).first().click();
  await expect(page).toHaveURL(new RegExp(`/members/${member.id}$`));
});

test('J-27: the search offers a trainer only the pages a trainer may open', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer' });
  await signIn(page, trainer);
  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  const box = page.getByPlaceholder('Search pages, settings, people…').first();
  await box.fill('Accounting');
  await expect(page.getByText('Nothing found for "Accounting"')).toBeVisible();
  await box.fill('Calendar');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/calendar$/);
});

test('J-27: French stays French, and the light theme stays light, after a reload', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=language');
  await page.locator('[data-interface-language]').getByText('Français', { exact: true }).click();
  await expect(page.getByRole('navigation').getByText('Membres', { exact: true })).toBeVisible();

  await page.goto('/settings?section=appearance');
  await page.getByText('Ivoire', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('navigation').getByText('Membres', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByText('Members', { exact: true })).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('J-27: the bottom bar opens the main pages, and More opens the rest', async ({ page }) => {
    const owner = await registerGym();
    await signIn(page, owner);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Members', exact: true }).last().click();
    await expect(page).toHaveURL(/\/members$/);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByText('Payments', { exact: true }).last().click();
    await expect(page).toHaveURL(/\/payments$/);
    // Nothing is wider than the phone
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide).toBeLessThanOrEqual(0);
  });
});
