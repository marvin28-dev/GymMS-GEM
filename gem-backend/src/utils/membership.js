// A membership that has ended can't be coached: no new sessions, measurements
// or notes, no new coach and no training booked with them, until it is
// renewed. Statuses are kept fresh by the members list; the end date covers one
// that has not been refreshed yet. Mirrored in gem-frontend/src/utils/coaching.js.
const ENDED = ['expired', 'cancelled', 'deactivated'];

function membershipEnded(m) {
  if (!m) return false;
  if (ENDED.includes(m.status)) return true;
  if (m.isVisitor || !m.endDate || !['active', 'expiring'].includes(m.status)) return false;
  return new Date(m.endDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
}

// The viewer's own day and minute, from the browser's getTimezoneOffset
function localNow(tz) {
  const offset = Math.max(-840, Math.min(840, Number(tz) || 0));
  const d = new Date(Date.now() - offset * 60000);
  return {
    today: d.toISOString().slice(0, 10),
    minute: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

module.exports = { membershipEnded, localNow, toMinutes };
