import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, Users, CreditCard, Monitor,
  BarChart3, Users2, LayoutGrid, Sparkles, CheckCircle, Dumbbell,
  ShoppingBag, Settings, ClipboardList,
} from 'lucide-react';

const SIDEBAR_W = 260;
const HEADER_H = 64;

/* ─────────────────────────────────────────────────────────────────
   Tour steps
   spotlight: CSS selector — supports both data-tour and data-fdtour attrs
   cardPos:   'center' | 'bottom-right' | 'top-right'
   fdTab:     when set, dispatches gem-fd-tab event so FrontDeskMode
              switches to that tab (0=checkin, 1=signup, 2=products, 3=ops)
   ───────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    id: 'welcome',
    icon: Dumbbell,
    color: '#c9a96e',
    label: 'Welcome',
    title: 'Welcome to GEM',
    subtitle: 'GymElite Manager · Demo',
    desc: "You're inside a fully working gym management system — real members, payments, and staff. This tour walks you through every section including the front desk kiosk.",
    bullets: ['8 members with real membership statuses', '5 staff members across different roles', 'Live payments, attendance & full front desk'],
    tip: null,
    pinInfo: null,
    path: '/dashboard',
    spotlight: null,
    cardPos: 'center',
    fdTab: undefined,
  },
  {
    id: 'sidebar',
    icon: LayoutGrid,
    color: '#a78bfa',
    label: 'Sidebar',
    title: 'Navigate the System',
    subtitle: 'The sidebar is your map',
    desc: 'Every section is one click away. Your staff role controls which sections you can access — a Trainer sees less than a Manager.',
    bullets: ['Dashboard, Members, Attendance, Calendar', 'Front Desk, Tasks, Sales, Operations', 'Payments, Reports, Staff, Settings'],
    tip: 'Try clicking "Members" in the sidebar now — the page changes instantly.',
    pinInfo: null,
    path: '/dashboard',
    spotlight: '[data-tour="sidebar"]',
    cardPos: 'top-right',
    fdTab: undefined,
  },
  {
    id: 'dashboard',
    icon: LayoutGrid,
    color: '#a78bfa',
    label: 'Dashboard',
    title: 'Dashboard Overview',
    subtitle: 'Everything that matters today',
    desc: "Revenue today, active members, check-ins, expiring memberships, and overdue payments — all on one screen when you log in.",
    bullets: ['KPI cards update in real time', 'Alerts for members who need attention', 'Calendar & task overview'],
    tip: 'Scroll down to see the full activity feed and calendar.',
    pinInfo: null,
    path: '/dashboard',
    spotlight: '[data-tour="main-content"]',
    cardPos: 'bottom-right',
    fdTab: undefined,
  },
  {
    id: 'members',
    icon: Users,
    color: '#60a5fa',
    label: 'Members',
    title: 'Member Management',
    subtitle: 'Every member. Every detail.',
    desc: 'The complete member list with status badges, balance, and last check-in. Click any row to open their full profile.',
    bullets: ['Filter by status: active, frozen, expired, visitor', 'Click a member → full profile with history', 'Renew, freeze, cancel, or extend memberships'],
    tip: 'Click on "Armand Kamga" in the list to open his full profile with payment history.',
    pinInfo: null,
    path: '/members',
    spotlight: '[data-tour="main-content"]',
    cardPos: 'bottom-right',
    fdTab: undefined,
  },
  /* ── Front Desk Mode — 5 steps ─────────────────────────────────── */
  {
    id: 'frontdesk-intro',
    icon: Monitor,
    color: '#34d399',
    label: 'Front Desk',
    title: 'Front Desk Mode',
    subtitle: 'Your reception kiosk',
    desc: 'A separate full-screen interface built for the reception counter. No sidebar, no clutter — just the tools staff need to run the desk.',
    bullets: ['Auto-logged in as Manager for this demo', 'Optimised for touchscreen operation', 'Completely separate from the management dashboard'],
    tip: null,
    pinInfo: null,
    path: '/front-desk/mode',
    spotlight: '[data-fdtour="header"]',
    cardPos: 'bottom-right',
    fdTab: 0,
  },
  {
    id: 'frontdesk-checkin',
    icon: Users,
    color: '#34d399',
    label: 'Check-in',
    title: 'Member Check-in',
    subtitle: 'The most-used feature at the desk',
    desc: 'Search any member or staff by name or access code to record their arrival instantly. One tap and they\'re checked in.',
    bullets: ['Type a name or 4-digit access code', 'QR code scanning supported', 'Shows membership status right away (active / expired)'],
    tip: 'Try typing "Armand" to find and check in a demo member.',
    pinInfo: null,
    path: '/front-desk/mode',
    spotlight: '[data-fdtour="checkin-search"]',
    cardPos: 'bottom-right',
    fdTab: 0,
  },
  {
    id: 'frontdesk-recent',
    icon: ClipboardList,
    color: '#34d399',
    label: 'Recent',
    title: 'Recent Check-ins',
    subtitle: 'Live activity log',
    desc: "See everyone who walked in today in real time — members and staff both appear here with timestamps and membership status.",
    bullets: ['Updates immediately after each check-in', 'Distinguishes member vs. staff arrivals', 'Membership status badge on every entry'],
    tip: null,
    pinInfo: null,
    path: '/front-desk/mode',
    spotlight: '[data-fdtour="checkin-recent"]',
    cardPos: 'bottom-right',
    fdTab: 0,
  },
  {
    id: 'frontdesk-products',
    icon: ShoppingBag,
    color: '#f59e0b',
    label: 'Products',
    title: 'Product Sales',
    subtitle: 'Sell at the counter',
    desc: 'Sell gym merchandise, drinks, and supplements directly from the front desk. All sales are logged and feed into the daily revenue report.',
    bullets: ['Browse products with stock level and price', 'Attach sale to a specific member (optional)', 'Cash or mobile money — inventory updates automatically'],
    tip: null,
    pinInfo: null,
    path: '/front-desk/mode',
    spotlight: '[data-fdtour="product-sale"]',
    cardPos: 'bottom-right',
    fdTab: 2,
  },
  {
    id: 'frontdesk-ops',
    icon: Settings,
    color: '#fb7185',
    label: 'Operations',
    title: 'Shift Operations',
    subtitle: 'Run the shift from here',
    desc: 'Manage daily tasks, check who is on duty, view upcoming classes, and generate the end-of-day summary — without switching to the main dashboard.',
    bullets: ['Task checklist for the current shift', 'Staff schedule and class timetable', 'End-of-day cash reconciliation report'],
    tip: null,
    pinInfo: null,
    path: '/front-desk/mode',
    spotlight: '[data-fdtour="operations"]',
    cardPos: 'bottom-right',
    fdTab: 3,
  },
  /* ── Back to main app ──────────────────────────────────────────── */
  {
    id: 'payments',
    icon: CreditCard,
    color: '#f59e0b',
    label: 'Payments',
    title: 'Payment Tracking',
    subtitle: 'Every transaction recorded',
    desc: 'The complete payment ledger for your gym. Filter by date, member, or payment method. See per-member balances at a glance.',
    bullets: ['Cash, card, mobile money, bank transfer', 'Partial payments with balance carry-over', 'Staff-recorded payment attribution'],
    tip: "Use the date filter at the top to see only this month's payments.",
    pinInfo: null,
    path: '/payments',
    spotlight: '[data-tour="main-content"]',
    cardPos: 'bottom-right',
    fdTab: undefined,
  },
  {
    id: 'reports',
    icon: BarChart3,
    color: '#fb7185',
    label: 'Reports',
    title: 'Reports & Accounting',
    subtitle: 'Know your numbers',
    desc: 'Monthly revenue charts, expense breakdown, and membership trends. Everything you need to make smart decisions about your gym.',
    bullets: ['Revenue & expense charts by month', 'Membership growth & retention stats', 'Export summaries for accounting'],
    tip: 'Check this page at month-end for a full financial summary.',
    pinInfo: null,
    path: '/accounting',
    spotlight: '[data-tour="main-content"]',
    cardPos: 'bottom-right',
    fdTab: undefined,
  },
  {
    id: 'staff',
    icon: Users2,
    color: '#a78bfa',
    label: 'Staff',
    title: 'Staff Management',
    subtitle: 'Your team. Your rules.',
    desc: 'Add staff, assign roles, and control access. Track timecards and schedule shifts. Each role automatically limits what the person can see.',
    bullets: ['7 roles: Manager, Trainer, Front Desk, Coach…', 'Role-based access — staff only see what they need', 'Timecard punch in/out per staff member'],
    tip: 'Click any staff card to view their profile, edit their role, or see their schedule.',
    pinInfo: null,
    path: '/staff',
    spotlight: '[data-tour="main-content"]',
    cardPos: 'bottom-right',
    fdTab: undefined,
  },
  {
    id: 'done',
    icon: CheckCircle,
    color: '#34d399',
    label: 'Done!',
    title: "You're all set!",
    subtitle: 'Tour complete — explore freely',
    desc: "That's the whole system. Now it's yours to explore. Click anything, open member profiles, try recording a payment — nothing breaks.",
    bullets: ['Tap ✦ bottom-right anytime to replay this tour', 'Try logging out and signing in as a different role', 'All data resets regularly — feel free to experiment'],
    tip: null,
    pinInfo: null,
    path: '/dashboard',
    spotlight: null,
    cardPos: 'center',
    fdTab: undefined,
  },
];

