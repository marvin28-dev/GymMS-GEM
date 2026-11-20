// A gym's own view of what it pays GEM: its plan, this month so far, the bills
// GEM has sent it, and how to pay. Open while the account is paused, so the
// owner can see why and what to pay.
const prisma = require('../utils/prisma');
const { DAY, platformSettings, trialEndOf, billableWhere, invoiceState, daysOverdue } = require('../utils/billing');

// ── GET /api/billing/status ──────────────────────────────────────────────────
// Whether the account is paused, for anyone signed in to the gym
async function status(req, res) {
  const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { lockedAt: true, lockReason: true } });
  res.json({ locked: !!gym?.lockedAt, reason: gym?.lockReason || null, isOwner: req.user.role === 'general_manager' });
}

// ── GET /api/billing ─────────────────────────────────────────────────────────
// The owner's alone (Settings, GEM billing)
async function mine(req, res) {
  const now = new Date();
  const settings = await platformSettings();
  const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { createdAt: true, trialEndsAt: true, billingRate: true, lockedAt: true, lockReason: true } });
  const [members, invoices] = await Promise.all([
    prisma.member.count({ where: billableWhere(req.user.gymId, now) }),
    // A draft is GEM's work in progress: the gym sees a bill once it is sent
    prisma.gymInvoice.findMany({ where: { gymId: req.user.gymId, status: { not: 'draft' } }, orderBy: { periodStart: 'desc' }, take: 24 }),
  ]);
  const trialEnd = trialEndOf(gym, settings);
  const onTrial = trialEnd > now;
  const rate = gym.billingRate ?? settings.pricePerMember;
  res.json({
    rate, currency: settings.currency,
    trialEndsAt: trialEnd, onTrial, trialDaysLeft: onTrial ? Math.ceil((trialEnd - now) / DAY) : 0,
    members, estimate: onTrial ? 0 : members * rate,
    invoices: invoices.map(i => ({
      id: i.id, period: i.period, members: i.members, rate: i.rate, currency: i.currency, billableDays: i.billableDays, daysInPeriod: i.daysInPeriod,
      discount: i.discount, amount: i.amount, note: i.note, sentAt: i.sentAt, dueDate: i.dueDate, paidAt: i.paidAt, paidAmount: i.paidAmount,
      state: invoiceState(i, now), daysOverdue: daysOverdue(i, now),
    })),
    paymentInstructions: settings.paymentInstructions,
    locked: gym.lockedAt ? { at: gym.lockedAt, reason: gym.lockReason } : null,
  });
}

module.exports = { status, mine };
