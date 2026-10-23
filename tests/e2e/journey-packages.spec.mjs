// Journey J-20 (packages) on a desktop: a monthly package needs its day pass
// price, an edit goes through only with the manager's own code, and a visitor
// bundle is priced per session.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, call, uniqueCode } from './support/session.mjs';

test.describe.configure({ timeout: 120_000 });

test('J-20: a package needs a day pass price, and an edit needs the manager\'s code', async ({ page }) => {
  const owner = await registerGym();
  const name = `Gold ${uniqueCode('g').slice(-5)}`;
  await signIn(page, owner);
  await page.goto('/packages');
  await page.getByRole('button', { name: 'Add Package' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Package' });
  await form.getByPlaceholder('e.g. Premium 12M').fill(name);
  const amounts = form.getByPlaceholder('0', { exact: true });
  await amounts.nth(0).fill('20000');
  await form.getByRole('button', { name: 'Add Package' }).click();
  await expect(form.getByText('Required', { exact: true })).toBeVisible();
  expect((await call('GET', '/packages', { token: owner.token })).some(p => p.name === name)).toBe(false);
  await amounts.nth(1).fill('2000');
  await form.getByRole('button', { name: 'Add Package' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const made = (await call('GET', '/packages', { token: owner.token })).find(p => p.name === name);
  expect(made).toMatchObject({ price: 20000, dayPassPrice: 2000, isVisitor: false });

  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Package' });
  await edit.getByPlaceholder('e.g. Premium 12M').fill(`${name} Plus`);
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  const wrong = owner.accessCode === '0000' ? '1111' : '0000';
  await page.getByPlaceholder('••••').fill(wrong);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect(page.getByText('Incorrect code. Try again.')).toBeVisible();
  expect((await call('GET', '/packages', { token: owner.token })).find(p => p.id === made.id).name).toBe(name);
  // Typed straight away, while the box still shakes from the refusal (F-168)
  await page.getByPlaceholder('••••').fill(owner.accessCode);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect.poll(async () => (await call('GET', '/packages', { token: owner.token })).find(p => p.id === made.id).name).toBe(`${name} Plus`);
  await expect(page.getByRole('row').filter({ hasText: `${name} Plus` })).toBeVisible();
});

test('J-20: a visitor bundle is priced per session and lasts the days given', async ({ page }) => {
  const owner = await registerGym();
  const label = `${uniqueCode('b').slice(-4)} Sessions`;
  await signIn(page, owner);
  await page.goto('/packages');
  await page.getByRole('button', { name: 'Visitor Bundles' }).click();
  await page.getByRole('button', { name: 'Add Bundle' }).first().click();
  const form = page.getByRole('dialog', { name: 'Add Session Bundle' });
  await form.getByPlaceholder('e.g. 10 Sessions').fill(label);
  await form.getByPlaceholder('e.g. 10', { exact: true }).fill('8');
  await form.getByPlaceholder('e.g. 2500').fill('2500');
  await form.getByPlaceholder('e.g. 30').fill('45');
  // The total follows what is typed
  await expect(form.getByText(/20[\s  ]?000/)).toBeVisible();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const bundle = (await call('GET', '/packages', { token: owner.token })).find(p => p.name === label);
  expect(bundle).toMatchObject({ isVisitor: true, price: 20000, durationDays: 45 });
  expect(String(bundle.sessions)).toBe('8');
  await expect(page.getByRole('row').filter({ hasText: label })).toBeVisible();
});
