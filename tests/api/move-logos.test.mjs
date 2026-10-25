// D-51: logos saved before f2ceee0 were data URLs on the gym record. The
// one-off script lists them, and with --apply uploads each and keeps its address.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend } from './helpers/server.mjs';
import { registerGym } from './helpers/fixtures.mjs';

let api, stop, prisma, moveLogos, cloudinary;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  ({ moveLogos } = backend('../scripts/move-logos.js'));
  cloudinary = backend('./utils/cloudinary.js');
});
afterAll(() => stop());

describe('moving logos kept as data URLs', () => {
  it('only lists them until it is told to apply, then uploads each and keeps its address', async () => {
    const old = await registerGym(api);
    const odd = await registerGym(api);
    const fine = await registerGym(api);
    const url = 'https://res.cloudinary.test/gem/logos/already.png';
    await prisma.gym.update({ where: { id: old.user.gymId }, data: { logo: `data:image/png;base64,${PNG}` } });
    await prisma.gym.update({ where: { id: odd.user.gymId }, data: { logo: 'data:text/html;base64,PHNjcmlwdD4=' } });
    await prisma.gym.update({ where: { id: fine.user.gymId }, data: { logo: url } });
    const lines = [];
    const logoOf = async (g) => (await prisma.gym.findUnique({ where: { id: g.user.gymId } })).logo;

    const listed = await moveLogos({ prisma, cloudinary, log: (l) => lines.push(l) });
    expect(listed.moved).toEqual([]);
    expect(await logoOf(old)).toMatch(/^data:image\/png/);
    expect(lines.some(l => l.startsWith(`${old.gymCode}: would upload`))).toBe(true);

    const applied = await moveLogos({ prisma, cloudinary, apply: true, log: (l) => lines.push(l) });
    expect(applied.moved).toContain(old.gymCode);
    expect(applied.skipped).toContain(odd.gymCode);
    expect(await logoOf(old)).toMatch(/^https:\/\/res\.cloudinary\.test\/gem\/logos\//);
    expect(await logoOf(odd)).toMatch(/^data:text\/html/);
    expect(await logoOf(fine)).toBe(url);

    const again = await moveLogos({ prisma, cloudinary, apply: true, log: () => {} });
    expect(again.moved).not.toContain(old.gymCode);
  });
});
