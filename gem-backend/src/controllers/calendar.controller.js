const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { refuseAssignees } = require('../utils/assignees');
const { logActivity } = require('../utils/activityLog');
const { membershipEnded, localNow, toMinutes } = require('../utils/membership');
const createId = () => crypto.randomBytes(12).toString('hex');

const parseStaffIds = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };
const FITNESS_ROLES = ['trainer', 'instructor', 'coach'];
const hhmm = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// When an entry starts and ends, in minutes into its day. The end is stored as
// an end time ("10:30"); some older entries say "45 min"; without one it runs an hour.
function spanOf(e) {
  const start = toMinutes(e.time);
  if (start == null) return { start: 0, end: 24 * 60, allDay: true };
  let end = toMinutes(e.duration);
  if (end == null || end <= start) {
    const mins = /(\d+)\s*min/i.exec(String(e.duration || ''));
    end = start + (mins ? Number(mins[1]) : 60);
  }
  return { start, end, allDay: false };
}

// Nothing is booked into a day or an hour that has already gone, in the
// booker's own time (tz is the browser's getTimezoneOffset)
function inThePast(date, time, tz) {
  const { today, minute } = localNow(tz);
  const day = String(date || '').slice(0, 10);
  if (day < today) return { error: 'That date has already passed. Choose today or a later day.', field: 'date' };
  const t = toMinutes(time);
  if (day === today && t != null && t <= minute) return { error: 'That time has already passed. Choose a later time.', field: 'startTime' };
  return null;
}

// A training session is with one of the coach's own clients whose membership is still running
async function refuseMember(req, memberId) {
  if (!memberId) return null;
  const m = await prisma.member.findFirst({ where: { id: memberId, gymId: req.user.gymId }, select: { firstName: true, lastName: true, coachId: true, status: true, isVisitor: true, endDate: true } });
  if (!m) return 'That member was not found.';
  if (FITNESS_ROLES.includes(req.user.role) && String(m.coachId) !== String(req.user.id)) return 'You can only book training with your own clients.';
  if (membershipEnded(m)) return `${m.firstName} ${m.lastName}'s membership has ended. Training can be booked once it is renewed.`;
  return null;
}

async function getAll(req, res) {
  const { date, month, year, mine } = req.query;
  const where = { gymId: req.user.gymId };

  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  } else if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    where.date = { gte: start, lt: end };
  }

  // A private entry belongs to whoever wrote it and is not part of the gym's
  // diary, so it never reaches anybody else.
  where.OR = [{ isPrivate: false }, { createdById: req.user.id }];

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: 'asc' },
  });

  // Everyone's response, for whoever booked the class to read off the roster.
  // Nothing here changes whether the event itself is shown - it appears on the
  // gym calendar no matter who has answered, or not yet.
  const publicIds = events.filter(e => !e.isPrivate).map(e => e.id);
  const responsesByEvent = new Map();
  if (publicIds.length) {
    const invites = await prisma.task.findMany({
      where: { eventId: { in: publicIds }, category: 'Calendar' },
      select: {
        eventId: true, assignedToId: true, status: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });
    for (const inv of invites) {
      const list = responsesByEvent.get(inv.eventId) || [];
      list.push({
        staffId: inv.assignedToId,
        name: `${inv.assignedTo?.firstName || ''} ${inv.assignedTo?.lastName || ''}`.trim(),
        status: inv.status === 'accepted' ? 'accepted' : inv.status === 'declined' ? 'declined' : 'pending',
      });
      responsesByEvent.set(inv.eventId, list);
    }
  }
  // Resolve the assigned staff names straight from the authoritative staffIds,
  // so a list of names and its count can never disagree - the response/task
  // records miss anyone invited on a legacy event or since deactivated, which
  // made the front desk show "3 people" over a single listed name.
  const allStaffIds = [...new Set(events.flatMap(e => parseStaffIds(e.staffIds).map(String)))];
  let staffById = new Map();
  if (allStaffIds.length) {
    const staff = await prisma.staff.findMany({
      where: { id: { in: allStaffIds }, gymId: req.user.gymId },
      select: { id: true, firstName: true, lastName: true },
    });
    staffById = new Map(staff.map(s => [String(s.id), `${s.firstName || ''} ${s.lastName || ''}`.trim()]));
  }

  const memberIds = [...new Set(events.map(e => e.memberId).filter(Boolean))];
  const members = memberIds.length ? await prisma.member.findMany({ where: { id: { in: memberIds }, gymId: req.user.gymId }, select: { id: true, firstName: true, lastName: true, photo: true, avatarColor: true } }) : [];
  const memberById = new Map(members.map(m => [m.id, m]));

  const withResponses = events.map(e => ({
    ...e,
    member: e.memberId ? memberById.get(e.memberId) || null : null,
    responses: responsesByEvent.get(e.id) || [],
    assignedStaff: parseStaffIds(e.staffIds)
      .map(id => ({ id: String(id), name: staffById.get(String(id)) || '' }))
      .filter(s => s.name),
  }));

  if (mine !== 'true' && mine !== '1') return res.json(withResponses);

  // A personal calendar: my own diary, classes I booked myself, and every gym
  // event I was put on - accepted, or still waiting for my answer (marked so
  // the screen can show it as not yet confirmed). Only a declined one is left off.
  const me = String(req.user.id);
  const mineFiltered = withResponses.map(e => {
    if (e.isPrivate) return String(e.createdById) === me ? { ...e, myResponse: 'accepted' } : null;
    if (String(e.createdById) === me) return { ...e, myResponse: 'accepted' };
    const onIt = String(e.instructorId) === me || parseStaffIds(e.staffIds).map(String).includes(me);
    if (!onIt) return null;
    const mine = e.responses.find(r => String(r.staffId) === me);
    if (mine?.status === 'declined') return null;
    return { ...e, myResponse: mine ? mine.status : 'accepted' };
  }).filter(Boolean);
  res.json(mineFiltered);
}

