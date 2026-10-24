const prisma = require('../utils/prisma');
const { logActivity, money } = require('../utils/activityLog');

const { readPaymentMethod } = require('../utils/paymentMethod');
const { DAY, readTz, startOfLocalDay } = require('../utils/localDay');

// Days are the gym's local days: tz is the browser's getTimezoneOffset.
// ?date=YYYY-MM-DD returns that whole day (the desk's sales panel pages back
// through days); ?from=&to= every day between, both included (the books);
// with neither, the latest 100.
function localDay(query) {
  const tz = readTz(query);
  if (DAY.test(String(query.date || ''))) {
    const from = startOfLocalDay(query.date, tz);
    return { gte: from, lt: new Date(from.getTime() + 86400000) };
  }
  if (DAY.test(String(query.from || '')) && DAY.test(String(query.to || ''))) {
    return { gte: startOfLocalDay(query.from, tz), lt: new Date(startOfLocalDay(query.to, tz).getTime() + 86400000) };
  }
  return null;
}

async function getAll(req, res) {
  const day = localDay(req.query);
  const sales = await prisma.sale.findMany({
    where: { gymId: req.user.gymId, ...(day ? { createdAt: day } : {}) },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, category: true, costPrice: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    ...(day ? {} : { take: 100 }),
  });
  res.json(sales);
}

async function create(req, res) {
 try {
  const { method = 'Cash', discount = 0 } = req.body;

  // Normalize to items array (supports both single-product and cart formats)
  let items = req.body.items;
  if (!items) {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Provide items array or productId + quantity' });
    }
    items = [{ productId, quantity }];
  }

  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  // Whole items only, at least one of each, one line per product
  items = items.map(i => ({ productId: i.productId, quantity: Math.round(Number(i.quantity)) }));
  if (items.some(i => !i.productId || !(i.quantity >= 1))) {
    return res.status(400).json({ error: 'Each item needs a product and a quantity of at least 1.' });
  }
  const merged = new Map();
  items.forEach(i => merged.set(i.productId, (merged.get(i.productId) || 0) + i.quantity));
  items = [...merged].map(([productId, quantity]) => ({ productId, quantity }));

  const paidBy = readPaymentMethod(method);
  if (paidBy.error) return res.status(400).json(paidBy);
  const dbMethod = paidBy.method;
  const discountPct = Math.max(0, Math.min(100, Number(discount) || 0));

  // Validate all products exist and have enough stock
  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, gymId: req.user.gymId },
  });

  if (products.length !== productIds.length) {
    return res.status(404).json({ error: 'One or more products not found' });
  }

  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (product.isActive === false) {
      return res.status(400).json({ error: `${product.name} is inactive and can't be sold.` });
    }
    if (product.stock < item.quantity) {
      return res.status(409).json({ error: `Insufficient stock for ${product.name} (available: ${product.stock})` });
    }
  }

  // A product on offer sells at its discounted price, rounded to whole units of the currency,
  // and that is the price the sale records for it
  const unitPriceOf = (p) => Math.round((p.price || 0) * (100 - (p.discountPercent || 0)) / 100);
  const total = Math.round(items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + unitPriceOf(product) * item.quantity;
  }, 0) * (1 - discountPct / 100));

  const sale = await prisma.$transaction(async (tx) => {
    const s = await tx.sale.create({
      data: {
        gymId: req.user.gymId,
        total,
        method: dbMethod,
        items: {
          create: items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return { productId: item.productId, quantity: item.quantity, unitPrice: unitPriceOf(product), unitCost: product.costPrice ?? null };
          }),
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, category: true } } },
        },
      },
    });

    // Take the stock only if it is still there: two desks selling the last item
    // at once must not drive it below zero. If any line fails, nothing is sold.
    for (const item of items) {
      const taken = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (taken.count === 0) {
        const p = products.find(x => x.id === item.productId);
        const err = new Error(`Not enough ${p.name} left in stock.`);
        err.status = 409;
        throw err;
      }
    }

    return s;
  });

  const lines = items.map(item => `${item.quantity} x ${products.find(p => p.id === item.productId).name}`);
  logActivity(req, {
    category: 'money', action: 'sale.recorded',
    summary: `Recorded a sale of ${money(total)}: ${lines.join(', ')}`,
    target: { type: 'sale', id: sale.id },
    details: { method, ...(discountPct ? { discount: `${discountPct}%` } : {}) },
  });
  const fresh = await prisma.product.findMany({ where: { id: { in: items.map(i => i.productId) } }, select: { id: true, stock: true } });
  res.status(201).json({ ...sale, stock: fresh });
 } catch (err) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('Sale failed:', err);
  return res.status(500).json({ error: 'The sale could not be saved. Nothing was charged.' });
 }
}

module.exports = { getAll, create };
