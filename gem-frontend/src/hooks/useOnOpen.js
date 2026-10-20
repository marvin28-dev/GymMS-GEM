import { useEffect, useRef } from 'react';

// Runs fill once each time a dialog opens, and not again while it stays open.
// Pages reload on every change in the gym, so a form refilled from the
// reloaded record would wipe what was being typed.
export default function useOnOpen(open, fill) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) fill();
    wasOpen.current = open;
  });
}
