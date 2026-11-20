// What GEM charges a gym, worked out in one place for the admin dashboard,
// the gym's own Billing section and the monthly job. A gym pays for its active
// members (not visitors) on the last day of each month, at its own price per
// member or the platform's, for the days of the month after its free trial.
// The sums themselves are in billingMath.js.
const prisma = require('./prisma');
const { isDemoGym } = require('./sendEmail');
const M = require('./billingMath');

const SETTINGS_DEFAULTS = { id: 1, pricePerMember: 250, currency: 'XAF', dueDays: 10, trialDays: 7, paymentInstructions: '', lastPreparedPeriod: null };

// The platform's settings, or the defaults until the admin saves any
async function platformSettings() {
  const row = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  return { ...SETTINGS_DEFAULTS, ...(row || {}) };
}

// Prepares a draft bill for every gym that owes something for a month that is
// over and has none yet. The demo gym, gyms made after the month, gyms still on
// their trial all month, and gyms with nothing to pay are left out. A gym's
// existing bill for the month is never touched.
async function prepareInvoices(period, now = new Date()) {
  const bounds = M.periodBounds(period);
  if (!bounds) return { error: 'Choose a month.' };
  if (bounds.end > now) return { error: 'A month is billed once it is over.' };
  const settings = await platformSettings();
  const lastDay = new Date(bounds.end.getTime() - 1);
  // Every gym's members counted in one query, not one query a gym
  const [gyms, existing, counts] = await Promise.all([
    prisma.gym.findMany({ where: { createdAt: { lt: bounds.end } }, select: { id: true, code: true, createdAt: true, trialEndsAt: true, billingRate: true } }),
    prisma.gymInvoice.findMany({ where: { period }, select: { gymId: true } }),
    prisma.member.groupBy({ by: ['gymId'], where: M.billableWhere(null, lastDay), _count: { _all: true } }),
  ]);
  const taken = new Set(existing.map(i => i.gymId));
  const membersBy = new Map(counts.map(c => [c.gymId, c._count._all]));
  const data = [];
  for (const gym of gyms) {
    if (isDemoGym(gym) || taken.has(gym.id)) continue;
    const billableDays = M.billableDaysOf(bounds, M.trialEndOf(gym, settings));
    const members = membersBy.get(gym.id) || 0;
    if (!billableDays || !members) continue;
    const rate = gym.billingRate ?? settings.pricePerMember;
    const amount = M.amountOf({ members, rate, billableDays, daysInPeriod: bounds.days });
    if (!amount) continue;
    data.push({ gymId: gym.id, period, periodStart: bounds.start, periodEnd: bounds.end, billableDays, daysInPeriod: bounds.days, members, rate, currency: settings.currency, amount });
  }
  // Prepared at the same moment by the job and the admin: the first one stands
  const created = [];
  for (let i = 0; i < data.length; i += 1000) {
    created.push(...await prisma.gymInvoice.createManyAndReturn({ data: data.slice(i, i + 1000), skipDuplicates: true }));
  }
  return { created };
}

module.exports = { ...M, platformSettings, prepareInvoices };
