import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, getMember, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, gym, desk;
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const apply = (memberId, action, params, token = gym.token) => api.post('/api/approvals/apply', { memberId, action, params }, { token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
});
afterAll(() => stop());

describe('a request without a member', () => {
  it('is refused instead of being applied to some other member', async () => {
    const bystander = await addMember(api, gym.token);
    const res = await api.post('/api/approvals/apply', { action: 'cancel_membership', params: {} }, { token: gym.token });
    expect(res.status).toBe(400);
    expect((await getMember(api, gym.token, bystander.id)).status).not.toBe('cancelled');
  });

  it('is refused when the desk asks for one too', async () => {
    const res = await api.post('/api/approvals', { action: 'extend_membership', params: { days: 5 }, note: 'please' }, { token: desk.token });
    expect(res.status).toBe(400);
  });
});

describe('what each action does', () => {
  it('extends an active membership by whole days', async () => {
    const m = await addMember(api, gym.token, { endDate: daysFromNow(20) });
    const res = await apply(m.id, 'extend_membership', { days: 10 });
    expect(res.status).toBe(200);
    expect(day(res.body.member.endDate)).toBe(daysFromNow(30));
    expect(res.body.member.status).toBe('active');
  });

  it('freezes, then unfreezes with the frozen days added back', async () => {
    const m = await addMember(api, gym.token, { endDate: daysFromNow(20) });
    const frozen = await apply(m.id, 'freeze_membership', { days: 7 });
    expect(frozen.status).toBe(200);
    expect(frozen.body.member).toMatchObject({ status: 'frozen' });
    expect(day(frozen.body.member.preFreezEndDate)).toBe(daysFromNow(20));
    const back = await apply(m.id, 'unfreeze_membership', {});
    expect(back.status).toBe(200);
    expect(back.body.member).toMatchObject({ status: 'active', freezeStartDate: null, preFreezEndDate: null });
    expect(day(back.body.member.endDate)).toBe(daysFromNow(20));
  });

  it('keeps a frozen membership frozen when it is extended, and keeps the extra days for the unfreeze', async () => {
    const m = await addMember(api, gym.token, { endDate: daysFromNow(20) });
    await apply(m.id, 'freeze_membership', { days: 7 });
    const res = await apply(m.id, 'extend_membership', { days: 10 });
    expect(res.status).toBe(200);
    expect(res.body.member.status).toBe('frozen');
    expect(day(res.body.member.preFreezEndDate)).toBe(daysFromNow(30));
    const back = await apply(m.id, 'unfreeze_membership', {});
    expect(day(back.body.member.endDate)).toBe(daysFromNow(30));
  });
});

describe('actions that do not fit the member', () => {
  it('refuses to freeze a membership that is already frozen', async () => {
    const m = await addMember(api, gym.token);
    await apply(m.id, 'freeze_membership', { days: 7 });
    const res = await apply(m.id, 'freeze_membership', { days: 7 });
    expect(res.status).toBe(409);
  });

  it('refuses to unfreeze a membership that is not frozen (it used to reactivate a cancelled one)', async () => {
    const m = await addMember(api, gym.token);
    await apply(m.id, 'cancel_membership', {});
    const res = await apply(m.id, 'unfreeze_membership', {});
    expect(res.status).toBe(409);
    expect((await getMember(api, gym.token, m.id)).status).toBe('cancelled');
  });

  it('refuses to cancel twice, or to extend a cancelled membership', async () => {
    const m = await addMember(api, gym.token);
    await apply(m.id, 'cancel_membership', {});
    expect((await apply(m.id, 'cancel_membership', {})).status).toBe(409);
    expect((await apply(m.id, 'extend_membership', { days: 5 })).status).toBe(409);
  });

  it('refuses to convert someone who is already a visitor', async () => {
    const m = await addMember(api, gym.token);
    expect((await apply(m.id, 'convert_to_visitor', {})).status).toBe(200);
    expect((await apply(m.id, 'convert_to_visitor', {})).status).toBe(409);
  });
});

describe('the number of days', () => {
  it.each([[-30], [0], [1.5], [99999], ['ten'], [null]])('refuses %s days', async (days) => {
    const m = await addMember(api, gym.token, { endDate: daysFromNow(20) });
    const res = await apply(m.id, 'extend_membership', { days });
    expect(res.status).toBe(400);
    expect(day((await getMember(api, gym.token, m.id)).endDate)).toBe(daysFromNow(20));
  });

  it('refuses a freeze start date that is not a date', async () => {
    const m = await addMember(api, gym.token);
    const res = await apply(m.id, 'freeze_membership', { days: 7, startDate: 'someday' });
    expect(res.status).toBe(400);
  });
});

describe('a request from the desk', () => {
  it('gets through for several members sent at the same moment', async () => {
    const members = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => addMember(api, gym.token)));
    const results = await Promise.all(members.map(m => api.post('/api/approvals', { memberId: m.id, action: 'extend_membership', params: { days: 3 }, note: 'Busy morning' }, { token: desk.token })));
    expect(results.map(r => r.status)).toEqual(members.map(() => 201));
  });

  it('is applied once, even when two managers approve it at the same moment', async () => {
    const m = await addMember(api, gym.token, { endDate: daysFromNow(20) });
    const asked = await api.post('/api/approvals', { memberId: m.id, action: 'extend_membership', params: { days: 10 }, note: 'Travelled for work' }, { token: desk.token });
    expect(asked.status).toBe(201);
    const [a, b] = await Promise.all([
      api.post(`/api/approvals/${asked.body.id}/approve`, {}, { token: gym.token }),
      api.post(`/api/approvals/${asked.body.id}/approve`, {}, { token: gym.token }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(day((await getMember(api, gym.token, m.id)).endDate)).toBe(daysFromNow(30));
  });

  it('cannot be approved once it no longer fits, and stays waiting so it can be declined', async () => {
    const m = await addMember(api, gym.token);
    const asked = await api.post('/api/approvals', { memberId: m.id, action: 'freeze_membership', params: { days: 7 }, note: 'Injured' }, { token: desk.token });
    await apply(m.id, 'freeze_membership', { days: 7 });
    const res = await api.post(`/api/approvals/${asked.body.id}/approve`, {}, { token: gym.token });
    expect(res.status).toBe(409);
    const list = await api.get(`/api/approvals/member/${m.id}`, { token: gym.token });
    expect(list.body.find(r => r.id === asked.body.id).status).toBe('pending');
    expect((await api.post(`/api/approvals/${asked.body.id}/reject`, {}, { token: gym.token })).status).toBe(200);
  });
});
