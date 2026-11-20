const { Resend } = require('resend');
const prisma = require('./prisma');
const E = require('./emailLayout');
const { formatMoney, currencyOf } = require('./money');
const { broadcast } = require('./liveHub');
const { isDemoGym } = require('./sendEmail');

// Who a message can go to. Deactivated members are never written to.
const AUDIENCES = ['all', 'active', 'ending', 'inactive', 'owing', 'package', 'members'];
const LAPSED = ['frozen', 'suspended', 'expired', 'cancelled'];
const DAY = 864e5;

function audienceWhere(gymId, audience = {}) {
  const where = groupWhere(gymId, audience);
  const out = (audience.excludeIds || []).map(String);
  return out.length ? { AND: [where, { id: { notIn: out } }] } : where;
}

function groupWhere(gymId, audience) {
  const base = { gymId, status: { not: 'deactivated' } };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  switch (audience.type) {
    case 'active': return { ...base, status: { in: ['active', 'expiring', 'visitor'] } };
    case 'ending': return { ...base, isVisitor: false, status: { in: ['active', 'expiring'] }, endDate: { gte: today, lt: new Date(today.getTime() + 8 * DAY) } };
    case 'inactive': return { ...base, status: { in: LAPSED } };
    case 'owing': return { ...base, balance: { gt: 0 } };
    case 'package': return { ...base, packageId: String(audience.packageId || '') };
    case 'members': return { ...base, id: { in: (audience.memberIds || []).map(String) } };
    default: return base;
  }
}

