const prisma = require('../utils/prisma');

const METHOD_MAP = {
  Cash: 'cash',
  Card: 'card',
  Transfer: 'bank_transfer',
  'Mobile Money': 'mobile_money',
};

async function getAll(req, res) {
  const sales = await prisma.sale.findMany({
    where: { gymId: req.user.gymId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(sales);
}

async function create(req, res) {
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

  const dbMethod = METHOD_MAP[method] || 'cash';
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
    if (product.stock < item.quantity) {
      return res.status(409).json({ error: `Insufficient stock for ${product.name} (available: ${product.stock})` });
    }
  }

  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + product.price * item.quantity;
  }, 0) * (1 - discountPct / 100);

  const sale = await prisma.$transaction(async (tx) => {
    const s = await tx.sale.create({
      data: {
        gymId: req.user.gymId,
        total,
        method: dbMethod,
        items: {
          create: items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return { productId: item.productId, quantity: item.quantity, unitPrice: product.price };
          }),
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, category: true } } },
        },
      },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return s;
  });

  res.status(201).json(sale);
}

module.exports = { getAll, create };
