import { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, Monitor, Users, ShoppingBag,
  Settings, CheckCircle, Dumbbell, Sparkles, ClipboardList,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
   Steps — each step may switch tabs via `tabIndex`
   spotlight: CSS selector using data-fdtour attributes
   ───────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    id: 'welcome',
    icon: Monitor,
    color: '#34d399',
    label: 'Welcome',
    title: 'Front Desk Mode',
    subtitle: 'The reception kiosk',
    desc: "This is your gym's front desk — a full-screen touchscreen interface built for the reception counter. It's separate from the management dashboard.",
    bullets: ['Quick member check-in by name or code', 'Record payments & sell day passes on the spot', 'Manage tasks and shift operations'],
    tip: null,
    spotlight: null,
    cardPos: 'center',
    tabIndex: null,
  },
  {
    id: 'header',
    icon: Dumbbell,
    color: '#c9a96e',
    label: 'Header',
    title: 'Gym Overview',
    subtitle: 'Always-visible status bar',
    desc: 'The header shows live gym stats at a glance — total members, active memberships, and staff currently clocked in.',
    bullets: ['Member & membership counts update in real time', 'Gym name and code are always visible', 'Quick access to settings and end-of-day report'],
    tip: 'The header stays fixed as you switch between tabs below.',
    spotlight: '[data-fdtour="header"]',
    cardPos: 'bottom',
    tabIndex: null,
  },
  {
    id: 'checkin-search',
    icon: Users,
    color: '#60a5fa',
    label: 'Check-in',
    title: 'Member Check-in',
    subtitle: 'The most-used feature',
    desc: 'Search any member or staff by name or access code to instantly record their check-in. Works with QR codes too.',
    bullets: ['Type a name or scan a QR code', 'Access code entry (each member gets a unique code)', 'Instant feedback — green = success'],
    tip: 'Try typing "Armand" in the search box to check in a demo member.',
    spotlight: '[data-fdtour="checkin-search"]',
    cardPos: 'bottom-right',
    tabIndex: 0,
  },
  {
    id: 'checkin-recent',
    icon: ClipboardList,
    color: '#a78bfa',
    label: 'Recent',
    title: 'Recent Check-ins',
    subtitle: 'Live activity log',
    desc: "A real-time feed of everyone who walked through the door today. You'll see the time, name, and whether it was a member or staff.",
    bullets: ['Updates immediately on each check-in', 'Shows member vs. staff check-ins', 'Membership status shown inline (active/expired)'],
    tip: null,
    spotlight: '[data-fdtour="checkin-recent"]',
    cardPos: 'bottom-right',
    tabIndex: 0,
  },
  {
    id: 'signup',
    icon: Users,
    color: '#34d399',
    label: 'Sign Up',
    title: 'New Member & Visitor Sign Up',
    subtitle: 'Onboard someone in 30 seconds',
    desc: 'Register a brand-new member or sell a day pass to a visitor without leaving the front desk. No need to open the management dashboard.',
    bullets: ['Full member registration form here at the desk', 'Visitor day pass — name, phone, package, payment', 'Auto-creates member profile and records payment'],
    tip: "Switch to the Sign Up tab to try registering a demo visitor.",
    spotlight: '[data-fdtour="signup"]',
    cardPos: 'top-right',
    tabIndex: 1,
  },
  {
    id: 'product-sale',
    icon: ShoppingBag,
    color: '#f59e0b',
    label: 'Products',
    title: 'Product Sales',
    subtitle: 'Sell at the counter',
    desc: 'Sell gym products — water, supplements, towels, gear — directly from the front desk. All sales are recorded to the daily ledger.',
    bullets: ['Browse all products with price and stock level', 'Select member to attach the sale (optional)', 'Cash or mobile money — auto-updates inventory'],
    tip: null,
    spotlight: '[data-fdtour="product-sale"]',
    cardPos: 'bottom-right',
    tabIndex: 2,
  },
  {
    id: 'operations',
    icon: Settings,
    color: '#fb7185',
    label: 'Operations',
    title: 'Operations & Tasks',
    subtitle: 'Run the shift from here',
    desc: 'Manage the day: log tasks, view staff schedules, check upcoming classes, and run the end-of-day report — all without switching to the main dashboard.',
    bullets: ['Task list for the current shift', 'Staff on duty and class schedule', 'End-of-day summary and cash reconciliation'],
    tip: 'The "End of Day" button generates a full summary report for the shift.',
    spotlight: '[data-fdtour="operations"]',
    cardPos: 'bottom-right',
    tabIndex: 3,
  },
  {
    id: 'done',
    icon: CheckCircle,
    color: '#34d399',
    label: 'Done!',
    title: "You're ready!",
    subtitle: 'Front Desk tour complete',
    desc: "That's everything the front desk can do. Check in a member, sell a product, or register a visitor — it all starts here.",
    bullets: ['Use the ✦ button at the bottom-right to replay this tour', 'Log out to return to staff selection', 'The main dashboard has even more features'],
    tip: null,
    spotlight: null,
    cardPos: 'center',
    tabIndex: null,
  },
];

