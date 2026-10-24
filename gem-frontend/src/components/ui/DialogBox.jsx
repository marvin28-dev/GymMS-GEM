import { useEffect, useRef } from 'react';
import { useDialogFocus, isTopDialog } from '../../hooks/useDialogFocus';

// The box of a pop-up drawn by hand, with its own backdrop and layout. To the
// keyboard and screen readers it is a dialog like the shared Modal (F-135):
// named, focus moves in and stays in, Escape closes it when it is on top, and
// focus goes back to what opened it. Rendered only while the pop-up is open.
export default function DialogBox({ label, onClose, style, children, ...rest }) {
  const ref = useRef(null);
  useDialogFocus(true, ref);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && closeRef.current && isTopDialog(ref.current)) closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ outline: 'none', ...style }} {...rest}>
      {children}
    </div>
  );
}
