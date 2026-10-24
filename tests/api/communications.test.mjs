// The Communication page (J-21): who a message reaches, every delivery
// recorded (sent, failed with the reason, skipped), the fill-ins made for each
// person, retrying the failures, scheduling (sent once), drafts, and who may
// write to whom. Email goes to the fake Resend client; texts use the "log"
// provider, which sends nothing.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { startServer, backend, outbox } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode, eventually } from './helpers/fixtures.mjs';

// Sign-ups are limited to 10 an hour from one address, so each group of tests
// shares one gym (and every message has a subject of its own)
let api, stop, prisma, other;
beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  other = await registerGym(api);
});
afterAll(() => stop());
afterEach(() => { process.env.SMS_PROVIDER = ''; });

const audience = (gym, aud, extra = {}) => api.post('/api/communications/audience', { audience: aud, ...extra }, { token: gym.token });
const send = (gym, body, token = gym.token) => api.post('/api/communications', {
  action: 'send', channel: 'email', subject: `Hello {firstName} ${uniqueCode('s')}`,
  body: 'Hi {firstName}, you owe {balance}. {unknown} stays.', audience: { type: 'all' }, ...body,
}, { token });
const finished = (id) => eventually(async () => {
  const c = await prisma.communication.findUnique({ where: { id } });
  return c && c.status !== 'sending' && c;
}, { timeout: 8000 });
const deliveries = (id) => prisma.communicationDelivery.findMany({ where: { communicationId: id }, orderBy: { name: 'asc' } });
const mailFor = (address, subjectStart) => outbox().filter(m => m.to === address && String(m.subject).startsWith(subjectStart));

// A gym with members chosen for the audience rules: Ada owes money, Cy has
// no email, Dee is frozen, and Gone is deactivated
async function gymWithMembers() {
  const gym = await registerGym(api);
  const tag = uniqueCode('c');
  const mk = (firstName, extra = {}) => addMember(api, gym.token, { firstName, lastName: tag, email: `${firstName.toLowerCase()}.${tag}@example.test`, phone: '677112233', ...extra });
  const people = { ada: await mk('Ada', { balance: 3500 }), ben: await mk('Ben'), cy: await mk('Cy', { email: '' }), dee: await mk('Dee'), gone: await mk('Gone') };
  await prisma.member.update({ where: { id: people.dee.id }, data: { status: 'frozen' } });
  await prisma.member.update({ where: { id: people.gone.id }, data: { status: 'deactivated' } });
  return { gym, people };
}

describe('who a message reaches', () => {
  let gym, people;
  beforeAll(async () => { ({ gym, people } = await gymWithMembers()); });

  it('is everyone but deactivated members, counted by how they can be reached', async () => {
    const res = await audience(gym, { type: 'all' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, withEmail: 3, withPhone: 4 });
    expect(res.body.names.some(n => n.startsWith('Gone'))).toBe(false);
  });

  it('follows each group: owing, inactive, chosen people', async () => {
    expect((await audience(gym, { type: 'owing' })).body.total).toBe(1);
    expect((await audience(gym, { type: 'inactive' })).body.names).toEqual([expect.stringMatching(/^Dee /)]);
    expect((await audience(gym, { type: 'members', memberIds: [people.ben.id, people.gone.id] })).body.total).toBe(1);
  });

  it('lists the people on request, leaves out the ones taken off, and fills in the first one', async () => {
    const listed = await audience(gym, { type: 'all' }, { list: true });
    expect(listed.body.people).toHaveLength(4);
    expect(listed.body.people.find(p => p.id === people.cy.id)).toMatchObject({ email: false, phone: true });
    const without = await audience(gym, { type: 'all', excludeIds: [people.ada.id] });
    expect(without.body.total).toBe(3);
    expect(without.body.sample.firstname).toBe('Ben');
  });
});

