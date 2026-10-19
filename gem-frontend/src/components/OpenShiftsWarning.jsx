import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getAll as getTimecards } from '../services/timecards.service';
import { useLanguage } from '../contexts/LanguageContext';

// Staff who clocked in today and never clocked out.
//
// The end-of-day report asks for all of them, because closing the day on any
// open shift loses those hours. The dashboard asks only for the overdue ones -
// somebody halfway through their shift is just at work, not a problem. The
// server decides which is which, since it knows the rota.
export function useOpenShifts(enabled = true, { overdueOnly = false } = {}) {
  const [openShifts, setOpenShifts] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    getTimecards({ date: iso, openOnly: 'true', ...(overdueOnly ? { overdueOnly: 'true' } : {}) })
      .then(res => setOpenShifts(res.data || []))
      .catch(() => setOpenShifts([]));
  }, [enabled, overdueOnly]);

  return openShifts;
}

const nameOf = (c) => `${c.staff?.firstName || ''} ${c.staff?.lastName || ''}`.trim() || 'A staff member';
const clock = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');

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
          {shifts.map(c => `${nameOf(c)} (${t('attendance.sinceTime', { time: clock(c.punchIn) })})`).join(', ')}
        </div>
      </div>
    </div>
  );
}
