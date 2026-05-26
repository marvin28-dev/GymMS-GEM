const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}

async function markRead(req, res) {
  await prisma.notification.updateMany({
    where: { gymId: req.user.gymId, isRead: false },
    data: { isRead: true },
  });
  res.json({ message: 'All notifications marked as read' });
}

async function markOneRead(req, res) {
  const notif = await prisma.notification.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json(updated);
}

async function deleteOne(req, res) {
  const notif = await prisma.notification.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ message: 'Notification deleted' });
}

module.exports = { getAll, markRead, markOneRead, deleteOne };
