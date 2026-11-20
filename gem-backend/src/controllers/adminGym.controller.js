// The gyms on GEM, for GEM's admin: the list, one gym in full, its price and
// trial, GEM's private note, and pausing or reopening its account
const prisma = require('../utils/prisma');
const { gymSummaries } = require('../utils/adminData');
const { DAY, platformSettings, invoiceState, daysOverdue } = require('../utils/billing');
const { sendLockChange } = require('../utils/gemEmail');
const { forgetGym } = require('../middleware/auth.middleware');
const { broadcast } = require('../utils/liveHub');
const { logActivity } = require('../utils/activityLog');
const { bestEffort } = require('../utils/bestEffort');
const { GEM_ACTOR, reopenGym } = require('../utils/gymAccount');

// The gyms page's filters: a gym is inactive once it is over two weeks old and
// nobody has used GEM there for two weeks
const quiet = (d, now) => !d || now - new Date(d) > 14 * DAY;
const FILTERS = {
  all: () => true,
  trial: (g) => g.onTrial,
  paying: (g) => !g.onTrial && !g.locked,
  overdue: (g) => g.owes.overdue > 0,
  paused: (g) => !!g.locked,
  inactive: (g, now) => quiet(g.createdAt, now) && quiet(g.lastActivity, now),
};

// ── GET /api/admin/gyms?q=&filter=&limit= ────────────────────────────────────
// Searched and filtered here, so the page receives a screenful (200 at most)
// however many gyms there are, with each filter's count
async function list(req, res) {
  const now = new Date();
  const all = await gymSummaries(now);
  const filter = FILTERS[req.query.filter] ? req.query.filter : 'all';
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const matching = all.filter(g => FILTERS[filter](g, now))
    .filter(g => !q || [g.name, g.code, g.city, g.country, g.owner?.name, g.owner?.email].some(v => String(v || '').toLowerCase().includes(q)));
  res.json({
    counts: Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, all.filter(g => f(g, now)).length])),
    total: matching.length,
    gyms: matching.slice(0, limit),
  });
}

// ── GET /api/admin/gyms/:id ──────────────────────────────────────────────────
async function getOne(req, res) {
  const now = new Date();
  const [summary] = await gymSummaries(now, { gymId: req.params.id });
  if (!summary) return res.status(404).json({ error: 'Gym not found' });
  const since = new Date(now.getTime() - 30 * DAY);
  const [gym, byStatus, visitors, staffByRole, checkIns, payments, invoices, reports, leads] = await Promise.all([
    prisma.gym.findUnique({ where: { id: summary.id }, select: { adminNote: true, location: true, currency: true, setupConfirmed: true } }),
    prisma.member.groupBy({ by: ['status'], where: { gymId: summary.id, isVisitor: false }, _count: { _all: true } }),
    prisma.member.count({ where: { gymId: summary.id, isVisitor: true, status: { not: 'deactivated' } } }),
    prisma.staff.groupBy({ by: ['role'], where: { gymId: summary.id, isActive: true }, _count: { _all: true } }),
    prisma.attendance.count({ where: { gymId: summary.id, checkIn: { gte: since } } }),
    prisma.payment.count({ where: { gymId: summary.id, createdAt: { gte: since } } }),
    prisma.gymInvoice.findMany({ where: { gymId: summary.id }, orderBy: { periodStart: 'desc' }, take: 24 }),
    prisma.supportRequest.findMany({ where: { gymId: summary.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, kind: true, subject: true, status: true, senderName: true, createdAt: true } }),
    prisma.lead.findMany({ where: { gymId: summary.id }, select: { id: true, name: true, createdAt: true } }),
  ]);
  res.json({
    ...summary,
    location: gym?.location || null,
    gymCurrency: gym?.currency || null,
    adminNote: gym?.adminNote || '',
    membersByStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count._all])),
    visitors,
    staffByRole: Object.fromEntries(staffByRole.map(r => [r.role, r._count._all])),
    last30: { checkIns, payments },
    invoices: invoices.map(i => ({ ...i, state: invoiceState(i, now), daysOverdue: daysOverdue(i, now) })),
    reports,
    leads,
  });
}

// ── PATCH /api/admin/gyms/:id { billingRate?, trialEndsAt?, adminNote? } ─────
// billingRate null goes back to the platform's price; trialEndsAt null back to
// the usual trial from the day the gym signed up
async function update(req, res) {
  const gym = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  const b = req.body || {};
  const data = {};
  if ('billingRate' in b) {
    if (b.billingRate === null || b.billingRate === '') data.billingRate = null;
    else {
      const rate = Number(b.billingRate);
      if (!Number.isInteger(rate) || rate < 0 || rate > 1000000) return res.status(400).json({ error: 'Enter a whole price per member, 0 or more.', field: 'billingRate' });
      data.billingRate = rate;
    }
  }
  if ('trialEndsAt' in b) {
    if (b.trialEndsAt === null || b.trialEndsAt === '') data.trialEndsAt = null;
    else {
      // A day is given; the trial runs to its end
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.trialEndsAt));
      const at = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999) : new Date(NaN);
      if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'Choose the day the trial ends.', field: 'trialEndsAt' });
      data.trialEndsAt = at;
    }
  }
  if ('adminNote' in b) {
    const note = String(b.adminNote ?? '').trim();
    if (note.length > 4000) return res.status(400).json({ error: 'Keep the note under 4,000 characters.', field: 'adminNote' });
    data.adminNote = note || null;
  }
  await prisma.gym.update({ where: { id: gym.id }, data });
  const [summary] = await gymSummaries(new Date(), { gymId: gym.id });
  res.json(summary);
}

// ── POST /api/admin/gyms/:id/lock { reason } ─────────────────────────────────
async function lock(req, res) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'Say why the account is paused: the owner reads it.', field: 'reason' });
  if (reason.length > 500) return res.status(400).json({ error: 'Keep the reason under 500 characters.', field: 'reason' });
  const gym = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true, code: true, name: true, lockedAt: true } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  if (gym.lockedAt) return res.status(409).json({ error: 'This gym is already paused.' });
  await prisma.gym.update({ where: { id: gym.id }, data: { lockedAt: new Date(), lockReason: reason } });
  forgetGym(gym.id);
  logActivity(null, { gymId: gym.id, actor: GEM_ACTOR, category: 'security', action: 'gym.locked', summary: `GEM paused the account: ${reason}` });
  const settings = await platformSettings();
  bestEffort(sendLockChange(gym, true, reason, settings), 'Paused account email');
  broadcast(gym.id, { resource: 'billing', origin: null });
  res.json({ locked: true });
}

// ── POST /api/admin/gyms/:id/unlock ──────────────────────────────────────────
async function unlock(req, res) {
  const gym = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true, code: true, name: true, lockedAt: true } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  if (!gym.lockedAt) return res.status(409).json({ error: 'This gym is not paused.' });
  await reopenGym(gym);
  res.json({ locked: false });
}

module.exports = { list, getOne, update, lock, unlock };
