const prisma = require('../utils/prisma');
const { sendPaymentReceipt } = require('../utils/memberEmail');
const { logActivity, money } = require('../utils/activityLog');

function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

const { toPaymentMethod } = require('../utils/paymentMethod');

const TYPE_MAP = {
  Membership: 'membership', membership: 'membership',
  'Registration Fee': 'registration', registration: 'registration',
  'Day Pass': 'other',
  Package: 'membership',
  Product: 'product', product: 'product',
  Other: 'other', other: 'other',
};

async function getAll(req, res) {
  const payments = await prisma.payment.findMany({
    where: { gymId: req.user.gymId },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, avatarColor: true, photo: true } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
    },
    orderBy: { createdAt: 'desc' },
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
  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: req.user.gymId },
    select: { id: true, balance: true, firstName: true, lastName: true },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const payAmount      = parseFloat(amount) || 0;
  const paymentType    = TYPE_MAP[type] || 'other';
  const isRegFee       = paymentType === 'registration';
  // A product/pass purchase (day pass, visitor bundle, shop item) is its own
  // transaction - it never pays down the member's membership dues. Only
  // membership and miscellaneous ("other") payments reduce the balance;
  // registration fees are collected separately too.
  const skipBalance    = isRegFee || paymentType === 'product';
  const currentBalance = member.balance || 0;
  const newBalance     = skipBalance ? currentBalance : Math.max(0, currentBalance - payAmount);
  const ref            = reference || generateRef();

  if (!(payAmount > 0)) return res.status(400).json({ error: 'Enter an amount above zero.' });
  // pendingCharge is the price of what is being bought in this transaction that
  // is not on the account yet (a visitor bundle, a pass). A payment can never be
  // more than it, and whatever is left of it is added to what the member owes,
  // which is the balance this payment leaves them on.
  const pendingCharge = req.body.pendingCharge != null ? Math.max(0, Number(req.body.pendingCharge) || 0) : null;
  if (pendingCharge != null && payAmount > pendingCharge) {
    return res.status(400).json({ error: `Cannot collect more than the ${money(pendingCharge)} required.` });
  }
  // A payment towards what the member owes can't be more than they owe.
  if (req.body.towardBalance && !skipBalance && payAmount > currentBalance) {
    return res.status(400).json({ error: `Cannot collect more than the ${money(currentBalance)} owed.` });
  }
  const balanceAfter = pendingCharge != null ? currentBalance + (pendingCharge - payAmount) : newBalance;

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        memberId,
        gymId:   req.user.gymId,
        staffId: req.user.id,
        amount:  payAmount,
        method:  toPaymentMethod(method),
        type:    paymentType,
        note:    description || note || null,
      },
    });
  } catch (err) {
    console.error('Payment create failed:', err.message);
    return res.status(500).json({ error: 'Failed to create payment' });
  }

  // Save reference + balanceAfter via raw SQL (bypasses stale Prisma client)
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Payment" SET "reference" = $1, "balanceAfter" = $2 WHERE "id" = $3`,
      ref, balanceAfter, payment.id,
    );
    payment.reference    = ref;
    payment.balanceAfter = balanceAfter;
  } catch (rawErr) {
    console.error('Payment raw update failed:', rawErr.message);
  }

  // Only update member balance for payments that pay down dues
  if (!skipBalance) {
    try {
      await prisma.member.update({
        where: { id: memberId },
        data:  { balance: newBalance },
      });
    } catch (err) {
      console.error('Member balance update failed:', err.message);
    }
  }

  const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'a member';
  logActivity(req, {
    category: 'money', action: 'payment.recorded',
    summary: `Recorded a payment of ${money(payAmount)} from ${memberName} (${method || 'Cash'})`,
    target: { type: 'member', id: memberId },
    details: { reference: ref, type: paymentType, ...(skipBalance ? {} : { balanceAfter: money(newBalance) }) },
  });
  prisma.notification.create({
    data: {
      gymId: req.user.gymId,
      title: 'Payment Received',
      body: `${money(payAmount)} received from ${memberName}.`,
      type: 'payment',
    },
  }).catch(() => {});

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

  // Re-fetch with staff included so the client gets recordedBy immediately
  try {
    const full = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { staff: { select: { id: true, firstName: true, lastName: true } } },
    });
    return res.status(201).json(full);
  } catch {
    return res.status(201).json(payment);
  }
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
async function remove(req, res) {
  const { id } = req.params;
  const payment = await prisma.payment.findFirst({ where: { id, gymId: req.user.gymId } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (payment.type === 'membership' && payment.memberId) {
    try {
      const m = await prisma.member.findUnique({ where: { id: payment.memberId }, select: { balance: true } });
      if (m) await prisma.member.update({ where: { id: payment.memberId }, data: { balance: (m.balance || 0) + (payment.amount || 0) } });
    } catch (e) { console.error('Balance restore on refund failed:', e.message); }
  }

  try {
    await prisma.payment.delete({ where: { id } });
  } catch (e) {
    console.error('Payment delete failed:', e.message);
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
