const prisma = require('../utils/prisma');
const { sendMembershipUpdate } = require('../utils/memberEmail');

// ── Actions a manager can be asked to approve ─────────────────────────────────
// Each returns the Prisma `data` to apply to the member. One place decides what
// a change actually does, used both when a manager acts directly and when one
// approves a request raised by the front desk.
const DAY = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (base, n) => {
  const d = base ? new Date(base) : startOfToday();
  d.setDate(d.getDate() + Number(n || 0));
  return d;
};

const ACTIONS = {
  extend_membership: {
    summary: (m, p) => `Extend ${name(m)}'s membership by ${Number(p.days) || 0} days`,
    apply: (m, p) => ({ endDate: addDays(m.endDate, Number(p.days) || 0), status: 'active' }),
  },
  freeze_membership: {
    summary: (m, p) => `Freeze ${name(m)}'s membership for ${Number(p.days) || 0} days`,
    apply: (m, p) => ({
      preFreezEndDate: m.endDate || null,
      freezeStartDate: p.startDate ? new Date(p.startDate) : startOfToday(),
      endDate: addDays(m.endDate, Number(p.days) || 0),
      status: 'frozen',
    }),
  },
  unfreeze_membership: {
    summary: (m) => `Unfreeze ${name(m)}'s membership`,
    apply: (m) => {
      const frozenSince = m.freezeStartDate ? new Date(m.freezeStartDate) : null;
      const daysFrozen = frozenSince ? Math.max(0, Math.round((startOfToday() - frozenSince) / DAY)) : 0;
      const base = m.preFreezEndDate || m.endDate;
      return { endDate: base ? addDays(base, daysFrozen) : m.endDate, status: 'active', freezeStartDate: null, preFreezEndDate: null };
    },
  },
  cancel_membership: {
    summary: (m) => `Cancel ${name(m)}'s membership`,
    // A cancelled membership is distinct from a staff-deactivated account: the
    // person can still drop in on a paid day pass until they renew.
    apply: () => ({ status: 'cancelled' }),
  },
  convert_to_visitor: {
    summary: (m) => `Convert ${name(m)} to a visitor`,
    apply: () => ({ isVisitor: true, status: 'visitor', packageId: null, endDate: null, passesTotal: 0, passesRemaining: 0 }),
  },
};

function name(m) { return `${m?.firstName || ''} ${m?.lastName || ''}`.trim(); }
const isManagement = (role) => role === 'general_manager' || role === 'manager';

async function getMember(gymId, idOrCode) {
  return prisma.member.findFirst({ where: { gymId, OR: [{ id: idOrCode }, { memberCode: idOrCode }] } });
}

async function notifyManagers(gymId, title, body, link) {
  const managers = await prisma.staff.findMany({
    where: { gymId, isActive: true, role: { in: ['general_manager', 'manager'] } },
    select: { id: true },
  });
  await Promise.all(managers.map(m => prisma.notification.create({
    data: { gymId, staffId: m.id, title, body, type: 'system', link },
  }).catch(() => {})));
}

// Apply an action to a member and return the fresh record.
async function runAction(member, action, params, gymId) {
  const data = ACTIONS[action].apply(member, params || {});
  // Freezing a membership charges the gym's freeze fee (if one is set up): the
  // first charge lands on the balance now and is stamped so the recurring job
  // (every N days) knows when it was last charged.
  if (action === 'freeze_membership') {
    try {
      const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { settings: true } });
      const fee = Number(gym?.settings?.freeze?.fee) || 0;
      if (fee > 0) {
        data.balance = (member.balance || 0) + fee;
        data.freezeFeeLastChargedAt = new Date();
      }
    } catch (e) { console.error('Freeze fee charge failed:', e.message); }
  }
  const updated = await prisma.member.update({ where: { id: member.id }, data });
  // Tell the member their membership changed. Best-effort: never block the action.
  sendMembershipUpdate(updated, action, gymId).catch(() => {});
  return updated;
}

