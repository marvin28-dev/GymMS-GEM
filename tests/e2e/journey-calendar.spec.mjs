// Journey J-15 (calendar): a manager books an event with a trainer through the
// form, the trainer answers it from their own calendar, booking someone busy
// warns, and a repeating entry is held to a year.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

const tomorrow = () => new Date(Date.now() + 864e5);
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

// The month on screen is this one; tomorrow can be in the next
async function showTomorrow(page) {
  if (tomorrow().getMonth() !== new Date().getMonth()) await page.getByRole('button', { name: 'Next' }).first().click();
}

async function pickTime(page, field, hhmm) {
  await field.click();
  await page.locator(`[data-time-panel] [data-time-option="${hhmm}"]`).click();
}

async function openAddForm(page) {
  await page.getByRole('button', { name: 'Add Event' }).first().click();
  return page.getByRole('dialog');
}

test('J-15: an event booked with a trainer waits on their calendar until they accept it, and the manager sees the answer', async ({ page, browser }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Tara', lastName: 'Invite' });
  const title = `Morning spin ${uniqueCode('c')}`;
  await signIn(page, owner);
  await page.goto('/calendar');
  const form = await openAddForm(page);
  await form.getByPlaceholder('Event title').fill(title);
  await form.locator('input[type="date"]').first().fill(localDay(tomorrow()));
  await pickTime(page, form.locator('[data-time-input]').first(), '09:00');
  // The end follows an hour later
  await expect(form.locator('[data-time-input]').nth(1)).toHaveAttribute('data-value', '10:00');
  await form.locator('label', { hasText: 'Tara Invite' }).locator('input[type="checkbox"]').check();
  await form.getByRole('button', { name: 'Save Event' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const event = (await call('GET', '/calendar', { token: owner.token })).find(e => e.title === title);
  expect(event.assignedStaff.map(x => String(x.id))).toContain(String(trainer.id));

  const desk = await browser.newPage();
  await signIn(desk, trainer);
  await desk.goto('/calendar');
  await desk.getByRole('tab', { name: 'My Calendar' }).click();
  await showTomorrow(desk);
  const pending = desk.locator('[data-cal-item][data-pending="1"]', { hasText: title });
  await expect(pending).toBeVisible();
  await pending.click();
  const details = desk.getByRole('dialog');
  await expect(details.getByText('You were put on this event. Will you be there?')).toBeVisible();
  await details.getByRole('button', { name: 'Accept' }).click();
  await expect(desk.getByRole('dialog')).toHaveCount(0);
  // Still on their calendar, now as an ordinary entry
  await expect(desk.locator('[data-cal-item]', { hasText: title })).toBeVisible();
  await expect(desk.locator('[data-cal-item][data-pending="1"]', { hasText: title })).toHaveCount(0);
  await desk.close();

  await page.reload();
  await showTomorrow(page);
  await page.locator('[data-cal-item]', { hasText: title }).click();
  const seen = page.getByRole('dialog');
  await expect(seen.getByText('Tara Invite · Accepted', { exact: true })).toBeVisible();
});

test('J-15: a declined event leaves the trainer\'s calendar and stays on the gym\'s', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Dee', lastName: 'Clines' });
  const title = `Team meeting ${uniqueCode('d')}`;
  await call('POST', '/calendar', { token: owner.token, body: { title, date: localDay(tomorrow()), time: '07:00', duration: '08:00', staffIds: [trainer.id] } });
  await signIn(page, trainer);
  await page.goto('/calendar');
  await page.getByRole('tab', { name: 'My Calendar' }).click();
  // The invites waiting on an answer are listed above the calendar too
  await expect(page.getByText('Awaiting your response')).toBeVisible();
  await page.getByRole('button', { name: 'Decline' }).first().click();
  await expect(page.getByText('Awaiting your response')).toHaveCount(0);
  await showTomorrow(page);
  await expect(page.locator('[data-cal-item]', { hasText: title })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Gym Calendar' }).click();
  await expect(page.locator('[data-cal-item]', { hasText: title })).toBeVisible();
});

test('J-15: putting someone busy on an event warns, and it still saves', async ({ page }) => {
  const owner = await registerGym();
  const trainer = await addStaff(owner, { role: 'trainer', firstName: 'Bea', lastName: 'Busy' });
  await call('POST', '/calendar', { token: owner.token, body: { title: 'Early class', date: localDay(tomorrow()), time: '09:00', duration: '10:00', staffIds: [trainer.id] } });
  const title = `Overlap ${uniqueCode('o')}`;
  await signIn(page, owner);
  await page.goto('/calendar');
  const form = await openAddForm(page);
  await form.getByPlaceholder('Event title').fill(title);
  await form.locator('input[type="date"]').first().fill(localDay(tomorrow()));
  await form.locator('label', { hasText: 'Bea Busy' }).locator('input[type="checkbox"]').check();
  // No times yet, so nothing to clash with
  await expect(form.getByText('Bea Busy is busy then:')).toHaveCount(0);
  await pickTime(page, form.locator('[data-time-input]').first(), '09:30');
  await expect(form.getByText('Bea Busy is busy then:')).toBeVisible();
  await expect(form.getByText('Early class')).toBeVisible();
  await expect(form.getByText('This is only a heads-up. You can still save.')).toBeVisible();
  await form.getByRole('button', { name: 'Save Event' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await call('GET', '/calendar', { token: owner.token })).some(e => e.title === title)).toBe(true);
});

// Browser check owed for fcd1b52
for (const lang of ['en', 'fr']) {
  test(`J-15: a repeat that runs past a year is refused under "Repeat until" (${lang})`, async ({ page }) => {
    const owner = await registerGym();
    const fr = lang === 'fr';
    await page.addInitScript((l) => localStorage.setItem('gem-lang', l), lang);
    await signIn(page, owner);
    await page.goto('/calendar');
    await page.getByRole('button', { name: fr ? 'Ajouter un événement' : 'Add Event' }).first().click();
    const form = page.getByRole('dialog');
    const start = localDay(tomorrow());
    await form.getByPlaceholder(fr ? "Titre de l'événement" : 'Event title').fill('Weekly yoga');
    await form.locator('input[type="date"]').first().fill(start);
    await pickTime(page, form.locator('[data-time-input]').first(), '18:00');
    await form.locator('select', { has: page.locator('option[value="Weekly"]') }).selectOption('Weekly');
    const until = form.locator('input[type="date"]').nth(1);
    await expect(until).toHaveAttribute('max', addDays(start, 366));
    await until.fill(addDays(start, 400));
    await form.getByRole('button', { name: fr ? "Enregistrer l'événement" : 'Save Event' }).click();
    await expect(form.getByText(fr
      ? "Une entrée répétée peut durer un an au plus. Réservez l'année suivante séparément."
      : 'A repeating entry can run for up to a year. Book the next year separately.')).toBeVisible();
    expect((await call('GET', '/calendar', { token: owner.token })).some(e => e.title === 'Weekly yoga')).toBe(false);
  });
}