describe('sending an email', () => {
  let gym, people;
  beforeAll(async () => { ({ gym, people } = await gymWithMembers()); });

  it('answers at once, then records a delivery for each person with their own fill-ins', async () => {
    const res = await send(gym, { subject: 'Hello {firstName} one' });
    expect(res.status).toBe(202);
    const done = await finished(res.body.id);
    // Cy has no address: skipped, not a failure
    expect(done).toMatchObject({ status: 'sent', total: 4, emailSent: 3, emailFailed: 0, skipped: 1 });
    const rows = await deliveries(res.body.id);
    expect(rows.find(r => r.memberId === people.cy.id)).toMatchObject({ status: 'skipped', error: 'No email address' });
    expect(rows.filter(r => r.status === 'sent')).toHaveLength(3);

    const [mail] = mailFor(people.ada.email, 'Hello Ada one');
    expect(mail.text).toMatch(/^Hi Ada, you owe 3[\s  ]?500 FCFA\. \{unknown\} stays\.$/);
    expect(mail.html).toContain('Hi Ada');
    expect(mailFor(people.gone.email, 'Hello')).toHaveLength(0);
    expect(mailFor(people.dee.email, 'Hello Dee one')).toHaveLength(1);
  });

  it('records a refused address with the reason, and Retry failed reaches them once fixed', async () => {
    const resend = backend('resend');
    resend.refuse(people.ben.email);
    const res = await send(gym, { subject: 'Hello {firstName} two' });
    const done = await finished(res.body.id);
    expect(done).toMatchObject({ status: 'partial', emailSent: 2, emailFailed: 1 });
    const failed = (await deliveries(res.body.id)).find(r => r.memberId === people.ben.id);
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatch(/refused/);

    resend.reset();
    const retry = await api.post(`/api/communications/${res.body.id}/retry`, {}, { token: gym.token });
    expect(retry.status).toBe(202);
    expect(retry.body.retrying).toBe(1);
    const again = await eventually(async () => {
      const c = await prisma.communication.findUnique({ where: { id: res.body.id } });
      return c.status === 'sent' && c;
    }, { timeout: 8000 });
    expect(again).toMatchObject({ emailSent: 3, emailFailed: 0 });
    expect(mailFor(people.ben.email, 'Hello Ben two')).toHaveLength(1);
    // Nothing left to retry
    expect((await api.post(`/api/communications/${res.body.id}/retry`, {}, { token: gym.token })).status).toBe(400);
  });

  // F-054: each request took the message after only reading its status, so
  // two at the same moment both went ahead and mailed people twice
  it('retries once when Retry is pressed twice at the same moment', async () => {
    const resend = backend('resend');
    resend.refuse(people.ben.email);
    const res = await send(gym, { subject: 'Hello {firstName} retried' });
    await finished(res.body.id);
    resend.reset();
    const both = await Promise.all([1, 2].map(() => api.post(`/api/communications/${res.body.id}/retry`, {}, { token: gym.token })));
    expect(both.map(r => r.status).sort()).toEqual([202, 409]);
    await eventually(async () => (await prisma.communication.findUnique({ where: { id: res.body.id } })).status === 'sent', { timeout: 8000 });
    expect(mailFor(people.ben.email, 'Hello Ben retried')).toHaveLength(1);
  });

  it('sends a draft once when Send is pressed twice at the same moment', async () => {
    const draft = await send(gym, { action: 'draft', subject: 'Draft {firstName} once' });
    expect(draft.status).toBe(201);
    const both = await Promise.all([1, 2].map(() => send(gym, { id: draft.body.id, subject: 'Draft {firstName} once' })));
    expect(both.map(r => r.status).sort()).toEqual([202, 409]);
    await finished(draft.body.id);
    expect(mailFor(people.ada.email, 'Draft Ada once')).toHaveLength(1);
  });

  it('shows on each member\'s profile what they were sent', async () => {
    const res = await send(gym, { audience: { type: 'members', memberIds: [people.cy.id] }, channel: 'email' });
    await finished(res.body.id);
    const cy = await api.get(`/api/communications/member/${people.cy.id}`, { token: gym.token });
    expect(cy.body.map(d => d.communication.id)).toContain(res.body.id);
    const ada = await api.get(`/api/communications/member/${people.ada.id}`, { token: gym.token });
    expect(ada.body.map(d => d.communication.id)).not.toContain(res.body.id);
    expect((await api.get(`/api/communications/member/${people.ada.id}`, { token: other.token })).status).toBe(404);
  });
});

