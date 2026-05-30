import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import AppRoutes from './routes/AppRoutes';
import DemoTour, { useDemoTour, DemoTourButton } from './components/DemoTour';
import { isAuthed, isDemoMode, clearAuth, touchActivity, isInactive } from './utils/auth';

// Seconds the user has to respond before being force-logged-out
const WARNING_SECONDS = 30;

/* ─────────────────────────────────────────────────────────────────
   Inactivity hook
   - Listens for user interaction and stamps a timestamp
   - Every 10s checks if the inactivity threshold was exceeded
   - When exceeded: shows a warning instead of logging out immediately
   - If the user doesn't respond within WARNING_SECONDS, logout
   - Pauses activity tracking while the warning is visible (so only
     the explicit "I'm still here" button can dismiss it)
   ───────────────────────────────────────────────────────────────── */
function useInactivityLogout() {
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const warningActive = useRef(false);

  // Register activity listeners — paused while warning is showing
  useEffect(() => {
    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const onActivity = () => {
      if (isAuthed() && !isDemoMode() && !warningActive.current) touchActivity();
    };
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    touchActivity(); // stamp immediately on mount

    return () => EVENTS.forEach(e => window.removeEventListener(e, onActivity));
  }, []);

  // Poll for inactivity — fires warning when threshold exceeded
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAuthed() && !isDemoMode() && isInactive() && !warningActive.current) {
        warningActive.current = true;
        setCountdown(WARNING_SECONDS);
        setShowWarning(true);
      }
    }, 10_000); // check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Countdown tick — runs only while warning is visible
  useEffect(() => {
    if (!showWarning) return;
    if (countdown <= 0) {
      // Time's up — log out
      warningActive.current = false;
      setShowWarning(false);
      setCountdown(WARNING_SECONDS);
      clearAuth();
      navRef.current('/login', { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showWarning, countdown]);

  const stayLoggedIn = () => {
    touchActivity();
    warningActive.current = false;
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);
  };

  const logoutNow = () => {
    warningActive.current = false;
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);
    clearAuth();
    navRef.current('/login', { replace: true });
  };

  return { showWarning, countdown, stayLoggedIn, logoutNow };
}

/* ─────────────────────────────────────────────────────────────────
   Warning modal
   ───────────────────────────────────────────────────────────────── */
function InactivityWarning({ countdown, onStay, onLogout }) {
  const pct = `${(countdown / WARNING_SECONDS) * 100}%`;
  const urgent = countdown <= 10;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderTop: `3px solid ${urgent ? '#f87171' : '#f59e0b'}`,
        borderRadius: 20,
        padding: '36px 40px',
        maxWidth: 420,
        width: 'calc(100% - 48px)',
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
        transition: 'border-color 0.3s',
      }}>
        {/* Icon */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: urgent ? 'rgba(248,113,113,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1.5px solid ${urgent ? 'rgba(248,113,113,0.35)' : 'rgba(245,158,11,0.35)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 22px',
          transition: 'all 0.3s',
        }}>
          <Clock size={26} color={urgent ? '#f87171' : '#f59e0b'} />
        </div>

        {/* Heading */}
        <div style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 21, fontWeight: 800,
          color: 'var(--text-primary)', marginBottom: 10,
        }}>
          Are you still there?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 28 }}>
          You've been inactive for a while.<br />
          For your security, you'll be logged out automatically.
        </div>

        {/* Countdown number */}
        <div style={{
          fontSize: 56, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
          color: urgent ? '#f87171' : '#f59e0b',
          lineHeight: 1, marginBottom: 6,
          transition: 'color 0.3s',
        }}>
          {countdown}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 24,
        }}>
          seconds remaining
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, background: 'var(--bg-elevated)', borderRadius: 2,
          marginBottom: 28, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: urgent ? '#f87171' : '#f59e0b',
            width: pct,
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onLogout}
            style={{
              flex: 1, padding: '12px 0',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans',
            }}
          >
            Log out
          </button>
          <button
            onClick={onStay}
            style={{
              flex: 2, padding: '12px 0',
              background: urgent
                ? 'linear-gradient(135deg, #f87171, #ef4444)'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              color: '#0a0a0f', cursor: 'pointer', fontFamily: 'DM Sans',
              boxShadow: urgent
                ? '0 4px 16px rgba(248,113,113,0.35)'
                : '0 4px 16px rgba(245,158,11,0.35)',
              transition: 'all 0.3s',
            }}
          >
            Yes, I'm still here
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   App root
   ───────────────────────────────────────────────────────────────── */
export default function App() {
  const { showWarning, countdown, stayLoggedIn, logoutNow } = useInactivityLogout();
  const { show, open, close } = useDemoTour();
  return (
    <>
      <AppRoutes />
      {show && <DemoTour onClose={close} />}
      {!show && <DemoTourButton onClick={open} />}
      {showWarning && (
        <InactivityWarning
          countdown={countdown}
          onStay={stayLoggedIn}
          onLogout={logoutNow}
        />
      )}
    </>
  );
}
