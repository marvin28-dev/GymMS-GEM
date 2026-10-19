import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '../../utils/date';

// A measurement over time (weight, body fat, waist), drawn at the width it is
// given: a faint grid labelled low / middle / high, the first and last dates,
// a dot per reading and the latest one labelled. Point at the line, or tap it
// on a phone, to read any reading. Points are spaced by date, not by count, so
// a long gap between weigh-ins looks like one.
export default function TrendChart({ points = [], unit = '', color = 'var(--accent-gold)', height = 190 }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const pts = points
    .filter(p => Number.isFinite(p.value) && p.date)
    .map(p => ({ ...p, t: new Date(p.date).getTime() }))
    .sort((a, b) => a.t - b.t);

  const padL = 44, padR = 16, padT = 22, padB = 26;
  const innerW = Math.max(0, width - padL - padR);
  const innerH = height - padT - padB;
  const values = pts.map(p => p.value);
  const rawMin = Math.min(...values), rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.05);
  const lo = rawMin - spread * 0.2, hi = rawMax + spread * 0.2;
  const t0 = pts[0]?.t ?? 0, t1 = pts[pts.length - 1]?.t ?? 0;
  const x = (p, i) => padL + (t1 > t0 ? ((p.t - t0) / (t1 - t0)) : (pts.length > 1 ? i / (pts.length - 1) : 0.5)) * innerW;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * innerH;
  const fmt = (v) => (Math.round(v * 10) / 10).toString();

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p, i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${x(pts[pts.length - 1], pts.length - 1).toFixed(1)},${padT + innerH} L${x(pts[0], 0).toFixed(1)},${padT + innerH} Z` : '';
  const grid = [hi, (hi + lo) / 2, lo].map(v => ({ v, y: y(v) }));
  const last = pts.length - 1;

  const pick = (e) => {
    if (!pts.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0, dist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(x(p, i) - px); if (d < dist) { dist = d; best = i; } });
    setHover(best);
  };
  const shown = hover != null ? pts[hover] : null;

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height, touchAction: 'pan-y' }}>
      {width > 0 && pts.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={pts.map(p => `${fmtDate(p.date)}: ${fmt(p.value)} ${unit}`).join(', ')}
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} style={{ display: 'block', overflow: 'visible' }}>
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={g.y} y2={g.y} stroke="var(--border-subtle)" strokeDasharray={i === 2 ? undefined : '3 4'} />
              <text x={padL - 8} y={g.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-muted)" fontFamily="JetBrains Mono, monospace">{fmt(g.v)}</text>
            </g>
          ))}
          <text x={padL} y={height - 6} fontSize="10.5" fill="var(--text-muted)" fontFamily="DM Sans">{fmtDate(pts[0].date, { day: 'numeric', month: 'short' })}</text>
          {pts.length > 1 && <text x={width - padR} y={height - 6} textAnchor="end" fontSize="10.5" fill="var(--text-muted)" fontFamily="DM Sans">{fmtDate(pts[last].date, { day: 'numeric', month: 'short' })}</text>}
          {pts.length > 1 && <path d={area} fill={color} opacity="0.1" />}
          {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map((p, i) => (
            <circle key={i} cx={x(p, i)} cy={y(p.value)} r={i === last ? 4.5 : 3} fill={i === last ? color : 'var(--bg-card)'} stroke={color} strokeWidth="2" />
          ))}
          {hover == null && (
            <text x={Math.min(x(pts[last], last), width - padR)} y={y(pts[last].value) - 10} textAnchor={pts.length > 1 ? 'end' : 'middle'} fontSize="12" fontWeight="700" fill="var(--text-primary)" fontFamily="Manrope, sans-serif"
              stroke="var(--bg-card)" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
              {fmt(pts[last].value)} {unit}
            </text>
          )}
          {shown && <line x1={x(shown, hover)} x2={x(shown, hover)} y1={padT} y2={padT + innerH} stroke={color} strokeOpacity="0.4" />}
        </svg>
      )}
      {shown && (
        <div role="status" style={{
          position: 'absolute', top: Math.max(0, y(shown.value) - 52), left: Math.min(Math.max(0, x(shown, hover) - 60), Math.max(0, width - 120)),
          width: 120, pointerEvents: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8,
          padding: '5px 8px', textAlign: 'center', fontFamily: 'DM Sans', boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(shown.value)} {unit}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(shown.date)}</div>
        </div>
      )}
    </div>
  );
}
