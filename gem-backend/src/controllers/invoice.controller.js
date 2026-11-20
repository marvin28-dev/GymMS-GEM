// GEM's monthly bills to gyms, for the admin dashboard: prepared as drafts
// (by the monthly job or by hand), checked and sent, then paid or voided.
// Sending, reminding and payment each tell the gym's owners in the app and by email.
const prisma = require('../utils/prisma');
const { platformSettings, periodBounds, previousPeriod, amountOf, invoiceState, daysOverdue, dueDateFrom, prepareInvoices } = require('../utils/billing');
const { sendBill, monthName } = require('../utils/gemEmail');
const { formatMoney } = require('../utils/money');
const { bestEffort } = require('../utils/bestEffort');
const { tellOwners, reopenGym } = require('../utils/gymAccount');
const { readPaymentMethod } = require('../utils/paymentMethod');

const GYM = { gym: { select: { id: true, code: true, name: true, lockedAt: true } } };
const shown = (inv, now = new Date()) => ({ ...inv, state: invoiceState(inv, now), daysOverdue: daysOverdue(inv, now) });

async function findInvoice(id) {
  return prisma.gymInvoice.findUnique({ where: { id: String(id) }, include: GYM });
}

// The worst first: what is overdue, then what still needs checking and sending
const ORDER = { overdue: 0, draft: 1, sent: 2, paid: 3, void: 4 };
const STATES = ['all', ...Object.keys(ORDER)];

// ── GET /api/admin/invoices?period=2026-11&state=&q=&limit= ──────────────────
// The month's totals and counts cover every bill; the list itself is searched
// and cut to a screenful (200 at most) here, however many gyms there are
async function list(req, res) {
  const period = req.query.period ? String(req.query.period) : previousPeriod();
  if (!periodBounds(period)) return res.status(400).json({ error: 'Choose a month.' });
  const now = new Date();
  const invoices = (await prisma.gymInvoice.findMany({ where: { period }, include: GYM }))
    .map(i => shown(i, now))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.amount - a.amount);
  const sum = (f) => invoices.filter(f).reduce((s, i) => s + (i.state === 'paid' ? (i.paidAmount ?? i.amount) : i.amount), 0);
  const state = STATES.includes(req.query.state) ? req.query.state : 'all';
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const matching = invoices.filter(i => state === 'all' || i.state === state)
    .filter(i => !q || [i.gym?.name, i.gym?.code].some(v => String(v || '').toLowerCase().includes(q)));
  res.json({
    period,
    canPrepare: periodBounds(period).end <= now,
    invoices: matching.slice(0, limit),
    total: matching.length,
    counts: Object.fromEntries(STATES.map(s => [s, s === 'all' ? invoices.length : invoices.filter(i => i.state === s).length])),
    totals: {
      billed: sum(i => ['sent', 'overdue', 'paid'].includes(i.state)),
      paid: sum(i => i.state === 'paid'),
      outstanding: sum(i => ['sent', 'overdue'].includes(i.state)),
      overdue: sum(i => i.state === 'overdue'),
      drafts: invoices.filter(i => i.state === 'draft').length,
    },
  });
}

// ── POST /api/admin/invoices/prepare { period } ──────────────────────────────
async function prepare(req, res) {
  const result = await prepareInvoices(String(req.body?.period || ''));
  if (result.error) return res.status(400).json({ error: result.error, field: 'period' });
  res.status(201).json({ created: result.created.length });
}

