// GEM's admin dashboard (20 November 2026): its own sign-in apart from every
// gym, the gyms and their trials, pausing an account (only billing, sign-in
// and support answer), a month's bills from draft to paid, the monthly job,
// leads from the landing page, answering problem reports, announcements and
// the platform's settings. Email goes to the fake Resend client.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, backend, outbox } from './helpers/server.mjs';
import { registerGym, addStaff, addMember, uniqueCode, eventually, OWNER_PASSWORD } from './helpers/fixtures.mjs';

const ADMIN = { email: 'admin@gem.test', password: 'Admin-pass-for-tests-1' };
// Sign-ups are limited to 10 an hour from one address, so most tests share
// two gyms made here; only the bills and the lead that signs up make their own
let api, stop, prisma, admin, billing, plain, other;
beforeAll(async () => {
  ({ api, stop, prisma } = await startServer());
  billing = backend('./utils/billing.js');
  const res = await api.post('/api/admin/login', ADMIN);
  expect(res.status).toBe(200);
  admin = res.body.token;
  plain = await registerGym(api);
  other = await registerGym(api);
  // The platform's settings are one row for the whole database: known values
  await api.put('/api/admin/settings', { pricePerMember: 250, currency: 'XAF', dueDays: 10, trialDays: 7, paymentInstructions: 'MTN MoMo 670 000 000 (GEM)' }, { token: admin });
});
afterAll(() => stop());

const as = (token) => ({ token });
const mailTo = (to, start) => outbox().filter(m => m.to === to && String(m.subject).startsWith(start));

// A gym whose trial ended long ago, with members active on the last day of
// last month: the one a month's bills are about
async function payingGym({ members = 3, trialEnd } = {}) {
  const gym = await registerGym(api);
  const period = billing.previousPeriod();
  const { start, end } = billing.periodBounds(period);
  await prisma.gym.update({ where: { id: gym.user.gymId }, data: { createdAt: new Date(start.getTime() - 60 * 864e5), ...(trialEnd ? { trialEndsAt: trialEnd(start) } : {}) } });
  for (let i = 0; i < members; i += 1) {
    const m = await addMember(api, gym.token, { regFeeMethod: 'cash' });
    await prisma.member.update({ where: { id: m.id }, data: { status: 'active', startDate: new Date(start.getTime() - 5 * 864e5), endDate: new Date(end.getTime() + 20 * 864e5) } });
  }
  return { gym, period, gymId: gym.user.gymId };
}

describe('signing in to the admin dashboard', () => {
  it('opens with the server\'s admin email and password, whatever the email\'s capitals, and with nothing else', async () => {
    const ok = await api.post('/api/admin/login', { email: '  ADMIN@gem.test ', password: ADMIN.password });
    expect(ok.status).toBe(200);
    expect(ok.body.admin).toEqual({ email: 'admin@gem.test' });
    expect((await api.post('/api/admin/login', { email: ADMIN.email, password: 'nope' })).status).toBe(401);
    expect((await api.get('/api/admin/overview')).status).toBe(401);
  });

  it('keeps gyms and the admin apart: neither token opens the other', async () => {
    expect((await api.get('/api/admin/overview', as(plain.token))).status).toBe(401);
    expect((await api.get('/api/members', as(admin))).status).toBe(401);
    expect((await api.get('/api/admin/me', as(admin))).body).toEqual({ email: 'admin@gem.test' });
  });

  it('ends a session on sign-out', async () => {
    const { body } = await api.post('/api/admin/login', ADMIN);
    expect((await api.post('/api/admin/logout', {}, as(body.token))).status).toBe(200);
    expect((await api.get('/api/admin/overview', as(body.token))).status).toBe(401);
  });

  it('says so when the server has no admin account set up', async () => {
    const saved = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = '';
    try {
      expect((await api.post('/api/admin/login', ADMIN)).status).toBe(503);
      expect((await api.get('/api/admin/overview', as(admin))).status).toBe(401);
    } finally {
      process.env.ADMIN_PASSWORD = saved;
    }
  });

  it('leaves "admin" to the dashboard: no gym can take it as its code', async () => {
    expect((await api.get('/api/auth/check-code/admin')).body).toEqual({ available: false });
    const res = await api.post('/api/auth/register', { gymCode: 'admin', gymName: 'Admin Gym', firstName: 'A', lastName: 'B', email: `x.${uniqueCode('a')}@example.test`, password: OWNER_PASSWORD });
    expect(res.status).toBe(409);
  });
});

