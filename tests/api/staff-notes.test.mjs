// F-121: staff notes are added one at a time by the server, so two managers
// adding notes at once both keep theirs; the same people as before may write them.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

let api, stop;
beforeAll(async () => { ({ api, stop } = await startServer()); });
afterAll(() => stop());

const notesOf = async (gym, id) => (await api.get(`/api/staff/${id}`, { token: gym.token })).body.staffNotes || [];

describe('adding a staff note', () => {
  it('two notes added at the same moment are both kept', async () => {
    const gym = await registerGym(api);
    const manager = await addStaff(api, gym, { role: 'manager' });
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const [a, b] = await Promise.all([
      api.post(`/api/staff/${desk.id}/notes`, { content: 'From the owner', category: 'Performance' }, { token: gym.token }),
      api.post(`/api/staff/${desk.id}/notes`, { content: 'From the manager', category: 'Commendation' }, { token: manager.token }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const contents = (await notesOf(gym, desk.id)).map(n => n.content).sort();
    expect(contents).toEqual(['From the manager', 'From the owner']);
  });

  it('records the author from the account, not from the request', async () => {
    const gym = await registerGym(api);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const res = await api.post(`/api/staff/${desk.id}/notes`, { content: 'Punctual all week', category: 'Nonsense', createdBy: 'Somebody else', date: '2026-10-21' }, { token: gym.token });
    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({ content: 'Punctual all week', category: 'General', createdBy: 'Olive Owner', date: '2026-10-21' });
    expect(res.body.notes.at(-1).content).toBe('Punctual all week');
  });

  it('keeps the notes that were already there', async () => {
    const gym = await registerGym(api);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    await api.patch(`/api/staff/${desk.id}`, { staffNotes: [{ id: 1, date: '2026-01-01', content: 'Older note', category: 'General', createdBy: 'Olive Owner' }] }, { token: gym.token });
    await api.post(`/api/staff/${desk.id}/notes`, { content: 'Newer note' }, { token: gym.token });
    expect((await notesOf(gym, desk.id)).map(n => n.content)).toEqual(['Older note', 'Newer note']);
  });

  it('refuses an empty or overlong note', async () => {
    const gym = await registerGym(api);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    expect((await api.post(`/api/staff/${desk.id}/notes`, { content: '   ' }, { token: gym.token })).body).toMatchObject({ field: 'content' });
    expect((await api.post(`/api/staff/${desk.id}/notes`, { content: 'x'.repeat(2001) }, { token: gym.token })).status).toBe(400);
  });

  it('is for someone who outranks them, as editing notes is', async () => {
    const gym = await registerGym(api);
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const trainer = await addStaff(api, gym, { role: 'trainer' });
    const manager = await addStaff(api, gym, { role: 'manager' });
    expect((await api.post(`/api/staff/${trainer.id}/notes`, { content: 'Peer note' }, { token: desk.token })).status).toBe(403);
    expect((await api.post(`/api/staff/${desk.id}/notes`, { content: 'About myself' }, { token: desk.token })).status).toBe(403);
    expect((await api.post(`/api/staff/${manager.id}/notes`, { content: 'Same level' }, { token: (await addStaff(api, gym, { role: 'manager' })).token })).status).toBe(403);
    expect((await api.post(`/api/staff/${desk.id}/notes`, { content: 'Manager note' }, { token: manager.token })).status).toBe(201);
  });

  it('cannot reach another gym\'s staff', async () => {
    const gym = await registerGym(api);
    const other = await registerGym(api);
    const theirs = await addStaff(api, other, { role: 'front_desk' });
    expect((await api.post(`/api/staff/${theirs.id}/notes`, { content: 'Not mine' }, { token: gym.token })).status).toBe(404);
  });
});