// ── PATCH /api/admin/invoices/:id { members?, rate?, discount?, note? } ──────
// Only a draft's figures change: a bill the gym has seen stays as it was sent
async function update(req, res) {
  const inv = await findInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Bill not found' });
  if (inv.status !== 'draft') return res.status(409).json({ error: 'Only a draft can be changed. Void it and prepare it again instead.' });
  const b = req.body || {};
  const whole = (key, label, max) => {
    if (!(key in b)) return inv[key];
    const n = Number(b[key]);
    if (b[key] === '' || !Number.isInteger(n) || n < 0 || n > max) throw Object.assign(new Error(label), { field: key });
    return n;
  };
  let members, rate, discount;
  try {
    members = whole('members', 'Enter the number of members, 0 or more.', 1000000);
    rate = whole('rate', 'Enter a whole price per member, 0 or more.', 1000000);
    discount = whole('discount', 'Enter a whole discount, 0 or more.', 100000000);
  } catch (err) {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  const note = 'note' in b ? (String(b.note ?? '').trim() || null) : inv.note;
  if (note && note.length > 500) return res.status(400).json({ error: 'Keep the note under 500 characters.', field: 'note' });
  const amount = amountOf({ members, rate, billableDays: inv.billableDays, daysInPeriod: inv.daysInPeriod, discount });
  const saved = await prisma.gymInvoice.update({ where: { id: inv.id }, data: { members, rate, discount, note, amount }, include: GYM });
  res.json(shown(saved));
}

// A draft goes to the gym: due in the platform's days, owners told
async function sendOne(inv, settings, now) {
  const { count } = await prisma.gymInvoice.updateMany({
    where: { id: inv.id, status: 'draft' },
    data: { status: 'sent', sentAt: now, dueDate: dueDateFrom(now, settings.dueDays) },
  });
  if (!count) return null;
  const sent = await findInvoice(inv.id);
  const amount = formatMoney(sent.amount, sent.currency);
  await tellOwners(sent.gymId, `Your GEM bill for ${monthName(sent.period)}: ${amount}`, `Due by ${sent.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`, '/settings?section=billing')
    .catch(err => console.error('Bill notice failed:', err.message));
  bestEffort(sendBill(sent.gym, sent, settings, 'sent'), 'Bill email');
  return sent;
}

// ── POST /api/admin/invoices/:id/send ────────────────────────────────────────
async function send(req, res) {
  const inv = await findInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Bill not found' });
  if (inv.status !== 'draft') return res.status(409).json({ error: 'This bill has already been sent.' });
  if (!inv.amount) return res.status(400).json({ error: 'There is nothing to charge on this bill. Void it instead.' });
  const sent = await sendOne(inv, await platformSettings(), new Date());
  if (!sent) return res.status(409).json({ error: 'This bill has already been sent.' });
  res.json(shown(sent));
}

// ── POST /api/admin/invoices/send-all { period } ─────────────────────────────
async function sendAll(req, res) {
  const period = String(req.body?.period || '');
  if (!periodBounds(period)) return res.status(400).json({ error: 'Choose a month.', field: 'period' });
  const settings = await platformSettings();
  const now = new Date();
  const drafts = await prisma.gymInvoice.findMany({ where: { period, status: 'draft', amount: { gt: 0 } }, include: GYM });
  let sent = 0;
  for (const inv of drafts) if (await sendOne(inv, settings, now)) sent += 1;
  res.json({ sent });
}

// ── POST /api/admin/invoices/:id/paid { method, reference?, paidOn?, amount?, reopen? }
async function markPaid(req, res) {
  const inv = await findInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Bill not found' });
  if (inv.status !== 'sent') return res.status(409).json({ error: inv.status === 'paid' ? 'This bill is already paid.' : 'Only a sent bill can be paid.' });
  const b = req.body || {};
  if (!String(b.method ?? '').trim()) return res.status(400).json({ error: 'Choose how it was paid.', field: 'method' });
  const read = readPaymentMethod(b.method);
  if (read.error) return res.status(400).json({ error: read.error, field: 'method' });
  const { method } = read;
  const paidAmount = b.amount === undefined || b.amount === '' ? inv.amount : Number(b.amount);
  if (!Number.isInteger(paidAmount) || paidAmount < 0) return res.status(400).json({ error: 'Enter the whole amount paid.', field: 'amount' });
  let paidAt = new Date();
  if (b.paidOn) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.paidOn));
    paidAt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(NaN);
    if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) return res.status(400).json({ error: 'Choose the day it was paid (not a day still to come).', field: 'paidOn' });
  }
  const reference = String(b.reference ?? '').trim().slice(0, 120) || null;
  const { count } = await prisma.gymInvoice.updateMany({ where: { id: inv.id, status: 'sent' }, data: { status: 'paid', paidAt, paidAmount, paidMethod: method, paidReference: reference } });
  if (!count) return res.status(409).json({ error: 'This bill is already paid.' });
  const paid = await findInvoice(inv.id);
  const settings = await platformSettings();
  await tellOwners(paid.gymId, `GEM received ${formatMoney(paidAmount, paid.currency)}`, `Thank you: your bill for ${monthName(paid.period)} is paid.`, '/settings?section=billing')
    .catch(err => console.error('Payment notice failed:', err.message));
  bestEffort(sendBill(paid.gym, paid, settings, 'paid'), 'Payment received email');
  // A gym paused for its bills is reopened once nothing is left overdue
  let reopened = false;
  if (paid.gym.lockedAt && b.reopen !== false) {
    const stillLate = await prisma.gymInvoice.count({ where: { gymId: paid.gymId, status: 'sent', dueDate: { lt: new Date() } } });
    if (!stillLate) { await reopenGym(paid.gym); reopened = true; }
  }
  res.json({ ...shown(paid), reopened });
}

// ── POST /api/admin/invoices/:id/remind ──────────────────────────────────────
async function remind(req, res) {
  const inv = await findInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Bill not found' });
  if (inv.status !== 'sent') return res.status(409).json({ error: 'Only a sent, unpaid bill can be reminded.' });
  const settings = await platformSettings();
  const late = invoiceState(inv) === 'overdue';
  await tellOwners(inv.gymId, late ? `Your GEM bill for ${monthName(inv.period)} is overdue` : `Your GEM bill for ${monthName(inv.period)} is due`, `${formatMoney(inv.amount, inv.currency)} to pay. See Settings, GEM billing.`, '/settings?section=billing')
    .catch(err => console.error('Reminder notice failed:', err.message));
  bestEffort(sendBill(inv.gym, inv, settings, 'reminder'), 'Bill reminder email');
  const saved = await prisma.gymInvoice.update({ where: { id: inv.id }, data: { remindedAt: new Date() }, include: GYM });
  res.json(shown(saved));
}

// ── POST /api/admin/invoices/:id/void { reason? } ────────────────────────────
async function voidOne(req, res) {
  const inv = await findInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Bill not found' });
  if (!['draft', 'sent'].includes(inv.status)) return res.status(409).json({ error: 'A paid or voided bill stays as it is.' });
  const reason = String(req.body?.reason ?? '').trim().slice(0, 300);
  const note = [inv.note, reason && `Voided: ${reason}`].filter(Boolean).join(' · ') || null;
  const saved = await prisma.gymInvoice.update({ where: { id: inv.id }, data: { status: 'void', note }, include: GYM });
  res.json(shown(saved));
}

module.exports = { list, prepare, update, send, sendAll, markPaid, remind, voidOne };
