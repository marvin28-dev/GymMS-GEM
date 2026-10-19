const prisma = require('../utils/prisma');
const { logActivity, fullName } = require('../utils/activityLog');
const { membershipEnded } = require('../utils/membership');
const { sendCoachIntro } = require('../utils/memberEmail');

// The coach's side of the gym: who they train, what they are working towards,
// what they have on today, and the progress they record. Everything is read
// for the signed-in coach; money (a member's balance or payments) is never part of it.

const FITNESS = ['trainer', 'instructor', 'coach'];
const MANAGEMENT = ['general_manager', 'manager'];
const isFitness = (role) => FITNESS.includes(role);
const isManagement = (role) => MANAGEMENT.includes(role);
const parseIds = (raw) => { try { return JSON.parse(raw || '[]').map(String); } catch { return []; } };
const DAY_MS = 86400000;
const endedMessage = (m) => `${fullName(m)}'s membership has ended. Their progress can be recorded again once it is renewed.`;

// The gym's local day, week (from Monday) and month, from the browser's offset
function localWindows(query) {
  const tz = Math.max(-840, Math.min(840, Number(query.tz) || 0));
  const nowLocal = new Date(Date.now() - tz * 60000);
  const y = nowLocal.getUTCFullYear(), m = nowLocal.getUTCMonth(), d = nowLocal.getUTCDate();
  const dayStart = new Date(Date.UTC(y, m, d) + tz * 60000);
  const monthStart = new Date(Date.UTC(y, m, 1) + tz * 60000);
  const weekStart = new Date(dayStart.getTime() - ((nowLocal.getUTCDay() + 6) % 7) * DAY_MS);
  const today = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { tz, today, dayStart, dayEnd: new Date(dayStart.getTime() + DAY_MS), monthStart, weekStart };
}

const GOAL_FIELDS = { goalType: true, goalWeight: true, goalWaist: true, goalBodyFat: true, goalSessionsPerWeek: true, goalTargetDate: true, goalNote: true, goalSetAt: true };
const CLIENT_SELECT = {
  id: true, memberCode: true, firstName: true, lastName: true, photo: true, avatarColor: true,
  phone: true, email: true, dob: true, status: true, isVisitor: true, startDate: true, endDate: true,
  lastVisit: true, passesRemaining: true, dayPasses: true, coachId: true,
  package: { select: { id: true, name: true } },
  ...GOAL_FIELDS,
};

// ── Goals and measurements, checked once for every way they come in ─────────
const GOAL_TYPES = ['lose_weight', 'build_muscle', 'get_fit', 'tone', 'endurance', 'other'];
const MEASURE_FIELDS = ['weight', 'bodyFat', 'waist', 'hips', 'chest'];
const LABEL = { weight: 'weight', bodyFat: 'body fat', waist: 'waist', hips: 'hips', chest: 'chest' };
const num = (v) => (v === undefined || v === null || v === '' ? null : Math.round(Number(v) * 10) / 10);

// Measurements from a body: { values } or { error, field }. Any figure above
// zero is taken: the coach writes down what they measured, with no ranges.
function readMeasures(body, required = [], prefix = '') {
  const values = {};
  for (const field of MEASURE_FIELDS) {
    const n = num(body?.[field]);
    if (n == null) {
      if (required.includes(field)) return { error: `Enter the current ${LABEL[field]}.`, field: prefix + field };
      continue;
    }
    if (!Number.isFinite(n) || n <= 0) return { error: `The ${LABEL[field]} must be a number above 0.`, field: prefix + field };
    values[field] = n;
  }
  return { values };
}

