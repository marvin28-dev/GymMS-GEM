// The end-of-day report (GET /api/reports/eod), which Daily Overview, the
// Dashboard and the Front Desk all print: revenue is what members paid plus
// the shop's profit, money at hand is counted method by method (a desk expense
// still awaiting review has left the drawer), and the day is the gym's own.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, desk, trainer, report;
// Douala: UTC+1, which getTimezoneOffset() gives as -60
const TZ = -60;
const localDay = (ms = Date.now()) => new Date(ms - TZ * 60000).toISOString().slice(0, 10);
const eod = (query = '', token = gym.token) => api.get(`/api/reports/eod?tz=${TZ}${query}`, { token });

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
  const today = localDay();

  const owing = await addMember(api, gym.token, { balance: 20000 });
  const pay = (body) => api.post('/api/payments', { memberId: owing.id, ...body }, { token: gym.token });
  expect((await pay({ amount: 5000, method: 'cash', type: 'membership' })).status).toBe(201);
  expect((await pay({ amount: 3000, method: 'mobile_money', type: 'registration' })).status).toBe(201);

  const product = async (body) => (await api.post('/api/products', { name: 'Bar', code: uniqueCode('R').toUpperCase(), category: 'Snacks', price: 1000, costPrice: 600, stock: 20, ...body }, { token: gym.token })).body;
  const costed = await product();
  const uncosted = await product({ name: 'Old stock' });
  // An item sold before costs were kept: the product's cost is cleared afterwards
  expect((await api.post('/api/sales', { items: [{ productId: costed.id, quantity: 2 }], method: 'Card' }, { token: desk.token })).status).toBe(201);
  expect((await api.post('/api/sales', { items: [{ productId: uncosted.id, quantity: 1 }], method: 'Cash' }, { token: desk.token })).status).toBe(201);
  await prisma.saleItem.updateMany({ where: { productId: uncosted.id }, data: { unitCost: null } });
  await prisma.product.update({ where: { id: uncosted.id }, data: { costPrice: null } });

  const expense = (body, token) => api.post('/api/expenses', { title: 'Supplies', category: 'Supplies', date: today, paidTo: 'Market', ...body }, { token });
  expect((await expense({ amount: 1500, method: 'cash', source: 'frontdesk' }, desk.token)).status).toBe(201);
  expect((await expense({ amount: 2000, method: 'bank_transfer' }, gym.token)).status).toBe(201);
  expect((await expense({ amount: 700 }, gym.token)).status).toBe(201);

  expect((await api.post('/api/attendance/checkin', { memberId: owing.id }, { token: desk.token })).status).toBe(201);

  // Another gym's day never shows here
  const other = await registerGym(api);
  const theirs = await addMember(api, other.token, { balance: 9000 });
  await api.post('/api/payments', { memberId: theirs.id, amount: 9000, method: 'cash', type: 'membership' }, { token: other.token });

  report = (await eod()).body;
});
afterAll(() => stop());

describe('the end-of-day report', () => {
  it('adds up what members paid, by kind', () => {
    expect(report.date).toBe(localDay());
    expect(report.totals).toMatchObject({ paymentsTotal: 8000, membershipRevenue: 5000, registrationRevenue: 3000 });
    expect(report.payments.map(p => p.amount).sort()).toEqual([3000, 5000]);
  });

  it('counts the shop by its profit, leaving out what has no known cost and saying so', () => {
    expect(report.totals).toMatchObject({ salesTotal: 3000, salesProfit: 800, salesProfitMissing: 1, salesCounted: 2000, costOfSales: 1200, itemsSold: 3 });
    expect(report.sales.find(s => s.unknownCostItems === 1).profit).toBeNull();
    expect(report.totals.revenue).toBe(8000 + 800);
  });

  it('takes only booked expenses off the net, and lists the desk\'s waiting one apart', () => {
    expect(report.totals).toMatchObject({ expensesTotal: 2700, expensesPending: 1500 });
    expect(report.totals.net).toBe(8800 - 2700);
    expect(report.expenses.find(e => e.amount === 1500)).toMatchObject({ pending: true, source: 'frontdesk' });
  });

  it('counts money at hand method by method; waiting desk expenses and ones with no method are cash out', () => {
    const by = Object.fromEntries(report.totals.byMethod.map(m => [m.method, m]));
    expect(by.cash).toEqual({ method: 'cash', in: 5000 + 1000, out: 1500 + 700, atHand: 3800 });
    expect(by.mobile_money).toMatchObject({ in: 3000, out: 0 });
    expect(by.card).toMatchObject({ in: 2000, out: 0 });
    expect(by.bank_transfer).toMatchObject({ in: 0, out: 2000, atHand: -2000 });
    expect(report.totals).toMatchObject({ moneyIn: 11000, moneyOut: 4200, moneyAtHand: 6800, cashAtHand: 3800 });
  });

  it('lists the day\'s check-ins and who joined, and what is still owed', () => {
    expect(report.totals.checkins).toBe(1);
    expect(report.checkins[0]).toMatchObject({ who: 'member' });
    expect(report.totals.registrations).toBeGreaterThanOrEqual(1);
    expect(report.totals).toMatchObject({ outstanding: 20000 - 5000, membersOwing: 1 });
  });

  it('is empty for another day', async () => {
    const yesterday = localDay(Date.now() - 864e5);
    const res = await eod(`&date=${yesterday}`);
    expect(res.body.date).toBe(yesterday);
    expect(res.body.totals).toMatchObject({ paymentsTotal: 0, salesTotal: 0, expensesTotal: 0, checkins: 0, registrations: 0 });
  });

  it('is for the desk and management, not a trainer', async () => {
    expect((await eod('', desk.token)).status).toBe(200);
    expect((await eod('', trainer.token)).status).toBe(403);
  });
});
