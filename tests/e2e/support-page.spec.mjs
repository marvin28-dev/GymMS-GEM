// The owner, 7 November 2026: GEM support is no longer at the foot of every
// screen. There is a Help & support page where anyone signed in can report a
// problem, a complaint, an idea or a question (kept on the server and emailed
// to GEM support), with GEM's WhatsApp and email; and wherever something went
// wrong the screen says who to contact.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { registerGym, signIn, addStaff, mailTo, uniqueCode } from './support/session.mjs';

const SUPPORT = 'marvin.ekokobe01@gmail.com';
const WHATSAPP = 'https://wa.me/13439889766';
const CONTACTS = 'WhatsApp +1 343 988 9766 · marvin.ekokobe01@gmail.com';

async function openFromAccountMenu(page) {
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.locator('[data-account-menu]').getByRole('button', { name: 'Help & support' }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible();
}

test('a problem reported on the Support page reaches GEM support, with who sent it and from where (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/members');
  await openFromAccountMenu(page);

  // GEM's own contacts are on the page, WhatsApp for messages only
  const page_ = page.locator('[data-support-page]');
  await expect(page_.locator(`a[href="${WHATSAPP}"]`)).toBeVisible();
  await expect(page_.locator(`a[href="mailto:${SUPPORT}"]`)).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(page_.getByText(`Give your gym code, ${owner.gymCode}, so we can find you quickly.`)).toBeVisible();
  await expect(page_.getByText('Nothing sent yet')).toBeVisible();

  // Nothing filled in: each field says what it needs
  await page.getByRole('button', { name: 'Send to GEM support' }).click();
  await expect(page.locator('[data-field-error]')).toHaveText(['Choose what it is about.', 'Give it a short title.', 'Tell us what happened.']);

  const title = `Check-in does nothing ${uniqueCode('t')}`;
  await page.locator('[data-support-kind="problem"]').click();
  await expect(page.locator('[data-support-kind="problem"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Title *').fill(title);
  await page.getByLabel('Details *').fill('I press Check In and nothing happens.\nSince this morning.');
  await expect(page.locator('[data-field-error]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Send to GEM support' }).click();

  await expect(page.locator('[data-support-outcome="sent"]')).toContainText('Sent to GEM support');
  await expect(page.locator('[data-support-outcome="sent"]')).toContainText(`We have it and will reply to ${owner.email}.`);
  const row = page.locator('[data-support-report]').filter({ hasText: title });
  await expect(row).toContainText('Something is not working');
  await expect(row.locator('[data-support-status]')).toHaveText('Sent');

  await expect.poll(async () => (await mailTo(SUPPORT)).filter(m => m.subject === `[GEM support] Something is not working: ${title}`).length).toBe(1);
  const [mail] = (await mailTo(SUPPORT)).filter(m => m.subject === `[GEM support] Something is not working: ${title}`);
  expect(mail.replyTo).toBe(owner.email);
  expect(mail.html).toContain(owner.gymCode);
  expect(mail.html).toContain('/members');
  expect(mail.html).toContain('I press Check In and nothing happens.<br>Since this morning.');

  // Still listed after a reload, and the form can be used again
  await page.reload();
  await expect(page.locator('[data-support-report]').filter({ hasText: title })).toBeVisible();
});

test('Help & support is in the menu for every role, and search finds it', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Tara' });
  await signIn(page, trainer);
  await page.goto('/dashboard');
  await page.locator('nav').getByRole('button', { name: 'Help & support' }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible();

  await page.goto('/dashboard');
  await page.keyboard.press('Control+k');
  const box = page.getByPlaceholder('Search pages, settings, people…').first();
  await expect(box).toBeFocused();
  await box.fill('complaint');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/support$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Help & support opens from More on a phone, and its form fits the screen', async ({ page }) => {
    const owner = await registerGym();
    await signIn(page, owner);
    await page.goto('/dashboard');
    await page.locator('[data-bottom-bar]').getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Help & support' }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    const send = await page.getByRole('button', { name: 'Send to GEM support' }).boundingBox();
    expect(send.x).toBeGreaterThanOrEqual(0);
    expect(send.x + send.width).toBeLessThanOrEqual(390);
  });
});

