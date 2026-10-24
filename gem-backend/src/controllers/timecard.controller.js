const prisma = require('../utils/prisma');
const { clockInCheck, clockOutCheck, rosteredDay, minutesOf } = require('../utils/scheduleAlert');
const { sendGroupTaskEmail } = require('../utils/taskEmail');
const { rankOf } = require('../utils/hierarchy');
const { logActivity, fullName } = require('../utils/activityLog');
const { logFailure } = require('../utils/bestEffort');
const { serializable } = require('../utils/serializable');

const dayLabel = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const MANAGER_ROLES = ['general_manager', 'manager'];

const timeLabel = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const CARD_INCLUDE = {
  staff: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
};


async function getAll(req, res) {
  const { staffId, date, openOnly, overdueOnly } = req.query;
  const where = { gymId: req.user.gymId };
  if (staffId) where.staffId = staffId;
  // Shifts nobody has closed yet, for the end-of-day and dashboard warnings
  if (openOnly === 'true') where.punchOut = null;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.date = { gte: start, lt: end };
  }
  const cards = await prisma.timeCard.findMany({
    where,
    include: {
      staff: { select: { id: true, firstName: true, lastName: true, role: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });

  // An open shift says when it stops being normal and starts being a problem,
  // so the dashboard can stay quiet while the report still shows everything.
  if (openOnly === 'true') {
    const now = new Date();
    const enriched = await Promise.all(cards.map(async (c) => {
      const due = await overdueFrom(req.user.gymId, c);
      return { ...c, overdueFrom: due, overdue: !!due && now >= due };
    }));
    return res.json(overdueOnly === 'true' ? enriched.filter(c => c.overdue) : enriched);
  }

  res.json(cards);
}

// When an open shift becomes worth complaining about. A shift still inside its
// hours is just somebody at work, so the warning holds off until:
//
//   rostered that day  - an hour past the end of their shift
//   not rostered       - ten hours after they clocked in
//
// Generating the end-of-day report ignores this and shows every open shift,
// because closing the day on any of them loses those hours.
const GRACE_AFTER_SHIFT_MS = 60 * 60 * 1000;
const MAX_UNROSTERED_MS = 10 * 60 * 60 * 1000;

async function overdueFrom(gymId, card) {
  if (!card.punchIn) return null;
  const inAt = new Date(card.punchIn);
  const day = await rosteredDay({ gymId, staffId: card.staffId, when: inAt }).catch(logFailure('Reading the rota'));
  const endMins = day ? minutesOf(day.end) : null;

  if (endMins !== null) {
    const end = new Date(inAt.getFullYear(), inAt.getMonth(), inAt.getDate());
    end.setMinutes(endMins);
    const due = new Date(end.getTime() + GRACE_AFTER_SHIFT_MS);
    // Starting a shift after the rostered hours are over leaves nothing to
    // count from, so those hours fall under the unrostered rule instead.
    if (due > inAt) return due;
  }
  return new Date(inAt.getTime() + MAX_UNROSTERED_MS);
}

// Clocking exists to price an hourly shift. Full-time pay is the same figure
// whatever the hours, so there is nothing for a time card to decide.
async function requireHourly(gymId, staffId) {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    select: { firstName: true, lastName: true, employmentType: true, isActive: true },
  });
  if (!staff) return { ok: false, status: 404, error: 'Staff not found' };
  const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'This staff member';
  // A deactivated account cannot start a shift or have one entered for it. A
  // shift already running when they were deactivated can still be clocked out.
  if (!staff.isActive) {
    return { ok: false, status: 403, error: `${name}'s account is deactivated, so they cannot be clocked in.` };
  }
  if (staff.employmentType !== 'Part Time') {
    return {
      ok: false,
      status: 400,
      error: `${name} is full time, so there is no need to clock in or out. Only part-time staff are clocked.`,
    };
  }
  return { ok: true };
}

