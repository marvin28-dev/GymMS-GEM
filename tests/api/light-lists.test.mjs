// F-099: the sidebar's counts, the Daily Overview and the Dashboard ask for
// only what they show, instead of every member, task and payment the gym has.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, desk, trainer;

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('the members needing attention', () => {
  it('come with the few fields the counts read and nothing else', async () => {
    const m = await addMember(api, gym.token, { balance: 15000 });
    const res = await api.get('/api/members?view=attention', { token: gym.token });
    expect(res.status).toBe(200);
    const row = res.body.find(r => r.id === m.id);
    expect(Object.keys(row).sort()).toEqual(['balance', 'createdAt', 'endDate', 'id', 'isVisitor', 'package', 'pendingApproval', 'startDate', 'status']);
    expect(row.balance).toBe(15000);
  });

  it('carry a request waiting for a manager', async () => {
    const m = await addMember(api, gym.token);
    const asked = await api.post('/api/approvals', { memberId: m.id, action: 'extend_membership', params: { days: 5 }, note: 'Travelled' }, { token: desk.token });
    expect(asked.status).toBe(201);
    const res = await api.get('/api/members?view=attention', { token: desk.token });
    expect(res.body.find(r => r.id === m.id).pendingApproval).toBeTruthy();
  });

  it('have their status brought up to date like the full list', async () => {
    const m = await addMember(api, gym.token);
    await prisma.member.update({ where: { id: m.id }, data: { status: 'active', startDate: new Date(daysFromNow(-40)), endDate: new Date(daysFromNow(-2)) } });
    const res = await api.get('/api/members?view=attention', { token: gym.token });
    expect(res.body.find(r => r.id === m.id).status).toBe('expired');
    expect((await prisma.member.findUnique({ where: { id: m.id } })).status).toBe('expired');
  });

  it('leave out what a member owes for a trainer', async () => {
    const m = await addMember(api, gym.token, { balance: 15000 });
    const res = await api.get('/api/members?view=attention', { token: trainer.token });
    expect(res.status).toBe(200);
    expect(res.body.find(r => r.id === m.id)).not.toHaveProperty('balance');
  });
});

describe('the open tasks', () => {
  it('leave out what is settled and keep to what the caller may see', async () => {
    const gymId = gym.user.gymId;
    const due = new Date(daysFromNow(3));
    const make = (title, status, extra = {}) => prisma.task.create({ data: { gymId, title, category: 'Operations', status, dueDate: due, assignedToId: desk.id, ...extra } });
    await make('Open one', 'todo');
    await make('Under way', 'in_progress');
    await make('Finished', 'done');
    await make('Invite yes', 'accepted', { category: 'Calendar' });
    await make('Invite no', 'declined', { category: 'Calendar' });
    await make('Not the desk\'s', 'todo', { assignedToId: trainer.id });

    const mine = ['Open one', 'Under way', 'Finished', 'Invite yes', 'Invite no', 'Not the desk\'s'];
    const titles = (res) => res.body.map(t => t.title).filter(t => mine.includes(t)).sort();

    const open = await api.get('/api/tasks?open=1', { token: desk.token });
    expect(open.status).toBe(200);
    expect(titles(open)).toEqual(['Open one', 'Under way']);

    const all = await api.get('/api/tasks', { token: desk.token });
    expect(titles(all)).toEqual(['Finished', 'Invite no', 'Invite yes', 'Open one', 'Under way']);
    // The same list as before, less what is settled
    expect(open.body.map(t => t.id).sort()).toEqual(all.body.filter(t => !['Done', 'Accepted', 'Declined'].includes(t.status)).map(t => t.id).sort());
  });
});

describe('the payments of one day', () => {
  // Douala is an hour ahead of UTC; its browsers send tz=-60
  const doualaDay = (ms) => new Date(ms + 3600000).toISOString().slice(0, 10);

  it('are that local day only, newest first; a limit gives the latest few; neither gives everything', async () => {
    const m = await addMember(api, gym.token, { balance: 100000 });
    const ids = [];
    for (const amount of [1000, 2000, 3000, 4000]) {
      const res = await api.post('/api/payments', { memberId: m.id, amount, method: 'cash', type: 'membership' }, { token: gym.token });
      expect(res.status).toBe(201);
      ids.push(res.body.id);
    }
    // The first was taken the day before
    await prisma.payment.update({ where: { id: ids[0] }, data: { createdAt: new Date(Date.now() - 864e5) } });

    const today = await api.get(`/api/payments?date=${doualaDay(Date.now())}&tz=-60`, { token: desk.token });
    expect(today.status).toBe(200);
    expect(today.body.filter(p => p.memberId === m.id).map(p => p.amount)).toEqual([4000, 3000, 2000]);

    const yesterday = await api.get(`/api/payments?date=${doualaDay(Date.now() - 864e5)}&tz=-60`, { token: desk.token });
    expect(yesterday.body.filter(p => p.memberId === m.id).map(p => p.amount)).toEqual([1000]);

    const latest = await api.get('/api/payments?limit=3', { token: desk.token });
    expect(latest.body.map(p => p.id)).toEqual([ids[3], ids[2], ids[1]]);

    const all = await api.get('/api/payments', { token: desk.token });
    expect(all.body.filter(p => p.memberId === m.id)).toHaveLength(4);
  });
});
