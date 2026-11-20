// Every gym as GEM's admin sees it: who owns it, where its trial and bills
// stand, how many members it pays for, and when anyone last used it. Shared by
// the overview and the gyms list so the two never disagree.
const prisma = require('./prisma');
const { isDemoGym } = require('./sendEmail');
const { DAY, platformSettings, trialEndOf, billableWhere } = require('./billing');

const byGym = (rows, pick) => new Map(rows.map(r => [r.gymId, pick(r)]));

// gymId: one gym's summary, its tallies counted for it alone
async function gymSummaries(now = new Date(), { gymId } = {}) {
  const settings = await platformSettings();
  const one = gymId ? { gymId } : {};
  const [gyms, billable, total, staff, activity, owners, unpaid] = await Promise.all([
    prisma.gym.findMany({
      where: gymId ? { id: gymId } : {},
      select: { id: true, code: true, name: true, country: true, city: true, phone: true, email: true, createdAt: true, trialEndsAt: true, billingRate: true, lockedAt: true, lockReason: true, setupCompletedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.member.groupBy({ by: ['gymId'], where: billableWhere(gymId || null, now), _count: { _all: true } }),
    prisma.member.groupBy({ by: ['gymId'], where: { ...one, status: { not: 'deactivated' } }, _count: { _all: true } }),
    prisma.staff.groupBy({ by: ['gymId'], where: { ...one, isActive: true }, _count: { _all: true } }),
    // GEM's own entries (a pause, a reopening) are not the gym using GEM
    prisma.activityLog.groupBy({ by: ['gymId'], where: { ...one, OR: [{ actorRole: null }, { actorRole: { not: 'gem' } }] }, _max: { createdAt: true } }),
    prisma.staff.findMany({ where: { ...one, role: 'general_manager' }, orderBy: { createdAt: 'asc' }, select: { gymId: true, firstName: true, lastName: true, email: true, phone: true } }),
    prisma.gymInvoice.findMany({ where: { ...one, status: 'sent' }, select: { gymId: true, amount: true, dueDate: true } }),
  ]);
  const unpaidBy = new Map();
  for (const i of unpaid) unpaidBy.set(i.gymId, [...(unpaidBy.get(i.gymId) || []), i]);
  const billableBy = byGym(billable, r => r._count._all);
  const totalBy = byGym(total, r => r._count._all);
  const staffBy = byGym(staff, r => r._count._all);
  const activityBy = byGym(activity, r => r._max.createdAt);
  const ownerBy = new Map();
  for (const o of owners) if (!ownerBy.has(o.gymId)) ownerBy.set(o.gymId, o);

  return gyms.filter(g => !isDemoGym(g)).map((g) => {
    const trialEnd = trialEndOf(g, settings);
    const onTrial = trialEnd > now;
    const rate = g.billingRate ?? settings.pricePerMember;
    const members = { billable: billableBy.get(g.id) || 0, total: totalBy.get(g.id) || 0 };
    const mine = unpaidBy.get(g.id) || [];
    const late = mine.filter(i => i.dueDate && i.dueDate < now);
    const owner = ownerBy.get(g.id);
    return {
      id: g.id, code: g.code, name: g.name, country: g.country, city: g.city, phone: g.phone, email: g.email, createdAt: g.createdAt,
      trialEndsAt: trialEnd, onTrial, trialDaysLeft: onTrial ? Math.ceil((trialEnd - now) / DAY) : 0,
      locked: g.lockedAt ? { at: g.lockedAt, reason: g.lockReason } : null,
      rate, customRate: g.billingRate != null, currency: settings.currency,
      members, staff: staffBy.get(g.id) || 0,
      lastActivity: activityBy.get(g.id) || null,
      setupDone: !!g.setupCompletedAt,
      owner: owner ? { name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim(), email: owner.email, phone: owner.phone } : null,
      // What it would pay for this month if the month ended today
      monthlyEstimate: onTrial ? 0 : members.billable * rate,
      owes: {
        outstanding: mine.reduce((s, i) => s + i.amount, 0),
        overdue: late.reduce((s, i) => s + i.amount, 0),
        overdueCount: late.length,
        oldestDue: late.reduce((d, i) => (!d || i.dueDate < d ? i.dueDate : d), null),
      },
    };
  });
}

module.exports = { gymSummaries };
