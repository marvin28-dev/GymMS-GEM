const crypto = require('crypto');
const prisma = require('../utils/prisma');
const createId = () => crypto.randomBytes(12).toString('hex');

async function getAll(req, res) {
  const { date, month, year } = req.query;
  const where = { gymId: req.user.gymId };

  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  } else if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    where.date = { gte: start, lt: end };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: 'asc' },
  });
  res.json(events);
}

async function create(req, res) {
  const { title, date, time, duration, instructorId, staffIds, location, spots, color, description, repeat, repeatUntil } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date are required' });

  const ids = Array.isArray(staffIds) ? staffIds : (staffIds ? JSON.parse(staffIds) : []);
  const primaryId = instructorId || ids[0] || null;
  const isRecurring = repeat && repeat !== 'None' && repeatUntil;
  const seriesId = isRecurring ? createId() : null;

  const baseData = {
    gymId: req.user.gymId,
    title,
    time,
    duration,
    instructorId: primaryId,
    staffIds: JSON.stringify(ids),
    location,
    spots,
    color,
    description:  description  || null,
    repeat:       repeat        || null,
    repeatUntil:  isRecurring   ? repeatUntil : null,
    seriesId,
  };

  const dates = [new Date(date)];
  if (isRecurring) {
    const until = new Date(repeatUntil);
    let current = new Date(date);
    while (true) {
      if (repeat === 'Daily')        current.setDate(current.getDate() + 1);
      else if (repeat === 'Weekly')  current.setDate(current.getDate() + 7);
      else if (repeat === 'Monthly') current.setMonth(current.getMonth() + 1);
      else break;
      if (current > until) break;
      dates.push(new Date(current));
    }
  }

  const events = await Promise.all(dates.map(d =>
    prisma.calendarEvent.create({
      data: { ...baseData, date: d },
      include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
    })
  ));

  res.status(201).json(events.length === 1 ? events[0] : events);
}

async function update(req, res) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  const { gymId: _g, id: _id, staffIds, instructorId, ...safeData } = req.body;
  if (safeData.date) safeData.date = new Date(safeData.date);

  const ids = Array.isArray(staffIds) ? staffIds : (staffIds ? JSON.parse(staffIds) : []);
  const primaryId = instructorId !== undefined ? (instructorId || ids[0] || null) : (ids[0] || null);
  safeData.staffIds = JSON.stringify(ids);
  safeData.instructorId = primaryId;

  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id },
    data: safeData,
    include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json(event);
}

async function remove(req, res) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  // ?series=true → delete all events in the same series
  if (req.query.series === 'true' && existing.seriesId) {
    await prisma.calendarEvent.deleteMany({
      where: { seriesId: existing.seriesId, gymId: req.user.gymId },
    });
    return res.json({ message: 'Series deleted', seriesId: existing.seriesId });
  }

  await prisma.calendarEvent.delete({ where: { id: req.params.id } });
  res.json({ message: 'Event deleted' });
}

module.exports = { getAll, create, update, remove };