// Problems are gathered on the card as the shift runs and only raised once it
// closes, so one finished shift produces one review naming everything at once.
// Arriving late or leaving early costs time rather than adding it, so nothing
// waits for approval. Management is told instead.
const NOTICE_TITLES = { late_in: 'Late Arrival', early_out: 'Left Early' };
async function tellManagers(gymId, card, notices) {
  if (!notices?.length) return;
  const name = fullName(card.staff);
  await Promise.all(notices.map(n => prisma.notification.create({
    data: {
      gymId,
      title: NOTICE_TITLES[n.code] || 'Attendance',
      body: `${name}: ${n.message}`,
      type: 'system',
      link: `/staff/${card.staffId}?tab=pay`,
      audience: 'managers',
      aboutStaffId: card.staffId,
    },
  })));
}
const quiet = (label) => (err) => { console.error(`${label} failed:`, err.message); return ({ issues: [], notices: [] }); };

const asIssues = (card) => (Array.isArray(card?.issues) ? card.issues : []);

function addIssue(card, code, message) {
  const kept = asIssues(card).filter(i => i.code !== code);
  return [...kept, { code, message }];
}

// One card a day per person. Two desks clocking someone in at the same moment
// both found none and both wrote one; in a serializable transaction the
// database refuses the second, and looking again finds the card that won.
async function createDayCard({ gymId, staffId, dayStart, dayEnd, data }) {
  const sameDay = { gymId, staffId, date: { gte: dayStart, lte: dayEnd } };
  try {
    return await serializable(async (tx) => {
      const existing = await tx.timeCard.findFirst({ where: sameDay });
      if (existing) return { existing };
      return { card: await tx.timeCard.create({ data, include: CARD_INCLUDE }) };
    });
  } catch (err) {
    const existing = await prisma.timeCard.findFirst({ where: sameDay });
    if (existing) return { existing };
    throw err;
  }
}

async function punchIn(req, res) {
  const { staffId, date } = req.body;
  if (!staffId) return res.status(400).json({ error: 'staffId is required' });

  const targetDate = date ? new Date(date) : new Date();
  const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

  const hourly = await requireHourly(req.user.gymId, staffId);
  if (!hourly.ok) return res.status(hourly.status).json({ error: hourly.error });

  const existing = await prisma.timeCard.findFirst({
    where: { gymId: req.user.gymId, staffId, date: { gte: dayStart, lte: dayEnd } },
  });
  if (existing) return res.status(409).json({ error: 'Already punched in for this date', timecard: existing });

  const now = new Date();
  const claimed = timeOnDay(dayStart, req.body.at);
  // A time typed in by the operator is a claim, the same as an edited clock-out
  const handSet = claimed !== undefined && Math.abs(claimed - now) > 60 * 1000;
  const at = handSet ? claimed : now;

  const inCheck = await clockInCheck({ gymId: req.user.gymId, staffId, when: at }).catch(quiet('Schedule check'));
  const issues = [...inCheck.issues];
  if (handSet) {
    issues.push({ code: 'adjusted', message: `Clock-in time was set by hand to ${timeLabel(at)}.` });
  }

  const made = await createDayCard({
    gymId: req.user.gymId, staffId, dayStart, dayEnd,
    data: {
      gymId: req.user.gymId,
      staffId,
      date: dayStart,
      punchIn: at,
      ...(issues.length ? {
        approvalStatus: 'pending',
        issues,
        ...(handSet ? { originalPunchIn: now } : {}),
        adjustmentNote: req.body.note || null,
      } : {}),
    },
  });
  if (made.existing) return res.status(409).json({ error: 'Already punched in for this date', timecard: made.existing });
  const { card } = made;

  logActivity(req, {
    category: 'timecards', action: 'timecard.clock_in',
    summary: handSet
      ? `Clocked in ${fullName(card.staff)} at ${timeLabel(at)}, a time entered by hand at ${timeLabel(now)}`
      : `Clocked in ${fullName(card.staff)} at ${timeLabel(at)}`,
    target: { type: 'staff', id: staffId },
    ...(issues.length ? { details: { issues: issues.map(i => i.message) } } : {}),
  });

  tellManagers(req.user.gymId, card, inCheck.notices).catch(err => console.error('Attendance notice failed:', err.message));

  // No task yet: the shift is still running, and more may go wrong before it ends.
  res.status(201).json(card);
}

