// F-098: the header search keeps people it fetched for a minute; after one
// account signs out and another signs in on the same tab, it must list only
// the new account's gym.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call } from './support/session.mjs';

const addMember = (gym, lastName) => call('POST', '/members', {
  token: gym.token,
  body: {
    firstName: 'Zanzibar', lastName, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash',
    startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  },
});

test('search after switching accounts lists only the new gym', async ({ page }) => {
  const gymA = await registerGym();
  const gymB = await registerGym();
  await addMember(gymA, 'Alpha');
  await addMember(gymB, 'Beta');

  await signIn(page, gymA);
  await page.goto('/dashboard');
  const search = page.getByRole('textbox', { name: /search pages/i });
  // Ctrl+K opens the search once the header has mounted after a navigation
  const openSearch = () => expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(search).toBeVisible({ timeout: 1000 });
  }).toPass();
  await openSearch();
  await search.fill('Zanzibar');
  await expect(page.getByText('Zanzibar Alpha')).toBeVisible();
  await page.keyboard.press('Escape');

  // Sign out and sign in to the other gym without reloading the tab
  await page.getByText('OO', { exact: true }).last().click();
  await page.getByText('Sign Out', { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByPlaceholder('e.g. elite-fitness').fill(gymB.gymCode);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/email/i).fill(gymB.email);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByPlaceholder(/password/i).first().fill(gymB.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openSearch();
  await search.fill('Zanzibar');
  await expect(page.getByText('Zanzibar Beta')).toBeVisible();
  await expect(page.getByText('Zanzibar Alpha')).toHaveCount(0);
});
