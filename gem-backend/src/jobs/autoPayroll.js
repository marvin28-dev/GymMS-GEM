const prisma = require('../utils/prisma');
const { computeMonthlyPay } = require('../controllers/payAdjustment.controller');
const { recordPay, shortfallOf } = require('../controllers/payroll.controller');
const { logActivity } = require('../utils/activityLog');

const TITLE_NOT_ISSUED = 'Pay Not Issued';
const AUTO_NOTE = 'Issued automatically on the pay day.';

const periodKey = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const { formatMoney, withCurrency } = require('../utils/money');
const money = (n) => formatMoney(n);

// The day this month's pay falls on for one person, or null if they have no
// pay day. A pay day of 31 lands on the last day of a shorter month.
function payDateThisMonth(staff, gym, now) {
  const day = staff.payDay ?? gym.payDay;
  if (!day) return null;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return new Date(now.getFullYear(), now.getMonth(), Math.min(day, lastDay));
}

// Someone added to GEM after this month's pay day was paid, if at all, outside
// GEM. Their first automatic pay is next month's.
const addedAfter = (staff, payDate) => startOfDay(new Date(staff.createdAt)) > payDate;

// Tells the owner, once per month per person, why a pay was held back
async function warnNotIssued(gym, owner, staff, period, short, now) {
  const link = `/staff/${staff.id}`;
  const already = await prisma.notification.findFirst({
    where: { gymId: gym.id, title: TITLE_NOT_ISSUED, link, createdAt: { gte: startOfMonth(now) } },
    select: { id: true },
  });
  if (already) return;
  await prisma.notification.create({
    data: {
      gymId: gym.id,
      staffId: owner.id,
      title: TITLE_NOT_ISSUED,
      body: `${staff.firstName} ${staff.lastName}'s pay for ${period} was not issued. Deductions are ${money(short)} more than the pay. Reduce or remove a deduction, then issue it from their profile.`,
      type: 'payroll',
      link,
    },
  });
  logActivity(null, {
    gymId: gym.id, actor: null, category: 'payroll', action: 'pay.held',
    summary: `Held back ${staff.firstName} ${staff.lastName}'s pay for ${period}: deductions are ${money(short)} more than the pay`,
    target: { type: 'staff', id: staff.id },
  });
}

// On or after each person's pay day, issue that month's pay if nobody has yet.
// The record is issued, not paid: the owner still marks it paid once the money
// has actually been sent.
async function autoIssueForGym(gym, now = new Date()) {
  const currency = gym.currency ?? (await prisma.gym.findUnique({ where: { id: gym.id }, select: { currency: true } }))?.currency;
  return withCurrency(currency, () => issueForGym(gym, now));
}

async function issueForGym(gym, now) {
  const period = periodKey(now);
  const staff = await prisma.staff.findMany({
    where: { gymId: gym.id, isActive: true, salary: { gt: 0 } },
    select: { id: true, firstName: true, lastName: true, payDay: true, createdAt: true },
  });
  if (!staff.length) return { issued: 0, held: 0 };

  const paid = await prisma.payRecord.findMany({
    where: { gymId: gym.id, month: period, staffId: { in: staff.map(s => s.id) } },
    select: { staffId: true },
  });
  const paidIds = new Set(paid.map(p => p.staffId));
  const today = startOfDay(now);

  let owner;
  let issued = 0;
  let held = 0;
  for (const s of staff) {
    if (paidIds.has(s.id)) continue;
    const payDate = payDateThisMonth(s, gym, now);
    if (!payDate || today < payDate || addedAfter(s, payDate)) continue;

    try {
      const calc = await computeMonthlyPay(gym.id, s.id, period);
      const short = shortfallOf(calc);
      if (short > 0) {
        owner ??= await prisma.staff.findFirst({
          where: { gymId: gym.id, role: 'general_manager', isActive: true },
          select: { id: true },
        });
        if (owner) await warnNotIssued(gym, owner, s, period, short, now);
        held += 1;
        continue;
      }
      // Checked again right before writing: someone may have issued it by hand
      // while this sweep was running.
      const taken = await prisma.payRecord.findFirst({
        where: { gymId: gym.id, staffId: s.id, month: period },
        select: { id: true },
      });
      if (taken) continue;

      await recordPay({
        gymId: gym.id, staff: s, month: period, note: AUTO_NOTE, issuedById: null, calc,
      });
      issued += 1;
    } catch (err) {
      console.error(`Automatic pay failed for staff ${s.id}:`, err.message);
    }
  }
  return { issued, held };
}

module.exports = { autoIssueForGym, payDateThisMonth, addedAfter, AUTO_NOTE, TITLE_NOT_ISSUED };
