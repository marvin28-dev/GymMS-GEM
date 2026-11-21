import { useId } from 'react';

// A person's language, English or French: two buttons in a labelled group,
// the size of a form field. Each language is named in itself, so someone who
// reads only one of them can still find theirs.
const OPTIONS = [['en', 'English'], ['fr', 'Français']];

export default function LanguageChoice({ label, hint, value, onChange, disabled = false }) {
  const id = useId();
  return (
    <div data-language-choice style={{ display: 'flex', flexDirection: 'column' }}>
      <div id={id} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>{label}</div>
      <div role="group" aria-labelledby={id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {OPTIONS.map(([code, name]) => {
          const on = value === code;
          return (
            <button key={code} type="button" data-language={code} aria-pressed={on} disabled={disabled} onClick={() => onChange(code)}
              lang={code}
              style={{
                padding: '9px 12px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                fontWeight: on ? 600 : 500,
                background: on ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                color: on ? 'var(--accent-gold)' : 'var(--text-primary)',
                transition: 'background 0.15s, border-color 0.15s',
              }}>
              {name}
            </button>
          );
        })}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45, fontFamily: 'DM Sans, sans-serif' }}>{hint}</div>}
    </div>
  );
}
