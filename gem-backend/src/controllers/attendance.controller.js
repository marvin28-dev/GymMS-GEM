const prisma = require('../utils/prisma');
const { logActivity } = require('../utils/activityLog');

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const LAPSED = ['expired', 'frozen', 'suspended', 'cancelled', 'deactivated'];

// An employee who comes in to train is a visitor to the gym that day, not a
// shift. The screens read a visit the same way whoever it belongs to, so a
// staff workout is handed over in the same shape as a member's visit.
function asVisit(record) {
  if (!record.workoutStaff) return record;
  const { workoutStaff, ...rest } = record;
  return {
    ...rest,
    workoutStaff,
    staffWorkout: true,
    member: {
      id: `STAFF-${workoutStaff.id}`,
      firstName: workoutStaff.firstName,
      lastName: workoutStaff.lastName,
      memberCode: null,
      status: 'staff',
      avatarColor: workoutStaff.avatarColor,
      photo: workoutStaff.photo,
      package: null,
    },
  };
}

async function getAll(req, res) {
  const { date } = req.query;
  const where = { gymId: req.user.gymId };
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.checkIn = { gte: start, lt: end };
  }
  const records = await prisma.attendance.findMany({
    where,
    include: {
      member: { select: { id: true, firstName: true, lastName: true, accessCode: true, memberCode: true, status: true, isVisitor: true, balance: true, avatarColor: true, photo: true, package: { select: { name: true } } } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
      workoutStaff: { select: { id: true, firstName: true, lastName: true, avatarColor: true, photo: true, role: true } },
    },
    orderBy: { checkIn: 'desc' },
  });
  res.json(records.map(asVisit));
}

