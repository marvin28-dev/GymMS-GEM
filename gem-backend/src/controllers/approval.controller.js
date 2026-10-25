const prisma = require('../utils/prisma');
const { sendMembershipUpdate } = require('../utils/memberEmail');
const { bestEffort } = require('../utils/bestEffort');
const { serializable } = require('../utils/serializable');

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

// An end date is the last day of access, kept as a date (midnight UTC). A
// membership that ended before yesterday is extended from yesterday, so the
// days added are days from today: added to an end date weeks back they gave
// fewer days, or none (D-17).
const extendFrom = (end) => {
  const today = startOfToday();
  const yesterday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  return end && new Date(end) >= yesterday ? end : yesterday;
};

// A cancelled or deactivated membership is over until it is renewed
const ENDED = ['cancelled', 'deactivated'];

// Each action says what it does to a member, and when it does not fit the
// member as they stand: freezing twice compounded the dates, and an "unfreeze"
// of a cancelled member reactivated it. The screens only offer what fits, but a
// request raised earlier can be approved after the member has changed.
const ACTIONS = {
  extend_membership: {
    days: true,
    summary: (m, p) => `Extend ${name(m)}'s membership by ${p.days} days`,
    refuse: (m) => (m.isVisitor ? `${name(m)} is a visitor: buy them passes instead.`
      : ENDED.includes(m.status) ? `${name(m)}'s membership is ${m.status}. Renew it instead.` : null),
    // A frozen membership stays frozen; the days are kept for when it resumes
    apply: (m, p) => (m.status === 'frozen'
      ? { endDate: addDays(m.endDate, p.days), ...(m.preFreezEndDate ? { preFreezEndDate: addDays(m.preFreezEndDate, p.days) } : {}) }
      : { endDate: addDays(extendFrom(m.endDate), p.days), status: m.status === 'pending' ? 'pending' : 'active' }),
  },
  freeze_membership: {
    days: true,
    summary: (m, p) => `Freeze ${name(m)}'s membership for ${p.days} days`,
    refuse: (m) => (m.isVisitor ? `${name(m)} is a visitor and has no membership to freeze.`
      : m.status === 'frozen' ? `${name(m)}'s membership is already frozen.`
        : ENDED.includes(m.status) ? `${name(m)}'s membership is ${m.status}, so there is nothing to freeze.` : null),
    apply: (m, p) => ({
      preFreezEndDate: m.endDate || null,
      freezeStartDate: p.startDate ? new Date(p.startDate) : startOfToday(),
      endDate: addDays(m.endDate, p.days),
      status: 'frozen',
    }),
  },
  unfreeze_membership: {
    summary: (m) => `Unfreeze ${name(m)}'s membership`,
    refuse: (m) => (m.status === 'frozen' ? null : `${name(m)}'s membership is not frozen.`),
    apply: (m) => {
      const frozenSince = m.freezeStartDate ? new Date(m.freezeStartDate) : null;
      const daysFrozen = frozenSince ? Math.max(0, Math.round((startOfToday() - frozenSince) / DAY)) : 0;
      const base = m.preFreezEndDate || m.endDate;
      return { endDate: base ? addDays(base, daysFrozen) : m.endDate, status: 'active', freezeStartDate: null, preFreezEndDate: null };
    },
  },
  cancel_membership: {
    summary: (m) => `Cancel ${name(m)}'s membership`,
    refuse: (m) => (m.isVisitor ? `${name(m)} is a visitor and has no membership to cancel.`
      : ENDED.includes(m.status) ? `${name(m)}'s membership is already ${m.status}.` : null),
    // A cancelled membership is distinct from a staff-deactivated account: the
    // person can still drop in on a paid day pass until they renew.
    apply: () => ({ status: 'cancelled' }),
  },
  convert_to_visitor: {
    summary: (m) => `Convert ${name(m)} to a visitor`,
    refuse: (m) => (m.isVisitor ? `${name(m)} is already a visitor.` : null),
    apply: () => ({ isVisitor: true, status: 'visitor', packageId: null, endDate: null, passesTotal: 0, passesRemaining: 0 }),
  },
};

function name(m) { return `${m?.firstName || ''} ${m?.lastName || ''}`.trim(); }
const isManagement = (role) => role === 'general_manager' || role === 'manager';
const isId = (v) => typeof v === 'string' && v.trim() !== '';

