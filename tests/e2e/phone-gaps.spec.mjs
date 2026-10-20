// Frontend fix plan step 3: what works on a desktop works on a phone too.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, addStaff } from './support/session.mjs';

test.use({ viewport: { width: 390, height: 844 } });

// F-101
test("the Sales page's Add product button shows only on the Products tab", async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/sales');
  await expect(page.getByTitle('Add Product')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByTitle('Add Product')).toHaveCount(0);
});

// F-111
test('the phone\'s Delete task confirmation can be cancelled', async ({ page }) => {
  const owner = await registerGym();
  const task = await call('POST', '/tasks', {
    token: owner.token,
    body: { title: 'Keep this task', assignedGroup: 'management', dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), category: 'Front Desk', priority: 'Medium' },
  });
  await signIn(page, owner);
  await page.goto('/tasks');
  await page.getByText('Keep this task').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete Task' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Delete Task' }).getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog', { name: 'Delete Task' })).toHaveCount(0);
  const tasks = await call('GET', '/tasks', { token: owner.token });
  expect(tasks.some(tk => tk.id === task.id)).toBe(true);
});

test('the phone asks for the manager\'s code to deactivate, and can be cancelled', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Phoebe', lastName: 'Phone' });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Account actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await expect(page.getByPlaceholder('••••')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByPlaceholder('••••')).toHaveCount(0);
  expect((await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(true);

  await page.getByRole('button', { name: 'Account actions' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect.poll(async () => (await call('GET', `/staff/${staff.id}`, { token: owner.token })).isActive).toBe(false);
});

// F-109
test('a task can be marked done on a phone', async ({ page }) => {
  const owner = await registerGym();
  const task = await call('POST', '/tasks', {
    token: owner.token,
    body: { title: 'Finish on the phone', assignedGroup: 'management', dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), category: 'Front Desk', priority: 'Medium' },
  });
  await signIn(page, owner);
  await page.goto('/tasks');
  await page.getByText('Finish on the phone').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Mark as Done' });
  await expect(done).toBeVisible();
  await done.getByRole('button', { name: /Mark Done/i }).click();

  await expect.poll(async () => (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.id === task.id)?.status).toBe('Done');
});

async function gymWithPackage(name) {
  const owner = await registerGym();
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name, price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  return { owner, pkg };
}

async function packageMenu(page, name, item) {
  await page.locator('div').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last().getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('a package can be viewed, edited and deleted on a phone', async ({ page }) => {
  const { owner, pkg } = await gymWithPackage('Phone Plan');
  await signIn(page, owner);
  await page.goto('/packages');

  await packageMenu(page, 'Phone Plan', 'View');
  await expect(page.getByRole('dialog', { name: 'Package Profile' })).toBeVisible();
  await page.keyboard.press('Escape');

  await packageMenu(page, 'Phone Plan', 'Edit');
  await page.locator('input[type="text"]').first().fill('Phone Plan Plus');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect.poll(async () => (await call('GET', '/packages', { token: owner.token })).find(p => p.id === pkg.id)?.name).toBe('Phone Plan Plus');

  await packageMenu(page, 'Phone Plan Plus', 'Delete');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect.poll(async () => (await call('GET', '/packages', { token: owner.token })).some(p => p.id === pkg.id)).toBe(false);
});

test('a visitor bundle can be added on a phone', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/packages');
  await page.getByRole('button', { name: 'Visitor Bundles' }).click();
  await page.getByTitle('Add Bundle').click();
  await expect(page.getByRole('dialog', { name: 'Add Session Bundle' })).toBeVisible();
});

// F-109, F-110
test('an expense with its payee can be added and viewed on a phone', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/accounting');
  await page.getByTitle('Add Expense').click();
  const form = page.getByRole('dialog', { name: 'Add Expense' });
  await form.locator('input[inputmode="numeric"]').first().fill('7500');
  await form.getByPlaceholder('e.g. Electricity Bill').fill('Phone bill');
  await form.getByPlaceholder('Vendor name').fill('Telco');
  await form.locator('input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
  await form.getByRole('button', { name: 'Save Expense' }).click();
  await expect.poll(async () => (await call('GET', '/expenses', { token: owner.token })).some(e => e.title === 'Phone bill' && e.paidTo === 'Telco')).toBe(true);
  await expect(form).toHaveCount(0);

  // The bottom row's menu sits where the floating + button is; it must still open
  await page.locator('div').filter({ hasText: 'Phone bill' }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last().getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  await expect(page.getByRole('dialog', { name: 'Expense Record' })).toBeVisible();
});

test('a paystub can be viewed and settled on a phone', async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Pat', lastName: 'Payday', role: 'trainer', salary: 90000 });
  const now = new Date();
  const month = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;
  const record = await call('POST', '/payroll', { token: owner.token, body: { staffId: staff.id, month } });
  await signIn(page, owner);
  await page.goto('/accounting?tab=paystubs');
  const card = page.locator('div').filter({ hasText: 'Pat Payday' }).filter({ has: page.getByRole('button', { name: 'Actions' }) }).last();

  await card.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'View' }).click();
  await expect(page.getByRole('dialog', { name: 'Pat Payday' })).toBeVisible();
  await page.keyboard.press('Escape');

  await card.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Mark Paid' }).click();
  const settle = page.getByRole('dialog', { name: `Pay Pat Payday for ${month}` });
  await expect(settle).toBeVisible();
  await settle.getByRole('button').last().click();
  await expect.poll(async () => (await call('GET', `/payroll/staff/${staff.id}`, { token: owner.token })).find(r => r.id === record.id)?.status).toBe('paid');
});

