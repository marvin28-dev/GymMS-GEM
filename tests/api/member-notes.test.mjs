// D-32: a member's notes were kept in the browser that wrote them, signed
// "Staff", and seen by nobody else. They are kept on the server now, for the
// desk and management.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, addMember } from './helpers/fixtures.mjs';

let api, stop, gym, desk, trainer;
const notesOf = (memberId, token = gym.token) => api.get(`/api/members/${memberId}/notes`, { token });
const write = (memberId, body, token = desk.token) => api.post(`/api/members/${memberId}/notes`, body, { token });

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk', firstName: 'Dina' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

describe("a member's notes", () => {
  it('are written by the desk, signed with their name, and read by management', async () => {
    const m = await addMember(api, gym.token);
    const res = await write(m.id, { text: 'Knee injury, no squats', category: 'Health' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ text: 'Knee injury, no squats', category: 'Health', authorId: desk.id });
    expect(res.body.authorName).toContain('Dina');
    await write(m.id, { text: 'Pays on the 5th', category: 'Financial' }, gym.token);
    const list = await notesOf(m.id);
    expect(list.status).toBe(200);
    expect(list.body.map(n => n.text)).toEqual(['Pays on the 5th', 'Knee injury, no squats']);
  });

  it('need text, and an unknown category is General', async () => {
    const m = await addMember(api, gym.token);
    expect((await write(m.id, { text: '   ' })).body.field).toBe('text');
    expect((await write(m.id, { text: 'x'.repeat(2001) })).body.field).toBe('text');
    expect((await write(m.id, { text: 'Hello', category: 'Gossip' })).body.category).toBe('General');
  });

  it('are not for coaches, nor for another gym', async () => {
    const m = await addMember(api, gym.token);
    await write(m.id, { text: 'Private' });
    expect((await notesOf(m.id, trainer.token)).status).toBe(403);
    expect((await write(m.id, { text: 'From a coach' }, trainer.token)).status).toBe(403);
    const other = await registerGym(api);
    expect((await notesOf(m.id, other.token)).status).toBe(404);
    expect((await write(m.id, { text: 'From elsewhere' }, other.token)).status).toBe(404);
    expect((await notesOf(m.id)).body.map(n => n.text)).toEqual(['Private']);
  });

  it('kept in a browser are taken over with their author and day', async () => {
    const m = await addMember(api, gym.token);
    const res = await api.post(`/api/members/${m.id}/notes/import`, { notes: [
      { date: '3 Oct 2026', content: 'Wants a morning slot', category: 'General', author: 'Old Desk' },
      { date: 'not a date', content: 'Allergic to latex', category: 'Health' },
      { content: '   ' },
    ] }, { token: desk.token });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    const old = res.body.find(n => n.text === 'Wants a morning slot');
    expect(old).toMatchObject({ authorName: 'Old Desk', category: 'General', authorId: null });
    expect(new Date(old.createdAt).getDate()).toBe(3);
    expect(res.body.find(n => n.text === 'Allergic to latex')).toMatchObject({ authorName: 'Staff', category: 'Health' });
    expect((await api.post(`/api/members/${m.id}/notes/import`, { notes: 'nope' }, { token: desk.token })).status).toBe(400);
  });
});
