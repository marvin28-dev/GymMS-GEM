import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

// The one actions control for every list row: a 3-dot button whose menu is
// portalled to <body> with fixed positioning. An in-table dropdown gets clipped
// by the table's scroll container, which is why the menu lives outside it.
// items: [{ label, icon, onClick, danger, hidden }]
// buttonContent / buttonStyle swap the 3-dot button for a labelled one (e.g. "Log")
export default function RowMenu({ items = [], title = 'Actions', buttonContent = null, buttonStyle = null }) {
  const visible = items.filter(i => i && !i.hidden);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!rect) return;
    const outside = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setRect(null);
    };
    // A fixed menu would float away from its row when anything scrolls (the
    // table itself scrolls sideways to bring the button into view), so it
    // follows the button and only closes once the button is off screen.
    const follow = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b || b.bottom < 0 || b.top > window.innerHeight || b.right < 0 || b.left > window.innerWidth) setRect(null);
      else setRect(b);
    };
    const onKey = (e) => { if (e.key === 'Escape') setRect(null); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, [rect]);

  if (!visible.length) return null;

  const toggle = (e) => {
    e.stopPropagation();
    // Measured now: the event's currentTarget is gone by the time a state
    // updater runs.
    const box = e.currentTarget.getBoundingClientRect();
    setRect(prev => (prev ? null : box));
  };

  const itemHeight = 38;
  const openUp = rect && window.innerHeight - rect.bottom < visible.length * itemHeight + 16;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={!!rect}
        onClick={toggle}
        onMouseEnter={buttonContent ? undefined : e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={buttonContent ? undefined : e => { if (!rect) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
        style={buttonStyle || {
          width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: rect ? 'var(--bg-elevated)' : 'transparent',
          color: rect ? 'var(--text-primary)' : 'var(--text-muted)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {buttonContent || <MoreHorizontal size={17} strokeWidth={2} />}
      </button>
      {rect && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            right: Math.max(8, window.innerWidth - rect.right),
            ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            minWidth: 180, maxWidth: 'calc(100vw - 16px)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
            padding: 4, zIndex: 10000,
          }}
        >
          {visible.map((item, i) => (
            <button
              key={item.label || i}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setRect(null); item.onClick?.(e); }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                padding: '9px 11px', fontSize: 13, borderRadius: 7, whiteSpace: 'nowrap',
                color: item.danger ? 'var(--accent-red)' : 'var(--text-primary)',
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {item.icon && <span style={{ display: 'inline-flex', color: item.danger ? 'var(--accent-red)' : 'var(--text-muted)' }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
