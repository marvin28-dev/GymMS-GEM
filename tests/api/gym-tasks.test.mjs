import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, daysFromNow } from './helpers/fixtures.mjs';

let api, stop, gym, desk, trainer, prisma;

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('the gym record', () => {
  it('never hands out the old manager code', async () => {
    await prisma.gym.update({ where: { id: gym.user.gymId }, data: { managerCode: '4242' } });
    for (const token of [desk.token, trainer.token, gym.token]) {
      const res = await api.get('/api/gyms/me', { token });
      expect(res.status).toBe(200);
      expect(res.body.managerCode).toBeUndefined();
    }
  });

  it('accepts only the currencies GEM can show, and numbers where numbers belong', async () => {
    expect((await api.patch('/api/gyms/me', { currency: 'francs' }, { token: gym.token })).body.field).toBe('currency');
    expect((await api.patch('/api/gyms/me', { registrationFee: 'a lot' }, { token: gym.token })).body.field).toBe('registrationFee');
    expect((await api.patch('/api/gyms/me', { minUpfrontPercent: 150 }, { token: gym.token })).body.field).toBe('minUpfrontPercent');
    expect((await api.patch('/api/gyms/me', { registrationFeeFrequency: 'weekly' }, { token: gym.token })).body.field).toBe('registrationFeeFrequency');
    expect((await api.patch('/api/gyms/me', { name: '  ' }, { token: gym.token })).body.field).toBe('name');
    const ok = await api.patch('/api/gyms/me', { currency: 'ngn', registrationFee: '5000', registrationFeeRequired: true, registrationFeeFrequency: 'one-time', minUpfrontPercent: 50 }, { token: gym.token });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ currency: 'NGN', registrationFee: 5000, registrationFeeRequired: true, registrationFeeFrequency: 'one-time', minUpfrontPercent: 50 });
    await api.patch('/api/gyms/me', { currency: 'XAF', registrationFeeRequired: false }, { token: gym.token });
  });
});

describe('tasks', () => {
  const task = (body, token = gym.token) => api.post('/api/tasks', { title: 'Restock towels', category: 'Operations', dueDate: daysFromNow(2), priority: 'Medium', ...body }, { token });

  it('cannot be handed to a whole team by someone who neither set it nor manages', async () => {
    const t = (await task({ assignedToId: desk.id })).body;
    const res = await api.patch(`/api/tasks/${t.id}`, { assignedGroup: 'management' }, { token: trainer.token });
    expect(res.status).toBe(403);
    const again = await api.patch(`/api/tasks/${t.id}`, { assignedRole: 'trainer' }, { token: trainer.token });
    expect(again.status).toBe(403);
  });

  it('can still be handed on by the person who set it', async () => {
    const t = (await task({ assignedToId: trainer.id }, desk.token)).body;
    const res = await api.patch(`/api/tasks/${t.id}`, { assignedGroup: 'management' }, { token: desk.token });
    expect(res.status).toBe(200);
    expect(res.body.assignedGroup).toBe('management');
  });
});

describe('task reminders', () => {
  it('never call a calendar invite overdue, answered or not', async () => {
    const yesterday = new Date(Date.now() - 2 * 864e5);
    const event = await prisma.calendarEvent.create({ data: { gymId: gym.user.gymId, title: 'Yoga', date: yesterday, staffIds: JSON.stringify([trainer.id]) } });
    for (const status of ['todo', 'accepted', 'declined']) {
      await prisma.task.create({ data: { gymId: gym.user.gymId, title: `Yoga (${status})`, category: 'Calendar', eventId: event.id, status, dueDate: yesterday, assignedToId: trainer.id, createdBySystem: true } });
    }
    await backend('./jobs/taskReminders.js').runTaskReminders();
    const notes = await prisma.notification.findMany({ where: { gymId: gym.user.gymId, staffId: trainer.id, title: { in: ['Task Overdue', 'Task Due Today'] } } });
    expect(notes.filter(n => /Yoga/.test(n.body))).toEqual([]);
  });

  it('still warns about an ordinary task that is overdue', async () => {
    const yesterday = new Date(Date.now() - 2 * 864e5);
    await prisma.task.create({ data: { gymId: gym.user.gymId, title: 'Fix the mirror', category: 'Operations', status: 'in_progress', dueDate: yesterday, assignedToId: trainer.id } });
    await backend('./jobs/taskReminders.js').runTaskReminders();
    const notes = await prisma.notification.findMany({ where: { gymId: gym.user.gymId, staffId: trainer.id, title: 'Task Overdue' } });
    expect(notes.some(n => /Fix the mirror/.test(n.body))).toBe(true);
  });
});

describe('giving a member a coach', () => {
  it('answers 400 when no member is named', async () => {
    const res = await api.post('/api/coach/assign', { coachId: trainer.id }, { token: gym.token });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('memberId');
  });

  it('still assigns a coach to a named member', async () => {
    const m = await addMember(api, gym.token);
    const res = await api.post('/api/coach/assign', { memberId: m.id, coachId: trainer.id }, { token: gym.token });
    expect(res.status).toBe(200);
    expect(res.body.member.coachId).toBe(trainer.id);
  });
});
