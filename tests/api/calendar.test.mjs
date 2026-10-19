import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, gym, trainer;
const tomorrow = daysFromNow(1);
const book = (body, token = gym.token) => api.post('/api/calendar', { title: 'Yoga', date: tomorrow, time: '07:00', duration: '08:00', ...body }, { token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('dates a booking cannot use', () => {
  // These used to loop forever and run the server out of memory
  it('refuses a repeating entry whose last date cannot be read, at once', async () => {
    const res = await book({ repeat: 'Daily', repeatUntil: 'not a date' }, trainer.token);
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('repeatUntil');
  });

  it('refuses a first date that cannot be read', async () => {
    const res = await book({ date: 'someday', repeat: 'Daily', repeatUntil: daysFromNow(10) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('date');
  });

  it('refuses a series that ends before it starts', async () => {
    const res = await book({ date: daysFromNow(5), repeat: 'Weekly', repeatUntil: daysFromNow(2) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('repeatUntil');
  });

  it('refuses a series longer than a year instead of writing thousands of entries', async () => {
    const res = await book({ repeat: 'Daily', repeatUntil: daysFromNow(5 * 365) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('repeatUntil');
  });

  it('refuses a repeat it does not know', async () => {
    const res = await book({ repeat: 'Hourly', repeatUntil: daysFromNow(10) });
    expect(res.status).toBe(400);
  });

  it('refuses a staff list it cannot read', async () => {
    const res = await book({ staffIds: 'not a list' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('staffIds');
  });
});

describe('a series that is fine', () => {
  it('books one entry per week up to the last date', async () => {
    const res = await book({ title: 'Spin', repeat: 'Weekly', repeatUntil: daysFromNow(1 + 21) });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(4);
  });
});

describe('changing an entry', () => {
  it('changes what was sent and ignores fields that are not the event\'s to change', async () => {
    const made = await book({ title: 'Boxing' });
    const res = await api.patch(`/api/calendar/${made.body.id}`, { title: 'Kickboxing', seriesId: 'someone-elses', createdAt: '2001-01-01', unknownField: 1 }, { token: gym.token });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Kickboxing');
    expect(res.body.seriesId).toBe(made.body.seriesId);
    expect(res.body.createdAt).toBe(made.body.createdAt);
  });

  it('keeps the people on it when the change does not mention them', async () => {
    const made = await book({ title: 'Circuit', staffIds: [trainer.id] });
    await api.patch(`/api/calendar/${made.body.id}`, { title: 'Circuit training' }, { token: gym.token });
    const list = await api.get('/api/calendar', { token: gym.token });
    const event = list.body.find(e => e.id === made.body.id);
    expect(event.assignedStaff.map(s => s.id)).toEqual([trainer.id]);
    const invites = await api.get('/api/tasks', { token: trainer.token });
    expect(invites.body.some(t => t.eventId === made.body.id)).toBe(true);
  });

  it('takes people off when an empty list is sent on purpose', async () => {
    const made = await book({ title: 'Pilates', staffIds: [trainer.id] });
    await api.patch(`/api/calendar/${made.body.id}`, { staffIds: [] }, { token: gym.token });
    const list = await api.get('/api/calendar', { token: gym.token });
    expect(list.body.find(e => e.id === made.body.id).assignedStaff).toEqual([]);
  });

  it('refuses to clear the title', async () => {
    const made = await book({ title: 'Stretch' });
    expect((await api.patch(`/api/calendar/${made.body.id}`, { title: '  ' }, { token: gym.token })).status).toBe(400);
  });
});
