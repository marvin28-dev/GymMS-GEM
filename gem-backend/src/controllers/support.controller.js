const { Resend } = require('resend');
const prisma = require('../utils/prisma');
const { deliver } = require('../utils/sendEmail');
const E = require('../utils/emailLayout');
const { attemptCounter, refuseTooMany } = require('../utils/attempts');
const { supportEmail } = require('../utils/support');
const { sendSupportReply } = require('../utils/gemEmail');
const { broadcast } = require('../utils/liveHub');
const { bestEffort } = require('../utils/bestEffort');

// What someone can tell GEM from the Support page
const KINDS = {
  problem: 'Something is not working',
  complaint: 'Complaint',
  suggestion: 'Suggestion',
  question: 'Question',
};
const MAX_SUBJECT = 120;
const MAX_MESSAGE = 4000;
const MAX_PAGE = 300;

// Ten an hour is plenty for anyone with something to say, and keeps a button
// pressed over and over from filling GEM's inbox
const reports = attemptCounter({ max: 10, windowMs: 60 * 60 * 1000 });

const ROLE_NAMES = {
  general_manager: 'General manager', manager: 'Manager', front_desk: 'Front desk',
  trainer: 'Trainer', instructor: 'Trainer', coach: 'Trainer', other: 'Other', accountant: 'Accountant',
};

// What the sender sees of their own report, GEM's answer included (never GEM's note)
const SHOWN = { id: true, kind: true, subject: true, message: true, emailedAt: true, createdAt: true, status: true, reply: true, repliedAt: true, resolvedAt: true };
const STATUSES = ['new', 'in_progress', 'resolved'];

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function reportHtml({ report, gym }) {
  const message = E.esc(report.message).replace(/\r?\n/g, '<br>');
  const body = [
    E.details([
      ['From', report.senderName],
      ['Role', ROLE_NAMES[report.senderRole] || report.senderRole],
      ['Email', report.senderEmail],
      ['Phone', report.senderPhone],
      ['Gym', `${gym.name} (${gym.code})`],
      ['Country', gym.country],
      ['Page', report.page],
      ['Sent', new Date(report.createdAt).toUTCString()],
    ], 'Who sent it'),
    `<div style="font-family:'DM Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#8a8a96;margin:4px 0 8px;">What they wrote</div>`,
    E.pHtml(message),
    report.userAgent ? E.small(`Browser: ${report.userAgent}`) : '',
    report.senderEmail ? E.small('Reply to this email to answer them.') : '',
  ].join('');
  return E.layout({
    brand: E.gemBrand, gym,
    preheader: `${KINDS[report.kind]} from ${gym.name}: ${report.subject}`,
    eyebrow: KINDS[report.kind], title: report.subject, body,
  });
}

// ── POST /api/support { kind, subject, message, page } ───────────────────────
// Kept here first, then emailed to GEM's support address: the answer says
// whether the email went, so the page never claims GEM has it when it does not.
async function create(req, res) {
  const refuse = (error, field) => res.status(400).json({ error, field });
  const kind = String(req.body?.kind || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  const page = String(req.body?.page || '').trim().slice(0, MAX_PAGE) || null;
  if (!KINDS[kind]) return refuse('Choose what it is about.', 'kind');
  if (!subject) return refuse('Give it a short title.', 'subject');
  if (subject.length > MAX_SUBJECT) return refuse(`Keep the title under ${MAX_SUBJECT} characters.`, 'subject');
  if (!message) return refuse('Tell us what happened.', 'message');
  if (message.length > MAX_MESSAGE) return refuse(`Keep it under ${MAX_MESSAGE} characters.`, 'message');

  const wait = reports.lockedFor(req.user.id);
  if (wait) return refuseTooMany(res, wait, 'You have sent a lot of reports this hour. WhatsApp or email GEM support instead.');

  const [staff, gym] = await Promise.all([
    prisma.staff.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true, email: true, phone: true, role: true } }),
    prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { name: true, code: true, country: true, city: true, location: true, phone: true, email: true } }),
  ]);
  if (!staff || !gym) return res.status(404).json({ error: 'Your account could not be found.' });
  reports.count(req.user.id);

  const report = await prisma.supportRequest.create({
    data: {
      gymId: req.user.gymId, staffId: req.user.id,
      senderName: [staff.firstName, staff.lastName].filter(Boolean).join(' ') || 'Staff',
      senderEmail: staff.email || null, senderPhone: staff.phone || null, senderRole: staff.role,
      kind, subject, message, page,
      userAgent: String(req.headers['user-agent'] || '').slice(0, MAX_PAGE) || null,
    },
  });

  let emailed = false;
  try {
    await deliver(getResend(), {
      from: E.sender(gym.name),
      to: supportEmail(),
      ...(report.senderEmail ? { replyTo: report.senderEmail } : {}),
      subject: `[GEM support] ${KINDS[kind]}: ${subject}`,
      html: reportHtml({ report, gym }),
    });
    emailed = true;
  } catch (err) {
    console.error(`Support report ${report.id} could not be emailed:`, err.message);
  }
  const saved = emailed
    ? await prisma.supportRequest.update({ where: { id: report.id }, data: { emailedAt: new Date() }, select: SHOWN })
    : await prisma.supportRequest.findUnique({ where: { id: report.id }, select: SHOWN });
  res.status(201).json({ report: saved, emailed });
}

