const prisma = require('../utils/prisma');
const E = require('../utils/emailLayout');
const { Resend } = require('resend');
const { deliver } = require('../utils/sendEmail');
const { autoIssueForGym, payDateThisMonth, addedAfter } = require('./autoPayroll');
const { computeMonthlyPay } = require('../controllers/payAdjustment.controller');
const { shortfallOf } = require('../controllers/payroll.controller');

// How many days before the pay day the heads-up goes out
const REMINDER_LEAD_DAYS = 3;
// The job is cheap, so re-check a few times a day to survive restarts and
// long-running processes crossing midnight.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const NOTIF_TYPE = 'payroll';
const TITLE_UPCOMING = 'Payday Approaching';
const TITLE_OVERDUE = 'Payroll Overdue';
const TITLE_EMAIL_MARKER = 'Payroll Overdue Email Sent';

const periodKey = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

async function hasNotificationSince(gymId, title, since) {
  const existing = await prisma.notification.findFirst({
    where: { gymId, title, type: NOTIF_TYPE, createdAt: { gte: since } },
    select: { id: true },
  });
  return !!existing;
}

// Staff can each have their own pay day; the gym's value is only the default
// for anyone without an override. Reports counts only - never which staff are
// unpaid, what they earn, or when any individual is paid.
async function getUnpaidBuckets(gym, period, now) {
  const staff = await prisma.staff.findMany({
    where: { gymId: gym.id, isActive: true, salary: { gt: 0 } },
    select: { id: true, payDay: true, createdAt: true },
  });
  if (!staff.length) return { upcoming: 0, overdue: 0 };

  const paid = await prisma.payRecord.findMany({
    where: { gymId: gym.id, month: period, staffId: { in: staff.map(s => s.id) } },
    select: { staffId: true },
  });
  const paidIds = new Set(paid.map(p => p.staffId));
  const today = now.getDate();

  let upcoming = 0;
  let overdue = 0;
  for (const s of staff) {
    if (paidIds.has(s.id)) continue;
    const payDate = payDateThisMonth(s, gym, now);
    if (!payDate || addedAfter(s, payDate)) continue;
    const daysUntil = payDate.getDate() - today;
    if (daysUntil > 0 && daysUntil <= REMINDER_LEAD_DAYS) upcoming += 1;
    else if (daysUntil < 0) {
      // Pay held back by its own deductions already has its own notice, so it
      // is not chased a second time as overdue.
      const held = await computeMonthlyPay(gym.id, s.id, period)
        .then(calc => shortfallOf(calc) > 0)
        .catch(() => false);
      if (!held) overdue += 1;
    }
  }
  return { upcoming, overdue };
}

async function sendOverdueEmail(owner, gymName, count, period, gymCode) {
  if (!process.env.RESEND_API_KEY || !owner?.email) return false;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const plural = count === 1 ? 'staff member is' : 'staff members are';

  await deliver(resend, {
    from: E.sender(gymName),
    to: owner.email,
    subject: `Payroll overdue at ${gymName} for ${period}`,
    html: E.layout({
      brand: { name: gymName }, preheader: `${count} ${plural} waiting for ${period} pay.`, eyebrow: 'Payroll', title: 'Payroll is overdue',
      body: [
        E.greeting(owner.firstName),
        E.pHtml(`At ${E.strong(gymName)}, some staff are past their pay date and still waiting to be paid for ${E.strong(period)}.`),
        E.highlight({ label: 'Waiting to be paid', value: String(count), sub: count === 1 ? 'staff member' : 'staff members', tone: 'red' }),
        E.button(`${process.env.FRONTEND_URL || 'http://localhost:5173'}${gymCode ? `/${encodeURIComponent(gymCode)}` : ''}/login`, 'Open GEM and pay them'),
        E.small('For privacy, this email has no names, pay dates or amounts. They are only shown inside GEM.'),
      ].join(''),
    }),
  });
  return true;
}

async function checkGym(gym, now) {
  const period = periodKey(now);
  const { upcoming, overdue } = await getUnpaidBuckets(gym, period, now);
  if (upcoming === 0 && overdue === 0) return;

  // Reminders go to the owner only - a gym-wide notification would leak
  // payroll activity to front desk and other staff.
  const owner = await prisma.staff.findFirst({
    where: { gymId: gym.id, role: 'general_manager', isActive: true },
    select: { id: true, firstName: true, email: true },
  });
  if (!owner) return;

  const noun = (n) => (n === 1 ? 'staff member is' : 'staff members are');

  // Heads-up shortly before someone's pay day - once per month
  if (upcoming > 0 && !(await hasNotificationSince(gym.id, TITLE_UPCOMING, startOfMonth(now)))) {
    await prisma.notification.create({
      data: {
        gymId: gym.id,
        staffId: owner.id,
        title: TITLE_UPCOMING,
        body: `${upcoming} ${noun(upcoming)} due to be paid within the next ${REMINDER_LEAD_DAYS} days for ${period}.`,
        type: NOTIF_TYPE,
      },
    });
  }

  // Past someone's pay day and still outstanding - notify daily, email once
  if (overdue > 0) {
    if (!(await hasNotificationSince(gym.id, TITLE_OVERDUE, startOfDay(now)))) {
      await prisma.notification.create({
        data: {
          gymId: gym.id,
          staffId: owner.id,
          title: TITLE_OVERDUE,
          body: `${overdue} ${noun(overdue)} past their pay date for ${period}.`,
          type: NOTIF_TYPE,
        },
      });
    }

    if (!(await hasNotificationSince(gym.id, TITLE_EMAIL_MARKER, startOfMonth(now)))) {
      try {
        const sent = await sendOverdueEmail(owner, gym.name, overdue, period, gym.code);
        if (sent) {
          // Marker row so the email only goes out once per pay period
          await prisma.notification.create({
            data: {
              gymId: gym.id,
              staffId: owner.id,
              title: TITLE_EMAIL_MARKER,
              body: `Overdue payroll email sent for ${period}.`,
              type: NOTIF_TYPE,
              isRead: true,
            },
          });
        }
      } catch (err) {
        console.error('Payroll overdue email failed:', err.message);
      }
    }
  }
}

async function runPayrollReminders() {
  const now = new Date();
  try {
    // Every gym is swept: a gym with no default pay day may still have staff
    // carrying their own, and getUnpaidBuckets skips anyone with neither.
    const gyms = await prisma.gym.findMany({
      select: { id: true, name: true, code: true, payDay: true },
    });
    for (const gym of gyms) {
      try {
        await autoIssueForGym(gym, now);
        await checkGym(gym, now);
      } catch (err) {
        console.error(`Payroll reminder failed for gym ${gym.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Payroll reminder sweep failed:', err.message);
  }
}

function startPayrollReminders() {
  // Small delay so it doesn't compete with server startup
  setTimeout(runPayrollReminders, 30_000);
  const timer = setInterval(runPayrollReminders, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startPayrollReminders, runPayrollReminders, getUnpaidBuckets };
