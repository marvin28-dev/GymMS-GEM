const prisma = require('../utils/prisma');
const { toPaymentMethod } = require('../utils/paymentMethod');

const DAY_MS = 86400000;
const fullName = (p) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim();

// One day of the gym, gathered from its real records, for the end-of-day report
// every screen prints (Daily Overview, Dashboard, Front Desk).
//
// The day is the gym's local day. The browser says how far its clock is from
// UTC (tz, as getTimezoneOffset gives it), and the window is shifted by that,
// the same way the attendance stats do it. Expense dates are calendar days
// stored at midnight UTC, so those are matched on the plain day instead.
async function eod(req, res) {
  try {
    const gymId = req.user.gymId;
    const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : null;
    const nowLocal = new Date(Date.now() - tz * 60000);
    const [y, m, d] = day
      ? day.split('-').map(Number)
      : [nowLocal.getUTCFullYear(), nowLocal.getUTCMonth() + 1, nowLocal.getUTCDate()];
    const dayUtc = Date.UTC(y, m - 1, d);
    const from = new Date(dayUtc + tz * 60000);
    const to = new Date(from.getTime() + DAY_MS);
    const inDay = { gte: from, lt: to };

    const [visits, joined, payments, sales, expenses, issues, cards, owing] = await Promise.all([
      prisma.attendance.findMany({
        where: { gymId, checkIn: inDay },
        orderBy: { checkIn: 'asc' },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, memberCode: true, isVisitor: true } },
          workoutStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      prisma.member.findMany({
        where: { gymId, createdAt: inDay },
        orderBy: { createdAt: 'asc' },
        select: { id: true, firstName: true, lastName: true, memberCode: true, isVisitor: true, createdAt: true, dayPasses: true, package: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { gymId, createdAt: inDay },
        orderBy: { createdAt: 'asc' },
        include: { member: { select: { id: true, firstName: true, lastName: true, memberCode: true } } },
      }),
      prisma.sale.findMany({
        where: { gymId, createdAt: inDay },
        orderBy: { createdAt: 'asc' },
        include: { items: { include: { product: { select: { name: true, costPrice: true } } } } },
      }),
      prisma.expense.findMany({
        where: { gymId, date: { gte: new Date(dayUtc), lt: new Date(dayUtc + DAY_MS) } },
        orderBy: { createdAt: 'asc' },
      }),
      // Everything still open, plus whatever was raised or fixed that day
      prisma.equipmentIssue.findMany({
        where: { gymId, OR: [{ status: { not: 'resolved' } }, { reportedAt: inDay }, { resolvedAt: inDay }] },
        orderBy: { reportedAt: 'desc' },
      }),
      prisma.timeCard.findMany({
        where: { gymId, OR: [{ punchIn: inDay }, { date: inDay }] },
        orderBy: { punchIn: 'asc' },
        include: { staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.member.aggregate({ where: { gymId, balance: { gt: 0 } }, _sum: { balance: true }, _count: true }),
    ]);

    const paidToday = new Map();
    payments.forEach(p => paidToday.set(p.memberId, (paidToday.get(p.memberId) || 0) + p.amount));

    const checkins = visits.map(v => (v.workoutStaff
      ? { id: v.id, at: v.checkIn, name: fullName(v.workoutStaff), code: null, who: 'staff', kind: null }
      : { id: v.id, at: v.checkIn, name: fullName(v.member), code: v.member?.memberCode || null, who: v.member?.isVisitor ? 'visitor' : 'member', kind: v.kind || null }));

    const registrations = joined.map(mb => ({
      id: mb.id, at: mb.createdAt, name: fullName(mb), code: mb.memberCode,
      type: mb.isVisitor ? 'visitor' : 'member',
      package: mb.package?.name || null,
      dayPass: mb.isVisitor && (mb.dayPasses || 0) > 0,
      paid: paidToday.get(mb.id) || 0,
    }));

    const paymentRows = payments.map(p => ({
      id: p.id, at: p.createdAt, name: fullName(p.member), code: p.member?.memberCode || null,
      amount: p.amount, method: p.method, type: p.type, note: p.note || '', reference: p.reference || '',
    }));

    // A sale's profit is what it brought in less what its items cost: the cost
    // saved with the sale, or the product's cost now for sales made before that
    // was kept. A sale with an item of unknown cost is left out of the profit.
    const saleRows = sales.map(s => {
      let cost = 0, unknown = 0;
      for (const i of s.items) {
        const c = i.unitCost ?? i.product?.costPrice;
        if (c == null) unknown += i.quantity; else cost += c * i.quantity;
      }
      return {
        id: s.id, at: s.createdAt, total: s.total, method: s.method,
        profit: unknown ? null : Math.round(s.total - cost), unknownCostItems: unknown,
        items: s.items.map(i => ({ name: i.product?.name || '', qty: i.quantity, unitPrice: i.unitPrice })),
      };
    });

    const expenseRows = expenses.map(e => ({
      id: e.id, title: e.title, category: e.category, amount: Number(e.amount) || 0,
      paidTo: e.paidTo || '', method: e.method || null, source: e.source || 'operations',
      pending: e.approvalStatus === 'pending',
    }));

    const issueRows = issues.map(i => ({
      id: i.id, equipment: i.equipment, location: i.location || '', severity: i.severity, status: i.status,
      reportedAt: i.reportedAt, resolvedAt: i.resolvedAt,
      reportedToday: i.reportedAt >= from && i.reportedAt < to,
    }));

    // One line per person: their first clock-in and last clock-out of the day
    const staffMap = new Map();
    for (const c of cards) {
      if (!c.staff) continue;
      const cur = staffMap.get(c.staffId) || { id: c.staffId, name: fullName(c.staff), role: c.staff.role, in: null, out: null, open: false };
      if (c.punchIn && (!cur.in || c.punchIn < cur.in)) cur.in = c.punchIn;
      if (c.punchOut && (!cur.out || c.punchOut > cur.out)) cur.out = c.punchOut;
      if (c.punchIn && !c.punchOut) cur.open = true;
      staffMap.set(c.staffId, cur);
    }

    const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const byType = (t) => sum(paymentRows.filter(p => p.type === t), 'amount');
    const paymentsTotal = sum(paymentRows, 'amount');
    const salesTotal = sum(saleRows, 'total');
    const salesProfit = sum(saleRows.filter(r => r.profit != null), 'profit');
    const salesProfitMissing = saleRows.reduce((n, r) => n + (r.unknownCostItems || 0), 0);
    // The shop's sales that have a known cost, and what those items cost
    const salesCounted = sum(saleRows.filter(r => r.profit != null), 'total');
    const costOfSales = salesCounted - salesProfit;

    // Money at hand: everything that came in today (payments and the full shop
    // takings) less everything paid out, method by method. Desk expenses still
    // awaiting review are paid out too: that money has already left the drawer.
    // An expense with no method recorded was paid in cash.
    const METHOD_ORDER = ['cash', 'mobile_money', 'card', 'bank_transfer'];
    const flow = Object.fromEntries(METHOD_ORDER.map(k => [k, { in: 0, out: 0 }]));
    const add = (method, side, amount) => { const k = toPaymentMethod(method || 'cash'); (flow[k] || flow.cash)[side] += Number(amount) || 0; };
    paymentRows.forEach(r => add(r.method, 'in', r.amount));
    saleRows.forEach(r => add(r.method, 'in', r.total));
    expenseRows.forEach(r => add(r.method, 'out', r.amount));
    const byMethod = METHOD_ORDER.map(k => ({ method: k, in: flow[k].in, out: flow[k].out, atHand: flow[k].in - flow[k].out }));
    const moneyIn = byMethod.reduce((n, m) => n + m.in, 0);
    const moneyOut = byMethod.reduce((n, m) => n + m.out, 0);
    // Only expenses already in the books count; desk entries awaiting review are listed but not taken off
    const expensesTotal = sum(expenseRows.filter(e => !e.pending), 'amount');
    // The gym's revenue counts what members paid and what the shop earned over
    // the cost of its stock, not the full amount the shop took in
    const revenue = paymentsTotal + salesProfit;

    res.json({
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      checkins,
      registrations,
      payments: paymentRows,
      sales: saleRows,
      expenses: expenseRows,
      issues: issueRows,
      staff: [...staffMap.values()],
      totals: {
        checkins: checkins.filter(c => c.who !== 'staff').length,
        dayPassVisits: checkins.filter(c => c.kind === 'day_pass').length,
        registrations: registrations.length,
        itemsSold: saleRows.reduce((s, r) => s + r.items.reduce((a, i) => a + i.qty, 0), 0),
        membershipRevenue: byType('membership') + byType('other'),
        registrationRevenue: byType('registration'),
        passRevenue: byType('product'),
        paymentsTotal,
        salesTotal,
        salesProfit,
        salesProfitMissing,
        salesCounted,
        costOfSales,
        moneyIn,
        moneyOut,
        moneyAtHand: moneyIn - moneyOut,
        cashAtHand: flow.cash.in - flow.cash.out,
        byMethod,
        revenue,
        expensesTotal,
        expensesPending: sum(expenseRows.filter(e => e.pending), 'amount'),
        net: revenue - expensesTotal,
        outstanding: owing._sum.balance || 0,
        membersOwing: owing._count || 0,
        openIssues: issueRows.filter(i => i.status !== 'resolved').length,
      },
    });
  } catch (err) {
    console.error('EOD report failed:', err);
    res.status(500).json({ error: 'Could not build the end-of-day report.' });
  }
}

module.exports = { eod };
