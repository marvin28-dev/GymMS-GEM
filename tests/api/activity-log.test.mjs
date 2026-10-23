// The activity log (Settings, owner only): every gym reads its own entries,
// filtered and paged; a secret is named but never written into it; entries
// leave after 30 days and cannot be edited or deleted before that.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode, eventually } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, other, manager;
const logs = (query = '', who = gym) => api.get(`/api/logs${query}`, { token: who.token });

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  other = await registerGym(api);
  manager = await addStaff(api, gym, { role: 'manager', firstName: 'Lena', lastName: 'Logger' });
});
afterAll(() => stop());

describe('the activity log', () => {
  it('is the owner\'s alone', async () => {
    expect((await logs()).status).toBe(200);
    expect((await logs('', manager)).status).toBe(403);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    expect((await logs('', desk)).status).toBe(403);
  });

  it('shows what happened in this gym and nothing of another', async () => {
    const tag = uniqueCode('lg');
    await addMember(api, other.token, { firstName: 'Theirs', lastName: tag });
    const m = await addMember(api, gym.token, { firstName: 'Ours', lastName: tag });
    await api.patch(`/api/members/${m.id}`, { phone: '677000111' }, { token: manager.token });
    const found = await eventually(async () => {
      const { items } = (await logs(`?q=${tag}`)).body;
      return items.length >= 2 && items;
    });
    expect(found.every(e => e.summary.includes('Ours') || e.summary.includes(tag))).toBe(true);
    expect(found.some(e => e.summary.includes('Theirs'))).toBe(false);
    // Found by who did it, too
    expect((await logs('?q=Lena')).body.items.some(e => e.actorName === 'Lena Logger')).toBe(true);
  });

  it('names a check-in code change without writing the code down', async () => {
    const m = await addMember(api, gym.token, { firstName: 'Secret', lastName: uniqueCode('sc') });
    const res = await api.patch(`/api/members/${m.id}`, { accessCode: '4826' }, { token: gym.token });
    expect(res.status).toBe(200);
    const entry = await eventually(async () => (await logs(`?q=${m.lastName}`)).body.items.find(e => e.action === 'member.updated'));
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain('4826');
    expect(entry.details.changes.some(c => /code/i.test(c.field) && !('to' in c))).toBe(true);
  });

  it('filters by category and pages through everything once', async () => {
    const money = (await logs('?category=money&limit=100')).body.items;
    expect(money.every(e => e.category === 'money')).toBe(true);
    const seen = [];
    let cursor = null;
    do {
      const page = (await logs(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`)).body;
      seen.push(...page.items.map(e => e.id));
      cursor = page.nextCursor;
    } while (cursor);
    const all = (await logs('?limit=100')).body.items.map(e => e.id);
    expect(seen).toEqual(all);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('keeps an entry 30 days, then the cleanup removes it', async () => {
    const gymId = gym.user.gymId;
    const old = await prisma.activityLog.create({ data: { gymId, category: 'settings', action: 'test.old', summary: 'Old entry', createdAt: new Date(Date.now() - 31 * 864e5) } });
    const recent = await prisma.activityLog.create({ data: { gymId, category: 'settings', action: 'test.recent', summary: 'Recent entry', createdAt: new Date(Date.now() - 29 * 864e5) } });
    await backend('./jobs/logRetention.js').purgeOldLogs();
    expect(await prisma.activityLog.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.activityLog.findUnique({ where: { id: recent.id } })).toBeTruthy();
    expect((await logs()).body.retentionDays).toBe(30);
  });

  it('cannot be edited or deleted', async () => {
    const [entry] = (await logs()).body.items;
    expect((await api.patch(`/api/logs/${entry.id}`, { summary: 'Changed' }, { token: gym.token })).status).toBe(404);
    expect((await api.del(`/api/logs/${entry.id}`, { token: gym.token })).status).toBe(404);
    expect((await prisma.activityLog.findUnique({ where: { id: entry.id } })).summary).toBe(entry.summary);
  });
});
