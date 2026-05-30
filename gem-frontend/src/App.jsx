import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import DemoTour, { useDemoTour, DemoTourButton } from './components/DemoTour';
import { isAuthed, isDemoMode, clearAuth, touchActivity, isInactive } from './utils/auth';

// Auto-logout after 30 minutes of inactivity (skipped in demo mode).
// Listens for any user interaction and resets the timer on each event.
function useInactivityLogout() {
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  useEffect(() => {
    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    const onActivity = () => {
      if (isAuthed() && !isDemoMode()) touchActivity();
    };

    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    touchActivity(); // stamp immediately so fresh logins aren't instantly kicked

    const interval = setInterval(() => {
      if (isAuthed() && !isDemoMode() && isInactive()) {
        clearAuth();
        navRef.current('/login', { replace: true });
      }
    }, 60_000); // check every 60 seconds

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function App() {
  useInactivityLogout();
  const { show, open, close } = useDemoTour();
  return (
    <>
      <AppRoutes />
      {show && <DemoTour onClose={close} />}
      {!show && <DemoTourButton onClick={open} />}
    </>
  );
}
