// D-32: a member's notes were kept in the browser that wrote them. They are
// kept on the server for the desk and management, and a browser hands over
// the notes it kept the first time the profile is opened there.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

const newMember = (owner, lastName) => call('POST', '/members', {
  token: owner.token,
  body: { firstName: 'Nia', lastName, city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) },
});

test('a note written at the desk is read by the owner on another computer (desk or phone)', async ({ page, browser }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Dina', lastName: 'Desk' });
  const member = await newMember(owner, 'Noted');
  await signIn(page, desk);
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Add Note' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Note' });
  await dialog.locator('textarea').fill('Knee injury: no deep squats');
  await dialog.getByLabel('Category').selectOption('Health');
  await dialog.getByRole('button', { name: 'Save Note' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Knee injury: no deep squats')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  const elsewhere = await browser.newContext();
  const other = await elsewhere.newPage();
  await signIn(other, owner);
  await other.goto(`/members/${member.id}`);
  await other.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(other.getByText('Knee injury: no deep squats')).toBeVisible();
  await expect(other.getByText('by Dina Desk')).toBeVisible();
  await elsewhere.close();
});

// Was "a note the browser refused to store is not shown as kept": the note now
// goes to the server, and a refusal there keeps the dialog open with the text
test('a note the server refused is not shown as kept, and its text stays in the dialog', async ({ page }) => {
  const owner = await registerGym();
  const member = await newMember(owner, 'Refused');
  await signIn(page, owner);
  await page.route('**/api/members/*/notes', route => (route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server is down for the test' }) })
    : route.fallback()));
  await page.goto(`/members/${member.id}`);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Add Note' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Note' });
  await dialog.locator('textarea').fill('Knee injury, no squats');
  await dialog.getByRole('button', { name: 'Save Note' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Server is down for the test');
  await expect(dialog.locator('textarea')).toHaveValue('Knee injury, no squats');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Knee injury, no squats')).toHaveCount(0);
  expect(await call('GET', `/members/${member.id}/notes`, { token: owner.token })).toEqual([]);
});

test('notes this browser kept are moved to the server the first time the profile opens', async ({ page }) => {
  const owner = await registerGym();
  const member = await newMember(owner, 'Kept');
  await signIn(page, owner);
  await page.addInitScript(({ id }) => {
    if (!/^https?:$/.test(location.protocol) || sessionStorage.getItem('e2e_old_notes')) return;
    sessionStorage.setItem('e2e_old_notes', '1');
    localStorage.setItem(`gem_member_notes_${id}`, JSON.stringify([{ date: '3 Oct 2026', content: 'Prefers mornings', category: 'General', author: 'Old Desk' }]));
  }, { id: member.id });
  await page.goto(`/members/${member.id}`);
  await expect.poll(async () => (await call('GET', `/members/${member.id}/notes`, { token: owner.token })).map(n => n.text)).toEqual(['Prefers mornings']);
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`gem_member_notes_${id}`), member.id)).toBe(null);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByText('by Old Desk')).toBeVisible();
});

test("a coach has no Notes tab on a member's profile", async ({ page }) => {
  const owner = await registerGym();
  const coach = await addStaff(owner, { role: 'trainer' });
  const member = await newMember(owner, 'Coached');
  await signIn(page, coach);
  await page.goto(`/members/${member.id}`);
  await expect(page.getByRole('button', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
});
