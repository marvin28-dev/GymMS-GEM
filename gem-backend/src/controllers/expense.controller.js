const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const expenses = await prisma.expense.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { date: 'desc' },
  });
  res.json(expenses);
}

const METHOD_MAP = { cash: 'cash', card: 'card', bank_transfer: 'bank_transfer', mobile_money: 'mobile_money', Cash: 'cash', Card: 'card', 'Bank Transfer': 'bank_transfer', 'Mobile Money': 'mobile_money' };

function buildExpenseData(body) {
  const { title, category, amount, date, paidTo, method, notes, note, recordedBy } = body;
  return {
    title,
    category: category || 'Other',
    amount: parseFloat(amount),
    date: new Date(date),
    paidTo: paidTo || undefined,
    method: METHOD_MAP[method] || undefined,
    note: notes || note || undefined,
    recordedBy: recordedBy || undefined,
  };
}

async function create(req, res) {
  try {
    const expense = await prisma.expense.create({
      data: { ...buildExpenseData(req.body), gymId: req.user.gymId },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error('Expense create error:', err);
    res.status(500).json({ error: 'Failed to save expense' });
  }
}

async function update(req, res) {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: buildExpenseData(req.body),
    });
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
  res.json({ message: 'Expense deleted' });
}

module.exports = { getAll, create, update, remove };
