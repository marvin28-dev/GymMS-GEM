// The background jobs, run directly against a gym made for the test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym, addMember, getMember } from './helpers/fixtures.mjs';

let api, stop, gym, prisma;
const DAY = 864e5;

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  await api.patch('/api/gyms/me', { settings: { freeze: { fee: 1000, intervalDays: 7 } } }, { token: gym.token });
});
afterAll(() => stop());

describe('freeze fees', () => {
  // A member frozen 15 days ago, last charged when the freeze began
  async function frozenFor(days) {
    const m = await addMember(api, gym.token, { balance: 0 });
    const since = new Date(Date.now() - days * DAY);
    await prisma.member.update({ where: { id: m.id }, data: { status: 'frozen', freezeStartDate: since, freezeFeeLastChargedAt: since } });
    return m;
  }

  it('charges one fee for each full interval the membership has stayed frozen', async () => {
    const m = await frozenFor(15);
    await backend('./jobs/freezeFees.js').runFreezeFees();
    expect((await getMember(api, gym.token, m.id)).balance).toBe(2000);
  });

  it('charges once when two runs overlap (two servers, or a restart mid-run)', async () => {
    const m = await frozenFor(15);
    const { runFreezeFees } = backend('./jobs/freezeFees.js');
    await Promise.all([runFreezeFees(), runFreezeFees()]);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(2000);
  });

  it('keeps a payment taken while the fee is being charged', async () => {
    const m = await frozenFor(15);
    await prisma.member.update({ where: { id: m.id }, data: { balance: 10000 } });
    const { runFreezeFees } = backend('./jobs/freezeFees.js');
    await Promise.all([
      runFreezeFees(),
      api.post('/api/payments', { memberId: m.id, amount: 4000, method: 'cash', type: 'membership' }, { token: gym.token }),
    ]);
    expect((await getMember(api, gym.token, m.id)).balance).toBe(8000);
  });
});
