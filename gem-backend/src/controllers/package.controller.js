const prisma = require('../utils/prisma');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');

const PACKAGE_FIELDS = {
  name: 'Name', price: 'Price', minPayment: 'Minimum payment', duration: 'Duration', durationDays: 'Length in days',
  sessions: 'Sessions', maxPasses: 'Passes', access: 'Access', description: 'Description', isActive: 'Status',
};

function withStatus(pkg) {
  return { ...pkg, status: pkg.isActive !== false ? 'active' : 'inactive' };
}

const amount = (v) => { const n = Number(v); return v !== '' && v !== null && Number.isFinite(n) && n >= 0 ? n : null; };
const wholeCount = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 ? n : null; };
const flag = (v) => v === true || v === 'true';

// What a package create or update may set, checked: { data } or { error, field }.
// The request body used to go to the database whole, so an update could move a
// package into another gym, and a field it does not have answered 500.
function readPackage(body, creating) {
  const data = {};
  if (creating || body.name !== undefined) {
    data.name = String(body.name ?? '').trim();
    if (!data.name) return { error: 'Give the package a name.', field: 'name' };
  }
  for (const key of ['code', 'duration', 'access', 'description']) {
    if (body[key] !== undefined) data[key] = body[key] === null || String(body[key]).trim() === '' ? null : String(body[key]).trim();
  }
  if (body.sessions !== undefined) data.sessions = String(body.sessions ?? '').trim() || 'Unlimited';
  if (body.isVisitor !== undefined) data.isVisitor = flag(body.isVisitor);
  if (creating || body.price !== undefined) {
    data.price = amount(body.price);
    if (data.price === null) return { error: 'Enter the price as a number.', field: 'price' };
  }
  if (body.minPayment !== undefined) {
    data.minPayment = amount(body.minPayment);
    if (data.minPayment === null) return { error: 'Enter the minimum payment as a number.', field: 'minPayment' };
  }
  if (body.dayPassPrice !== undefined && body.dayPassPrice !== null && body.dayPassPrice !== '') {
    data.dayPassPrice = amount(body.dayPassPrice);
    if (data.dayPassPrice === null) return { error: 'Enter the day pass price as a number.', field: 'dayPassPrice' };
  } else if (body.dayPassPrice !== undefined) {
    data.dayPassPrice = null;
  }
  for (const key of ['durationDays', 'maxPasses']) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { data[key] = null; continue; }
    data[key] = wholeCount(body[key]);
    if (data[key] === null) return { error: 'Enter a whole number.', field: key };
  }
  if (body.isActive !== undefined) data.isActive = flag(body.isActive);
  else if (body.status !== undefined) data.isActive = body.status !== 'inactive';
  // A membership package says what one day costs, for a member whose
  // membership has lapsed; a visitor bundle is sold by the pass instead
  if (creating && !data.isVisitor && data.dayPassPrice == null) return { error: 'Enter the day pass price.', field: 'dayPassPrice' };
  return { data };
}

async function getAll(req, res) {
  const packages = await prisma.package.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { name: 'asc' },
  });
  res.json(packages.map(withStatus));
}

async function create(req, res) {
  const read = readPackage(req.body, true);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });
  const clash = await prisma.package.findFirst({ where: { gymId: req.user.gymId, name: { equals: read.data.name, mode: 'insensitive' } } });
  if (clash) return res.status(409).json({ error: 'A package with this name already exists', field: 'name' });
  const pkg = await prisma.package.create({
    data: { ...read.data, gymId: req.user.gymId },
  });
  logActivity(req, {
    category: 'settings', action: 'package.created',
    summary: `Created the package ${pkg.name} at ${money(pkg.price)}`, target: { type: 'package', id: pkg.id },
  });
  res.status(201).json(withStatus(pkg));
}

async function update(req, res) {
  const existing = await prisma.package.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Package not found' });

  const read = readPackage(req.body, false);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });
  if (read.data.name) {
    const clash = await prisma.package.findFirst({ where: { gymId: req.user.gymId, name: { equals: read.data.name, mode: 'insensitive' }, NOT: { id: existing.id } } });
    if (clash) return res.status(409).json({ error: 'A package with this name already exists', field: 'name' });
  }

  const pkg = await prisma.package.update({
    where: { id: existing.id },
    data: read.data,
  });
  const changes = changesBetween(existing, pkg, PACKAGE_FIELDS, {
    format: { price: (v) => money(v), minPayment: (v) => money(v), isActive: (v) => (v === false ? 'Inactive' : 'Active') },
  });
  if (changes.length) {
    logActivity(req, {
      category: 'settings', action: 'package.updated',
      summary: `Changed the package ${pkg.name}: ${describeChanges(changes)}`,
      target: { type: 'package', id: pkg.id }, details: { changes },
    });
  }
  res.json(withStatus(pkg));
}

async function remove(req, res) {
  const existing = await prisma.package.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Package not found' });

  await prisma.package.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'settings', action: 'package.deleted',
    summary: `Deleted the package ${existing.name}`, target: { type: 'package', id: existing.id },
  });
  res.json({ message: 'Package deleted' });
}

module.exports = { getAll, create, update, remove };
