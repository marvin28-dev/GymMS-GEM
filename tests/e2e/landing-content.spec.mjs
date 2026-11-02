// D-34 and D-33: the landing page and the sign-up welcome showed a placeholder
// video, invented figures and testimonials, a "#1" claim, a 30-day trial where
// everything else says 7, and support contacts that may not have been GEM's.
// The owner asked for the video back on 30 October 2026, with the same link
// (components/ui/DemoVideo.jsx), and gave GEM's support contacts: a WhatsApp
// number (never a call) and an email. The rest stays out.
import { test, expect } from '@playwright/test';

const VIDEO = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const WHATSAPP = 'https://wa.me/13439889766';
const EMAIL = 'marvin.ekokobe01@gmail.com';

// GEM's own contacts and no others: WhatsApp only, never a call
async function offersGemSupport(page) {
  const whatsapp = page.locator('a[href^="https://wa.me/"]');
  await expect(whatsapp.first()).toBeVisible();
  for (const href of await whatsapp.evaluateAll(links => links.map(a => a.getAttribute('href')))) expect(href).toBe(WHATSAPP);
  await expect(whatsapp.first()).toContainText('+1 343 988 9766');
  const mail = page.locator('a[href^="mailto:"]');
  for (const href of await mail.evaluateAll(links => links.map(a => a.getAttribute('href')))) expect(href).toBe(`mailto:${EMAIL}`);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
}

// The landing and sign-up pages embed the walkthrough video; no test waits on YouTube
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
});

// The one video, with the owner's link, inside the page's width, and the
// page's content policy lets YouTube's player in
async function showsTheVideo(page) {
  const video = page.locator('[data-demo-video] iframe');
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute('src', VIDEO);
  const box = await page.locator('[data-demo-video]').boundingBox();
  const width = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain('frame-src https://www.youtube.com');
}

test("the landing page says only what is true, and offers GEM's own contacts (desk or phone)", async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Free 7-day trial')).toBeVisible();
  for (const made of ['#1', '500+', '120k+', '99.9%', '30-day', 'hello@gymgem.io', '6XX']) {
    await expect(page.getByText(made, { exact: false }), made).toHaveCount(0);
  }
  await expect(page.getByText('See It In Action')).toBeVisible();
  await expect(page.locator('[data-demo-video] iframe')).toHaveAttribute('title', 'GEM Platform Overview');
  await showsTheVideo(page);
  await offersGemSupport(page);
});

test("the sign-up welcome shows the walkthrough video and GEM's own contacts (desk or phone)", async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-demo-video] iframe')).toHaveAttribute('title', 'A 2-minute tour of your complete gym workspace');
  await showsTheVideo(page);
  await expect(page.locator('[data-support]')).toBeVisible();
  await offersGemSupport(page);
  await expect(page.getByText('hello@gymgem.io')).toHaveCount(0);
});

// D-6: an address that leads nowhere landed silently on the home page; the
// tab showed Vite's logo; D-49: phones could not zoom
test('an address that leads nowhere says so, and the page carries its own icon and lets phones zoom', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to GEM' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/maximum-scale|user-scalable=no/);
});

test('on a phone, form text is at least 16px, so a touched box does not zoom the page by itself', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone rule: desktop boxes keep their size');
  await page.goto('/login');
  const box = page.getByPlaceholder('e.g. elite-fitness');
  await expect(box).toBeVisible();
  expect(parseFloat(await box.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});