// ── A manager (or GM) doing the change directly, no request needed ────────────
async function applyDirect(req, res) {
  if (!isManagement(req.user.role)) return res.status(403).json({ error: 'Only a manager can do this directly.' });
  const { memberId, action, params } = req.body;
  if (!ACTIONS[action]) return res.status(400).json({ error: 'Unknown action' });
  const member = await getMember(req.user.gymId, memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const updated = await runAction(member, action, params, req.user.gymId);
  res.json({ member: updated });
}

// ── The front desk asking a manager to approve a change ───────────────────────
async function create(req, res) {
  const { memberId, action, params, note } = req.body;
  if (!ACTIONS[action]) return res.status(400).json({ error: 'Unknown action' });
  if (!note || !String(note).trim()) return res.status(400).json({ error: 'A note is required so the manager knows why.' });
  const member = await getMember(req.user.gymId, memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const requester = await prisma.staff.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } }).catch(() => null);
  const requestedByName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : '';
  const summary = ACTIONS[action].summary(member, params || {});

  // One request per member at a time: the next waits until a manager has
  // approved or declined this one. Checked and written in one serializable
  // transaction, so two desks sending at the same moment cannot both get in.
  let request;
  try {
    request = await prisma.$transaction(async (tx) => {
      const waiting = await tx.approvalRequest.findFirst({ where: { gymId: req.user.gymId, memberId: member.id, status: 'pending' } });
      if (waiting) {
        const err = new Error('pending');
        err.waiting = waiting;
        throw err;
      }
      return tx.approvalRequest.create({
        data: {
          gymId: req.user.gymId,
          memberId: member.id,
          memberName: name(member),
          action,
          params: JSON.stringify(params || {}),
          summary,
          note: String(note).trim(),
          status: 'pending',
          requestedById: req.user.id,
          requestedByName,
        },
      });
    }, { isolationLevel: 'Serializable' });
  } catch (err) {
    // Two requests racing: the database refuses one of them, with an error
    // whose code varies. Looking again finds the request that won.
    if (!err.waiting) {
      err.waiting = await prisma.approvalRequest.findFirst({ where: { gymId: req.user.gymId, memberId: member.id, status: 'pending' } }).catch(() => null);
    }
    if (err.waiting) {
      return res.status(409).json({
        error: `${name(member)} already has a request waiting for a manager (${err.waiting.summary}). It must be approved or declined before another can be sent.`,
        pending: { id: err.waiting.id, summary: err.waiting.summary, requestedById: err.waiting.requestedById, requestedByName: err.waiting.requestedByName, createdAt: err.waiting.createdAt },
      });
    }
    throw err;
  }

  // A task for the managers' own list + badge, plus a notification that deep-links
  // to the member so they can approve it there.
  const link = `/members/${member.id}`;
  let taskId = null;
  try {
    const task = await prisma.task.create({
      data: {
        gymId: req.user.gymId,
        title: `Approval needed: ${summary}`,
        description: `${requestedByName || 'The front desk'} asks to ${summary.toLowerCase()}. Reason: ${String(note).trim()}. Open ${name(member)}'s profile to approve or decline.`,
        category: 'Approval',
        assignedGroup: 'management',
        status: 'todo',
        dueDate: new Date(),
        createdById: req.user.id,
      },
    });
    taskId = task.id;
    await prisma.approvalRequest.update({ where: { id: request.id }, data: { taskId } });
  } catch (e) { /* the request still stands without the task */ }

  await notifyManagers(req.user.gymId, 'Approval needed',
    `${requestedByName || 'The front desk'}: ${summary}. Reason: ${String(note).trim()}`, link).catch(() => {});

  res.status(201).json({ ...request, taskId });
}

// Pending/all requests for a member (the profile panel reads this).
async function listForMember(req, res) {
  const { memberId } = req.params;
  const { status } = req.query;
  const member = await getMember(req.user.gymId, memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const where = { gymId: req.user.gymId, memberId: member.id };
  if (status) where.status = status;
  const requests = await prisma.approvalRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(requests);
}

async function resolve(req, res, approve) {
  if (!isManagement(req.user.role)) return res.status(403).json({ error: 'Only a manager can approve requests.' });
  const request = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been dealt with.' });

  let updatedMember = null;
  if (approve) {
    const member = await getMember(req.user.gymId, request.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    let params = {};
    try { params = JSON.parse(request.params || '{}'); } catch {}
    if (!ACTIONS[request.action]) return res.status(400).json({ error: 'Unknown action' });
    updatedMember = await runAction(member, request.action, params, req.user.gymId);
  }

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: approve ? 'approved' : 'rejected', resolvedById: req.user.id, resolvedNote: req.body?.note || null, resolvedAt: new Date() },
  });
  if (request.taskId) {
    await prisma.task.update({ where: { id: request.taskId }, data: { status: 'done' } }).catch(() => {});
  }
  // Tell whoever asked.
  if (request.requestedById) {
    await prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        staffId: request.requestedById,
        title: approve ? 'Request approved' : 'Request declined',
        body: `${request.summary} was ${approve ? 'approved' : 'declined'}.${req.body?.note ? ` Note: ${req.body.note}` : ''}`,
        type: 'system',
        link: `/members/${request.memberId}`,
      },
    }).catch(() => {});
  }
  res.json({ request: { ...request, status: approve ? 'approved' : 'rejected' }, member: updatedMember });
}

// Whoever sent a request can take it back while it is still waiting (a
// manager declines instead). It leaves the managers' lists, and the member
// is free for a new request.
async function cancel(req, res) {
  const request = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been dealt with.' });
  if (request.requestedById !== req.user.id && !isManagement(req.user.role)) {
    return res.status(403).json({ error: 'Only the person who sent this request can cancel it.' });
  }
  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: 'cancelled', resolvedById: req.user.id, resolvedAt: new Date() },
  });
  if (request.taskId) await prisma.task.delete({ where: { id: request.taskId } }).catch(() => {});
  res.json({ request: { ...request, status: 'cancelled' } });
}

const approve = (req, res) => resolve(req, res, true);
const reject  = (req, res) => resolve(req, res, false);

module.exports = { create, listForMember, approve, reject, cancel, applyDirect, ACTIONS };
