import { useNavigate } from 'react-router-dom';
import { Dumbbell, Users, BarChart2, Calendar, ChevronRight, CheckCircle2, ArrowRight, Zap, Shield, Star, Menu, X } from 'lucide-react';
import { useState } from 'react';

const FEATURES = [
  {
    icon: Users,
    title: 'Member Management',
    desc: 'Track check-ins, memberships, packages, and member profiles — all in one clean interface.',
    color: 'var(--accent-blue)',
    dim: 'var(--accent-blue-dim)',
  },
  {
    icon: BarChart2,
    title: 'Financial Insights',
    desc: 'Payments, accounting, and real-time revenue breakdowns with full FCFA support.',
    color: 'var(--accent-gold)',
    dim: 'var(--accent-gold-dim)',
  },
  {
    icon: Calendar,
    title: 'Operations Hub',
    desc: 'Daily tasks, staff scheduling, class calendar — keep your gym running like clockwork.',
    color: 'var(--accent-green)',
    dim: 'var(--accent-green-dim)',
  },
  {
    icon: Shield,
    title: 'Multi-Role Access',
    desc: 'Admin, manager, trainer, front desk — each role sees exactly what they need.',
    color: 'var(--accent-purple)',
    dim: 'var(--accent-purple-dim)',
  },
];

const STATS = [
  { value: '500+', label: 'Gyms Onboarded' },
  { value: '120k+', label: 'Members Managed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' },
];

const TESTIMONIALS = [
  {
    text: 'GEM transformed how we manage our 400+ members. Payments, attendance, packages — everything in one place.',
    name: 'Marvin Ekokobe',
    role: 'Owner, Elite Fitness Club · Yaoundé',
    initials: 'ME',
    color: '#c9a96e',
  },
  {
    text: 'The financial reporting alone is worth it. We finally have a clear picture of our gym\'s revenue every month.',
    name: 'Sophie Ngono',
    role: 'Manager, PowerGym · Douala',
    initials: 'SN',
    color: '#60a5fa',
  },
  {
    text: 'Setup took less than a day. Our staff loves the front desk mode — check-ins are so much faster now.',
    name: 'Marcel Fonkoua',
    role: 'Director, Iron Body Club · Bamenda',
    initials: 'MF',
    color: '#4ade80',
  },
];

export default function LandingPage() {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(201,169,110,0.3)' }}>
              <Dumbbell size={18} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.1 }}>GEM</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.5px', lineHeight: 1 }}>GymElite Manager</div>
            </div>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavLink onClick={() => nav('/login')}>Sign In</NavLink>
            <GoldBtn onClick={() => nav('/signup')}>Get Started <ArrowRight size={14} strokeWidth={2.5} /></GoldBtn>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '96px 24px 72px', textAlign: 'center', position: 'relative' }}>
        {/* Glow blob */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-gold-dim)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 999, padding: '6px 16px', marginBottom: 32 }}>
          <Zap size={12} color="var(--accent-gold)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-gold)', letterSpacing: '0.3px' }}>
            The #1 Gym Management Platform in Central Africa
          </span>
        </div>

        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(40px, 7vw, 78px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 22, letterSpacing: '-2px' }}>
          Run Your Gym<br />
          <span style={{ background: 'linear-gradient(125deg, #c9a96e 10%, #f0d090 50%, #b08d4a 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Like a Pro.
          </span>
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.75 }}>
          GEM brings your members, payments, staff, and classes into one powerful system — so you can focus on what matters: growing your gym.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          <GoldBtn large onClick={() => nav('/signup')}>
            Request Free Access <ArrowRight size={16} strokeWidth={2.5} />
          </GoldBtn>
          <OutlineBtn large onClick={() => nav('/login')}>
            Sign In to Your Gym <ChevronRight size={16} />
          </OutlineBtn>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['No credit card required', 'Free 30-day trial', '5-minute setup'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle2 size={14} color="var(--accent-green)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ padding: '26px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 30, fontWeight: 800, background: 'linear-gradient(135deg, #c9a96e, #e8c87a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '88px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 14 }}>
            Platform Features
          </div>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 14 }}>
            One platform. Every tool.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Replace spreadsheets, paper logs, and disconnected apps with a single, beautiful system.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '80px 0' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 14 }}>Testimonials</div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Loved by gym owners across Africa
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} color="var(--accent-gold)" fill="var(--accent-gold)" />)}
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18, fontStyle: 'italic' }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${t.color}22`, border: `1px solid ${t.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: t.color }}>{t.initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '88px 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.1) 0%, rgba(201,169,110,0.03) 100%)', border: '1px solid rgba(201,169,110,0.22)', borderRadius: 24, padding: '64px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'var(--accent-gold)', filter: 'blur(100px)', opacity: 0.07, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'var(--accent-blue)', filter: 'blur(80px)', opacity: 0.05, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>Get Started Today</div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 16 }}>
              Ready to transform your gym?
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 36, maxWidth: 460, margin: '0 auto 36px', lineHeight: 1.7 }}>
              Join hundreds of gyms across Africa already using GEM for smarter, faster, more profitable operations.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <GoldBtn large onClick={() => nav('/signup')}>
                Request Free Access <ArrowRight size={16} strokeWidth={2.5} />
              </GoldBtn>
              <OutlineBtn large onClick={() => nav('/login')}>
                Sign In <ChevronRight size={16} />
              </OutlineBtn>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={13} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14 }}>GEM</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· GymElite Manager</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© 2026 GEM. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable micro-components ──────────────────────────────────── */
function NavLink({ onClick, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: 'transparent', border: `1px solid ${hov ? 'var(--accent-gold)' : 'var(--border)'}`, color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.2s' }}
    >
      {children}
    </button>
  );
}

function GoldBtn({ onClick, children, large }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'linear-gradient(135deg, #d4b47a, #c9a96e)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)',
        border: 'none', color: '#0a0a0f', borderRadius: 10,
        padding: large ? '13px 28px' : '8px 18px',
        fontSize: large ? 15 : 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        boxShadow: hov ? '0 4px 20px rgba(201,169,110,0.4)' : '0 2px 10px rgba(201,169,110,0.2)',
        transition: 'all 0.2s', transform: hov ? 'translateY(-1px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function OutlineBtn({ onClick, children, large }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 10,
        padding: large ? '13px 28px' : '8px 18px',
        fontSize: large ? 15 : 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

function FeatureCard({ feature: f }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-card)', border: `1px solid ${hov ? f.color : 'var(--border-subtle)'}`,
        borderRadius: 18, padding: '28px 24px',
        transition: 'all 0.25s',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 8px 28px rgba(0,0,0,0.25)` : 'none',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 13, background: f.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <f.icon size={24} color={f.color} strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{f.title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.desc}</div>
    </div>
  );
}
