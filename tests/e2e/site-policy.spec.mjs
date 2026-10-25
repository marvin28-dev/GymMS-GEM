// D-45: the built page carries its content policy, so a script slipped into
// the page (by a stored name, say) does not run, while the app itself works.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

test('the built page refuses a script that is not the app\'s own, and the app still works', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/members');
  await expect(page.getByRole('button', { name: 'Add Member' }).first()).toBeVisible();

  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("script-src 'self'");

  const ran = await page.evaluate(() => new Promise((resolve) => {
    let blocked = false;
    document.addEventListener('securitypolicyviolation', () => { blocked = true; }, { once: true });
    const s = document.createElement('script');
    s.textContent = 'window.__injected = true';
    document.head.appendChild(s);
    setTimeout(() => resolve({ ran: window.__injected === true, blocked }), 200);
  }));
  expect(ran).toEqual({ ran: false, blocked: true });
});
