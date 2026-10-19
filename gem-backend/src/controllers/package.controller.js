const prisma = require('../utils/prisma');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');

const PACKAGE_FIELDS = {
  name: 'Name', price: 'Price', minPayment: 'Minimum payment', duration: 'Duration', durationDays: 'Length in days',
  sessions: 'Sessions', maxPasses: 'Passes', access: 'Access', description: 'Description', isActive: 'Status',
};

function withStatus(pkg) {
  return { ...pkg, status: pkg.isActive !== false ? 'active' : 'inactive' };
}

function prepareData(body) {
  const { status, ...rest } = body;
  const data = { ...rest };
  if (status !== undefined) data.isActive = status !== 'inactive';
  return data;
}

async function getAll(req, res) {
  const packages = await prisma.package.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { name: 'asc' },
  });
  res.json(packages.map(withStatus));
}

async function create(req, res) {
  const name = req.body.name?.trim();
  if (name) {
    const clash = await prisma.package.findFirst({ where: { gymId: req.user.gymId, name: { equals: name, mode: 'insensitive' } } });
    if (clash) return res.status(409).json({ error: 'A package with this name already exists' });
  }
  const pkg = await prisma.package.create({
    data: { ...prepareData(req.body), gymId: req.user.gymId },
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

  const name = req.body.name?.trim();
  if (name) {
    const clash = await prisma.package.findFirst({ where: { gymId: req.user.gymId, name: { equals: name, mode: 'insensitive' }, NOT: { id: req.params.id } } });
    if (clash) return res.status(409).json({ error: 'A package with this name already exists' });
  }

  const pkg = await prisma.package.update({
    where: { id: req.params.id },
    data: prepareData(req.body),
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
