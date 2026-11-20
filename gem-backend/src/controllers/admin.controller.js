// GEM's admin dashboard: signing in, the overview of every gym, and GEM's own
// settings (the price per member, when bills fall due, the trial, how to pay)
const prisma = require('../utils/prisma');
const { attemptCounter, refuseTooMany } = require('../utils/attempts');
const { credentialsMatch, signAdmin, adminConfigured, adminEmail } = require('../middleware/admin.middleware');
const { rememberRevoked } = require('../middleware/auth.middleware');
const { gymSummaries } = require('../utils/adminData');
const { DAY, platformSettings, periodOf, previousPeriod } = require('../utils/billing');

const MINUTE = 60 * 1000;
// Five wrong tries from one address in 15 minutes, and 20 from anywhere: the
// password opens every gym's records, so guessing it is made slow
const missesByAddress = attemptCounter({ max: 5, windowMs: 15 * MINUTE });
const missesOverall = attemptCounter({ max: 20, windowMs: 15 * MINUTE });

// ── POST /api/admin/login { email, password } ────────────────────────────────
async function login(req, res) {
  if (!adminConfigured()) return res.status(503).json({ error: 'The admin account is not set up on the server (ADMIN_EMAIL and ADMIN_PASSWORD).' });
  const wait = Math.max(missesByAddress.lockedFor(req.ip), missesOverall.lockedFor('admin'));
  if (wait) return refuseTooMany(res, wait);
  if (!credentialsMatch(req.body?.email, req.body?.password)) {
    missesByAddress.miss(req.ip);
    missesOverall.miss('admin');
    console.warn(`Admin sign-in refused from ${req.ip}`);
    return res.status(401).json({ error: 'That email and password do not match.' });
  }
  missesByAddress.clear(req.ip);
  res.json({ token: signAdmin(), admin: { email: adminEmail() } });
}

// ── POST /api/admin/logout ───────────────────────────────────────────────────
async function logout(req, res) {
  const { jti, exp } = req.admin;
  if (jti && exp) {
    const expiresAt = new Date(exp * 1000);
    await prisma.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt }, update: {} });
    rememberRevoked(jti, expiresAt);
  }
  res.json({ signedOut: true });
}

const me = (req, res) => res.json({ email: req.admin.email });

// ── GET /api/admin/overview ──────────────────────────────────────────────────
// The figures on the dashboard's first screen, and what needs GEM's attention
async function overview(req, res) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const settings = await platformSettings();
  const periods = Array.from({ length: 6 }, (_, i) => periodOf(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)));
  const [gyms, invoices, paidThisMonth, support, leads, followUps] = await Promise.all([
    gymSummaries(now),
    prisma.gymInvoice.findMany({ where: { period: { in: periods } }, select: { period: true, status: true, amount: true, paidAmount: true } }),
    prisma.gymInvoice.findMany({ where: { status: 'paid', paidAt: { gte: monthStart } }, select: { amount: true, paidAmount: true } }),
    prisma.supportRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.count({ where: { status: { in: ['new', 'contacted', 'demo'] }, nextFollowUp: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } } }),
  ]);
  const drafts = await prisma.gymInvoice.count({ where: { status: 'draft' } });
  const count = (rows, key) => rows.find(r => r.status === key)?._count._all || 0;
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const active = gyms.filter(g => g.lastActivity && now - new Date(g.lastActivity) < 7 * DAY);
  const inactive = gyms.filter(g => now - new Date(g.createdAt) > 14 * DAY && (!g.lastActivity || now - new Date(g.lastActivity) > 14 * DAY));
  const trialsEnding = gyms.filter(g => g.onTrial && g.trialDaysLeft <= 3);

  // Ten of each at most, the worst first: the tiles above carry the full counts
  const attention = [
    ...gyms.filter(g => g.owes.overdue > 0).sort((a, b) => b.owes.overdue - a.owes.overdue).slice(0, 10)
      .map(g => ({ type: 'overdue', gymId: g.id, gymName: g.name, amount: g.owes.overdue, days: Math.floor((now - new Date(g.owes.oldestDue)) / DAY), locked: !!g.locked })),
    ...[...trialsEnding].sort((a, b) => a.trialDaysLeft - b.trialDaysLeft).slice(0, 10).map(g => ({ type: 'trial_ending', gymId: g.id, gymName: g.name, days: g.trialDaysLeft })),
    ...gyms.filter(g => g.locked && !g.owes.overdue).slice(0, 10).map(g => ({ type: 'locked', gymId: g.id, gymName: g.name, reason: g.locked.reason })),
    ...inactive.slice(0, 5).map(g => ({ type: 'inactive', gymId: g.id, gymName: g.name, days: g.lastActivity ? Math.floor((now - new Date(g.lastActivity)) / DAY) : null })),
    ...(count(support, 'new') ? [{ type: 'problems', count: count(support, 'new') }] : []),
    ...(followUps ? [{ type: 'followups', count: followUps }] : []),
    ...(drafts ? [{ type: 'drafts', count: drafts }] : []),
  ];

  res.json({
    currency: settings.currency,
    gyms: {
      total: gyms.length, active: active.length, onTrial: gyms.filter(g => g.onTrial).length, trialsEnding: trialsEnding.length,
      paying: gyms.filter(g => !g.onTrial && !g.locked).length, locked: gyms.filter(g => g.locked).length,
      inactive: inactive.length, newThisMonth: gyms.filter(g => new Date(g.createdAt) >= monthStart).length,
    },
    members: { billable: sum(gyms, g => g.members.billable), total: sum(gyms, g => g.members.total) },
    money: {
      monthlyEstimate: sum(gyms, g => g.monthlyEstimate),
      collectedThisMonth: sum(paidThisMonth, i => i.paidAmount ?? i.amount),
      outstanding: sum(gyms, g => g.owes.outstanding),
      overdue: sum(gyms, g => g.owes.overdue),
      overdueGyms: gyms.filter(g => g.owes.overdue > 0).length,
      drafts,
    },
    support: { new: count(support, 'new'), inProgress: count(support, 'in_progress'), resolved: count(support, 'resolved') },
    leads: { new: count(leads, 'new'), open: count(leads, 'new') + count(leads, 'contacted') + count(leads, 'demo'), won: count(leads, 'won'), followUps },
    attention,
    recentGyms: gyms.slice(0, 5).map(g => ({ id: g.id, name: g.name, code: g.code, createdAt: g.createdAt, onTrial: g.onTrial, trialDaysLeft: g.trialDaysLeft, city: g.city, country: g.country })),
    monthly: periods.map(p => ({
      period: p,
      billed: sum(invoices.filter(i => i.period === p && ['sent', 'paid'].includes(i.status)), i => i.amount),
      paid: sum(invoices.filter(i => i.period === p && i.status === 'paid'), i => i.paidAmount ?? i.amount),
    })),
    lastMonth: previousPeriod(now),
  });
}