describe('a message that cannot go', () => {
  let gym;
  beforeAll(async () => { ({ gym } = await gymWithMembers()); });

  it('names the field it is missing', async () => {
    expect((await send(gym, { channel: 'pigeon' })).body.field).toBe('channel');
    expect((await send(gym, { subject: '' })).body.field).toBe('subject');
    expect((await send(gym, { body: '' })).body.field).toBe('body');
    expect((await send(gym, { audience: { type: 'members', memberIds: [] } })).body.field).toBe('audience');
  });

  it('cannot go by text while texting is not set up', async () => {
    const res = await send(gym, { channel: 'sms' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('channel');
  });

  it('cannot be a text of more than 6 parts', async () => {
    process.env.SMS_PROVIDER = 'log';
    const res = await send(gym, { channel: 'sms', body: 'x'.repeat(153 * 6 + 1) });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('body');
  });

  it('goes by text in test mode to each number in its international form', async () => {
    process.env.SMS_PROVIDER = 'log';
    const res = await send(gym, { channel: 'sms', subject: '', body: 'Hi {firstName}' });
    expect(res.status).toBe(202);
    const done = await finished(res.body.id);
    expect(done).toMatchObject({ status: 'sent', smsSent: 4, testMode: true });
    expect((await deliveries(res.body.id)).every(r => r.address === '+237677112233')).toBe(true);
  });
});

describe('who may write', () => {
  let gym, people, desk, coach;
  beforeAll(async () => {
    ({ gym, people } = await gymWithMembers());
    desk = await addStaff(api, gym, { role: 'front_desk' });
    coach = await addStaff(api, gym, { role: 'trainer' });
  });

  it('the desk may write to one member, never to a group; a coach to nobody', async () => {
    expect((await send(gym, { audience: { type: 'members', memberIds: [people.ada.id] } }, desk.token)).status).toBe(202);
    expect((await send(gym, { audience: { type: 'all' } }, desk.token)).status).toBe(403);
    expect((await send(gym, { audience: { type: 'members', memberIds: [people.ada.id, people.ben.id] } }, desk.token)).status).toBe(403);
    expect((await send(gym, { audience: { type: 'members', memberIds: [people.ada.id] } }, coach.token)).status).toBe(403);
    expect((await api.get('/api/communications', { token: desk.token })).status).toBe(403);
  });

  it('cannot reach another gym\'s members', async () => {
    const res = await send(other, { audience: { type: 'members', memberIds: [people.ada.id] }, subject: 'Not yours {firstName}' });
    expect(res.status).toBe(400);
    expect(mailFor(people.ada.email, 'Not yours')).toHaveLength(0);
  });
});

describe('scheduling and drafts', () => {
  let gym, people;
  beforeAll(async () => { ({ gym, people } = await gymWithMembers()); });

  it('refuses a time already passed, and keeps a future one until it is due', async () => {
    const past = await send(gym, { action: 'schedule', scheduledAt: new Date(Date.now() - 3600e3).toISOString() });
    expect(past.body.field).toBe('scheduledAt');
    const later = await send(gym, { action: 'schedule', scheduledAt: new Date(Date.now() + 3600e3).toISOString() });
    expect(later.status).toBe(201);
    expect(later.body.status).toBe('scheduled');
    await backend('./jobs/scheduledMessages.js').runScheduledMessages();
    expect((await prisma.communication.findUnique({ where: { id: later.body.id } })).status).toBe('scheduled');
  });

  it('sends a due message once, even when two runs overlap', async () => {
    const res = await send(gym, { action: 'schedule', scheduledAt: new Date(Date.now() + 60e3).toISOString(), subject: 'Due {firstName} now' });
    await prisma.communication.update({ where: { id: res.body.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    const job = backend('./jobs/scheduledMessages.js');
    await Promise.all([job.runScheduledMessages(), job.runScheduledMessages()]);
    const done = await finished(res.body.id);
    expect(done.status).toBe('sent');
    expect(mailFor(people.ada.email, 'Due Ada now')).toHaveLength(1);
    expect(await deliveries(res.body.id)).toHaveLength(4);
  });

  // F-178: a send cut off by a restart stayed "sending" for good, which
  // refuses Retry and Edit; an hour after it began it is marked failed
  it('marks a send cut off by a restart as failed after an hour, and leaves one under way alone', async () => {
    const sending = (minutesAgo) => prisma.communication.create({ data: {
      gymId: gym.user.gymId, subject: 'Cut off', body: 'Hello', channel: 'email', status: 'sending',
      audience: { type: 'all' }, updatedAt: new Date(Date.now() - minutesAgo * 60e3),
    } });
    const cutOff = await sending(61);
    const underWay = await sending(2);
    await backend('./jobs/scheduledMessages.js').runScheduledMessages();
    expect((await prisma.communication.findUnique({ where: { id: cutOff.id } })).status).toBe('failed');
    expect((await prisma.communication.findUnique({ where: { id: underWay.id } })).status).toBe('sending');
  });

  it('turns a cancelled schedule back into a draft, and a sent message cannot be edited', async () => {
    const later = await send(gym, { action: 'schedule', scheduledAt: new Date(Date.now() + 3600e3).toISOString() });
    expect((await api.post(`/api/communications/${later.body.id}/cancel`, {}, { token: gym.token })).status).toBe(200);
    expect((await prisma.communication.findUnique({ where: { id: later.body.id } })).status).toBe('draft');
    expect((await api.post(`/api/communications/${later.body.id}/cancel`, {}, { token: gym.token })).status).toBe(409);

    const draft = await send(gym, { action: 'draft', subject: '', body: 'Just an idea' });
    expect(draft.status).toBe(201);
    expect(draft.body.status).toBe('draft');
    const sent = await send(gym, { id: draft.body.id, subject: 'Now {firstName}' });
    expect(sent.status).toBe(202);
    expect(sent.body.id).toBe(draft.body.id);
    await finished(draft.body.id);
    expect((await send(gym, { id: draft.body.id, action: 'draft' })).status).toBe(409);
  });
});
