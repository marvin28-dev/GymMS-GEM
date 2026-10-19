const prisma = require('../utils/prisma');
const { CATEGORIES, RETENTION_DAYS } = require('../utils/activityLog');

const PAGE_MAX = 100;
const dayStart = (ymd) => new Date(`${ymd}T00:00:00`);
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// The owner's view of the log, newest first. There is deliberately no way to
// edit or delete an entry: they only leave when they reach 30 days old.
async function list(req, res) {
  const { category, q, from, to, cursor } = req.query;
  const take = Math.min(PAGE_MAX, Math.max(1, Number(req.query.limit) || 50));

  const where = { gymId: req.user.gymId };
  if (category && CATEGORIES.includes(category)) where.category = category;
  if (isYmd(from) || isYmd(to)) {
    where.createdAt = {};
    if (isYmd(from)) where.createdAt.gte = dayStart(from);
    if (isYmd(to)) where.createdAt.lt = new Date(dayStart(to).getTime() + 24 * 60 * 60 * 1000);
  }
  const text = String(q || '').trim();
  if (text) {
    where.OR = [
      { summary: { contains: text, mode: 'insensitive' } },
      { actorName: { contains: text, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    select: {
      id: true, category: true, action: true, summary: true,
      actorId: true, actorName: true, actorRole: true,
      targetType: true, targetId: true, details: true, createdAt: true,
    },
  });
  const more = rows.length > take;
  const items = more ? rows.slice(0, take) : rows;
  res.json({ items, nextCursor: more ? items[items.length - 1].id : null, retentionDays: RETENTION_DAYS });
}

module.exports = { list };
