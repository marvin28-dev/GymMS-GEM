// D-2: the public demo gym's people are made up, so nothing is ever sent for
// it, and its code cannot be taken by a real gym.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend, outbox } from './helpers/server.mjs';
import { registerGym, uniqueCode } from './helpers/fixtures.mjs';

let api, stop, prisma, demo, staff;

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  demo = await prisma.gym.upsert({ where: { code: 'elite' }, update: {}, create: { code: 'elite', name: 'Elite Fitness (test)' } });
  const email = `demo.${uniqueCode('d')}@example.com`;
  staff = await prisma.staff.create({ data: { gymId: demo.id, firstName: 'Dee', lastName: 'Demo', email, role: 'manager', passwordHash: 'x' } });
});
afterAll(() => stop());

describe('the demo gym', () => {
  it('cannot be registered as a real gym, and its code is never offered, even where no demo exists', async () => {
    // A demo code no gym has yet (the server reads DEMO_GYM_CODE as it answers)
    const code = uniqueCode('demo');
    process.env.DEMO_GYM_CODE = code;
    try {
      expect((await api.get(`/api/auth/check-code/${code}`)).body).toEqual({ available: false });
      const res = await api.post('/api/auth/register', { gymCode: code, gymName: 'Not The Demo', location: 'Douala', phone: '+237 670 000 000', city: 'Douala', country: 'Cameroon', firstName: 'Ann', lastName: 'Other', email: `ann.${uniqueCode('a')}@example.test`, password: 'Owner-pass-1' });
      expect(res.status).toBe(409);
      expect(await prisma.gym.findUnique({ where: { code } })).toBeNull();
    } finally {
      delete process.env.DEMO_GYM_CODE;
    }
  });

  it('sends no email, and says so when asked for a reset link', async () => {
    const welcome = await backend('./utils/welcomeEmail.js').sendWelcomeEmail({ staff, gym: demo });
    expect(welcome.sent).toBe(true);
    const reset = await api.post('/api/auth/forgot-password', { gymCode: 'elite', email: staff.email });
    expect(reset.status).toBe(400);
    expect(reset.body.error).toMatch(/demo gym sends no email/);
    expect(outbox().filter(m => m.to === staff.email)).toEqual([]);
  });

  it('records a message to its members as not sent', async () => {
    const member = await prisma.member.create({ data: { gymId: demo.id, memberCode: `GEM-${uniqueCode('x')}`, firstName: 'Mo', lastName: 'Member', email: `mo.${uniqueCode('m')}@example.com` } });
    const comm = await prisma.communication.create({ data: { gymId: demo.id, subject: 'Hello', body: 'Hi', channel: 'email', status: 'sending', audience: { type: 'members', memberIds: [member.id] } } });
    await backend('./utils/messaging.js').deliverCommunication(comm.id);
    const rows = await prisma.communicationDelivery.findMany({ where: { communicationId: comm.id } });
    expect(rows.map(r => [r.status, r.error])).toEqual([['skipped', 'Demo gym: nothing is sent']]);
    expect(outbox().filter(m => m.to === member.email)).toEqual([]);
  });

  it('leaves every other gym\'s email alone', async () => {
    const gym = await registerGym(api);
    await expect.poll(() => outbox().some(m => m.to === gym.email)).toBe(true);
  });
});