async function checkIn(req, res) {
 try {
  const { memberId, accessCode, note } = req.body;

  const where = { gymId: req.user.gymId };
  if (accessCode) {
    where.accessCode = accessCode;
  } else if (memberId) {
    where.OR = [{ id: memberId }, { memberCode: memberId }];
  } else {
    return res.status(400).json({ error: 'memberId or accessCode is required' });
  }

  const [member, gym] = await Promise.all([
    prisma.member.findFirst({ where }),
    prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { registrationFeeRequired: true, registrationFeeFrequency: true, registrationGracePeriodDays: true } }),
  ]);

  // Nobody by that code on the membership list. It may be an employee's own
  // 4-digit code, which they use when they come in to train on their own time.
  // That is a visit to the gym, never a shift: work is clocked by name.
  if (!member && accessCode) {
    const staff = await prisma.staff.findFirst({
      where: { gymId: req.user.gymId, accessCode: String(accessCode) },
      select: { id: true, firstName: true, lastName: true, avatarColor: true, photo: true, role: true, isActive: true },
    });
    if (staff) {
      if (!staff.isActive) {
        return res.status(403).json({ error: 'That account is deactivated.' });
      }
      const already = await prisma.attendance.findFirst({
        where: { gymId: req.user.gymId, workoutStaffId: staff.id, checkOut: null, checkIn: { gte: startOfToday() } },
      });
      if (already) {
        return res.status(409).json({ error: `${staff.firstName} is already checked in to train.`, staffWorkout: true });
      }
      const visit = await prisma.attendance.create({
        data: { gymId: req.user.gymId, workoutStaffId: staff.id, note: note || null },
        include: { workoutStaff: { select: { id: true, firstName: true, lastName: true, avatarColor: true, photo: true, role: true } } },
      });
      logActivity(req, {
        category: 'attendance', action: 'attendance.staff_workout',
        summary: `${staff.firstName} ${staff.lastName} checked in to train, not to work`,
        target: { type: 'staff', id: staff.id },
      });
      return res.status(201).json(asVisit(visit));
    }
  }

  if (!member) return res.status(404).json({ error: 'Member not found' });

  // Correct status on the fly before check-in gate
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.startDate && new Date(member.startDate) > now) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'pending' } });
    member.status = 'pending';
  } else if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.endDate && new Date(member.endDate) < now) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'expired' } });
    member.status = 'expired';
  } else if (member.status === 'active' && !member.isVisitor && member.endDate && new Date(member.endDate) >= now && new Date(member.endDate) <= in7Days) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'expiring' } });
    member.status = 'expiring';
  }

  // What this visit spends. A visitor spends a bundle pass while the bundle is
  // still valid, then a day pass. A lapsed member (frozen / suspended / expired /
  // cancelled / deactivated) can only come in on a paid day pass. Everyone else
  // comes in on their membership. Day passes are counted apart from bundle and
  // package sessions, so a lapsed member on a limited package is never let in
  // on sessions they have left.
  const dayPasses = member.dayPasses || 0;
  let kind = null;
  if (member.isVisitor) {
    // The end date is the last day the passes work (stored as that day at midnight
    // UTC), so they lapse once that whole day has gone by.
    const bundleExpired = member.endDate && new Date(member.endDate).getTime() + 86400000 <= now.getTime();
    if ((member.passesRemaining || 0) > 0 && !bundleExpired) kind = 'visitor_pass';
    else if (dayPasses > 0) kind = 'day_pass';
    else {
      const why = (member.passesRemaining || 0) > 0 && bundleExpired
        ? `visitor passes expired on ${new Date(member.endDate).toLocaleDateString()}`
        : 'no passes remaining';
      return res.status(403).json({ error: `Cannot check in - ${why}. Renew passes or buy a day pass.`, member });
    }
  } else if (LAPSED.includes(member.status)) {
    if (dayPasses > 0) kind = 'day_pass';
    else {
      const why = member.status === 'frozen' ? 'membership is frozen'
        : member.status === 'suspended' ? 'account is suspended'
        : member.status === 'cancelled' ? 'membership was cancelled'
        : member.status === 'deactivated' ? 'account is deactivated'
        : `membership is ${member.status}`;
      // A frozen member gets back in by unfreezing; cancelled/deactivated reactivate; the rest renew.
      const fix = member.status === 'frozen' ? 'Buy a day pass or unfreeze membership.'
        : (member.status === 'cancelled' || member.status === 'deactivated') ? 'Buy a day pass or reactivate.'
        : 'Buy a day pass or renew.';
      return res.status(403).json({ error: `Cannot check in - ${why}. ${fix}`, member });
    }
  }

  // Block check-in if annual registration fee is overdue
  if (gym?.registrationFeeRequired && gym?.registrationFeeFrequency === 'yearly' && member.regFeeDate) {
    const dueDate = new Date(member.regFeeDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    const graceDays = gym.registrationGracePeriodDays || 0;
    const suspendDate = new Date(dueDate);
    suspendDate.setDate(suspendDate.getDate() + graceDays);
    if (now > suspendDate) {
      return res.status(403).json({ error: 'Annual registration fee has expired. Member must renew before checking in.', member });
    }
  }
  if (member.status === 'pending' && !kind) {
    const startLabel = member.startDate ? new Date(member.startDate).toLocaleDateString() : 'unknown date';
    return res.status(403).json({ error: `Membership not started yet (starts ${startLabel})`, member });
  }

  // On a membership, a null passesRemaining means the package is unlimited; any
  // number is a session limit.
  const sessionLimited = !kind && member.passesRemaining !== null && member.passesRemaining !== undefined;
  if (sessionLimited && member.passesRemaining <= 0) {
    return res.status(403).json({ error: 'No sessions remaining on this package', member });
  }

  // A member can come in as many times a day as they like, but a second check-in
  // within half an hour is the same visit, not a new one - whoever they are and
  // however they pay. It is refused before anything is spent, so a visitor or a
  // day pass is never charged twice for one visit.
  const recent = await prisma.attendance.findFirst({
    where: { gymId: req.user.gymId, memberId: member.id, checkIn: { gte: new Date(now.getTime() - 30 * 60000) } },
    orderBy: { checkIn: 'desc' },
    include: {
      member: { select: { id: true, memberCode: true, firstName: true, lastName: true, status: true, avatarColor: true, photo: true } },
    },
  });
  if (recent) {
    return res.status(409).json({
      error: `${member.firstName} was already checked in within the last 30 minutes.`,
      alreadyCheckedIn: true,
      lastCheckIn: recent.checkIn,
      member: { ...recent.member, passesRemaining: member.passesRemaining, dayPasses, isVisitor: member.isVisitor },
    });
  }

  const record = await prisma.attendance.create({
    // The visit keeps where the member stood as they came in: paying later does
    // not change the marker on a visit made while owing
    data: { gymId: req.user.gymId, memberId: member.id, staffId: req.user.id || null, note, kind, balanceAtCheckIn: Number(member.balance) || 0, statusAtCheckIn: member.status || null },
    include: {
      member: { select: { id: true, memberCode: true, firstName: true, lastName: true, status: true, avatarColor: true, photo: true } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
    },
  });

  const memberUpdate = { lastVisit: new Date() };
  if (kind === 'day_pass') {
    memberUpdate.dayPasses = dayPasses - 1;
  } else if (kind === 'visitor_pass' || sessionLimited) {
    memberUpdate.passesRemaining = member.passesRemaining - 1;
  }
  // A visitor with nothing left to come in on is spent: mark them expired so
  // they read as inactive until they buy more.
  if (member.isVisitor) {
    const passesLeft = memberUpdate.passesRemaining ?? member.passesRemaining ?? 0;
    const dayLeft = memberUpdate.dayPasses ?? dayPasses;
    if (passesLeft <= 0 && dayLeft <= 0) memberUpdate.status = 'expired';
  }

  const updatedMember = await prisma.member.update({
    where: { id: member.id },
    data: memberUpdate,
    select: { id: true, passesRemaining: true, dayPasses: true, isVisitor: true, status: true },
  });

  res.status(201).json({
    ...record,
    member: { ...record.member, passesRemaining: updatedMember.passesRemaining, dayPasses: updatedMember.dayPasses, isVisitor: updatedMember.isVisitor, status: updatedMember.status },
  });
 } catch (err) {
  // Without this, a thrown error in this async handler never sends a response
  // and the check-in request hangs - which reads on the page as a freeze.
  console.error('Check-in failed:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Check-in failed. Please try again.' });
 }
}

