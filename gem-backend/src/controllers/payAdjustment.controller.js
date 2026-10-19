const prisma = require('../utils/prisma');
const { logActivity, changesBetween, describeChanges, fullName, money } = require('../utils/activityLog');
const { normaliseMonth } = require('../utils/payPeriod');

const PAYROLL_ROLES = ['general_manager'];
const KINDS = ['bonus', 'deduction'];

const SELECT = {
  id: true, kind: true, label: true, amount: true,
  recurring: true, month: true, note: true, isActive: true, createdAt: true,
};

// Everything that applies to one staff member for one pay period: every active
// recurring item, plus one-off items tagged with that month.
async function adjustmentsForMonth(gymId, staffId, month) {
  return prisma.payAdjustment.findMany({
    where: {
      gymId,
      staffId,
      isActive: true,
      OR: [{ recurring: true }, { recurring: false, month }],
    },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    select: SELECT,
  });
}

// Pay periods are stored as 'Sep 2026'. Turn one into a local date range so
// time cards for that month can be summed.
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthRange(month) {
  const m = /^([A-Za-z]{3,})\s+(\d{4})$/.exec(String(month || '').trim());
  if (!m) return null;
  const idx = SHORT_MONTHS.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
  if (idx < 0) return null;
  const year = Number(m[2]);
  return { start: new Date(year, idx, 1), end: new Date(year, idx + 1, 1) };
}

// Hours actually clocked in a month. An open shift has no hours yet, so only
// cards that have been punched out count.
async function hoursWorked(gymId, staffId, month) {
  const range = monthRange(month);
  if (!range) return 0;
  const cards = await prisma.timeCard.findMany({
    where: {
      gymId, staffId,
      date: { gte: range.start, lt: range.end },
      punchOut: { not: null },
      // Only signed-off hours count. Pending and rejected cards earn nothing.
      OR: [{ approvalStatus: null }, { approvalStatus: 'approved' }],
    },
    select: { punchIn: true, punchOut: true },
  });
  const ms = cards.reduce((sum, c) => sum + Math.max(0, new Date(c.punchOut) - new Date(c.punchIn)), 0);
  return Math.round((ms / 3600000) * 100) / 100;
}

// Base pay plus bonuses minus deductions, with the itemised list that produced
// the figure so a payslip can still explain itself later.
//
// Full-time pay is the same every month whatever the hours worked. Part-time
// pay is the hourly rate against the hours actually clocked that month.
async function computeMonthlyPay(gymId, staffId, month) {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    select: { salary: true, employmentType: true },
  });
  const isPartTime = staff?.employmentType === 'Part Time';
  const rate = Number(staff?.salary) || 0;

  const [items, hours] = await Promise.all([
    adjustmentsForMonth(gymId, staffId, month),
    isPartTime ? hoursWorked(gymId, staffId, month) : Promise.resolve(null),
  ]);

  const basePay = isPartTime ? Math.round(rate * hours) : rate;
  const bonuses = items.filter(i => i.kind === 'bonus');
  const deductions = items.filter(i => i.kind === 'deduction');
  const totalBonuses = bonuses.reduce((s, i) => s + i.amount, 0);
  const totalDeductions = deductions.reduce((s, i) => s + i.amount, 0);

  return {
    month,
    basePay,
    isPartTime,
    hourlyRate: isPartTime ? rate : null,
    hoursWorked: hours,
    bonuses,
    deductions,
    totalBonuses,
    totalDeductions,
    net: Math.max(0, basePay + totalBonuses - totalDeductions),
    // How far the deductions overshoot the pay; such a period cannot be issued
    shortfall: Math.max(0, totalDeductions - basePay - totalBonuses),
  };
}

async function listForStaff(req, res) {
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, gymId: req.user.gymId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  const isSelf = String(req.user.id) === String(req.params.staffId);
  if (!isSelf && !PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed to view these pay adjustments' });
  }

  const items = await prisma.payAdjustment.findMany({
    where: { gymId: req.user.gymId, staffId: req.params.staffId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: SELECT,
  });
  res.json(items);
}

// Preview of what a given month would pay, used to pre-fill Issue Pay
async function preview(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can view pay calculations' });
  }
  const month = String(req.query.month || '').trim();
  if (!month) return res.status(400).json({ error: 'month is required' });

  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, gymId: req.user.gymId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  res.json(await computeMonthlyPay(req.user.gymId, req.params.staffId, month));
}

