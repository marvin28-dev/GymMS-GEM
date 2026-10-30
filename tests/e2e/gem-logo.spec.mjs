// GEM's own logo is the cut gem the owner chose on 26 October 2026, drawn by
// components/ui/GemMark.jsx and, for the browser tab, public/favicon.svg. The
// app used to draw a diamond icon and the public pages a dumbbell on a gold
// square, written out in fourteen places.
import { test, expect } from '@playwright/test';
import { registerGym, signIn } from './support/session.mjs';

// The landing and sign-up pages embed the walkthrough video; no test waits on YouTube
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|googlevideo\.com)\//, route => route.abort());
});

const GEM = '21,17 43,17 53,27 32,50 11,27';

async function showsTheMark(page) {
  // The page itself, not the loader (which shows the mark too) while it arrives
  await expect(page.locator('[data-page-loader]')).toHaveCount(0);
  const mark = page.locator('svg[data-gem-mark]:visible').first();
  await expect(mark).toBeVisible();
  await expect(mark.locator('polygon').first()).toHaveAttribute('points', GEM);
  // The gold tile points at a gradient in the same drawing: a reference to
  // one elsewhere draws nothing when that one is hidden. Read from one mark at
  // once, as the page may swap marks between two reads.
  const { fill, id } = await mark.evaluate(el => ({ fill: el.querySelector('rect').getAttribute('fill'), id: el.querySelector('linearGradient').id }));
  expect(fill).toBe(`url(#${id})`);
}

test("the public pages show GEM's logo, and no dumbbell stands in for it (desk or phone)", async ({ page }) => {
  for (const path of ['/', '/signup', '/login', '/forgot-password', '/reset-password', '/verify-email', '/no-such-page']) {
    await page.goto(path);
    await showsTheMark(page);
    await expect(page.locator('svg.lucide-dumbbell'), path).toHaveCount(0);
  }
});

test("the app shows GEM's logo in the sidebar, or the header on a phone (desk or phone)", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await showsTheMark(page);
});

test("the browser tab and a phone's home screen get the cut gem (desk or phone)", async ({ page, request }) => {
  await page.goto('/');
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  const svg = await request.get(icon);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  expect(await svg.text()).toContain(GEM);

  const touch = await request.get(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'));
  expect(touch.headers()['content-type']).toContain('image/png');
  expect((await touch.body()).subarray(1, 4).toString()).toBe('PNG');
});
