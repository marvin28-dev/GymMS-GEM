// F-127: the package access types and the shop's product categories live on
// the gym, so every account and every computer reads the same lists.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

let api, stop, gym, desk, trainer;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk' });
  trainer = await addStaff(api, gym, { role: 'trainer' });
});
afterAll(() => stop());

const settingsOf = async (token = gym.token) => (await api.get('/api/gyms/me', { token })).body.settings || {};

describe('access types', () => {
  it('are kept on the gym, tidied', async () => {
    const res = await api.patch('/api/gyms/me', { settings: { accessTypes: [' Gym floor ', 'Pool', 'Pool', '', 'Sauna'] } }, { token: gym.token });
    expect(res.status).toBe(200);
    expect((await settingsOf(desk.token)).accessTypes).toEqual(['Gym floor', 'Pool', 'Sauna']);
  });

  it('must be a list', async () => {
    const res = await api.patch('/api/gyms/me', { settings: { accessTypes: 'Pool' } }, { token: gym.token });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('accessTypes');
  });
});

describe('product categories', () => {
  it('can be set by the desk, and leave the other settings alone', async () => {
    await api.patch('/api/gyms/me', { settings: { payment: { methods: ['Cash', 'Mobile Money'] } } }, { token: gym.token });
    const res = await api.put('/api/gyms/me/product-categories', { categories: ['Drinks', 'Snacks', 'Drinks', ' Towels '] }, { token: desk.token });
    expect(res.status).toBe(200);
    const settings = await settingsOf();
    expect(settings.productCategories).toEqual(['Drinks', 'Snacks', 'Towels']);
    expect(settings.payment.methods).toEqual(['Cash', 'Mobile Money']);
  });

  it('are not a trainer\'s to change', async () => {
    const res = await api.put('/api/gyms/me/product-categories', { categories: ['Anything'] }, { token: trainer.token });
    expect(res.status).toBe(403);
  });

  it('must be a list', async () => {
    const res = await api.put('/api/gyms/me/product-categories', { categories: 'Drinks' }, { token: desk.token });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('categories');
  });
});
