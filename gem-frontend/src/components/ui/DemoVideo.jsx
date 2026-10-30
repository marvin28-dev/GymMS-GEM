import { PlayCircle } from 'lucide-react';

// The walkthrough video on the landing page and the sign-up welcome, restored at
// the owner's request on 30 October 2026. Its address is written here only; the
// page's content policy lets YouTube's player in (frame-src in vite.config.js).
export const DEMO_VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

export default function DemoVideo({ title, caption, badge, compact = false, style }) {
  const dot = compact ? 7 : 8;
  return (
    <div data-demo-video style={{ borderRadius: compact ? 12 : 14, overflow: 'hidden', border: '1.5px solid rgba(201,169,110,0.25)', boxShadow: compact ? '0 8px 28px rgba(0,0,0,0.28)' : '0 24px 72px rgba(0,0,0,0.32)', ...style }}>
      {caption && (
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: compact ? '8px 12px' : '9px 14px', display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: compact ? 4 : 5, flexShrink: 0 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: dot, height: dot, borderRadius: '50%', background: 'var(--border)' }} />)}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <PlayCircle size={compact ? 10 : 11} color="var(--accent-gold)" aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</span>
          </div>
          {badge && (
            <div style={{ background: 'rgba(201,169,110,0.12)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 600 }}>{badge}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#050508' }}>
        <iframe
          src={DEMO_VIDEO_URL}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    </div>
  );
}
