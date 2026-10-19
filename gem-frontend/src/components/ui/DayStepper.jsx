import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { todayStr, addDaysStr, capFirst, getDateLocale } from '../../utils/date';

// ‹ Today › for looking back through days: the arrows step one day, the label
// opens a date picker, and nothing past today can be chosen. Used by every
// sales list (front desk and Sales & Products) so they page the same way.
export default function DayStepper({ day, onChange, size = 'sm' }) {
  const { t } = useLanguage();
  const today = todayStr();
  const isToday = day === today;
  const label = isToday ? t('common.today')
    : day === addDaysStr(today, -1) ? t('common.yesterday')
    : capFirst(new Date(day + 'T00:00:00').toLocaleDateString(getDateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }));
  const big = size === 'md';
  const btn = (disabled) => ({
    width: big ? 32 : 26, height: big ? 32 : 26, borderRadius: big ? 8 : 7, padding: 0, flexShrink: 0,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)', opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: big ? 8 : 6 }}>
      <button type="button" aria-label={t('frontDesk.prevDay')} onClick={() => onChange(addDaysStr(day, -1))} style={btn(false)}>
        <ChevronLeft size={big ? 15 : 13} />
      </button>
      <label title={t('frontDesk.pickDay')} style={{ position: 'relative', minWidth: big ? 104 : 78, textAlign: 'center', fontSize: big ? 13 : 11.5, fontWeight: 700, color: isToday ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label}
        <input type="date" value={day} max={today}
          onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* older browsers open it themselves */ } }}
          onChange={e => { const v = e.target.value; if (v && v <= today) onChange(v); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
      </label>
      <button type="button" aria-label={t('frontDesk.nextDay')} disabled={isToday} onClick={() => !isToday && onChange(addDaysStr(day, 1))} style={btn(isToday)}>
        <ChevronRight size={big ? 15 : 13} />
      </button>
    </div>
  );
}
