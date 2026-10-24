// A clock time can come as "14:30" or as "02:30 PM" (the Attendance page wrote
// the second). The server read only the digits, so every afternoon clock-in
// typed that way was stored twelve hours early and flagged as set by hand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, eventually } from './helpers/fixtures.mjs';

let api, stop, gym;
const day = (offset) => { const d = new Date(Date.now() + offset * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const clockIn = (staffId, date, at) => api.post('/api/timecards/punchin', { staffId, date, at }, { token: gym.token });
const hoursMinutes = (iso) => { const d = new Date(iso); return [d.getHours(), d.getMinutes()]; };

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('clock times', () => {
  it('reads "02:30 PM" as half past two in the afternoon', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const res = await clockIn(worker.id, day(-1), '02:30 PM');
    expect(res.status).toBeLessThan(300);
    expect(hoursMinutes(res.body.punchIn)).toEqual([14, 30]);
  });

  it('reads a 24-hour time as it is', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const res = await clockIn(worker.id, day(-1), '14:30');
    expect(hoursMinutes(res.body.punchIn)).toEqual([14, 30]);
  });

  it('reads 12 AM as just after midnight and 12 PM as just after noon', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const night = await clockIn(worker.id, day(-2), '12:05 AM');
    const noon = await clockIn(worker.id, day(-3), '12:05 PM');
    expect(hoursMinutes(night.body.punchIn)).toEqual([0, 5]);
    expect(hoursMinutes(noon.body.punchIn)).toEqual([12, 5]);
  });
});

// Time cards (J-23): only part-time staff are on the clock, one card a day,
// hand-set times go to a manager's review, a review is answered by someone
// senior, and a shift past midnight ends on the next day.
describe('the clock', () => {
  it('is for part-time staff who are active', async () => {
    const full = await addStaff(api, gym, { employmentType: 'Full Time' });
    expect((await clockIn(full.id, day(0))).status).toBe(400);
    const gone = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    await api.patch(`/api/staff/${gone.id}`, { isActive: false }, { token: gym.token });
    expect((await clockIn(gone.id, day(0))).status).toBe(403);
  });

  it('keeps one card a day, even when two desks clock someone in at once', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    for (const offset of [-4, -11, -12]) {
      const results = await Promise.all([clockIn(worker.id, day(offset), '09:00'), clockIn(worker.id, day(offset), '09:00')]);
      expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    }
    const cards = (await api.get(`/api/timecards?staffId=${worker.id}`, { token: gym.token })).body;
    expect(cards).toHaveLength(3);
  });

  // Postgres may refuse one of two serializable transactions that touch the
  // table at once, even for different people; that is asked again, not a 500
  it('clocks in several people at the same moment', async () => {
    const workers = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 })));
    const results = await Promise.all(workers.map(w => clockIn(w.id, day(-20), '09:00')));
    expect(results.map(r => r.status)).toEqual(workers.map(() => 201));
  });

  it('closes a shift once', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await clockIn(worker.id, day(0));
    const out = await api.patch(`/api/timecards/${card.id}/punchout`, {}, { token: gym.token });
    expect(out.status).toBe(200);
    expect(out.body.punchOut).toBeTruthy();
    expect((await api.patch(`/api/timecards/${card.id}/punchout`, {}, { token: gym.token })).status).toBe(409);
  });
});

describe('a shift past midnight', () => {
  it('entered by hand ends on the next day', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const res = await api.post('/api/timecards', { staffId: worker.id, date: day(-5), punchIn: '22:00', punchOut: '02:00' }, { token: gym.token });
    expect(res.status).toBe(201);
    expect(new Date(res.body.punchOut) - new Date(res.body.punchIn)).toBe(4 * 3600e3);
  });

  it('corrected to an early-morning check-out ends on the next day', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await api.post('/api/timecards', { staffId: worker.id, date: day(-6), punchIn: '22:00', punchOut: '23:30' }, { token: gym.token });
    const res = await api.patch(`/api/timecards/${card.id}/adjust`, { punchOut: '01:30', note: 'Stayed to lock up' }, { token: gym.token });
    expect(res.status).toBe(200);
    expect(new Date(res.body.punchOut) - new Date(res.body.punchIn)).toBe(3.5 * 3600e3);
  });

  it('corrected while being approved ends on the next day', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await api.post('/api/timecards', { staffId: worker.id, date: day(-7), punchIn: '21:00', punchOut: '23:00' }, { token: gym.token });
    const res = await api.patch(`/api/timecards/${card.id}/approve`, { punchOut: '00:30' }, { token: gym.token });
    expect(res.status).toBe(200);
    expect(new Date(res.body.punchOut) - new Date(res.body.punchIn)).toBe(3.5 * 3600e3);
  });
});

