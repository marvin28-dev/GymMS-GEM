import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Dumbbell, ArrowRight, ChevronRight, Search } from 'lucide-react';
import { getGymByCode } from '../services/gym.service';
import { isAuthed } from '../utils/auth';

const DEMO_CODES = [
  { code: 'elite', label: 'Elite Fitness Club', location: 'Yaoundé' },
];

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={15} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>GEM</span>
          </div>
          <button onClick={() => nav('/signup')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'DM Sans' }}>
            New gym? <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>Request access</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(201,169,110,0.35)' }}>
              <Dumbbell size={30} color="#0a0a0f" strokeWidth={2} />
            </div>
          </div>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.4px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Enter your gym code to access your workspace.
            </p>
          </div>

          {/* Card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '28px', boxShadow: 'var(--shadow-card)' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              GYM CODE
            </label>
            <div style={{ position: 'relative', marginBottom: error ? 6 : 20 }}>
              <Search size={16} color={focused ? 'var(--accent-gold)' : 'var(--text-muted)'} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', pointerEvents: 'none' }} />
              <input
                autoFocus
                value={code}
                onChange={e => { setCode(e.target.value); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. elite-fitness or gem"
                style={{
                  width: '100%', background: 'var(--bg-elevated)',
                  border: `1.5px solid ${error ? 'var(--accent-red)' : focused ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                  borderRadius: 10, padding: '13px 14px 13px 42px',
                  fontSize: 15, color: 'var(--text-primary)', fontFamily: 'DM Sans',
                  outline: 'none', boxSizing: 'border-box', letterSpacing: '0.3px',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>⚠ {error}</div>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 12px rgba(201,169,110,0.25)' }}
            >
              {loading ? 'Checking...' : <> Continue <ArrowRight size={16} strokeWidth={2.5} /> </>}
            </button>
          </div>

          {/* Demo gyms */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center', marginBottom: 12 }}>
              Try a demo gym
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_CODES.map(g => (
                <DemoGym key={g.code} gym={g} onSelect={() => nav(`/${g.code}/login`)} />
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Don't have a gym code?{' '}
            <span style={{ color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/signup')}>
              Request access
            </span>{' '}
            and our team will set you up.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoGym({ gym, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${hov ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Dumbbell size={13} color="var(--accent-gold)" />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{gym.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gym.location} · code: <span style={{ color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace' }}>{gym.code}</span></div>
        </div>
      </div>
      <ChevronRight size={15} color={hov ? 'var(--accent-gold)' : 'var(--text-muted)'} style={{ transition: 'color 0.18s' }} />
    </button>
  );
}
