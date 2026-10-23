import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { resetPassword, verifyResetToken } from '../services/auth.service';
import { useLanguage } from '../contexts/LanguageContext';

const inp = (err) => ({
  width: '100%',
  background: 'var(--bg-elevated)',
  border: `1px solid ${err ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  paddingRight: 42,
});

function Field({ label, icon: Icon, children, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, fontFamily: 'DM Sans' }}>
        {Icon && <Icon size={12} color="var(--text-muted)" />}
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, fontFamily: 'DM Sans' }}>{error}</div>}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, error, id }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={inp(error)}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(!!token);
  const [done, setDone] = useState(false);
  const [expiredReason, setExpiredReason] = useState(null); // null | 'replaced' | 'expired' | 'missing'
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!token) return;
    verifyResetToken(token)
      .then(res => { if (!res.data.valid) setExpiredReason(res.data.reason || 'expired'); })
      .catch(() => setExpiredReason('expired'))
      .finally(() => setChecking(false));
  }, [token]);

  function validate() {
    const e = {};
    if (!password || password.length < 6) e.password = t('auth.pwTooShort');
    if (password !== confirm) e.confirm = t('auth.pwMismatch');
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const msg = err?.response?.data?.error || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setExpiredReason('expired');
      } else {
        setErrors({ general: t('resetPassword.error') });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={14} color="#0a0a0f" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <button
            onClick={() => nav('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'DM Sans', marginBottom: 28, padding: 0 }}
          >
            <ArrowLeft size={14} /> {t('resetPassword.backToSignIn')}
          </button>

          {checking ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '48px 28px', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTopColor: '#c9a96e', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('resetPassword.verifying')}</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : done ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={26} color="#22c55e" />
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {t('resetPassword.doneTitle')}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px' }}>
                {t('resetPassword.doneDesc')}
              </p>
              <button
                onClick={() => nav('/login')}
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                {t('resetPassword.signInNow')}
              </button>
            </div>
          ) : expiredReason ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertCircle size={26} color="#ef4444" />
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {expiredReason === 'replaced' ? t('resetPassword.replacedTitle') : t('resetPassword.expiredTitle')}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px' }}>
                {expiredReason === 'replaced' ? t('resetPassword.replacedDesc') : t('resetPassword.expiredDesc')}
              </p>
              <button
                onClick={() => nav('/forgot-password')}
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                {t('resetPassword.requestNew')}
              </button>
            </div>
          ) : !token ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertCircle size={26} color="#ef4444" />
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {t('resetPassword.invalidTitle')}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px' }}>
                {t('resetPassword.invalidDesc')}
              </p>
              <button
                onClick={() => nav('/forgot-password')}
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                {t('resetPassword.requestNew')}
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ padding: '32px 28px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Lock size={20} color="#c9a96e" />
                </div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  {t('resetPassword.title')}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
                  {t('resetPassword.sub')}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {errors.general && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontFamily: 'DM Sans' }}>
                    {errors.general}
                  </div>
                )}

                <Field label={`${t('resetPassword.newPassword')} *`} icon={Lock} error={errors.password}>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('resetPassword.passwordPh')}
                    error={errors.password}
                  />
                </Field>

                <Field label={`${t('resetPassword.confirmPassword')} *`} icon={Lock} error={errors.confirm}>
                  <PasswordInput
                    id="confirm"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder={t('resetPassword.repeatPh')}
                    error={errors.confirm}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', marginTop: 4 }}
                >
                  {loading ? t('resetPassword.updating') : t('resetPassword.submit')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
