// F-084, F-107: when the server refuses or cannot be reached, the front desk
// says so and keeps what was typed, instead of reporting success.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';

const refuse = (page, method, path, status = 500, body = { error: 'Server is down for the test' }) =>
  page.route(`**/api${path}`, (route) => (route.request().method() === method
    ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    : route.fallback()));

async function openDesk(page) {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  return owner;
}

test('a desk expense the server refused is not reported as sent', async ({ page }) => {
  await openDesk(page);
  await refuse(page, 'POST', '/expenses');
  await page.getByText('Quick Expense', { exact: true }).click();
  await page.getByPlaceholder('What was purchased?').fill('Cleaning cloths');
  await page.getByPlaceholder('Who was paid?').fill('Market stall');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').nth(2).fill('2500');
  await dialog.getByRole('button', { name: 'Send for review' }).click();

  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('Sent for review', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('What was purchased?')).toHaveValue('Cleaning cloths');
});

test('an equipment issue the server refused is not reported as logged', async ({ page }) => {
  await openDesk(page);
  await refuse(page, 'POST', '/equipment');
  await page.getByText('Report Issue', { exact: true }).first().click();
  await page.getByPlaceholder("e.g. Treadmill #3, Men's Locker Room").fill('Treadmill 2');
  await page.getByPlaceholder('Describe the issue in detail...').fill('Belt slips');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Submit' }).click();

  await expect(dialog.getByText('Server is down for the test')).toBeVisible();
  await expect(page.getByText('Issue Reported', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("e.g. Treadmill #3, Men's Locker Room")).toHaveValue('Treadmill 2');
});

test('a desk expense the server saved is sent for review', async ({ page }) => {
  const owner = await openDesk(page);
  await page.getByText('Quick Expense', { exact: true }).click();
  await page.getByPlaceholder('What was purchased?').fill('Light bulbs');
  await page.getByPlaceholder('Who was paid?').fill('Hardware shop');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').nth(2).fill('3000');
  await dialog.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Sent for review', { exact: true })).toBeVisible();
  const waiting = await call('GET', '/expenses?pending=1', { token: owner.token });
  expect(waiting.map(e => e.title)).toContain('Light bulbs');
});

test('an equipment issue the server saved is reported as logged', async ({ page }) => {
  const owner = await openDesk(page);
  await page.getByText('Report Issue', { exact: true }).first().click();
  await page.getByPlaceholder("e.g. Treadmill #3, Men's Locker Room").fill('Rowing machine');
  await page.getByPlaceholder('Describe the issue in detail...').fill('Seat stuck');
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Issue Reported', { exact: true })).toBeVisible();
  const issues = await call('GET', '/equipment', { token: owner.token });
  expect(issues.map(i => i.equipment || i.name)).toContain('Rowing machine');
});
