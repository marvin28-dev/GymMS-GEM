// Journey J-21 (Communication page): an email to all members is written with
// a fill-in and its preview, the group is opened and one person left out, it
// is confirmed and sent, the people it went to get their own copy, and the
// message's details list every delivery.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, mailTo, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

async function member(owner, firstName, tag, extra = {}) {
  return call('POST', '/members', {
    token: owner.token,
    body: { firstName, lastName: tag, email: `${firstName.toLowerCase()}.${tag}@example.test`, phone: '677112233', city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)), ...extra },
  });
}

test('J-21: an email to everyone but one person, with each name filled in', async ({ page }) => {
  const owner = await registerGym();
  const tag = uniqueCode('c').slice(-6);
  const ada = await member(owner, 'Ada', tag);
  const ben = await member(owner, 'Ben', tag);
  await member(owner, 'Cy', tag, { email: '' });
  const subject = `Holiday hours ${tag}`;

  await signIn(page, owner);
  await page.goto('/communication');
  // Email only: there is no choice of email or text any more
  await expect(page.locator('[data-audience="all"]')).toBeVisible();
  await expect(page.locator('[data-channel]')).toHaveCount(0);
  await expect(page.getByText(/\btexts?\b/i)).toHaveCount(0);
  await page.locator('[data-audience="all"]').click();
  await expect(page.locator('[data-see-people]')).toContainText('3');

  await page.getByPlaceholder('e.g. New opening hours from Monday').fill(subject);
  const message = page.locator('textarea').first();
  await message.fill('Hi ');
  await page.locator('[data-token="firstName"]').click();
  await message.press('End');
  await message.pressSequentially(', we open at 9 on Monday.');
  await expect(message).toHaveValue('Hi {firstName}, we open at 9 on Monday.');
  // The preview shows what the first person reads
  const preview = page.locator('[data-fill-preview]');
  await expect(preview).toContainText(`What Ada ${tag} will see`);
  await expect(preview.locator('[data-fill-body]')).toHaveText('Hi Ada, we open at 9 on Monday.');

  await page.locator('[data-see-people]').click();
  const list = page.getByRole('dialog');
  await expect(list.locator('[data-people-count]')).toHaveText('3 of 3 will get it');
  await list.locator(`[data-person="${ben.id}"] input[type="checkbox"]`).uncheck();
  await expect(list.locator('[data-people-count]')).toHaveText('2 of 3 will get it');
  await list.locator('[data-people-done]').click();
  await expect(page.locator('[data-left-out]')).toBeVisible();

  await page.locator('[data-send]').click();
  const confirm = page.getByRole('dialog', { name: 'Send this message?' });
  await confirm.getByRole('button', { name: 'Send' }).click();

  await expect.poll(async () => (await mailTo(ada.email)).some(m => m.subject === subject)).toBe(true);
  const [mail] = (await mailTo(ada.email)).filter(m => m.subject === subject);
  expect(mail.text).toBe('Hi Ada, we open at 9 on Monday.');
  expect((await mailTo(ben.email)).some(m => m.subject === subject)).toBe(false);

  const row = page.locator('[data-message-row]').filter({ hasText: subject });
  await expect(row).toHaveAttribute('data-message-row', 'sent');
  await row.click();
  const details = page.getByRole('dialog', { name: 'Message details' });
  await expect(details.locator('[data-delivery="sent"]')).toHaveCount(1);
  // Cy has no email address: counted apart, not as a failure
  await expect(details.locator('[data-delivery="skipped"]')).toHaveCount(1);
  await expect(details.locator('[data-delivery="skipped"]')).toContainText(`Cy ${tag}`);
});

// Texting was taken out (20 November 2026): a member's Send Message is an
// email, to the address shown, and someone with no email cannot be written to
test('a member\'s Send Message is an email, and one with no address is told so (desk or phone)', async ({ page }) => {
  const owner = await registerGym();
  const tag = uniqueCode('m').slice(-6);
  const ada = await member(owner, 'Ada', tag);
  const cy = await member(owner, 'Cy', tag, { email: '' });
  const subject = `Your plan ${tag}`;

  await signIn(page, owner);
  await page.goto(`/members/${ada.id}`);
  await page.locator('[data-hero-message]').click();
  const form = page.getByRole('dialog', { name: `Message Ada ${tag}` });
  await expect(form.locator('[data-msg-reach]')).toHaveText(ada.email);
  await expect(form.getByRole('radio')).toHaveCount(0);
  await expect(form.getByText(/\btexts?\b/i)).toHaveCount(0);
  await form.locator('#msg-subject').fill(subject);
  await form.locator('#msg-body').fill('Hi {firstName}, see you Monday.');
  await expect(form.locator('[data-fill-body]')).toHaveText('Hi Ada, see you Monday.');
  await form.locator('[data-msg-send]').click();
  await expect(page.locator('[data-msg-done]')).toBeVisible();
  await expect.poll(async () => (await mailTo(ada.email)).some(m => m.subject === subject && m.text === 'Hi Ada, see you Monday.')).toBe(true);

  await page.goto(`/members/${cy.id}`);
  await page.locator('[data-hero-message]').click();
  const none = page.getByRole('dialog', { name: `Message Cy ${tag}` });
  await expect(none.locator('[data-msg-reach]')).toHaveText('No email address on file');
  await none.locator('#msg-subject').fill(subject);
  await none.locator('#msg-body').fill('Hello');
  await none.locator('[data-msg-send]').click();
  await expect(none.getByRole('alert')).toHaveText('No email address on file');
  await expect(page.locator('[data-msg-done]')).toHaveCount(0);
});
