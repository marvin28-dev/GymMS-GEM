const { Resend } = require('resend');
const prisma = require('./prisma');
const E = require('./emailLayout');
const { formatMoney, currencyOf } = require('./money');
const { readPhone } = require('./phone');
const { smsStatus, sendSms } = require('./sms');
const { broadcast } = require('./liveHub');

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
function channelStatus() {
  return {
    email: { ready: emailReady(), testMode: emailTestMode(), from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev' },
    sms: smsStatus(),
  };
}

const wants = (channel, kind) => channel === kind || channel === 'both';
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

// Texts go two at a time: providers queue them, and a burst can be refused
async function sendTexts(items) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { const r = await sendSms({ to: items[i].address, body: items[i].text }); out[i] = { ok: true, id: r.id }; }
      catch (err) { out[i] = { ok: false, error: err.message || 'The text could not be sent' }; }
    }
  };
  await Promise.all([worker(), worker()]);
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
  const sms = smsStatus();
  const rows = [];
  const emails = [], texts = [];
  const targets = only ? only.map(d => ({ m: byId.get(d.memberId), channel: d.channel, row: d })).filter(x => x.m) : members.flatMap(m => [
    ...(wants(comm.channel, 'email') ? [{ m, channel: 'email' }] : []),
    ...(wants(comm.channel, 'sms') ? [{ m, channel: 'sms' }] : []),
  ]);
  for (const t of targets) {
    const name = `${t.m.firstName || ''} ${t.m.lastName || ''}`.trim();
    const base = { communicationId: comm.id, gymId: comm.gymId, memberId: t.m.id, name, channel: t.channel, rowId: t.row?.id };
    if (t.channel === 'email') {
      if (!hasEmail(t.m)) { rows.push({ ...base, status: 'skipped', error: 'No email address' }); continue; }
      const subject = personalise(comm.subject, t.m, gym), text = personalise(comm.body, t.m, gym);
      emails.push({ base: { ...base, address: t.m.email.trim() }, address: t.m.email.trim(), subject, text, html: emailHtml(gym, subject, text) });
    } else {
      const read = readPhone(t.m.phone, gym.country, gym.phone);
      const phone = read.e164;
      if (!phone) { rows.push({ ...base, status: 'skipped', error: { missing: 'No phone number', no_country: 'No country code: set the gym’s country in Settings', invalid: 'The phone number is not valid' }[read.problem] }); continue; }
      if (!sms.ready) { rows.push({ ...base, address: phone, status: 'failed', error: 'Texting is not set up' }); continue; }
      texts.push({ base: { ...base, address: phone }, address: phone, text: personalise(comm.body, t.m, gym) });
    }
  }
  const emailResults = emails.length ? await sendEmails(gym, emails) : [];
  emails.forEach((it, i) => rows.push({ ...it.base, status: emailResults[i].ok ? 'sent' : 'failed', error: emailResults[i].ok ? null : emailResults[i].error, providerId: emailResults[i].id || null }));
  const textResults = texts.length ? await sendTexts(texts) : [];
  texts.forEach((it, i) => rows.push({ ...it.base, status: textResults[i].ok ? 'sent' : 'failed', error: textResults[i].ok ? null : textResults[i].error, providerId: textResults[i].id || null }));

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
  const all = await prisma.communicationDelivery.findMany({ where: { communicationId: comm.id }, select: { memberId: true, channel: true, status: true } });
  const count = (channel, status) => all.filter(d => d.channel === channel && d.status === status).length;
  const totals = {
    total: new Set(all.map(d => d.memberId)).size,
    emailSent: count('email', 'sent'), emailFailed: count('email', 'failed'),
    smsSent: count('sms', 'sent'), smsFailed: count('sms', 'failed'),
    skipped: all.filter(d => d.status === 'skipped').length,
  };
  const sent = totals.emailSent + totals.smsSent, failed = totals.emailFailed + totals.smsFailed;
  // Someone with no email or number is counted apart (skipped), not as a failure
  const status = !sent ? 'failed' : failed ? 'partial' : 'sent';
  const testMode = (wants(comm.channel, 'email') && emailTestMode()) || (wants(comm.channel, 'sms') && !!sms.testMode);
  const updated = await prisma.communication.update({ where: { id: comm.id }, data: { ...totals, status, testMode, sentAt: comm.sentAt || new Date() } });
  broadcast(comm.gymId, { resource: 'communications', origin: null });
  return updated;
}

module.exports = { AUDIENCES, audienceWhere, resolveAudience, hasEmail, personalise, fieldValues, channelStatus, deliverCommunication, emailHtml };
