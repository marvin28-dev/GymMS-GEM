import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { busy as getBusy } from '../services/calendar.service';
import { getAuth } from '../utils/auth';

// A heads-up when someone being booked already has something on at that time:
// a coach adding a second entry over their own, or a manager putting a coach on
// an event or a task while they are training a client. It never stops the
// booking. Without a start time it lists everything they have that day.
export default function BusyWarning({ staffIds = [], date, start, end, excludeId }) {
  const { t } = useLanguage();
  const me = String(getAuth()?.user?.id || '');
  const [rows, setRows] = useState([]);
  const key = [...staffIds].map(String).sort().join(',');

  useEffect(() => {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) { setRows([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      getBusy({ staffIds: key.split(','), date, ...(start ? { start } : {}), ...(start && end ? { end } : {}), ...(excludeId ? { excludeId } : {}) })
        .then(r => { if (alive) setRows(r.data || []); })
        .catch(() => { if (alive) setRows([]); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [key, date, start, end, excludeId]);

  if (!rows.length) return null;
  const what = (it) => it.title || (it.category === 'Training' ? t('calendar.busyTraining') : t('calendar.busyPrivate'));
  return (
    <div role="status" data-busy-warning style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'var(--accent-yellow-dim)', border: '1px solid rgba(251,191,36,0.35)', fontFamily: 'DM Sans' }}>
      <AlertTriangle size={16} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {rows.map(r => (
          <div key={r.staffId} style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            <b>{r.staffId === me ? (start ? t('calendar.busySelf') : t('calendar.busySelfDay')) : t(start ? 'calendar.busyOther' : 'calendar.busyOtherDay', { name: r.name })}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{' '}{r.items.map(it => `${it.time ? `${it.time}${it.end ? `-${it.end}` : ''} ` : ''}${what(it)}`).join(', ')}</span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('calendar.busyStillOk')}</div>
      </div>
    </div>
  );
}
