const prisma = require('../utils/prisma');
const { bestEffort } = require('../utils/bestEffort');
const { generatePaymentRef } = require('../utils/paymentRef');
const { toPaymentMethod } = require('../utils/paymentMethod');
const { readTz } = require('../utils/localDay');
const { logActivity, fullName, money } = require('../utils/activityLog');
const { sendPaymentReceipt, sendMembershipUpdate } = require('../utils/memberEmail');

// Renewing, changing package, a day pass, a visitor bundle, converting to a
// visitor and renewing the registration fee: each takes the money and makes the
// change in one transaction (D-20). The screens used to record the payment,
// then write the member's balance, dates and passes themselves, so anyone at
// the desk could set them to anything, and a payment could stand for a change
// that never happened (F-057, F-108, F-181).

// ── Days ── membership dates are calendar days, stored at midnight UTC
const ymd = (d) => d.toISOString().slice(0, 10);
const asDate = (day) => (day ? new Date(`${day}T00:00:00.000Z`) : null);
const dayOf = (value) => (value ? ymd(new Date(value)) : null);
// The person's own day (tz is their browser's getTimezoneOffset)
const todayFor = (tz) => ymd(new Date(Date.now() - tz * 60000));
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(asDate(v).getTime());
function addDays(day, n) { const d = asDate(day); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function addMonths(day, n) { const d = asDate(day); d.setUTCMonth(d.getUTCMonth() + n); return ymd(d); }

// Names older packages were known by before they carried a duration
const LEGACY_MONTHS = { 'Basic Monthly': 1, 'Standard 6M': 6, 'Premium 12M': 12, 'Student Monthly': 1, 'Visitor Pass': 0 };

// The last day of a membership on this package that starts on `start`; the
// same sum the profile shows before anything is confirmed
function endOf(start, pkg) {
  if (!pkg || !start) return start;
  if (pkg.durationDays) return addDays(start, pkg.durationDays);
  const m = /^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i.exec(String(pkg.duration || '').trim());
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    if (unit.startsWith('day')) return addDays(start, n);
    if (unit.startsWith('week')) return addDays(start, n * 7);
    if (unit.startsWith('month')) return addMonths(start, n);
    return addMonths(start, n * 12);
  }
  const months = LEGACY_MONTHS[pkg.name];
  return months ? addMonths(start, months) : start;
}

