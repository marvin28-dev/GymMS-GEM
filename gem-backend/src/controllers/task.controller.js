const prisma = require('../utils/prisma');
const LEGACY_CATEGORIES = { Cleaning: 'Equipment Maintenance', Maintenance: 'Equipment Maintenance', Equipment: 'Equipment Maintenance' };
const normalizeCategory = (c) => LEGACY_CATEGORIES[c] || c;
const { refuseAssignees, jobOf } = require('../utils/assignees');
const { sendTaskAssignedEmail } = require('../utils/taskEmail');
const { parseDateOnly } = require('../utils/dates');
const { logFailure } = require('../utils/bestEffort');

// Departments a task can belong to instead of one person. Everyone in the
// group sees the task and any one of them can move it on.
const GROUP_ROLES = { management: ['general_manager', 'manager'] };
const GROUP_LABELS = { management: 'Management' };
const inGroup = (group, role) => (GROUP_ROLES[group] || []).includes(role);
const asGroup = (value) => (Object.keys(GROUP_ROLES).includes(String(value || '').trim().toLowerCase()) ? String(value).trim().toLowerCase() : null);

// A task can be given to one person or to everyone who does a particular job.
const ASSIGNABLE_ROLES = ['manager', 'front_desk', 'trainer'];
const ROLE_LABELS = { manager: 'All managers', front_desk: 'The front desk', trainer: 'All trainers' };
const asRole = (value) => ASSIGNABLE_ROLES.find(r => r === jobOf(String(value || '').trim().toLowerCase())) || null;

// Whose task is this? Management sees the lot; everyone else sees their own
// work: theirs by name, their job's, their group's, or one they raised.
function belongsTo(task, me) {
  if (MANAGEMENT.includes(me.role)) return true;
  if (task.assignedToId && String(task.assignedToId) === String(me.id)) return true;
  if (task.assignedRole && task.assignedRole === jobOf(me.role)) return true;
  if (task.assignedGroup && inGroup(task.assignedGroup, me.role)) return true;
  if (task.createdById && String(task.createdById) === String(me.id)) return true;
  return false;
}

const MANAGEMENT = ['general_manager', 'manager'];

// Who may change what a task says or remove it. Progress is a separate rule,
// reported by whoever the task belongs to. A task the system raised belongs to
// management, since nobody set it by hand.
function canEditTask(user, task) {
  if (MANAGEMENT.includes(user.role)) return true;
  if (task.createdBySystem) return false;
  return task.createdById && String(task.createdById) === String(user.id);
}

const PRIORITY_MAP ={ High: 'high', Medium: 'medium', Low: 'low', high: 'high', medium: 'medium', low: 'low' };
const STATUS_MAP = {
  Pending: 'todo', 'In Progress': 'in_progress', Done: 'done', Overdue: 'todo',
  todo: 'todo', in_progress: 'in_progress', done: 'done',
  // A calendar invite only ever answers yes or no
  Accepted: 'accepted', Declined: 'declined', accepted: 'accepted', declined: 'declined',
};
// A task standing for a calendar invite has no "in progress": you are either
// coming or you are not. An ordinary task never carries these two.
const CALENDAR_STATUSES = new Set(['todo', 'accepted', 'declined']);
const ORDINARY_STATUSES = new Set(['todo', 'in_progress', 'done']);

function mapTask(task) {
  const STATUS_OUT = { todo: 'Pending', in_progress: 'In Progress', done: 'Done', accepted: 'Accepted', declined: 'Declined' };
  const PRIORITY_OUT = { high: 'High', medium: 'Medium', low: 'Low' };
  return {
    ...task,
    priority: PRIORITY_OUT[task.priority] || task.priority,
    status: STATUS_OUT[task.status] || task.status,
    assignedTo: task.assignedGroup
      ? GROUP_LABELS[task.assignedGroup] || task.assignedGroup
      : task.assignedRole
      ? ROLE_LABELS[task.assignedRole] || task.assignedRole
      : (task.assignedTo
        ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim()
        : ''),
    assignedGroup: task.assignedGroup || null,
    assignedRole: task.assignedRole || null,
    createdBy: task.createdBySystem
      ? 'System'
      : (task.createdBy
        ? `${task.createdBy.firstName || ''} ${task.createdBy.lastName || ''}`.trim()
        : ''),
    createdBySystem: !!task.createdBySystem,
    timeCardId: task.timeCardId || null,
    eventId: task.eventId || null,
    assignedToId: task.assignedToId,
    createdById: task.createdById,
  };
}

