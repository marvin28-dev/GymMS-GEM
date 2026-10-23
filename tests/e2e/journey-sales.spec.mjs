// Journey J-17 (sales and products): a product added with its code suggested
// from the name and its profit shown as the prices are typed, sold from the
// Sales page's Quick Sale and from the front desk's cart, the stock following
// each sale and the day's sales listed.
import { test, expect } from '@playwright/test';
import { registerGym, signIn, addStaff, call, uniqueCode } from './support/session.mjs';

test.describe.configure({ timeout: 120_000 });

// A field by its label (the labels are not yet tied to their boxes, F-092)
// (a select sits one box further in, beside its arrow)
const field = (scope, label) => {
  const box = `div:has(> label:text-matches("^${label}( [*])?$"))`;
  return scope.locator(`${box} > input, ${box} > div > select`);
};
const amount = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?'));

test('J-17: a product is added with a suggested code and its profit, and sold from Quick Sale', async ({ page }) => {
  const owner = await registerGym();
  await signIn(page, owner);
  await page.goto('/sales');
  await page.getByRole('button', { name: '+ Add Product' }).click();
  const form = page.getByRole('dialog');
  await form.getByPlaceholder('e.g. Whey Protein (1kg)').fill('Whey Protein');
  // The code follows the name until someone types their own
  await expect(form.getByPlaceholder('WHEP-001')).toHaveValue('WHEP-001');
  const category = field(form, 'Category');
  if (await category.count()) {
    const options = await category.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
    if (options.length) await category.selectOption(options[0]);
  }
  await field(form, 'Cost Price').fill('6000');
  await field(form, 'Selling Price').fill('10000');
  await expect(form.getByText('Profit per item')).toBeVisible();
  await expect(form.getByText(amount(4000)).first()).toBeVisible();
  await field(form, 'Quantity').fill('5');
  await form.getByRole('button', { name: 'Save Product' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const [made] = (await call('GET', '/products', { token: owner.token }));
  expect(made).toMatchObject({ code: 'WHEP-001', costPrice: 6000, price: 10000, stock: 5 });

  const quantity = field(page.locator('main'), 'Quantity');
  await field(page.locator('main'), 'Product').selectOption(String(made.id));
  // No more than is on the shelf
  await quantity.fill('9');
  await expect(page.getByText('Only 5 left in stock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete Sale' })).toBeDisabled();
  await quantity.fill('2');
  await page.getByRole('button', { name: 'Complete Sale' }).click();
  await expect(page.getByText(/^✓ /)).toBeVisible();

  await expect.poll(async () => (await call('GET', '/products', { token: owner.token }))[0].stock).toBe(3);
  const [sale] = await call('GET', '/sales', { token: owner.token });
  expect(sale.total).toBe(20000);
  expect(sale.items[0]).toMatchObject({ quantity: 2, unitPrice: 10000, unitCost: 6000 });
  // Today's profit is what the two sold for less what they cost
  // (each card shows its figure above its name)
  await expect(page.getByText('Profit today', { exact: true }).locator('xpath=preceding-sibling::div[1]')).toHaveText(amount(8000));
});

test('J-17: the front desk sells from its cart, and the day\'s sales panel lists it', async ({ page }) => {
  const owner = await registerGym();
  const desk = await addStaff(owner, { role: 'front_desk' });
  const name = `Energy Bar ${uniqueCode('b').slice(-4)}`;
  const p = await call('POST', '/products', { token: owner.token, body: { name, code: uniqueCode('BAR').toUpperCase(), category: 'Snacks', price: 1500, costPrice: 900, stock: 4 } });
  await signIn(page, desk);
  await page.goto('/front-desk');
  await page.getByRole('button', { name: 'Product Sale', exact: true }).click();
  await expect(page.getByText('Nothing sold yet today')).toBeVisible();
  const card = page.getByRole('button', { name: new RegExp(name) });
  await card.click();
  await card.click();
  await page.getByRole('button', { name: 'Record Sale' }).click();
  await expect(page.getByText('✓ Sale recorded!')).toBeVisible();

  await expect.poll(async () => (await call('GET', '/products', { token: owner.token })).find(x => x.id === p.id).stock).toBe(2);
  const sales = await call('GET', '/sales', { token: owner.token });
  expect(sales).toHaveLength(1);
  expect(sales[0]).toMatchObject({ total: 3000 });
  await expect(page.getByText('Nothing sold yet today')).toHaveCount(0);
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(amount(3000)).first()).toBeVisible();
});
