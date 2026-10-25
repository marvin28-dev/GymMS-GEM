// Notifications (J-25): who sees what (nobody hears about themselves, a coach
// only what is addressed to them, a notice for managers only reaches them),
// and clearing takes a notice off your own list without taking it off
// anybody else's.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, daysFromNow, eventually } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, manager, desk, coach;
const list = async (who) => (await api.get('/api/notifications', { token: who.token })).body;
const titles = async (who) => (await list(who)).map(n => n.title);

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  manager = await addStaff(api, gym, { role: 'manager' });
  desk = await addStaff(api, gym, { role: 'front_desk' });
  coach = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe('who sees a notice', () => {
  it('the setup reminders made at sign-up are the owner\'s alone', async () => {
    expect(await titles(gym)).toEqual(expect.arrayContaining(['Finish your gym setup', 'Complete your gym profile']));
    for (const who of [manager, desk, coach]) {
      expect(await titles(who)).not.toContain('Finish your gym setup');
      expect(await titles(who)).not.toContain('Complete your gym profile');
    }
  });

  it('a new member reaches management and the desk, not a coach', async () => {
    await addMember(api, gym.token, { firstName: 'Nina', lastName: 'Notice' });
    const about = (n) => n.title === 'New Member Joined' && n.body.includes('Nina Notice');
    for (const who of [gym, manager, desk]) {
      expect(await eventually(async () => (await list(who)).some(about))).toBe(true);
    }
    expect((await list(coach)).some(about)).toBe(false);
  });

  it('a notice for managers reaches them, but not the person it is about', async () => {
    const fresh = await addStaff(api, gym, { role: 'manager', firstName: 'Neve', lastName: 'Newhire' });
    const about = (n) => n.title === 'New Staff Member Added' && n.body.includes('Neve Newhire');
    expect(await eventually(async () => (await list(gym)).some(about))).toBe(true);
    expect((await list(manager)).some(about)).toBe(true);
    expect((await list(desk)).some(about)).toBe(false);
    expect((await list(fresh)).some(about)).toBe(false);
  });

  it('a coach sees only what is addressed to them', async () => {
    await api.post('/api/tasks', { title: 'Clean the rack', assignedToId: coach.id, dueDate: daysFromNow(2), category: 'Front Desk', priority: 'Medium' }, { token: gym.token });
    const mine = await eventually(async () => {
      const l = await list(coach);
      return l.length && l;
    });
    expect(mine.every(n => n.staffId === coach.id)).toBe(true);
    expect(mine.some(n => n.body.includes('Clean the rack'))).toBe(true);
  });
});

// D-46: one person's Mark all read marked a gym-wide notice read for everyone
describe('reading', () => {
  const notice = async (who, name) => (await list(who)).find(n => n.title === 'New Member Joined' && n.body.includes(name));

  it("a gym-wide notice read by one person stays unread for everyone else", async () => {
    await addMember(api, gym.token, { firstName: 'Rhea', lastName: 'Readme' });
    const before = await eventually(() => notice(desk, 'Rhea Readme'));
    expect(before.isRead).toBe(false);

    expect((await api.patch('/api/notifications/mark-read', {}, { token: desk.token })).status).toBe(200);
    expect((await notice(desk, 'Rhea Readme')).isRead).toBe(true);
    expect((await notice(gym, 'Rhea Readme')).isRead).toBe(false);
    expect((await notice(manager, 'Rhea Readme')).isRead).toBe(false);

    const opened = await api.patch(`/api/notifications/${before.id}/read`, {}, { token: manager.token });
    expect(opened.body.isRead).toBe(true);
    expect((await notice(manager, 'Rhea Readme')).isRead).toBe(true);
    expect((await notice(gym, 'Rhea Readme')).isRead).toBe(false);
    // Opened again (another tab) is still read once
    expect((await api.patch(`/api/notifications/${before.id}/read`, {}, { token: manager.token })).status).toBe(200);
  });

  it('one addressed to me is read with its own flag', async () => {
    const mine = await prisma.notification.create({ data: { gymId: gym.user.gymId, staffId: desk.id, title: 'For the desk', body: 'Only yours' } });
    await api.patch(`/api/notifications/${mine.id}/read`, {}, { token: desk.token });
    expect((await prisma.notification.findUnique({ where: { id: mine.id } })).isRead).toBe(true);
    expect((await list(desk)).find(n => n.id === mine.id).isRead).toBe(true);
  });
});

describe('clearing', () => {
  it('a gym-wide notice comes off my list only; one addressed to me is deleted', async () => {
    await addMember(api, gym.token, { firstName: 'Clara', lastName: 'Clear' });
    const shared = await eventually(async () => (await list(manager)).find(n => n.body.includes('Clara Clear')));
    expect((await api.del(`/api/notifications/${shared.id}`, { token: manager.token })).status).toBe(200);
    expect((await list(manager)).some(n => n.id === shared.id)).toBe(false);
    expect((await list(gym)).some(n => n.id === shared.id)).toBe(true);
    // Twice is still once
    expect((await api.del(`/api/notifications/${shared.id}`, { token: manager.token })).status).toBe(404);

    await api.post('/api/tasks', { title: 'Count the towels', assignedToId: desk.id, dueDate: daysFromNow(2), category: 'Front Desk', priority: 'Low' }, { token: gym.token });
    const own = await eventually(async () => (await list(desk)).find(n => n.staffId === desk.id && n.body.includes('Count the towels')));
    expect((await api.del(`/api/notifications/${own.id}`, { token: desk.token })).status).toBe(200);
    expect(await prisma.notification.findUnique({ where: { id: own.id } })).toBeNull();
  });

  it('Clear all empties my list and leaves everyone else\'s', async () => {
    await addMember(api, gym.token, { firstName: 'Allie', lastName: 'Everyone' });
    await eventually(async () => (await list(desk)).some(n => n.body.includes('Allie Everyone')));
    const before = (await list(gym)).length;
    const res = await api.del('/api/notifications/all', { token: desk.token });
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(await list(desk)).toEqual([]);
    expect((await list(gym)).length).toBe(before);
    expect((await list(gym)).some(n => n.body.includes('Allie Everyone'))).toBe(true);
  });

  it('cannot reach another gym\'s notices', async () => {
    const other = await registerGym(api);
    const [theirs] = await list(other);
    expect((await api.del(`/api/notifications/${theirs.id}`, { token: gym.token })).status).toBe(404);
    expect((await api.patch(`/api/notifications/${theirs.id}/read`, {}, { token: gym.token })).status).toBe(404);
    expect((await list(other)).some(n => n.id === theirs.id)).toBe(true);
  });
});
