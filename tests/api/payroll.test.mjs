import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

let api, stop, gym, prisma;
const issue = (staffId, month) => api.post('/api/payroll', { staffId, month }, { token: gym.token });

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('issuing pay', () => {
  it('pays a full-time salary for the month', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer', salary: 100000 });
    const res = await issue(trainer.id, 'Sep 2026');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ month: 'Sep 2026', amount: 100000, deductions: 0, netAmount: 100000, status: 'issued' });
  });

  it('pays a month once, even when it is issued twice at the same moment', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer', salary: 80000 });
    const [a, b] = await Promise.all([issue(trainer.id, 'Aug 2026'), issue(trainer.id, 'Aug 2026')]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const history = await api.get(`/api/payroll/staff/${trainer.id}`, { token: gym.token });
    expect(history.body.filter(r => r.month === 'Aug 2026')).toHaveLength(1);
  });

  it('treats a month written another way as the same month', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer', salary: 50000 });
    expect((await issue(trainer.id, 'Jul 2026')).status).toBe(201);
    expect((await issue(trainer.id, 'jul 2026')).status).toBe(409);
    expect((await issue(trainer.id, 'July 2026')).status).toBe(409);
  });

  it('refuses a pay period that is not a month', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer', salary: 50000 });
    const res = await issue(trainer.id, 'banana');
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('month');
  });
});

