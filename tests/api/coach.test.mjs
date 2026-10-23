// Coaching (J-10, J-12): a member has at most one coach; a coach taking
// someone on sets their goals and starting measurements in the same step; a
// manager may assign, move or remove; an ended membership is not coached; and
// each kind of progress entry asks for its own things.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode, eventually } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, coachA, coachB, desk;
const GOALS = { goalType: 'lose_weight', goalWeight: 75, goalWaist: 80, goalSessionsPerWeek: 3 };
const BASELINE = { weight: 82.5, waist: 90 };
const assign = (body, who) => api.post('/api/coach/assign', body, { token: who.token });
const takeOn = (member, who, extra = {}) => assign({ memberId: member.id, coachId: who.id, goals: GOALS, baseline: BASELINE, ...extra }, who);
const progress = (member, body, who) => api.post(`/api/coach/progress/${member.id}`, body, { token: who.token });
const client = (extra = {}) => addMember(api, gym.token, { email: `client.${uniqueCode('k')}@example.test`, ...extra });

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  coachA = await addStaff(api, gym, { role: 'trainer', firstName: 'Ana', lastName: 'Coach' });
  coachB = await addStaff(api, gym, { role: 'trainer', firstName: 'Bo', lastName: 'Coach' });
  desk = await addStaff(api, gym, { role: 'front_desk' });
});
afterAll(() => stop());

describe('taking a member on', () => {
  it('needs their goals and starting weight and waist, and saves them together', async () => {
    const m = await client();
    expect((await assign({ memberId: m.id, coachId: coachA.id }, coachA)).status).toBe(400);
    const noWaist = await takeOn(m, coachA, { baseline: { weight: 82 } });
    expect(noWaist.body.field).toBe('baseline.waist');
    expect((await prisma.member.findUnique({ where: { id: m.id } })).coachId).toBeNull();

    const res = await takeOn(m, coachA);
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ coachId: coachA.id, goalType: 'lose_weight', goalWeight: 75, goalSessionsPerWeek: 3 });
    const [start] = await prisma.progressLog.findMany({ where: { memberId: m.id } });
    expect(start).toMatchObject({ kind: 'measure', weight: 82.5, waist: 90, note: 'Starting measurements', staffId: coachA.id });
    // The member is told who their coach is
    expect(await eventually(() => outbox().find(mail => mail.to === m.email && /Ana Coach/.test(mail.html || '')))).toBeTruthy();
  });

  it('takes any figure above zero, with no upper limit', async () => {
    const m = await client();
    const res = await takeOn(m, coachA, { goals: { ...GOALS, goalWeight: 400, goalBodyFat: 90 }, baseline: { weight: 420, waist: 150 } });
    expect(res.status).toBe(200);
    expect((await takeOn(await client(), coachA, { baseline: { weight: 0, waist: 90 } })).body.field).toBe('baseline.weight');
  });

  it('is refused when another coach has them; only their own coach lets them go', async () => {
    const m = await client();
    await takeOn(m, coachA);
    expect((await takeOn(m, coachB)).status).toBe(409);
    expect((await assign({ memberId: m.id, coachId: null }, coachB)).status).toBe(403);
    expect((await assign({ memberId: m.id, coachId: coachB.id }, coachA)).status).toBe(403);
    const letGo = await assign({ memberId: m.id, coachId: null }, coachA);
    expect(letGo.status).toBe(200);
    expect(letGo.body.member.coachId).toBeNull();
  });

  it('by two coaches at the same moment gives the member to one of them, and keeps only that one\'s start', async () => {
    for (let round = 0; round < 3; round += 1) {
      const m = await client();
      const results = await Promise.all([takeOn(m, coachA), takeOn(m, coachB)]);
      expect(results.map(r => r.status).sort()).toEqual([200, 409]);
      const winner = results.find(r => r.status === 200).body.member.coachId;
      expect((await prisma.member.findUnique({ where: { id: m.id } })).coachId).toBe(winner);
      const logs = await prisma.progressLog.findMany({ where: { memberId: m.id } });
      expect(logs.map(l => l.staffId)).toEqual([winner]);
    }
  });

  it('is not the desk\'s to do', async () => {
    const m = await client();
    expect((await assign({ memberId: m.id, coachId: coachA.id }, desk)).status).toBe(403);
  });
});

describe('a manager assigning a coach', () => {
  it('needs no goals, tells the coach, and leaves the goals to them', async () => {
    const m = await client();
    const res = await assign({ memberId: m.id, coachId: coachB.id }, gym);
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ coachId: coachB.id, goalSetAt: null });
    const told = await eventually(async () => (await api.get('/api/notifications', { token: coachB.token })).body.find(n => n.title === 'New client' && n.body.includes(m.lastName)));
    expect(told).toBeTruthy();

    // Their coach sets the goals; the first time, with starting measurements
    expect((await api.put(`/api/coach/goals/${m.id}`, { goals: GOALS }, { token: coachB.token })).body.field).toBe('baseline.weight');
    expect((await api.put(`/api/coach/goals/${m.id}`, { goals: GOALS, baseline: BASELINE }, { token: coachA.token })).status).toBe(403);
    const set = await api.put(`/api/coach/goals/${m.id}`, { goals: GOALS, baseline: BASELINE }, { token: coachB.token });
    expect(set.status).toBe(200);
    expect(set.body.goalSetAt).toBeTruthy();
    // Later changes need no new measurements
    expect((await api.put(`/api/coach/goals/${m.id}`, { goals: { ...GOALS, goalWeight: 72 } }, { token: coachB.token })).status).toBe(200);
  });

  it('may move a member from one coach to another', async () => {
    const m = await client();
    await takeOn(m, coachA);
    const moved = await assign({ memberId: m.id, coachId: coachB.id }, gym);
    expect(moved.body.member.coachId).toBe(coachB.id);
  });
});

