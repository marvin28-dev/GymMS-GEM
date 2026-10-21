import { startLive } from './utils/live';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import AppRoutes from './routes/AppRoutes';
import { isAuthed, isDemoMode, clearAuth, touchActivity, isInactive, getHomeRoute, getAuth, updateSessionGym } from './utils/auth';
import { setSessionPhoto } from './utils/sessionPhoto';
import api from './services/api';

/* Sign-in is kept per browser, not per tab. Signing in as someone else in one
   tab used to leave the other tabs showing the old person while acting as the
   new one, so a screen showing a manager could approve things with the owner's
   code. When the stored account changes, every other tab follows at once. */
const accountOf = (raw) => {
  try {
    const a = JSON.parse(raw || 'null');
    return a?.user ? { key: `${a.user.gymId}:${a.user.id}`, gymCode: a.user.gymCode } : null;
  } catch { return null; }
};
function useOneAccountPerBrowser() {
  useEffect(() => {
    let shown = accountOf(localStorage.getItem('gem_auth'));
    const onStorage = (e) => {
      if (e.key !== 'gem_auth' && e.key !== null) return;
      const now = accountOf(localStorage.getItem('gem_auth'));
      if ((now?.key || null) === (shown?.key || null)) return;
      const signedOutOf = shown;
      shown = now;
      if (now) window.location.replace(getHomeRoute());
      else window.location.replace(signedOutOf?.gymCode ? `/${signedOutOf.gymCode}/login` : '/login');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}

// How often an open screen confirms the account is still active
const SESSION_CHECK_MS = 15_000;

/* A screen left open makes no requests, so it would never hear that its
   account was deactivated. This asks every few seconds, and straight away when
   the tab comes back into view. A deactivated answer signs out through the
   api client. */
function useSessionCheck() {
  useEffect(() => {
    const check = () => {
      if (!isAuthed() || document.hidden) return;
      api.get('/auth/me')
        .then(res => {
          // The same answer keeps the gym's details fresh. The owner can move
          // the gym to another currency while a manager has a screen open in
          // another browser; without this it would keep pricing everything in
          // the old one until they signed in again.
          const me = res.data || {};
          const auth = getAuth();
          const changed = auth?.user && (
            (me.gymCurrency || null) !== (auth.user.gymCurrency || null) ||
            (me.gymCountry || null) !== (auth.user.gymCountry || null)
          );
          updateSessionGym({ country: me.gymCountry, city: me.gymCity, currency: me.gymCurrency, name: me.gymName });
          setSessionPhoto(me.photo || null);
          // Money is printed all over every screen from this one value, so the
          // only honest way to change it under an open page is to draw it again.
          if (changed) window.location.reload();
        })
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, SESSION_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
}

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
  useLayoutEffect(() => { navRef.current = navigate; });

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const warningActive = useRef(false);

  // Register activity listeners - paused while warning is showing
  useEffect(() => {
    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const onActivity = () => {
      if (isAuthed() && !isDemoMode() && !warningActive.current) touchActivity();
    };
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    touchActivity(); // stamp immediately on mount

    return () => EVENTS.forEach(e => window.removeEventListener(e, onActivity));
  }, []);

  // Poll for inactivity - fires warning when threshold exceeded
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

  // Countdown tick - runs only while warning is visible
  useEffect(() => {
    if (!showWarning) return;
    if (countdown <= 0) {
      // Time's up - log out
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
  const { t } = useLanguage();
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
          {t('idle.title')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 28 }}>
          {t('idle.body1')}<br />
          {t('idle.body2')}
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
          {t('idle.secondsLeft')}
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
            {t('idle.logOut')}
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
            {t('idle.stay')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   App root
   ───────────────────────────────────────────────────────────────── */
// The app restores its own scroll position on navigation; set once, at load
if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

export default function App() {
  const { showWarning, countdown, stayLoggedIn, logoutNow } = useInactivityLogout();
  useSessionCheck();
  useOneAccountPerBrowser();
  useEffect(() => startLive(), []);
  return (
    <>
      <AppRoutes />
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
