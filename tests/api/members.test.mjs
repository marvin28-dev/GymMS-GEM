import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember, uniqueCode, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, gym, feeGym;
const newMember = (token, body) => api.post('/api/members', { firstName: 'Ngo', lastName: `Member ${uniqueCode('n')}`, city: 'Douala', region: 'Littoral', startDate: daysFromNow(0), ...body }, { token });
const paymentsOf = async (token, memberId) => (await api.get('/api/payments', { token })).body.filter(p => p.memberId === memberId);

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  feeGym = await registerGym(api);
  const set = await api.patch('/api/gyms/me', { registrationFeeRequired: true, registrationFee: 5000 }, { token: feeGym.token });
  expect(set.status).toBe(200);
});
afterAll(() => stop());

describe('adding members', () => {
  it('gives every member their own code, even when several are added at the same moment', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => newMember(gym.token)));
    expect(results.map(r => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    const codes = results.map(r => r.body.memberCode);
    expect(new Set(codes).size).toBe(6);
    codes.forEach(c => expect(c).toMatch(/^GEM-\d{4,}$/));
    const checkIn = results.map(r => r.body.accessCode);
    expect(new Set(checkIn).size).toBe(6);
  });

  it('refuses a check-in code another member already has, naming the field', async () => {
    const first = await addMember(api, gym.token, { accessCode: '4821' });
    expect(first.accessCode).toBe('4821');
    const res = await newMember(gym.token, { accessCode: '4821' });
    expect(res.status).toBe(409);
    expect(res.body.field).toBe('accessCode');
  });

  it('refuses a balance below zero: the gym never owes a member', async () => {
    const res = await newMember(gym.token, { balance: -5000 });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('balance');
  });
});

describe('the money taken when someone is added', () => {
  it('records the registration fee with the new member, and stamps when it was paid', async () => {
    const res = await newMember(feeGym.token, { regFeeMethod: 'mobile_money' });
    expect(res.status).toBe(201);
    expect(res.body.regFeeDate).toEqual(expect.any(String));
    const paid = await paymentsOf(feeGym.token, res.body.id);
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ amount: 5000, type: 'registration', method: 'mobile_money' });
    expect(paid[0].reference).toMatch(/^TXN-/);
  });

  it('refuses a new member when the gym charges a registration fee and none was collected', async () => {
    expect((await newMember(feeGym.token, {})).status).toBe(400);
  });

  it('records a visitor and their first payment together', async () => {
    const res = await newMember(gym.token, { isVisitor: true, status: 'visitor', passesTotal: 5, passesRemaining: 5, initialPayment: { amount: 10000, method: 'cash', description: 'Visitor bundle' } });
    expect(res.status).toBe(201);
    const paid = await paymentsOf(gym.token, res.body.id);
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ amount: 10000, type: 'product' });
  });

  it.each([['Infinity'], [0], ['ten']])('adds no visitor when the first payment is %s', async (amount) => {
    const lastName = `Visitor ${uniqueCode('v')}`;
    const res = await newMember(gym.token, { lastName, isVisitor: true, status: 'visitor', initialPayment: { amount, method: 'cash' } });
    expect(res.status).toBe(400);
    const all = await api.get('/api/members', { token: gym.token });
    expect(all.body.some(m => m.lastName === lastName)).toBe(false);
  });
});
