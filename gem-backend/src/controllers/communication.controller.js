const prisma = require('../utils/prisma');
const { logActivity } = require('../utils/activityLog');
const { AUDIENCES, resolveAudience, hasEmail, fieldValues, channelStatus, deliverCommunication } = require('../utils/messaging');
const { toE164 } = require('../utils/phone');
const { smsParts } = require('../utils/sms');
const { logFailure } = require('../utils/bestEffort');

const MANAGEMENT = ['general_manager', 'manager'];
const CHANNELS = ['email', 'sms', 'both'];
const wants = (channel, kind) => channel === kind || channel === 'both';
const SENT_BY = { sentBy: { select: { id: true, firstName: true, lastName: true } } };

const idList = (v) => [...new Set((Array.isArray(v) ? v : []).map(String))].slice(0, 5000);
function readAudience(raw) {
  const type = AUDIENCES.includes(raw?.type) ? raw.type : 'all';
  // people taken off the group's list by hand
  const excludeIds = idList(raw?.excludeIds);
  const extra = excludeIds.length ? { excludeIds } : {};
  if (type === 'package') return { type, packageId: String(raw.packageId || ''), ...extra };
  if (type === 'members') return { type, memberIds: idList(raw.memberIds), ...extra };
  return { type, ...extra };
}

// The audience in words, for the Log and older screens; the page names it itself
async function describeAudience(gymId, audience, people) {
  const n = people.length;
  if (audience.type === 'members') return n === 1 ? `${people[0].firstName} ${people[0].lastName}`.trim() : `${n} chosen members`;
  if (audience.type === 'package') {
    const pkg = await prisma.package.findFirst({ where: { id: audience.packageId, gymId }, select: { name: true } });
    return `Package ${pkg?.name || ''} (${n})`.trim();
  }
  const words = { all: 'All members', active: 'Active members', ending: 'Membership ending this week', inactive: 'Inactive members', owing: 'Members who owe money' };
  return `${words[audience.type] || 'Members'} (${n})`;
}

// A front desk may write to one member from their profile; a group is management's
const mayWrite = (user, audience) => MANAGEMENT.includes(user.role) || (audience.type === 'members' && audience.memberIds.length === 1);

async function getAll(req, res) {
  const list = await prisma.communication.findMany({
    where: { gymId: req.user.gymId },
    include: SENT_BY,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(list);
}

async function channels(req, res) {
  res.json(channelStatus());
}

// Who a message would reach, before it is sent. With list, everyone it would
// reach, so people can be taken off it.
async function previewAudience(req, res) {
  const audience = readAudience(req.body?.audience);
  const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { name: true, country: true, phone: true, currency: true } });
  const people = await resolveAudience(req.user.gymId, audience);
  const reachable = (m) => ({ email: hasEmail(m), phone: !!toE164(m.phone, gym?.country, gym?.phone) });
  const withEmail = people.filter(m => reachable(m).email).length;
  const withPhone = people.filter(m => reachable(m).phone).length;
  res.json({
    total: people.length, withEmail, withPhone,
    names: people.slice(0, 6).map(m => `${m.firstName || ''} ${m.lastName || ''}`.trim()),
    first: people[0] ? { firstName: people[0].firstName, lastName: people[0].lastName } : null,
    // what the fill-ins become for the first person, so the page can show what they will read
    sample: people[0] ? fieldValues(people[0], gym || {}) : null,
    ...(req.body?.list ? {
      people: people.slice(0, 3000).map(m => ({
        id: m.id, name: `${m.firstName || ''} ${m.lastName || ''}`.trim(), memberCode: m.memberCode || '', ...reachable(m),
      })),
    } : {}),
  });
}

async function getOne(req, res) {
  const comm = await prisma.communication.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    include: { ...SENT_BY, deliveries: { orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 5000 } },
  });
  if (!comm) return res.status(404).json({ error: 'Message not found' });
  res.json(comm);
}

