const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const issues = await prisma.equipmentIssue.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { reportedAt: 'desc' },
  });
  res.json(issues);
}

async function create(req, res) {
  const issue = await prisma.equipmentIssue.create({
    data: { ...req.body, gymId: req.user.gymId },
  });
  res.status(201).json(issue);
}

async function update(req, res) {
  const existing = await prisma.equipmentIssue.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Issue not found' });

  const issue = await prisma.equipmentIssue.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(issue);
}

module.exports = { getAll, create, update };
