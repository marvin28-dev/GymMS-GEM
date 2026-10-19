import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

let api, stop, gym;
const issue = (staffId, month) => api.post('/api/payroll', { staffId, month }, { token: gym.token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
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
