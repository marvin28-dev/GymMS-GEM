import { useState, useEffect } from 'react';

// The phone layout, at the same width as the stylesheet's phone rules
// (index.css). The only such hook: utils/useIsMobile.js used 768 while this
// one used 800, so pages changed layout at different widths (D-53).
const QUERY = '(max-width: 768px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
