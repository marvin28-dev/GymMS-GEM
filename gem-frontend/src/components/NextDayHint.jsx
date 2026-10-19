import { useLanguage } from '../contexts/LanguageContext';

// A time on its own cannot say which day it belongs to. Picking 22:00 and then
// 00:30 looks like going backwards, and people reading it assumed they had got
// the am/pm wrong. This says plainly that the second time is the next day, so
// somebody who meant 12:30 in the afternoon can see they picked the morning.

const HHMM = /^(\d{1,2}):(\d{2})/;
const minutes = (hhmm) => {
  const m = HHMM.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// True when the end time is at or before the start, so it must mean tomorrow
export function crossesMidnight(start, end) {
  const a = minutes(start);
  const b = minutes(end);
  return a !== null && b !== null && b <= a;
}

export default function NextDayHint({ start, end }) {
  const { t } = useLanguage();
  if (!crossesMidnight(start, end)) return null;
  return (
    <div style={{
      marginTop: 5,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: 'var(--accent-gold-dim)',
      color: 'var(--accent-gold)',
      border: '1px solid var(--accent-gold)',
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'DM Sans',
      lineHeight: 1.6,
    }}>
      <span aria-hidden="true">→</span>
      {t('common.nextDay')}
    </div>
  );
}
