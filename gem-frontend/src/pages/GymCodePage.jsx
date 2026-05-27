import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Dumbbell, ArrowRight, Search, Sparkles, Users, CreditCard, Monitor, BarChart3, ChevronRight } from 'lucide-react';
import { getGymByCode } from '../services/gym.service';
import { isAuthed } from '../utils/auth';

export default function GymCodePage() {
  const nav = useNavigate();

  if (isAuthed()) return <Navigate to="/dashboard" replace />;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = code.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) { setError('Please enter your gym code to continue.'); return; }
    setLoading(true);
    setError('');
    try {
      await getGymByCode(trimmed);
      nav(`/${trimmed}/login`);
    } catch {
      setError('Gym not found. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={15} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>GEM</span>
          </div>
          <button onClick={() => nav('/signup')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            New gym? <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>Request access →</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 860, display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'start' }}>

          {/* ── Left: gym code login ───────────────────────────────── */}
          <div style={{ padding: '0 48px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(201,169,110,0.3)' }}>
                <Dumbbell size={26} color="#0a0a0f" strokeWidth={2} />
              </div>
            </div>

            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.4px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
              Enter your gym code to access your management workspace.
            </p>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 24, boxShadow: 'var(--shadow-card)' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Gym Code
              </label>
              <div style={{ position: 'relative', marginBottom: error ? 6 : 16 }}>
                <Search size={16} color={focused ? 'var(--accent-gold)' : 'var(--text-muted)'} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 0.2s' }} />
                <input
                  autoFocus
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(''); }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="e.g. elite-fitness"
                  style={{
                    width: '100%', background: 'var(--bg-elevated)',
                    border: `1.5px solid ${error ? 'var(--accent-red)' : focused ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: 10, padding: '13px 14px 13px 42px',
                    fontSize: 15, color: 'var(--text-primary)', fontFamily: 'DM Sans',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                />
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>⚠ {error}</div>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 12px rgba(201,169,110,0.25)' }}
              >
                {loading ? 'Checking...' : <> Continue <ArrowRight size={16} strokeWidth={2.5} /> </>}
              </button>
            </div>

            <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              No gym code?{' '}
              <span style={{ color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/signup')}>
                Request access
              </span>{' '}
              and our team will set you up.
            </p>
          </div>

          {/* Divider */}
          <div style={{ background: 'var(--border-subtle)', alignSelf: 'stretch' }} />

          {/* ── Right: demo section ────────────────────────────────── */}
          <div style={{ padding: '0 0 0 48px' }}>
            {/* Header */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 20, padding: '5px 13px', marginBottom: 20 }}>
              <Sparkles size={12} color="#c9a96e" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a96e', letterSpacing: '0.5px' }}>Free Demo</span>
            </div>

            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              Try the system<br />before you commit
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
              Explore a fully populated demo gym — real members, payments, staff, and more. No setup, no credit card.
            </p>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { icon: Users,      text: 'Manage members & memberships' },
                { icon: CreditCard, text: 'Track payments & balances' },
                { icon: Monitor,    text: 'Front desk check-in mode' },
                { icon: BarChart3,  text: 'Reports & analytics' },
              ].map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(201,169,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} color="#c9a96e" />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Demo gym card */}
            <DemoCard onSelect={() => nav('/elite/login')} />

            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
              A guided tour will walk you through the system after you sign in.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function DemoCard({ onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        background: hov ? 'rgba(201,169,110,0.08)' : 'var(--bg-card)',
        border: `2px solid ${hov ? '#c9a96e' : 'rgba(201,169,110,0.3)'}`,
        borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
        fontFamily: 'DM Sans', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', transition: 'all 0.2s',
        boxShadow: hov ? '0 4px 20px rgba(201,169,110,0.15)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Dumbbell size={20} color="#0a0a0f" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Elite Fitness Club</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Yaoundé, Cameroon · 8 members · 5 staff</div>
          <div style={{ fontSize: 11, color: '#c9a96e', fontWeight: 600 }}>
            ✦ Includes guided tour after sign-in
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: hov ? '#c9a96e' : 'rgba(201,169,110,0.12)', borderRadius: 8, padding: '7px 12px', transition: 'all 0.2s', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: hov ? '#0a0a0f' : '#c9a96e' }}>Try Demo</span>
        <ChevronRight size={14} color={hov ? '#0a0a0f' : '#c9a96e'} />
      </div>
    </button>
  );
}
