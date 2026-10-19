const prisma = require('../utils/prisma');
const { visibilityWhere } = require('../utils/notificationScope');

async function getAll(req, res) {
  const notifications = await prisma.notification.findMany({
    where: visibilityWhere(req.user),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}

// Marks only what this user can see. Marking the whole gym read would clear
// other people's unread state, including notifications they never saw.
async function markRead(req, res) {
  await prisma.notification.updateMany({
    where: { AND: [visibilityWhere(req.user), { isRead: false }] },
    data: { isRead: true },
  });
  res.json({ message: 'All notifications marked as read' });
}

async function markOneRead(req, res) {
  const notif = await prisma.notification.findFirst({
    where: { AND: [{ id: req.params.id }, visibilityWhere(req.user)] },
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json(updated);
}

// A notification addressed to you is deleted; a gym-wide one is only taken
// off your own list, since it is everybody else's too.
async function deleteOne(req, res) {
  const notif = await prisma.notification.findFirst({
    where: { AND: [{ id: req.params.id }, visibilityWhere(req.user)] },
    select: { id: true, staffId: true },
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  if (notif.staffId === req.user.id) await prisma.notification.delete({ where: { id: notif.id } });
  else await prisma.notificationDismissal.create({ data: { notificationId: notif.id, staffId: req.user.id } }).catch(() => {});
  res.json({ message: 'Notification cleared' });
}

// Clear all: everything on your list goes, the same way as one at a time
async function deleteAll(req, res) {
  const visible = await prisma.notification.findMany({ where: visibilityWhere(req.user), select: { id: true, staffId: true } });
  const mine = visible.filter(n => n.staffId === req.user.id).map(n => n.id);
  const shared = visible.filter(n => n.staffId !== req.user.id).map(n => n.id);
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { id: { in: mine } } }),
    prisma.notificationDismissal.createMany({ data: shared.map(notificationId => ({ notificationId, staffId: req.user.id })), skipDuplicates: true }),
  ]);
  res.json({ message: 'Notifications cleared', count: visible.length });
}

module.exports = { getAll, markRead, markOneRead, deleteOne, deleteAll };
