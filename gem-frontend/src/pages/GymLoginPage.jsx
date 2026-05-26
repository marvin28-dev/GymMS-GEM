import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Dumbbell, MapPin, Lock, Mail, LogIn } from 'lucide-react';
import { setAuth, isAuthed } from '../utils/auth';
import { login as loginApi } from '../services/auth.service';
import { getGymByCode } from '../services/gym.service';

const DEFAULT_GYM = { name: 'Loading...', location: '', color: '#c9a96e', bg: 'rgba(201,169,110,0.07)', initials: '...', tagline: 'Welcome back' };

function buildBranding(gym) {
  const words = gym.name.split(' ');
  const initials = words.length >= 2
    ? words[0][0] + words[1][0]
    : gym.name.slice(0, 3).toUpperCase();
  return { ...DEFAULT_GYM, name: gym.name, location: gym.location || '', initials };
}

export default function GymLoginPage() {
  const { gymCode } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    if (isAuthed()) nav('/dashboard', { replace: true });
  }, []);

  const [gymInfo, setGymInfo] = useState(DEFAULT_GYM);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputFocus, setInputFocus] = useState('');

  useEffect(() => {
    getGymByCode(gymCode)
      .then(res => setGymInfo(buildBranding(res.data)))
      .catch(() => nav('/login'));
  }, [gymCode]);

  const gym = gymInfo;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password.trim()) e.password = 'Password is required';
    return e;
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await loginApi(gymCode, form.email, form.password);
      setAuth({ token: res.data.token, user: res.data.user });
      nav('/dashboard');
    } catch (err) {
      setApiError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (name) => ({
    width: '100%', background: 'var(--bg-elevated)',
    border: `1.5px solid ${errors[name] ? 'var(--accent-red)' : inputFocus === name ? gym.color : 'var(--border-subtle)'}`,
    borderRadius: 10, padding: '12px 14px 12px 42px',
    fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,460px) 1fr', fontFamily: 'DM Sans, sans-serif', background: 'var(--bg-primary)' }}>

      {/* ── Left: Gym branding panel ──────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '40px 48px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative glow */}
        <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: gym.color, filter: 'blur(100px)', opacity: 0.12, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: gym.color, filter: 'blur(80px)', opacity: 0.07, pointerEvents: 'none' }} />

        {/* Back link */}
        <button
          onClick={() => nav('/login')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', padding: 0, marginBottom: 'auto', alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={14} /> Back to gym search
        </button>

        {/* Gym logo block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingBottom: 20 }}>
          {/* Logo */}
          <div style={{ width: 88, height: 88, borderRadius: 22, background: gym.bg, border: `2px solid ${gym.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', boxShadow: `0 0 40px ${gym.color}22` }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: gym.initials.length > 3 ? 16 : 22, fontWeight: 900, color: gym.color, letterSpacing: '-0.5px' }}>
              {gym.initials}
            </span>
            {/* Small GEM badge */}
            <div style={{ position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={11} color="var(--text-muted)" strokeWidth={2} />
            </div>
          </div>

          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 8, letterSpacing: '-0.5px' }}>
            {gym.name}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <MapPin size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{gym.location}</span>
          </div>

          <div style={{ height: 2, width: 40, background: `linear-gradient(90deg, ${gym.color}, transparent)`, borderRadius: 1, marginBottom: 16 }} />

          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
            "{gym.tagline}"
          </p>
        </div>

        {/* Bottom: GEM branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={11} color="#0a0a0f" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Powered by <strong style={{ color: 'var(--text-secondary)' }}>GEM</strong> · GymElite Manager</span>
        </div>
      </div>

      {/* ── Right: Login form ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: 'var(--bg-primary)' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Welcome header */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.4px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Sign in to <strong style={{ color: 'var(--text-primary)' }}>{gym.name}</strong>
            </p>
          </div>

          {/* Form card */}
          <form onSubmit={handleLogin}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '28px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color={inputFocus === 'email' ? gym.color : 'var(--text-muted)'}
                    style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                  <input
                    autoFocus
                    type="email"
                    value={form.email}
                    onChange={e => { set('email', e.target.value); setErrors(er => ({ ...er, email: '' })); }}
                    onFocus={() => setInputFocus('email')}
                    onBlur={() => setInputFocus('')}
                    placeholder="Enter your email"
                    style={inputStyle('email')}
                  />
                </div>
                {errors.email && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>⚠ {errors.email}</div>}
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                  <span style={{ fontSize: 12, color: gym.color, cursor: 'pointer', fontWeight: 500 }}>Forgot password?</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={inputFocus === 'password' ? gym.color : 'var(--text-muted)'}
                    style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => { set('password', e.target.value); setErrors(er => ({ ...er, password: '' })); }}
                    onFocus={() => setInputFocus('password')}
                    onBlur={() => setInputFocus('')}
                    placeholder="Enter your password"
                    style={{ ...inputStyle('password'), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>⚠ {errors.password}</div>}
              </div>

              {/* API error */}
              {apiError && (
                <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                  ⚠ {apiError}
                </div>
              )}

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? 'var(--bg-elevated)' : `linear-gradient(135deg, ${gym.color}, ${gym.color}cc)`,
                  border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f',
                  borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: loading ? 'none' : `0 4px 18px ${gym.color}35`,
                  transition: 'all 0.2s',
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={15} strokeWidth={2.5} />
                    Sign In
                  </>
                )}
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Wrong gym?{' '}
            <span style={{ color: gym.color, cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/login')}>
              Search for your gym
            </span>
          </p>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
