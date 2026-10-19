const prisma = require('../utils/prisma');
const { computeMonthlyPay } = require('./payAdjustment.controller');
const { logActivity, fullName } = require('../utils/activityLog');
const { bestEffort } = require('../utils/bestEffort');

// Issuing pay moves money, so it stays with the gym owner rather than
// following the broader profile-edit permissions.
const PAYROLL_ROLES = ['general_manager'];

async function listForStaff(req, res) {
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, gymId: req.user.gymId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // Staff may see their own pay history; otherwise it's owner-only
  const isSelf = String(req.user.id) === String(req.params.staffId);
  if (!isSelf && !PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed to view this pay history' });
  }

  const records = await prisma.payRecord.findMany({
    where: { gymId: req.user.gymId, staffId: req.params.staffId },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true, month: true, amount: true, deductions: true, netAmount: true, basePay: true, breakdown: true,
      status: true, paidAt: true, note: true, issuedAt: true,
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });
  res.json(records);
}

const RECORD_SELECT = {
  id: true, month: true, amount: true, deductions: true, netAmount: true, basePay: true, breakdown: true,
  status: true, paidAt: true, note: true, issuedAt: true,
  issuedBy: { select: { firstName: true, lastName: true } },
  staff: { select: { id: true, firstName: true, lastName: true, role: true } },
};

const { formatMoney } = require('../utils/money');
const money = (n) => formatMoney(n);

const { SHORT_MONTHS, normaliseMonth } = require('../utils/payPeriod');

function paystubsLink(month) {
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(month || '').trim());
  const idx = m ? SHORT_MONTHS.indexOf(m[1]) : -1;
  return idx < 0
    ? '/accounting?tab=paystubs'
    : `/accounting?tab=paystubs&month=${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

// Deductions bigger than the pay leave nothing to pay out, and issuing would
// still use up the one-time deductions, so the excess would disappear. A
// period like that waits until someone fixes the deductions.
const shortfallOf = (calc) => (calc ? Math.max(0, calc.totalDeductions - calc.basePay - calc.totalBonuses) : 0);

const shortfallMessage = (month, short) =>
  `Deductions for ${month} are ${money(short)} more than the pay. Reduce or remove a deduction, then issue the pay.`;

// Writes a pay record. Shared by the Issue Pay button and the pay day job, so
// both leave the same snapshot and clear the same one-time items.
// The pay is what the person earned (basic plus bonuses), and that is what the
// books show as paid. Deductions are withheld from it, so what is handed over
// is less. Both are kept, so nobody is overpaid and nobody reads the lower
// figure as the salary.
function payFigures(calc) {
  const gross = Math.round((calc?.basePay || 0) + (calc?.totalBonuses || 0));
  const deductions = Math.round(calc?.totalDeductions || 0);
  return { gross, deductions, net: gross - deductions };
}

async function recordPay({ gymId, staff, month, note, issuedById, calc, req = null }) {
  const { gross, deductions, net } = payFigures(calc);
  const amount = gross;
  // Snapshot what the figure was made of, so a payslip read months later still
  // explains itself even if the adjustments have since changed.
  const snapshot = calc ? {
    basePay: calc.basePay,
    bonuses: calc.bonuses.map(b => ({ label: b.label, amount: b.amount, recurring: b.recurring })),
    deductions: calc.deductions.map(d => ({ label: d.label, amount: d.amount, recurring: d.recurring })),
    totalBonuses: calc.totalBonuses,
    totalDeductions: calc.totalDeductions,
  } : null;

  // Whether the month is already paid is checked and the record written while
  // holding a lock for that person and month: two clicks on Issue Pay, or the
  // pay day job running at the same moment, used to pay a month twice.
  const record = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${gymId}:${staff.id}:${month}`}))`;
    const paid = await tx.payRecord.findFirst({ where: { gymId, staffId: staff.id, month }, select: { id: true } });
    if (paid) return null;
    return tx.payRecord.create({
      data: {
        gymId,
        staffId: staff.id,
        month,
        amount,
        deductions,
        netAmount: net,
        basePay: snapshot?.basePay ?? null,
        breakdown: snapshot,
        note: note || null,
        issuedById: issuedById || null,
      },
      select: RECORD_SELECT,
    });
  });
  if (!record) return null;

  logActivity(req, {
    gymId,
    ...(issuedById ? {} : { actor: null }),
    category: 'payroll', action: issuedById ? 'pay.issued' : 'pay.issued_auto',
    summary: issuedById
      ? `Issued ${fullName(staff)}'s pay for ${month}: ${money(amount)}${deductions ? `, ${money(net)} to hand over after ${money(deductions)} in deductions` : ''}`
      : `Issued ${fullName(staff)}'s pay for ${month} automatically on the pay day: ${money(amount)}${deductions ? `, ${money(net)} to hand over after ${money(deductions)} in deductions` : ''}`,
    target: { type: 'staff', id: staff.id },
    ...(snapshot ? {
      details: { basePay: money(snapshot.basePay), bonuses: money(snapshot.totalBonuses), deductions: money(snapshot.totalDeductions) },
    } : {}),
  });

  // One-time adjustments for this period have now been consumed into the
  // record's breakdown, so remove them. Recurring ones carry on.
  try {
    await prisma.payAdjustment.deleteMany({
      where: { gymId, staffId: staff.id, recurring: false, month },
    });
  } catch (err) {
    console.error('Clearing one-time adjustments failed:', err.message);
  }

  // Pay is the owner's business alone, so managers are not told what anyone earns
  bestEffort(prisma.notification.create({
    data: {
      gymId,
      title: 'Staff Pay Issued',
      body: `${staff.firstName} ${staff.lastName}'s pay for ${month} was issued${issuedById ? '' : ' automatically on their pay day'}: ${money(amount)}.${
        deductions
          ? ` Hand over ${money(net)}, not ${money(amount)}: ${money(deductions)} is withheld in deductions.`
          : ` Hand over ${money(net)}.`
      } Mark it as paid once the money is sent.`,
      type: 'system',
      link: paystubsLink(month),
      audience: 'owner',
    },
  }), 'Pay issued notification');

  return record;
}

