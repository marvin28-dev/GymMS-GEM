import { dayStr, todayStr } from './date';

// How a coach reads their clients, in one place, so the coach's dashboard, a
// member's profile and a manager's view of a coach all say the same thing.
//
// A client has goals (set when the coach takes them on): a weight, a waist
// size, how many sessions a week, maybe a target date. Each week the coach
// takes a check-in (their measurements). On track means they train as often as
// the goal says and their measurements are moving towards it.

export const FOLLOW_UP_DAYS = 7;     // a membership ending or a birthday this close is worth a word
export const AWAY_DAYS = 7;          // not seen for this long
export const OFF_TRACK_DAYS = 14;    // not seen for this long is off track whatever else
export const CHECKIN_LATE_DAYS = 10; // a weekly check-in older than this is late

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const round1 = (v) => Math.round(v * 10) / 10;

// A membership that has ended can't be coached until it is renewed (the server
// refuses new progress for it too). Mirrored in gem-backend/src/utils/membership.js.
const ENDED = ['expired', 'cancelled', 'deactivated'];
export function membershipEnded(m) {
  if (!m) return false;
  if (m.ended != null) return !!m.ended;
  if (ENDED.includes(m.status)) return true;
  if (m.isVisitor || !m.endDate || !['active', 'expiring'].includes(m.status)) return false;
  return dayStr(m.endDate) < todayStr();
}

export const hasGoals = (m) => !!m?.goalSetAt && m.goalSessionsPerWeek != null;

export const GOAL_TYPES = ['lose_weight', 'build_muscle', 'get_fit', 'tone', 'endurance', 'other'];

// The member's next birthday as a local day, or null without a usable date
function nextBirthday(dob, today) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob || ''));
  if (!m) return null;
  const year = Number(today.slice(0, 4));
  let next = `${year}-${m[2]}-${m[3]}`;
  if (next < today) next = `${year + 1}-${m[2]}-${m[3]}`;
  return next;
}

// How one measurement is moving relative to its goal, from where it started:
// good (on pace, or there), behind (not moving), poor (moving the wrong way),
// or null while there is no check-in after the starting one yet.
function measureProgress(start, now, goal, c, today) {
  if (start == null || now == null || goal == null) return null;
  const gap = goal - start;
  if (Math.abs(gap) < 0.5) return Math.abs(now - goal) <= 1 ? 'good' : 'behind';
  const done = (now - start) / gap; // 1 = reached the goal, below 0 = the wrong way
  if (done >= 1) return 'good';
  if (done < -0.05) return 'poor';
  if (c.goalTargetDate && c.goalSetAt) {
    const total = daysBetween(dayStr(c.goalSetAt), dayStr(c.goalTargetDate));
    const gone = daysBetween(dayStr(c.goalSetAt), today);
    const expected = total > 0 ? Math.min(1, Math.max(0, gone / total)) : 1;
    return done >= expected - 0.1 ? 'good' : 'behind';
  }
  return done > 0.02 ? 'good' : 'behind';
}

// Whether a client is on track against their goals:
//   on track  - trains as often as the goal says, measurements moving towards it, checked in this past week or so
//   slipping  - one of those is behind
//   off track - both training and measurements are behind, or not seen for 14 days
//   no goals  - nothing set yet, so there is nothing to judge against
//   ended     - the membership is over
// `reasons` says why, for the screen to show.
export function trackOf(c, today = todayStr()) {
  if (membershipEnded(c)) return { key: 'ended', reasons: [] };
  if (!hasGoals(c)) return { key: 'nogoal', reasons: [] };
  const reasons = [];

  const target = c.goalSessionsPerWeek;
  const perWeek = round1((c.visitsLast14 || 0) / 2);
  const train = perWeek >= target ? 'good' : perWeek >= target / 2 ? 'behind' : 'poor';
  reasons.push({ type: 'train', state: train, perWeek, target });

  const base = c.baseline || {};
  const fresh = c.lastCheckIn && base.date && new Date(c.lastCheckIn).getTime() > new Date(base.date).getTime();
  const weight = fresh ? measureProgress(base.weight, c.latestWeight, c.goalWeight, c, today) : null;
  const waist = fresh ? measureProgress(base.waist, c.latestWaist, c.goalWaist, c, today) : null;
  const body = weight == null && waist == null ? null
    : [weight, waist].includes('good') && ![weight, waist].includes('poor') ? 'good'
    : weight === 'poor' && (waist === 'poor' || waist == null) ? 'poor'
    : waist === 'poor' && weight == null ? 'poor'
    : 'behind';
  if (c.goalWeight != null && c.latestWeight != null) {
    reasons.push({ type: 'weight', state: weight, now: c.latestWeight, goal: c.goalWeight, change: fresh && base.weight != null ? round1(c.latestWeight - base.weight) : null });
  }

  const since = c.lastCheckIn ? daysBetween(dayStr(c.lastCheckIn), today) : null;
  const late = since == null || since > CHECKIN_LATE_DAYS;
  if (late) reasons.push({ type: 'checkin', days: since });

  const away = c.lastVisit ? daysBetween(dayStr(c.lastVisit), today) : null;
  if (away == null || away >= OFF_TRACK_DAYS) return { key: 'off', reasons: [{ type: 'away', days: away }, ...reasons] };
  if (train === 'poor' && body === 'poor') return { key: 'off', reasons };
  if (train === 'good' && body !== 'poor' && body !== 'behind' && !late) return { key: 'on', reasons };
  return { key: 'slipping', reasons };
}