describe('an ended membership', () => {
  it('cannot be given a coach or coached, but management may still write on it', async () => {
    const m = await client();
    await takeOn(m, coachA);
    await prisma.member.update({ where: { id: m.id }, data: { status: 'expired' } });
    expect((await takeOn(await prisma.member.findUnique({ where: { id: m.id } }), coachB)).status).toBe(409);
    const fresh = await client();
    await prisma.member.update({ where: { id: fresh.id }, data: { status: 'cancelled' } });
    expect((await takeOn(fresh, coachA)).status).toBe(400);
    expect((await progress(m, { kind: 'note', category: 'general', note: 'Still here?' }, coachA)).status).toBe(403);
    expect((await progress(m, { kind: 'note', category: 'general', note: 'Called them' }, gym)).status).toBe(201);
    // Removing the coach is still fine
    expect((await assign({ memberId: m.id, coachId: null }, gym)).status).toBe(200);
  });
});

describe('progress entries', () => {
  let m;
  beforeAll(async () => { m = await client(); await takeOn(m, coachA); });

  it('a session needs how long, what was worked and how hard', async () => {
    expect((await progress(m, { kind: 'session', focus: ['upper'], effort: 'hard' }, coachA)).body.field).toBe('durationMin');
    expect((await progress(m, { kind: 'session', durationMin: 45, effort: 'hard' }, coachA)).body.field).toBe('focus');
    expect((await progress(m, { kind: 'session', durationMin: 45, focus: ['upper'] }, coachA)).body.field).toBe('effort');
    expect((await progress(m, { kind: 'session', durationMin: 45, focus: ['upper', 'x'.repeat(61)], effort: 'hard' }, coachA)).body.field).toBe('focusOther');
    const ok = await progress(m, { kind: 'session', durationMin: 45, focus: ['upper', 'Boxing, pads'], effort: 'moderate' }, coachA);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ durationMin: 45, focus: 'upper,Boxing  pads', effort: 'moderate' });
  });

  it('a measurement needs at least one figure above zero; a note its topic and text', async () => {
    expect((await progress(m, { kind: 'measure' }, coachA)).body.field).toBe('weight');
    expect((await progress(m, { kind: 'measure', waist: -3 }, coachA)).body.field).toBe('waist');
    expect((await progress(m, { kind: 'measure', weight: '81,5' }, coachA)).status).toBe(400);
    expect((await progress(m, { kind: 'measure', weight: 81.5 }, coachA)).body.weight).toBe(81.5);
    expect((await progress(m, { kind: 'note', category: 'gossip', note: 'x' }, coachA)).body.field).toBe('category');
    expect((await progress(m, { kind: 'note', category: 'injury', note: '' }, coachA)).body.field).toBe('note');
    expect((await progress(m, { kind: 'note', category: 'injury', note: 'Sore knee' }, coachA)).status).toBe(201);
    expect((await progress(m, { kind: 'note', category: 'general', note: 'Later', date: '2099-01-01' }, coachA)).status).toBe(400);
  });

  it('is read by anyone who can open the member, written by coaches and management only', async () => {
    expect((await api.get(`/api/coach/progress/${m.id}`, { token: desk.token })).status).toBe(200);
    expect((await progress(m, { kind: 'note', category: 'general', note: 'From the desk' }, desk)).status).toBe(403);
  });

  it('is removed by whoever wrote it or a manager', async () => {
    const { body: entry } = await progress(m, { kind: 'note', category: 'general', note: 'Remove me' }, coachA);
    expect((await api.del(`/api/coach/progress/entry/${entry.id}`, { token: coachB.token })).status).toBe(403);
    expect((await api.del(`/api/coach/progress/entry/${entry.id}`, { token: coachA.token })).status).toBe(200);
    const { body: second } = await progress(m, { kind: 'note', category: 'general', note: 'Manager removes' }, coachA);
    expect((await api.del(`/api/coach/progress/entry/${second.id}`, { token: gym.token })).status).toBe(200);
  });
});

describe('a coach\'s clients', () => {
  it('are the coach\'s own to read, or a manager\'s, never another coach\'s', async () => {
    const m = await client({ firstName: 'Cleo' });
    await takeOn(m, coachA);
    const own = await api.get(`/api/coach/clients/${coachA.id}`, { token: coachA.token });
    expect(own.status).toBe(200);
    const row = own.body.clients.find(c => c.id === m.id);
    expect(row).toMatchObject({ baseline: { weight: 82.5, waist: 90 }, latestWeight: 82.5, ended: false });
    expect(row).not.toHaveProperty('balance');
    expect((await api.get(`/api/coach/clients/${coachA.id}`, { token: gym.token })).status).toBe(200);
    expect((await api.get(`/api/coach/clients/${coachA.id}`, { token: coachB.token })).status).toBe(403);
    const overview = await api.get('/api/coach/overview?tz=-60', { token: coachA.token });
    expect(overview.body.clients.some(c => c.id === m.id)).toBe(true);
  });
});
