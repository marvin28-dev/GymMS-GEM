import { useState } from 'react';

export default function GemInput({ label, error, ...rest }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            display: 'block',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      <input
        {...rest}
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
      {error && (
        <span
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
