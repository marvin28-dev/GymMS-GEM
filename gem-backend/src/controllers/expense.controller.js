const prisma = require('../utils/prisma');
const { bestEffort } = require('../utils/bestEffort');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');

const EXPENSE_FIELDS = { title: 'Title', category: 'Category', amount: 'Amount', date: 'Date', paidTo: 'Paid to', method: 'Method', note: 'Note' };

// The books read the same for everyone, wages included. Who may change an
// entry is a separate question, settled on the write routes.
//
// Desk expenses over the gym's front-desk limit sit in `pending` until a
// manager approves them, so the books (this list by default) show only what
// has been approved. `?pending=1` returns the waiting ones for the approval
// screen.
async function getAll(req, res) {
  const where = { gymId: req.user.gymId };
  if (req.query.source) where.source = String(req.query.source);
  // By default the books show only reviewed entries (pending excluded). A list
  // that wants the waiting ones too asks with ?status=all or ?pending=1.
  if (req.query.pending === '1') where.approvalStatus = 'pending';
  else if (req.query.status !== 'all') where.approvalStatus = { not: 'pending' };
  const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
  res.json(expenses);
}

const { toPaymentMethod } = require('../utils/paymentMethod');

// The fields of an expense, checked: { data } or { error, field }. A new one
// needs a title, an amount, a date and who was paid; an edit changes only what
// it sends. Amounts went through parseFloat, so "abc" was stored as NaN and
// "Infinity" as Infinity, and an edit without a category reset it to Other.
function readExpense(body, creating) {
  const data = {};
  const sent = (key) => body[key] !== undefined;
  if (creating || sent('title')) {
    data.title = String(body.title ?? '').trim();
    if (!data.title) return { error: 'Enter what the expense was for.', field: 'title' };
  }
  if (creating || sent('amount')) {
    const amount = Number(body.amount);
    if (body.amount === null || body.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      return { error: 'Enter an amount above zero.', field: 'amount' };
    }
    data.amount = amount;
  }
  if (creating || sent('date')) {
    const date = body.date ? new Date(body.date) : null;
    if (!date || Number.isNaN(date.getTime())) return { error: 'Choose the date.', field: 'date' };
    data.date = date;
  }
  // Who the money went to is required, so an entry in the books can always be
  // traced back to a person or vendor.
  if (creating || sent('paidTo')) {
    data.paidTo = String(body.paidTo ?? '').trim();
    if (!data.paidTo) return { error: 'Paid to is required', field: 'paidTo' };
  }
  if (creating || sent('category')) data.category = String(body.category ?? '').trim() || 'Other';
  if (sent('method')) data.method = body.method ? toPaymentMethod(body.method) : null;
  if (sent('notes') || sent('note')) data.note = String(body.notes ?? body.note ?? '').trim() || null;
  if (sent('recordedBy')) data.recordedBy = String(body.recordedBy ?? '').trim() || null;
  return { data };
}

// The signed-in account, for the "entered by" stamp. Taken from the record
// rather than from the request body, so it cannot be claimed to be somebody else.
async function actorName(req) {
  const me = await prisma.staff.findUnique({
    where: { id: req.user.id },
    select: { firstName: true, lastName: true },
  });
  return me ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : '';
}

async function create(req, res) {
  const read = readExpense(req.body, true);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });
  try {
    // Desk expenses are held: anything over the gym's front-desk limit can't be
    // created at all, and everything within the limit waits for a manager to
    // approve it before it reaches the books. An expense booked by management
    // directly (no `source`) goes straight in.
    const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { settings: true } });
    const rawLimit = Number(gym?.settings?.expenseLimit);
    const limit = rawLimit > 0 ? rawLimit : 50000;
    const fromDesk = req.body.source === 'frontdesk' || req.user.role === 'front_desk';
    if (fromDesk && read.data.amount > limit) {
      return res.status(400).json({ error: `This is over the front-desk limit of ${money(limit)} and can't be logged here. A manager must record it directly.`, field: 'amount' });
    }
    const needsApproval = fromDesk;
    const name = await actorName(req);

    const expense = await prisma.expense.create({
      data: {
        ...read.data,
        gymId: req.user.gymId,
        createdById: req.user.id,
        createdByName: name,
        source: fromDesk ? 'frontdesk' : 'operations',
        approvalStatus: needsApproval ? 'pending' : 'approved',
      },
    });

    if (needsApproval) {
      // Every manager is told there is a desk expense waiting on them.
      const managers = await prisma.staff.findMany({
        where: { gymId: req.user.gymId, isActive: true, role: { in: ['general_manager', 'manager'] } },
        select: { id: true },
      });
      await Promise.all(managers.map(m => bestEffort(prisma.notification.create({
        data: {
          gymId: req.user.gymId,
          staffId: m.id,
          title: 'Expense needs review',
          body: `${name || 'The front desk'} logged "${expense.title}" (${money(expense.amount)}) at the desk. Review it to add it to the books.`,
          type: 'system',
          link: '/accounting?tab=expenses',
        },
      }), 'Expense review notification')));
    }

    logActivity(req, {
      category: 'money', action: needsApproval ? 'expense.pending' : 'expense.created',
      summary: needsApproval
        ? `Submitted an expense for review: ${expense.title} (${money(expense.amount)})`
        : `Recorded an expense: ${expense.title} (${money(expense.amount)})`,
      target: { type: 'expense', id: expense.id },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error('Expense create error:', err);
    res.status(500).json({ error: 'Failed to save expense' });
  }
}

// A manager reviews a waiting desk expense into the books. Only pending entries
// move; an already-reviewed one is handed back unchanged. (The money is already
// spent - the manager is checking the entry, not granting permission.)
async function approve(req, res) {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  if (existing.approvalStatus !== 'pending') return res.json(existing);

  const name = await actorName(req);
  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: { approvalStatus: 'approved', approvedById: req.user.id, approvedByName: name, approvedAt: new Date() },
  });

  if (existing.createdById && String(existing.createdById) !== String(req.user.id)) {
    bestEffort(prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        staffId: existing.createdById,
        title: 'Expense reviewed',
        body: `Your expense "${expense.title}" (${money(expense.amount)}) was reviewed and added to the books.`,
        type: 'system',
        link: '/front-desk',
      },
    }), 'Expense reviewed notification');
  }

  logActivity(req, {
    category: 'money', action: 'expense.approved',
    summary: `Reviewed the expense ${expense.title} (${money(expense.amount)})`,
    target: { type: 'expense', id: expense.id },
  });
  res.json(expense);
}

async function update(req, res) {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  const read = readExpense(req.body, false);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });

  try {
    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        ...read.data,
        // An edited entry carries who changed it and when, so a figure that
        // moved after the fact can always be traced
        editedById: req.user.id,
        editedByName: await actorName(req),
        editedAt: new Date(),
      },
    });
    const changes = changesBetween(existing, expense, EXPENSE_FIELDS, { format: { amount: (v) => money(v) } });
    if (changes.length) {
      logActivity(req, {
        category: 'money', action: 'expense.updated',
        summary: `Edited the expense ${expense.title}: ${describeChanges(changes)}`,
        target: { type: 'expense', id: expense.id }, details: { changes },
      });
    }
    res.json(expense);
  } catch (err) {
    console.error('Expense update error:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
}

async function remove(req, res) {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  await prisma.expense.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'money', action: 'expense.deleted',
    summary: `Deleted the expense ${existing.title} (${money(existing.amount)})`,
    target: { type: 'expense', id: existing.id },
  });
  res.json({ message: 'Expense deleted' });
}

module.exports = { getAll, create, approve, update, remove };
