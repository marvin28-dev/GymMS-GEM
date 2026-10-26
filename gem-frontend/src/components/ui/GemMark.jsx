import { useId } from 'react';

// GEM's own logo, the cut gem: a faceted jewel, dark on gold. A vector, so it
// is sharp from the browser tab (public/favicon.svg is the same drawing) to the
// landing page, and reads on both themes. Text beside it says GEM, so the
// mark itself is decoration.
export default function GemMark({ size = 32, style }) {
  // Each mark has its own gradient: a page with several would otherwise point
  // at the first one, which draws nothing when it sits in a hidden part.
  const gold = `gem-gold-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-gem-mark=""
      style={{ display: 'block', flexShrink: 0, borderRadius: size * 14 / 64, ...style }}
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dcbf8a" />
          <stop offset="1" stopColor="#b08d4a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gold})`} />
      <polygon points="21,17 43,17 53,27 32,50 11,27" fill="#0a0a0f" />
      <polygon points="26,27 32,17 38,27" fill="#26262f" />
      <g fill="none" stroke="#c9a96e" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M11 27H53" />
        <path d="M21 17L26 27L32 17L38 27L43 17" />
        <path d="M26 27L32 50L38 27" />
      </g>
    </svg>
  );
}
