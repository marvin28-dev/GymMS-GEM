const prisma = require('../utils/prisma');
const { bestEffort } = require('../utils/bestEffort');

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
    await Promise.all(managers.map(m => bestEffort(prisma.notification.create({
      data: {
        gymId, staffId: m.id,
        title: 'New maintenance task',
        body: `A fault was reported on ${issue.equipment}. It has been added to the management task list.`,
        type: 'task',
        link: '/tasks',
      },
    }), 'Maintenance notification')));
  } catch (err) {
    console.error('Failed to raise task for equipment issue:', err.message);
  }
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'resolved'];

// What a report or an update may set, checked: { data } or { error, field }.
// The gym and the issue's history are the server's to say: the request body
// used to go to the database whole, so an update could move an issue into
// another gym.
function readIssue(body, creating) {
  const data = {};
  for (const key of ['equipment', 'location', 'description']) {
    if (body[key] !== undefined) data[key] = body[key] === null ? '' : String(body[key]).trim();
  }
  if ((creating || 'equipment' in data) && !data.equipment) return { error: 'Name the equipment.', field: 'equipment' };
  if ((creating || 'description' in data) && !data.description) return { error: 'Describe the problem.', field: 'description' };
  if ('location' in data) data.location = data.location || null;
  if (body.severity !== undefined) {
    const severity = String(body.severity).toLowerCase();
    if (!SEVERITIES.includes(severity)) return { error: 'Choose how serious it is.', field: 'severity' };
    data.severity = severity;
  }
  // A new report is always open; only an update moves it on
  if (!creating && body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'That status does not exist.', field: 'status' };
    data.status = body.status;
  }
  return { data };
}

async function getAll(req, res) {
  const issues = await prisma.equipmentIssue.findMany({
    where: { gymId: req.user.gymId },
    orderBy: { reportedAt: 'desc' },
  });
  res.json(issues);
}

async function create(req, res) {
  const read = readIssue(req.body, true);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });
  const issue = await prisma.equipmentIssue.create({
    data: { ...read.data, gymId: req.user.gymId },
  });
  raiseIssueTask(req.user.gymId, req.user.id, issue);
  res.status(201).json(issue);
}

async function update(req, res) {
  const existing = await prisma.equipmentIssue.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Issue not found' });

  const read = readIssue(req.body, false);
  if (read.error) return res.status(400).json({ error: read.error, field: read.field });
  const data = read.data;
  // When it was fixed is recorded here, so the end of day report can list it
  if (data.status === 'resolved' && existing.status !== 'resolved') data.resolvedAt = new Date();
  else if (data.status && data.status !== 'resolved') data.resolvedAt = null;

  const issue = await prisma.equipmentIssue.update({
    where: { id: existing.id },
    data,
  });
  res.json(issue);
}

module.exports = { getAll, create, update };
