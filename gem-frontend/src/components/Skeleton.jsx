// Placeholders that hold the shape of what is coming.
//
// A list that starts empty flashes "nothing here yet" for a moment and then
// jumps to a full table; a one-line "Loading…" does the same in reverse. Both
// read as the page flickering. These keep the page the size it will end up,
// so the only thing that changes is the content filling in.

const bar = {
  background: 'var(--bg-elevated)',
  borderRadius: 6,
  animation: 'gem-skeleton 1.4s ease-in-out infinite',
};

export function SkeletonLine({ width = '100%', height = 12, style }) {
  return <div style={{ ...bar, width, height, ...style }} />;
}

// Rows for a table, matching its column count so nothing shifts sideways
export function SkeletonTableRows({ rows = 6, cols = 4 }) {
  const widths = ['62%', '45%', '38%', '52%', '33%', '44%', '50%'];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} style={{ padding: '14px 20px' }}>
              <SkeletonLine width={widths[(r + c) % widths.length]} style={{ animationDelay: `${(r * cols + c) * 40}ms` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// Stacked cards, for the phone layouts and for card grids
export function SkeletonCards({ count = 4, height = 72 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: 14, height, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ ...bar, width: 38, height: 38, borderRadius: '50%', animationDelay: `${i * 60}ms` }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonLine width="55%" style={{ animationDelay: `${i * 60}ms` }} />
            <SkeletonLine width="34%" height={10} style={{ animationDelay: `${i * 60 + 30}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