async function punchOut(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });
  if (existing.punchOut) return res.status(409).json({ error: 'Already punched out' });

  const now = new Date();
  const claimed = timeOnDay(existing.date, req.body?.at);
  const handSet = claimed !== undefined && Math.abs(claimed - now) > 60 * 1000;
  const at = endOfShift(existing.punchIn, handSet ? claimed : now);

  const invalid = outOfOrder(existing.punchIn, at);
  if (invalid) return res.status(400).json({ error: invalid });

  let issues = asIssues(existing);
  if (handSet) {
    issues = addIssue({ issues }, 'adjusted', `Clock-out time was set by hand to ${timeLabel(at)}.`);
  }
  const outCheck = await clockOutCheck({ gymId: req.user.gymId, staffId: existing.staffId, punchIn: existing.punchIn, punchOut: at }).catch(quiet('Schedule check'));
  for (const i of outCheck.issues) issues = addIssue({ issues }, i.code, i.message);

  const card = await prisma.timeCard.update({
    where: { id: req.params.id },
    data: {
      punchOut: at,
      ...(issues.length ? {
        approvalStatus: 'pending',
        issues,
        ...(handSet && existing.originalPunchOut === null ? { originalPunchOut: now } : {}),
        adjustmentNote: req.body?.note || existing.adjustmentNote,
      } : {}),
    },
    include: CARD_INCLUDE,
  });

  logActivity(req, {
    category: 'timecards', action: 'timecard.clock_out',
    summary: handSet
      ? `Clocked out ${fullName(card.staff)} at ${timeLabel(at)}, a time entered by hand at ${timeLabel(now)}`
      : `Clocked out ${fullName(card.staff)} at ${timeLabel(at)}`,
    target: { type: 'staff', id: card.staffId },
    ...(issues.length ? { details: { issues: issues.map(i => i.message) } } : {}),
  });

  tellManagers(req.user.gymId, card, outCheck.notices).catch(err => console.error('Attendance notice failed:', err.message));

  // The shift is closed, so now everything wrong with it can be raised at once
  if (issues.length) {
    raiseApprovalTasks({ gymId: req.user.gymId, card })
      .catch(err => console.error('Raising time review failed:', err.message));
  }
  res.json(card);
}

async function createManual(req, res) {
  const { staffId, date, punchIn: punchInTime, punchOut: punchOutTime } = req.body;
  if (!staffId || !date || !punchInTime) return res.status(400).json({ error: 'staffId, date, and punchIn are required' });

  const hourly = await requireHourly(req.user.gymId, staffId);
  if (!hourly.ok) return res.status(hourly.status).json({ error: hourly.error });

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const punchInDt = timeOnDay(dayStart, punchInTime) ?? null;
  const punchOutDt = endOfShift(timeOnDay(dayStart, punchInTime), timeOnDay(dayStart, punchOutTime)) ?? null;
  if (!punchInDt) return res.status(400).json({ error: 'punchIn must be a time like 09:00' });

  const invalid = outOfOrder(punchInDt, punchOutDt);
  if (invalid) return res.status(400).json({ error: invalid });

  const inCheck = await clockInCheck({ gymId: req.user.gymId, staffId, when: punchInDt }).catch(quiet('Schedule check'));
  const outCheck = await clockOutCheck({ gymId: req.user.gymId, staffId, punchIn: punchInDt, punchOut: punchOutDt }).catch(quiet('Schedule check'));
  const issues = [...inCheck.issues, ...outCheck.issues];
  issues.push({ code: 'adjusted', message: 'This whole card was entered by hand.' });

  const card = await prisma.timeCard.create({
    data: {
      gymId: req.user.gymId,
      staffId,
      date: dayStart,
      punchIn: punchInDt,
      punchOut: punchOutDt,
      approvalStatus: 'pending',
      issues,
    },
    include: CARD_INCLUDE,
  });

  logActivity(req, {
    category: 'timecards', action: 'timecard.manual',
    summary: `Entered a time card by hand for ${fullName(card.staff)} on ${dayLabel(dayStart)}: ${timeLabel(punchInDt)} to ${punchOutDt ? timeLabel(punchOutDt) : 'still open'}`,
    target: { type: 'staff', id: staffId },
  });

  tellManagers(req.user.gymId, card, [...inCheck.notices, ...outCheck.notices]).catch(err => console.error('Attendance notice failed:', err.message));

  // A card typed in complete is already closed, so raise its review now
  if (punchOutDt) {
    raiseApprovalTasks({ gymId: req.user.gymId, card })
      .catch(err => console.error('Raising time review failed:', err.message));
  }
  res.status(201).json(card);
}

