// Messages from GEM to every gym, or to one: each gym gets a notification its
// staff see (owners, managers and the desk), and its owners an email when asked
const prisma = require('../utils/prisma');
const { isDemoGym } = require('../utils/sendEmail');
const { sendAnnouncement } = require('../utils/gemEmail');
const { broadcast } = require('../utils/liveHub');
const { bestEffort } = require('../utils/bestEffort');

// ── GET /api/admin/announcements ─────────────────────────────────────────────
async function list(req, res) {
  const rows = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const gymIds = [...new Set(rows.map(r => r.gymId).filter(Boolean))];
  const gyms = gymIds.length ? await prisma.gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true } }) : [];
  const nameBy = new Map(gyms.map(g => [g.id, g.name]));
  res.json(rows.map(r => ({ ...r, gymName: r.gymId ? nameBy.get(r.gymId) || null : null })));
}

// ── POST /api/admin/announcements { title, body, gymId?, email? } ────────────
async function create(req, res) {
  const title = String(req.body?.title ?? '').trim();
  const body = String(req.body?.body ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Give it a title.', field: 'title' });
  if (title.length > 120) return res.status(400).json({ error: 'Keep the title under 120 characters.', field: 'title' });
  if (!body) return res.status(400).json({ error: 'Write the message.', field: 'body' });
  if (body.length > 4000) return res.status(400).json({ error: 'Keep the message under 4,000 characters.', field: 'body' });
  const gymId = req.body?.gymId ? String(req.body.gymId) : null;
  const gyms = (await prisma.gym.findMany({ where: gymId ? { id: gymId } : {}, select: { id: true, code: true, name: true } })).filter(g => !isDemoGym(g));
  if (gymId && !gyms.length) return res.status(404).json({ error: 'Gym not found', field: 'gymId' });
  if (!gyms.length) return res.status(400).json({ error: 'There is no gym to send it to yet.' });
  const email = req.body?.email === true;

  // A few thousand rows a statement, well inside PostgreSQL's limit on parameters
  const rows = gyms.map(g => ({ gymId: g.id, title, body, type: 'system' }));
  for (let i = 0; i < rows.length; i += 5000) await prisma.notification.createMany({ data: rows.slice(i, i + 5000) });
  gyms.forEach(g => broadcast(g.id, { resource: 'notifications', origin: null }));
  const saved = await prisma.announcement.create({ data: { title, body, gymId, emailed: email, gyms: gyms.length } });
  // The emails go out after the answer: one per owner, and every gym can take a while
  if (email) {
    bestEffort((async () => { for (const g of gyms) await sendAnnouncement(g, title, body); })(), 'Announcement emails');
  }
  res.status(201).json({ ...saved, gymName: gymId ? gyms[0].name : null });
}

module.exports = { list, create };
