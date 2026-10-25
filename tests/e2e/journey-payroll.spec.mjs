// D-30: pay is settled, edited and reversed on the server, which books and
// removes the salary expense with it, and a receipt photo is kept with its
// expense instead of in the browser that attached it.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call } from './support/session.mjs';
import { localDay } from './support/forms.mjs';

test.describe.configure({ timeout: 120_000 });

// The smallest PNG there is: one transparent pixel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const thisMonth = () => { const d = new Date(); return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`; };
const payOf = async (owner, staff) => (await call('GET', `/payroll/staff/${staff.id}`, { token: owner.token }))[0];
const expenseOf = async (owner, id) => (await call('GET', '/expenses', { token: owner.token })).find(e => e.id === id);

async function authorize(page, owner) {
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
}

test('J-19: settled pay books its salary, an edited paystub is kept, and reversing it takes the salary out', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Pat', lastName: 'Payday', role: 'trainer', salary: 90000 });
  await call('POST', '/payroll', { token: owner.token, body: { staffId: staff.id, month: thisMonth() } });
  await signIn(page, owner);
  await page.goto('/accounting?tab=paystubs');
  const row = page.getByRole('row').filter({ hasText: 'Pat Payday' });

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Mark Paid' }).click();
  const settle = page.getByRole('dialog', { name: `Pay Pat Payday for ${thisMonth()}` });
  await settle.getByLabel('Paid by').selectOption({ label: 'Mobile Money' });
  await settle.getByRole('button').last().click();
  await expect(settle).toHaveCount(0);
  await expect.poll(async () => (await payOf(owner, staff)).status).toBe('paid');
  const { expenseId } = await payOf(owner, staff);
  expect(await expenseOf(owner, expenseId)).toMatchObject({ amount: 90000, method: 'mobile_money', category: 'Salaries', paidTo: 'Pat Payday' });

  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit Pay' }).click();
  const stub = page.getByRole('dialog', { name: /Pat Payday/ });
  await stub.getByLabel('Allowances').fill('10000');
  await stub.getByRole('button', { name: 'Add Deduction' }).click();
  await stub.getByPlaceholder('Deduction label *').fill('Advance');
  await stub.getByPlaceholder('Amount *').fill('5000');
  await stub.getByPlaceholder('Note / reason (required) *').fill('Taken mid-month');
  await stub.getByRole('button', { name: 'Save Deduction' }).click();
  await stub.getByRole('button', { name: 'Save Changes' }).click();
  await authorize(page, owner);
  await expect.poll(async () => (await payOf(owner, staff)).amount).toBe(100000);
  expect(await payOf(owner, staff)).toMatchObject({ deductions: 5000, netAmount: 95000 });
  expect((await expenseOf(owner, expenseId)).amount).toBe(100000);

  // Saved on the server: a reload shows the same deduction in the edit form
  await page.reload();
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit Pay' }).click();
  await expect(stub.getByText('Advance')).toBeVisible();
  await stub.getByRole('button', { name: 'Mark Unpaid' }).click();
  await authorize(page, owner);
  await expect.poll(async () => (await payOf(owner, staff)).status).toBe('issued');
  expect(await expenseOf(owner, expenseId)).toBeUndefined();
});

test("J-19: a receipt photo is kept with its expense and seen from another browser", async ({ page, browser }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/accounting');
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Expense' });
  await form.locator('input[inputmode="numeric"]').first().fill('7500');
  await form.getByPlaceholder('e.g. Electricity Bill').fill('Generator fuel');
  await form.getByPlaceholder('Vendor name').fill('Total');
  await form.locator('input[type="date"]').first().fill(localDay());
  await form.locator('input[type="file"]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await form.getByRole('button', { name: 'Save Expense' }).click();
  await expect(form).toHaveCount(0);
  await expect.poll(async () => (await call('GET', '/expenses', { token: owner.token })).find(e => e.title === 'Generator fuel')?.receipt || '').toMatch(/^https:\/\/.+\/gem\/receipts\//);
  const { receipt } = (await call('GET', '/expenses', { token: owner.token })).find(e => e.title === 'Generator fuel');

  const elsewhere = await browser.newContext();
  const other = await elsewhere.newPage();
  await signIn(other, owner);
  await other.route('https://res.cloudinary.test/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await other.goto('/accounting');
  await other.getByRole('row').filter({ hasText: 'Generator fuel' }).getByRole('button', { name: 'Actions' }).click();
  await other.getByRole('menuitem', { name: 'View' }).click();
  await expect(other.getByRole('dialog', { name: 'Expense Record' }).getByRole('img', { name: 'Receipt' })).toHaveAttribute('src', receipt);
  await elsewhere.close();
});

test('J-19: a receipt kept in this browser before D-30 is handed to the server once', async ({ page }) => {
  const owner = await registerGym();
  const expense = await call('POST', '/expenses', { token: owner.token, body: { title: 'Old receipt', category: 'Utilities', amount: 3000, date: localDay(), paidTo: 'ENEO', method: 'cash' } });
  await signIn(page, owner);
  // Put there once, as the old page did, before the app's own code runs
  await page.addInitScript(({ id, data }) => {
    if (!/^https?:$/.test(location.protocol) || sessionStorage.getItem('e2e_old_receipt')) return;
    sessionStorage.setItem('e2e_old_receipt', '1');
    localStorage.setItem(`gem_expense_receipt_${id}`, data);
  }, { id: expense.id, data: `data:image/png;base64,${PNG.toString('base64')}` });
  await page.goto('/accounting');
  await expect.poll(async () => (await expenseOf(owner, expense.id)).receipt || '').toMatch(/\/gem\/receipts\//);
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`gem_expense_receipt_${id}`), expense.id)).toBe(null);
});