// The days and dates an action carries: { params } or { error, field }
function readParams(action, raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const params = { ...given };
  if (ACTIONS[action].days) {
    const days = Number(given.days);
    if (given.days === null || given.days === '' || !Number.isInteger(days) || days < 1 || days > 3650) {
      return { error: 'Enter a number of whole days between 1 and 3650.', field: 'days' };
    }
    params.days = days;
  }
  if (given.startDate !== undefined && given.startDate !== null && given.startDate !== '') {
    const text = String(given.startDate);
    if (!/^\d{4}-\d{2}-\d{2}/.test(text) || Number.isNaN(new Date(text).getTime())) {
      return { error: 'The start date is not a valid date.', field: 'startDate' };
    }
  }
  return { params };
}

async function getMember(gymId, idOrCode) {
  if (!isId(idOrCode)) return null;
  return prisma.member.findFirst({ where: { gymId, OR: [{ id: idOrCode }, { memberCode: idOrCode }] } });
}

async function notifyManagers(gymId, title, body, link) {
  const managers = await prisma.staff.findMany({
    where: { gymId, isActive: true, role: { in: ['general_manager', 'manager'] } },
    select: { id: true },
  });
  await Promise.all(managers.map(m => bestEffort(prisma.notification.create({
    data: { gymId, staffId: m.id, title, body, type: 'system', link },
  }), 'Manager notification')));
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
        // Added in the database, so a payment taken at the same moment is not lost
        data.balance = { increment: fee };
        data.freezeFeeLastChargedAt = new Date();
      }
    } catch (e) { console.error('Freeze fee charge failed:', e.message); }
  }
  const updated = await prisma.member.update({ where: { id: member.id }, data });
  // Tell the member their membership changed. Best-effort: never block the action.
  bestEffort(sendMembershipUpdate(updated, action, gymId), 'Membership change email');
  return updated;
}

// ── A manager (or GM) doing the change directly, no request needed ────────────
// The member and the action's details, checked; or the refusal to send back
async function prepare(gymId, memberId, action, rawParams) {
  if (!ACTIONS[action]) return { status: 400, body: { error: 'Unknown action' } };
  if (!isId(memberId)) return { status: 400, body: { error: 'Choose a member.', field: 'memberId' } };
  const read = readParams(action, rawParams);
  if (read.error) return { status: 400, body: { error: read.error, field: read.field } };
  const member = await getMember(gymId, memberId);
  if (!member) return { status: 404, body: { error: 'Member not found' } };
  const refusal = ACTIONS[action].refuse(member);
  if (refusal) return { status: 409, body: { error: refusal } };
  return { member, params: read.params };
}

async function applyDirect(req, res) {
  if (!isManagement(req.user.role)) return res.status(403).json({ error: 'Only a manager can do this directly.' });
  const { memberId, action, params } = req.body;
  const ready = await prepare(req.user.gymId, memberId, action, params);
  if (!ready.member) return res.status(ready.status).json(ready.body);
  const updated = await runAction(ready.member, action, ready.params, req.user.gymId);
  res.json({ member: updated });
}

