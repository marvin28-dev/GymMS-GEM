const prisma = require('../utils/prisma');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');

const PRODUCT_FIELDS = { name: 'Name', code: 'Code', category: 'Category', price: 'Price', costPrice: 'Cost price', stock: 'Stock', reorderLevel: 'Reorder level', discountPercent: 'Discount (%)', isActive: 'Status' };

function withStatus(product) {
  return { ...product, status: product.isActive !== false ? 'active' : 'inactive' };
}

const cleanCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '-');
const wholeNumber = (v) => Math.round(Number(v));

function extractKnownFields(body) {
  const { name, code, category, price, costPrice, stock, reorderLevel, discountPercent, description, photo, isActive, status } = body;
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (code !== undefined) data.code = cleanCode(code) || null;
  if (category !== undefined) data.category = category;
  if (price !== undefined) data.price = wholeNumber(price);
  if (costPrice !== undefined) data.costPrice = costPrice === '' || costPrice === null ? null : wholeNumber(costPrice);
  if (stock !== undefined) data.stock = Math.max(0, wholeNumber(stock) || 0);
  if (reorderLevel !== undefined) data.reorderLevel = reorderLevel === '' || reorderLevel === null ? null : Math.max(0, wholeNumber(reorderLevel) || 0);
  if (discountPercent !== undefined) data.discountPercent = discountPercent === '' || discountPercent === null ? null : (wholeNumber(discountPercent) || null);
  if (description !== undefined) data.description = description || null;
  if (photo !== undefined) data.photo = photo || null;
  if (isActive !== undefined) data.isActive = isActive;
  else if (status !== undefined) data.isActive = status !== 'inactive';
  return data;
}

// What a product must have, checked on create and on every edit that touches it
function invalid(data, creating) {
  if (creating || 'name' in data) { if (!data.name) return 'Enter the product name.'; }
  if (creating || 'code' in data) { if (!data.code) return 'Enter a product code.'; }
  if (data.discountPercent != null && (data.discountPercent < 1 || data.discountPercent > 99)) return 'A discount must be between 1% and 99%.';
  if (creating || 'price' in data) { if (!(data.price > 0)) return 'Enter a selling price above zero.'; }
  // What the gym paid for one, so the profit on each sale can be worked out
  if (creating && (data.costPrice == null || Number.isNaN(data.costPrice))) return 'Enter the cost price (what the gym pays for one).';
  if ('costPrice' in data && data.costPrice != null && data.costPrice < 0) return 'The cost price cannot be negative.';
  return null;
}

async function codeTaken(gymId, code, exceptId) {
  if (!code) return false;
  const hit = await prisma.product.findFirst({ where: { gymId, code, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  return !!hit;
}

async function getAll(req, res) {
  const products = await prisma.product.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { name: 'asc' },
  });
  res.json(products.map(withStatus));
}

async function create(req, res) {
  const data = extractKnownFields(req.body);
  const problem = invalid(data, true);
  if (problem) return res.status(400).json({ error: problem });
  if (await codeTaken(req.user.gymId, data.code)) {
    return res.status(409).json({ error: `The code ${data.code} is already used by another product.` });
  }
  const product = await prisma.product.create({
    data: { ...data, gymId: req.user.gymId },
  });
  logActivity(req, {
    category: 'settings', action: 'product.created',
    summary: `Added the product ${product.name} (${product.code}) at ${money(product.price)}`, target: { type: 'product', id: product.id },
  });
  res.status(201).json(withStatus(product));
}

async function update(req, res) {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  // Stock only moves through a sale or a restock, so a stale screen can't overwrite it
  const { stock: _stock, ...data } = extractKnownFields(req.body);
  const problem = invalid(data, false);
  if (problem) return res.status(400).json({ error: problem });
  if (data.code && await codeTaken(req.user.gymId, data.code, existing.id)) {
    return res.status(409).json({ error: `The code ${data.code} is already used by another product.` });
  }

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data,
  });
  const changes = changesBetween(existing, product, PRODUCT_FIELDS, {
    format: { price: (v) => money(v), costPrice: (v) => (v == null ? 'none' : money(v)), isActive: (v) => (v === false ? 'Inactive' : 'Active') },
  });
  if (changes.length) {
    logActivity(req, {
      category: 'settings', action: 'product.updated',
      summary: `Changed the product ${product.name}: ${describeChanges(changes)}`,
      target: { type: 'product', id: product.id }, details: { changes },
    });
  }
  res.json(withStatus(product));
}

// Adds stock in one step on the server, so two people restocking at once both count
async function restock(req, res) {
  const quantity = wholeNumber(req.body.quantity);
  if (!(quantity > 0)) return res.status(400).json({ error: 'Enter how many items to add.' });
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const product = await prisma.product.update({ where: { id: existing.id }, data: { stock: { increment: quantity } } });
  logActivity(req, {
    category: 'settings', action: 'product.restocked',
    summary: `Restocked ${product.name}: +${quantity} (now ${product.stock})`, target: { type: 'product', id: product.id },
  });
  res.json(withStatus(product));
}

async function remove(req, res) {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  // A product that has been sold stays in the sales history, so it is retired, not erased
  const sold = await prisma.saleItem.count({ where: { productId: existing.id } });
  if (sold > 0) {
    await prisma.product.update({ where: { id: existing.id }, data: { isActive: false } });
    logActivity(req, {
      category: 'settings', action: 'product.deactivated',
      summary: `Retired the product ${existing.name} (it has sales, so it was kept as inactive)`, target: { type: 'product', id: existing.id },
    });
    return res.json({ message: 'Product has sales history, so it was made inactive instead of deleted', deactivated: true });
  }

  await prisma.product.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'settings', action: 'product.deleted',
    summary: `Deleted the product ${existing.name}`, target: { type: 'product', id: existing.id },
  });
  res.json({ message: 'Product deleted' });
}

module.exports = { getAll, create, update, restock, remove };