async function create(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can change pay adjustments' });
  }

  const { staffId, kind, label, amount, recurring, month, note } = req.body;
  const value = Number(amount);

  if (!staffId || !label?.trim()) return res.status(400).json({ error: 'staffId and label are required' });
  if (!KINDS.includes(kind)) return res.status(400).json({ error: "kind must be 'bonus' or 'deduction'" });
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

  const isRecurring = !!recurring;
  // A one-off has to say which period it belongs to, otherwise it would either
  // never apply or silently repeat. It is written the way pay records are, or
  // "oct 2026" would never be applied to the pay for "Oct 2026".
  const period = isRecurring ? null : normaliseMonth(month);
  if (!isRecurring && !period) {
    return res.status(400).json({ error: 'A one-time adjustment needs a month', field: 'month' });
  }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId: req.user.gymId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // A paid month has its breakdown already snapshotted on the record, so an
  // adjustment added afterwards would never be applied to anything.
  if (!isRecurring) {
    const alreadyPaid = await prisma.payRecord.findFirst({
      where: { gymId: req.user.gymId, staffId, month: period },
      select: { id: true },
    });
    if (alreadyPaid) {
      return res.status(409).json({ error: `${period} has already been paid, so it cannot take a new adjustment.` });
    }
  }

  const item = await prisma.payAdjustment.create({
    data: {
      gymId: req.user.gymId,
      staffId,
      kind,
      label: label.trim(),
      amount: value,
      recurring: isRecurring,
      month: period,
      note: note?.trim() || null,
    },
    select: SELECT,
  });
  logActivity(req, {
    category: 'payroll', action: `${kind}.created`,
    summary: `Added a ${kind} for ${fullName(staff)}: ${item.label}, ${money(item.amount)}, ${item.recurring ? 'every month' : `for ${item.month}`}`,
    target: { type: 'staff', id: staff.id },
    ...(item.note ? { details: { note: item.note } } : {}),
  });
  res.status(201).json(item);
}

async function update(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can change pay adjustments' });
  }
  const existing = await prisma.payAdjustment.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, kind: true, label: true, amount: true, recurring: true, month: true, isActive: true, note: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Adjustment not found' });

  const data = {};
  if (req.body.label !== undefined) data.label = String(req.body.label).trim();
  if (req.body.note !== undefined) data.note = req.body.note?.trim() || null;
  if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
  if (req.body.amount !== undefined) {
    const value = Number(req.body.amount);
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
    data.amount = value;
  }

  const item = await prisma.payAdjustment.update({
    where: { id: req.params.id },
    data,
    select: SELECT,
  });
  const changes = changesBetween(existing, item, { label: 'Label', amount: 'Amount', isActive: 'Status', note: 'Note' }, {
    format: { amount: (v) => money(v), isActive: (v) => (v ? 'Active' : 'Stopped') },
  });
  if (changes.length) {
    logActivity(req, {
      category: 'payroll', action: `${existing.kind}.updated`,
      summary: `Changed ${fullName(existing.staff)}'s ${existing.kind} "${item.label}": ${describeChanges(changes)}`,
      target: { type: 'staff', id: existing.staffId }, details: { changes },
    });
  }
  res.json(item);
}

async function remove(req, res) {
  if (!PAYROLL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can remove pay adjustments' });
  }
  const existing = await prisma.payAdjustment.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, kind: true, label: true, amount: true, recurring: true, month: true, isActive: true, note: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Adjustment not found' });

  await prisma.payAdjustment.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'payroll', action: `${existing.kind}.deleted`,
    summary: `Removed ${fullName(existing.staff)}'s ${existing.kind} "${existing.label}" (${money(existing.amount)})`,
    target: { type: 'staff', id: existing.staffId },
  });
  res.json({ message: 'Adjustment removed' });
}

module.exports = { listForStaff, preview, create, update, remove, computeMonthlyPay };
