import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, getMember, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, gym, desk, coach;
const checkIn = (body, token = desk.token) => api.post('/api/attendance/checkin', body, { token });
const visitor = (passes = 5) => addMember(api, gym.token, {
  isVisitor: true, status: 'visitor', passesTotal: passes, passesRemaining: passes, endDate: daysFromNow(30),
  initialPayment: { amount: 10000, method: 'cash' },
});

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  coach = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('checking a member in', () => {
  it('spends one pass for a visitor, and refuses a second check-in within 30 minutes without spending another', async () => {
    const v = await visitor(5);
    const first = await checkIn({ memberId: v.id });
    expect(first.status).toBe(201);
    expect(first.body.kind).toBe('visitor_pass');
    expect(first.body.member.passesRemaining).toBe(4);
    const again = await checkIn({ memberId: v.id });
    expect(again.status).toBe(409);
    expect(again.body.alreadyCheckedIn).toBe(true);
    expect((await getMember(api, gym.token, v.id)).passesRemaining).toBe(4);
  });

  it('spends one pass when the same visitor is checked in twice at the same moment', async () => {
    const v = await visitor(5);
    const results = await Promise.all([checkIn({ memberId: v.id }), checkIn({ memberId: v.id }), checkIn({ memberId: v.id })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409, 409]);
    expect((await getMember(api, gym.token, v.id)).passesRemaining).toBe(4);
    const visits = (await api.get('/api/attendance', { token: desk.token })).body.filter(a => a.member?.id === v.id);
    expect(visits).toHaveLength(1);
  });

  it('checks a member in by their check-in code', async () => {
    const m = await addMember(api, gym.token, { accessCode: '7351' });
    const res = await checkIn({ accessCode: '7351' });
    expect(res.status).toBe(201);
    expect(res.body.member.id).toBe(m.id);
  });
});

describe('what the attendance list gives away', () => {
  it('never includes a member\'s check-in code', async () => {
    const m = await addMember(api, gym.token, { accessCode: '6248' });
    await checkIn({ memberId: m.id });
    const list = await api.get('/api/attendance', { token: desk.token });
    const visit = list.body.find(a => a.member?.id === m.id);
    expect(visit).toBeTruthy();
    expect(visit.member.accessCode).toBeUndefined();
  });

  it('gives a coach no balances', async () => {
    const m = await addMember(api, gym.token, { balance: 15000 });
    await checkIn({ memberId: m.id });
    const list = await api.get('/api/attendance', { token: coach.token });
    const visit = list.body.find(a => a.member?.id === m.id);
    expect(visit).toBeTruthy();
    expect(visit.member.balance).toBeUndefined();
    expect(visit.balanceAtCheckIn).toBeUndefined();
  });
});

describe('guessing codes at the desk', () => {
  it('stops an account after 10 unknown codes in a row of tries', async () => {
    const guesser = await addStaff(api, gym, { role: 'front_desk' });
    for (let i = 0; i < 10; i++) {
      const res = await checkIn({ accessCode: String(9000 + i) }, guesser.token);
      expect(res.status).toBe(404);
    }
    const locked = await checkIn({ accessCode: '9999' }, guesser.token);
    expect(locked.status).toBe(429);
    // Finding a member by name still works
    const m = await addMember(api, gym.token);
    expect((await checkIn({ memberId: m.id }, guesser.token)).status).toBe(201);
  });
});
