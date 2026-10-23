import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getDateLocale } from '../utils/date';

const nameOf = (c, t) => `${c.staff?.firstName || ''} ${c.staff?.lastName || ''}`.trim() || t('common.aStaffMember');
const clock = (d) => (d ? new Date(d).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }) : '-');

export default function OpenShiftsWarning({ shifts, compact = false }) {
  const { t } = useLanguage();
  if (!shifts || shifts.length === 0) return null;

  return (
    <div style={{
      background: 'var(--accent-yellow-dim)',
      border: '1px solid var(--accent-yellow)',
      borderRadius: 10,
      padding: compact ? '10px 14px' : '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <AlertTriangle size={compact ? 14 : 16} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: 'var(--accent-yellow)' }}>
          {shifts.length === 1
            ? t('attendance.oneStillClockedIn')
            : t('attendance.manyStillClockedIn', { n: shifts.length })}
        </div>
        <div style={{ fontSize: compact ? 11 : 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
          {shifts.map(c => `${nameOf(c, t)} (${t('attendance.sinceTime', { time: clock(c.punchIn) })})`).join(', ')}
        </div>
      </div>
    </div>
  );
}
