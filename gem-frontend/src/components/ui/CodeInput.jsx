import { useId } from 'react';

// A box for a 4-6 digit check-in or manager code. It is deliberately NOT a
// password field: browsers (Firefox above all) offer a saved login for any
// password field and filled in a code nobody had typed. This is plain text the
// browser has no reason to fill, and it draws its own dots.
export default function CodeInput({ value = '', onChange, onEnter, maxLength = 6, style, ...rest }) {
  const name = `gem-code-${useId().replace(/[^a-z0-9]/gi, '')}`;
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      name={name}
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      value={'•'.repeat(value.length)}
      onChange={(e) => {
        // The dots left stand for the digits kept from the start; anything else
        // typed or pasted is new.
        const shown = e.target.value;
        const kept = (shown.match(/•/g) || []).length;
        const next = (value.slice(0, kept) + shown.replace(/•/g, '').replace(/\D/g, '')).slice(0, maxLength);
        onChange?.(next);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); rest.onKeyDown?.(e); }}
      style={style}
    />
  );
}
