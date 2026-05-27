import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, Users, CreditCard, Monitor,
  BarChart3, Users2, LayoutGrid, Settings, Sparkles, ArrowRight,
  CheckCircle, Dumbbell,
} from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    icon: Dumbbell,
    color: '#c9a96e',
    label: 'Welcome',
    title: 'Welcome to GEM',
    subtitle: 'GymElite Manager',
    desc: "You're now inside a fully working gym management system. This short tour will show you around — it only takes 2 minutes.",
    tip: null,
    path: null,
    bullets: ['Real member & payment data', 'Role-based staff access', 'All features unlocked'],
  },
  {
    id: 'dashboard',
    icon: LayoutGrid,
    color: '#a78bfa',
    label: 'Dashboard',
    title: 'Your Command Centre',
    subtitle: 'Dashboard',
    desc: 'The dashboard gives you an instant snapshot of your gym: daily check-ins, revenue today, active members, and any urgent alerts.',
    tip: 'Click Dashboard in the sidebar to see today\'s overview.',
    path: '/dashboard',
    bullets: ['KPIs at a glance', 'Pending tasks & alerts', 'Recent activity feed'],
  },
  {
    id: 'members',
    icon: Users,
    color: '#60a5fa',
    label: 'Members',
    title: 'Manage Your Members',
    subtitle: 'Members',
    desc: 'Every member has a full profile: membership status, payment history, attendance log, notes, and messages — all in one place.',
    tip: 'Click any member row to open their full profile.',
    path: '/members',
    bullets: ['Active, frozen, expired, visitor statuses', 'Renew, freeze, cancel memberships', 'Track balance & payment history'],
  },
  {
    id: 'frontdesk',
    icon: Monitor,
    color: '#34d399',
    label: 'Front Desk',
    title: 'Front Desk Mode',
    subtitle: 'Quick Check-in',
    desc: 'A touchscreen-optimised interface designed for your receptionist. Members tap their code to check in. Payments are recorded in seconds.',
    tip: 'Perfect for a tablet at your front counter.',
    path: '/front-desk',
    bullets: ['One-tap member check-in', 'Record payments on the spot', 'Visitor & day-pass management'],
  },
  {
    id: 'payments',
    icon: CreditCard,
    color: '#f59e0b',
    label: 'Payments',
    title: 'Track Every Payment',
    subtitle: 'Payments & Finance',
    desc: 'Every franc in and out is recorded. See the full payment history, member balances, and filter by date, method, or staff member.',
    tip: 'Use the Payments page to audit any transaction.',
    path: '/payments',
    bullets: ['Cash, card, mobile money', 'Per-member balance tracking', 'Partial payment support'],
  },
  {
    id: 'reports',
    icon: BarChart3,
    color: '#fb7185',
    label: 'Reports',
    title: 'Business Analytics',
    subtitle: 'Reports & Accounting',
    desc: 'Revenue trends, attendance patterns, and expense breakdowns — everything you need to make smart decisions about your gym.',
    tip: 'Check Reports at end of month for a full financial summary.',
    path: '/accounting',
    bullets: ['Monthly revenue charts', 'Expense tracking', 'Attendance trends'],
  },
  {
    id: 'staff',
    icon: Users2,
    color: '#a78bfa',
    label: 'Staff',
    title: 'Manage Your Team',
    subtitle: 'Staff & Operations',
    desc: 'Add staff, assign roles (Manager, Trainer, Front Desk…), track their timecards, and control what each person can access.',
    tip: 'Each role automatically limits what staff can see and do.',
    path: '/staff',
    bullets: ['7 role types with custom access', 'Timecard punch in/out', 'Staff schedule management'],
  },
  {
    id: 'done',
    icon: CheckCircle,
    color: '#34d399',
    label: 'Done',
    title: "You're all set!",
    subtitle: 'Tour Complete',
    desc: 'That\'s the full system. Now explore on your own — click anything in the sidebar, open member profiles, try recording a payment.',
    tip: null,
    path: null,
    bullets: ['Click the ? button anytime to replay this tour', 'Use the sidebar to navigate', 'Try different staff roles for different views'],
  },
];

const TOUR_DONE_KEY = 'gem_tour_done';

export function useDemoTour() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isDemoMode = localStorage.getItem('gem_demo_mode') === '1';
    const tourDone = localStorage.getItem(TOUR_DONE_KEY) === '1';
    if (isDemoMode && !tourDone) {
      setTimeout(() => setShow(true), 600);
    }
  }, []);

  const open = () => setShow(true);
  const close = () => {
    setShow(false);
    localStorage.setItem(TOUR_DONE_KEY, '1');
  };

  return { show, open, close };
}

