// One rule for whether a member may check in, used by every check-in button in
// the system (front desk, attendance page, member profile hero and the
// attendance-history tab) so they all behave identically. Mirrors the server
// rule in attendance.controller checkIn().
//
// Returns a human reason the check-in is blocked, or null when it is allowed.
// Day passes (dayPasses) are counted apart from a visitor's bundle passes and a
// package's sessions (passesRemaining).
import { dayStr, todayStr, fmtTime } from './date';

const LAPSED = ['frozen', 'suspended', 'expired', 'cancelled', 'deactivated'];

export function checkInBlockReason(m, t, formatDate) {
  if (!m || m._isStaff) return null;
  const s = m.status;
  const dayPasses = m.dayPasses || 0;

  if (m.isVisitor || s === 'visitor') {
    // The end date is the last day the passes work, so they lapse the day after
    const bundleExpired = m.endDate && dayStr(m.endDate) < todayStr();
    if ((m.passesRemaining || 0) > 0 && !bundleExpired) return null;
    if (dayPasses > 0) return null;
    if ((m.passesRemaining || 0) > 0 && bundleExpired && formatDate) {
      return t('checkin.visitorExpired', { date: formatDate(m.endDate) });
    }
    return t('checkin.noPasses');
  }
  if (LAPSED.includes(s)) {
    return dayPasses > 0 ? null : t(`checkin.${s}`);
  }
  if (s === 'pending') {
    return (m.startDate && formatDate)
      ? t('checkin.pendingWithDate', { date: formatDate(m.startDate) })
      : t('checkin.pending');
  }
  if (m.passesRemaining != null && m.passesRemaining <= 0) return t('checkin.noSessions');
  return null;
}

export const canCheckIn = (m, t, formatDate) => !checkInBlockReason(m, t, formatDate);

// How a recorded visit was paid for, in the words and colours every check-in
// list uses. Visits from before this was recorded have no kind; a visitor's
// read as a visitor pass, anyone else's as their membership.
export function visitBadge(kind, isVisitorMember, t) {
  if (kind === 'day_pass') return { kind: 'day_pass', label: t('checkin.kindDayPass'), color: 'var(--accent-gold)', bg: 'var(--accent-gold-dim)' };
  if (kind === 'visitor_pass' || (!kind && isVisitorMember)) return { kind: 'visitor_pass', label: t('checkin.kindVisitorPass'), color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' };
  return { kind: 'membership', label: t('checkin.kindMembership'), color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' };
}

// What a visitor has left to come in on, bundle passes and day passes together,
// so every screen (profile, front desk, attendance, members) shows one number.
// passesTotal counts every pass bought this cycle, day passes included.
export const passesLeft = (m) => Math.max(0, m?.passesRemaining || 0) + Math.max(0, m?.dayPasses || 0);
export const passesOf = (m) => Math.max(m?.passesTotal || 0, passesLeft(m));

// What every check-in button says when the server refuses: a second check-in
// within 30 minutes is the same visit, so it names when they came in and when
// the next check-in is possible. Any other refusal shows the server's reason.
export function checkInErrorText(err, t, fallback) {
  const d = err?.response?.data;
  if (err?.response?.status === 409 && d?.alreadyCheckedIn) {
    const at = d.lastCheckIn ? new Date(d.lastCheckIn) : null;
    if (at && !Number.isNaN(at.getTime())) {
      return t('checkin.alreadyCheckedIn', { name: d.member?.firstName || '', time: fmtTime(at), next: fmtTime(new Date(at.getTime() + 30 * 60000)) });
    }
  }
  return d?.error || fallback;
}
