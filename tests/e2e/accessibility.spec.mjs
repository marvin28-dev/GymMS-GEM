// Phase 6: every main screen and dialog passes axe's WCAG 2.1 A and AA checks,
// and the shell, dialogs and row menus work from the keyboard (F-083, F-092,
// F-096, F-100, F-135, F-164).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 180_000 });

// Every rule is checked: text colours reach 4.5:1 (D-48) and phones may zoom (D-49)
const WAITING_ON_A_DECISION = [];

async function problems(page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(WAITING_ON_A_DECISION)
    .analyze();
  return r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`);
}

test('the public pages pass', async ({ page }) => {
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, r => r.abort());
  const owner = await registerGym();
  for (const path of ['/', '/signup', '/login', `/${owner.gymCode}/login`, '/forgot-password']) {
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await problems(page), path).toEqual([]);
  }
});

// One test a screen, so each has its own time and names the screen that failed
test.describe('the app\'s screens pass', () => {
  for (const screen of ['/dashboard', '/members', '/members/:id', '/payments', '/staff', '/settings?section=gym-profile', '/settings?section=payment', '/calendar', '/tasks', '/sales', '/accounting', '/communication', '/attendance', '/packages', '/notifications', '/operations', '/support']) {
    test(screen, async ({ page }) => {
      const owner = await registerGym();
      let path = screen;
      if (screen === '/members/:id') {
        const member = await call('POST', '/members', { token: owner.token, body: { firstName: 'Axe', lastName: 'Member', city: 'Douala', region: 'Littoral', startDate: localDay(), endDate: localDay(new Date(Date.now() + 30 * 864e5)) } });
        path = `/members/${member.id}`;
      }
      await signIn(page, owner);
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(700);
      expect(await problems(page), path).toEqual([]);
    });
  }
});

// D-48 set the light theme's colours too
test.describe('the screens pass in the light theme', () => {
  for (const screen of ['/', '/dashboard', '/members', '/calendar', '/attendance', '/sales', '/settings?section=gym-profile', '/support']) {
    test(screen, async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.setItem('gem-theme', 'light'); } catch { /* the test fails below if the theme did not apply */ } });
      const owner = await registerGym();
      await signIn(page, owner);
      await page.goto(screen);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.waitForTimeout(800);
      expect(await problems(page), screen).toEqual([]);
    });
  }
});

// One test a dialog, like the screens: all ten in one test took 1.4 minutes
// in Firefox alone and ran past three when tests ran side by side
test.describe('the main dialogs pass', () => {
  for (const [path, button] of [['/members', 'Add Member'], ['/members', 'Add Visitor'], ['/payments', 'Add Payment'], ['/staff', 'Add Staff Member'], ['/tasks', 'Add Task'], ['/calendar', 'Add Event'], ['/sales', '+ Add Product'], ['/packages', 'Add Package'], ['/accounting', 'Add Expense']]) {
    test(`${path} ${button}`, async ({ page }) => {
      const owner = await registerGym();
      await call('POST', '/packages', { token: owner.token, body: { name: 'Axe Plan', price: 10000, dayPassPrice: 1000, duration: '1 Months', durationDays: 30, status: 'active' } });
      await signIn(page, owner);
      await page.goto(path);
      await page.getByRole('button', { name: button }).first().click();
      await expect(page.getByRole('dialog').first()).toBeVisible();
      await page.waitForTimeout(400);
      expect(await problems(page), `${path} ${button}`).toEqual([]);
    });
  }

  test('the code dialog on a staff profile', async ({ page }) => {
    const owner = await registerGym();
    const trainer = await addStaff(owner, { role: 'trainer' });
    await signIn(page, owner);
    await page.goto(`/staff/${trainer.id}`);
    await page.getByRole('button', { name: 'View Code' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm it\'s you' })).toBeVisible();
    expect(await problems(page), 'code dialog').toEqual([]);
  });
});

test('the front desk passes', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  await signIn(page, desk);
  await page.goto('/front-desk');
  for (const tab of ['Check In', 'Sign Up', 'Product Sale', 'Operations']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
    expect(await problems(page), tab).toEqual([]);
  }
});

test('the sidebar is reached with Tab and worked with Enter', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/dashboard');
  const members = page.getByRole('navigation').getByRole('button', { name: 'Members', exact: true });
  await expect(members).toBeVisible();
  // Tab until the Members item has focus, as a keyboard user would
  for (let i = 0; i < 40 && !(await members.evaluate(el => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(members).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Members', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('a dialog takes focus, keeps Tab inside, closes with Escape and gives focus back', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/tasks');
  const opener = page.getByRole('button', { name: 'Add Task' }).first();
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement)), `tab ${i}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Escape closes only the dialog on top', async ({ page }) => {
  const owner = await registerGym();
  await call('POST', '/packages', { token: owner.token, body: { name: 'Stack Plan', price: 9000, dayPassPrice: 900, duration: '1 Months', durationDays: 30, status: 'active' } });
  await signIn(page, owner);
  await page.goto('/packages');
  const row = page.getByRole('row').filter({ hasText: 'Stack Plan' });
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('dialog', { name: 'Edit Package' }).getByRole('button', { name: 'Save Changes' }).click();
  const code = page.getByRole('dialog', { name: 'Confirm it\'s you' });
  await expect(code).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(code).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Edit Package' })).toBeVisible();
});

test('a row menu opens on its first item, moves with the arrows and closes back to its button', async ({ page }) => {
  const owner = await registerGym();
  await addStaff(owner, { firstName: 'Menu', lastName: 'Keys' });
  await signIn(page, owner);
  await page.goto('/staff');
  const actions = page.getByRole('row').filter({ hasText: 'Menu Keys' }).getByRole('button', { name: 'Actions' });
  await actions.focus();
  await page.keyboard.press('Enter');
  const items = page.getByRole('menuitem');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(items.last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(actions).toBeFocused();
});

test('the inactivity warning is a dialog with the way to stay in focus', async ({ page }) => {
  const owner = await registerGym();
  await page.clock.install();
  await signIn(page, owner);
  await page.goto('/dashboard');
  await expect(page.getByText(`E2E Gym ${owner.gymCode}`).first()).toBeVisible();
  await page.clock.fastForward('15:30');
  const warning = page.getByRole('alertdialog', { name: 'Are you still there?' });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Yes, I’m still here' })).toBeFocused();
});

test('a label names its box, and a click on it puts the cursor there', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/settings?section=gym-profile');
  const website = page.getByLabel('Website');
  await expect(website).toBeVisible();
  await page.getByText('Website', { exact: true }).click();
  await expect(website).toBeFocused();
  // And in a form built on the shared fields
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Add Staff Member' }).first().click();
  await expect(page.getByRole('dialog').getByLabel('First Name')).toBeVisible();
});
