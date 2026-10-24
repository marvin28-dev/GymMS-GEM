// Journey J-26 (settings): moving the gym to another country moves its money
// with it on every screen, the opening hours count as an edit for Revert and
// Save, and the payment methods ticked are the only ones the forms offer.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';
import { PNG } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

const fieldAfter = (page, label) => page.getByText(label, { exact: true }).locator('xpath=..').locator('input, select');

async function openGymProfile(page, owner) {
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  await expect(fieldAfter(page, 'Gym Name *')).toHaveValue(/E2E Gym/);
}

test('J-26: a gym moved to Nigeria prices everything in naira', async ({ page }) => {
  const owner = await registerGym();
  await openGymProfile(page, owner);
  const country = fieldAfter(page, 'Country');
  await expect(country).toHaveValue('Cameroon');
  await country.selectOption('Nigeria');
  await expect(page.getByText('Saving this will switch the gym to NGN.')).toBeVisible();
  await fieldAfter(page, 'City').selectOption('Lagos');
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect(page.getByText(/Saved successfully/)).toBeVisible();
  expect(await call('GET', '/gyms/me', { token: owner.token })).toMatchObject({ country: 'Nigeria', currency: 'NGN' });

  await page.goto('/sales');
  await expect(page.getByText('Shop sales today', { exact: true }).locator('xpath=preceding-sibling::div[1]')).toHaveText('₦0');
});

test('J-26: a change to the opening hours can be reverted, and saved', async ({ page }) => {
  const owner = await registerGym();
  await openGymProfile(page, owner);
  const save = page.getByRole('button', { name: 'Save Changes' }).first();
  const revert = page.getByRole('button', { name: 'Revert' });
  await expect(save).toBeDisabled();
  await expect(revert).toHaveCount(0);

  const sunday = page.locator('label', { hasText: /^Sun$/ }).locator('input[type="checkbox"]');
  const wasOpen = await sunday.isChecked();
  await sunday.setChecked(!wasOpen);
  await expect(save).toBeEnabled();
  await revert.click();
  await expect(sunday).toBeChecked({ checked: wasOpen });
  await expect(save).toBeDisabled();

  await sunday.setChecked(!wasOpen);
  await save.click();
  await expect(page.getByText(/Saved successfully/)).toBeVisible();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).schedule?.Sun?.open).toBe(!wasOpen);
  await page.reload();
  await expect(fieldAfter(page, 'Gym Name *')).toHaveValue(/E2E Gym/);
  await expect(page.locator('label', { hasText: /^Sun$/ }).locator('input[type="checkbox"]')).toBeChecked({ checked: !wasOpen });
});

test('J-26: a payment method taken off in Settings is not offered by the payment forms', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/members', { token: owner.token, body: { firstName: 'Mo', lastName: 'Methods', city: 'Douala', region: 'Littoral', balance: 5000, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) } });
  await signIn(page, owner);
  await page.goto('/settings?section=payment');
  const card = page.getByLabel('Credit/Debit Card');
  await expect(card).toBeChecked();
  await card.uncheck();
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect(page.getByText(/Saved/).first()).toBeVisible();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).settings?.payment?.methods).not.toContain('Credit/Debit Card');

  await page.goto('/payments');
  await page.getByRole('button', { name: 'Add Payment' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(async () => {
    await form.getByPlaceholder('Name or member code...').fill('');
    await form.getByPlaceholder('Name or member code...').fill('Methods');
    await expect(form.getByText('Mo Methods')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByText('Mo Methods').click();
  const methods = form.locator('select', { has: page.locator('option', { hasText: 'Cash' }) });
  await expect(methods.locator('option')).toHaveText(['Cash', 'Bank Transfer', 'Mobile Money']);
});

test('J-26: the payment section waits for the gym before anything can be changed (F-169)', async ({ page }) => {
  const owner = await registerGym();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/gyms/me', async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await signIn(page, owner);
  await page.goto('/settings?section=payment');
  await expect(page.locator('[data-settings-loading]')).toBeVisible();
  await expect(page.getByLabel('Credit/Debit Card')).toHaveCount(0);
  release();
  await expect(page.getByLabel('Credit/Debit Card')).toBeChecked();
  await expect(page.locator('[data-settings-loading]')).toHaveCount(0);
});

// F-128: a logo is filed with the photos and the gym keeps only its address,
// so the record read on every page load stays small
test('J-26: a new logo is kept as an address and shows on the gym\'s sign-in page', async ({ page, browser }) => {
  const owner = await registerGym();
  await openGymProfile(page, owner);
  await page.locator('input[type="file"][accept^="image/png"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Gym logo')).toBeVisible();
  await expect.poll(async () => (await call('GET', '/gyms/me', { token: owner.token })).logo).toMatch(/^https:\/\/res\.cloudinary\.test\/gem\/logos\//);
  const { logo } = await call('GET', '/gyms/me', { token: owner.token });

  const visitor = await browser.newContext();
  const signInPage = await visitor.newPage();
  await signInPage.route('https://res.cloudinary.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await signInPage.goto(`/${owner.gymCode}/login`);
  await expect(signInPage.locator(`img[src="${logo}"]`).first()).toBeVisible();
  await visitor.close();
});
