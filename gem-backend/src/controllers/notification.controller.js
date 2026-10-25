const prisma = require('../utils/prisma');
const { visibilityWhere } = require('../utils/notificationScope');

// A notice addressed to you is read when its own isRead says so; a gym-wide
// one when you have a read row for it (D-46), so each person has their own
// unread state. A gym-wide notice read by someone before that stays read:
// nobody can tell now who it was, and new notices are no longer marked that way.
const asSeenBy = (userId) => ({ reads, ...n }) => ({ ...n, isRead: n.staffId === userId ? n.isRead : n.isRead || reads.length > 0 });
const myRead = (userId) => ({ reads: { where: { staffId: userId }, select: { id: true } } });

async function getAll(req, res) {
  const notifications = await prisma.notification.findMany({
    where: visibilityWhere(req.user),
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: myRead(req.user.id),
  });
  res.json(notifications.map(asSeenBy(req.user.id)));
}

// Marks what this user can see, for this user only
async function markRead(req, res) {
  const unreadShared = await prisma.notification.findMany({
    // "Not addressed to me" is spelled out: NOT { staffId: me } is unknown, not
    // true, in SQL for a gym-wide notice (no staffId), and matched none of them
    where: { AND: [visibilityWhere(req.user), { OR: [{ staffId: null }, { staffId: { not: req.user.id } }] }, { reads: { none: { staffId: req.user.id } } }] },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.notification.updateMany({ where: { gymId: req.user.gymId, staffId: req.user.id, isRead: false }, data: { isRead: true } }),
    prisma.notificationRead.createMany({ data: unreadShared.map(n => ({ notificationId: n.id, staffId: req.user.id })), skipDuplicates: true }),
  ]);
  res.json({ message: 'All notifications marked as read' });
}

async function markOneRead(req, res) {
  const notif = await prisma.notification.findFirst({
    where: { AND: [{ id: req.params.id }, visibilityWhere(req.user)] },
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  if (notif.staffId === req.user.id) {
    return res.json(await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } }));
  }
  // Opened twice (two tabs) is still read once
  await prisma.notificationRead.createMany({ data: [{ notificationId: notif.id, staffId: req.user.id }], skipDuplicates: true });
  res.json({ ...notif, isRead: true });
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
  // Cleared twice (two tabs) is still cleared once
  else await prisma.notificationDismissal.createMany({ data: [{ notificationId: notif.id, staffId: req.user.id }], skipDuplicates: true });
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