async function create(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can issue pay' });
  }

  // The amount is worked out here from the salary, hours, bonuses and
  // deductions. Nothing typed in the browser can change it.
  const { staffId, note } = req.body;
  if (!staffId || !req.body.month) {
    return res.status(400).json({ error: 'staffId and month are required' });
  }
  const month = normaliseMonth(req.body.month);
  if (!month) return res.status(400).json({ error: 'Choose the month to pay, like "Oct 2026".', field: 'month' });

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId: req.user.gymId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // Guard against paying the same period twice by accident
  const duplicate = await prisma.payRecord.findFirst({
    where: { gymId: req.user.gymId, staffId, month },
    select: { id: true },
  });
  if (duplicate) {
    return res.status(409).json({ error: `${staff.firstName} has already been paid for ${month}.` });
  }

  let calc = null;
  try {
    calc = await computeMonthlyPay(req.user.gymId, staffId, month);
  } catch (err) {
    console.error('Pay calculation failed:', err.message);
  }
  if (!calc) return res.status(500).json({ error: 'Could not work out this pay. Try again.' });
  const short = shortfallOf(calc);
  if (short > 0) return res.status(400).json({ error: shortfallMessage(month, short) });

  const record = await recordPay({
    gymId: req.user.gymId, staff, month, note, issuedById: req.user.id, calc, req,
  });
  if (!record) return res.status(409).json({ error: `${staff.firstName} has already been paid for ${month}.` });
  res.status(201).json(record);
}

// Every issued pay record for the gym, optionally for one month. Drives the
// payroll view in Accounting.
async function listAll(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed to view gym payroll' });
  }
  const asked = String(req.query.month || '').trim();
  const month = asked ? (normaliseMonth(asked) || asked) : '';

  const records = await prisma.payRecord.findMany({
    where: { gymId: req.user.gymId, ...(month ? { month } : {}) },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true, month: true, amount: true, deductions: true, netAmount: true, basePay: true, breakdown: true,
      status: true, paidAt: true, note: true, issuedAt: true,
      staff: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
  res.json(records);
}

// Confirms the money actually left the business. Issuing pay only records the
// intent; this is the step that settles it.
async function setStatus(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can settle payroll' });
  }
  const { status } = req.body;
  if (!['issued', 'paid'].includes(status)) {
    return res.status(400).json({ error: "status must be 'issued' or 'paid'" });
  }

  const existing = await prisma.payRecord.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, month: true, amount: true, deductions: true, netAmount: true, status: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Pay record not found' });

  const record = await prisma.payRecord.update({
    where: { id: req.params.id },
    data: { status, paidAt: status === 'paid' ? new Date() : null },
    select: RECORD_SELECT,
  });

  if (existing.status !== status) {
    logActivity(req, {
      category: 'payroll', action: status === 'paid' ? 'pay.marked_paid' : 'pay.marked_unpaid',
      summary: status === 'paid'
        ? `Marked ${fullName(existing.staff)}'s pay for ${existing.month} as paid: ${money(existing.amount)}${existing.deductions ? `, of which ${money(existing.netAmount ?? existing.amount - existing.deductions)} was handed over and ${money(existing.deductions)} withheld in deductions` : ''}`
        : `Reversed ${fullName(existing.staff)}'s pay for ${existing.month} from paid back to unpaid`,
      target: { type: 'staff', id: existing.staffId },
    });
  }

  if (status === 'paid') {
    bestEffort(prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        title: 'Staff Pay Settled',
        body: `${existing.staff.firstName} ${existing.staff.lastName}'s pay for ${existing.month} has been marked as paid.`,
        type: 'system',
        link: paystubsLink(existing.month),
        audience: 'owner',
      },
    }), 'Pay settled notification');
  }

  res.json(record);
}

async function remove(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can remove a pay record' });
  }
  const existing = await prisma.payRecord.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, month: true, amount: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Pay record not found' });

  await prisma.payRecord.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'payroll', action: 'pay.deleted',
    summary: `Deleted ${fullName(existing.staff)}'s pay record for ${existing.month} (${money(existing.amount)})`,
    target: { type: 'staff', id: existing.staffId },
  });
  res.json({ message: 'Pay record removed' });
}

module.exports = { listForStaff, listAll, create, setStatus, remove, recordPay, shortfallOf };
