const prisma = require('../utils/prisma');
const { sendPaymentReceipt } = require('../utils/memberEmail');
const { logActivity, money } = require('../utils/activityLog');
const { bestEffort } = require('../utils/bestEffort');

const { generatePaymentRef } = require('../utils/paymentRef');

const { readPaymentMethod } = require('../utils/paymentMethod');
const { DAY, readTz, startOfLocalDay } = require('../utils/localDay');

const TYPE_MAP = {
  Membership: 'membership', membership: 'membership',
  'Registration Fee': 'registration', registration: 'registration',
  'Day Pass': 'other',
  Package: 'membership',
  Product: 'product', product: 'product',
  Other: 'other', other: 'other',
};

// ?date=YYYY-MM-DD&tz= is that whole local day and ?limit=N the latest N, so a
// screen showing today's takings or the last few payments is not sent every
// payment the gym ever took (F-099). Without them, every payment as before.
async function getAll(req, res) {
  const day = DAY.test(String(req.query.date || '')) ? startOfLocalDay(req.query.date, readTz(req.query)) : null;
  const limit = Math.min(500, Math.max(0, parseInt(req.query.limit, 10) || 0));
  const payments = await prisma.payment.findMany({
    where: { gymId: req.user.gymId, ...(day ? { createdAt: { gte: day, lt: new Date(day.getTime() + 86400000) } } : {}) },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, avatarColor: true, photo: true } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
    },
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  });
  res.json(payments);
}

