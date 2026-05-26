import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ArrowLeft, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, MapPin, Eye, EyeOff } from 'lucide-react';
import { register } from '../services/auth.service';
import { setAuth } from '../utils/auth';

const inp = (error) => ({
  width: '100%', background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
  borderRadius: 10, padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)',
  fontFamily: 'DM Sans', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
});

function Field({ label, icon: Icon, required, error, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
        {Icon && <Icon size={12} color="var(--text-muted)" />}
        {label}{required && <span style={{ color: 'var(--accent-gold)' }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function SignUpPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    gymCode: '', gymName: '', location: '',
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.gymCode.trim()) e.gymCode = 'Gym code is required';
    else if (!/^[a-z0-9-]+$/.test(form.gymCode.trim().toLowerCase())) e.gymCode = 'Only letters, numbers and hyphens allowed';
    if (!form.gymName.trim()) e.gymName = 'Gym name is required';
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await register({
        gymCode: form.gymCode.trim().toLowerCase(),
        gymName: form.gymName.trim(),
        location: form.location.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setAuth({ token: res.data.token, user: res.data.user });
      nav('/dashboard');
    } catch (err) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={16} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
          </div>
          <button onClick={() => nav('/login')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'DM Sans' }}>
            Already have an account? <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>Sign In</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'DM Sans', marginBottom: 20 }}>
            <ArrowLeft size={14} /> Back to home
          </button>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.5px' }}>
            Create your gym workspace
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Set up your gym and your manager account in one step.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>

            {/* Gym info */}
            <SectionHeader icon={Building2} title="Gym Information" />
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Gym Code" icon={Building2} required error={errors.gymCode}>
                <input style={inp(errors.gymCode)} value={form.gymCode} onChange={e => { set('gymCode', e.target.value.toLowerCase()); setErrors(er => ({ ...er, gymCode: '' })); }} placeholder="e.g. elite or mygym123" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>This is the unique code your staff will use to find your gym at login.</div>
              </Field>
              <Field label="Gym Name" icon={Building2} required error={errors.gymName}>
                <input style={inp(errors.gymName)} value={form.gymName} onChange={e => { set('gymName', e.target.value); setErrors(er => ({ ...er, gymName: '' })); }} placeholder="e.g. Elite Fitness Club" />
              </Field>
              <Field label="Location" icon={MapPin}>
                <input style={inp(false)} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shell Nsimeyong, Yaoundé" />
              </Field>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            {/* Owner account */}
            <SectionHeader icon={User} title="Your Manager Account" />
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="First Name" icon={User} required error={errors.firstName}>
                  <input style={inp(errors.firstName)} value={form.firstName} onChange={e => { set('firstName', e.target.value); setErrors(er => ({ ...er, firstName: '' })); }} placeholder="First name" />
                </Field>
                <Field label="Last Name" icon={User} required error={errors.lastName}>
                  <input style={inp(errors.lastName)} value={form.lastName} onChange={e => { set('lastName', e.target.value); setErrors(er => ({ ...er, lastName: '' })); }} placeholder="Last name" />
                </Field>
              </div>
              <Field label="Email Address" icon={Mail} required error={errors.email}>
                <input type="email" style={inp(errors.email)} value={form.email} onChange={e => { set('email', e.target.value); setErrors(er => ({ ...er, email: '' })); }} placeholder="you@yourgym.com" />
              </Field>
              <Field label="Password" icon={Lock} required error={errors.password}>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} style={{ ...inp(errors.password), paddingRight: 40 }} value={form.password} onChange={e => { set('password', e.target.value); setErrors(er => ({ ...er, password: '' })); }} placeholder="At least 6 characters" />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password" icon={Lock} required error={errors.confirmPassword}>
                <input type="password" style={inp(errors.confirmPassword)} value={form.confirmPassword} onChange={e => { set('confirmPassword', e.target.value); setErrors(er => ({ ...er, confirmPassword: '' })); }} placeholder="Repeat your password" />
              </Field>
            </div>

            {/* API error */}
            {apiError && (
              <div style={{ margin: '0 28px 16px', fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                ⚠ {apiError}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '20px 28px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You'll be logged in immediately as General Manager.
              </p>
              <button
                type="submit"
                disabled={loading}
                style={{ background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                {loading ? 'Creating...' : <> Create Workspace <ArrowRight size={15} strokeWidth={2.5} /> </>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={13} color="var(--accent-gold)" />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}
