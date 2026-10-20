import { todayStr, dayStr, addDaysStr } from './date';

// "Expiring soon" is a membership that ends within the next 7 days. The stored
// status 'expiring' is only set at a check-in, so counting it read 0 almost always.
export function membershipEndsThisWeek(m) {
  if (!m || m.isVisitor || !['active', 'expiring'].includes(m.status) || !m.endDate) return false;
  const today = todayStr();
  const end = dayStr(m.endDate);
  return end >= today && end <= addDaysStr(today, 7);
}

// What "needs attention" means, in one place, so the sidebar badge, a page's
// filter and anywhere else all agree on the same count.

const daysBetween = (fromStr, toStr) => {
  try { return Math.round((new Date(toStr + 'T00:00:00') - new Date(fromStr + 'T00:00:00')) / 86400000); }
  catch { return NaN; }
};

// A member needs attention only when a payment is falling behind on the
// membership timeline - nothing else. Any one of these flags them:
//   0. Their membership has started and they have paid nothing at all toward it.
//   1. They have not paid in full and the membership ends within two weeks.
//   2. They are more than a week past their start date and have paid less than
//      half of the membership.
// A member who owes nothing, a visitor, and a deactivated record never do.
// Separately, anyone with a request waiting for a manager (extend, freeze,
// cancel...) needs attention until a manager approves or declines it.
export function memberNeedsAttention(m) {
  if (!m) return false;
  if (m.pendingApproval) return true;
  if (m.isVisitor || m.status === 'visitor' || m.status === 'deactivated') return false;
  const balance = m.balance || 0;
  if (balance <= 0) return false; // paid in full - nothing to chase
  const total = m.package?.price || 0;
  const today = todayStr();
  const start = m.startDate ? dayStr(m.startDate) : '';
  const sinceStart = start ? daysBetween(start, today) : NaN;

  // (0) The membership is live (started on or before today) and not a franc of
  // it has been paid. A brand-new member who owes the whole amount is chased
  // from day one, without the grace a part-payer gets.
  if (total > 0 && !Number.isNaN(sinceStart) && sinceStart >= 0 && (total - balance) <= 0) return true;

  // (1) Not paid in full, and the end date is two weeks away or already past.
  const end = m.endDate ? dayStr(m.endDate) : '';
  if (end) {
    const d = daysBetween(today, end);
    if (!Number.isNaN(d) && d <= 14) return true;
  }

  // (2) More than a week into the membership and under half paid.
  if (start && total > 0) {
    const paid = total - balance;
    if (!Number.isNaN(sinceStart) && sinceStart >= 7 && paid < 0.5 * total) return true;
  }

  return false;
}

// Done, accepted and declined are finished
const settledTask = (t) => ['Done', 'Accepted', 'Declined'].includes(t?.status);

// Overdue once its due day has passed, not during it. A due date is stored as
// that day at midnight UTC, so the day is read from the date as stored; the
// moment, or the local reading of it, put a task due today overdue all day.
export function taskOverdue(t) {
  if (!t?.dueDate || settledTask(t)) return false;
  return String(t.dueDate).slice(0, 10) < todayStr();
}

// A task needs attention when it is not settled and is either waiting to be
// started (Pending) or past its due date. One already in progress and still in
// time does not.
export function taskNeedsAttention(t) {
  if (!t || settledTask(t)) return false;
  const s = t.status || 'Pending';
  if (s === 'Pending' || s === 'Overdue') return true;
  return taskOverdue(t);
}

export function countMembersNeedingAttention(list) {
  return (list || []).filter(memberNeedsAttention).length;
}

export function countTasksNeedingAttention(list) {
  return (list || []).filter(taskNeedsAttention).length;
}