// What the coach has to do for a client this week, most important first:
// set their goals, take this week's check-in, and anything worth a word
// (a membership about to end, not seen for a week, a birthday). An ended
// membership is not the coach's to chase.
export function followUpsOf(c, today = todayStr()) {
  if (!c || membershipEnded(c)) return [];
  const out = [];
  if (!hasGoals(c)) out.push({ type: 'goals' });
  else if (!c.checkedInThisWeek) out.push({ type: 'checkin', days: c.lastCheckIn ? daysBetween(dayStr(c.lastCheckIn), today) : null });
  if (!c.isVisitor && c.endDate && ['active', 'expiring'].includes(c.status)) {
    const end = dayStr(c.endDate);
    const left = daysBetween(today, end);
    if (left >= 0 && left <= FOLLOW_UP_DAYS) out.push({ type: 'ending', date: end, days: left });
  }
  const last = c.lastVisit ? dayStr(c.lastVisit) : null;
  const away = last ? daysBetween(last, today) : null;
  if (away == null || away >= AWAY_DAYS) out.push({ type: 'away', days: away });
  const bday = nextBirthday(c.dob, today);
  if (bday) {
    const inDays = daysBetween(today, bday);
    if (inDays >= 0 && inDays <= FOLLOW_UP_DAYS) out.push({ type: 'birthday', date: bday, days: inDays });
  }
  return out;
}

export const TRACK_STYLE = {
  on:       { color: 'var(--accent-green)',  bg: 'var(--accent-green-dim)',  labelKey: 'coach.trackOn' },
  slipping: { color: 'var(--accent-yellow)', bg: 'var(--accent-yellow-dim)', labelKey: 'coach.trackSlipping' },
  off:      { color: 'var(--accent-red)',    bg: 'var(--accent-red-dim)',    labelKey: 'coach.trackOff' },
  nogoal:   { color: 'var(--accent-blue)',   bg: 'var(--accent-blue-dim)',   labelKey: 'coach.trackNoGoal' },
  ended:    { color: 'var(--text-muted)',    bg: 'var(--bg-elevated)',       labelKey: 'coach.trackEnded' },
};

// One short line per reason, for under a client's name
export function reasonLines(track, t, fmt = (v) => v) {
  return (track?.reasons || []).map(r => {
    if (r.type === 'train') return t('coach.rTrain', { n: fmt(r.perWeek), target: r.target });
    if (r.type === 'weight') return r.change != null ? t('coach.rWeight', { now: fmt(r.now), goal: fmt(r.goal), change: `${r.change > 0 ? '+' : ''}${fmt(r.change)}` }) : t('coach.rWeightNoChange', { now: fmt(r.now), goal: fmt(r.goal) });
    if (r.type === 'checkin') return r.days == null ? t('coach.rNoCheckin') : t('coach.rCheckinLate', { n: r.days });
    if (r.type === 'away') return r.days == null ? t('coach.reasonNeverCame') : t('coach.reasonAway', { n: r.days });
    return null;
  }).filter(Boolean);
}