// F-109
test("a staff member's task can be opened and marked done from their profile on a phone", async ({ page }) => {
  const owner = await registerGym();
  const staff = await addStaff(owner, { firstName: 'Tobi', lastName: 'Tasked' });
  const task = await call('POST', '/tasks', {
    token: owner.token,
    body: { title: 'Profile phone task', assignedToId: staff.id, dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), category: 'Front Desk', priority: 'Medium' },
  });
  await signIn(page, owner);
  await page.goto(`/staff/${staff.id}`);
  await page.getByRole('button', { name: 'Tasks' }).first().click();
  await page.getByText('Profile phone task').first().click();
  const details = page.getByRole('dialog', { name: 'Task Details' });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark as Done' }).click();

  await expect.poll(async () => (await call('GET', '/tasks', { token: owner.token })).find(tk => tk.id === task.id)?.status).toBe('Done');
});

// F-110
test('a payment can be added on a phone, for the member it was taken from', async ({ page }) => {
  const owner = await registerGym();
  const day = new Date().toISOString().slice(0, 10);
  // The Payments page takes money against what a member owes
  const pkg = await call('POST', '/packages', { token: owner.token, body: { name: 'Owed Plan', price: 15000, dayPassPrice: 1500, duration: '1 Months', durationDays: 30, status: 'active' } });
  const member = await call('POST', '/members', {
    token: owner.token,
    body: { firstName: 'Payne', lastName: 'Phonepay', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day, endDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), packageId: pkg.id, balance: 15000 },
  });
  await signIn(page, owner);
  await page.goto('/payments');
  await page.getByTitle('Add Payment').click();
  const form = page.getByRole('dialog', { name: 'Add Payment' });
  await expect(async () => {
    await form.getByPlaceholder('Name or member code...').fill('');
    await form.getByPlaceholder('Name or member code...').fill('Phonepay');
    await expect(form.getByText('Payne Phonepay')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByText('Payne Phonepay').click();
  await form.locator('input[type="date"]').first().fill(day);
  await form.locator('input[inputmode="numeric"]').first().fill('5000');
  await form.getByRole('button', { name: 'Save Payment' }).click();

  await expect.poll(async () => (await call('GET', '/payments', { token: owner.token })).some(p => p.memberId === member.id && Number(p.amount) === 5000)).toBe(true);
});