// The approval has to land before the money does, so it is due the day before
// that staff member's next pay day. Their own pay day wins over the gym default.
function approvalDueDate(payDay, from = new Date()) {
  const day = Number(payDay);
  if (!Number.isFinite(day) || day < 1) return null;
  const startOfToday = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const inMonth = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));

  let payDate = inMonth(from.getFullYear(), from.getMonth());
  let due = new Date(payDate); due.setDate(due.getDate() - 1);
  if (due < startOfToday) {
    payDate = inMonth(from.getFullYear(), from.getMonth() + 1);
    due = new Date(payDate); due.setDate(due.getDate() - 1);
  }
  return due;
}

// A time card has at most one open review, covering every problem found on it.
// The task belongs to management as a group: everyone in it sees the task and
// any one of them can act on it.
const REVIEW_GROUP = 'management';

async function raiseApprovalTasks({ gymId, card }) {
  const issues = asIssues(card);
  if (issues.length === 0) return null;

  const [gym, staff] = await Promise.all([
    prisma.gym.findUnique({ where: { id: gymId }, select: { payDay: true } }),
    prisma.staff.findUnique({ where: { id: card.staffId }, select: { firstName: true, lastName: true, payDay: true } }),
  ]);

  const name = `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim() || 'A staff member';
  const dueDate = approvalDueDate(staff?.payDay ?? gym?.payDay);
  const onDate = new Date(card.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const worked = card.punchIn && card.punchOut
    ? ` The shift ran ${timeLabel(card.punchIn)} to ${timeLabel(card.punchOut)}.`
    : '';

  const body = [
    `${name}'s shift on ${onDate} needs checking.`,
    ...issues.map(i => i.message),
    card.adjustmentNote ? `Reason given: ${card.adjustmentNote}` : null,
    `${worked.trim()} Review it on their profile under Time Log.`.trim(),
  ].filter(Boolean).join(' ');
  const title = `Review time card : ${name}, ${onDate}`;

  const open = await prisma.task.findFirst({
    where: { gymId, timeCardId: card.id, status: { not: 'done' } },
  });
  const task = open
    ? await prisma.task.update({ where: { id: open.id }, data: { title, description: body, dueDate } })
    : await prisma.task.create({
      data: {
        gymId,
        title,
        description: body,
        priority: 'high',
        status: 'todo',
        category: 'Attendance',
        dueDate,
        assignedGroup: REVIEW_GROUP,
        createdBySystem: true,
        timeCardId: card.id,
      },
    });

  if (!open) {
    const managers = await prisma.staff.findMany({
      where: { gymId, isActive: true, role: { in: MANAGER_ROLES } },
      select: { id: true, email: true, firstName: true },
    });
    await Promise.all(managers.map(m => prisma.notification.create({
      data: {
        gymId,
        staffId: m.id,
        title: 'Time Card Needs Review',
        body,
        type: 'task',
        link: `/staff/${card.staffId}?tab=pay`,
      },
    }).catch(logFailure('Time card review notification'))));

    sendGroupTaskEmail({ task, recipients: managers, gymId })
      .catch(err => console.error('Review task email failed:', err.message));
  }
  return task;
}