// ── The front desk asking a manager to approve a change ───────────────────────
async function create(req, res) {
  const { memberId, action, note } = req.body;
  if (ACTIONS[action] && (!note || !String(note).trim())) return res.status(400).json({ error: 'A note is required so the manager knows why.' });
  const ready = await prepare(req.user.gymId, memberId, action, req.body.params);
  if (!ready.member) return res.status(ready.status).json(ready.body);
  const { member, params } = ready;

  const requester = await bestEffort(prisma.staff.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } }), 'Reading the requester');
  const requestedByName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : '';
  const summary = ACTIONS[action].summary(member, params);

  // One request per member at a time: the next waits until a manager has
  // approved or declined this one. Checked and written in one serializable
  // transaction, so two desks sending at the same moment cannot both get in.
  let request;
  try {
    request = await serializable(async (tx) => {
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
          params: JSON.stringify(params),
          summary,
          note: String(note).trim(),
          status: 'pending',
          requestedById: req.user.id,
          requestedByName,
        },
      });
    });
  } catch (err) {
    // Two requests racing: the database refuses one of them, with an error
    // whose code varies. Looking again finds the request that won.
    if (!err.waiting) {
      err.waiting = await bestEffort(prisma.approvalRequest.findFirst({ where: { gymId: req.user.gymId, memberId: member.id, status: 'pending' } }), 'Finding the waiting request');
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
  // The request stands even if its task cannot be made
  const task = await bestEffort(prisma.task.create({
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
  }), 'Approval task');
  const taskId = task?.id || null;
  if (taskId) await bestEffort(prisma.approvalRequest.update({ where: { id: request.id }, data: { taskId } }), 'Linking the approval task');

  await bestEffort(notifyManagers(req.user.gymId, 'Approval needed',
    `${requestedByName || 'The front desk'}: ${summary}. Reason: ${String(note).trim()}`, link), 'Approval notification');

  res.status(201).json({ ...request, taskId });
}

// Pending/all requests for a member (the profile panel reads this).
async function listForMember(req, res) {
  const { memberId } = req.params;
  const { status } = req.query;
  const member = await getMember(req.user.gymId, memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const where = { gymId: req.user.gymId, memberId: member.id };
  if (status) where.status = String(status);
  const requests = await prisma.approvalRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(requests);
}

const ALREADY_DEALT_WITH = { error: 'This request has already been dealt with.' };

// Moves a waiting request on, only if it is still waiting. The check and the
// change are one statement, so two managers answering at once cannot both win.
async function claim(request, data) {
  const { count } = await prisma.approvalRequest.updateMany({ where: { id: request.id, status: 'pending' }, data });
  return count === 1;
}

async function resolve(req, res, approve) {
  if (!isManagement(req.user.role)) return res.status(403).json({ error: 'Only a manager can approve requests.' });
  const request = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json(ALREADY_DEALT_WITH);

  let member = null;
  let params = {};
  if (approve) {
    if (!ACTIONS[request.action]) return res.status(400).json({ error: 'Unknown action' });
    try { params = JSON.parse(request.params || '{}'); } catch { params = null; }
    const read = params && readParams(request.action, params);
    if (!read || read.error) return res.status(409).json({ error: 'The details of this request cannot be read. Decline it and ask for it again.' });
    params = read.params;
    member = await getMember(req.user.gymId, request.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    // The member may have changed since the desk asked
    const refusal = ACTIONS[request.action].refuse(member);
    if (refusal) return res.status(409).json({ error: `${refusal} Decline this request instead.` });
  }

  const outcome = { status: approve ? 'approved' : 'rejected', resolvedById: req.user.id, resolvedNote: req.body.note || null, resolvedAt: new Date() };
  if (!(await claim(request, outcome))) return res.status(400).json(ALREADY_DEALT_WITH);

  let updatedMember = null;
  if (approve) {
    try {
      updatedMember = await runAction(member, request.action, params, req.user.gymId);
    } catch (err) {
      // Nothing was changed, so the request goes back to waiting
      await prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'pending', resolvedById: null, resolvedNote: null, resolvedAt: null } });
      throw err;
    }
  }

  if (request.taskId) {
    await bestEffort(prisma.task.update({ where: { id: request.taskId }, data: { status: 'done' } }), 'Closing the approval task');
  }
  // Tell whoever asked.
  if (request.requestedById) {
    await bestEffort(prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        staffId: request.requestedById,
        title: approve ? 'Request approved' : 'Request declined',
        body: `${request.summary} was ${approve ? 'approved' : 'declined'}.${req.body.note ? ` Note: ${req.body.note}` : ''}`,
        type: 'system',
        link: `/members/${request.memberId}`,
      },
    }), 'Approval answer notification');
  }
  res.json({ request: { ...request, status: outcome.status }, member: updatedMember });
}

// Whoever sent a request can take it back while it is still waiting (a
// manager declines instead). It leaves the managers' lists, and the member
// is free for a new request.
async function cancel(req, res) {
  const request = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, gymId: req.user.gymId } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json(ALREADY_DEALT_WITH);
  if (request.requestedById !== req.user.id && !isManagement(req.user.role)) {
    return res.status(403).json({ error: 'Only the person who sent this request can cancel it.' });
  }
  if (!(await claim(request, { status: 'cancelled', resolvedById: req.user.id, resolvedAt: new Date() }))) {
    return res.status(400).json(ALREADY_DEALT_WITH);
  }
  if (request.taskId) await bestEffort(prisma.task.delete({ where: { id: request.taskId } }), 'Removing the approval task');
  res.json({ request: { ...request, status: 'cancelled' } });
}

const approve = (req, res) => resolve(req, res, true);
const reject  = (req, res) => resolve(req, res, false);

module.exports = { create, listForMember, approve, reject, cancel, applyDirect, ACTIONS };