/* ─────────────────────────────────────────────────────────────────
   Hook — auto-shows tour on first demo login
   ───────────────────────────────────────────────────────────────── */
export function useDemoTour() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isDemo = localStorage.getItem('gem_demo_mode') === '1';
    const done = localStorage.getItem('gem_tour_done') === '1';
    if (isDemo && !done) {
      const t = setTimeout(() => setShow(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const open = () => setShow(true);
  const close = () => {
    setShow(false);
    localStorage.setItem('gem_tour_done', '1');
  };
  return { show, open, close };
}

/* ─────────────────────────────────────────────────────────────────
   Main Tour component
   ───────────────────────────────────────────────────────────────── */
export default function DemoTour({ onClose }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [fading, setFading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  /* Navigate to step's page + switch FD tab if needed */
  useEffect(() => {
    const timers = [];

    if (current.path && location.pathname !== current.path) {
      setNavigating(true);
      nav(current.path);
      timers.push(setTimeout(() => setNavigating(false), 500));
    } else {
      setNavigating(false);
    }

    // Mark FD tour done so FrontDeskTour doesn't auto-show during this tour
    if (current.id.startsWith('frontdesk')) {
      localStorage.setItem('gem_fd_tour_done', '1');
    }

    // Switch FrontDeskMode tab for FD steps
    if (current.fdTab !== undefined) {
      timers.push(setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gem-fd-tab', { detail: { tab: current.fdTab } }));
      }, 600));
    }

    return () => timers.forEach(clearTimeout);
  }, [step]);

  /* Find and track spotlight element */
  const updateRect = useCallback(() => {
    if (!current.spotlight) { setSpotRect(null); return; }
    const el = document.querySelector(current.spotlight);
    if (el) setSpotRect(el.getBoundingClientRect());
  }, [current.spotlight]);

  useEffect(() => {
    setSpotRect(null);
    if (!current.spotlight) return;
    // Delay to let page render after navigation
    const t1 = setTimeout(updateRect, 200);
    const t2 = setTimeout(updateRect, 600);
    window.addEventListener('resize', updateRect);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateRect);
    };
  }, [step, location.pathname, updateRect]);

  const changeStep = (to) => {
    setFading(true);
    setTimeout(() => { setStep(to); setFading(false); }, 200);
  };

  const next = () => isLast ? finish() : changeStep(step + 1);
  const prev = () => !isFirst && changeStep(step - 1);
  const finish = () => { localStorage.setItem('gem_tour_done', '1'); onClose(); };

  const Icon = current.icon;

  /* Card position style */
  const isFrontDesk = location.pathname.startsWith('/front-desk/mode');
  const cardStyle = resolveCardStyle(current.cardPos, spotRect, isFrontDesk);

  /* Spotlight padding */
  const PAD = 6;

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────────── */}
      {current.spotlight && spotRect ? (
        <svg
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 8500, pointerEvents: 'none' }}
        >
          <defs>
            <mask id="gem-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotRect.x - PAD}
                y={spotRect.y - PAD}
                width={spotRect.width + PAD * 2}
                height={spotRect.height + PAD * 2}
                rx={10}
                fill="black"
              />
            </mask>
          </defs>
          {/* Dark overlay with cutout */}
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.70)" mask="url(#gem-tour-mask)" />
          {/* Glowing border around spotlight */}
          <rect
            x={spotRect.x - PAD}
            y={spotRect.y - PAD}
            width={spotRect.width + PAD * 2}
            height={spotRect.height + PAD * 2}
            rx={10}
            fill="none"
            stroke={current.color}
            strokeWidth="1.5"
            opacity="0.5"
          />
        </svg>
      ) : (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8500,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: current.cardPos === 'center' ? 'blur(3px)' : 'none',
        }} />
      )}

      {/* ── Tooltip Card ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        zIndex: 8501,
        fontFamily: 'DM Sans, sans-serif',
        ...cardStyle,
        opacity: fading || navigating ? 0 : 1,
        transition: 'opacity 0.2s',
        pointerEvents: 'all',
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid var(--border-subtle)`,
          borderTop: `3px solid ${current.color}`,
          borderRadius: current.cardPos === 'center' ? 20 : 16,
          boxShadow: '0 16px 60px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: current.cardPos === 'center' ? '24px 28px' : '18px 20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: current.cardPos === 'center' ? 48 : 38,
                  height: current.cardPos === 'center' ? 48 : 38,
                  borderRadius: current.cardPos === 'center' ? 14 : 10,
                  background: `${current.color}15`,
                  border: `1.5px solid ${current.color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: `0 0 20px ${current.color}20`,
                }}>
                  <Icon size={current.cardPos === 'center' ? 24 : 18} color={current.color} strokeWidth={1.7} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: current.color, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 3 }}>
                    {current.subtitle}
                  </div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: current.cardPos === 'center' ? 20 : 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    {current.title}
                  </div>
                </div>
              </div>
              <button onClick={finish} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>

            {/* Description */}
            <p style={{ fontSize: current.cardPos === 'center' ? 14 : 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
              {current.desc}
            </p>

            {/* Bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {current.bullets.map(b => (
                <div key={b} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: `${current.color}18`, border: `1px solid ${current.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 8, color: current.color, fontWeight: 900 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* Front desk PIN table */}
            {current.pinInfo && (
              <div style={{ background: `${current.color}08`, border: `1px solid ${current.color}28`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <Lock size={12} color={current.color} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: current.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Staff PINs — select name then enter PIN
                  </span>
                </div>
                {current.pinInfo.map(p => (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.role}</div>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: current.color, background: `${current.color}18`, padding: '3px 10px', borderRadius: 6, letterSpacing: '2px' }}>
                      {p.pin}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            {current.tip && (
              <div style={{ background: `${current.color}08`, border: `1px solid ${current.color}22`, borderRadius: 8, padding: '9px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Sparkles size={12} color={current.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: current.color }}>Try it: </strong>{current.tip}
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => changeStep(i)}
                  style={{
                    flex: 1, height: 3, borderRadius: 2, border: 'none', cursor: 'pointer', padding: 0,
                    background: i < step ? `${current.color}60` : i === step ? current.color : 'var(--border-subtle)',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            {/* Step counter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Step {step + 1} of {STEPS.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isFirst && (
                  <button onClick={prev} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button onClick={next} style={{
                  background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
                  border: 'none', borderRadius: 8, padding: '9px 18px',
                  fontSize: 13, fontWeight: 700, color: '#0a0a0f',
                  cursor: 'pointer', fontFamily: 'DM Sans',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: `0 3px 14px ${current.color}40`,
                }}>
                  {isLast
                    ? <><Sparkles size={13} /> Explore now</>
                    : <>{STEPS[step + 1]?.label} <ChevronRight size={13} /></>
                  }
                </button>
              </div>
            </div>

            {!isLast && (
              <button onClick={finish} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'DM Sans', padding: '3px 0', textAlign: 'center' }}>
                Skip tour
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Card position resolver
   isFrontDesk: true when on /front-desk/mode (no sidebar)
   ───────────────────────────────────────────────────────────────── */
function resolveCardStyle(cardPos, spotRect, isFrontDesk) {
  if (cardPos === 'center') {
    return {
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 460,
      maxWidth: 'calc(100vw - 40px)',
    };
  }

  if (cardPos === 'top-right') {
    return {
      left: isFrontDesk ? 20 : SIDEBAR_W + 20,
      top: HEADER_H + 20,
      width: 400,
      maxWidth: 'calc(100vw - 60px)',
    };
  }

  // bottom-right
  return {
    right: 24,
    bottom: 24,
    width: 400,
    maxWidth: isFrontDesk ? 'calc(100vw - 48px)' : `calc(100vw - ${SIDEBAR_W + 40}px)`,
  };
}

/* ─────────────────────────────────────────────────────────────────
   Floating replay button (shown in-app during demo mode)
   ───────────────────────────────────────────────────────────────── */
export function DemoTourButton({ onClick }) {
  const [hov, setHov] = useState(false);
  if (localStorage.getItem('gem_demo_mode') !== '1') return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Replay demo tour"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        background: hov ? '#c9a96e' : 'var(--bg-card)',
        border: `1.5px solid ${hov ? '#c9a96e' : 'rgba(201,169,110,0.45)'}`,
        borderRadius: hov ? 12 : 12,
        padding: hov ? '9px 16px' : '9px 12px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 7,
        boxShadow: hov ? '0 4px 20px rgba(201,169,110,0.35)' : '0 2px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
        fontFamily: 'DM Sans',
      }}
    >
      <Sparkles size={14} color={hov ? '#0a0a0f' : '#c9a96e'} />
      {hov && (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0f', whiteSpace: 'nowrap' }}>
          Replay tour
        </span>
      )}
    </button>
  );
}
