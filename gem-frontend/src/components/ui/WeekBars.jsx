import { fmtDate } from '../../utils/date';

// How often something happened, week by week (sessions with a coach, visits to
// the gym): one bar a week, the count above it, a dashed line at the weekly
// average, and the first and last weeks named underneath.
export default function WeekBars({ weeks = [], color = 'var(--accent-gold)', height = 96, label }) {
  const max = Math.max(1, ...weeks.map(w => w.count));
  const avg = weeks.length ? weeks.reduce((s, w) => s + w.count, 0) / weeks.length : 0;
  const avgPct = (avg / max) * 100;
  return (
    <div role="img" aria-label={label ? `${label}: ${weeks.map(w => w.count).join(', ')}` : undefined} style={{ fontFamily: 'DM Sans' }}>
      <div style={{ position: 'relative', height, display: 'flex', alignItems: 'flex-end', gap: 4, borderBottom: '1px solid var(--border-subtle)' }}>
        {avg > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${avgPct}%`, borderTop: '1px dashed var(--text-muted)', opacity: 0.6 }} />
        )}
        {weeks.map((w, i) => {
          const pct = (w.count / max) * 100;
          const isLast = i === weeks.length - 1;
          return (
            <div key={w.start} title={`${fmtDate(w.start, { day: 'numeric', month: 'short' })}: ${w.count}`}
              style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
              {w.count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: isLast ? color : 'var(--text-secondary)', lineHeight: 1 }}>{w.count}</span>}
              <div style={{ width: '100%', maxWidth: 22, height: `${w.count ? Math.max(pct, 6) : 0}%`, minHeight: w.count ? 4 : 0, borderRadius: '4px 4px 0 0', background: color, opacity: isLast ? 1 : 0.55 }} />
            </div>
          );
        })}
      </div>
      {weeks.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span>{fmtDate(weeks[0].start, { day: 'numeric', month: 'short' })}</span>
          <span>{fmtDate(weeks[weeks.length - 1].start, { day: 'numeric', month: 'short' })}</span>
        </div>
      )}
    </div>
  );
}
