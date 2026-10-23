// Journey J-22 (staff): adding someone through the form, a new 4-digit code,
// deactivating and bringing them back, who sees a photo ID, and the code box
// that stops after too many wrong codes.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, mailTo, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

async function confirmWithCode(page, code) {
  await page.getByPlaceholder('••••').fill(code);
  await page.getByRole('button', { name: 'Authorize' }).click();
}

test('J-22: a trainer added through the form is listed, and emailed how to sign in without their code', async ({ page }) => {
  const owner = await registerGym();
  const email = `tina.${uniqueCode('t')}@example.test`;
  await signIn(page, owner);
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Add Staff Member' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('First Name').fill('Tina');
  await dialog.getByPlaceholder('Last Name').fill('Trainer');
  await dialog.locator('input[inputmode="tel"]').first().fill('677123456');
  await dialog.getByPlaceholder('email@gemgym.cm').fill(email);
  await dialog.locator('select', { has: page.locator('option', { hasText: 'Trainer' }) }).first().selectOption({ label: 'Trainer' });
  await dialog.locator('input[type="date"]').first().fill(localDay());
  await dialog.locator('input[autocomplete="street-address"]').fill('Rue de la Joie');
  await dialog.locator('input[autocomplete="address-level2"]').fill('Douala');
  await dialog.locator('input[autocomplete="address-level1"]').fill('Littoral');
  await dialog.getByRole('button', { name: 'Add Staff Member' }).click();

  await expect(page).toHaveURL(/\/staff\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { name: 'Tina Trainer' })).toBeVisible();
  const id = page.url().split('/').pop();

  await expect.poll(async () => (await mailTo(email)).length).toBeGreaterThan(0);
  const [welcome] = await mailTo(email);
  const { accessCode } = await call('GET', `/staff/${id}/code`, { token: owner.token });
  expect(welcome.html).toContain(owner.gymCode);
  const words = welcome.html.replace(/<[^>]+>/g, ' ');
  expect(words).not.toMatch(new RegExp(`\\b${accessCode}\\b`));

  await page.goto('/staff');
  const row = page.getByRole('row').filter({ hasText: 'Tina Trainer' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Trainer', { exact: true })).toBeVisible();
});

test('J-22: a new 4-digit code replaces the old one, once the old one has been seen', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Nico', lastName: 'Newcode' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  // Nothing to replace before the code has been looked at
  await expect(page.getByRole('button', { name: 'New code' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View Code' }).click();
  await confirmWithCode(page, owner.accessCode);
  await expect(page.getByText(staff.accessCode, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New code' }).click();
  await confirmWithCode(page, owner.accessCode);
  await expect(page.getByText('New code issued. The old one no longer works.')).toBeVisible();
  const { accessCode } = await call('GET', `/staff/${staff.id}/code`, { token: owner.token });
  expect(accessCode).not.toBe(staff.accessCode);
  await expect(page.getByText(accessCode, { exact: true })).toBeVisible();
});

test('J-22: a deactivated employee moves to the Deactivated tab and can be brought back', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Dina', lastName: 'Away' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await confirmWithCode(page, owner.accessCode);
  await expect(page.getByRole('button', { name: 'Reactivate' })).toBeVisible();

  await page.goto('/staff');
  await expect(page.getByRole('row').filter({ hasText: 'Dina Away' })).toHaveCount(0);
  await page.getByRole('tab', { name: /^Deactivated/ }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Dina Away' })).toBeVisible();

  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await confirmWithCode(page, owner.accessCode);
  await expect(page.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(true);
  await page.goto('/staff');
  await expect(page.getByRole('row').filter({ hasText: 'Dina Away' })).toBeVisible();
});

// Browser check owed for 4258be0
test('J-22: a colleague sees that a photo ID is on file but cannot download it; the person can', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Ida', lastName: 'Ident' });
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Cole', lastName: 'League' });
  await call('PATCH', `/staff/${trainer.id}`, { token: owner.token, body: { photoId: 'https://res.cloudinary.test/gem/staff/ids/ida.png' } });

  await signIn(page, desk);
  await page.goto(`/front-desk/staff/${trainer.id}`);
  await expect(page.getByText('Photo ID on file')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);

  const own = await page.context().browser().newPage();
  await signIn(own, trainer);
  await own.goto('/my-profile');
  await expect(own.getByText('Photo ID on file')).toBeVisible();
  await expect(own.getByRole('button', { name: 'Download' })).toBeVisible();
  await own.close();
});

// Browser check owed for 6fe825d
for (const lang of ['en', 'fr']) {
  test(`J-22: five wrong codes stop the code box, and it says so in ${lang === 'fr' ? 'French' : 'English'}`, async ({ page }) => {
    const owner = await registerGym();
    const staff = await addStaff(owner, { firstName: 'Lock', lastName: 'Out' });
    await page.addInitScript((l) => localStorage.setItem('gem-lang', l), lang);
    await signIn(page, owner);
    await page.goto(`/staff/${staff.id}`);
    await page.getByRole('button', { name: lang === 'fr' ? 'Voir' : 'View Code' }).first().click();
    const wrong = owner.accessCode === '0000' ? '1111' : '0000';
    const stopped = lang === 'fr' ? /Trop d'essais\. Réessayez dans \d+ min\./ : /Too many tries\. Try again in \d+ min\./;
    for (let i = 0; i < 6 && !(await page.getByText(stopped).count()); i += 1) {
      await page.getByPlaceholder('••••').fill(wrong);
      await page.getByRole('button', { name: lang === 'fr' ? 'Autoriser' : 'Authorize' }).click();
      // The box clears itself after showing each refusal
      await expect(page.getByPlaceholder('••••')).toHaveValue('');
    }
    await expect(page.getByText(stopped)).toBeVisible();
    // Even the right code is refused now
    await page.getByPlaceholder('••••').fill(owner.accessCode);
    await page.getByRole('button', { name: lang === 'fr' ? 'Autoriser' : 'Authorize' }).click();
    await expect(page.getByText(stopped)).toBeVisible();
    await expect(page.getByText(staff.accessCode, { exact: true })).toHaveCount(0);
  });
}