// ── GET /api/support ─────────────────────────────────────────────────────────
// What you have sent, newest first. Nobody else's: a report is the sender's.
async function getMine(req, res) {
  const list = await prisma.supportRequest.findMany({
    where: { gymId: req.user.gymId, staffId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: SHOWN,
  });
  res.json(list);
}

// ── GET /api/admin/support ───────────────────────────────────────────────────
// Every report from every gym, for GEM's admin
async function adminList(req, res) {
  const reports = await prisma.supportRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  const gymIds = [...new Set(reports.map(r => r.gymId))];
  const gyms = gymIds.length ? await prisma.gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true, code: true } }) : [];
  const gymBy = new Map(gyms.map(g => [g.id, g]));
  res.json(reports.map(r => ({ ...r, gym: gymBy.get(r.gymId) || null })));
}

const withGym = async (report) => ({ ...report, gym: await prisma.gym.findUnique({ where: { id: report.gymId }, select: { id: true, name: true, code: true } }) });

// ── PATCH /api/admin/support/:id { status?, adminNote? } ─────────────────────
async function adminUpdate(req, res) {
  const report = await prisma.supportRequest.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  const b = req.body || {};
  const data = {};
  if ('status' in b) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Choose new, in progress or resolved.', field: 'status' });
    data.status = b.status;
    data.resolvedAt = b.status === 'resolved' ? (report.resolvedAt || new Date()) : null;
  }
  if ('adminNote' in b) {
    const note = String(b.adminNote ?? '').trim();
    if (note.length > 4000) return res.status(400).json({ error: 'Keep the note under 4,000 characters.', field: 'adminNote' });
    data.adminNote = note || null;
  }
  const saved = await prisma.supportRequest.update({ where: { id: report.id }, data });
  if ('status' in data) broadcast(report.gymId, { resource: 'support', origin: null });
  res.json(await withGym(saved));
}

// ── POST /api/admin/support/:id/reply { reply, resolve? } ────────────────────
// GEM's answer: the sender is told in the app and, when they have an address,
// by email, and sees it under their report on the Support page
async function adminReply(req, res) {
  const report = await prisma.supportRequest.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  const reply = String(req.body?.reply ?? '').trim();
  if (!reply) return res.status(400).json({ error: 'Write the answer.', field: 'reply' });
  if (reply.length > MAX_MESSAGE) return res.status(400).json({ error: `Keep it under ${MAX_MESSAGE} characters.`, field: 'reply' });
  const resolve = req.body?.resolve === true;
  const now = new Date();
  const saved = await prisma.supportRequest.update({
    where: { id: report.id },
    data: { reply, repliedAt: now, status: resolve ? 'resolved' : 'in_progress', resolvedAt: resolve ? now : null },
  });
  const sender = await prisma.staff.findUnique({ where: { id: report.staffId }, select: { id: true, gymId: true } });
  if (sender?.gymId === report.gymId) {
    await prisma.notification.create({
      data: { gymId: report.gymId, staffId: sender.id, type: 'system', link: '/support', title: `GEM support answered: ${report.subject}`.slice(0, 190), body: reply.slice(0, 500) },
    }).catch(err => console.error('Support answer notice failed:', err.message));
    broadcast(report.gymId, { resource: 'notifications', origin: null });
  }
  broadcast(report.gymId, { resource: 'support', origin: null });
  const gym = await prisma.gym.findUnique({ where: { id: report.gymId }, select: { id: true, code: true, name: true } });
  bestEffort(sendSupportReply(saved, gym), 'Support answer email');
  res.json({ ...saved, gym });
}

module.exports = { create, getMine, adminList, adminUpdate, adminReply };
