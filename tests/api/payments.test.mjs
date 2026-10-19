import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addMember, getMember } from './helpers/fixtures.mjs';

let api, stop, gym;

beforeAll(async () => {
  ({ api, stop } = await startServer());
  gym = await registerGym(api);
});
afterAll(() => stop());

describe('a payment without a member', () => {
  it('is refused, and nobody else is charged or credited', async () => {
    const owing = await addMember(api, gym.token, { balance: 20000 });
    const res = await api.post('/api/payments', { amount: 5000, method: 'cash', type: 'membership' }, { token: gym.token });
    expect(res.status).toBe(400);
    expect((await getMember(api, gym.token, owing.id)).balance).toBe(20000);
  });
});
