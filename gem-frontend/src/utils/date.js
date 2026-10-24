import { readStored } from './storage';

export const getDateLocale = () =>
  readStored('gem-lang', 'en') === 'fr' ? 'fr-FR' : 'en-GB';

export const capFirst = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// A day of the month as people say it: "21st", "11th" in English, "1er", "21" in French
export const ordinalDay = (n, lang = 'en') => {
  const d = Number(n);
  if (!d) return '';
  if (lang === 'fr') return d === 1 ? '1er' : String(d);
  if (d % 100 >= 11 && d % 100 <= 13) return `${d}th`;
  return d + ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th');
};

// A join date, a start date or an expiry is a day on a calendar, not a moment
// in time. Those are stored as midnight UTC, so reading them as a timestamp
// shows the day before anywhere west of Greenwich. Anything with a real time on
// it is left alone.
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

export const asDate = (d) => {
  if (d instanceof Date) return d;
  const day = typeof d === 'string' && d.match(CALENDAR_DAY);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(d);
};

export const fmtDate = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!d) return '-';
  return capFirst(asDate(d).toLocaleDateString(getDateLocale(), opts));
};

export const fmtTime = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
};

// Today as a plain calendar day in the viewer's OWN timezone. `new Date()
// .toISOString().slice(0,10)` gives the UTC day, which reads as tomorrow (or
// yesterday) either side of midnight - the reason the calendar highlighted the
// wrong day and "upcoming vs past" split on the wrong boundary. Always use this
// for a "today" comparison, never the ISO slice.
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A stored date (a midnight-UTC calendar day, or a real timestamp) as a local
// YYYY-MM-DD, so day comparisons line up with what the viewer actually sees.
export const dayStr = (d) => {
  if (!d) return '';
  const dt = asDate(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// A calendar day n days after a YYYY-MM-DD day, worked out on the local
// calendar so it never slips a day the way a UTC slice does.
export const addDaysStr = (dateStr, n) => {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + (Number(n) || 0));
  return dayStr(d);
};

// A pay period is stored as "Sep 2026" so records always match; in French it
// reads "septembre 2026". Anything else is shown as stored.
const PAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const payMonthText = (label) => {
  if (getDateLocale() !== 'fr-FR') return label;
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(label || '').trim());
  const idx = m ? PAY_MONTHS.indexOf(m[1]) : -1;
  return idx < 0 ? label : new Date(Number(m[2]), idx, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};
