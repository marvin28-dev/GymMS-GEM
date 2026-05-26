const prisma = require('../utils/prisma');

function withStatus(product) {
  return { ...product, status: product.isActive !== false ? 'active' : 'inactive' };
}

function extractKnownFields(body) {
  const { name, category, price, stock, description, photo, isActive, status } = body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (price !== undefined) data.price = Number(price);
  if (stock !== undefined) data.stock = Number(stock);
  if (description !== undefined) data.description = description || null;
  if (photo !== undefined) data.photo = photo || null;
  if (isActive !== undefined) data.isActive = isActive;
  else if (status !== undefined) data.isActive = status !== 'inactive';
  return data;
}

async function getAll(req, res) {
  const products = await prisma.product.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { name: 'asc' },
  });
  res.json(products.map(withStatus));
}

async function create(req, res) {
  const product = await prisma.product.create({
    data: { ...extractKnownFields(req.body), gymId: req.user.gymId },
  });
  res.status(201).json(withStatus(product));
}

async function update(req, res) {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: extractKnownFields(req.body),
  });
  res.json(withStatus(product));
}

async function remove(req, res) {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ message: 'Product deleted' });
}

module.exports = { getAll, create, update, remove };