describe('the gyms', () => {
  it('lists each gym with its owner, trial, members and nothing owed yet', async () => {
    const gym = plain;
    await addMember(api, gym.token, { regFeeMethod: 'cash' });
    const found = (await api.get(`/api/admin/gyms?q=${gym.gymCode}`, as(admin))).body;
    expect(found).toMatchObject({ total: 1, counts: { all: expect.any(Number), trial: expect.any(Number) } });
    const list = found.gyms;
    const mine = list.find(g => g.id === gym.user.gymId);
    expect(mine).toMatchObject({
      code: gym.gymCode, onTrial: true, trialDaysLeft: 7, rate: 250, customRate: false, locked: null, monthlyEstimate: 0,
      owner: { email: gym.email }, members: { billable: 1, total: 1 }, owes: { outstanding: 0, overdue: 0 },
    });
    const detail = (await api.get(`/api/admin/gyms/${gym.user.gymId}`, as(admin))).body;
    expect(detail).toMatchObject({ code: gym.gymCode, adminNote: '', invoices: [], staffByRole: { general_manager: 1 } });
  });

  it('takes its own price, a longer trial and a private note, and goes back to the standard price', async () => {
    const gym = plain;
    const id = gym.user.gymId;
    const saved = (await api.patch(`/api/admin/gyms/${id}`, { billingRate: 200, trialEndsAt: billing.periodOf(new Date()) + '-28', adminNote: 'Pays by MoMo' }, as(admin))).body;
    expect(saved).toMatchObject({ rate: 200, customRate: true });
    expect((await api.get(`/api/admin/gyms/${id}`, as(admin))).body.adminNote).toBe('Pays by MoMo');
    expect((await api.patch(`/api/admin/gyms/${id}`, { billingRate: -1 }, as(admin))).body.field).toBe('billingRate');
    expect((await api.patch(`/api/admin/gyms/${id}`, { billingRate: null }, as(admin))).body).toMatchObject({ rate: 250, customRate: false });
    // The gym never reads GEM's note about it
    expect(JSON.stringify((await api.get('/api/billing', as(gym.token))).body)).not.toContain('Pays by MoMo');
    // Back to the usual trial from the day it signed up
    expect((await api.patch(`/api/admin/gyms/${id}`, { trialEndsAt: null }, as(admin))).body).toMatchObject({ onTrial: true, trialDaysLeft: 7 });
  });
});

describe('pausing a gym', () => {
  it('leaves only sign-in, billing and support open, tells the owner by email, and reopens', async () => {
    const gym = plain;
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    const id = gym.user.gymId;
    expect((await api.post(`/api/admin/gyms/${id}/lock`, {}, as(admin))).body.field).toBe('reason');
    expect((await api.post(`/api/admin/gyms/${id}/lock`, { reason: 'October bill unpaid' }, as(admin))).status).toBe(200);
    expect((await api.post(`/api/admin/gyms/${id}/lock`, { reason: 'again' }, as(admin))).status).toBe(409);

    const refused = await api.get('/api/members', as(gym.token));
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('GYM_LOCKED');
    expect((await api.get('/api/attendance', as(desk.token))).body.code).toBe('GYM_LOCKED');
    expect((await api.get('/api/billing/status', as(desk.token))).body).toEqual({ locked: true, reason: 'October bill unpaid', isOwner: false });
    expect((await api.get('/api/billing', as(gym.token))).body.locked).toMatchObject({ reason: 'October bill unpaid' });
    expect((await api.get('/api/auth/me', as(gym.token))).body.gymLocked).toBe(true);
    expect((await api.post('/api/support', { kind: 'question', subject: 'Why paused?', message: 'We paid' }, as(gym.token))).status).toBe(201);
    const signIn = await api.post('/api/auth/login', { gymCode: gym.gymCode, email: gym.email, password: OWNER_PASSWORD });
    expect(signIn.body.user.gymLocked).toBe(true);
    expect(await eventually(() => mailTo(gym.email, 'Your GEM account for').length === 1)).toBe(true);
    const listed = (await api.get(`/api/admin/gyms?filter=paused&q=${gym.gymCode}`, as(admin))).body.gyms.find(g => g.id === id);
    expect(listed.locked).toMatchObject({ reason: 'October bill unpaid' });

    expect((await api.post(`/api/admin/gyms/${id}/unlock`, {}, as(admin))).status).toBe(200);
    expect((await api.get('/api/members', as(gym.token))).status).toBe(200);
    expect((await api.get('/api/auth/me', as(gym.token))).body.gymLocked).toBe(false);
    const notices = (await api.get('/api/notifications', as(gym.token))).body;
    expect(notices.some(n => n.title === 'Your GEM account is open again')).toBe(true);
    // GEM's own entries in the gym's log do not count as the gym using GEM
    const log = await prisma.activityLog.findMany({ where: { gymId: id, actorRole: 'gem' } });
    expect(log.map(l => l.action).sort()).toEqual(['gym.locked', 'gym.unlocked']);
  });
});

