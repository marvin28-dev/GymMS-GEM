// D-53: pages switched to the phone layout at two widths (800 and 768 pixels),
// so between them some pages were phone-shaped and others not. One width now.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

test('the app takes the phone layout below 769 pixels and the full one from there', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  const sidebarLink = page.getByRole('button', { name: 'Daily Overview' });
  // The phone's bottom bar, which the full layout does not have
  const phoneMore = page.getByRole('button', { name: 'More', exact: true });

  await page.setViewportSize({ width: 780, height: 900 });
  await page.goto('/members');
  await expect(sidebarLink).toBeVisible();
  await expect(phoneMore).toHaveCount(0);

  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('/members');
  await expect(page.getByRole('heading', { name: /Members/ }).first()).toBeVisible();
  await expect(phoneMore).toBeVisible();
});
