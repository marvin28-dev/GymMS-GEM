import { useEffect } from 'react';

// How a dialog behaves for the keyboard and screen readers (F-096): focus
// moves into it when it opens, Tab stays inside it, and focus goes back to
// whatever opened it when it closes. With one dialog over another, only the
// one on top answers the keys.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The dialog drawn last is the one on top
export function isTopDialog(el) {
  const all = document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
  return !!el && all[all.length - 1] === el;
}

export function useDialogFocus(open, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    // A field inside may have taken focus itself (autoFocus); otherwise the
    // dialog does, so a phone's keyboard does not pop up uninvited
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    });
    const onKey = (e) => {
      const el = ref.current;
      if (e.key !== 'Tab' || !el || !isTopDialog(el)) return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter(x => x.getClientRects().length > 0);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === el || !el.contains(at))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