describe('a month\'s bills', () => {
  it('charges the members active on the month\'s last day, only for the days after the trial', async () => {
    // The trial ends at 14:00 on the 10th: charged from the 11th
    const { gymId, period } = await payingGym({ members: 3, trialEnd: (start) => new Date(start.getFullYear(), start.getMonth(), 10, 14) });
    expect((await api.post('/api/admin/invoices/prepare', { period }, as(admin))).status).toBe(201);
    const { days } = billing.periodBounds(period);
    const inv = await prisma.gymInvoice.findUnique({ where: { gymId_period: { gymId, period } } });
    expect(inv).toMatchObject({ status: 'draft', members: 3, rate: 250, currency: 'XAF', billableDays: days - 10, daysInPeriod: days, amount: Math.round((3 * 250 * (days - 10)) / days) });
    // Preparing again makes no second bill
    await api.post('/api/admin/invoices/prepare', { period }, as(admin));
    expect(await prisma.gymInvoice.count({ where: { gymId, period } })).toBe(1);
  });

  it('leaves out a gym still on its trial, one made after the month, and a month not over', async () => {
    const fresh = plain;
    const period = billing.previousPeriod();
    await api.post('/api/admin/invoices/prepare', { period }, as(admin));
    expect(await prisma.gymInvoice.count({ where: { gymId: fresh.user.gymId } })).toBe(0);
    const thisMonth = billing.periodOf(new Date());
    expect((await api.post('/api/admin/invoices/prepare', { period: thisMonth }, as(admin))).body.error).toMatch(/over/);
  });

  it('goes from draft to sent to overdue to paid, telling the owner each time, and reopens a gym paused for it', async () => {
    const { gym, gymId, period } = await payingGym({ members: 4 });
    await api.post('/api/admin/invoices/prepare', { period }, as(admin));
    const list = (await api.get(`/api/admin/invoices?period=${period}&q=${gym.gymCode}`, as(admin))).body;
    expect(list).toMatchObject({ total: 1, counts: { draft: expect.any(Number) } });
    expect(list.counts.all).toBeGreaterThanOrEqual(1);
    const draft = list.invoices.find(i => i.gymId === gymId);
    expect(draft).toMatchObject({ state: 'draft', amount: 1000, gym: { code: gym.gymCode } });
    // The gym does not see a draft
    expect((await api.get('/api/billing', as(gym.token))).body.invoices).toEqual([]);

    const edited = (await api.patch(`/api/admin/invoices/${draft.id}`, { members: 5, discount: 50, note: 'Welcome discount' }, as(admin))).body;
    expect(edited).toMatchObject({ members: 5, discount: 50, amount: 1200, note: 'Welcome discount' });
    expect((await api.patch(`/api/admin/invoices/${draft.id}`, { members: -2 }, as(admin))).body.field).toBe('members');

    const sent = (await api.post(`/api/admin/invoices/${draft.id}/send`, {}, as(admin))).body;
    expect(sent.state).toBe('sent');
    expect(new Date(sent.dueDate) - new Date(sent.sentAt)).toBeGreaterThan(9 * 864e5);
    expect((await api.post(`/api/admin/invoices/${draft.id}/send`, {}, as(admin))).status).toBe(409);
    expect((await api.patch(`/api/admin/invoices/${draft.id}`, { members: 1 }, as(admin))).status).toBe(409);
    expect(await eventually(() => mailTo(gym.email, 'Your GEM bill for').length === 1)).toBe(true);
    const [billMail] = mailTo(gym.email, 'Your GEM bill for');
    expect(billMail.html).toContain('MTN MoMo 670 000 000 (GEM)');
    expect(billMail.html).toContain('Welcome discount');
    const owed = (await api.get('/api/billing', as(gym.token))).body;
    expect(owed.invoices).toEqual([expect.objectContaining({ id: draft.id, state: 'sent', amount: 1200 })]);
    expect(owed.paymentInstructions).toBe('MTN MoMo 670 000 000 (GEM)');
    expect((await api.get('/api/notifications', as(gym.token))).body.some(n => n.title.startsWith('Your GEM bill for'))).toBe(true);

    // Past its due date: overdue, on the overview, reminded, then paused
    await prisma.gymInvoice.update({ where: { id: draft.id }, data: { dueDate: new Date(Date.now() - 3 * 864e5) } });
    const overview = (await api.get('/api/admin/overview', as(admin))).body;
    expect(overview.attention).toContainEqual(expect.objectContaining({ type: 'overdue', gymId, amount: 1200, days: 3 }));
    // The menu's Billing badge counts it
    expect((await api.get('/api/admin/counts', as(admin))).body.billing).toBeGreaterThanOrEqual(1);
    expect((await api.post(`/api/admin/invoices/${draft.id}/remind`, {}, as(admin))).body.state).toBe('overdue');
    expect(await eventually(() => mailTo(gym.email, 'Reminder: your GEM bill').length === 1)).toBe(true);
    await api.post(`/api/admin/gyms/${gymId}/lock`, { reason: 'Bill overdue' }, as(admin));

    expect((await api.post(`/api/admin/invoices/${draft.id}/paid`, { method: 'pigeon' }, as(admin))).body.field).toBe('method');
    const paid = (await api.post(`/api/admin/invoices/${draft.id}/paid`, { method: 'mobile_money', reference: 'MP123' }, as(admin))).body;
    expect(paid).toMatchObject({ state: 'paid', paidAmount: 1200, paidMethod: 'mobile_money', paidReference: 'MP123', reopened: true });
    expect((await api.get('/api/members', as(gym.token))).status).toBe(200);
    expect(await eventually(() => mailTo(gym.email, 'Thank you: GEM received').length === 1)).toBe(true);
    expect((await api.post(`/api/admin/invoices/${draft.id}/void`, {}, as(admin))).status).toBe(409);
  });

  it('sends every draft of a month at once, and a voided bill is no longer owed', async () => {
    const a = await payingGym({ members: 1 });
    const b = await payingGym({ members: 2 });
    await api.post('/api/admin/invoices/prepare', { period: a.period }, as(admin));
    const billOf = (gymId) => prisma.gymInvoice.findUnique({ where: { gymId_period: { gymId, period: a.period } } });
    const toVoid = await billOf(b.gymId);
    expect((await api.post(`/api/admin/invoices/${toVoid.id}/void`, { reason: 'Free month' }, as(admin))).body).toMatchObject({ state: 'void', note: 'Voided: Free month' });
    const res = await api.post('/api/admin/invoices/send-all', { period: a.period }, as(admin));
    expect(res.body.sent).toBeGreaterThanOrEqual(1);
    expect((await billOf(a.gymId)).status).toBe('sent');
    expect((await billOf(b.gymId)).status).toBe('void');
  });
});

