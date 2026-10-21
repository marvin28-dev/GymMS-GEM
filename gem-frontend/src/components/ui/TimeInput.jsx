import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown, Check } from 'lucide-react';

// The one way to pick a time in GEM, in place of the browser's own time box.
// A field like any other; clicking it drops down a list of times every 15
// minutes, already scrolled to the chosen one, and one click picks. An exact
// time can be typed instead (10:31, 1031 or 10.31). On a phone, tapping just
// opens the list, without the keyboard covering it.
// onChange gets { target: { value: 'HH:MM' } }, like an <input>, so a form
// written for <input type="time"> works unchanged.
const pad = (n) => String(n).padStart(2, '0');
const toText = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const toMins = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// What someone typed, read as a time: 10:31, 10.31, 10h31, 1031, 930, 9
function readTyped(text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return '';
  let h, m;
  const parts = s.split(/[:.h\s]/).filter(Boolean);
  if (parts.length >= 2) { h = Number(parts[0]); m = Number(parts[1]); }
  else {
    const d = s.replace(/\D/g, '');
    if (d.length <= 2) { h = Number(d); m = 0; }
    else { h = Number(d.slice(0, d.length - 2)); m = Number(d.slice(-2)); }
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
  return toText(h * 60 + m);
}

export default function TimeInput({ value, onChange, disabled = false, style = {}, placeholder = '--:--', step = 15, id, name, title, 'aria-label': ariaLabel, ...rest }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [draft, setDraft] = useState(null);
  const [active, setActive] = useState(-1);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const cur = toMins(value);
  const times = Array.from({ length: Math.round(1440 / step) }, (_, i) => i * step);
  const emit = (v) => onChange?.({ target: { value: v, name } });

  const show = () => {
    if (disabled || open) return;
    setRect(fieldRef.current?.getBoundingClientRect() || null);
    const near = cur ?? (new Date().getHours() * 60);
    setActive(times.findIndex(t => t >= near - step / 2) === -1 ? times.length - 1 : times.findIndex(t => t >= near - step / 2));
    setOpen(true);
  };
  const hide = () => { setOpen(false); setDraft(null); };
  const commitDraft = () => {
    if (draft === null) return;
    const v = readTyped(draft);
    if (v !== null && v !== (value || '')) emit(v);
    setDraft(null);
  };
  const pick = (mins) => { emit(toText(mins)); setDraft(null); setOpen(false); };

  // Scroll the list so the chosen (or nearest) time sits in the middle
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${active}"]`);
    if (el) listRef.current.scrollTop = el.offsetTop - listRef.current.clientHeight / 2 + el.offsetHeight / 2;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (listRef.current?.contains(e.target) || fieldRef.current?.contains(e.target)) return;
      commitDraft(); setOpen(false);
    };
    const follow = () => {
      const b = fieldRef.current?.getBoundingClientRect();
      if (!b || b.bottom < 0 || b.top > window.innerHeight) hide(); else setRect(b);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  });

  const onKey = (e) => {
    if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); hide(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      const next = Math.max(0, Math.min(times.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (draft !== null) { commitDraft(); setOpen(false); } else if (open && active >= 0) pick(times[active]); else show();
      return;
    }
    if (e.key === 'Tab') { commitDraft(); setOpen(false); }
  };

  const H = touch ? 44 : 36;
  const listH = Math.min(H * 7 + 8, 280);
  let pos = null;
  if (open && rect) {
    const width = Math.max(rect.width, 150);
    const below = window.innerHeight - rect.bottom;
    const up = below < listH + 12 && rect.top > below;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    pos = up ? { bottom: window.innerHeight - rect.top + 4, left, width } : { top: rect.bottom + 4, left, width };
  }

  const shown = draft !== null ? draft : (cur !== null ? toText(cur) : '');
  return (
    <>
      <div ref={fieldRef} onMouseDown={(e) => { if (e.target !== inputRef.current) { e.preventDefault(); inputRef.current?.focus(); } show(); }}
        style={{
          width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px',
          fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif',
          ...style,
          ...(open ? { borderColor: 'var(--accent-gold)' } : {}),
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : (style.opacity ?? 1),
        }}>
        <Clock size={14} style={{ color: open ? 'var(--accent-gold)' : 'var(--text-muted)', flexShrink: 0 }} />
        <input ref={inputRef} id={id} name={name} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          readOnly={touch} disabled={disabled} value={shown} placeholder={placeholder} title={title}
          aria-label={ariaLabel} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-autocomplete="none"
          data-time-input data-value={value || ''} {...rest}
          onFocus={show}
          onChange={(e) => { setDraft(e.target.value.replace(/[^\d:.hH ]/g, '').slice(0, 5)); if (!open) show(); }}
          onBlur={() => { commitDraft(); }}
          onKeyDown={onKey}
          style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: 0, margin: 0, font: 'inherit', fontVariantNumeric: 'tabular-nums', color: 'inherit', cursor: 'inherit' }} />
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>
      {open && pos && createPortal(
        <div ref={listRef} role="listbox" aria-label={ariaLabel || title} data-time-panel
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'fixed', zIndex: 10001, ...pos, maxHeight: listH, overflowY: 'auto', boxSizing: 'border-box', padding: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: 'var(--shadow-elevated, 0 12px 32px rgba(0,0,0,0.35))', scrollbarWidth: 'thin',
          }}>
          {times.map((t, i) => {
            const on = cur === t, hour = t % 60 === 0;
            return (
              <div key={t} role="option" aria-selected={on} data-index={i} data-time-option={toText(t)}
                onMouseEnter={() => setActive(i)} onClick={() => pick(t)}
                style={{
                  height: H, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: touch ? 15 : 13.5, fontVariantNumeric: 'tabular-nums',
                  fontWeight: on ? 700 : hour ? 600 : 400,
                  color: on ? 'var(--accent-gold)' : hour ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: on ? 'var(--accent-gold-dim)' : i === active ? 'var(--bg-elevated)' : 'transparent',
                }}>
                {toText(t)}
                {on && <Check size={14} />}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