// Closing the review when the card is dealt with, so it does not sit open once
// the question it asked has been answered.
async function closeReviewTask(gymId, timeCardId, note) {
  await prisma.task.updateMany({
    where: { gymId, timeCardId, status: { not: 'done' } },
    data: { status: 'done', notes: note || undefined },
  });
}

// Hours worked can never be negative: a shift cannot end before it started.
function outOfOrder(punchIn, punchOut) {
  if (!punchIn || !punchOut) return null;
  if (new Date(punchOut) > new Date(punchIn)) return null;
  const at = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Check-out (${at(punchOut)}) cannot be at or before check-in (${at(punchIn)}).`;
}

// A shift that runs past midnight ends on the following day. The clock time
// alone cannot say so - 00:30 after a 22:00 start is a later moment, not an
// earlier one - so a check-out that lands at or before the check-in is rolled
// forward a day rather than refused. Anything beyond a day apart is a mistake,
// not a night shift, and is left to be refused.
const DAY_MS = 86400000;
function endOfShift(punchIn, punchOut) {
  if (!punchIn || !punchOut) return punchOut;
  const start = new Date(punchIn);
  const end = new Date(punchOut);
  if (end > start) return end;
  const rolled = new Date(end.getTime() + DAY_MS);
  return rolled - start <= DAY_MS ? rolled : end;
}

// 'HH:MM' against a card's own date. undefined means "leave it alone". A
// 12-hour time ("02:30 PM") is read as the clock means it: reading only the
// digits stored every afternoon time written that way twelve hours early.
function timeOnDay(date, hhmm) {
  const m = /^(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?[Mm]\.?)?/.exec(String(hhmm || '').trim());
  if (!m) return undefined;
  let hours = Number(m[1]);
  if (m[3]) hours = (hours % 12) + (/p/i.test(m[3]) ? 12 : 0);
  const d = new Date(date);
  d.setHours(hours, Number(m[2]), 0, 0);
  return d;
}

// A time typed in by hand is a claim, not a fact. It joins the card's list of
// problems; the review is raised once the shift is closed.
async function adjust(req, res) {
  const { punchIn: punchInTime, punchOut: punchOutTime, note } = req.body;
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });

  const nextIn = timeOnDay(existing.date, punchInTime);
  // A check-out typed for a night shift is the next morning, as on clocking out
  const typedOut = timeOnDay(existing.date, punchOutTime);
  const nextOut = typedOut === undefined ? undefined : endOfShift(nextIn ?? existing.punchIn, typedOut);
  if (nextIn === undefined && nextOut === undefined) {
    return res.status(400).json({ error: 'A punchIn or punchOut time is required' });
  }

  const data = { approvalStatus: 'pending', approvedById: null, approvedAt: null };
  if (nextIn !== undefined) data.punchIn = nextIn;
  if (nextOut !== undefined) data.punchOut = nextOut;

  const invalid = outOfOrder(data.punchIn ?? existing.punchIn, data.punchOut ?? existing.punchOut);
  if (invalid) return res.status(400).json({ error: invalid });

  // Capture the times as first recorded, once, so rejecting can put them back
  if (nextIn !== undefined && existing.originalPunchIn === null) data.originalPunchIn = existing.punchIn;
  if (nextOut !== undefined && existing.originalPunchOut === null) data.originalPunchOut = existing.punchOut;
  if (note !== undefined) data.adjustmentNote = note || null;

  const changed = [
    nextIn !== undefined ? `in to ${timeLabel(nextIn)}` : null,
    nextOut !== undefined ? `out to ${timeLabel(nextOut)}` : null,
  ].filter(Boolean).join(' and ');
  data.issues = addIssue(existing, 'adjusted', `Times were changed by hand: ${changed}.`);

  const card = await prisma.timeCard.update({
    where: { id: req.params.id },
    data,
    include: CARD_INCLUDE,
  });

  logActivity(req, {
    category: 'timecards', action: 'timecard.adjusted',
    summary: `Changed ${fullName(card.staff)}'s times on ${dayLabel(card.date)}: ${changed}`,
    target: { type: 'staff', id: card.staffId },
    ...(note ? { details: { note } } : {}),
  });

  // Only raise it once the shift is closed. An open shift waits for its punch-out.
  if (card.punchOut) {
    raiseApprovalTasks({ gymId: req.user.gymId, card })
      .catch(err => console.error('Raising time review failed:', err.message));
  }
  res.json(card);
}

