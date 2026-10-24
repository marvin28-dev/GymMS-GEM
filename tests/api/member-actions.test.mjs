// D-20 (F-057, F-108, F-181): renewing, changing package, a day pass, a
// visitor bundle, converting to a visitor and the registration fee each take
// the money and make the change in one request. Only a manager may set a
// membership, its balance or its passes directly.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, getMember, daysFromNow, uniqueCode } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, desk, trainer, gold, silver, bundle;
const tz = new Date().getTimezoneOffset();
const today = daysFromNow(0);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const act = (memberId, name, body = {}, who = desk) => api.post(`/api/members/${memberId}/${name}`, { tz, ...body }, { token: who.token });
const pay = (...amounts) => amounts.map(amount => ({ amount, method: 'Cash' }));
const paymentsOf = (memberId) => prisma.payment.findMany({ where: { memberId }, orderBy: { createdAt: 'asc' } });
// A visitor as the desk would have them, set straight in the database (adding
// one through the API needs their first payment, which is not what is tested)
const visitor = async (data) => {
  const m = await addMember(api, gym.token);
  const dates = Object.fromEntries(['startDate', 'endDate'].filter(k => data[k]).map(k => [k, new Date(`${data[k]}T00:00:00.000Z`)]));
  return prisma.member.update({ where: { id: m.id }, data: { isVisitor: true, status: 'visitor', ...data, ...dates } });
};
const pkg = async (body) => (await api.post('/api/packages', { name: `P ${uniqueCode('p')}`, duration: '1 Months', ...body }, { token: gym.token })).body;

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
  gold = await pkg({ price: 30000, minPayment: 10000, dayPassPrice: 2000, durationDays: 30, sessions: '12' });
  silver = await pkg({ price: 20000, dayPassPrice: 1500, durationDays: 60 });
  bundle = await pkg({ price: 10000, isVisitor: true, sessions: '10', durationDays: 30 });
});
afterAll(() => stop());

describe('renewing', () => {
  it('waits until what is owed is settled, and never starts before today', async () => {
    const m = await addMember(api, gym.token, { balance: 5000, packageId: gold.id });
    const owing = await act(m.id, 'renew', { packageId: gold.id, startDate: today, payments: pay(30000) });
    expect(owing.status).toBe(400);
    expect(owing.body.owes).toBe(5000);
    const clear = await addMember(api, gym.token, { packageId: gold.id });
    expect((await act(clear.id, 'renew', { packageId: gold.id, startDate: daysFromNow(-1), payments: pay(30000) })).body.field).toBe('startDate');
    expect(await paymentsOf(m.id)).toEqual([]);
  });

  it('takes at least the package minimum and no more than its price', async () => {
    const m = await addMember(api, gym.token, { packageId: gold.id });
    expect((await act(m.id, 'renew', { packageId: gold.id, startDate: today, payments: pay(9000) })).body.minimum).toBe(10000);
    expect((await act(m.id, 'renew', { packageId: gold.id, startDate: today, payments: pay(20000, 11000) })).status).toBe(400);
    expect(await paymentsOf(m.id)).toEqual([]);
  });

  it('records the payments and the new term together, the rest owed', async () => {
    const m = await addMember(api, gym.token, { packageId: silver.id, passesRemaining: 3, passesTotal: 5 });
    const res = await act(m.id, 'renew', { packageId: gold.id, startDate: today, payments: [{ amount: 8000, method: 'Cash' }, { amount: 4000, method: 'Mobile Money' }] });
    expect(res.status).toBe(200);
    const after = await getMember(api, gym.token, m.id);
    expect(after).toMatchObject({ packageId: gold.id, balance: 18000, status: 'active', isVisitor: false, passesTotal: 12, passesRemaining: 12 });
    expect([day(after.startDate), day(after.endDate)]).toEqual([today, daysFromNow(30)]);
    const paid = await paymentsOf(m.id);
    expect(paid.map(p => [p.amount, p.method, p.type, p.balanceAfter])).toEqual([[8000, 'cash', 'membership', 22000], [4000, 'mobile_money', 'membership', 18000]]);
  });

  it('starting later reads as pending until then', async () => {
    const m = await addMember(api, gym.token, { packageId: gold.id });
    expect((await act(m.id, 'renew', { packageId: gold.id, startDate: daysFromNow(5), payments: pay(30000) })).body.member.status).toBe('pending');
  });
});

describe('changing package', () => {
  it('moves onto another package from today, never the same one, never over a debt', async () => {
    const m = await addMember(api, gym.token, { packageId: silver.id });
    expect((await act(m.id, 'change-package', { packageId: silver.id, payments: pay(20000) })).body.field).toBe('packageId');
    const res = await act(m.id, 'change-package', { packageId: gold.id, payments: pay(12000) });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ packageId: gold.id, balance: 18000, status: 'active' });
    expect(day(res.body.member.endDate)).toBe(daysFromNow(30));
    expect((await act(m.id, 'change-package', { packageId: silver.id, payments: pay(20000) })).body.owes).toBe(18000);
  });
});

