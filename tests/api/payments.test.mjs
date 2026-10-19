import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember, getMember } from './helpers/fixtures.mjs';

let api, stop, gym;
const pay = (memberId, body = {}) => api.post('/api/payments', { memberId, amount: 5000, method: 'cash', type: 'membership', ...body }, { token: gym.token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
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
});
