const prisma = require('./prisma');

const timeLabel = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Minutes past midnight for an 'HH:MM' string, or null if it is not one.
function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// How far either side of the rota a clock can be before it counts
const GRACE_MINUTES = 10;

// The rota for one date: null when none is set (nothing to compare against),
// { dayName, off: true } for a day off, or { dayName, day } for a working day.
async function rotaFor({ gymId, staffId, when }) {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    select: { schedule: true, scheduleOverrides: true },
  });
  if (!staff) return null;

  // A week with its own schedule wins over the standing pattern
  const monday = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const override = staff.scheduleOverrides && typeof staff.scheduleOverrides === 'object'
    ? staff.scheduleOverrides[key]
    : null;

  const schedule = override || staff.schedule;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return null;

  const dayName = when.toLocaleDateString('en-US', { weekday: 'long' });
  const day = schedule[dayName];
  // A day absent from the rota counts as not rostered, the same as one marked off
  return !day || day.off ? { dayName, off: true } : { dayName, day };
}

const minutesAt = (d) => d.getHours() * 60 + d.getMinutes();
const span = (n) => (n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')} min` : `${n} min`);

// Measures a clock against the rota. Two kinds of finding come back:
//
//   issues   add paid time nobody planned, so the card waits for a manager:
//            unscheduled (a day off), early_in, late_out, outside_hours
//   notices  cost time rather than add it, so managers are told but nothing
//            waits: late_in, early_out
//
// Both stay empty when no rota is set, since every punch would otherwise be flagged.
async function clockInCheck({ gymId, staffId, when }) {
  const rota = await rotaFor({ gymId, staffId, when });
  const found = { issues: [], notices: [] };
  if (!rota) return found;
  if (rota.off) {
    found.issues.push({ code: 'unscheduled', message: `Worked on ${rota.dayName}, a day off: clocked in at ${timeLabel(when)}.` });
    return found;
  }
  const start = minutesOf(rota.day.start);
  const end = minutesOf(rota.day.end);
  if (start === null || end === null || end <= start) return found;
  const at = minutesAt(when);
  if (at > end) {
    found.issues.push({ code: 'outside_hours', message: `Clocked in at ${timeLabel(when)}, after the ${rota.day.start} to ${rota.day.end} shift had ended.` });
  } else if (at < start - GRACE_MINUTES) {
    found.issues.push({ code: 'early_in', message: `Checked in ${span(start - at)} early: ${timeLabel(when)} for a shift starting at ${rota.day.start}.` });
  } else if (at > start + GRACE_MINUTES) {
    found.notices.push({ code: 'late_in', message: `Arrived ${span(at - start)} late: clocked in at ${timeLabel(when)} for a ${rota.day.start} start.` });
  }
  return found;
}

async function clockOutCheck({ gymId, staffId, punchIn, punchOut }) {
  const found = { issues: [], notices: [] };
  if (!punchIn || !punchOut) return found;
  // Judged against the day the shift started on
  const rota = await rotaFor({ gymId, staffId, when: new Date(punchIn) });
  if (!rota || rota.off) return found;
  const start = minutesOf(rota.day.start);
  const end = minutesOf(rota.day.end);
  if (start === null || end === null || end <= start) return found;
  const out = new Date(punchOut);
  // Past midnight still counts as late, measured from the rostered end
  const dayOffset = Math.round((new Date(out.getFullYear(), out.getMonth(), out.getDate()) - new Date(new Date(punchIn).getFullYear(), new Date(punchIn).getMonth(), new Date(punchIn).getDate())) / 86400000);
  const at = minutesAt(out) + dayOffset * 1440;
  if (at > end + GRACE_MINUTES) {
    found.issues.push({ code: 'late_out', message: `Checked out ${span(at - end)} late: ${timeLabel(out)} for a shift ending at ${rota.day.end}.` });
  } else if (at < end - GRACE_MINUTES) {
    found.notices.push({ code: 'early_out', message: `Left ${span(end - at)} early: clocked out at ${timeLabel(out)}, the shift ends at ${rota.day.end}.` });
  }
  return found;
}

// Kept for anything that only wants the clock-in problems
async function scheduleIssues(args) {
  return (await clockInCheck(args)).issues;
}

// The rota entry that applies to a given date, or null when none does.
async function rosteredDay({ gymId, staffId, when }) {
  const rota = await rotaFor({ gymId, staffId, when });
  return rota && !rota.off ? rota.day : null;
}

module.exports = { scheduleIssues, clockInCheck, clockOutCheck, rosteredDay, minutesOf, GRACE_MINUTES };