async function create(req, res) {
  const { reference, description, memberId, amount, method, type, note } = req.body;
  // A prerequisite payment collected inside an action modal (day pass, convert,
  // package change) passes notify:false - the receipt is sent only once the
  // action itself is confirmed, via POST /payments/:id/receipt.
  const notify = req.body.notify !== false;

  if (typeof memberId !== 'string' || !memberId.trim()) {
    return res.status(400).json({ error: 'Choose the member who is paying.', field: 'memberId' });
  }
  const payAmount = Number(amount);
  if (amount === null || amount === '' || !Number.isFinite(payAmount) || payAmount <= 0) {
    return res.status(400).json({ error: 'Enter an amount above zero.', field: 'amount' });
  }
  const paidBy = readPaymentMethod(method);
  if (paidBy.error) return res.status(400).json(paidBy);
  const paymentType = TYPE_MAP[type] || 'other';
  // A product/pass purchase (day pass, visitor bundle, shop item) is its own
  // transaction - it never pays down the member's membership dues. Only
  // membership and miscellaneous ("other") payments reduce the balance;
  // registration fees are collected separately too.
  const skipBalance = paymentType === 'registration' || paymentType === 'product';
  // pendingCharge is the price of what is being bought in this transaction that
  // is not on the account yet (a visitor bundle, a pass). A payment can never be
  // more than it, and whatever is left of it is added to what the member owes,
  // which is the balance this payment leaves them on.
  const pendingCharge = req.body.pendingCharge != null ? Math.max(0, Number(req.body.pendingCharge) || 0) : null;
  if (pendingCharge != null && payAmount > pendingCharge) {
    return res.status(400).json({ error: `Cannot collect more than the ${money(pendingCharge)} required.`, field: 'amount' });
  }
  const ref = reference ? String(reference).slice(0, 60) : generatePaymentRef();

  // The payment and the balance it leaves are written together, with the
  // member's row locked: two desks paying for one member at once take turns,
  // each reading what the other left. Read and written separately, four of
  // five payments taken at the same moment came off nobody's debt.
  const outcome = await prisma.$transaction(async (tx) => {
    const [member] = await tx.$queryRaw`SELECT "id", "balance", "firstName", "lastName" FROM "Member" WHERE "id" = ${memberId} AND "gymId" = ${req.user.gymId} FOR UPDATE`;
    if (!member) return { status: 404, body: { error: 'Member not found' } };
    const currentBalance = Number(member.balance) || 0;
    // A payment towards what the member owes can't be more than they owe.
    if (req.body.towardBalance && !skipBalance && payAmount > currentBalance) {
      return { status: 400, body: { error: `Cannot collect more than the ${money(currentBalance)} owed.`, field: 'amount' } };
    }
    const newBalance = skipBalance ? currentBalance : Math.max(0, currentBalance - payAmount);
    const payment = await tx.payment.create({
      data: {
        memberId: member.id,
        gymId: req.user.gymId,
        staffId: req.user.id,
        amount: payAmount,
        method: paidBy.method,
        type: paymentType,
        note: description || note || null,
        reference: ref,
        balanceAfter: pendingCharge != null ? currentBalance + (pendingCharge - payAmount) : newBalance,
      },
      include: { staff: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!skipBalance) await tx.member.update({ where: { id: member.id }, data: { balance: newBalance } });
    return { payment, member, newBalance };
  });
  if (outcome.status) return res.status(outcome.status).json(outcome.body);
  const { payment, member, newBalance } = outcome;

  const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'a member';
  logActivity(req, {
    category: 'money', action: 'payment.recorded',
    summary: `Recorded a payment of ${money(payAmount)} from ${memberName} (${method || 'Cash'})`,
    target: { type: 'member', id: memberId },
    details: { reference: ref, type: paymentType, ...(skipBalance ? {} : { balanceAfter: money(newBalance) }) },
  });
  bestEffort(prisma.notification.create({
    data: {
      gymId: req.user.gymId,
      title: 'Payment Received',
      body: `${money(payAmount)} received from ${memberName}.`,
      type: 'payment',
    },
  }), 'Payment notification');

  // Email the member their receipt - never block the response on it. Skipped
  // when notify:false (the caller sends it later, once the action is confirmed).
  if (notify) {
    prisma.member
      .findUnique({
        where: { id: memberId },
        select: { firstName: true, lastName: true, email: true, memberCode: true },
      })
      .then(m => m && sendPaymentReceipt(payment, m, req.user.gymId))
      .catch(err => console.error('Payment receipt email failed:', err.message));
  }

  res.status(201).json(payment);
}

// Send the receipt for a payment that was collected silently (notify:false),
// now that the action it was for has been confirmed.
async function sendReceipt(req, res) {
  const { id } = req.params;
  const payment = await prisma.payment.findFirst({ where: { id, gymId: req.user.gymId } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  try {
    const m = payment.memberId
      ? await prisma.member.findUnique({ where: { id: payment.memberId }, select: { firstName: true, lastName: true, email: true, memberCode: true } })
      : null;
    if (m) await sendPaymentReceipt(payment, m, req.user.gymId);
  } catch (err) {
    console.error('Payment receipt email failed:', err.message);
    return res.status(502).json({ error: 'Could not send the receipt.' });
  }
  res.json({ ok: true });
}

// Undo a payment - used when a prerequisite payment was collected inside an
// action modal (convert, day pass, renew…) and the action is then cancelled, so
// the gym isn't left holding income for something it didn't do. A membership
// (dues) payment paid down a real debt, so refunding it restores that debt;
// product / registration / other payments never reduced the balance here, so
// removing the row is enough.
const UNDO_WINDOW_MS = 15 * 60 * 1000;

async function remove(req, res) {
  const { id } = req.params;
  const payment = await prisma.payment.findFirst({ where: { id, gymId: req.user.gymId } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  // The desk may take back only a payment it took itself, within 15 minutes
  // (a slip at the till); anything else is a manager's to remove (D-21)
  if (!['general_manager', 'manager'].includes(req.user.role)) {
    if (payment.staffId !== req.user.id) return res.status(403).json({ error: 'Only a manager can remove a payment someone else took.' });
    if (Date.now() - new Date(payment.createdAt).getTime() > UNDO_WINDOW_MS) return res.status(403).json({ error: 'A payment older than 15 minutes can only be removed by a manager.' });
  }

  // The payment goes and its amount goes back on the debt in one step, added
  // in the database: two undone at once both count, and a payment removed by
  // someone else in the meantime is not put back twice.
  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.deleteMany({ where: { id: payment.id, gymId: req.user.gymId } });
      if (count && payment.type === 'membership' && payment.memberId) {
        await tx.member.update({ where: { id: payment.memberId }, data: { balance: { increment: payment.amount || 0 } } });
      }
    });
  } catch (e) {
    console.error('Payment removal failed:', e.message);
    return res.status(500).json({ error: 'Could not remove the payment.' });
  }

  logActivity(req, {
    category: 'money', action: 'payment.refunded',
    summary: `Refunded a payment of ${money(payment.amount)}`,
    target: { type: 'member', id: payment.memberId },
    details: { reference: payment.reference, type: payment.type },
  });
  res.json({ ok: true });
}

module.exports = { getAll, create, remove, sendReceipt };
