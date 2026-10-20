// F-121: staff profile details. The edit form shows the person's own role, the
// Tasks count clears once a calendar invite is answered, and an ID scan stored
// on Cloudinary downloads instead of taking the page away.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test("the edit form shows the employee's own role", async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Ria', lastName: 'Role' });
  await signIn(page, owner);
  await page.goto(`/staff/${desk.id}`);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  const role = page.getByRole('dialog').locator('select', { has: page.locator('option[value="front_desk"]') });
  await expect(role).toHaveValue('front_desk');
});

test('an answered calendar invite no longer counts on the Tasks tab', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Ivy', lastName: 'Invited' });
  const event = await call('POST', '/calendar', { token: owner.token, body: { title: 'Staff meeting', date: tomorrow(), time: '07:00', duration: '08:00', staffIds: [trainer.id] } });
  const invite = (await call('GET', '/tasks', { token: trainer.token })).find(tk => tk.eventId === event.id);
  await call('PATCH', `/tasks/${invite.id}`, { token: trainer.token, body: { status: 'Accepted' } });
  // One task still to do, so the badge shows and has to count only that one
  await call('POST', '/tasks', { token: owner.token, body: { title: 'Fix the mirror', assignedToId: trainer.id, dueDate: tomorrow(), category: 'Front Desk', priority: 'Medium' } });
  await signIn(page, owner);
  await page.goto(`/staff/${trainer.id}`);
  await expect(page.getByTitle('1 open task(s) waiting on them')).toBeVisible();
  await expect(page.getByTitle('2 open task(s) waiting on them')).toHaveCount(0);
});

test('an ID scan stored on Cloudinary downloads and the page stays', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Dora', lastName: 'Download' });
  const scan = 'https://res.cloudinary.test/gem/staff/ids/scan.png';
  await call('PATCH', `/staff/${staff.id}`, { token: owner.token, body: { photoId: scan } });
  await page.route('https://res.cloudinary.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).first().click(),
  ]);
  expect(download.suggestedFilename()).toContain('Dora_Download_PhotoID');
  await expect(page).toHaveURL(new RegExp(`/staff/${staff.id}$`));
});