async function create(req, res) {
  const { title, date, time, duration, instructorId, staffIds, location, spots, color, description, repeat, repeatUntil, category, memberId, tz } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date are required' });
  const past = inThePast(date, time, tz);
  if (past) return res.status(400).json(past);
  const badMember = await refuseMember(req, memberId);
  if (badMember) return res.status(400).json({ error: badMember, field: 'memberId' });

  const ids = Array.isArray(staffIds) ? staffIds : (staffIds ? JSON.parse(staffIds) : []);
  const primaryId = instructorId || ids[0] || null;
  const refusal = await refuseAssignees(req.user.gymId, [...ids, primaryId]);
  if (refusal) return res.status(400).json({ error: refusal });
  const isRecurring = repeat && repeat !== 'None' && repeatUntil;
  const seriesId = isRecurring ? createId() : null;

  // Anything a trainer or the front desk puts on the calendar is their own
  // note to themselves - never the gym's, no matter what a client sends.
  // Management books the gym's classes, which everybody sees.
  const MANAGEMENT_ROLES = ['general_manager', 'manager'];
  const isManagement = MANAGEMENT_ROLES.includes(req.user.role);
  const isPrivate = isManagement ? (req.body.isPrivate !== undefined ? !!req.body.isPrivate : false) : true;

  const baseData = {
    gymId: req.user.gymId,
    createdById: req.user.id,
    isPrivate,
    title,
    time,
    duration,
    instructorId: primaryId,
    staffIds: JSON.stringify(ids),
    location,
    spots,
    color,
    description:  description  || null,
    repeat:       repeat        || null,
    repeatUntil:  isRecurring   ? repeatUntil : null,
    seriesId,
    category:     category ? String(category).slice(0, 40) : null,
    memberId:     memberId || null,
  };

  const dates = [new Date(date)];
  if (isRecurring) {
    const until = new Date(repeatUntil);
    let current = new Date(date);
    while (true) {
      if (repeat === 'Daily')        current.setDate(current.getDate() + 1);
      else if (repeat === 'Weekly')  current.setDate(current.getDate() + 7);
      else if (repeat === 'Monthly') current.setMonth(current.getMonth() + 1);
      else break;
      if (current > until) break;
      dates.push(new Date(current));
    }
  }

  const events = await Promise.all(dates.map(d =>
    prisma.calendarEvent.create({
      data: { ...baseData, date: d },
      include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
    })
  ));

  // Being put on the gym calendar is being given something to do, but the
  // calendar is not where most people look. Each person named on the event gets
  // a task of their own and a notification, so it reaches them where they work.
  if (!isPrivate && ids.length) {
    await tellTheAssigned({ gymId: req.user.gymId, createdById: req.user.id, ids, events, title, time })
      .catch(err => console.error('Calendar assignment tasks failed:', err.message));
  }

  res.status(201).json(events.length === 1 ? events[0] : events);
}