// ── GET /api/admin/counts ────────────────────────────────────────────────────
// The menu's badges, asked for on every screen: kept to a few cheap counts
async function counts(req, res) {
  const now = new Date();
  const [problems, leads, followUps, late, drafts] = await Promise.all([
    prisma.supportRequest.count({ where: { status: 'new' } }),
    prisma.lead.count({ where: { status: 'new' } }),
    prisma.lead.count({ where: { status: { in: ['new', 'contacted', 'demo'] }, nextFollowUp: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } } }),
    prisma.gymInvoice.groupBy({ by: ['gymId'], where: { status: 'sent', dueDate: { lt: now } } }),
    prisma.gymInvoice.count({ where: { status: 'draft' } }),
  ]);
  res.json({ problems, leads: leads + followUps, billing: late.length + drafts });
}

// ── GET /api/admin/settings ──────────────────────────────────────────────────
async function getSettings(req, res) {
  const settings = await platformSettings();
  res.json({
    ...settings,
    adminEmail: req.admin.email,
    email: { ready: !!process.env.RESEND_API_KEY, testMode: (process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev') === 'onboarding@resend.dev', from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev' },
  });
}

// ── PUT /api/admin/settings ──────────────────────────────────────────────────
async function updateSettings(req, res) {
  const b = req.body || {};
  const refuse = (error, field) => res.status(400).json({ error, field });
  const whole = (v) => (v === '' || v == null ? NaN : Number(v));
  const price = whole(b.pricePerMember), due = whole(b.dueDays), trial = whole(b.trialDays);
  if (!Number.isInteger(price) || price < 0 || price > 1000000) return refuse('Enter a whole price per member, 0 or more.', 'pricePerMember');
  const currency = String(b.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return refuse('A currency is a 3-letter code, like XAF.', 'currency');
  if (!Number.isInteger(due) || due < 0 || due > 90) return refuse('Give 0 to 90 days to pay.', 'dueDays');
  if (!Number.isInteger(trial) || trial < 0 || trial > 90) return refuse('A free trial is 0 to 90 days.', 'trialDays');
  const paymentInstructions = String(b.paymentInstructions ?? '').trim();
  if (paymentInstructions.length > 1000) return refuse('Keep the payment instructions under 1,000 characters.', 'paymentInstructions');
  const data = { pricePerMember: price, currency, dueDays: due, trialDays: trial, paymentInstructions };
  const saved = await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  res.json(saved);
}

module.exports = { login, logout, me, overview, counts, getSettings, updateSettings };
