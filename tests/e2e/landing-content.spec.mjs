// D-34 and D-33: the landing page and the sign-up welcome showed a placeholder
// video, invented figures and testimonials, a "#1" claim, a 30-day trial where
// everything else says 7, and support contacts that may not have been GEM's.
import { test, expect } from '@playwright/test';

test('the landing page says only what is true, and offers no made-up contacts (desk or phone)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Free 7-day trial')).toBeVisible();
  for (const made of ['#1', '500+', '120k+', '99.9%', '30-day', 'hello@gymgem.io', '6XX']) {
    await expect(page.getByText(made, { exact: false }), made).toHaveCount(0);
  }
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
});

test('the sign-up welcome has no placeholder video and no made-up contacts', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('[data-support]')).toHaveCount(0);
  await expect(page.getByText('hello@gymgem.io')).toHaveCount(0);
});