describe('the monthly job', () => {
  it('starts from the month just ended, then prepares each month once', async () => {
    const job = backend('./jobs/monthlyBills.js');
    const period = billing.previousPeriod();
    await prisma.platformSettings.update({ where: { id: 1 }, data: { lastPreparedPeriod: null } });
    expect(await job.runMonthlyBills()).toEqual({ prepared: 0, started: period });

    const { gymId } = await payingGym({ members: 2 });
    // A month already prepared is not prepared again
    expect(await job.runMonthlyBills()).toEqual({ prepared: 0 });
    expect(await prisma.gymInvoice.count({ where: { gymId } })).toBe(0);

    // The month before was the last one prepared: last month's bills are made, and the admin is told
    await prisma.platformSettings.update({ where: { id: 1 }, data: { lastPreparedPeriod: billing.periodOf(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)) } });
    const run = await job.runMonthlyBills();
    expect(run.prepared).toBeGreaterThanOrEqual(1);
    expect(await prisma.gymInvoice.count({ where: { gymId, period } })).toBe(1);
    expect(await eventually(() => outbox().some(m => m.to === ADMIN.email && /bills? ready for/.test(m.subject)))).toBe(true);
    expect((await prisma.platformSettings.findUnique({ where: { id: 1 } })).lastPreparedPeriod).toBe(period);
  });
});