const MEMBER_FIELDS = {
  id: true, firstName: true, lastName: true, email: true, phone: true, memberCode: true,
  endDate: true, balance: true, status: true, isVisitor: true, package: { select: { name: true } },
};
const resolveAudience = (gymId, audience) => prisma.member.findMany({ where: audienceWhere(gymId, audience), select: MEMBER_FIELDS, orderBy: { firstName: 'asc' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasEmail = (m) => EMAIL_RE.test(String(m.email || '').trim());

// What {firstName} and the like stand for, for one person
function fieldValues(m, gym) {
  const date = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  return {
    firstname: m.firstName || '', lastname: m.lastName || '', name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
    memberid: m.memberCode || '', enddate: date(m.endDate), balance: formatMoney(Math.max(0, m.balance || 0), currencyOf(gym)),
    package: m.package?.name || '', gymname: gym.name || '', gymphone: gym.phone || '',
  };
}

// {firstName} and the like, filled in for each person. Unknown names stay as written.
function personalise(text, m, gym) {
  const values = fieldValues(m, gym);
  return String(text || '').replace(/\{\s*([a-zA-Z]+)\s*\}/g, (all, key) => (key.toLowerCase() in values ? values[key.toLowerCase()] : all));
}

// The message as an email: the gym's own layout, the text as paragraphs
function emailHtml(gym, subject, body) {
  const paragraphs = String(body).split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
    .map(block => E.pHtml(E.esc(block).replace(/\n/g, '<br>')));
  return E.layout({ brand: E.gymBrand(gym), gym, preheader: String(body).replace(/\s+/g, ' ').slice(0, 110), title: subject, body: paragraphs.join('') });
}

const emailReady = () => !!process.env.RESEND_API_KEY;
// The sending address Resend gives every account before a domain is verified
// only delivers to the account's own inbox.
const emailTestMode = () => (process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev') === 'onboarding@resend.dev';
// Messages go by email only: texting was taken out (the owner, 20 November
// 2026) until a provider the gyms can afford is chosen. The channel columns
// stay so older rows still read.
function channelStatus() {
  return { email: { ready: emailReady(), testMode: emailTestMode(), from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev' } };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Emails go 100 to a request (Resend's batch), which keeps within its rate limit
async function sendEmails(gym, items) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const out = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const payload = chunk.map(it => ({
      from: E.sender(gym.name), to: it.address, subject: it.subject, html: it.html, text: it.text,
      ...(gym.email ? { replyTo: gym.email } : {}),
    }));
    let data = null, error = null;
    try { ({ data, error } = await resend.batch.send(payload, { batchValidation: 'permissive' })); } catch (err) { error = err; }
    if (error) { chunk.forEach(() => out.push({ ok: false, error: error.message || 'The email service refused the message' })); continue; }
    const failed = new Map((data?.errors || []).map(e => [e.index, e.message]));
    const ids = data?.data || [];
    let k = 0;
    chunk.forEach((_, idx) => {
      if (failed.has(idx)) out.push({ ok: false, error: failed.get(idx) });
      else out.push({ ok: true, id: ids[k++]?.id || null });
    });
    if (i + 100 < items.length) await sleep(600);
  }
  return out;
}

// Sends a message to everyone it is for, records each delivery and the totals.
// only: a list of earlier delivery rows to try again (Retry failed) instead.
async function deliverCommunication(id, { only = null } = {}) {
  const comm = await prisma.communication.findUnique({ where: { id } });
  if (!comm) return null;
  const gym = await prisma.gym.findUnique({ where: { id: comm.gymId } });
  const members = only
    ? await prisma.member.findMany({ where: { gymId: comm.gymId, id: { in: [...new Set(only.map(d => d.memberId).filter(Boolean))] } }, select: MEMBER_FIELDS })
    : await resolveAudience(comm.gymId, comm.audience || {});
  const byId = new Map(members.map(m => [m.id, m]));
  const rows = [];
  const emails = [];
  const targets = only ? only.map(d => ({ m: byId.get(d.memberId), row: d })).filter(x => x.m) : members.map(m => ({ m }));
  for (const t of targets) {
    const name = `${t.m.firstName || ''} ${t.m.lastName || ''}`.trim();
    const base = { communicationId: comm.id, gymId: comm.gymId, memberId: t.m.id, name, channel: 'email', rowId: t.row?.id };
    if (isDemoGym(gym)) { rows.push({ ...base, status: 'skipped', error: 'Demo gym: nothing is sent' }); continue; }
    if (!hasEmail(t.m)) { rows.push({ ...base, status: 'skipped', error: 'No email address' }); continue; }
    const subject = personalise(comm.subject, t.m, gym), text = personalise(comm.body, t.m, gym);
    emails.push({ base: { ...base, address: t.m.email.trim() }, address: t.m.email.trim(), subject, text, html: emailHtml(gym, subject, text) });
  }
  const emailResults = emails.length ? await sendEmails(gym, emails) : [];
  emails.forEach((it, i) => rows.push({ ...it.base, status: emailResults[i].ok ? 'sent' : 'failed', error: emailResults[i].ok ? null : emailResults[i].error, providerId: emailResults[i].id || null }));

  // Record each delivery: a retry updates the row it retried
  for (const r of rows.filter(x => x.rowId)) {
    const { rowId, ...data } = r;
    await prisma.communicationDelivery.update({ where: { id: rowId }, data: { status: data.status, error: data.error || null, providerId: data.providerId || null, address: data.address || undefined } });
  }
  const fresh = rows.filter(x => !x.rowId).map((r) => {
    const row = { ...r };
    delete row.rowId;
    return row;
  });
  if (fresh.length) await prisma.communicationDelivery.createMany({ data: fresh });

  // Totals from every delivery of this message, so a retry adds up correctly
  const all = await prisma.communicationDelivery.findMany({ where: { communicationId: comm.id, channel: 'email' }, select: { memberId: true, status: true } });
  const count = (status) => all.filter(d => d.status === status).length;
  const totals = {
    total: new Set(all.map(d => d.memberId)).size,
    emailSent: count('sent'), emailFailed: count('failed'), skipped: count('skipped'),
  };
  // Someone with no email is counted apart (skipped), not as a failure
  const status = !totals.emailSent ? 'failed' : totals.emailFailed ? 'partial' : 'sent';
  const updated = await prisma.communication.update({ where: { id: comm.id }, data: { ...totals, channel: 'email', status, testMode: emailTestMode(), sentAt: comm.sentAt || new Date() } });
  broadcast(comm.gymId, { resource: 'communications', origin: null });
  return updated;
}

module.exports = { AUDIENCES, audienceWhere, resolveAudience, hasEmail, personalise, fieldValues, channelStatus, deliverCommunication, emailHtml };
