// Each member and each staff member has a language of their own (the owner,
// 21 November 2026): chosen when they are added, it decides the language of
// their emails and, for staff, the language GEM opens in when they sign in.
// Emails go to the fake Resend client.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, outbox } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode, eventually, OWNER_PASSWORD } from './helpers/fixtures.mjs';

let api, stop, prisma, gym, frGym;
const mailFor = (to, subject) => eventually(() => outbox().filter(m => m.to === to && subject.test(m.subject)).at(-1), { timeout: 5000 });
const address = (who) => `${who}.${uniqueCode('l')}@example.test`;

// Sign-ups are limited per address, so the tests share an English gym and a
// gym whose owner signed up in French
beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  frGym = await registerGym(api, { language: 'fr' });
});
afterAll(() => stop());

describe("a member's language", () => {
  it('is kept when the member is added, and their welcome is written in it', async () => {
    const email = address('awa');
    const member = await addMember(api, gym.token, { firstName: 'Awa', email, language: 'fr' });
    expect((await api.get(`/api/members/${member.id}`, { token: gym.token })).body.language).toBe('fr');
    const welcome = await mailFor(email, /Bienvenue chez/);
    expect(welcome).toBeTruthy();
    expect(welcome.html).toContain('Bonjour Awa');
  });

  it("follows the gym's language for members when none is chosen", async () => {
    const email = address('ben');
    const member = await addMember(api, gym.token, { firstName: 'Ben', email });
    expect((await api.get(`/api/members/${member.id}`, { token: gym.token })).body.language).toBeNull();
    expect(await mailFor(email, /^Welcome to/)).toBeTruthy();
  });

  it('is English or French, and nothing else', async () => {
    const refused = await api.post('/api/members', { firstName: 'Cy', lastName: 'Lang', city: 'Douala', region: 'Littoral', language: 'de' }, { token: gym.token });
    expect(refused.status).toBe(400);
    expect(refused.body.field).toBe('language');
    const member = await addMember(api, gym.token, { firstName: 'Dee' });
    const badEdit = await api.patch(`/api/members/${member.id}`, { language: 'es' }, { token: gym.token });
    expect(badEdit.status).toBe(400);
    expect(badEdit.body.field).toBe('language');
  });

  it('can be changed later, and the emails that follow are in the new one', async () => {
    const email = address('eve');
    const member = await addMember(api, gym.token, { firstName: 'Eve', email, language: 'en' });
    expect((await api.patch(`/api/members/${member.id}`, { language: 'fr' }, { token: gym.token })).status).toBe(200);
    expect((await api.get(`/api/members/${member.id}`, { token: gym.token })).body.language).toBe('fr');
    expect((await api.post(`/api/members/${member.id}/send-code`, {}, { token: gym.token })).status).toBe(200);
    expect(await mailFor(email, /Votre code d'entrée/)).toBeTruthy();
  });

  it("is used for a message from the Communication page, around the gym's own words", async () => {
    const email = address('fay');
    const member = await addMember(api, gym.token, { firstName: 'Fay', email, language: 'fr' });
    const subject = `Note ${uniqueCode('s')}`;
    const sent = await api.post('/api/communications', { action: 'send', subject, body: 'Hello {firstName}', audience: { type: 'members', memberIds: [member.id] } }, { token: gym.token });
    expect(sent.status).toBe(202);
    const mail = await mailFor(email, new RegExp(subject));
    expect(mail).toBeTruthy();
    expect(mail.html).toContain('Propulsé par');
    expect(mail.html).toContain('Hello Fay');
  });
});

describe("a staff member's language", () => {
  it('is kept when they are added, and their welcome email is written in it', async () => {
    const email = address('gus');
    const made = await api.post('/api/staff', { firstName: 'Gus', lastName: 'Lang', email, role: 'trainer', city: 'Douala', region: 'Littoral', language: 'fr' }, { token: gym.token });
    expect(made.status).toBe(201);
    expect(made.body.language).toBe('fr');
    const welcome = await mailFor(email, /^Votre compte/);
    expect(welcome).toBeTruthy();
    expect(welcome.html).toContain('Bonjour Gus');
    expect(welcome.html).toContain('Code de la salle');
  });

  it('is refused when it is not English or French', async () => {
    const refused = await api.post('/api/staff', { firstName: 'Hal', lastName: 'Lang', email: address('hal'), role: 'trainer', city: 'Douala', region: 'Littoral', language: 'xx' }, { token: gym.token });
    expect(refused.status).toBe(400);
    expect(refused.body.field).toBe('language');
  });

  it('is what GEM opens in when they sign in', async () => {
    const staff = await addStaff(api, gym, { role: 'front_desk', language: 'fr' });
    const signIn = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: staff.email, password: staff.password, language: 'en' });
    expect(signIn.status).toBe(200);
    // Their own language wins over the sign-in page's
    expect(signIn.body.user.language).toBe('fr');
    expect((await api.get('/api/auth/me', { token: signIn.body.token })).body.language).toBe('fr');
  });

  it('is taken from the screen at the first sign-in of an account that has none, and kept after', async () => {
    const staff = await addStaff(api, gym, { role: 'trainer' });
    expect((await prisma.staff.findUnique({ where: { id: staff.id } })).language).toBeNull();
    const first = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: staff.email, password: staff.password, language: 'fr' });
    expect(first.body.user.language).toBe('fr');
    const later = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: staff.email, password: staff.password, language: 'en' });
    expect(later.body.user.language).toBe('fr');
  });

  it('is theirs to change, and a colleague who does not outrank them cannot', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer', language: 'en' });
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    expect((await api.patch(`/api/staff/${trainer.id}`, { language: 'fr' }, { token: trainer.token })).status).toBe(200);
    expect((await api.get(`/api/staff/${trainer.id}`, { token: trainer.token })).body.language).toBe('fr');
    expect((await api.patch(`/api/staff/${trainer.id}`, { language: 'en' }, { token: desk.token })).status).toBe(403);
    expect((await api.patch(`/api/staff/${trainer.id}`, { language: 'en' }, { token: gym.token })).status).toBe(200);
  });

  it('writes their password reset email in it', async () => {
    const staff = await addStaff(api, gym, { role: 'front_desk', language: 'fr' });
    expect((await api.post('/api/auth/forgot-password', { gymCode: gym.gymCode, email: staff.email })).status).toBe(200);
    const mail = await mailFor(staff.email, /Réinitialisez votre mot de passe/);
    expect(mail).toBeTruthy();
    expect(mail.html).toContain('Ce lien expire dans 15 minutes');
  });

  it('writes a task given to them in it', async () => {
    const staff = await addStaff(api, gym, { role: 'front_desk', language: 'fr' });
    const title = `Clean the mirrors ${uniqueCode('t')}`;
    const made = await api.post('/api/tasks', { title, assignedToId: staff.id, dueDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10), category: 'Operations', priority: 'high' }, { token: gym.token });
    expect(made.status).toBe(201);
    const mail = await mailFor(staff.email, /^Nouvelle tâche chez/);
    expect(mail).toBeTruthy();
    expect(mail.html).toContain('Haute');
  });
});

describe("a new gym's owner", () => {
  it('keeps the language they signed up in, for the screen and the welcome email', async () => {
    expect(frGym.user.language).toBe('fr');
    const welcome = await mailFor(frGym.email, /^Bienvenue sur GEM/);
    expect(welcome).toBeTruthy();
    expect(welcome.html).toContain('Confirmer mon e-mail');
    const signIn = await api.post('/api/auth/login', { gymCode: frGym.gymCode, email: frGym.email, password: OWNER_PASSWORD });
    expect(signIn.body.user.language).toBe('fr');
  });

  it('signed up in English gets English', async () => {
    expect(gym.user.language).toBe('en');
    expect(await mailFor(gym.email, /^Welcome to GEM/)).toBeTruthy();
  });
});
