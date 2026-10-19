import { useEffect, useRef, useState } from 'react';
import { LIVE_CHANGED } from '../utils/events';

// Re-runs a screen's loader when another screen changes data it shows. With no
// list of resources it reacts to any change in the gym. A burst of changes
// (a member and their first payment) becomes one reload, and a tab coming back
// into view catches up on what it missed while hidden.
export default function useLiveRefresh(reload, resources = null) {
  const fn = useRef(reload);
  fn.current = reload;
  const wanted = resources ? resources.join(',') : '';
  useEffect(() => {
    let timer = null;
    const list = wanted ? wanted.split(',') : null;
    const run = () => { clearTimeout(timer); timer = setTimeout(() => { try { fn.current?.(); } catch { /* the screen shows its own errors */ } }, 350); };
    const onLive = (e) => {
      const r = e.detail?.resource;
      if (!list || r === '*' || list.includes(r)) run();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener(LIVE_CHANGED, onLive);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); window.removeEventListener(LIVE_CHANGED, onLive); document.removeEventListener('visibilitychange', onVisible); };
  }, [wanted]);
}

// For a screen that loads inside an effect: put the tick in that effect's
// dependencies and it re-runs when another screen changes something.
export function useLiveTick(resources = null) {
  const [tick, setTick] = useState(0);
  useLiveRefresh(() => setTick(n => n + 1), resources);
  return tick;
}
