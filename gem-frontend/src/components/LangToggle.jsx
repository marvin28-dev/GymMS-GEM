import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
];

export default function LangToggle({ lang, switchLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: open ? 'var(--bg-elevated)' : 'transparent',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '5px 10px 5px 8px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.3px',
          transition: 'background 0.15s, border-color 0.15s',
          whiteSpace: 'nowrap',
          minHeight: 32,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={13} color="var(--text-muted)" strokeWidth={2} />
        <span style={{ color: 'var(--text-primary)' }}>{current.short}</span>
        <ChevronDown
          size={11}
          color="var(--text-muted)"
          strokeWidth={2.5}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 140,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          {LANGUAGES.map(l => {
            const active = l.code === lang;
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={active}
                onClick={() => { switchLang(l.code); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 14px',
                  background: active ? 'var(--accent-gold-dim, rgba(201,169,110,0.1))' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{l.label}</span>
                {active && <Check size={12} color="var(--accent-gold)" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