// One task per person per date, plus a notification each. Errors are logged and
// swallowed: the booking itself has already been made and must stand.
async function tellTheAssigned({ gymId, createdById, ids, events, title, time }) {
  const people = await prisma.staff.findMany({
    where: { id: { in: ids }, gymId, isActive: true },
    select: { id: true, firstName: true },
  });
  if (!people.length) return;

  // The date is stored as midnight UTC, so it has to be read back as UTC.
  // Formatting it in the server's local time named the day before.
  const when = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const at = time ? ` at ${time}` : '';
  const pairs = events.flatMap(event => people.map(person => ({ event, person })));
  const made = await prisma.task.createMany({
    data: pairs.map(({ event, person }) => ({
      gymId,
      title,
      description: `You are invited to this on ${when(event.date)}${at}. Accept it and it goes on your own calendar; decline and it will not.`,
      dueDate: event.date,
      assignedToId: person.id,
      createdById,
      createdBySystem: true,
      category: 'Calendar',
      eventId: event.id,
    })),
  }).then(() => true).catch((err) => { console.error('Calendar invite tasks failed:', err.message); return false; });
  await prisma.notification.createMany({
    data: pairs.map(({ event, person }) => ({
      gymId,
      staffId: person.id,
      title: 'You have been put on the calendar',
      body: `${title} - ${when(event.date)}${at}.`,
      type: 'task',
      // No link: the app sends a task notification to whichever page that
      // person's tasks live on, which differs by role.
      ...(made ? {} : { link: '/calendar' }),
    })),
  }).catch(() => {});
}

// A private entry answers to the person who wrote it. Everything else on the
// calendar is the gym's and belongs to management.
const MANAGEMENT_ROLES = ['general_manager', 'manager'];
function refuseEvent(event, user) {
  if (event.isPrivate) {
    return String(event.createdById) === String(user.id)
      ? null
      : 'That entry belongs to somebody else.';
  }
  return MANAGEMENT_ROLES.includes(user.role) ? null : 'Only a manager can change the gym calendar.';
}

async function update(req, res) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  const notYours = refuseEvent(existing, req.user);
  if (notYours) return res.status(403).json({ error: notYours });

  const { gymId: _g, id: _id, staffIds, instructorId, isPrivate: _p, createdById: _c, tz, member: _m, responses: _r, assignedStaff: _a, instructor: _i, ...safeData } = req.body;
  // Moving an entry into the past is refused, the same as booking one there
  const newDay = safeData.date ? String(safeData.date).slice(0, 10) : existing.date.toISOString().slice(0, 10);
  const newTime = safeData.time !== undefined ? safeData.time : existing.time;
  if (newDay !== existing.date.toISOString().slice(0, 10) || (newTime || '') !== (existing.time || '')) {
    const past = inThePast(newDay, newTime, tz);
    if (past) return res.status(400).json(past);
  }
  if (safeData.memberId !== undefined && safeData.memberId !== existing.memberId) {
    const badMember = await refuseMember(req, safeData.memberId);
    if (badMember) return res.status(400).json({ error: badMember, field: 'memberId' });
  }
  if (safeData.date) safeData.date = new Date(safeData.date);

  const ids = Array.isArray(staffIds) ? staffIds : (staffIds ? JSON.parse(staffIds) : []);
  const primaryId = instructorId !== undefined ? (instructorId || ids[0] || null) : (ids[0] || null);
  // Only people newly added are checked, so a class whose instructor has since
  // been deactivated can still be moved or renamed.
  let before = [];
  try { before = JSON.parse(existing.staffIds || '[]'); } catch { before = []; }
  const already = new Set([existing.instructorId, ...before].filter(Boolean).map(String));
  const refusal = await refuseAssignees(req.user.gymId, [...ids, primaryId].filter(id => id && !already.has(String(id))));
  if (refusal) return res.status(400).json({ error: refusal });
  safeData.staffIds = JSON.stringify(ids);
  safeData.instructorId = primaryId;

  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id },
    data: safeData,
    include: { instructor: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Whoever is new to the class gets the same invite a person named at
  // creation would have; whoever was taken off it loses the invite, so it
  // cannot still be sitting there to accept for a class they are no longer on.
  const wasPrivate = existing.isPrivate;
  const nowIds = new Set([...ids, primaryId].filter(Boolean).map(String));
  if (!event.isPrivate) {
    const addedIds = wasPrivate ? [...nowIds] : [...nowIds].filter(id => !already.has(id));
    if (addedIds.length) {
      await tellTheAssigned({ gymId: req.user.gymId, createdById: req.user.id, ids: addedIds, events: [event], title: event.title, time: event.time })
        .catch(err => console.error('Calendar assignment tasks failed:', err.message));
    }
  }
  const removedIds = [...already].filter(id => !nowIds.has(id) || event.isPrivate);
  if (removedIds.length) {
    prisma.task.deleteMany({ where: { eventId: event.id, assignedToId: { in: removedIds } } }).catch(() => {});
  }

  res.json(event);
}