// The sessions a package grants; null means no limit
function allowanceOf(pkg) {
  if (!pkg) return null;
  if (pkg.maxPasses != null && Number(pkg.maxPasses) > 0) return Number(pkg.maxPasses);
  const raw = String(pkg.sessions ?? '').trim();
  if (!raw || /unlimited/i.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const passesLeft = (m) => Math.max(0, m.passesRemaining || 0) + Math.max(0, m.dayPasses || 0);
const passesOf = (m) => Math.max(m.passesTotal || 0, passesLeft(m));

// What is paid now, as one or more payments (part cash, part mobile money)
function readPayments(raw) {
  const list = raw == null ? [] : raw;
  if (!Array.isArray(list) || list.length > 5) return { error: 'The payments could not be read.', field: 'amount' };
  const payments = [];
  for (const p of list) {
    const amount = Number(p?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above zero.', field: 'amount' };
    payments.push({ amount, method: toPaymentMethod(p.method), reference: p.reference ? String(p.reference).slice(0, 60) : null });
  }
  return { payments, paid: payments.reduce((n, p) => n + p.amount, 0) };
}

const refuse = (error, field, extra) => ({ refused: { error, ...(field ? { field } : {}), ...extra } });
const owes = (member) => Math.max(0, Number(member.balance) || 0);
const settleFirst = (member, what) => refuse(`${fullName(member)} still owes ${money(owes(member))}. Settle the balance before ${what}.`, 'balance', { owes: owes(member) });
const usable = (pkg) => pkg && pkg.isActive !== false;

// Runs one action: plan() checks the member and works out the change and its
// price; then, with the member's row locked, the payments are recorded (each
// with the balance it leaves) and the change is written. Receipts and emails
// go out once it has all been saved.
function action(kind, plan) {
  return async (req, res) => {
    const read = readPayments(req.body?.payments);
    if (read.error) return res.status(400).json(read);
    const today = todayFor(readTz(req.body));
    const id = String(req.params.id);

    const outcome = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw`SELECT "id" FROM "Member" WHERE ("id" = ${id} OR "memberCode" = ${id}) AND "gymId" = ${req.user.gymId} FOR UPDATE`;
      if (!row) return { status: 404, body: { error: 'Member not found' } };
      const member = await tx.member.findUnique({ where: { id: row.id }, include: { package: true } });
      const gym = await tx.gym.findUnique({ where: { id: req.user.gymId }, select: { minUpfrontPercent: true, registrationFee: true } });
      const findPackage = async (packageId) => (packageId ? tx.package.findFirst({ where: { id: String(packageId), gymId: req.user.gymId } }) : null);
      const p = await plan({ member, gym, today, paid: read.paid, body: req.body || {}, findPackage });
      if (p.refused) return { status: 400, body: p.refused };
      if (read.paid > p.charge) return { status: 400, body: { error: `Cannot collect more than the ${money(p.charge)} it costs.`, field: 'amount' } };
      if (read.paid < p.minimum) return { status: 400, body: { error: `At least ${money(p.minimum)} must be paid now.`, field: 'amount', minimum: p.minimum } };

      const base = Math.max(0, Number(member.balance) || 0) * (p.keepsBalance ? 1 : 0);
      let paidSoFar = 0;
      const payments = [];
      for (const pay of read.payments) {
        paidSoFar += pay.amount;
        payments.push(await tx.payment.create({
          data: {
            gymId: req.user.gymId, memberId: member.id, staffId: req.user.id,
            amount: pay.amount, method: pay.method, type: p.paymentType, note: p.note,
            reference: pay.reference || generatePaymentRef(),
            balanceAfter: base + (p.charge - paidSoFar),
          },
        }));
      }
      const data = typeof p.data === 'function' ? p.data(read.paid) : p.data;
      const updated = await tx.member.update({ where: { id: member.id }, data, include: { package: true } });
      return { member: updated, before: member, payments, plan: p };
    });
    if (outcome.status) return res.status(outcome.status).json(outcome.body);

    const { member, payments, plan: p } = outcome;
    logActivity(req, {
      category: 'members', action: `member.${kind}`,
      summary: `${p.summary} for ${fullName(member)}${read.paid ? `, ${money(read.paid)} paid` : ''}`,
      target: { type: 'member', id: member.id },
    });
    if (read.paid > 0) {
      bestEffort(prisma.notification.create({ data: { gymId: req.user.gymId, title: 'Payment Received', body: `${money(read.paid)} received from ${fullName(member)}.`, type: 'payment' } }), 'Payment notification');
    }
    for (const payment of payments) bestEffort(sendPaymentReceipt(payment, member, req.user.gymId), 'Payment receipt');
    if (p.email) bestEffort(sendMembershipUpdate(member, p.email, req.user.gymId), 'Membership email');
    res.json({ member, payments });
  };
}

// ── Renew: a new term on a monthly package, from today or when the current one ends
const renew = action('renewed', async ({ member, today, body, findPackage }) => {
  if (owes(member) > 0) return settleFirst(member, 'renewing');
  const pkg = await findPackage(body.packageId);
  if (!usable(pkg) || pkg.isVisitor) return refuse('Choose a membership package.', 'packageId');
  const start = body.startDate;
  if (!isDay(start)) return refuse('Choose when the membership starts.', 'startDate');
  if (start < today) return refuse('A membership cannot start before today.', 'startDate');
  const end = endOf(start, pkg);
  const allowance = allowanceOf(pkg);
  const price = Number(pkg.price) || 0;
  return {
    charge: price, minimum: Math.min(price, Number(pkg.minPayment ?? price) || 0),
    paymentType: 'membership', note: `${pkg.name} membership`, summary: `Renewed the membership on ${pkg.name}`, email: 'renew_membership',
    data: (paid) => ({
      packageId: pkg.id, startDate: asDate(start), endDate: asDate(end), balance: Math.max(0, price - paid),
      status: start > today ? 'pending' : 'active', isVisitor: false, passesTotal: allowance, passesRemaining: allowance,
    }),
  };
});

// ── Change package: onto another monthly package, starting today
const changePackage = action('package_changed', async ({ member, today, body, findPackage }) => {
  if (owes(member) > 0) return settleFirst(member, 'changing package');
  const pkg = await findPackage(body.packageId);
  if (!usable(pkg) || pkg.isVisitor) return refuse('Choose a membership package.', 'packageId');
  if (pkg.id === member.packageId) return refuse(`${fullName(member)} is already on ${pkg.name}.`, 'packageId');
  const price = Number(pkg.price) || 0;
  return {
    charge: price, minimum: Math.min(price, Number(pkg.minPayment ?? price) || 0),
    paymentType: 'membership', note: `Package change to ${pkg.name}`, summary: `Moved to ${pkg.name}`,
    data: (paid) => ({ packageId: pkg.id, startDate: asDate(today), endDate: asDate(endOf(today, pkg)), balance: Math.max(0, price - paid), status: 'active' }),
  };
});

// ── Day pass: one day's entry at a monthly package's day-pass price, paid in full.
// A lapsed member buys it on their own package; a visitor names the package.
const dayPass = action('day_pass', async ({ member, today, body, findPackage }) => {
  const isVisitor = !!member.isVisitor || member.status === 'visitor';
  if (isVisitor && owes(member) > 0) return settleFirst(member, 'buying new passes');
  const pkg = isVisitor ? await findPackage(body.packageId) : member.package;
  if (!usable(pkg) || pkg.isVisitor || pkg.dayPassPrice == null) {
    return refuse(isVisitor ? 'Choose a monthly package that sells day passes.' : 'This member\'s package has no day-pass price.', 'packageId');
  }
  const held = member.dayPasses || 0;
  const bundleLeft = member.endDate && dayOf(member.endDate) >= today ? Math.max(0, member.passesRemaining || 0) : 0;
  const unused = isVisitor ? bundleLeft + held : 0;
  if (isVisitor && unused > 0 && pkg.id !== member.packageId) {
    return refuse(`${fullName(member)} still has ${unused} pass(es) on ${member.package?.name || 'their package'}. Use them first.`, 'packageId');
  }
  const price = Number(pkg.dayPassPrice) || 0;
  const data = isVisitor
    ? {
        dayPasses: held + 1, status: 'visitor',
        // Once every pass is spent the count starts again (1 of 1, not 1 of 12);
        // passes left on a bundle that has run out go with it
        passesTotal: unused > 0 ? passesOf(member) + 1 : 1,
        ...(unused > 0 ? {} : { passesRemaining: 0 }),
        ...(!member.endDate || dayOf(member.endDate) < today ? { endDate: asDate(today) } : {}),
      }
    : { dayPasses: held + 1 };
  return { charge: price, minimum: price, keepsBalance: true, paymentType: 'product', note: `Day pass - ${pkg.name}`, summary: 'Sold a day pass', data };
});

// ── Visitor bundle: passes for a visitor; unused ones carry over while still valid
const visitorBundle = action('visitor_bundle', async ({ member, gym, today, body, findPackage }) => {
  if (owes(member) > 0) return settleFirst(member, 'buying new passes');
  const pkg = await findPackage(body.packageId);
  if (!usable(pkg) || !pkg.isVisitor) return refuse('Choose a visitor bundle.', 'packageId');
  const stillValid = !!member.endDate && dayOf(member.endDate) >= today;
  const carryOver = stillValid ? Math.max(0, member.passesRemaining || 0) : 0;
  const held = Math.max(0, member.dayPasses || 0);
  if (carryOver + held > 0 && pkg.id !== member.packageId) {
    return refuse(`${fullName(member)} still has ${carryOver + held} pass(es) on ${member.package?.name || 'their package'}. Use them first.`, 'packageId');
  }
  const price = Number(pkg.price) || 0;
  const passes = carryOver + (allowanceOf(pkg) || 0);
  const from = stillValid ? dayOf(member.endDate) : today;
  return {
    charge: price, minimum: Math.ceil(price * (gym.minUpfrontPercent || 50) / 100),
    paymentType: 'product', note: `Visitor bundle - ${pkg.name}`, summary: `Sold the visitor bundle ${pkg.name}`,
    data: (paid) => ({
      isVisitor: true, status: 'visitor', packageId: pkg.id,
      passesTotal: passes + held, passesRemaining: passes,
      endDate: pkg.durationDays ? asDate(addDays(from, pkg.durationDays)) : null,
      balance: Math.max(0, price - paid),
      ...(stillValid ? {} : { startDate: asDate(today) }),
    }),
  };
});

// ── Convert to visitor: a member leaves their membership for a visitor bundle
const convertToVisitor = action('converted_to_visitor', async ({ member, gym, today, body, findPackage }) => {
  if (member.isVisitor) return refuse(`${fullName(member)} is already a visitor.`);
  if (owes(member) > 0) return settleFirst(member, 'converting');
  const pkg = await findPackage(body.packageId);
  if (!usable(pkg) || !pkg.isVisitor) return refuse('Choose a visitor bundle.', 'packageId');
  const price = Number(pkg.price) || 0;
  const sessions = allowanceOf(pkg);
  return {
    charge: price, minimum: Math.ceil(price * (gym.minUpfrontPercent || 50) / 100),
    paymentType: 'product', note: `Converted to visitor - ${pkg.name}`, summary: `Converted to a visitor on ${pkg.name}`, email: 'convert_to_visitor',
    data: (paid) => ({
      isVisitor: true, status: 'visitor', packageId: pkg.id,
      startDate: asDate(today), endDate: pkg.durationDays ? asDate(addDays(today, pkg.durationDays)) : null,
      passesTotal: sessions, passesRemaining: sessions, balance: Math.max(0, price - paid),
    }),
  };
});

// ── Registration fee: the gym's own yearly fee, paid in full
const registrationFee = action('registration_renewed', async ({ member, gym, today }) => {
  const fee = Number(gym.registrationFee) || 0;
  if (fee <= 0) return refuse('This gym charges no registration fee.');
  return {
    charge: fee, minimum: fee, keepsBalance: true, paymentType: 'registration', note: 'Registration fee renewal', summary: 'Renewed the registration',
    data: { regFeeDate: asDate(today), ...(member.status === 'suspended' ? { status: 'active' } : {}) },
  };
});

module.exports = { renew, changePackage, dayPass, visitorBundle, convertToVisitor, registrationFee };