// D-30: the salary expense was booked from the browser in a second request,
// linked to the pay only in that browser, and paystub edits were never saved
describe('settling pay', () => {
  const status = (id, body) => api.patch(`/api/payroll/${id}/status`, body, { token: gym.token });
  const expenses = async () => (await api.get('/api/expenses', { token: gym.token })).body;
  const issued = async (salary, month) => {
    const staff = await addStaff(api, gym, { role: 'trainer', salary });
    return { staff, pay: (await issue(staff.id, month)).body };
  };

  it('books the salary when the pay is marked paid, and takes it out when it is marked unpaid', async () => {
    const { staff, pay } = await issued(90000, 'Jun 2026');
    const paid = await status(pay.id, { status: 'paid', method: 'Mobile Money', expenseTitle: `Salaire : ${staff.firstName}` });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ status: 'paid', expenseId: paid.body.expense.id });
    expect(paid.body.expense).toMatchObject({ amount: 90000, category: 'Salaries', method: 'mobile_money', title: `Salaire : ${staff.firstName}`, approvalStatus: 'approved' });
    expect((await expenses()).some(e => e.id === paid.body.expenseId)).toBe(true);

    const again = await status(pay.id, { status: 'paid' });
    expect(again.body.expenseId).toBe(paid.body.expenseId);
    expect((await expenses()).filter(e => e.paidTo === paid.body.expense.paidTo)).toHaveLength(1);

    const unpaid = await status(pay.id, { status: 'issued' });
    expect(unpaid.body).toMatchObject({ status: 'issued', expenseId: null, paidAt: null });
    expect((await expenses()).some(e => e.id === paid.body.expenseId)).toBe(false);
  });

  it('books one salary when Mark paid is pressed twice at the same moment', async () => {
    const { pay } = await issued(70000, 'May 2026');
    const both = await Promise.all([status(pay.id, { status: 'paid' }), status(pay.id, { status: 'paid' })]);
    expect(both.map(r => r.status)).toEqual([200, 200]);
    expect(both[0].body.expenseId).toBe(both[1].body.expenseId);
    expect((await expenses()).filter(e => e.paidTo === both[0].body.expense?.paidTo || e.id === both[0].body.expenseId)).toHaveLength(1);
  });

  it("keeps a salary's amount with the pay: the expense cannot be changed or deleted on its own", async () => {
    const { pay } = await issued(60000, 'Apr 2026');
    const { expenseId } = (await status(pay.id, { status: 'paid' })).body;
    expect((await api.patch(`/api/expenses/${expenseId}`, { amount: 1 }, { token: gym.token })).status).toBe(409);
    expect((await api.del(`/api/expenses/${expenseId}`, { token: gym.token })).status).toBe(409);
    expect((await api.patch(`/api/expenses/${expenseId}`, { note: 'Paid in the office' }, { token: gym.token })).status).toBe(200);
    expect((await api.del(`/api/payroll/${pay.id}`, { token: gym.token })).status).toBe(409);
    expect((await expenses()).find(e => e.id === expenseId)).toMatchObject({ amount: 60000, note: 'Paid in the office' });
  });

  it('saves an edited paystub, and its salary expense follows it', async () => {
    const { pay } = await issued(90000, 'Mar 2026');
    const { expenseId } = (await status(pay.id, { status: 'paid' })).body;
    const edit = (body) => api.patch(`/api/payroll/${pay.id}`, body, { token: gym.token });
    const res = await edit({ allowances: 10000, deductions: [{ label: 'Advance', amount: 5000, note: 'Taken in March' }] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amount: 100000, deductions: 5000, netAmount: 95000 });
    expect(res.body.breakdown).toMatchObject({ basePay: 90000, totalBonuses: 10000, totalDeductions: 5000, deductions: [{ label: 'Advance', amount: 5000, note: 'Taken in March' }] });
    const kept = (await api.get('/api/payroll?month=Mar%202026', { token: gym.token })).body.find(r => r.id === pay.id);
    expect(kept).toMatchObject({ amount: 100000, deductions: 5000, netAmount: 95000 });
    expect((await expenses()).find(e => e.id === expenseId).amount).toBe(100000);

    const tooMuch = await edit({ allowances: 0, deductions: [{ label: 'Loan', amount: 95000 }] });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.field).toBe('deductions');
    expect((await edit({ allowances: -1, deductions: [] })).body.field).toBe('allowances');
    expect((await edit({ allowances: 0, deductions: [{ label: '', amount: 100 }] })).status).toBe(400);
    expect((await expenses()).find(e => e.id === expenseId).amount).toBe(100000);
  });

  it("is the owner's alone", async () => {
    const manager = await addStaff(api, gym, { role: 'manager' });
    const { pay } = await issued(50000, 'Feb 2026');
    const as = { token: manager.token };
    expect((await api.patch(`/api/payroll/${pay.id}`, { allowances: 1, deductions: [] }, as)).status).toBe(403);
    expect((await api.patch(`/api/payroll/${pay.id}/status`, { status: 'paid' }, as)).status).toBe(403);
    expect((await api.post(`/api/payroll/${pay.id}/expense`, { expenseId: 'x' }, as)).status).toBe(403);
  });

  it('takes over, once, a link a browser kept between a paid pay and its expense', async () => {
    const { staff, pay } = await issued(40000, 'Jan 2026');
    const { expenseId: booked } = (await status(pay.id, { status: 'paid' })).body;
    await prisma.payRecord.update({ where: { id: pay.id }, data: { expenseId: null } });
    const salary = (await api.post('/api/expenses', { title: 'Salary', category: 'Salaries', amount: 40000, date: '2026-01-31', paidTo: staff.firstName }, { token: gym.token })).body;
    const other = (await api.post('/api/expenses', { title: 'Fuel', category: 'Utilities', amount: 100, date: '2026-01-31', paidTo: 'Total' }, { token: gym.token })).body;
    const link = (expenseId) => api.post(`/api/payroll/${pay.id}/expense`, { expenseId }, { token: gym.token });
    expect((await link(other.id)).status).toBe(404);
    const res = await link(salary.id);
    expect(res.status).toBe(200);
    expect(res.body.expenseId).toBe(salary.id);
    expect((await link(booked)).status).toBe(409);
    await status(pay.id, { status: 'issued' });
    expect((await expenses()).some(e => e.id === salary.id)).toBe(false);
  });
});
