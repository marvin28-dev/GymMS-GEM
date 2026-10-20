// F-125: front desk details. The code dialog says why a check-in was refused,
// "staff on duty" reads the schedule in any language, the longer time filters
// show the days they cover, the phone shows the programme and recent
// check-ins, and the month starts on Monday.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function openDesk(page, owner, { lang } = {}) {
  const desk = await addStaff(owner, { role: 'front_desk', firstName: 'Dee', lastName: 'Desk' });
  await page.addInitScript(({ staffId, lang: l }) => {
    if (!/^https?:$/.test(location.protocol)) return;
    if (!sessionStorage.getItem('fd_session')) sessionStorage.setItem('fd_session', JSON.stringify({ staffId, staffName: 'Dee Desk' }));
    if (l) localStorage.setItem('gem-lang', l);
  }, { staffId: desk.id, lang });
  await signIn(page, owner);
  await page.goto('/front-desk');
  return desk;
}

test('the code dialog says why a check-in was refused', async ({ page }) => {
  const owner = await registerGym();
  const m = await call('POST', '/members', { token: owner.token, body: { firstName: 'Rex', lastName: 'Refused', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30) } });
  await call('POST', '/attendance/checkin', { token: owner.token, body: { memberId: m.id } });
  const { accessCode } = await call('GET', `/members/${m.id}`, { token: owner.token });
  await openDesk(page, owner);
  const search = page.getByPlaceholder('Type code, name, phone, or ID...');
  await expect(async () => {
    await search.fill('');
    await search.fill('Refused');
    // In the search's own result, not the recent check-ins column, where he already is
    await expect(page.locator('[data-fdtour="checkin-search"]').getByText('Rex Refused').first()).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole('button', { name: '✓', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Verify Access Code' });
  await dialog.getByPlaceholder('••••').fill(accessCode);
  await dialog.getByPlaceholder('••••').press('Enter');
  await expect(dialog.getByRole('alert')).toContainText('already checked in');
});

test('staff on duty reads the schedule in French too', async ({ page }) => {
  const owner = await registerGym();
  const today = DAYS[new Date().getDay()];
  const off = await addStaff(owner, { role: 'trainer', firstName: 'Olga', lastName: 'Offtoday' });
  await call('PATCH', `/staff/${off.id}`, { token: owner.token, body: { schedule: Object.fromEntries(DAYS.map(d => [d, { start: '09:00', end: '17:00', off: d === today }])) } });
  await openDesk(page, owner, { lang: 'fr' });
  const duty = page.locator('[data-fdtour="left-panel"]');
  await expect(duty.getByText('PERSONNEL EN SERVICE')).toBeVisible();
  await expect(duty.getByText('Dee Desk').first()).toBeVisible();
  await expect(duty.getByText('Olga Offtoday')).toHaveCount(0);
});

test('"Last 24h" shows check-ins from before today', async ({ page }) => {
  const owner = await registerGym();
  // Yesterday as a local day; the desk asks for it with the browser's offset (&tz=)
  const y = new Date(Date.now() - 864e5);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  await page.route(new RegExp(`/api/attendance\\?date=${yesterday}(&|$)`), route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'old-visit', checkIn: new Date(Date.now() - 20 * 3600e3).toISOString(), memberId: 'old-member', member: { id: 'old-member', firstName: 'Yesterday', lastName: 'Evening', status: 'active' } }]),
  }));
  await openDesk(page, owner);
  const recent = page.locator('[data-fdtour="checkin-recent"]');
  await recent.locator('select').selectOption('timeLast24h');
  await expect(recent.getByText('Yesterday Evening')).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the desk shows the recent check-ins and the programme, its month starting on Monday', async ({ page }) => {
    const owner = await registerGym();
    await openDesk(page, owner);
    await expect(page.getByText('RECENT CHECK-INS')).toBeVisible();
    const programme = page.locator('[data-fdtour="left-panel"]');
    await expect(programme.getByText('PROGRAM')).toBeVisible();
    await programme.getByRole('button', { name: 'Mon', exact: true }).click();
    const letters = await programme.evaluate(el => [...el.querySelectorAll('div')].filter(d => d.style.fontSize === '8px').map(d => d.textContent));
    expect(letters.slice(0, 7)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
