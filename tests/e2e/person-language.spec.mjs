// Each member and each staff member has a language (the owner, 21 November
// 2026): chosen in the Add forms, shown and changed on their profile. A
// member's emails are written in it; for staff, GEM opens in it when they sign
// in, and changing your own switches the screen at once.
import { test, expect } from '@playwright/test';
import { registerGym, addStaff, signIn, call, mailTo, uniqueCode } from './support/session.mjs';
import { fillNewMember, gymWithPackage, localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

test('a member added in French is written to in French, and the profile says so (desk or phone)', async ({ page }) => {
  const owner = await gymWithPackage();
  await signIn(page, owner);
  await page.goto('/members');
  const lastName = `Langue${uniqueCode('m').slice(-5)}`;
  const d = await fillNewMember(page, lastName);
  const choice = d.locator('[data-language-choice]');
  // A new member starts in the gym's language for members
  await expect(choice.locator('[data-language="en"]')).toHaveAttribute('aria-pressed', 'true');
  await choice.locator('[data-language="fr"]').click();
  await expect(choice.locator('[data-language="fr"]')).toHaveAttribute('aria-pressed', 'true');
  await d.getByRole('button', { name: 'Create Member →' }).click();
  // A computer opens the new profile; a phone goes back to the list
  let made;
  await expect.poll(async () => { made = (await call('GET', '/members', { token: owner.token })).find(m => m.lastName === lastName); return !!made; }).toBe(true);
  const member = await call('GET', `/members/${made.id}`, { token: owner.token });
  expect(member.language).toBe('fr');
  await expect.poll(async () => (await mailTo(member.email)).some(m => m.subject.startsWith('Bienvenue chez'))).toBe(true);

  // Shown on the profile, and changed from Edit personal details
  await page.goto(`/members/${made.id}`);
  const shown = page.locator('[data-member-language]');
  await expect(shown).toContainText('Français');
  await page.getByRole('button', { name: 'Edit Personal Details' }).click();
  const edit = page.getByRole('dialog');
  await edit.locator('[data-language="en"]').click();
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(shown).toContainText('English');
  expect((await call('GET', `/members/${made.id}`, { token: owner.token })).language).toBe('en');
});

test('a staff member added in French gets a French welcome, and GEM opens in French when they sign in', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/staff');
  const email = `fr.${uniqueCode('s')}@example.test`;
  await page.getByRole('button', { name: 'Add Staff Member' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('First Name').fill('Fanta');
  await dialog.getByPlaceholder('Last Name').fill('Francais');
  await dialog.locator('input[inputmode="tel"]').first().fill('677123456');
  await dialog.getByPlaceholder('email@gemgym.cm').fill(email);
  await dialog.locator('[data-language-choice] [data-language="fr"]').click();
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Trainer' }) }).first().selectOption({ label: 'Trainer' });
  await dialog.locator('input[type="date"]').first().fill(localDay());
  await dialog.locator('input[data-address="street"]').fill('Rue de la Joie');
  await dialog.locator('input[data-address="city"]').fill('Douala');
  await dialog.locator('input[data-address="region"]').fill('Littoral');
  await dialog.getByRole('button', { name: 'Add Staff Member' }).click();
  await expect(page).toHaveURL(/\/staff\/[a-z0-9]+$/);
  await expect(page.locator('main')).toContainText('Français');

  await expect.poll(async () => (await mailTo(email)).some(m => m.subject.startsWith('Votre compte'))).toBe(true);

  // They claim the account on the gym's sign-in page, which is in English
  const id = page.url().split('/').pop();
  const { accessCode } = await call('GET', `/staff/${id}/code`, { token: owner.token });
  const fresh = await page.context().browser().newContext();
  const theirs = await fresh.newPage();
  await theirs.goto(`/${owner.gymCode}/login`);
  await theirs.getByPlaceholder('Enter your email').fill(email);
  await theirs.getByRole('button', { name: 'Continue' }).click();
  await theirs.getByPlaceholder('••••').fill(accessCode);
  await theirs.getByPlaceholder('Enter your password').fill('Fanta-pass-1');
  await theirs.getByPlaceholder('Re-enter password').fill('Fanta-pass-1');
  await theirs.getByRole('button', { name: 'Sign In' }).click();
  await expect(theirs).toHaveURL(/\/dashboard$/);
  await expect(theirs.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(theirs.getByText('Tableau de bord').first()).toBeVisible();
  await fresh.close();
});

test('changing your own language on your profile switches the screen and is kept (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', language: 'en', street: 'Rue de la Joie' });
  await signIn(page, trainer);
  await page.goto('/my-profile');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Edit Profile' }).first().click();
  // Editing your own profile starts with your own 4-digit code
  await page.getByRole('dialog', { name: "Confirm it's you" }).getByPlaceholder('••••').fill(trainer.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByText('GEM opens in this language when you sign in, and your emails are in it too.')).toBeVisible();
  await edit.locator('[data-language="fr"]').click();
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect((await call('GET', `/staff/${trainer.id}`, { token: owner.token })).language).toBe('fr');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test("the owner's screen language in Settings is saved to their account", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=language');
  await page.locator('[data-interface-language] button', { hasText: 'Français' }).first().click()
    .catch(() => page.getByRole('button', { name: /Français/ }).first().click());
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect.poll(async () => (await call('GET', `/staff/${owner.user.id}`, { token: owner.token })).language).toBe('fr');
});
