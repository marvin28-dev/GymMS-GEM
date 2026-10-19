const prisma = require('../utils/prisma');

// Tasks are due by the end of their due date, so the warning goes out at the
// start of that working day - early enough to still plan around it.
const REMINDER_HOUR = 8;

// Short enough that an overdue task is flagged soon after midnight passes.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Resolves the moment a task falls overdue, and the moment to warn about it.
function resolveTiming(task) {
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return {
    dueAt: new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59),
    remindAt: new Date(due.getFullYear(), due.getMonth(), due.getDate(), REMINDER_HOUR, 0, 0),
  };
}

async function runTaskReminders() {
  const now = new Date();
  try {
    const tasks = await prisma.task.findMany({
      where: {
        // Ordinary open work only. A calendar invite is answered, never done, so
        // "not done" reminded people about classes they declined, or went to.
        status: { in: ['todo', 'in_progress'] },
        eventId: null,
        AND: [{ OR: [{ category: null }, { category: { not: 'Calendar' } }] }],
        dueDate: { not: null },
        assignedToId: { not: null },
        // Nobody deactivated is reminded of work they can no longer sign in to see
        assignedTo: { isActive: true },
        OR: [{ dueSoonNotifiedAt: null }, { overdueNotifiedAt: null }],
      },
      select: {
        id: true, gymId: true, title: true, dueDate: true,
        assignedToId: true, dueSoonNotifiedAt: true, overdueNotifiedAt: true,
      },
    });

    for (const task of tasks) {
      const timing = resolveTiming(task);
      if (!timing) continue;
      const { dueAt, remindAt } = timing;

      if (now >= dueAt) {
        if (task.overdueNotifiedAt) continue;
        await prisma.notification.create({
          data: {
            gymId: task.gymId,
            staffId: task.assignedToId,
            title: 'Task Overdue',
            body: `"${task.title}" was due ${dueAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} and is still open.`,
            type: 'task',
          },
        });
        await prisma.task.update({
          where: { id: task.id },
          // Stamp both so a task that slips past its window is not also
          // announced as "due soon" after the fact
          data: { overdueNotifiedAt: now, dueSoonNotifiedAt: task.dueSoonNotifiedAt ?? now },
        });
        continue;
      }

      if (!task.dueSoonNotifiedAt && now >= remindAt) {
        await prisma.notification.create({
          data: {
            gymId: task.gymId,
            staffId: task.assignedToId,
            title: 'Task Due Today',
            body: `"${task.title}" is due today.`,
            type: 'task',
          },
        });
        await prisma.task.update({ where: { id: task.id }, data: { dueSoonNotifiedAt: now } });
      }
    }
  } catch (err) {
    console.error('Task reminder sweep failed:', err.message);
  }
}

function startTaskReminders() {
  setTimeout(runTaskReminders, 20_000);
  const timer = setInterval(runTaskReminders, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startTaskReminders, runTaskReminders, resolveTiming, REMINDER_HOUR };
