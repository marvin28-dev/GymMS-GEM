// JavaScript parses a bare "YYYY-MM-DD" as UTC midnight, but every getter and
// formatter reads it back in local time. For anyone west of UTC that shifts the
// value to the previous day, so a task due on the 14th reports as the 13th.
// Parsing these as local midnight keeps the calendar day the user picked.
function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = { parseDateOnly };