// Nobody signs off their own card while another manager could do it. A gym with
// a single manager would otherwise have no way to ever approve one.
async function canReview(user, card) {
  if (!MANAGER_ROLES.includes(user.role)) {
    return { ok: false, status: 403, error: 'Only a manager can review a time card.' };
  }
  // The owner answers to nobody in the gym, so their own card is theirs to sign
  // off. A manager still needs someone else to do it, unless there is nobody.
  if (String(card.staffId) === String(user.id)) {
    if (user.role !== 'general_manager') {
      const others = await prisma.staff.count({
        where: { gymId: user.gymId, isActive: true, role: { in: MANAGER_ROLES }, NOT: { id: user.id } },
      });
      if (others > 0) {
        return { ok: false, status: 403, error: 'Another manager has to review your own time card.' };
      }
    }
  } else {
    // Someone else's card is only yours to sign off if you outrank them
    const owner = await prisma.staff.findUnique({ where: { id: card.staffId }, select: { role: true } });
    if (!owner || rankOf(user.role) <= rankOf(owner.role)) {
      return { ok: false, status: 403, error: 'Only someone more senior can review this time card.' };
    }
  }
  if (card.approvalStatus !== 'pending') {
    return { ok: false, status: 409, error: 'This time card is not awaiting approval.' };
  }
  return { ok: true };
}

// A manager reviewing a card may correct the times as they accept it.
async function approve(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });
  const allowed = await canReview(req.user, existing);
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error });

  const data = {
    approvalStatus: 'approved',
    issues: [],
    approvedById: req.user.id,
    approvedAt: new Date(),
  };
  const nextIn = timeOnDay(existing.date, req.body.punchIn);
  const typedOut = timeOnDay(existing.date, req.body.punchOut);
  const nextOut = typedOut === undefined ? undefined : endOfShift(nextIn ?? existing.punchIn, typedOut);
  if (nextIn !== undefined) data.punchIn = nextIn;
  if (nextOut !== undefined) data.punchOut = nextOut;

  const invalid = outOfOrder(data.punchIn ?? existing.punchIn, data.punchOut ?? existing.punchOut);
  if (invalid) return res.status(400).json({ error: invalid });

  const card = await prisma.timeCard.update({
    where: { id: req.params.id },
    data,
    include: CARD_INCLUDE,
  });
  const corrected = nextIn !== undefined || nextOut !== undefined;
  logActivity(req, {
    category: 'timecards', action: 'timecard.approved',
    summary: `Accepted ${fullName(card.staff)}'s time card for ${dayLabel(card.date)}${corrected ? `, with the times set to ${timeLabel(card.punchIn)} to ${card.punchOut ? timeLabel(card.punchOut) : 'open'}` : ''}`,
    target: { type: 'staff', id: card.staffId },
    ...(req.body.note ? { details: { note: req.body.note } } : {}),
  });
  closeReviewTask(req.user.gymId, card.id, req.body.note || 'Accepted.')
    .catch(err => console.error('Closing review task failed:', err.message));
  res.json(card);
}

