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
  await page.locator('[data-channel="email"]').click();
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
