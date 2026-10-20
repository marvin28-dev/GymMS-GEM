// A package's length and session limit are stored as the form wrote them
// ("6 Months", "Unlimited"); these show them in the reader's language. Anything
// else the gym typed is shown as written.
const UNITS = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' };

export function durationText(duration, t) {
  const m = /^(\d+)\s*(day|week|month|year)s?$/i.exec(String(duration || '').trim());
  if (!m) return duration;
  const n = Number(m[1]);
  return t(`packages.dur${UNITS[m[2].toLowerCase()]}${n === 1 ? '' : 's'}`, { n });
}

export function sessionsText(sessions, t) {
  return /^unlimited$/i.test(String(sessions || '').trim()) ? t('packages.unlimited') : sessions;
}
