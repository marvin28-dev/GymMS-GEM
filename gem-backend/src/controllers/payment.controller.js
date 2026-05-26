const prisma = require('../utils/prisma');

function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

const METHOD_MAP = {
  Cash: 'cash', cash: 'cash',
  Card: 'card', card: 'card',
  'Bank Transfer': 'bank_transfer', Transfer: 'bank_transfer', bank_transfer: 'bank_transfer',
  'Mobile Pay': 'mobile_money', mobile_money: 'mobile_money',
};

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

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: req.user.gymId },
    select: { id: true, balance: true },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const payAmount      = parseFloat(amount) || 0;
  const paymentType    = TYPE_MAP[type] || 'other';
  const isRegFee       = paymentType === 'registration';
  // Registration fees are collected separately — they don't reduce the membership balance
  const currentBalance = member.balance || 0;
  const newBalance     = isRegFee ? currentBalance : Math.max(0, currentBalance - payAmount);
  const ref            = reference || generateRef();

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        memberId,
        gymId:   req.user.gymId,
        staffId: req.user.id,
        amount:  payAmount,
        method:  METHOD_MAP[method] || 'cash',
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
      ref, newBalance, payment.id,
    );
    payment.reference    = ref;
    payment.balanceAfter = newBalance;
  } catch (rawErr) {
    console.error('Payment raw update failed:', rawErr.message);
  }

  // Only update member balance for non-registration payments
  if (!isRegFee) {
    try {
      await prisma.member.update({
        where: { id: memberId },
        data:  { balance: newBalance },
      });
    } catch (err) {
      console.error('Member balance update failed:', err.message);
    }
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

module.exports = { getAll, create };
