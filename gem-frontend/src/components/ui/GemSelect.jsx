import { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';

// A required field shows " *" after its label. Some labels already carry the
// star in their translation, so it is never added twice.
const withMark = (label, required) =>
  required && !(typeof label === 'string' && /\*\s*$/.test(label)) ? <>{label} *</> : label;

export default function GemSelect({ label, error, options = [], hint, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  const disabled = !!rest.disabled;
  // The label names the box; the error or hint describes it (F-092)
  const autoId = useId();
  const id = rest.id || autoId;
  const noteId = `${id}-note`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 12,
            color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
            marginBottom: 6,
            display: 'block',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
          }}
        >
          {withMark(label, required)}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          onFocus={e => {
            setFocused(true);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={e => {
            setFocused(false);
            rest.onBlur && rest.onBlur(e);
          }}
          style={{
            width: '100%',
            background: disabled ? 'var(--bg-card)' : 'var(--bg-elevated)',
            border: `1px solid ${focused ? 'var(--accent-gold)' : error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
            borderRadius: 10,
            padding: '9px 36px 9px 14px',
            fontSize: 13,
            color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.7 : 1,
            transition: 'border-color 0.15s',
            ...rest.style,
          }}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div
          style={{
            position: 'absolute',
            right: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>
      {error && (
        <span
          id={noteId}
          role="alert"
          data-field-error
          style={{
            fontSize: 11,
            color: 'var(--accent-red)',
            marginTop: 4,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {error}
        </span>
      )}
      {!error && hint && (
        <span
          id={noteId}
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
