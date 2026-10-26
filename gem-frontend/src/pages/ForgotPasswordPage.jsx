import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Building2, Send, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../services/auth.service';
import SupportLinks from '../components/SupportLinks';
import { useLanguage } from '../contexts/LanguageContext';
import GemMark from '../components/ui/GemMark';

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
});

function Field({ label, icon: Icon, children, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, fontFamily: 'DM Sans' }}>
        {Icon && <Icon size={12} color="var(--text-muted)" />}
        {label}
      </label>
      {children}
      {error && <div role="alert" data-field-error style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, fontFamily: 'DM Sans' }}>{error}</div>}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const location = useLocation();
  const prefillGymCode = location.state?.gymCode || '';
  const backTo = prefillGymCode ? `/${prefillGymCode}/login` : '/login';

  const [gymCode, setGymCode] = useState(prefillGymCode);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  function validate() {
    const e = {};
    if (!gymCode.trim()) e.gymCode = 'Gym code is required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email is required';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      await forgotPassword(gymCode.trim().toLowerCase(), email.trim());
      setSent(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Something went wrong. Please try again.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
          <GemMark size={30} />
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Back */}
          <button
            onClick={() => nav(backTo)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'DM Sans', marginBottom: 28, padding: 0 }}
          >
            <ArrowLeft size={14} /> {t('forgotPassword.backToSignIn')}
          </button>

          {!sent ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ padding: '32px 28px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Mail size={20} color="#c9a96e" />
                </div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  {t('forgotPassword.title')}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
                  {t('forgotPassword.sub')}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label={`${t('forgotPassword.gymCodeLabel')} *`} icon={Building2} error={errors.gymCode}>
                  <input
                    style={inp(errors.gymCode)}
                    value={gymCode}
                    onChange={e => setGymCode(e.target.value)}
                    placeholder={t('forgotPassword.gymCodePh')}
                    autoFocus
                  />
                </Field>

                <Field label={`${t('forgotPassword.emailLabel')} *`} icon={Mail} error={errors.email}>
                  <input
                    type="email"
                    style={inp(errors.email)}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('forgotPassword.emailPh')}
                  />
                </Field>

                {apiError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>
                    {apiError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
                >
                  {loading ? t('forgotPassword.sending') : <><Send size={14} strokeWidth={2.5} /> {t('forgotPassword.sendLink')}</>}
                </button>
              </form>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={26} color="#22c55e" />
              </div>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {t('forgotPassword.inboxTitle')}
              </h2>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, padding: '6px 14px', marginBottom: 14 }}>
                <Mail size={13} color="#c9a96e" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a96e', fontFamily: 'DM Sans' }}>{email.trim()}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
                {t('forgotPassword.inboxDesc')}
              </p>
              <button
                onClick={() => nav(backTo)}
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: 24 }}
              >
                {t('forgotPassword.backToSignIn')}
              </button>
              <SupportLinks label={t('forgotPassword.supportText')} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
