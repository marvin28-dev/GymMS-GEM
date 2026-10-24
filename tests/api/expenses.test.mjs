import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, daysFromNow, eventually } from './helpers/fixtures.mjs';

let api, stop, gym, desk;
const spend = (body, token = gym.token) => api.post('/api/expenses', { title: 'Electricity', category: 'Utilities', amount: 25000, date: daysFromNow(0), paidTo: 'ENEO', method: 'cash', ...body }, { token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
});
afterAll(() => stop());

describe('recording an expense', () => {
  it('books one entered by management straight into the books', async () => {
    const res = await spend({});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Electricity', amount: 25000, paidTo: 'ENEO', approvalStatus: 'approved' });
  });

  it.each([['abc'], ['Infinity'], [-5], [0], [null]])('refuses an amount of %s, naming the field', async (amount) => {
    const res = await spend({ amount });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('amount');
  });

  it('refuses an expense with no title, no date, or nobody it was paid to', async () => {
    expect((await spend({ title: ' ' })).body.field).toBe('title');
    expect((await spend({ date: undefined })).body.field).toBe('date');
    expect((await spend({ date: 'yesterday-ish' })).body.field).toBe('date');
    const noPayee = await spend({ paidTo: '' });
    expect(noPayee.status).toBe(400);
    expect(noPayee.body).toMatchObject({ error: 'Paid to is required', field: 'paidTo' });
  });
});

describe('the front desk', () => {
  it('sends an expense within its limit for review, out of the books until a manager looks', async () => {
    const res = await spend({ title: 'Cleaning products', amount: 8000, source: 'frontdesk' }, desk.token);
    expect(res.status).toBe(201);
    expect(res.body.approvalStatus).toBe('pending');
    expect((await api.get('/api/expenses', { token: gym.token })).body.some(e => e.id === res.body.id)).toBe(false);
    expect((await api.patch(`/api/expenses/${res.body.id}/approve`, {}, { token: gym.token })).status).toBe(200);
    expect((await api.get('/api/expenses', { token: gym.token })).body.some(e => e.id === res.body.id)).toBe(true);
  });

  it('tells the managers it needs review, and tells the desk once it is reviewed; only management reviews', async () => {
    const notes = async (who) => (await api.get('/api/notifications', { token: who.token })).body;
    const res = await spend({ title: 'Light bulbs', amount: 3000, source: 'frontdesk' }, desk.token);
    expect(await eventually(async () => (await notes(gym)).some(n => n.title === 'Expense needs review' && n.body.includes('Light bulbs')))).toBe(true);
    expect((await api.patch(`/api/expenses/${res.body.id}/approve`, {}, { token: desk.token })).status).toBe(403);
    expect((await api.patch(`/api/expenses/${res.body.id}/approve`, {}, { token: gym.token })).status).toBe(200);
    expect(await eventually(async () => (await notes(desk)).some(n => n.title === 'Expense reviewed'))).toBe(true);
  });

  it('cannot log anything over the gym limit', async () => {
    expect((await spend({ amount: 60000, source: 'frontdesk' }, desk.token)).status).toBe(400);
  });
});

describe('changing an expense', () => {
  it('changes only what is sent', async () => {
    const made = (await spend({ title: 'Water bill', category: 'Utilities', amount: 12000 })).body;
    const res = await api.patch(`/api/expenses/${made.id}`, { note: 'Paid at the agency' }, { token: gym.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Water bill', category: 'Utilities', amount: 12000, note: 'Paid at the agency' });
  });

  it('refuses an amount that is not a number', async () => {
    const made = (await spend({})).body;
    const res = await api.patch(`/api/expenses/${made.id}`, { amount: 'lots' }, { token: gym.token });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('amount');
  });
});

describe('how an expense was paid', () => {
  it('refuses a method the app does not know (D-54)', async () => {
    const res = await spend({ method: 'Bitcoin' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('method');
  });
});