// Rejecting an adjustment puts the original times back. Rejecting a shift that
// was never rostered leaves the times alone but stops the hours counting.
async function reject(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });
  const allowed = await canReview(req.user, existing);
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error });

  const hadEdit = existing.originalPunchIn !== null || existing.originalPunchOut !== null;
  const data = {
    issues: [],
    approvedById: req.user.id,
    approvedAt: new Date(),
    adjustmentNote: req.body.note || existing.adjustmentNote,
  };
  if (hadEdit) {
    data.approvalStatus = 'approved';
    if (existing.originalPunchIn !== null) data.punchIn = existing.originalPunchIn;
    if (existing.originalPunchOut !== null) data.punchOut = existing.originalPunchOut;
    data.originalPunchIn = null;
    data.originalPunchOut = null;
  } else {
    data.approvalStatus = 'rejected';
  }

  const card = await prisma.timeCard.update({
    where: { id: req.params.id },
    data,
    include: CARD_INCLUDE,
  });
  logActivity(req, {
    category: 'timecards', action: 'timecard.rejected',
    summary: hadEdit
      ? `Rejected the changes to ${fullName(card.staff)}'s time card for ${dayLabel(card.date)} and put the original times back`
      : `Rejected ${fullName(card.staff)}'s time card for ${dayLabel(card.date)}, so its hours will not be paid`,
    target: { type: 'staff', id: card.staffId },
    ...(req.body.note ? { details: { note: req.body.note } } : {}),
  });
  closeReviewTask(req.user.gymId, card.id, req.body.note || 'Rejected.')
    .catch(err => console.error('Closing review task failed:', err.message));
  res.json(card);
}

async function remove(req, res) {
  const existing = await prisma.timeCard.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    include: { staff: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Time card not found' });

  await prisma.timeCard.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'timecards', action: 'timecard.deleted',
    summary: `Deleted ${fullName(existing.staff)}'s time card for ${dayLabel(existing.date)}`,
    target: { type: 'staff', id: existing.staffId },
  });
  res.json({ message: 'Time card deleted' });
}

// A part-time front desk employee is clocked in when she signs in (to GEM, or
// at the desk with her code) and clocked out when she generates the end of day
// report. Clocking in by hand still works; these only act when nothing has
// been recorded yet, so nobody is clocked twice.
async function deskStaff(gymId, staffId) {
  if (!staffId) return null;
  const s = await prisma.staff.findFirst({
    where: { id: String(staffId), gymId },
    select: { id: true, firstName: true, lastName: true, role: true, employmentType: true, isActive: true },
  });
  return s && s.isActive && s.role === 'front_desk' && s.employmentType === 'Part Time' ? s : null;
}

const todayRange = () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  return { start, end };
};

async function autoClockIn({ gymId, staffId, via }) {
  const s = await deskStaff(gymId, staffId);
  if (!s) return null;
  const { start, end } = todayRange();
  // One card a day: already clocked in, by hand or earlier, or already done for today
  const existing = await prisma.timeCard.findFirst({ where: { gymId, staffId: s.id, date: { gte: start, lte: end } }, select: { id: true } });
  if (existing) return null;

  const now = new Date();
  const inCheck = await clockInCheck({ gymId, staffId: s.id, when: now }).catch(quiet('Schedule check'));
  const issues = inCheck.issues;
  const { card } = await createDayCard({
    gymId, staffId: s.id, dayStart: start, dayEnd: end,
    data: {
      gymId, staffId: s.id, date: start, punchIn: now,
      ...(issues.length ? { approvalStatus: 'pending', issues } : {}),
    },
  });
  if (!card) return null;
  logActivity(null, {
    gymId, actor: { id: s.id, name: fullName(s), role: s.role },
    category: 'timecards', action: 'timecard.auto_clock_in',
    summary: via === 'prompt'
      ? `Checked in at ${timeLabel(now)}, when the front desk asked on signing in`
      : `Clocked in automatically at ${timeLabel(now)} on ${via === 'login' ? 'signing in to GEM' : 'opening the front desk'}`,
    target: { type: 'staff', id: s.id },
    ...(issues.length ? { details: { issues: issues.map(i => i.message) } } : {}),
  });
  tellManagers(gymId, card, inCheck.notices).catch(err => console.error('Attendance notice failed:', err.message));
  return card;
}