// Every message a member was sent, for their profile
async function forMember(req, res) {
  const member = await prisma.member.findFirst({ where: { id: req.params.memberId, gymId: req.user.gymId }, select: { id: true } });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const rows = await prisma.communicationDelivery.findMany({
    where: { gymId: req.user.gymId, memberId: member.id },
    include: { communication: { select: { id: true, subject: true, body: true, channel: true, sentAt: true, createdAt: true, ...SENT_BY } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(rows);
}

// Send now, schedule, or keep as a draft. With an id, a draft or a scheduled
// message is updated rather than a new one made.
async function create(req, res) {
  const action = ['send', 'schedule', 'draft'].includes(req.body?.action) ? req.body.action : 'send';
  const channel = CHANNELS.includes(req.body?.channel) ? req.body.channel : null;
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body ?? req.body?.message ?? '').trim();
  const audience = readAudience(req.body?.audience);
  if (!mayWrite(req.user, audience)) return res.status(403).json({ error: 'Only a manager can write to a group of members.' });
  if (!channel) return res.status(400).json({ error: 'Choose how to send it: email, text or both.', field: 'channel' });

  let existing = null;
  if (req.body?.id) {
    existing = await prisma.communication.findFirst({ where: { id: String(req.body.id), gymId: req.user.gymId } });
    if (!existing) return res.status(404).json({ error: 'Message not found' });
    if (!['draft', 'scheduled'].includes(existing.status)) return res.status(409).json({ error: 'This message has already been sent.' });
  }

  if (action === 'draft') {
    if (!subject && !body) return res.status(400).json({ error: 'Write something before saving a draft.', field: 'body' });
  } else {
    if (wants(channel, 'email') && !subject) return res.status(400).json({ error: 'Add a subject for the email.', field: 'subject' });
    if (!body) return res.status(400).json({ error: 'Write the message.', field: 'body' });
    const status = channelStatus();
    if (wants(channel, 'email') && !status.email.ready) return res.status(400).json({ error: 'Email is not set up yet.', field: 'channel' });
    if (wants(channel, 'sms') && !status.sms.ready) return res.status(400).json({ error: 'Texting is not set up yet, so this can only go by email for now.', field: 'channel' });
    if (wants(channel, 'sms') && smsParts(body) > 6) return res.status(400).json({ error: 'That is too long for a text. Keep it to 6 parts (about 900 characters).', field: 'body' });
  }
  if (subject.length > 150) return res.status(400).json({ error: 'Keep the subject under 150 characters.', field: 'subject' });
  if (body.length > 5000) return res.status(400).json({ error: 'Keep the message under 5,000 characters.', field: 'body' });

  let scheduledAt = null;
  if (action === 'schedule') {
    scheduledAt = new Date(req.body?.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ error: 'Choose when to send it.', field: 'scheduledAt' });
    if (scheduledAt.getTime() < Date.now() - 60 * 1000) return res.status(400).json({ error: 'That time has already passed.', field: 'scheduledAt' });
    if (scheduledAt.getTime() > Date.now() + 366 * 864e5) return res.status(400).json({ error: 'Schedule it within the next year.', field: 'scheduledAt' });
  }

  const people = await resolveAudience(req.user.gymId, audience);
  if (action !== 'draft' && !people.length) return res.status(400).json({ error: 'Nobody matches who it is for.', field: 'audience' });

  const data = {
    subject: subject || (action === 'draft' ? '' : body.slice(0, 60)),
    body, channel, audience, targetGroup: await describeAudience(req.user.gymId, audience, people),
    status: action === 'draft' ? 'draft' : action === 'schedule' ? 'scheduled' : 'sending',
    scheduledAt, total: people.length, sentById: req.user.id,
  };
  const comm = existing
    ? await prisma.communication.update({ where: { id: existing.id }, data, include: SENT_BY })
    : await prisma.communication.create({ data: { gymId: req.user.gymId, ...data }, include: SENT_BY });

  const what = { email: 'an email', sms: 'a text', both: 'an email and a text' }[channel];
  logActivity(req, {
    category: 'members',
    action: action === 'draft' ? 'message.draft' : action === 'schedule' ? 'message.scheduled' : 'message.sent',
    summary: action === 'draft' ? `Saved a draft message "${data.subject || body.slice(0, 40)}"`
      : action === 'schedule' ? `Scheduled ${what} to ${data.targetGroup} for ${scheduledAt.toISOString().slice(0, 16).replace('T', ' ')} UTC: "${data.subject}"`
        : `Sent ${what} to ${data.targetGroup}: "${data.subject}"`,
    target: { type: 'communication', id: comm.id },
  });

  // Delivery happens after the answer: a big list takes a while, and the page
  // follows it live
  if (action === 'send') {
    deliverCommunication(comm.id).catch(async (err) => {
      console.error('Sending message failed:', err.message);
      await prisma.communication.update({ where: { id: comm.id }, data: { status: 'failed' } }).catch(logFailure('Marking the message failed'));
    });
  }
  res.status(action === 'send' ? 202 : 201).json(comm);
}

// Try again for the people it did not reach
async function retry(req, res) {
  const comm = await prisma.communication.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!comm) return res.status(404).json({ error: 'Message not found' });
  if (comm.status === 'sending') return res.status(409).json({ error: 'It is still being sent.' });
  const failed = await prisma.communicationDelivery.findMany({ where: { communicationId: comm.id, status: 'failed' } });
  if (!failed.length) return res.status(400).json({ error: 'Nothing failed, so there is nothing to retry.' });
  const status = channelStatus();
  if (failed.some(d => d.channel === 'sms') && !status.sms.ready) return res.status(400).json({ error: 'Texting is not set up yet.' });
  await prisma.communication.update({ where: { id: comm.id }, data: { status: 'sending' } });
  logActivity(req, { category: 'members', action: 'message.retried', summary: `Retried "${comm.subject}" for ${failed.length} failed deliveries`, target: { type: 'communication', id: comm.id } });
  deliverCommunication(comm.id, { only: failed }).catch(async (err) => {
    console.error('Retrying message failed:', err.message);
    await prisma.communication.update({ where: { id: comm.id }, data: { status: 'failed' } }).catch(logFailure('Marking the retry failed'));
  });
  res.status(202).json({ retrying: failed.length });
}

// A scheduled message taken back becomes a draft again
async function cancelSchedule(req, res) {
  const { count } = await prisma.communication.updateMany({ where: { id: req.params.id, gymId: req.user.gymId, status: 'scheduled' }, data: { status: 'draft', scheduledAt: null } });
  if (!count) return res.status(409).json({ error: 'It is not scheduled any more.' });
  logActivity(req, { category: 'members', action: 'message.unscheduled', summary: 'Took back a scheduled message', target: { type: 'communication', id: req.params.id } });
  res.json({ cancelled: true });
}

async function remove(req, res) {
  const existing = await prisma.communication.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });
  if (existing.status === 'sending') return res.status(409).json({ error: 'It is still being sent.' });
  await prisma.communication.delete({ where: { id: existing.id } });
  logActivity(req, {
    category: 'members', action: 'message.deleted',
    summary: `Deleted the message "${existing.subject}"`, target: { type: 'communication', id: existing.id },
  });
  res.json({ message: 'Message deleted' });
}

module.exports = { getAll, channels, previewAudience, getOne, forMember, create, retry, cancelSchedule, remove };