async function checkOut(req, res) {
  // Looked up within the gym first: by id alone, one gym could close another's visit
  const visit = await prisma.attendance.findFirst({ where: { id: String(req.params.id), gymId: req.user.gymId }, select: { id: true } });
  if (!visit) return res.status(404).json({ error: 'Visit not found' });
  const record = await prisma.attendance.update({
    where: { id: visit.id },
    data: { checkOut: new Date() },
  });
  res.json(record);
}

// Members' check-ins over the last 7, 30 or 90 days: a count for each day, a
// grid of weekday against hour, and the headline figures. Worked out here so
// months of visits are not sent to the browser to be counted.
//
// Days and hours are the gym's local ones. The browser says how far its clock
// is from UTC (tz, as getTimezoneOffset gives it), and every visit is shifted
// by that before it is put in a bucket. Staff who came in to train are not
// members and are left out.
const DAY_MS = 86400000;
// "weekdays=0,4" keeps Mondays and Fridays; anything else keeps the week whole.
function parseWeekdays(raw) {
  const text = String(raw ?? '').trim();
  // Nothing asked for is the whole week. Without this an empty string splits
  // into [''], which Number() reads as 0, quietly leaving only Mondays.
  if (!text) return null;
  const wanted = text.split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  const set = new Set(wanted);
  return set.size > 0 && set.size < 7 ? set : null;
}

// An hour window, inclusive at both ends. A window that wraps midnight (22 to 5)
// is honoured, since some gyms are open across it.
function parseHours(from, to) {
  const a = Number(from), b = Number(to);
  const ok = (n) => Number.isInteger(n) && n >= 0 && n <= 23;
  if (!ok(a) || !ok(b)) return null;
  if (a === 0 && b === 23) return null;
  return { from: a, to: b, wraps: a > b };
}

const inHours = (window, hour) => !window
  || (window.wraps ? hour >= window.from || hour <= window.to : hour >= window.from && hour <= window.to);

