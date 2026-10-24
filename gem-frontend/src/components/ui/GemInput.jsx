import { useState, useId } from 'react';
import TimeInput from './TimeInput';

// A required field shows " *" after its label. Some labels already carry the
// star in their translation, so it is never added twice.
const withMark = (label, required) =>
  required && !(typeof label === 'string' && /\*\s*$/.test(label)) ? <>{label} *</> : label;

export default function GemInput({ label, error, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  // The label names the box and the error is tied to it, for screen readers
  // and for a click on the label (F-092)
  const autoId = useId();
  const id = rest.id || autoId;
  const errorId = `${id}-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            display: 'block',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
          }}
        >
          {withMark(label, required)}
        </label>
      )}
      {rest.type === 'time' ? (
        <TimeInput value={rest.value} onChange={rest.onChange} disabled={rest.disabled} id={id} name={rest.name}
          aria-label={typeof label === 'string' ? label.replace(/\s*\*\s*$/, '') : undefined}
          style={{ ...(error ? { borderColor: 'var(--accent-red)' } : {}), ...rest.style }} />
      ) : (
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : rest['aria-describedby']}
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
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--accent-gold)' : error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
          borderRadius: 10,
          padding: '9px 14px',
          fontSize: 13,
          color: 'var(--text-primary)',
          fontFamily: 'DM Sans, sans-serif',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          ...rest.style,
        }}
      />
      )}
      {error && (
        <span
          id={errorId}
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
    </div>
  );
}
