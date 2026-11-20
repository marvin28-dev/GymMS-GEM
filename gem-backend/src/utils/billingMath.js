// The sums behind GEM's bills, with no database: months, trials, the days
// charged, the amount, and whether a bill is overdue. utils/billing.js adds
// the settings and the preparing on top.
const DAY = 864e5;

// "2026-11" -> the month's first day, the next month's first day (local), and its length
function periodBounds(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  const start = new Date(year, month, 1), end = new Date(year, month + 1, 1);
  return { start, end, days: Math.round((end - start) / DAY) };
}
const periodOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const previousPeriod = (now = new Date()) => periodOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));

// When GEM starts charging the gym
const trialEndOf = (gym, settings) => (gym.trialEndsAt ? new Date(gym.trialEndsAt) : new Date(new Date(gym.createdAt).getTime() + settings.trialDays * DAY));

// Whole days of the month GEM charges for: from the first midnight after the
// trial ends (a trial ending at 14:00 is charged from the next day)
function billableDaysOf(bounds, trialEnd) {
  const firstDay = new Date(trialEnd.getFullYear(), trialEnd.getMonth(), trialEnd.getDate());
  if (firstDay < trialEnd) firstDay.setDate(firstDay.getDate() + 1);
  const from = firstDay > bounds.start ? firstDay : bounds.start;
  return Math.max(0, Math.min(bounds.days, Math.round((bounds.end - from) / DAY)));
}

// The members a gym pays for on a given day: real members, not visitors, whose
// membership is active that day
function billableWhere(gymId, on = new Date()) {
  const dayStart = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  const dayEnd = new Date(dayStart.getTime() + DAY);
  return {
    ...(gymId ? { gymId } : {}),
    isVisitor: false,
    status: { in: ['active', 'expiring'] },
    OR: [{ startDate: null }, { startDate: { lt: dayEnd } }],
    AND: [{ OR: [{ endDate: null }, { endDate: { gte: dayStart } }] }],
  };
}

// members x price, for the days charged out of the month's, less any discount
function amountOf({ members, rate, billableDays, daysInPeriod, discount = 0 }) {
  const gross = Math.round((members * rate * billableDays) / Math.max(1, daysInPeriod));
  return Math.max(0, gross - Math.max(0, discount));
}

// draft | sent | overdue | paid | void, as the screens show it
function invoiceState(inv, now = new Date()) {
  if (inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate) < now) return 'overdue';
  return inv.status;
}
const daysOverdue = (inv, now = new Date()) => (invoiceState(inv, now) === 'overdue' ? Math.floor((now - new Date(inv.dueDate)) / DAY) : 0);

// The end of the day a sent bill is due on
function dueDateFrom(sentAt, dueDays) {
  const d = new Date(sentAt.getFullYear(), sentAt.getMonth(), sentAt.getDate() + Math.max(0, dueDays));
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = { DAY, periodBounds, periodOf, previousPeriod, trialEndOf, billableDaysOf, billableWhere, amountOf, invoiceState, daysOverdue, dueDateFrom };
