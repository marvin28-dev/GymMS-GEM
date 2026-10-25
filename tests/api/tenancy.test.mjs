// One gym can never reach into another, and a request body only ever sets the
// fields it is meant to.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember, eventually } from './helpers/fixtures.mjs';

let api, stop, gymA, gymB;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gymA = await registerGym(api);
  gymB = await registerGym(api);
});
afterAll(() => stop());

describe('checking a visit out', () => {
  it('is refused for a visit in another gym, which is left untouched', async () => {
    const member = await addMember(api, gymA.token);
    const visit = await api.post('/api/attendance/checkin', { memberId: member.id }, { token: gymA.token });
    expect(visit.status).toBe(201);
    const res = await api.patch(`/api/attendance/${visit.body.id}/checkout`, {}, { token: gymB.token });
    expect(res.status).toBe(404);
    const list = await api.get('/api/attendance', { token: gymA.token });
    expect(list.body.find(v => v.id === visit.body.id).checkOut).toBeNull();
  });

  it('answers 404, not 500, for a visit that does not exist', async () => {
    expect((await api.patch('/api/attendance/no-such-visit/checkout', {}, { token: gymA.token })).status).toBe(404);
  });

  it('still checks out a visit in the same gym', async () => {
    const member = await addMember(api, gymA.token);
    const visit = await api.post('/api/attendance/checkin', { memberId: member.id }, { token: gymA.token });
    const res = await api.patch(`/api/attendance/${visit.body.id}/checkout`, {}, { token: gymA.token });
    expect(res.status).toBe(200);
    expect(res.body.checkOut).toEqual(expect.any(String));
  });
});

describe('equipment issues', () => {
  const report = (body, token = gymA.token) => api.post('/api/equipment', { equipment: 'Treadmill 3', description: 'Belt slips', severity: 'high', ...body }, { token });

  it('reports an issue with what the form sends', async () => {
    const res = await report({ location: 'Cardio zone' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ equipment: 'Treadmill 3', location: 'Cardio zone', severity: 'high', status: 'open' });
  });

  it('raises a maintenance task for management, as urgent as the fault, and tells the managers', async () => {
    await report({ equipment: 'Rowing machine 2', severity: 'critical', location: 'Floor 1' });
    const task = await eventually(async () => (await api.get('/api/tasks', { token: gymA.token })).body.find(tk => tk.title === 'Fix: Rowing machine 2'));
    expect(task).toMatchObject({ category: 'Equipment Maintenance', assignedGroup: 'management', priority: 'High' });
    expect(task.dueDate).toBeTruthy();
    const told = await eventually(async () => (await api.get('/api/notifications', { token: gymA.token })).body.find(n => n.title === 'New maintenance task' && n.body.includes('Rowing machine 2')));
    expect(told).toBeTruthy();
  });

  it('refuses an issue with no equipment or no description, with the field named', async () => {
    expect((await report({ equipment: '' })).body.field).toBe('equipment');
    expect((await report({ description: ' ' })).body.field).toBe('description');
    expect((await report({ equipment: '' })).status).toBe(400);
  });

  it('cannot be filed in another gym, or marked resolved from the start', async () => {
    const res = await report({ gymId: gymB.user.gymId, status: 'resolved' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect((await api.get('/api/equipment', { token: gymB.token })).body.some(i => i.id === res.body.id)).toBe(false);
  });

  it('cannot be moved into another gym by an update', async () => {
    const issue = (await report()).body;
    const res = await api.patch(`/api/equipment/${issue.id}`, { gymId: gymB.user.gymId, status: 'in_progress' }, { token: gymA.token });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect((await api.get('/api/equipment', { token: gymA.token })).body.some(i => i.id === issue.id)).toBe(true);
    expect((await api.get('/api/equipment', { token: gymB.token })).body.some(i => i.id === issue.id)).toBe(false);
  });

  it('records when an issue was resolved, and forgets it if it is reopened', async () => {
    const issue = (await report()).body;
    const done = await api.patch(`/api/equipment/${issue.id}`, { status: 'resolved' }, { token: gymA.token });
    expect(done.body.resolvedAt).toEqual(expect.any(String));
    const reopened = await api.patch(`/api/equipment/${issue.id}`, { status: 'open' }, { token: gymA.token });
    expect(reopened.body.resolvedAt).toBeNull();
  });

  it('refuses a status or severity it does not know', async () => {
    const issue = (await report()).body;
    expect((await api.patch(`/api/equipment/${issue.id}`, { status: 'binned' }, { token: gymA.token })).status).toBe(400);
    expect((await report({ severity: 'apocalyptic' })).status).toBe(400);
  });
});

describe('packages', () => {
  const create = (body) => api.post('/api/packages', { name: `Gold ${Math.random().toString(36).slice(2, 7)}`, price: 15000, dayPassPrice: 2000, duration: '1 Months', durationDays: 30, ...body }, { token: gymA.token });

  it('cannot be moved into another gym by an update, and unknown fields are ignored', async () => {
    const pkg = (await create()).body;
    const res = await api.patch(`/api/packages/${pkg.id}`, { gymId: gymB.user.gymId, price: 17000, notes: 'not a column' }, { token: gymA.token });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(17000);
    expect((await api.get('/api/packages', { token: gymA.token })).body.some(p => p.id === pkg.id)).toBe(true);
    expect((await api.get('/api/packages', { token: gymB.token })).body.some(p => p.id === pkg.id)).toBe(false);
  });

  it('refuses a package with no name, a price that is not a number, or a monthly one with no day pass price', async () => {
    expect((await create({ name: '' })).body.field).toBe('name');
    expect((await create({ price: 'free' })).body.field).toBe('price');
    expect((await create({ dayPassPrice: undefined })).body.field).toBe('dayPassPrice');
  });

  it('accepts a visitor bundle without a day pass price', async () => {
    const res = await create({ isVisitor: true, dayPassPrice: undefined, sessions: '10', price: 20000 });
    expect(res.status).toBe(201);
  });

  // D-22: deleting a package took it off every member on it
  it('is not deleted while members are on it, and they keep it; set Inactive it stays theirs', async () => {
    const pkg = (await create()).body;
    const member = await addMember(api, gymA.token, { packageId: pkg.id });
    const refused = await api.del(`/api/packages/${pkg.id}`, { token: gymA.token });
    expect(refused.status).toBe(409);
    expect(refused.body.members).toBe(1);
    expect((await api.get(`/api/members/${member.id}`, { token: gymA.token })).body.packageId).toBe(pkg.id);
    expect((await api.patch(`/api/packages/${pkg.id}`, { status: 'inactive' }, { token: gymA.token })).status).toBe(200);
    expect((await api.get(`/api/members/${member.id}`, { token: gymA.token })).body.packageId).toBe(pkg.id);

    const unused = (await create()).body;
    expect((await api.del(`/api/packages/${unused.id}`, { token: gymA.token })).status).toBe(200);
  });
});