async function getAll(req, res) {
  try {
    // ?open=1 leaves out what is settled, for the sidebar's count (F-099)
    const tasks = await prisma.task.findMany({
      where: { gymId: req.user.gymId, ...(req.query.open ? { status: { notIn: ['done', 'accepted', 'declined'] } } : {}) },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mine = { id: req.user.id, role: req.user.role };
    res.json(tasks.filter(t => belongsTo(t, mine)).map(mapTask));
  } catch (err) {
    console.error('Task getAll error:', err);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
}

async function create(req, res) {
  try {
    const { title, description, dueDate, assignedToId, priority, category, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!category) return res.status(400).json({ error: 'Category is required' });
    const role = asRole(req.body.assignedRole);
    if (req.body.assignedRole && !role) {
      return res.status(400).json({ error: 'Nobody does that job here.' });
    }
    const group = asGroup(req.body.assignedGroup);
    if (req.body.assignedGroup && !group) {
      return res.status(400).json({ error: 'There is no such department.' });
    }
    const toPerson = !role && !group;
    const refusal = await refuseAssignees(req.user.gymId, [toPerson ? assignedToId : null]);
    if (refusal) return res.status(400).json({ error: refusal });
    const task = await prisma.task.create({
      data: {
        title,
        description: description || undefined,
        dueDate: dueDate ? parseDateOnly(dueDate) : undefined,
        assignedToId: toPerson ? (assignedToId || undefined) : null,
        assignedRole: role,
        assignedGroup: group,
        priority: PRIORITY_MAP[priority] || 'medium',
        // Every task starts as outstanding. Progress is the assignee's to report.
        status: 'todo',
        category: normalizeCategory(category) || undefined,
        notes: notes || undefined,
        gymId: req.user.gymId,
        createdById: req.user.id,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // A task for a job reaches everyone who does it
    if (role) {
      const sameJob = role === 'trainer' ? ['trainer', 'instructor', 'coach'] : [role];
      const members = await prisma.staff.findMany({
        where: { gymId: req.user.gymId, isActive: true, role: { in: sameJob }, NOT: { id: req.user.id } },
        select: { id: true },
      });
      const dueParsed = parseDateOnly(dueDate);
      const due = dueParsed ? dueParsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null;
      await Promise.all(members.map(m => prisma.notification.create({
        data: {
          gymId: req.user.gymId,
          staffId: m.id,
          title: 'New Task for Your Team',
          body: `"${title}" has been given to ${(ROLE_LABELS[role] || role).toLowerCase()}${due ? `, due ${due}` : ''}.`,
          type: 'task',
          link: '/tasks',
        },
      }).catch(logFailure('Team task notification'))));
    }

    // Same, for a task given to a whole department
    if (group) {
      const members = await prisma.staff.findMany({
        where: { gymId: req.user.gymId, isActive: true, role: { in: GROUP_ROLES[group] }, NOT: { id: req.user.id } },
        select: { id: true },
      });
      const dueParsed = parseDateOnly(dueDate);
      const due = dueParsed ? dueParsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null;
      await Promise.all(members.map(m => prisma.notification.create({
        data: {
          gymId: req.user.gymId,
          staffId: m.id,
          title: 'New Task for Your Team',
          body: `"${title}" has been given to ${(GROUP_LABELS[group] || group).toLowerCase()}${due ? `, due ${due}` : ''}.`,
          type: 'task',
          link: '/tasks',
        },
      }).catch(logFailure('Department task notification'))));
    }

    if (assignedToId && toPerson) {
      const dueParsed = parseDateOnly(dueDate);
      const due = dueParsed ? dueParsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null;
      const assigneeName = task.assignedTo
        ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim()
        : 'a staff member';
      const assignedByName = task.createdBy
        ? `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim()
        : '';

      // The assignee opens their OWN tasks. `/my-profile` is the one route
      // every role can reach (front desk has no `/staff/:id`), and the client
      // maps it to the kiosk equivalent when the viewer is on shift.
      const assigneeLink = `/my-profile?tab=tasks`;
      // Whoever raised it is looking at the assignee's record, so their
      // confirmation points at that person's profile.
      const creatorLink = `/staff/${assignedToId}?tab=tasks`;

      // The assignee is told there is work waiting
      prisma.notification.create({
        data: {
          gymId: req.user.gymId,
          staffId: assignedToId,
          title: 'New Task Assigned',
          body: `"${title}" has been assigned to you${due ? `, due ${due}` : ''}.`,
          type: 'task',
          link: assigneeLink,
        },
      }).catch(logFailure('Task assigned notification'));

      // And whoever raised it gets a confirmation, unless they assigned it to
      // themselves and would otherwise be told twice.
      if (String(assignedToId) !== String(req.user.id)) {
        prisma.notification.create({
          data: {
            gymId: req.user.gymId,
            staffId: req.user.id,
            title: 'Task Assigned',
            body: `You assigned "${title}" to ${assigneeName}${due ? `, due ${due}` : ''}.`,
            type: 'task',
            link: creatorLink,
          },
        }).catch(logFailure('Task assigned confirmation'));

        sendTaskAssignedEmail({ task, assigneeId: assignedToId, gymId: req.user.gymId, assignedByName })
          .catch(err => console.error('Task assignment email failed:', err.message));
      }
    }

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

  const { title, description, dueDate, assignedToId, priority, status, category, notes } = req.body;
  // A completion note travels with the status change, so it belongs to the
  // assignee too; everything else is the task's content.
  const editsContent = [title, description, dueDate, assignedToId, priority, category, req.body.assignedRole, req.body.assignedGroup].some(v => v !== undefined);
  if (editsContent && !canEditTask(req.user, existing)) {
    return res.status(403).json({ error: 'Only the person who set this task, or a manager, can change it.' });
  }
  const data = {};
  if (title !== undefined) data.title = title;
  // An existing task can be recategorised but not stripped of its category
  if (category !== undefined) {
    if (!category) return res.status(400).json({ error: 'Category is required' });
    data.category = normalizeCategory(category);
  }
  if (description !== undefined) data.description = description;
  // Rescheduling starts the reminder cycle over, otherwise a task moved to a
  // later date would never warn again because it was already announced once.
  if (dueDate !== undefined) {
    data.dueDate = dueDate ? parseDateOnly(dueDate) : null;
    data.dueSoonNotifiedAt = null;
    data.overdueNotifiedAt = null;
  }
  // Handing it to someone new needs them to still work here. A task already
  // with a deactivated person can still be edited or passed on.
  if (assignedToId && String(assignedToId) !== String(existing.assignedToId)) {
    const refusal = await refuseAssignees(req.user.gymId, [assignedToId]);
    if (refusal) return res.status(400).json({ error: refusal });
  }
  if (req.body.assignedRole !== undefined) {
    const role = asRole(req.body.assignedRole);
    if (req.body.assignedRole && !role) {
      return res.status(400).json({ error: 'Nobody does that job here.' });
    }
    data.assignedRole = role;
    if (role) { data.assignedToId = null; data.assignedGroup = null; }
  }
  if (req.body.assignedGroup !== undefined) {
    const group = asGroup(req.body.assignedGroup);
    if (req.body.assignedGroup && !group) {
      return res.status(400).json({ error: 'There is no such department.' });
    }
    data.assignedGroup = group;
    if (group) { data.assignedToId = null; data.assignedRole = null; }
  }
  if (assignedToId !== undefined && !data.assignedRole && !data.assignedGroup) data.assignedToId = assignedToId || null;
  if (priority !== undefined) data.priority = PRIORITY_MAP[priority] || existing.priority;
  if (notes !== undefined) data.notes = notes || null;

  // Progress is reported by the person doing the work. An unassigned task can
  // be moved by anyone, since there is nobody it belongs to yet.
  if (status !== undefined) {
    const nextStatus = STATUS_MAP[status] || existing.status;
    // A calendar invite only ever answers yes or no, and only the person asked
    // may answer it. An ordinary task never carries that answer.
    if (existing.eventId || existing.category === 'Calendar') {
      // A calendar invite only ever answers yes or no, and only the person
      // asked may answer it.
      if (!CALENDAR_STATUSES.has(nextStatus)) {
        return res.status(400).json({ error: 'This is a calendar invite: accept it or decline it.' });
      }
      const isAssignee = existing.assignedToId && String(existing.assignedToId) === String(req.user.id);
      if (!isAssignee) {
        return res.status(403).json({ error: 'Only the person invited can respond to this.' });
      }
    } else if (!ORDINARY_STATUSES.has(nextStatus)) {
      return res.status(400).json({ error: 'That status does not apply to this task.' });
    } else if (!MANAGEMENT.includes(req.user.role)) {
      // An ordinary task's progress is management's to record - not the
      // assignee's, not a department member's, not even the person who raised
      // it. Everyone else can see the task but not move it on.
      return res.status(403).json({ error: 'Only management can change the status of a task.' });
    }
    data.status = nextStatus;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Whoever set the task hears when it is settled - done, or answered either
  // way if it was a calendar invite - as long as it was not them settling it.
  const settledTo = { done: true, accepted: true, declined: true };
  if (data.status && settledTo[data.status] && data.status !== existing.status
    && task.createdById && String(task.createdById) !== String(req.user.id)) {
    const who = task.assignedTo
      ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim()
      : 'Someone';
    const body = data.status === 'done'
      ? `${who} marked "${task.title}" as done.`
      : data.status === 'accepted'
      ? `${who} accepted "${task.title}".`
      : `${who} declined "${task.title}".`;
    prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        staffId: task.createdById,
        title: data.status === 'done' ? 'Task Completed' : 'Invite Answered',
        body,
        type: 'task',
        link: task.eventId ? '/calendar' : '/tasks',
      },
    }).catch(logFailure('Task settled notification'));
  }

  res.json(mapTask(task));
}

async function remove(req, res) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!canEditTask(req.user, existing)) {
    return res.status(403).json({ error: 'Only the person who set this task, or a manager, can delete it.' });
  }

  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ message: 'Task deleted' });
}

module.exports = { getAll, create, update, remove };