// ── GET /api/calendar/busy?staffIds=a,b&date=YYYY-MM-DD&start=HH:MM&end=HH:MM&excludeId= ──
// What each person already has on at that time, so whoever is booking them sees
// a warning first (it never stops the booking). Anyone may ask about
// themselves, management about anybody. Someone else's private entry shows as
// busy without its title; a training session says it is one.
async function busy(req, res) {
  const gymId = req.user.gymId;
  const ids = String(req.query.staffIds || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  const date = String(req.query.date || '').slice(0, 10);
  if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.json([]);
  if (!MANAGEMENT_ROLES.includes(req.user.role) && ids.some(id => id !== String(req.user.id))) {
    return res.status(403).json({ error: 'You can only check your own calendar.' });
  }
  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 86400000);
  const excludeId = req.query.excludeId ? String(req.query.excludeId) : null;
  const events = await prisma.calendarEvent.findMany({ where: { gymId, date: { gte: from, lt: to }, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  const declined = events.length ? await prisma.task.findMany({ where: { gymId, eventId: { in: events.map(e => e.id) }, status: 'declined' }, select: { eventId: true, assignedToId: true } }) : [];
  const declinedSet = new Set(declined.map(d => `${d.eventId}:${d.assignedToId}`));
  const start = toMinutes(req.query.start), end = toMinutes(req.query.end);
  const window = start != null ? { start, end: end != null && end > start ? end : start + 60 } : null;
  const staff = await prisma.staff.findMany({ where: { id: { in: ids }, gymId }, select: { id: true, firstName: true, lastName: true } });

  const out = staff.map(s => {
    const sid = String(s.id);
    const items = events.filter(e => {
      const theirs = e.isPrivate
        ? String(e.createdById) === sid
        : String(e.createdById) === sid || String(e.instructorId) === sid || parseStaffIds(e.staffIds).map(String).includes(sid);
      if (!theirs) return false;
      if (!e.isPrivate && declinedSet.has(`${e.id}:${sid}`)) return false;
      if (!window) return true;
      const sp = spanOf(e);
      return sp.start < window.end && window.start < sp.end;
    }).map(e => {
      const sp = spanOf(e);
      const readable = !e.isPrivate || String(e.createdById) === String(req.user.id);
      return { id: e.id, time: sp.allDay ? null : hhmm(sp.start), end: sp.allDay ? null : hhmm(sp.end), title: readable ? e.title : null, category: e.category || null, private: e.isPrivate };
    }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return { staffId: sid, name: `${s.firstName || ''} ${s.lastName || ''}`.trim(), items };
  }).filter(x => x.items.length);
  res.json(out);
}

async function remove(req, res) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  const refusal = refuseEvent(existing, req.user);
  if (refusal) return res.status(403).json({ error: refusal });

  // ?series=true → delete all events in the same series
  if (req.query.series === 'true' && existing.seriesId) {
    await prisma.calendarEvent.deleteMany({
      where: { seriesId: existing.seriesId, gymId: req.user.gymId },
    });
    logActivity(req, {
      category: 'settings', action: 'class.series_deleted',
      summary: `Deleted every class in the series "${existing.title}"`, target: { type: 'class', id: existing.id },
    });
    return res.json({ message: 'Series deleted', seriesId: existing.seriesId });
  }

  await prisma.calendarEvent.delete({ where: { id: req.params.id } });
  logActivity(req, {
    category: 'settings', action: 'class.deleted',
    summary: `Deleted the class "${existing.title}" on ${new Date(existing.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    target: { type: 'class', id: existing.id },
  });
  res.json({ message: 'Event deleted' });
}

module.exports = { getAll, create, update, remove, busy };
