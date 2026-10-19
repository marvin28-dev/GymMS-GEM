import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, uniqueCode } from './helpers/fixtures.mjs';

let api, stop, gym, manager, trainer, desk;
const ID_SCAN = 'https://res.cloudinary.test/gem/staff/id-card.png';

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  manager = await addStaff(api, gym, { role: 'manager' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
  desk = await addStaff(api, gym, { role: 'front_desk' });
  expect((await api.patch(`/api/staff/${trainer.id}`, { photoId: ID_SCAN }, { token: gym.token })).status).toBe(200);
});
afterAll(() => stop());

describe('taking someone on', () => {
  const create = (body) => api.post('/api/staff', { firstName: 'New', lastName: 'Hire', email: `${uniqueCode('h')}@example.test`, role: 'trainer', city: 'Douala', region: 'Littoral', ...body }, { token: gym.token });

  it('stores the label "Other" as the other role, never as a coach', async () => {
    const res = await create({ role: 'Other' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('other');
  });

  it('sets only an employee\'s own fields: a reset link or an access code cannot be planted', async () => {
    const token = 'a'.repeat(64);
    const res = await create({ resetToken: token, resetTokenExpiry: new Date(Date.now() + 864e5).toISOString(), accessCode: '1234', unknownField: 'x' });
    expect(res.status).toBe(201);
    expect((await api.get(`/api/auth/verify-reset-token/${token}`)).body.valid).toBe(false);
    const code = await api.get(`/api/staff/${res.body.id}/code`, { token: gym.token });
    expect(code.body.accessCode).not.toBe('1234');
  });

  it('refuses a new employee with no email, naming the field and leaking no database text', async () => {
    const res = await create({ email: '' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('email');
    expect(res.body.detail).toBeUndefined();
  });

  it('keeps the emergency contact', async () => {
    const res = await create({ emergencyContact: 'Aunt Grace', emergencyPhone: '699112233' });
    const read = await api.get(`/api/staff/${res.body.id}`, { token: gym.token });
    expect(read.body).toMatchObject({ emergencyContact: 'Aunt Grace', emergencyPhone: '699112233' });
  });

  it('gives every employee and member a different 4-digit code', async () => {
    const made = await Promise.all(Array.from({ length: 12 }, () => create({})));
    const codes = await Promise.all(made.map(m => api.get(`/api/staff/${m.body.id}/code`, { token: gym.token })));
    const all = [...codes.map(c => c.body.accessCode), gym.accessCode, manager.accessCode, trainer.accessCode, desk.accessCode];
    all.forEach(c => expect(c).toMatch(/^\d{4}$/));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('a colleague\'s identity document', () => {
  it('is not sent to a colleague who does not outrank them, who is only told it is on file', async () => {
    const list = await api.get('/api/staff', { token: desk.token });
    const row = list.body.find(s => s.id === trainer.id);
    expect(row.photoId).toBeUndefined();
    expect(row.photoIdOnFile).toBe(true);
    const one = await api.get(`/api/staff/${trainer.id}`, { token: desk.token });
    expect(one.body.photoId).toBeUndefined();
    expect(one.body.photoIdOnFile).toBe(true);
  });

  it('is there for the person themself and for someone who outranks them', async () => {
    expect((await api.get(`/api/staff/${trainer.id}`, { token: trainer.token })).body.photoId).toBe(ID_SCAN);
    expect((await api.get(`/api/staff/${trainer.id}`, { token: manager.token })).body.photoId).toBe(ID_SCAN);
    expect((await api.get('/api/staff', { token: gym.token })).body.find(s => s.id === trainer.id).photoId).toBe(ID_SCAN);
  });
});

describe('deactivating someone', () => {
  it('is the general manager\'s alone, whichever way it is asked for', async () => {
    const res = await api.del(`/api/staff/${desk.id}`, { token: manager.token });
    expect(res.status).toBe(403);
    const still = await api.get(`/api/staff/${desk.id}`, { token: gym.token });
    expect(still.body.isActive).toBe(true);
    expect((await api.patch(`/api/staff/${desk.id}`, { isActive: false }, { token: manager.token })).status).toBe(403);
  });

  it('is done by the general manager', async () => {
    const leaving = await addStaff(api, gym, { role: 'front_desk' });
    expect((await api.del(`/api/staff/${leaving.id}`, { token: gym.token })).status).toBe(200);
    expect((await api.get(`/api/staff/${leaving.id}`, { token: gym.token })).body.isActive).toBe(false);
  });
});