async function autoClockOut({ gymId, staffId, req }) {
  const s = await deskStaff(gymId, staffId);
  if (!s) return null;
  const { start } = todayRange();
  const open = await prisma.timeCard.findFirst({
    where: { gymId, staffId: s.id, punchOut: null, date: { gte: start } },
    orderBy: { punchIn: 'desc' },
  });
  if (!open) return null;
  const now = new Date();
  if (outOfOrder(open.punchIn, now)) return null;

  let issues = asIssues(open);
  const outCheck = await clockOutCheck({ gymId, staffId: s.id, punchIn: open.punchIn, punchOut: now }).catch(quiet('Schedule check'));
  for (const i of outCheck.issues) issues = addIssue({ issues }, i.code, i.message);
  const card = await prisma.timeCard.update({
    where: { id: open.id },
    data: { punchOut: now, ...(issues.length ? { approvalStatus: 'pending', issues } : {}) },
    include: CARD_INCLUDE,
  });
  tellManagers(gymId, card, outCheck.notices).catch(err => console.error('Attendance notice failed:', err.message));
  if (issues.length) {
    raiseApprovalTasks({ gymId, card }).catch(err => console.error('Raising time review failed:', err.message));
  }
  logActivity(req, {
    category: 'timecards', action: 'timecard.auto_clock_out',
    summary: `Checked out ${fullName(s)} at ${timeLabel(now)} after the end of day report, when asked`,
    target: { type: 'staff', id: s.id },
  });
  return card;
}

// Where someone's shift stands today, so the desk can offer to start or end it.
// Only a part-time front desk employee works on the clock.
async function shiftStatus(req, res) {
  const s = await deskStaff(req.user.gymId, String(req.query.staffId || req.user.id));
  if (!s) return res.json({ clockable: false });
  const { start, end } = todayRange();
  const card = await prisma.timeCard.findFirst({
    where: { gymId: req.user.gymId, staffId: s.id, date: { gte: start, lte: end } },
    orderBy: { punchIn: 'desc' },
    select: { id: true, punchIn: true, punchOut: true },
  });
  res.json({
    clockable: true, staffId: s.id, name: fullName(s),
    state: !card ? 'none' : card.punchOut ? 'done' : 'in',
    punchIn: card?.punchIn || null, punchOut: card?.punchOut || null,
  });
}

// The desk asked on signing in and they chose to check in
async function startShift(req, res) {
  const card = await autoClockIn({ gymId: req.user.gymId, staffId: String(req.body?.staffId || req.user.id), via: 'prompt' });
  if (!card) return res.status(409).json({ error: 'There is no shift to start: already checked in today, or not on hourly time.' });
  res.status(201).json({ id: card.id, punchIn: card.punchIn, approvalStatus: card.approvalStatus });
}

// After the end of day report, when they choose to check out. Clocks out the
// person working the desk, and the signed-in account if that is someone else.
async function endOfDay(req, res) {
  const ids = [...new Set([req.body?.staffId, req.user.id].filter(Boolean).map(String))];
  const clockedOut = [];
  for (const id of ids) {
    try {
      const card = await autoClockOut({ gymId: req.user.gymId, staffId: id, req });
      if (card) clockedOut.push({ staffId: id, name: fullName(card.staff), at: card.punchOut });
    } catch (err) {
      console.error(`End of day clock-out failed for ${id}:`, err.message);
    }
  }
  res.json({ clockedOut });
}

module.exports = { shiftStatus, startShift, getAll, punchIn, punchOut, createManual, adjust, approve, reject, remove, raiseApprovalTasks, autoClockIn, endOfDay };
