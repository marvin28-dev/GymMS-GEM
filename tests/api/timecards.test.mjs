// A clock time can come as "14:30" or as "02:30 PM" (the Attendance page wrote
// the second). The server read only the digits, so every afternoon clock-in
// typed that way was stored twelve hours early and flagged as set by hand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

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