export default function DemoTour({ onClose }) {
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState(0);
  const [fading, setFading] = useState(false);
  const nav = useNavigate();

  const total = STEPS.length;
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === total - 1;
  const isFirst = step === 0;

  const transition = (newStep, dir) => {
    setFading(true);
    setAnimDir(dir);
    setTimeout(() => {
      setStep(newStep);
      setFading(false);
    }, 180);
  };

  const next = () => {
    if (isLast) { finish(); return; }
    if (STEPS[step + 1].path) nav(STEPS[step + 1].path);
    transition(step + 1, 1);
  };

  const prev = () => {
    if (isFirst) return;
    if (STEPS[step - 1].path) nav(STEPS[step - 1].path);
    transition(step - 1, -1);
  };

  const jumpTo = (i) => {
    if (STEPS[i].path) nav(STEPS[i].path);
    transition(i, i > step ? 1 : -1);
  };

  const finish = () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(6,6,10,0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 24,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Coloured top strip */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${current.color}, ${current.color}88)`, transition: 'background 0.4s' }} />

        {/* Close button */}
        <button
          onClick={finish}
          style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s' }}
        >
          <X size={15} />
        </button>

        {/* Step indicator pills */}
        <div style={{ display: 'flex', gap: 4, padding: '18px 24px 0', flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => jumpTo(i)}
              title={s.label}
              style={{
                height: 4, flex: 1, minWidth: 12,
                background: i <= step ? current.color : 'var(--border-subtle)',
                border: 'none', borderRadius: 2, cursor: 'pointer',
                transition: 'background 0.3s',
                opacity: i === step ? 1 : i < step ? 0.6 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Step counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {current.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step + 1} / {total}</span>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px 28px 28px',
          opacity: fading ? 0 : 1,
          transform: fading ? `translateX(${animDir * 20}px)` : 'translateX(0)',
          transition: 'opacity 0.18s, transform 0.18s',
        }}>
          {/* Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: `${current.color}15`, border: `2px solid ${current.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 30px ${current.color}20` }}>
              <Icon size={28} color={current.color} strokeWidth={1.6} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: current.color, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>{current.subtitle}</div>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0 }}>{current.title}</h3>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 18 }}>
            {current.desc}
          </p>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: current.tip ? 18 : 24 }}>
            {current.bullets.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${current.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, color: current.color, fontWeight: 900 }}>✓</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Tip */}
          {current.tip && (
            <div style={{ background: `${current.color}0c`, border: `1px solid ${current.color}25`, borderRadius: 10, padding: '10px 14px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Sparkles size={13} color={current.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}><strong style={{ color: current.color }}>Try it:</strong> {current.tip}</span>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isFirst && (
              <button
                onClick={prev}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                flex: 1, background: `linear-gradient(135deg, ${current.color}, ${current.color}bb)`,
                border: 'none', borderRadius: 10, padding: '12px 20px',
                fontSize: 14, fontWeight: 700, color: '#0a0a0f',
                cursor: 'pointer', fontFamily: 'DM Sans',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 16px ${current.color}35`,
                transition: 'all 0.2s',
              }}
            >
              {isLast ? (
                <><Sparkles size={14} /> Start Exploring</>
              ) : (
                <>{STEPS[step + 1] ? `Next: ${STEPS[step + 1].label}` : 'Next'} <ChevronRight size={14} /></>
              )}
            </button>
          </div>

          {!isLast && (
            <button onClick={finish} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'DM Sans', padding: '4px 0' }}>
              Skip tour → go straight to the dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Floating replay button shown inside the app during demo mode */
export function DemoTourButton({ onClick }) {
  const [hov, setHov] = useState(false);
  const isDemoMode = localStorage.getItem('gem_demo_mode') === '1';
  if (!isDemoMode) return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Replay tour"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 8000,
        background: hov ? '#c9a96e' : 'var(--bg-card)',
        border: `1.5px solid ${hov ? '#c9a96e' : 'rgba(201,169,110,0.4)'}`,
        borderRadius: 14, padding: hov ? '10px 18px' : '10px 14px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'all 0.2s', fontFamily: 'DM Sans',
      }}
    >
      <Sparkles size={15} color={hov ? '#0a0a0f' : '#c9a96e'} />
      {hov && <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0f', whiteSpace: 'nowrap' }}>Replay tour</span>}
    </button>
  );
}