describe('a day pass', () => {
  it('is paid in full at the member\'s own package\'s price, and kept apart from their sessions', async () => {
    const m = await addMember(api, gym.token, { packageId: gold.id, status: 'expired', balance: 7000 });
    expect((await act(m.id, 'day-pass', { payments: pay(1500) })).body.minimum).toBe(2000);
    const res = await act(m.id, 'day-pass', { payments: pay(2000) });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ dayPasses: 1, balance: 7000 });
    expect((await paymentsOf(m.id)).map(p => [p.type, p.balanceAfter])).toEqual([['product', 7000]]);
  });

  it('for a visitor: settle first, use up the passes left on their package first, and start the count again once all are spent', async () => {
    const owing = await visitor({ packageId: bundle.id, balance: 3000 });
    expect((await act(owing.id, 'day-pass', { packageId: gold.id, payments: pay(2000) })).body.owes).toBe(3000);

    const holding = await visitor({ packageId: bundle.id, passesRemaining: 2, passesTotal: 10, endDate: daysFromNow(10) });
    expect((await act(holding.id, 'day-pass', { packageId: gold.id, payments: pay(2000) })).body.field).toBe('packageId');

    const spent = await visitor({ status: 'expired', packageId: gold.id, passesRemaining: 4, passesTotal: 11, endDate: daysFromNow(-3) });
    const res = await act(spent.id, 'day-pass', { packageId: gold.id, payments: pay(2000) });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ dayPasses: 1, passesTotal: 1, passesRemaining: 0, status: 'visitor' });
    expect(day(res.body.member.endDate)).toBe(today);
  });
});

describe('a visitor bundle', () => {
  it('takes at least the gym\'s minimum share, carries unused passes over, and the rest is owed', async () => {
    const m = await visitor({ packageId: bundle.id, passesRemaining: 3, passesTotal: 10, startDate: daysFromNow(-20), endDate: daysFromNow(10) });
    expect((await act(m.id, 'visitor-bundle', { packageId: bundle.id, payments: pay(4000) })).body.minimum).toBe(5000);
    const res = await act(m.id, 'visitor-bundle', { packageId: bundle.id, payments: pay(6000) });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ passesRemaining: 13, passesTotal: 13, balance: 4000, isVisitor: true, status: 'visitor' });
    expect(day(res.body.member.endDate)).toBe(daysFromNow(40));
  });
});

describe('converting to a visitor', () => {
  it('replaces the membership with a visitor bundle, paid at least in part', async () => {
    const m = await addMember(api, gym.token, { packageId: gold.id });
    const res = await act(m.id, 'convert-to-visitor', { packageId: bundle.id, payments: pay(10000) });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ isVisitor: true, status: 'visitor', packageId: bundle.id, passesTotal: 10, passesRemaining: 10, balance: 0 });
    expect((await act(m.id, 'convert-to-visitor', { packageId: bundle.id, payments: pay(10000) })).status).toBe(400);
  });
});

describe('the registration fee', () => {
  it('is the gym\'s own fee, refused when it charges none', async () => {
    const m = await addMember(api, gym.token, { status: 'suspended' });
    expect((await act(m.id, 'registration-fee', { payments: pay(5000) })).status).toBe(400);
    await prisma.gym.update({ where: { id: gym.user.gymId }, data: { registrationFee: 4000 } });
    try {
      expect((await act(m.id, 'registration-fee', { payments: pay(5000) })).status).toBe(400);
      const res = await act(m.id, 'registration-fee', { payments: pay(4000) });
      expect(res.status).toBe(200);
      expect(res.body.member.status).toBe('active');
      expect(day(res.body.member.regFeeDate)).toBe(today);
      expect((await paymentsOf(m.id)).map(p => [p.type, p.amount])).toEqual([['registration', 4000]]);
    } finally {
      await prisma.gym.update({ where: { id: gym.user.gymId }, data: { registrationFee: 0 } });
    }
  });
});

describe('who may change a membership', () => {
  it('the desk may not set a balance, dates or passes directly; a manager may', async () => {
    const m = await addMember(api, gym.token, { balance: 9000 });
    const tried = await api.patch(`/api/members/${m.id}`, { balance: 0 }, { token: desk.token });
    expect(tried.status).toBe(403);
    expect(tried.body.fields).toEqual(['balance']);
    for (const body of [{ endDate: daysFromNow(90) }, { dayPasses: 5 }, { status: 'active' }, { packageId: gold.id }]) {
      expect((await api.patch(`/api/members/${m.id}`, body, { token: desk.token })).status).toBe(403);
    }
    expect((await getMember(api, gym.token, m.id)).balance).toBe(9000);
    expect((await api.patch(`/api/members/${m.id}`, { phone: '677999888' }, { token: desk.token })).status).toBe(200);
    expect((await api.patch(`/api/members/${m.id}`, { balance: 0 }, { token: gym.token })).status).toBe(200);
  });

  it('a trainer takes no money, and another gym\'s member is not found', async () => {
    const m = await addMember(api, gym.token, { packageId: gold.id });
    expect((await act(m.id, 'renew', { packageId: gold.id, startDate: today, payments: pay(30000) }, trainer)).status).toBe(403);
    const other = await registerGym(api);
    expect((await act(m.id, 'day-pass', { payments: pay(2000) }, other)).status).toBe(404);
    expect(await paymentsOf(m.id)).toEqual([]);
  });
});
