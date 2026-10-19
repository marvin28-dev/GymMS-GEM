import { useLanguage } from '../../contexts/LanguageContext';
import { TRACK_STYLE } from '../../utils/coaching';

// Whether a client is on track (see trackOf in utils/coaching.js)
export default function TrackPill({ track }) {
  const { t } = useLanguage();
  const s = TRACK_STYLE[track?.key] || TRACK_STYLE.off;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans', color: s.color, background: s.bg, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {t(s.labelKey)}
    </span>
  );
}

// A coach's clients at a glance: one bar split by on track / slipping / off
// track / ended, with the counts and the rule written underneath.
export function TrackSummary({ tracks = [] }) {
  const { t } = useLanguage();
  const order = ['on', 'slipping', 'off', 'nogoal', 'ended'];
  const counts = Object.fromEntries(order.map(k => [k, tracks.filter(x => x.key === k).length]));
  const total = tracks.length;
  if (!total) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'DM Sans' }}>
      <div role="img" aria-label={order.map(k => `${t(TRACK_STYLE[k].labelKey)} ${counts[k]}`).join(', ')}
        style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
        {order.filter(k => counts[k]).map(k => (
          <div key={k} data-track-seg={k} style={{ width: `${(counts[k] / total) * 100}%`, background: k === 'ended' ? 'var(--text-muted)' : TRACK_STYLE[k].color, opacity: k === 'ended' ? 0.35 : 1 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
        {order.filter(k => counts[k] || !['ended', 'nogoal'].includes(k)).map(k => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: k === 'ended' ? 'var(--text-muted)' : TRACK_STYLE[k].color }} />
            <b style={{ color: 'var(--text-primary)' }}>{counts[k]}</b> {t(TRACK_STYLE[k].labelKey)}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('coach.trackRule')}</div>
    </div>
  );
}