describe('leads', () => {
  const lead = (extra = {}) => ({ name: 'Paul Prospect', gymName: `Iron Club ${uniqueCode('l')}`, email: `paul.${uniqueCode('l')}@example.test`, phone: '+237 677 111 222', city: 'Yaoundé', members: 120, message: 'We use paper today.', ...extra });

  it('arrive from the landing page, reach the admin by email, and are listed', async () => {
    const body = lead();
    expect((await api.post('/api/leads', body)).status).toBe(201);
    const listed = (await api.get('/api/admin/leads', as(admin))).body.find(l => l.gymName === body.gymName);
    expect(listed).toMatchObject({ name: 'Paul Prospect', source: 'website', status: 'new', members: 120, gym: null });
    expect(await eventually(() => outbox().some(m => m.to === ADMIN.email && m.subject === `New lead: ${body.gymName}`))).toBe(true);
  });

  it('name what is missing, and quietly drop what only a robot would send', async () => {
    expect((await api.post('/api/leads', lead({ name: '' }))).body.field).toBe('name');
    expect((await api.post('/api/leads', lead({ email: '', phone: '' }))).body.field).toBe('email');
    expect((await api.post('/api/leads', lead({ email: 'nope' }))).body.field).toBe('email');
    const robot = lead({ website: 'http://spam.example' });
    expect((await api.post('/api/leads', robot)).status).toBe(201);
    expect(await prisma.lead.count({ where: { gymName: robot.gymName } })).toBe(0);
  });

  it('move through their stages, and a lead who signs up is won and linked to their gym', async () => {
    const email = `Owner.${uniqueCode('w')}@Example.test`;
    const made = (await api.post('/api/admin/leads', lead({ email, status: 'demo', nextFollowUp: billing.periodOf(new Date()) + '-01' }), as(admin))).body;
    expect(made).toMatchObject({ source: 'manual', status: 'demo' });
    expect((await api.patch(`/api/admin/leads/${made.id}`, { status: 'maybe' }, as(admin))).body.field).toBe('status');
    expect((await api.get('/api/admin/overview', as(admin))).body.leads.followUps).toBeGreaterThanOrEqual(1);

    const gym = await registerGym(api, { email: email.toLowerCase() });
    expect(await eventually(async () => (await prisma.lead.findUnique({ where: { id: made.id } })).gymId === gym.user.gymId)).toBe(true);
    const won = (await api.get('/api/admin/leads', as(admin))).body.find(l => l.id === made.id);
    expect(won).toMatchObject({ status: 'won', nextFollowUp: null, gym: { code: gym.gymCode } });
  });

  it('are limited to five an hour from one address', async () => {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await api.post('/api/leads', lead())).status);
    // One was sent above from this address: the fifth more is refused
    expect(statuses.filter(s => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});

describe('problem reports', () => {
  it('reach the admin from every gym, and the answer reaches the sender in GEM and by email', async () => {
    const gym = plain;
    const subject = `Check-in stuck ${uniqueCode('p')}`;
    const sent = (await api.post('/api/support', { kind: 'problem', subject, message: 'Nothing happens', page: '/attendance' }, as(gym.token))).body.report;
    expect((await api.get('/api/admin/counts', as(admin))).body.problems).toBeGreaterThanOrEqual(1);
    const listed = (await api.get('/api/admin/support', as(admin))).body.find(r => r.id === sent.id);
    expect(listed).toMatchObject({ status: 'new', gym: { code: gym.gymCode }, page: '/attendance', senderEmail: gym.email });

    expect((await api.patch(`/api/admin/support/${sent.id}`, { status: 'in_progress', adminNote: 'Looking at the scanner' }, as(admin))).body.status).toBe('in_progress');
    expect((await api.post(`/api/admin/support/${sent.id}/reply`, { reply: '' }, as(admin))).body.field).toBe('reply');
    const answered = (await api.post(`/api/admin/support/${sent.id}/reply`, { reply: 'Fixed: reload the page.', resolve: true }, as(admin))).body;
    expect(answered).toMatchObject({ status: 'resolved', reply: 'Fixed: reload the page.' });

    const mine = (await api.get('/api/support', as(gym.token))).body.find(r => r.id === sent.id);
    expect(mine).toMatchObject({ status: 'resolved', reply: 'Fixed: reload the page.' });
    expect(mine).not.toHaveProperty('adminNote');
    const notices = (await api.get('/api/notifications', as(gym.token))).body;
    expect(notices.some(n => n.title === `GEM support answered: ${subject}` && n.link === '/support')).toBe(true);
    expect(await eventually(() => mailTo(gym.email, `Re: ${subject}`).length === 1)).toBe(true);
  });
});

describe('announcements', () => {
  // Every gym of a test database holding tens of thousands: given more time
  it('reach one gym, or every gym, as a notification and an email to the owners', async () => {
    const one = plain;
    const title = `Maintenance tonight ${uniqueCode('n')}`;
    expect((await api.post('/api/admin/announcements', { title: '', body: 'x' }, as(admin))).body.field).toBe('title');
    const sent = (await api.post('/api/admin/announcements', { title, body: 'GEM is down from 22:00 to 23:00.', gymId: one.user.gymId, email: true }, as(admin))).body;
    expect(sent).toMatchObject({ gyms: 1, emailed: true, gymName: expect.stringContaining('Test Gym') });
    expect((await api.get('/api/notifications', as(one.token))).body.some(n => n.title === title)).toBe(true);
    expect((await api.get('/api/notifications', as(other.token))).body.some(n => n.title === title)).toBe(false);
    expect(await eventually(() => mailTo(one.email, title).length === 1)).toBe(true);

    const everyone = (await api.post('/api/admin/announcements', { title: `${title} (all)`, body: 'Hello' }, as(admin))).body;
    expect(everyone.gyms).toBeGreaterThanOrEqual(2);
    expect((await api.get('/api/notifications', as(other.token))).body.some(n => n.title === `${title} (all)`)).toBe(true);
    expect((await api.get('/api/admin/announcements', as(admin))).body.slice(0, 2).map(a => a.title)).toEqual([`${title} (all)`, title]);
  }, 90_000);
});

describe('the platform\'s settings', () => {
  it('are checked, kept, and used for new bills and a gym\'s plan', async () => {
    expect((await api.put('/api/admin/settings', { pricePerMember: 300, currency: 'XA', dueDays: 10, trialDays: 7 }, as(admin))).body.field).toBe('currency');
    expect((await api.put('/api/admin/settings', { pricePerMember: 300, currency: 'xaf', dueDays: 91, trialDays: 7 }, as(admin))).body.field).toBe('dueDays');
    const saved = (await api.put('/api/admin/settings', { pricePerMember: 300, currency: 'xaf', dueDays: 14, trialDays: 7, paymentInstructions: 'Pay to GEM' }, as(admin))).body;
    expect(saved).toMatchObject({ pricePerMember: 300, currency: 'XAF', dueDays: 14 });
    const gym = plain;
    expect((await api.get('/api/billing', as(gym.token))).body).toMatchObject({ rate: 300, onTrial: true, paymentInstructions: 'Pay to GEM' });
    // Only the owner sees the gym's bills
    const desk = await addStaff(api, gym, { role: 'front_desk' });
    expect((await api.get('/api/billing', as(desk.token))).status).toBe(403);
    await api.put('/api/admin/settings', { pricePerMember: 250, currency: 'XAF', dueDays: 10, trialDays: 7, paymentInstructions: 'MTN MoMo 670 000 000 (GEM)' }, as(admin));
  });
});

// Last: it locks this address out of signing in for 15 minutes
describe('guessing the admin password', () => {
  it('is stopped after five wrong tries from one address, even with the right password next', async () => {
    const tries = [];
    for (let i = 0; i < 5; i += 1) tries.push((await api.post('/api/admin/login', { email: ADMIN.email, password: `wrong-${i}` })).status);
    expect(tries.every(s => s === 401) || tries.includes(429)).toBe(true);
    const next = await api.post('/api/admin/login', ADMIN);
    expect(next.status).toBe(429);
  });
});
