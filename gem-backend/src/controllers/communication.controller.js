const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const communications = await prisma.communication.findMany({
    where: { gymId: req.user.gymId },
    include: { sentBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(communications);
}

async function create(req, res) {
  const { subject, body, message, targetGroup, recipients, type, status } = req.body;
  const bodyText = body || message;
  if (!subject || !bodyText) return res.status(400).json({ error: 'subject and body/message are required' });

  const communication = await prisma.communication.create({
    data: {
      gymId: req.user.gymId,
      subject,
      body: bodyText,
      sentById: req.user.id,
      targetGroup: recipients || targetGroup || undefined,
    },
    include: { sentBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(communication);
}

async function remove(req, res) {
  const existing = await prisma.communication.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Communication not found' });

  await prisma.communication.delete({ where: { id: req.params.id } });
  res.json({ message: 'Communication deleted' });
}

module.exports = { getAll, create, remove };
