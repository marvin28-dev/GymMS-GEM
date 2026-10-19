// A small trend line for a run of numbers (a member's weight over time), with
// the last point marked. Lower is drawn as down, whatever the goal.
export default function Sparkline({ values = [], width = 120, height = 32, color = 'var(--accent-gold)' }) {
  const pts = values.filter(v => Number.isFinite(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 3;
  const x = (i) => pad + (i * (width - pad * 2)) / (pts.length - 1);
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const last = pts.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(pts[last])} r="2.75" fill={color} />
    </svg>
  );
}
