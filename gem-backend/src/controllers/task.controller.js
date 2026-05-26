const prisma = require('../utils/prisma');

const PRIORITY_MAP = { High: 'high', Medium: 'medium', Low: 'low', high: 'high', medium: 'medium', low: 'low' };
const STATUS_MAP = {
  Pending: 'todo', 'In Progress': 'in_progress', Done: 'done', Overdue: 'todo',
  todo: 'todo', in_progress: 'in_progress', done: 'done',
};

function mapTask(task) {
  const STATUS_OUT = { todo: 'Pending', in_progress: 'In Progress', done: 'Done' };
  const PRIORITY_OUT = { high: 'High', medium: 'Medium', low: 'Low' };
  return {
    ...task,
    priority: PRIORITY_OUT[task.priority] || task.priority,
    status: STATUS_OUT[task.status] || task.status,
    assignedTo: task.assignedTo
      ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim()
      : '',
    createdBy: task.createdBy
      ? `${task.createdBy.firstName || ''} ${task.createdBy.lastName || ''}`.trim()
      : '',
    assignedToId: task.assignedToId,
    createdById: task.createdById,
  };
}

async function getAll(req, res) {
  try {
    const tasks = await prisma.task.findMany({
      where: { gymId: req.user.gymId },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks.map(mapTask));
  } catch (err) {
    console.error('Task getAll error:', err);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
}

async function create(req, res) {
  try {
    const { title, description, dueDate, dueTime, assignedToId, priority, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await prisma.task.create({
      data: {
        title,
        description: description || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        dueTime: dueTime || undefined,
        assignedToId: assignedToId || undefined,
        priority: PRIORITY_MAP[priority] || 'medium',
        status: STATUS_MAP[status] || 'todo',
        gymId: req.user.gymId,
        createdById: req.user.id,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(mapTask(task));
  } catch (err) {
    console.error('Task create error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

async function update(req, res) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, description, dueDate, dueTime, assignedToId, priority, status } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (dueTime !== undefined) data.dueTime = dueTime || null;
  if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
  if (priority !== undefined) data.priority = PRIORITY_MAP[priority] || existing.priority;
  if (status !== undefined) data.status = STATUS_MAP[status] || existing.status;

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  res.json(mapTask(task));
}

async function remove(req, res) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ message: 'Task deleted' });
}

module.exports = { getAll, create, update, remove };
