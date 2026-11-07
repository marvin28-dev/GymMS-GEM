// The Support page (the owner, 7 November 2026): anyone signed in can report a
// problem, a complaint, a suggestion or a question. It is kept on the server
// and emailed to GEM's support address, and the answer says whether the email
// went. Each person sees only what they sent.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend, outbox } from './helpers/server.mjs';
import { registerGym, addStaff } from './helpers/fixtures.mjs';

const SUPPORT = 'marvin.ekokobe01@gmail.com';
let api, stop, prisma, gym, desk;
const report = (body, token = desk.token) => api.post('/api/support', body, { token });
const reportsTo = (subject) => outbox().filter(m => m.to === SUPPORT && m.subject === subject);

beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  gym = await registerGym(api);
  desk = await addStaff(api, gym, { role: 'front_desk', firstName: 'Dina', lastName: 'Desk', phone: '677123456' });
});
afterAll(() => stop());

describe('a support report', () => {
  it('is kept and emailed to GEM support, with who sent it, from which gym, and a reply-to them', async () => {
    const res = await report({
      kind: 'problem', subject: 'Check-in button does nothing', page: '/front-desk',
      message: 'I press Check In and nothing happens.\nIt started this morning.',
    });
    expect(res.status).toBe(201);
    expect(res.body.emailed).toBe(true);
    expect(res.body.report).toMatchObject({ kind: 'problem', subject: 'Check-in button does nothing' });
    expect(res.body.report.emailedAt).toBeTruthy();

    const [mail] = reportsTo('[GEM support] Something is not working: Check-in button does nothing');
    expect(mail).toBeTruthy();
    expect(mail.replyTo).toBe(desk.email);
    expect(mail.html).toContain('Dina Desk');
    expect(mail.html).toContain('Front desk');
    expect(mail.html).toContain(`${gym.body.gymName} (${gym.gymCode})`);
    expect(mail.html).toContain('/front-desk');
    expect(mail.html).toContain('I press Check In and nothing happens.<br>It started this morning.');

    const row = await prisma.supportRequest.findUnique({ where: { id: res.body.report.id } });
    expect(row).toMatchObject({ gymId: gym.user.gymId, staffId: desk.id, senderName: 'Dina Desk', senderEmail: desk.email, senderPhone: '677123456', senderRole: 'front_desk', page: '/front-desk' });
  });

  it('escapes what was written, so a report cannot put its own markup in the email', async () => {
    await report({ kind: 'complaint', subject: 'Markup <b>test</b>', message: '<script>alert(1)</script>' });
    const [mail] = reportsTo('[GEM support] Complaint: Markup <b>test</b>');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
  });

  it('needs what it is about, a title and a message, each named on its field', async () => {
    const before = (await api.get('/api/support', { token: desk.token })).body.length;
    expect((await report({ kind: 'rant', subject: 'A', message: 'B' })).body.field).toBe('kind');
    expect((await report({ kind: 'question', subject: '  ', message: 'B' })).body.field).toBe('subject');
    expect((await report({ kind: 'question', subject: 'x'.repeat(121), message: 'B' })).body.field).toBe('subject');
    expect((await report({ kind: 'question', subject: 'A', message: '   ' })).body.field).toBe('message');
    expect((await report({ kind: 'question', subject: 'A', message: 'x'.repeat(4001) })).body.field).toBe('message');
    expect((await api.get('/api/support', { token: desk.token })).body).toHaveLength(before);
  });

  it('can be sent by anyone signed in, the "Other" role included, and not by someone signed out', async () => {
    const trainer = await addStaff(api, gym, { role: 'trainer' });
    const other = await addStaff(api, gym, { role: 'other' });
    expect((await report({ kind: 'suggestion', subject: 'Dark calendar', message: 'Please' }, trainer.token)).status).toBe(201);
    expect((await report({ kind: 'question', subject: 'Payslip', message: 'Where is it?' }, other.token)).status).toBe(201);
    expect((await report({ kind: 'question', subject: 'Owner', message: 'Hello' }, gym.token)).status).toBe(201);
    expect((await api.post('/api/support', { kind: 'question', subject: 'A', message: 'B' })).status).toBe(401);
  });

  it('is listed only to the person who sent it, newest first', async () => {
    const mine = await addStaff(api, gym, { role: 'manager' });
    await report({ kind: 'question', subject: 'First', message: 'One' }, mine.token);
    await report({ kind: 'suggestion', subject: 'Second', message: 'Two' }, mine.token);
    const list = await api.get('/api/support', { token: mine.token });
    expect(list.status).toBe(200);
    expect(list.body.map(r => r.subject)).toEqual(['Second', 'First']);
    expect(list.body[0]).not.toHaveProperty('senderEmail');
    const theirs = await api.get('/api/support', { token: desk.token });
    expect(theirs.body.map(r => r.subject)).not.toContain('First');
    const elsewhere = await registerGym(api);
    expect((await api.get('/api/support', { token: elsewhere.token })).body).toEqual([]);
  });

  it('is limited to ten an hour per person', async () => {
    const busy = await addStaff(api, gym, { role: 'front_desk' });
    for (let i = 1; i <= 10; i++) {
      expect((await report({ kind: 'problem', subject: `Try ${i}`, message: 'Again' }, busy.token)).status).toBe(201);
    }
    const eleventh = await report({ kind: 'problem', subject: 'Try 11', message: 'Again' }, busy.token);
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.code).toBe('TOO_MANY_TRIES');
    expect((await report({ kind: 'problem', subject: 'Someone else', message: 'Fine' })).status).toBe(201);
  });

  it('is still kept when the email is refused, and says it was not sent', async () => {
    const resend = backend('resend');
    resend.refuse(SUPPORT);
    try {
      const res = await report({ kind: 'problem', subject: 'Email down', message: 'Nothing sends' });
      expect(res.status).toBe(201);
      expect(res.body.emailed).toBe(false);
      expect(res.body.report.emailedAt).toBeNull();
      expect(await prisma.supportRequest.findUnique({ where: { id: res.body.report.id } })).toMatchObject({ subject: 'Email down', emailedAt: null });
    } finally {
      resend.reset();
    }
  });
});
