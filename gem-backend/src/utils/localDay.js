// A gym's day is its local day. tz is the browser's getTimezoneOffset() in
// minutes (Douala, UTC+1, sends -60), so a day starts at local midnight
// rather than at midnight UTC.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const readTz = (query) => Math.max(-840, Math.min(840, Number(query?.tz) || 0));

function startOfLocalDay(day, tz) {
  const [y, m, d] = String(day).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + tz * 60000);
}

module.exports = { DAY, readTz, startOfLocalDay };
