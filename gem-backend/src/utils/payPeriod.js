// A pay period is written one way, "Oct 2026", everywhere it is stored and
// compared: pay records, one-off bonuses and deductions, and the pay day job.
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "oct 2026" and "October 2026" become "Oct 2026"; null when it is not a month
function normaliseMonth(raw) {
  const m = /^\s*([A-Za-z]{3,})\s+(\d{4})\s*$/.exec(String(raw || ''));
  if (!m) return null;
  const idx = SHORT_MONTHS.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
  return idx < 0 ? null : `${SHORT_MONTHS[idx]} ${m[2]}`;
}

module.exports = { SHORT_MONTHS, normaliseMonth };
