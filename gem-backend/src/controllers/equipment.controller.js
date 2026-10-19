const prisma = require('../utils/prisma');

const SEVERITY_TO_PRIORITY = { low: 'low', medium: 'medium', high: 'high', critical: 'high' };
// Every task the system raises gets a due date - the more urgent the fault, the
// sooner it is due, so nothing lands on the list with no deadline at all.
const SEVERITY_TO_DAYS = { critical: 1, high: 2, medium: 5, low: 7 };
const dueInDays = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

// A reported fault is work for management to pick up, so it becomes a task on
// their department the moment it is raised - otherwise an issue logged at the
// desk sat in a list nobody was told to act on. Best-effort: the issue itself
// is already saved and must stand even if raising the task fails.
async function raiseIssueTask(gymId, createdById, issue) {
  try {
    const where = issue.location ? `${issue.equipment} - ${issue.location}` : issue.equipment;
    await prisma.task.create({
      data: {
        gymId,
        title: `Fix: ${issue.equipment}`,
        description: `Reported fault at ${where}. ${issue.description || ''}`.trim(),
        priority: SEVERITY_TO_PRIORITY[issue.severity] || 'medium',
        dueDate: dueInDays(SEVERITY_TO_DAYS[issue.severity] ?? 5),
        status: 'todo',
        category: 'Equipment Maintenance',
        assignedGroup: 'management',
        createdById: createdById || undefined,
        createdBySystem: true,
      },
    });
    const managers = await prisma.staff.findMany({
      where: { gymId, isActive: true, role: { in: ['general_manager', 'manager'] } },
      select: { id: true },
    });
    await Promise.all(managers.map(m => prisma.notification.create({
      data: {
        gymId, staffId: m.id,
        title: 'New maintenance task',
        body: `A fault was reported on ${issue.equipment}. It has been added to the management task list.`,
        type: 'task',
        link: '/tasks',
      },
    }).catch(() => {})));
  } catch (err) {
    console.error('Failed to raise task for equipment issue:', err.message);
  }
}

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
  raiseIssueTask(req.user.gymId, req.user.id, issue);
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
