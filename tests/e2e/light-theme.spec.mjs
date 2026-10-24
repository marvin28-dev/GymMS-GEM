// F-129: in the light theme, the landing navbar, the sign-up page's Sign in
// button and its dial-code list were drawn in fixed dark colours (CLAUDE.md:
// components read the theme tokens).
import { test, expect } from '@playwright/test';

const SHOTS = process.env.LIGHT_SHOTS;
const inLight = (page) => page.addInitScript(() => { try { localStorage.setItem('gem-theme', 'light'); } catch { /* storage blocked */ } });
const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el)[p], prop);
// The light theme's values (src/index.css)
const LIGHT = { header: 'rgba(251, 250, 247, 0.88)', card: 'rgb(251, 250, 247)', borderSubtle: 'rgb(222, 216, 203)' };

test.beforeEach(async ({ page }) => {
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, r => r.abort());
  await inLight(page);
});

test('the landing navbar is drawn in the light theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav').first()).toBeVisible();
  expect(await style(page.locator('nav').first(), 'backgroundColor')).toBe(LIGHT.header);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-light.png` });
});

for (const [size, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  test(`on ${size}, sign-up's Sign in button and dial-code list are drawn in the light theme`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/signup');
    // The fonts come from Google; one arriving mid-click moves the button, and
    // Firefox then fires no click (seen once in a final run)
    await page.evaluate(() => document.fonts.ready);
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(signIn).toBeVisible();
    expect(await style(signIn, 'borderTopColor')).toBe(LIGHT.borderSubtle);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/signup-welcome-${size}.png` });

    await page.getByRole('button', { name: 'Start free trial' }).click();
    // The list closes when the page scrolls. A button left partly below the
    // screen is scrolled the rest of the way by the click itself, which closed
    // the list as it opened, so it is put in the middle of the screen first
    const dial = page.getByRole('button', { name: /\+237/ }).first();
    await dial.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const top = () => dial.evaluate(el => Math.round(el.getBoundingClientRect().top));
    let last = await top();
    await expect.poll(async () => { const now = await top(); const settled = now === last; last = now; return settled; }, { intervals: [200] }).toBe(true);
    await expect.poll(() => dial.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    await dial.click();
    const nigeria = page.getByRole('button', { name: /Nigeria/ });
    await expect(nigeria).toBeVisible();
    expect(await style(nigeria.locator('xpath=..'), 'backgroundColor')).toBe(LIGHT.card);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/signup-dial-${size}.png` });
  });
}