describe('a time set by hand', () => {
  it('waits for review, and the review is closed by the answer', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await api.post('/api/timecards', { staffId: worker.id, date: day(-8), punchIn: '09:00', punchOut: '13:00' }, { token: gym.token });
    expect(card.approvalStatus).toBe('pending');
    expect(card.issues.map(i => i.code)).toContain('adjusted');
    const review = await eventually(async () => (await api.get('/api/tasks', { token: gym.token })).body.find(tk => tk.timeCardId === card.id));
    expect(review).toMatchObject({ assignedGroup: 'management', priority: 'High' });
    expect((await api.patch(`/api/timecards/${card.id}/approve`, {}, { token: gym.token })).body.approvalStatus).toBe('approved');
    expect(await eventually(async () => (await api.get('/api/tasks', { token: gym.token })).body.find(tk => tk.id === review.id)?.status === 'Done')).toBe(true);
    expect((await api.patch(`/api/timecards/${card.id}/approve`, {}, { token: gym.token })).status).toBe(409);
  });

  it('rejected, goes back to the times the clock recorded', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await clockIn(worker.id, day(0));
    await api.patch(`/api/timecards/${card.id}/punchout`, {}, { token: gym.token });
    const edited = await api.patch(`/api/timecards/${card.id}/adjust`, { punchIn: '00:01', note: 'Came in early' }, { token: gym.token });
    expect(edited.body.approvalStatus).toBe('pending');
    const res = await api.patch(`/api/timecards/${card.id}/reject`, { note: 'They did not' }, { token: gym.token });
    expect(res.body).toMatchObject({ approvalStatus: 'approved', punchIn: card.punchIn });
  });

  it('is reviewed by someone senior: not the desk, and not a manager on their own card while another can', async () => {
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const { body: card } = await api.post('/api/timecards', { staffId: worker.id, date: day(-10), punchIn: '09:00', punchOut: '11:00' }, { token: gym.token });
    expect((await api.patch(`/api/timecards/${card.id}/approve`, {}, { token: desk.token })).status).toBe(403);

    const manager = await addStaff(api, gym, { role: 'manager', employmentType: 'Part Time', salary: 1000 });
    await addStaff(api, gym, { role: 'manager' });
    const { body: own } = await api.post('/api/timecards', { staffId: manager.id, date: day(-10), punchIn: '09:00', punchOut: '11:00' }, { token: manager.token });
    expect((await api.patch(`/api/timecards/${own.id}/approve`, {}, { token: manager.token })).status).toBe(403);
    expect((await api.patch(`/api/timecards/${own.id}/approve`, {}, { token: gym.token })).status).toBe(200);
  });
});

describe("the desk's shift prompt", () => {
  it("starts a part-time desk employee's shift once and ends it after the day's report", async () => {
    const desk = await addStaff(api, gym, { role: 'front_desk', employmentType: 'Part Time', salary: 1000 });
    const shift = async () => (await api.get(`/api/timecards/shift?staffId=${desk.id}`, { token: desk.token })).body;
    expect(await shift()).toMatchObject({ clockable: true, state: 'none' });
    expect((await api.post('/api/timecards/shift/start', { staffId: desk.id }, { token: desk.token })).status).toBe(201);
    expect((await shift()).state).toBe('in');
    expect((await api.post('/api/timecards/shift/start', { staffId: desk.id }, { token: desk.token })).status).toBe(409);
    const end = await api.post('/api/timecards/end-of-day', { staffId: desk.id }, { token: desk.token });
    expect(end.body.clockedOut.map(c => c.staffId)).toEqual([desk.id]);
    expect((await shift()).state).toBe('done');
  });

  it('is not offered to someone full time', async () => {
    const desk = await addStaff(api, gym, { role: 'front_desk', employmentType: 'Full Time' });
    expect((await api.get(`/api/timecards/shift?staffId=${desk.id}`, { token: desk.token })).body).toEqual({ clockable: false });
  });
});

// F-173 (e): anyone could read anyone's time card history. The day's list
// (the Attendance page) and the desk's open shifts stay open; a history is
// the person's own, or management's
describe('who may read time cards', () => {
  it('keeps a person\'s history to them and management, and the day\'s list to everyone', async () => {
    const worker = await addStaff(api, gym, { employmentType: 'Part Time', salary: 1000 });
    const trainer = await addStaff(api, gym, { role: 'trainer', employmentType: 'Part Time', salary: 1000 });
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const { body: card } = await clockIn(worker.id, day(-30), '09:00');
    await clockIn(trainer.id, day(-31), '09:00');
    const read = (query, who) => api.get(`/api/timecards?${query}`, { token: who.token });

    expect((await read(`staffId=${worker.id}`, trainer)).status).toBe(403);
    const own = await read('', trainer);
    expect(own.status).toBe(200);
    expect(own.body.length).toBeGreaterThan(0);
    expect(own.body.every(c => c.staffId === trainer.id)).toBe(true);

    expect((await read(`date=${day(-30)}`, trainer)).body.some(c => c.id === card.id)).toBe(true);
    expect((await read(`staffId=${worker.id}&openOnly=true`, desk)).status).toBe(200);
    expect((await read(`staffId=${worker.id}`, worker)).body.some(c => c.id === card.id)).toBe(true);
    expect((await read(`staffId=${worker.id}`, gym)).body.some(c => c.id === card.id)).toBe(true);
  });
});
