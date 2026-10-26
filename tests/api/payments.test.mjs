import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember, getMember, addStaff } from './helpers/fixtures.mjs';

let api, stop, gym, prisma;
const pay = (memberId, body = {}) => api.post('/api/payments', { memberId, amount: 5000, method: 'cash', type: 'membership', ...body }, { token: gym.token });

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('a payment without a member', () => {
  it('is refused, and nobody else is charged or credited', async () => {
    const owing = await addMember(api, gym.token, { balance: 20000 });
    const res = await api.post('/api/payments', { amount: 5000, method: 'cash', type: 'membership' }, { token: gym.token });
    expect(res.status).toBe(400);
    expect((await getMember(api, gym.token, owing.id)).balance).toBe(20000);
  });
});

describe('recording a payment', () => {
  it('pays the debt down and keeps its reference and the balance it leaves', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const res = await pay(m.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ amount: 5000, method: 'cash', type: 'membership', balanceAfter: 15000 });
    expect(res.body.reference).toMatch(/^TXN-/);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(15000);
  });

  // The Payments page adds the reply to its list at once; without the member
  // its row read "-" until the list was next loaded
  it('comes back with who paid and who took it, as the list shows it', async () => {
    const m = await addMember(api, gym.token, { firstName: 'Nadia', lastName: 'Named', balance: 10000 });
    const res = await pay(m.id);
    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ id: m.id, firstName: 'Nadia', lastName: 'Named' });
    expect(res.body.staff).toMatchObject({ id: gym.user.id });
    const listed = (await api.get('/api/payments', { token: gym.token })).body.find(p => p.id === res.body.id);
    expect(Object.keys(res.body.member).sort()).toEqual(Object.keys(listed.member).sort());
  });

  it('loses no payment when several are taken for one member at the same moment', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => pay(m.id, { amount: 1000 })));
    expect(results.map(r => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(15000);
    expect(results.map(r => r.body.balanceAfter).sort((a, b) => a - b)).toEqual([15000, 16000, 17000, 18000, 19000]);
  });

  it.each([['Infinity'], ['abc'], [-500], [0]])('refuses an amount of %s', async (amount) => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const res = await pay(m.id, { amount });
    expect(res.status).toBe(400);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
  });

  it('never takes more than is owed when the payment is towards the balance', async () => {
    const m = await addMember(api, gym.token, { balance: 3000 });
    expect((await pay(m.id, { amount: 5000, towardBalance: true })).status).toBe(400);
  });

  it('leaves the balance alone for a pass or a registration fee', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    await pay(m.id, { type: 'product', amount: 2000 });
    await pay(m.id, { type: 'registration', amount: 3000 });
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
  });
});

describe('undoing a payment', () => {
  it('puts a membership payment back on what the member owes', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const p = await pay(m.id);
    expect((await api.del(`/api/payments/${p.body.id}`, { token: gym.token })).status).toBe(200);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
  });

  it('puts every undone payment back when several are undone at once', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const made = [];
    for (let i = 0; i < 4; i++) made.push((await pay(m.id, { amount: 1000 })).body.id);
    await Promise.all(made.map(id => api.del(`/api/payments/${id}`, { token: gym.token })));
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
  });

  // D-21: the desk could delete any payment, however old and whoever took it
  it('lets the desk take back only its own payment from the last 15 minutes', async () => {
    const desk = await addStaff(api, gym);
    const other = await addStaff(api, gym);
    const m = await addMember(api, gym.token, { balance: 20000 });
    const asDesk = (id) => api.del(`/api/payments/${id}`, { token: desk.token });
    const take = (who) => api.post('/api/payments', { memberId: m.id, amount: 1000, method: 'cash', type: 'membership' }, { token: who.token });

    const own = await take(desk);
    expect((await asDesk(own.body.id)).status).toBe(200);

    const theirs = await take(other);
    const refused = await asDesk(theirs.body.id);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatch(/manager/);

    const old = await take(desk);
    await prisma.payment.update({ where: { id: old.body.id }, data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) } });
    expect((await asDesk(old.body.id)).status).toBe(403);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(18000);

    expect((await api.del(`/api/payments/${theirs.body.id}`, { token: gym.token })).status).toBe(200);
    expect((await api.del(`/api/payments/${old.body.id}`, { token: gym.token })).status).toBe(200);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
  });
});

// D-27: the Payments page asked for a date and the server never read it; a
// manager may now date money taken on an earlier day, nobody else
describe('the day a payment was taken', () => {
  const tz = -60;
  const localDay = (ms) => new Date(ms - tz * 60000).toISOString().slice(0, 10);
  const daysAgo = (n) => localDay(Date.now() - n * 864e5);

  it('is the day a manager gives, at midday, within the last 90 days and never ahead', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const res = await pay(m.id, { paidOn: daysAgo(3), tz });
    expect(res.status).toBe(201);
    expect(localDay(new Date(res.body.createdAt).getTime())).toBe(daysAgo(3));
    expect(new Date(res.body.createdAt).getUTCHours()).toBe(11);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(15000);

    for (const paidOn of [daysAgo(-1), daysAgo(100), '03/10/2026']) {
      const refused = await pay(m.id, { paidOn, tz });
      expect(refused.status).toBe(400);
      expect(refused.body.field).toBe('paidOn');
    }
    expect((await getMember(api, gym.token, m.id)).balance).toBe(15000);
  });

  it("is today's for the desk, which cannot choose another day", async () => {
    const desk = await addStaff(api, gym);
    const m = await addMember(api, gym.token, { balance: 20000 });
    const asDesk = (body) => api.post('/api/payments', { memberId: m.id, amount: 1000, method: 'cash', type: 'membership', tz, ...body }, { token: desk.token });
    const refused = await asDesk({ paidOn: daysAgo(1) });
    expect(refused.status).toBe(403);
    expect(refused.body.field).toBe('paidOn');
    const today = await asDesk({ paidOn: daysAgo(0) });
    expect(today.status).toBe(201);
    expect(Date.now() - new Date(today.body.createdAt).getTime()).toBeLessThan(60000);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(19000);
  });
});

// D-54: a payment method the app does not know was filed as cash, so the drawer
// counted money that came in another way
describe('how a payment was made', () => {
  it('refuses a method the app does not know, and takes no method as cash', async () => {
    const m = await addMember(api, gym.token, { balance: 20000 });
    const odd = await pay(m.id, { method: 'Bitcoin' });
    expect(odd.status).toBe(400);
    expect(odd.body.field).toBe('method');
    expect((await getMember(api, gym.token, m.id)).balance).toBe(20000);
    const none = await api.post('/api/payments', { memberId: m.id, amount: 1000, type: 'membership' }, { token: gym.token });
    expect(none.status).toBe(201);
    expect(none.body.method).toBe('cash');
    expect((await pay(m.id, { method: 'Mobile Money', amount: 1000 })).body.method).toBe('mobile_money');
  });
});