test('the desk opens Help & support without leaving the desk (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Dina' });
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Help & support' }).click();
  await expect(page).toHaveURL(/\/front-desk\/support$/);
  await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible();
  await expect(page.locator('[data-tour="sidebar"]')).toHaveCount(0);
  await expect(page.locator('[data-app-footer] [data-powered-by]')).toBeVisible();

  const title = `Printer jams ${uniqueCode('t')}`;
  await page.locator('[data-support-kind="complaint"]').click();
  await page.getByLabel('Title *').fill(title);
  await page.getByLabel('Details *').fill('The receipt printer jams every morning.');
  await page.getByRole('button', { name: 'Send to GEM support' }).click();
  await expect(page.locator('[data-support-outcome="sent"]')).toBeVisible();
  await expect.poll(async () => (await mailTo(SUPPORT)).some(m => m.subject === `[GEM support] Complaint: ${title}` && m.html.includes('Front desk'))).toBe(true);

  await page.getByRole('button', { name: 'Back to Front Desk' }).click();
  await expect(page).toHaveURL(/\/front-desk$/);
});

test('when GEM support cannot be reached, the page says so and gives the WhatsApp and email (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/support');
  const fill = async (title) => {
    await page.locator('[data-support-kind="question"]').click();
    await page.getByLabel('Title *').fill(title);
    await page.getByLabel('Details *').fill('Hello');
  };

  // The server kept it but the email did not go
  await page.route('**/api/support', route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ emailed: false, report: { id: 'r1', kind: 'question', subject: 'Kept only', message: 'Hello', emailedAt: null, createdAt: new Date().toISOString() } }) })
    : route.fallback()));
  await fill('Kept only');
  await page.getByRole('button', { name: 'Send to GEM support' }).click();
  const notSent = page.locator('[data-support-outcome="not-sent"]');
  await expect(notSent).toContainText('Saved, but not sent yet');
  await expect(notSent.locator(`a[href="${WHATSAPP}"]`)).toBeVisible();
  await expect(notSent.locator(`a[href="mailto:${SUPPORT}"]`)).toBeVisible();
  await expect(page.locator('[data-support-report]').filter({ hasText: 'Kept only' }).locator('[data-support-status]')).toHaveText('Not sent');

  // The server could not be reached at all
  await page.unroute('**/api/support');
  await page.route('**/api/support', route => (route.request().method() === 'POST' ? route.abort() : route.fallback()));
  await page.getByRole('button', { name: 'Send something else' }).click();
  await fill('Lost');
  await page.getByRole('button', { name: 'Send to GEM support' }).click();
  const failed = page.locator('[data-support-failed]');
  await expect(failed).toContainText('It could not be sent.');
  await expect(failed).toContainText(`Something not working? Contact GEM support: ${CONTACTS}`);
});

// Wherever something could not be loaded, the box says who to contact
for (const theme of ['dark', 'light']) {
  test(`a box that could not load gives GEM support's contacts, readable in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((th) => { try { localStorage.setItem('gem-theme', th); } catch { /* the theme check below fails if it did not apply */ } }, theme);
    const owner = await registerGym();
    await page.route('**/api/gyms/me', route => (route.request().method() === 'GET' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }) : route.fallback()));
    await signIn(page, owner);
    await page.goto('/settings?section=gym-profile');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const box = page.locator('[data-load-failed]').first();
    await expect(box).toContainText(`Still not working? Contact GEM support: ${CONTACTS}`);
    await expect(box.locator(`a[href="${WHATSAPP}"]`)).toBeVisible();
    const r = await new AxeBuilder({ page }).include('[data-load-failed]').withRules(['color-contrast']).analyze();
    expect(r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}
