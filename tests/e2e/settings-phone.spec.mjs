// D-40: on a phone, Settings offered only Appearance, Language and the log;
// the gym profile, payment methods and packages said to open them on a
// computer. They are now the same panels as on a desk.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

test('the gym profile, payment methods and package settings work on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone layout check');
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings');
  const fitsWidth = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  await page.getByRole('button', { name: 'Gym Profile' }).click();
  await expect(page.getByText('Open on desktop', { exact: false })).toHaveCount(0);
  await expect(page.locator('input').first()).toBeVisible();
  expect(await fitsWidth()).toBe(true);

  await page.getByRole('button', { name: 'Payment Settings' }).click();
  const card = page.getByLabel('Credit/Debit Card');
  await expect(card).toBeChecked();
  await card.uncheck();
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).settings?.payment?.methods).not.toContain('Credit/Debit Card');
  expect(await fitsWidth()).toBe(true);

  await page.getByRole('button', { name: 'Package Settings' }).click();
  await expect(page.getByPlaceholder('e.g. Cardio Zone Only')).toBeVisible();
  expect(await fitsWidth()).toBe(true);
});

// D-23: members were written to in English only
test('the language of emails to members is chosen in Settings and kept on the gym', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=language');
  const card = page.locator('[data-email-language]');
  await expect(card.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: 'Français' }).click();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).settings?.emailLanguage).toBe('fr');
  await page.reload();
  await expect(page.locator('[data-email-language]').getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
});

// The interface language was a clickable box a keyboard could not reach, and
// since D-23 the page holds two choices of English / Français
test('each language choice is a named group of buttons a keyboard can use', async ({ page, isMobile }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=language');
  const ui = page.getByRole('group', { name: isMobile ? 'Interface language' : 'Choose Language' });
  await expect(page.getByRole('group', { name: 'Emails to members' })).toBeVisible();
  await expect(ui.getByRole('button', { name: /English/ })).toHaveAttribute('aria-pressed', 'true');
  await ui.getByRole('button', { name: /Français/ }).focus();
  await page.keyboard.press('Enter');
  // The page is now in French, the group's name with it
  const enFrancais = page.getByRole('group', { name: isMobile ? "Langue de l'interface" : 'Choisir la langue' });
  await expect(enFrancais.getByRole('button', { name: /Français/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'E-mails aux membres' }).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
});