async function stats(req, res) {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const weekdayFilter = parseWeekdays(req.query.weekdays);
  const hourWindow = parseHours(req.query.fromHour, req.query.toHour);
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  const toLocal = (d) => new Date(d.getTime() - tz * 60000);
  const toReal = (ms) => new Date(ms + tz * 60000);

  const nowLocal = toLocal(new Date());
  const today = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate());
  const first = today - (days - 1) * DAY_MS;
  const previousFirst = first - days * DAY_MS;

  const visits = await prisma.attendance.findMany({
    where: {
      gymId: req.user.gymId,
      memberId: { not: null },
      checkIn: { gte: toReal(previousFirst), lt: toReal(today + DAY_MS) },
    },
    select: { checkIn: true, memberId: true },
  });

  const perDay = new Map();
  const daysCounted = new Map();   // how many of each weekday the range actually holds
  for (let d = first; d <= today; d += DAY_MS) {
    const wd = (new Date(d).getUTCDay() + 6) % 7;
    if (weekdayFilter && !weekdayFilter.has(wd)) continue;
    perDay.set(d, 0);
    daysCounted.set(wd, (daysCounted.get(wd) || 0) + 1);
  }
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0)); // Monday first
  const byWeekday = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  // Which stretch of the month people come in: the 1st-7th, 8th-14th, and so on
  const byMonthPart = Array(5).fill(0);
  const members = new Set();
  let total = 0;
  let previousTotal = 0;

  for (const v of visits) {
    const local = toLocal(new Date(v.checkIn));
    const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const weekday = (local.getUTCDay() + 6) % 7;
    const hour = local.getUTCHours();
    // The filters decide what counts, on both sides of the comparison
    if (weekdayFilter && !weekdayFilter.has(weekday)) continue;
    if (!inHours(hourWindow, hour)) continue;
    if (day < first) { previousTotal += 1; continue; }
    total += 1;
    members.add(v.memberId);
    perDay.set(day, (perDay.get(day) || 0) + 1);
    heat[weekday][hour] += 1;
    byWeekday[weekday] += 1;
    byHour[hour] += 1;
    byMonthPart[Math.min(4, Math.floor((local.getUTCDate() - 1) / 7))] += 1;
  }

  let busiest = null;
  heat.forEach((row, weekday) => row.forEach((count, hour) => {
    if (count > 0 && (!busiest || count > busiest.count)) busiest = { weekday, hour, count };
  }));

  const peakOf = (arr) => {
    let best = null;
    arr.forEach((count, index) => { if (count > 0 && (!best || count > best.count)) best = { index, count }; });
    return best;
  };
  // A weekday that came round more often in the range would win on totals alone,
  // so the busiest day of the week is judged on its average turnout.
  const weekdayAverages = byWeekday.map((count, wd) => {
    const occurrences = daysCounted.get(wd) || 0;
    return occurrences ? Math.round((count / occurrences) * 10) / 10 : 0;
  });
  let busiestWeekday = null;
  weekdayAverages.forEach((average, weekday) => {
    if (byWeekday[weekday] > 0 && (!busiestWeekday || average > busiestWeekday.average)) {
      busiestWeekday = { weekday, average, total: byWeekday[weekday] };
    }
  });
  const peakHour = peakOf(byHour);
  const peakMonthPart = peakOf(byMonthPart);
  const countedDays = [...daysCounted.values()].reduce((a, b) => a + b, 0) || days;

  res.json({
    days,
    from: new Date(first).toISOString().slice(0, 10),
    to: new Date(today).toISOString().slice(0, 10),
    perDay: [...perDay].map(([d, count]) => ({ date: new Date(d).toISOString().slice(0, 10), count })),
    total,
    previousTotal,
    uniqueMembers: members.size,
    dailyAverage: Math.round((total / countedDays) * 10) / 10,
    heat,
    busiest,
    byWeekday,
    weekdayAverages,
    byHour,
    byMonthPart,
    busiestWeekday,
    busiestHour: peakHour ? { hour: peakHour.index, count: peakHour.count } : null,
    busiestMonthPart: peakMonthPart ? { part: peakMonthPart.index, count: peakMonthPart.count } : null,
    filters: {
      weekdays: weekdayFilter ? [...weekdayFilter].sort((a, b) => a - b) : null,
      fromHour: hourWindow ? hourWindow.from : null,
      toHour: hourWindow ? hourWindow.to : null,
    },
  });
}

module.exports = { getAll, checkIn, checkOut, stats };
