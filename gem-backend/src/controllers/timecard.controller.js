const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const { staffId, date } = req.query;
  const where = { gymId: req.user.gymId };
  if (staffId) where.staffId = staffId;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.date = { gte: start, lt: end };
  }
  const cards = await prisma.timeCard.findMany({
    where,
    include: { staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(cards);
}

async function punchIn(req, res) {
  const { staffId, date } = req.body;
  if (!staffId) return res.status(400).json({ error: 'staffId is required' });

  const targetDate = date ? new Date(date) : new Date();
  const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.timeCard.findFirst({
    where: { gymId: req.user.gymId, staffId, date: { gte: dayStart, lte: dayEnd } },
  });
  if (existing) return res.status(409).json({ error: 'Already punched in for this date', timecard: existing });

  const card = await prisma.timeCard.create({
    data: { gymId: req.user.gymId, staffId, date: dayStart, punchIn: new Date() },
    include: { staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(card);
}

async function punchOut(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });
  if (existing.punchOut) return res.status(409).json({ error: 'Already punched out' });

  const card = await prisma.timeCard.update({
    where: { id: req.params.id },
    data: { punchOut: new Date() },
    include: { staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json(card);
}

async function createManual(req, res) {
  const { staffId, date, punchIn: punchInTime, punchOut: punchOutTime } = req.body;
  if (!staffId || !date || !punchInTime) return res.status(400).json({ error: 'staffId, date, and punchIn are required' });

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const [ih, im] = punchInTime.split(':').map(Number);
  const punchInDt = new Date(dayStart);
  punchInDt.setHours(ih, im, 0, 0);

  let punchOutDt = null;
  if (punchOutTime) {
    const [oh, om] = punchOutTime.split(':').map(Number);
    punchOutDt = new Date(dayStart);
    punchOutDt.setHours(oh, om, 0, 0);
  }

  const card = await prisma.timeCard.create({
    data: { gymId: req.user.gymId, staffId, date: dayStart, punchIn: punchInDt, punchOut: punchOutDt },
    include: { staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(card);
}

async function remove(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });

  await prisma.timeCard.delete({ where: { id: req.params.id } });
  res.json({ message: 'Time card deleted' });
}

module.exports = { getAll, punchIn, punchOut, createManual, remove };