/* ─────────────────────────────────────────────────────────────────
   Card position resolver (FrontDeskMode is full-screen, no sidebar)
   ───────────────────────────────────────────────────────────────── */
function resolveCardStyle(cardPos, spotRect) {
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
      right: 24,
      top: 100,
      width: 400,
      maxWidth: 'calc(100vw - 48px)',
    };
  }

  if (cardPos === 'bottom') {
    // Card centered below the spotlit header
    return {
      left: '50%',
      transform: 'translateX(-50%)',
      top: spotRect ? spotRect.bottom + 20 : 120,
      width: 440,
      maxWidth: 'calc(100vw - 48px)',
    };
  }

  // bottom-right
  return {
    right: 24,
    bottom: 24,
    width: 400,
    maxWidth: 'calc(100vw - 48px)',
  };
}

/* ─────────────────────────────────────────────────────────────────
   FrontDeskTour component
   ───────────────────────────────────────────────────────────────── */
export default function FrontDeskTour({ setTab }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [fading, setFading] = useState(false);

  /* Auto-show on first visit to Front Desk Mode */
  useEffect(() => {
    const done = localStorage.getItem('gem_fd_tour_done') === '1';
    if (!done) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  /* Switch tab when step changes */
  useEffect(() => {
    if (!show) return;
    if (current.tabIndex !== null) {
      setTab(current.tabIndex);
    }
  }, [step, show]);

  /* Find and track spotlight element */
  const updateRect = useCallback(() => {
    if (!current.spotlight) { setSpotRect(null); return; }
    const el = document.querySelector(current.spotlight);
    if (el) setSpotRect(el.getBoundingClientRect());
  }, [current.spotlight]);

  useEffect(() => {
    if (!show) return;
    setSpotRect(null);
    if (!current.spotlight) return;
    const t1 = setTimeout(updateRect, 150);
    const t2 = setTimeout(updateRect, 500);
    window.addEventListener('resize', updateRect);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateRect);
    };
  }, [step, show, updateRect]);

  const changeStep = (to) => {
    setFading(true);
    setTimeout(() => { setStep(to); setFading(false); }, 180);
  };

  const finish = () => {
    localStorage.setItem('gem_fd_tour_done', '1');
    setShow(false);
  };

  const next = () => isLast ? finish() : changeStep(step + 1);
  const prev = () => !isFirst && changeStep(step - 1);

  if (!show) {
    return <FdTourButton onClick={() => { setStep(0); setShow(true); }} />;
  }

  const Icon = current.icon;
  const cardStyle = resolveCardStyle(current.cardPos, spotRect);
  const PAD = 6;

  return (
    <>
      {/* ── SVG Overlay with spotlight cutout ─────────────────────── */}
      {current.spotlight && spotRect ? (
        <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 8500, pointerEvents: 'none' }}>
          <defs>
            <mask id="gem-fd-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotRect.x - PAD} y={spotRect.y - PAD}
                width={spotRect.width + PAD * 2} height={spotRect.height + PAD * 2}
                rx={10} fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#gem-fd-tour-mask)" />
          <rect
            x={spotRect.x - PAD} y={spotRect.y - PAD}
            width={spotRect.width + PAD * 2} height={spotRect.height + PAD * 2}
            rx={10} fill="none"
            stroke={current.color} strokeWidth="1.5" opacity="0.55"
          />
        </svg>
      ) : (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8500,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: current.cardPos === 'center' ? 'blur(3px)' : 'none',
        }} />
      )}

      {/* ── Tour Card ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        zIndex: 8501,
        fontFamily: 'DM Sans, sans-serif',
        ...cardStyle,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.18s',
        pointerEvents: 'all',
      }}>
        <div style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: `1px solid var(--border-subtle, rgba(255,255,255,0.08))`,
          borderTop: `3px solid ${current.color}`,
          borderRadius: current.cardPos === 'center' ? 20 : 16,
          boxShadow: '0 16px 60px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.4)',
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
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: current.cardPos === 'center' ? 20 : 16, fontWeight: 800, color: 'var(--text-primary, #f0f0f8)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    {current.title}
                  </div>
                </div>
              </div>
              <button onClick={finish} style={{ background: 'var(--bg-elevated, rgba(255,255,255,0.06))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted, #666)', flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>

            {/* Description */}
            <p style={{ fontSize: current.cardPos === 'center' ? 14 : 13, color: 'var(--text-secondary, #aaa)', lineHeight: 1.7, marginBottom: 14 }}>
              {current.desc}
            </p>

            {/* Bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {current.bullets.map(b => (
                <div key={b} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: `${current.color}18`, border: `1px solid ${current.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 8, color: current.color, fontWeight: 900 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', lineHeight: 1.55 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* Tip */}
            {current.tip && (
              <div style={{ background: `${current.color}08`, border: `1px solid ${current.color}22`, borderRadius: 8, padding: '9px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Sparkles size={12} color={current.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', lineHeight: 1.6 }}>
                  <strong style={{ color: current.color }}>Try it: </strong>{current.tip}
                </span>
              </div>
            )}

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => changeStep(i)}
                  style={{
                    flex: 1, height: 3, borderRadius: 2, border: 'none', cursor: 'pointer', padding: 0,
                    background: i < step ? `${current.color}60` : i === step ? current.color : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted, #555)' }}>
                Step {step + 1} of {STEPS.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isFirst && (
                  <button onClick={prev} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary, #aaa)', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 5 }}>
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
                    ? <><Sparkles size={13} /> Start using it</>
                    : <>{STEPS[step + 1]?.label} <ChevronRight size={13} /></>
                  }
                </button>
              </div>
            </div>

            {!isLast && (
              <button onClick={finish} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted, #555)', cursor: 'pointer', fontFamily: 'DM Sans', padding: '3px 0', textAlign: 'center' }}>
                Skip tour
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* Floating replay button — shown in demo mode after tour is done */
function FdTourButton({ onClick }) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Replay Front Desk tour"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 7000,
        background: hov ? '#34d399' : 'rgba(26,26,46,0.95)',
        border: `1.5px solid ${hov ? '#34d399' : 'rgba(52,211,153,0.4)'}`,
        borderRadius: 12,
        padding: hov ? '9px 16px' : '9px 12px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 7,
        boxShadow: hov ? '0 4px 20px rgba(52,211,153,0.35)' : '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'all 0.2s',
        fontFamily: 'DM Sans',
      }}
    >
      <Sparkles size={14} color={hov ? '#0a0a0f' : '#34d399'} />
      {hov && (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0f', whiteSpace: 'nowrap' }}>
          Replay tour
        </span>
      )}
    </button>
  );
}
