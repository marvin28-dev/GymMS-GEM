// Frontend fix plan step 3: what works on a desktop works on a phone too.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

test.use({ viewport: { width: 390, height: 844 } });

// F-101
test("the Sales page's Add product button shows only on the Products tab", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/sales');
  await expect(page.getByTitle('Add Product')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByTitle('Add Product')).toHaveCount(0);
});