// Goals from a body: { data, error }
function readGoals(g) {
  if (!g || typeof g !== 'object') return { error: 'Set the member’s goals.', field: 'goalType' };
  const type = String(g.goalType || '');
  if (!GOAL_TYPES.includes(type)) return { error: 'Choose what the member is working towards.', field: 'goalType' };
  const weight = num(g.goalWeight), waist = num(g.goalWaist), fat = num(g.goalBodyFat);
  if (weight == null || !(weight > 0)) return { error: 'Enter the goal weight.', field: 'goalWeight' };
  if (waist == null || !(waist > 0)) return { error: 'Enter the goal waist size.', field: 'goalWaist' };
  if (fat != null && !(fat > 0)) return { error: 'The goal body fat must be a number above 0.', field: 'goalBodyFat' };
  const perWeek = Math.round(Number(g.goalSessionsPerWeek));
  if (!Number.isFinite(perWeek) || perWeek < 1 || perWeek > 14) return { error: 'Choose how many sessions a week.', field: 'goalSessionsPerWeek' };
  let target = null;
  if (g.goalTargetDate) {
    target = new Date(`${String(g.goalTargetDate).slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(target.getTime())) return { error: 'The target date is not valid.', field: 'goalTargetDate' };
    if (target.getTime() < Date.now()) return { error: 'The target date must be in the future.', field: 'goalTargetDate' };
  }
  const note = String(g.goalNote || '').trim();
  if (note.length > 500) return { error: 'Keep the goal notes under 500 characters.', field: 'goalNote' };
  return { data: { goalType: type, goalWeight: weight, goalWaist: waist, goalBodyFat: fat, goalSessionsPerWeek: perWeek, goalTargetDate: target, goalNote: note || null, goalSetAt: new Date() } };
}

// Everyone a coach trains, with what their coach needs to judge how they are
// doing: their goals, the measurements they started from and the latest ones,
// how often they came in over the last two weeks and this month, and whether
// this week's check-in has been taken.
async function clientRows(gymId, coachId, win) {
  const { monthStart, weekStart } = win;
  const clients = await prisma.member.findMany({
    where: { gymId, coachId, status: { not: 'deactivated' } },
    select: CLIENT_SELECT,
    orderBy: { firstName: 'asc' },
  });
  const ids = clients.map(c => c.id);
  const twoWeeksAgo = new Date(Date.now() - 14 * DAY_MS);
  const visitsFrom = monthStart < twoWeeksAgo ? monthStart : twoWeeksAgo;
  const [visitRows, logs] = await Promise.all([
    ids.length ? prisma.attendance.findMany({ where: { gymId, memberId: { in: ids }, checkIn: { gte: visitsFrom } }, select: { memberId: true, checkIn: true } }) : [],
    ids.length ? prisma.progressLog.findMany({ where: { gymId, memberId: { in: ids } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], select: { memberId: true, kind: true, weight: true, bodyFat: true, waist: true, date: true } }) : [],
  ]);
  const visits = new Map();
  for (const v of visitRows) {
    const r = visits.get(v.memberId) || { month: 0, last14: 0, week: 0 };
    if (v.checkIn >= monthStart) r.month += 1;
    if (v.checkIn >= twoWeeksAgo) r.last14 += 1;
    if (v.checkIn >= weekStart) r.week += 1;
    visits.set(v.memberId, r);
  }
  const byMember = new Map();
  for (const l of logs) { const list = byMember.get(l.memberId) || []; list.push(l); byMember.set(l.memberId, list); }

  return clients.map(c => {
    const list = byMember.get(c.id) || [];
    const measures = list.filter(l => l.kind === 'measure');
    // The starting point: the first check-in from when the goals were set, else the first ever
    const baseline = (c.goalSetAt && measures.find(l => l.date >= new Date(c.goalSetAt.getTime() - 5 * 60000))) || measures[0] || null;
    const latest = measures[measures.length - 1] || null;
    const latestOf = (f) => { for (let i = measures.length - 1; i >= 0; i--) if (measures[i][f] != null) return measures[i][f]; return null; };
    const firstWeight = measures.find(l => l.weight != null)?.weight ?? null;
    const sessions = list.filter(l => l.kind === 'session');
    const v = visits.get(c.id) || { month: 0, last14: 0, week: 0 };
    return {
      ...c,
      ended: membershipEnded(c),
      visitsThisMonth: v.month, visitsLast14: v.last14, visitsThisWeek: v.week,
      firstWeight,
      latestWeight: latestOf('weight'), latestWeightAt: latest?.date || null,
      latestBodyFat: latestOf('bodyFat'), latestWaist: latestOf('waist'),
      baseline: baseline ? { weight: baseline.weight, waist: baseline.waist, bodyFat: baseline.bodyFat, date: baseline.date } : null,
      lastCheckIn: latest?.date || null,
      checkedInThisWeek: !!latest && latest.date >= weekStart,
      lastSession: sessions.length ? sessions[sessions.length - 1].date : null,
      sessionsThisMonth: sessions.filter(s => s.date >= monthStart).length,
      lastFollowUp: [...list].reverse().find(l => l.kind === 'followup')?.date || null,
    };
  });
}

// ── GET /api/coach/clients/:staffId ─────────────────────────────────────────
// A manager's view of one coach's clients (a coach may read their own)
async function coachClients(req, res) {
  const gymId = req.user.gymId;
  const staffId = String(req.params.staffId);
  if (!isManagement(req.user.role) && staffId !== String(req.user.id)) return res.status(403).json({ error: "Only a manager can see another coach's clients." });
  const coach = await prisma.staff.findFirst({ where: { id: staffId, gymId }, select: { id: true } });
  if (!coach) return res.status(404).json({ error: 'Staff not found' });
  const win = localWindows(req.query);
  const [clients, sessionsThisMonth] = await Promise.all([
    clientRows(gymId, staffId, win),
    prisma.progressLog.count({ where: { gymId, staffId, kind: 'session', date: { gte: win.monthStart } } }),
  ]);
  res.json({ clients, sessionsThisMonth });
}

// ── GET /api/coach/overview ─────────────────────────────────────────────────
async function overview(req, res) {
  try {
    const gymId = req.user.gymId;
    const me = req.user.id;
    const win = localWindows(req.query);
    const { today, dayStart, dayEnd, monthStart } = win;

    const [clients, sessionsThisMonth, todayVisits, events, card, openTasks, staff] = await Promise.all([
      clientRows(gymId, me, win),
      prisma.progressLog.count({ where: { gymId, staffId: me, kind: 'session', date: { gte: monthStart } } }),
      prisma.attendance.findMany({
        where: { gymId, memberId: { not: null }, checkIn: { gte: dayStart, lt: dayEnd } },
        orderBy: { checkIn: 'desc' },
        take: 60,
        select: { id: true, checkIn: true, kind: true, member: { select: { id: true, firstName: true, lastName: true, photo: true, avatarColor: true, memberCode: true, isVisitor: true, coachId: true } } },
      }),
      prisma.calendarEvent.findMany({
        where: { gymId, date: { gte: new Date(`${today}T00:00:00.000Z`), lt: new Date(new Date(`${today}T00:00:00.000Z`).getTime() + DAY_MS) } },
        orderBy: { time: 'asc' },
      }),
      prisma.timeCard.findFirst({ where: { gymId, staffId: me, punchIn: { gte: dayStart, lt: dayEnd } }, orderBy: { punchIn: 'desc' }, select: { punchIn: true, punchOut: true } }),
      prisma.task.count({ where: { gymId, status: { in: ['todo', 'in_progress'] }, eventId: null, OR: [{ assignedToId: me }, { assignedRole: req.user.role }] } }),
      prisma.staff.findUnique({ where: { id: me }, select: { firstName: true, lastName: true } }),
    ]);

    // Today's schedule: my own diary, what I booked, what I teach, and what I
    // was put on and have not turned down
    const myEvents = events.filter(e => (e.isPrivate ? String(e.createdById) === String(me)
      : String(e.createdById) === String(me) || String(e.instructorId) === String(me) || parseIds(e.staffIds).includes(String(me))));
    const answers = myEvents.length ? await prisma.task.findMany({
      where: { gymId, assignedToId: me, eventId: { in: myEvents.map(e => e.id) } },
      select: { eventId: true, status: true },
    }) : [];
    const answerOf = new Map(answers.map(a => [a.eventId, a.status]));
    const schedule = myEvents
      .map(e => ({
        id: e.id, title: e.title, time: e.time || null, duration: e.duration || null, location: e.location || null,
        spots: e.spots ?? null, color: e.color || null, isPrivate: e.isPrivate, category: e.category || null, memberId: e.memberId || null,
        leading: String(e.instructorId) === String(me),
        response: e.isPrivate || String(e.createdById) === String(me) ? 'accepted' : (answerOf.get(e.id) || (String(e.instructorId) === String(me) ? 'accepted' : 'todo')),
      }))
      .filter(e => e.response !== 'declined');

    res.json({
      today,
      weekStart: win.weekStart,
      coach: staff ? { firstName: staff.firstName, lastName: staff.lastName } : null,
      shift: card ? { since: card.punchIn, until: card.punchOut } : null,
      openTasks,
      sessionsThisMonth,
      clients,
      schedule,
      checkinsToday: todayVisits.filter(v => v.member).map(v => ({
        id: v.id, at: v.checkIn, kind: v.kind,
        member: { id: v.member.id, firstName: v.member.firstName, lastName: v.member.lastName, photo: v.member.photo, avatarColor: v.member.avatarColor, memberCode: v.member.memberCode, isVisitor: v.member.isVisitor },
        mine: String(v.member.coachId) === String(me),
      })),
    });
  } catch (err) {
    console.error('Coach overview failed:', err);
    res.status(500).json({ error: 'Could not load your dashboard. Try again.' });
  }
}

// Goals plus the measurements they start from, written together. The first
// time goals are set, the starting weight and waist are required.
async function saveGoals(tx, { member, body, actorId, gymId, requireBaseline }) {
  const m = readMeasures(body.baseline || {}, requireBaseline ? ['weight', 'waist'] : [], 'baseline.');
  if (m.error) return m;
  const goals = readGoals(body.goals || body);
  if (goals.error) return goals;
  await tx.member.update({ where: { id: member.id }, data: goals.data });
  if (Object.keys(m.values).length) {
    await tx.progressLog.create({ data: { gymId, memberId: member.id, staffId: actorId, kind: 'measure', ...m.values, note: 'Starting measurements' } });
  }
  return { ok: true };
}

// ── POST /api/coach/assign { memberId, coachId|null, goals?, baseline? } ────
// A coach may take a member who has no coach, or let their own client go. A
// manager may give a member to any coach, move them, or take the coach away.
// A coach taking someone on sets their goals and starting measurements in the
// same step; a manager's assignment leaves that to the coach.
async function assign(req, res) {
  const { memberId } = req.body;
  const coachId = req.body.coachId || null;
  const role = req.user.role;
  if (!isFitness(role) && !isManagement(role)) return res.status(403).json({ error: 'Only a coach or a manager can do this.' });

  const member = await prisma.member.findFirst({ where: { gymId: req.user.gymId, OR: [{ id: memberId }, { memberCode: memberId }] }, include: { coach: { select: { id: true, firstName: true, lastName: true } } } });
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (isFitness(role)) {
    if (coachId && coachId !== req.user.id) return res.status(403).json({ error: 'You can only take a member on yourself. A manager assigns other coaches.' });
    if (coachId && member.coachId && member.coachId !== req.user.id) {
      return res.status(409).json({ error: `${fullName(member.coach)} already coaches ${fullName(member)}. Ask a manager to move them.` });
    }
    if (!coachId && member.coachId !== req.user.id) return res.status(403).json({ error: 'Only their own coach or a manager can remove a coach.' });
  }
  if (coachId && membershipEnded(member)) {
    return res.status(400).json({ error: `${fullName(member)}'s membership has ended. A coach can be given once it is renewed.` });
  }

  let coach = null;
  if (coachId) {
    coach = await prisma.staff.findFirst({ where: { id: coachId, gymId: req.user.gymId, isActive: true }, select: { id: true, firstName: true, lastName: true, role: true, email: true, phone: true } });
    if (!coach || !isFitness(coach.role)) return res.status(400).json({ error: 'Choose an active coach.' });
  }
  const changing = (member.coachId || null) !== coachId;
  const selfTakeOn = isFitness(role) && coachId === req.user.id && changing;
  const withGoals = !!coachId && (selfTakeOn || !!req.body.goals);
  const coachOut = coach && { id: coach.id, firstName: coach.firstName, lastName: coach.lastName };
  if (!changing && !withGoals) return res.json({ member: { id: member.id, coachId, coach: coachOut } });

  let refused = null;
  const updated = await prisma.$transaction(async (tx) => {
    if (withGoals) {
      const r = await saveGoals(tx, { member, body: req.body, actorId: req.user.id, gymId: req.user.gymId, requireBaseline: !member.goalSetAt || selfTakeOn });
      if (r.error) { refused = r; throw new Error('refused'); }
    }
    return tx.member.update({ where: { id: member.id }, data: { coachId }, select: { id: true, coachId: true, coach: { select: { id: true, firstName: true, lastName: true } }, ...GOAL_FIELDS } });
  }).catch(err => { if (refused) return null; throw err; });
  if (refused) return res.status(400).json({ error: refused.error, field: refused.field });

  if (changing) {
    logActivity(req, {
      category: 'members', action: coachId ? 'member.coach_assigned' : 'member.coach_removed',
      summary: coachId ? `${fullName(coach)} now coaches ${fullName(member)}` : `${fullName(member)} no longer has a coach (was ${fullName(member.coach)})`,
      target: { type: 'member', id: member.id },
    });
  }
  if (changing && coachId) {
    // A coach given a client by someone else hears about it
    if (coachId !== req.user.id) {
      await prisma.notification.create({
        data: { gymId: req.user.gymId, staffId: coachId, title: 'New client', body: `You now coach ${fullName(member)}. Set their goals and take their starting measurements.`, type: 'system', link: `/members/${member.id}` },
      }).catch(() => {});
    }
    // The member is told who their coach is and how to reach them
    sendCoachIntro(member, coach, req.user.gymId).catch(err => console.error('Coach intro email failed:', err.message));
  }
  res.json({ member: updated });
}

// ── PUT /api/coach/goals/:memberId { goals, baseline? } ─────────────────────
// Their own coach or a manager sets or changes what a member is working towards
async function setGoals(req, res) {
  const member = await prisma.member.findFirst({ where: { gymId: req.user.gymId, OR: [{ id: req.params.memberId }, { memberCode: req.params.memberId }] }, select: { id: true, firstName: true, lastName: true, status: true, isVisitor: true, endDate: true, coachId: true, goalSetAt: true } });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!isManagement(req.user.role) && String(member.coachId) !== String(req.user.id)) return res.status(403).json({ error: 'Only their coach or a manager can set their goals.' });
  if (isFitness(req.user.role) && membershipEnded(member)) return res.status(403).json({ error: endedMessage(member) });
  let refused = null;
  await prisma.$transaction(async (tx) => {
    const r = await saveGoals(tx, { member, body: req.body, actorId: req.user.id, gymId: req.user.gymId, requireBaseline: !member.goalSetAt });
    if (r.error) { refused = r; throw new Error('refused'); }
  }).catch(err => { if (!refused) throw err; });
  if (refused) return res.status(400).json({ error: refused.error, field: refused.field });
  const saved = await prisma.member.findUnique({ where: { id: member.id }, select: { id: true, ...GOAL_FIELDS } });
  logActivity(req, { category: 'members', action: 'member.goals_set', summary: `Set the goals for ${fullName(member)}`, target: { type: 'member', id: member.id } });
  res.json(saved);
}

// ── Progress log ─────────────────────────────────────────────────────────────
// followup: the coach got in touch about something on their follow-up list
const KINDS = ['session', 'measure', 'note', 'followup'];
const FOCUS = ['full_body', 'upper', 'lower', 'core', 'cardio', 'strength', 'mobility', 'technique'];
const EFFORT = ['easy', 'moderate', 'hard'];
const NOTE_CATEGORIES = ['general', 'injury', 'nutrition', 'motivation'];

async function listProgress(req, res) {
  const member = await prisma.member.findFirst({ where: { gymId: req.user.gymId, OR: [{ id: req.params.memberId }, { memberCode: req.params.memberId }] }, select: { id: true } });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const logs = await prisma.progressLog.findMany({
    where: { gymId: req.user.gymId, memberId: member.id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json(logs);
}

// Each kind records its own things: a session how long, what was worked and
// how hard; a measurement the figures; a note what it is about and the text.
async function addProgress(req, res) {
  const member = await prisma.member.findFirst({ where: { gymId: req.user.gymId, OR: [{ id: req.params.memberId }, { memberCode: req.params.memberId }] }, select: { id: true, firstName: true, lastName: true, status: true, isVisitor: true, endDate: true, coachId: true } });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (isFitness(req.user.role) && membershipEnded(member)) return res.status(403).json({ error: endedMessage(member) });

  const kind = String(req.body.kind || '');
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Choose a session, a measurement or a note.' });
  if (kind === 'followup' && String(member.coachId) !== String(req.user.id) && !isManagement(req.user.role)) {
    return res.status(403).json({ error: 'Only their coach can mark a client as followed up.' });
  }
  const data = { gymId: req.user.gymId, memberId: member.id, staffId: req.user.id, kind };
  const note = String(req.body.note || '').trim();
  if (note.length > 1000) return res.status(400).json({ error: 'Keep the note under 1000 characters.', field: 'note' });

  if (kind === 'session') {
    const minutes = Math.round(Number(req.body.durationMin));
    if (!Number.isFinite(minutes) || minutes < 1) return res.status(400).json({ error: 'Enter how long the session lasted, in minutes.', field: 'durationMin' });
    // The usual areas, plus anything the coach writes in under Other
    const focus = (Array.isArray(req.body.focus) ? req.body.focus : String(req.body.focus || '').split(','))
      .map(f => String(f).replace(/,/g, ' ').trim()).filter(Boolean);
    if (!focus.length) return res.status(400).json({ error: 'Choose what the session worked on.', field: 'focus' });
    if (focus.some(f => !FOCUS.includes(f) && f.length > 60)) return res.status(400).json({ error: 'Keep what you worked on under 60 characters.', field: 'focusOther' });
    const effort = String(req.body.effort || '');
    if (!EFFORT.includes(effort)) return res.status(400).json({ error: 'Choose how hard the session was.', field: 'effort' });
    Object.assign(data, { durationMin: minutes, focus: [...new Set(focus)].join(','), effort });
  } else if (kind === 'measure') {
    const m = readMeasures(req.body);
    if (m.error) return res.status(400).json({ error: m.error, field: m.field });
    if (!Object.keys(m.values).length) return res.status(400).json({ error: 'Enter at least one measurement.', field: 'weight' });
    Object.assign(data, m.values);
  } else if (kind === 'note') {
    const category = String(req.body.category || 'general');
    if (!NOTE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose what the note is about.', field: 'category' });
    if (!note) return res.status(400).json({ error: 'Write the note.', field: 'note' });
    data.category = category;
  }
  if (note) data.note = note;
  if (req.body.date) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date)) ? `${req.body.date}T12:00:00.000Z` : req.body.date);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'That date is not valid.' });
    if (d.getTime() > Date.now() + DAY_MS) return res.status(400).json({ error: 'The date cannot be in the future.' });
    data.date = d;
  }

  const log = await prisma.progressLog.create({ data, include: { staff: { select: { id: true, firstName: true, lastName: true } } } });
  logActivity(req, {
    category: 'members', action: `progress.${kind}`,
    summary: `${kind === 'session' ? 'Logged a session with' : kind === 'measure' ? 'Recorded measurements for' : kind === 'followup' ? 'Followed up with' : 'Added a coaching note for'} ${fullName(member)}`,
    target: { type: 'member', id: member.id },
  });
  res.status(201).json(log);
}

async function removeProgress(req, res) {
  const log = await prisma.progressLog.findFirst({ where: { id: req.params.id, gymId: req.user.gymId }, include: { member: { select: { firstName: true, lastName: true, status: true, isVisitor: true, endDate: true } } } });
  if (!log) return res.status(404).json({ error: 'Entry not found' });
  if (isFitness(req.user.role) && membershipEnded(log.member)) return res.status(403).json({ error: endedMessage(log.member) });
  if (log.staffId !== req.user.id && !isManagement(req.user.role)) return res.status(403).json({ error: 'Only whoever wrote it or a manager can remove it.' });
  await prisma.progressLog.delete({ where: { id: log.id } });
  res.json({ ok: true });
}

module.exports = { overview, coachClients, assign, setGoals, listProgress, addProgress, removeProgress };
