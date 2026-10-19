import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowLeft, Dumbbell, MapPin, Lock, Mail, LogIn, KeyRound,
  Users, Monitor, CreditCard, BarChart3, Users2, Sparkles, ChevronRight,
} from 'lucide-react';
import { setAuth, isAuthed, setDemoMode, getHomeRoute } from '../utils/auth';
import { login as loginApi, loginStatus, setFirstPassword } from '../services/auth.service';
import { getGymByCode } from '../services/gym.service';
import LangToggle from '../components/LangToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../utils/useIsMobile';
import { gymAddress } from '../utils/gymAddress';

const DEFAULT_GYM = { name: 'Loading...', location: '', color: '#c9a96e', bg: 'rgba(201,169,110,0.07)', initials: '...', tagline: 'Welcome back', logo: null };

function buildBranding(gym) {
  const words = gym.name.split(' ');
  const initials = words.length >= 2 ? words[0][0] + words[1][0] : gym.name.slice(0, 3).toUpperCase();
  return { ...DEFAULT_GYM, name: gym.name, location: gymAddress(gym), initials, logo: gym.logo || null };
}

const DEMO_ACCOUNTS_BASE = [
  { labelKey: 'auth.demoRoleGM',      roleKey: 'auth.demoRoleGMDesc',      name: 'Marvin Ekokobe',  email: 'marvin@elite.cm',    password: 'admin123', color: '#c9a96e', icon: Users2,      initials: 'ME' },
  { labelKey: 'auth.demoRoleFD',      roleKey: 'auth.demoRoleFDDesc',      name: 'Sandrine Kom',    email: 'sandrine@elite.cm',  password: 'admin123', color: '#f59e0b', icon: Monitor,     initials: 'SK' },
  { labelKey: 'auth.demoRoleTrainer', roleKey: 'auth.demoRoleTrainerDesc', name: 'Michel Roko',     email: 'michel@elite.cm',    password: 'admin123', color: '#60a5fa', icon: Users,       initials: 'MR' },
];

const DEMO_FEATURES_BASE = [
  { icon: Users,      labelKey: 'auth.demoFeat1Label', descKey: 'auth.demoFeat1Desc' },
  { icon: CreditCard, labelKey: 'auth.demoFeat2Label', descKey: 'auth.demoFeat2Desc' },
  { icon: Monitor,    labelKey: 'auth.demoFeat3Label', descKey: 'auth.demoFeat3Desc' },
  { icon: BarChart3,  labelKey: 'auth.demoFeat4Label', descKey: 'auth.demoFeat4Desc' },
];

export default function GymLoginPage() {
  const { gymCode } = useParams();
  const nav = useNavigate();
  const { lang, switchLang, t } = useLanguage();
  const DEMO_ACCOUNTS = DEMO_ACCOUNTS_BASE.map(a => ({ ...a, label: t(a.labelKey), role: t(a.roleKey) }));
  const DEMO_FEATURES = DEMO_FEATURES_BASE.map(f => ({ ...f, label: t(f.labelKey), desc: t(f.descKey) }));
  const isMobile = useIsMobile(800);
  const isDemo = gymCode === 'elite';

  useEffect(() => {
    if (isAuthed()) nav('/dashboard', { replace: true });
  }, []);

  const [gymInfo, setGymInfo] = useState(DEFAULT_GYM);
  const [selectedAccount, setSelectedAccount] = useState(isDemo ? 0 : null);
  const [form, setForm] = useState({
    email: isDemo ? DEMO_ACCOUNTS[0].email : '',
    password: isDemo ? DEMO_ACCOUNTS[0].password : '',
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [password2, setPassword2] = useState('');
  const [setupCode, setSetupCode] = useState('');
  // Signing in asks for the email first and nothing else. What comes next
  // depends on the answer: a password for an account that has one, a password
  // to choose for one that does not, or a plain "we don't know that address".
  // Showing every field at once made a first sign-in look like a failed one.
  const [step, setStep] = useState(isDemo ? 'password' : 'email');
  const [checking, setChecking] = useState(false);
  const backToEmail = () => {
    setStep('email');
    setSetupMode(false);
    setForm(f => ({ ...f, password: '' }));
    setPassword2(''); setSetupCode(''); setErrors({}); setApiError('');
  };

  const continueWithEmail = async () => {
    const email = form.email.trim();
    if (!/\S+@\S+\.\S+/.test(email)) { setErrors({ email: t('auth.loginErrorEmail') }); return; }
    setChecking(true);
    setApiError('');
    try {
      const res = await loginStatus(gymCode, email);
      const status = res.data?.status || (res.data?.setPassword ? 'new' : 'existing');
      if (status === 'unknown') {
        setErrors({ email: t('auth.noAccountForEmail') });
        return;
      }
      setSetupMode(status === 'new');
      setStep(status === 'new' ? 'create' : 'password');
      setErrors({});
    } catch (err) {
      // If the lookup cannot be made, fall back to asking for a password:
      // anyone who already has one can still get in.
      if (err.response?.status === 429) setApiError(err.response?.data?.error || t('auth.loginErrorFailed'));
      setSetupMode(false);
      setStep('password');
    } finally {
      setChecking(false);
    }
  };
  // A new account is claimed with the 4-digit code its manager read out, plus a
  // password of its own. Knowing the email address alone is not enough.
  const createPassword = async () => {
    const e = {};
    if (!form.email.trim()) e.email = t('auth.loginErrorEmail');
    if (!/^\d{4}$/.test(setupCode)) e.setupCode = t('auth.codeFourDigits');
    if ((form.password || '').length < 6) e.password = t('auth.pwTooShort');
    else if (form.password !== password2) e.password2 = t('auth.pwMismatch');
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await setFirstPassword(gymCode, form.email.trim(), form.password, setupCode);
      setAuth({ token: res.data.token, user: res.data.user });
      nav(getHomeRoute());
    } catch (err) {
      setApiError(err.response?.data?.error || t('auth.loginErrorFailed'));
    } finally {
      setLoading(false);
    }
  };
  const [loading, setLoading] = useState(false);
  const [inputFocus, setInputFocus] = useState('');

  useEffect(() => {
    getGymByCode(gymCode)
      .then(res => setGymInfo(buildBranding(res.data)))
      .catch(err => {
        // Only bounce back when the gym genuinely doesn't exist - a transient
        // server or network error shouldn't kick the user off the login screen
        if (err?.response?.status === 404) nav('/login');
        else setApiError(t('auth.codeErrorNetwork'));
      });
  }, [gymCode]);

  const gym = gymInfo;
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setApiError(''); };

  const pickAccount = (i) => {
    setSelectedAccount(i);
    setForm({ email: DEMO_ACCOUNTS[i].email, password: DEMO_ACCOUNTS[i].password });
    setErrors({});
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = t('auth.loginErrorEmail');
    if (!form.password.trim()) e.password = t('auth.loginErrorPassword');
    return e;
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (step === 'email') return continueWithEmail();
    if (setupMode) return createPassword();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await loginApi(gymCode, form.email, form.password);
      setAuth({ token: res.data.token, user: res.data.user });
      if (isDemo) setDemoMode(true);
      nav(getHomeRoute());
    } catch (err) {
      if (err.response?.data?.code === 'SET_PASSWORD') { setSetupMode(true); return; }
      setApiError(err.response?.data?.code === 'ACCOUNT_DEACTIVATED'
        ? t('auth.accountDeactivated')
        : err.response?.data?.error || t('auth.loginErrorFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Past the first step the email is settled. It stays on screen so you can see
  // whose account you are signing in to, but it is read-only until Change.
  const lockedField = { opacity: 0.72, cursor: 'default' };

  const inputStyle = (name) => ({
    width: '100%', background: 'var(--bg-elevated)',
    border: `1.5px solid ${errors[name] ? 'var(--accent-red)' : inputFocus === name ? gym.color : 'var(--border-subtle)'}`,
    borderRadius: 10, padding: '12px 14px 12px 42px',
    fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  });

  /* ── DEMO layout ──────────────────────────────────────────────── */
  if (isDemo) {
    if (isMobile) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 20px' }}>
            <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => nav('/login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
                <ArrowLeft size={14} /> {t('auth.loginBack')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LangToggle lang={lang} switchLang={switchLang} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={12} color="#c9a96e" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a96e', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('auth.demoMode')}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 14 }}>
                <Dumbbell size={12} color="#c9a96e" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a96e' }}>{t('auth.demoGymBadge')}</span>
              </div>
              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 6, letterSpacing: '-0.4px' }}>
                {t('auth.demoExploreH1')}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {t('auth.demoPickRole')}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {DEMO_ACCOUNTS.map((acc, i) => {
                const isSelected = selectedAccount === i;
                return (
                  <button key={acc.email} onClick={() => pickAccount(i)} style={{ background: isSelected ? `${acc.color}12` : 'var(--bg-card)', border: `2px solid ${isSelected ? acc.color : 'var(--border-subtle)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', transition: 'all 0.18s' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 11, background: `${acc.color}20`, border: `1.5px solid ${acc.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: acc.color }}>{acc.initials}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? acc.color : 'var(--text-primary)', marginBottom: 2 }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{acc.label} · {acc.role}</div>
                    </div>
                    {isSelected && <div style={{ width: 20, height: 20, borderRadius: '50%', background: acc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 11, color: '#0a0a0f', fontWeight: 900 }}>&#10003;</span></div>}
                  </button>
                );
              })}
            </div>

            {apiError && <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>&#9888; {apiError}</div>}

            <button onClick={handleLogin} disabled={loading || selectedAccount === null} style={{ width: '100%', background: loading || selectedAccount === null ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading || selectedAccount === null ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 700, cursor: loading || selectedAccount === null ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: selectedAccount !== null && !loading ? '0 4px 20px rgba(201,169,110,0.4)' : 'none', transition: 'all 0.2s' }}>
              {loading ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} /> {t('auth.demoSigningIn')}</> : <><Sparkles size={15} /> {t('auth.demoEnter')} <ChevronRight size={15} /></>}
            </button>

            <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('auth.demoDisclaimer')}
            </p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>

        {/* Top bar */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => nav('/login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
              <ArrowLeft size={14} /> {t('auth.loginBackToSearch')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <LangToggle lang={lang} switchLang={switchLang} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={13} color="#c9a96e" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a96e', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {t('auth.demoMode')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="gem-demo-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          <div className="gem-two-col" style={{ width: '100%', maxWidth: 900, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

            {/* ── Left: what's in the demo ──────────────────────────── */}
            <div className="gem-demo-info">
              {/* Demo badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
                <Dumbbell size={13} color="#c9a96e" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a96e', letterSpacing: '0.5px' }}>{t('auth.demoGymBadge')}</span>
              </div>

              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 12, letterSpacing: '-0.5px' }}>
                {t('auth.demoExploreTitle1')}<br />
                <span style={{ color: '#c9a96e' }}>{t('auth.demoExploreTitle2')}</span><br />
                {t('auth.demoExploreTitle3')}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28, maxWidth: 380 }}>
                {t('auth.demoExploreSub')}
              </p>

              {/* Feature grid */}
              <div className="gem-demo-features gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {DEMO_FEATURES.map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(201,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={15} color="#c9a96e" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{f.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="gem-demo-tip" style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 <strong style={{ color: 'var(--text-secondary)' }}>{t('auth.demoTip')}</strong> {t('auth.demoTipText')}
              </div>
            </div>

            {/* ── Right: login card ─────────────────────────────────── */}
            <div className="gem-demo-form">
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: 28, boxShadow: 'var(--shadow-card)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {t('auth.demoChooseRole')}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
                  {t('auth.demoChooseRoleSub')}
                </p>

                {/* Account selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {DEMO_ACCOUNTS.map((acc, i) => {
                    const Icon = acc.icon;
                    const isSelected = selectedAccount === i;
                    return (
                      <button
                        key={acc.email}
                        onClick={() => pickAccount(i)}
                        style={{
                          background: isSelected ? `${acc.color}12` : 'var(--bg-elevated)',
                          border: `2px solid ${isSelected ? acc.color : 'var(--border-subtle)'}`,
                          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                          fontFamily: 'DM Sans', display: 'flex', alignItems: 'center',
                          gap: 12, transition: 'all 0.18s', width: '100%', textAlign: 'left',
                        }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${acc.color}20`, border: `1.5px solid ${acc.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: acc.color }}>{acc.initials}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? acc.color : 'var(--text-primary)', marginBottom: 2 }}>
                            {acc.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{acc.label} · {acc.role}</div>
                        </div>
                        {isSelected && (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: acc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, color: '#0a0a0f', fontWeight: 900 }}>✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Credential display */}
                {selectedAccount !== null && (
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                      {t('auth.demoCredentials')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('auth.demoEmailLabel')}</span>
                        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {DEMO_ACCOUNTS[selectedAccount].email}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('auth.demoPasswordLabel')}</span>
                        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
                          admin123
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* API error */}
                {apiError && (
                  <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                    ⚠ {apiError}
                  </div>
                )}

                {/* Sign in button */}
                <button
                  onClick={handleLogin}
                  disabled={loading || selectedAccount === null}
                  style={{
                    width: '100%',
                    background: loading || selectedAccount === null
                      ? 'var(--bg-elevated)'
                      : 'linear-gradient(135deg, #c9a96e, #b08d4a)',
                    border: 'none',
                    color: loading || selectedAccount === null ? 'var(--text-muted)' : '#0a0a0f',
                    borderRadius: 12, padding: '14px',
                    fontSize: 15, fontWeight: 700,
                    cursor: loading || selectedAccount === null ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Sans',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: selectedAccount !== null && !loading ? '0 4px 20px rgba(201,169,110,0.4)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} />
                      {t('auth.demoSigningIn')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      {t('auth.demoEnter')}
                      <ChevronRight size={15} />
                    </>
                  )}
                </button>

                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t('auth.demoDisclaimerFull')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── NORMAL layout ────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => nav('/login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', padding: 0 }}>
              <ArrowLeft size={14} /> {t('auth.loginBack')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LangToggle lang={lang} switchLang={switchLang} />
              <div onClick={() => nav('/')} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Dumbbell size={12} color="#0a0a0f" strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>GEM</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '28px 20px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: gym.bg, border: `2px solid ${gym.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {gym.logo
                ? <img src={gym.logo} alt={gym.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: gym.initials.length > 3 ? 12 : 16, fontWeight: 900, color: gym.color }}>{gym.initials}</span>}
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{gym.name}</div>
              {gym.location && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}><MapPin size={11} /> {gym.location}</div>}
            </div>
          </div>

          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{t('auth.loginSignIn')}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>{t('auth.loginSub')} <strong>{gym.name}</strong></p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.loginEmailLabel')} *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color={inputFocus === 'email' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input autoFocus={step === 'email'} type="email" value={form.email} readOnly={step !== 'email'} onChange={e => { set('email', e.target.value); setErrors(er => ({ ...er, email: '' })); }} onFocus={() => setInputFocus('email')} onBlur={() => setInputFocus('')} placeholder={t('auth.loginEmailPh')} style={{ ...inputStyle('email'), fontSize: 16, ...(step !== 'email' ? lockedField : {}) }} />
              </div>
              {errors.email && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.email}</div>}
            </div>

            {step !== 'email' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{setupMode ? t('auth.firstTimeHere') : t('auth.signingInAs', { email: form.email.trim() })}</span>
                <button type="button" onClick={backToEmail} style={{ background: 'none', border: 'none', color: gym.color, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', padding: 0 }}>{t('auth.changeEmail')}</button>
              </div>
            )}


            {step !== 'email' && setupMode && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.managerCodeLabel')} *</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={15} color={inputFocus === 'setupCode' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input value={setupCode} inputMode="numeric" maxLength={4} autoComplete="off"
                    onChange={e => { setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setErrors(er => ({ ...er, setupCode: '' })); }}
                    onFocus={() => setInputFocus('setupCode')} onBlur={() => setInputFocus('')}
                    placeholder="••••" style={{ ...inputStyle('setupCode'), fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.35em' }} />
                </div>
                {errors.setupCode
                  ? <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.setupCode}</div>
                  : <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{t('auth.managerCodeHint')}</div>}
              </div>
            )}

            {step !== 'email' && (<div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{setupMode ? t('auth.createPassword') : t('auth.loginPasswordLabel')} *</label>
                {!setupMode && <span style={{ fontSize: 12, color: gym.color, cursor: 'pointer', fontWeight: 500 }} onClick={() => nav('/forgot-password', { state: { gymCode } })}>{t('auth.loginForgot')}</span>}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color={inputFocus === 'password' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type={showPw ? 'text' : 'password'} value={form.password} autoComplete="new-password" name="gem-login-secret" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore data-form-type="other" onChange={e => { set('password', e.target.value); setErrors(er => ({ ...er, password: '' })); }} onFocus={() => setInputFocus('password')} onBlur={() => setInputFocus('')} placeholder={t('auth.loginPasswordPh')} style={{ ...inputStyle('password'), paddingRight: 44, fontSize: 16 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.password}</div>}
            </div>)}

            {step !== 'email' && setupMode && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.reenterPassword')} *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={inputFocus === 'password2' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type={showPw ? 'text' : 'password'} value={password2} autoComplete="new-password"
                    onChange={e => { setPassword2(e.target.value); setErrors(er => ({ ...er, password2: '' })); }}
                    onFocus={() => setInputFocus('password2')} onBlur={() => setInputFocus('')}
                    placeholder={t('auth.reenterPassword')} style={inputStyle('password2')} />
                </div>
                {errors.password2 && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.password2}</div>}
              </div>
            )}

            {apiError && <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>&#9888; {apiError}</div>}

            <button type="submit" disabled={loading || checking} style={{ width: '100%', background: loading ? 'var(--bg-elevated)' : `linear-gradient(135deg, ${gym.color}, ${gym.color}cc)`, border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : `0 4px 16px ${gym.color}35`, marginTop: 4 }}>
              {(loading || checking) ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} /> {t('auth.loginSigningIn')}</> : <><LogIn size={15} strokeWidth={2.5} /> {step === 'email' ? t('auth.continueBtn') : t('auth.loginSignInBtn')}</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('auth.loginWrongGym')}{' '}
            <span style={{ color: gym.color, cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/login')}>{t('auth.loginSearchGym')}</span>
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="gem-login-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,460px) 1fr', fontFamily: 'DM Sans, sans-serif', background: 'var(--bg-primary)' }}>

      {/* Left: Gym branding */}
      <div className="gem-login-left" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '40px 48px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: gym.color, filter: 'blur(100px)', opacity: 0.12, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: gym.color, filter: 'blur(80px)', opacity: 0.07, pointerEvents: 'none' }} />

        <button onClick={() => nav('/login')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', padding: 0, marginBottom: 'auto', alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> {t('auth.loginBackToSearch')}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingBottom: 20 }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, background: gym.bg, border: `2px solid ${gym.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', boxShadow: `0 0 40px ${gym.color}22` }}>
            {gym.logo
              ? <img src={gym.logo} alt={gym.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20, display: 'block' }} />
              : <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: gym.initials.length > 3 ? 16 : 22, fontWeight: 900, color: gym.color, letterSpacing: '-0.5px' }}>{gym.initials}</span>}
            <div style={{ position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={11} color="var(--text-muted)" strokeWidth={2} />
            </div>
          </div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 8, letterSpacing: '-0.5px' }}>{gym.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <MapPin size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{gym.location}</span>
          </div>
          <div style={{ height: 2, width: 40, background: `linear-gradient(90deg, ${gym.color}, transparent)`, borderRadius: 1, marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>"{gym.tagline}"</p>
        </div>

        <div onClick={() => nav('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 20, cursor: 'pointer' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={11} color="#0a0a0f" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('auth.loginPowered')}</span>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="gem-login-form-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 24 }}>
          <LangToggle lang={lang} switchLang={switchLang} />
        </div>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.4px' }}>{t('auth.loginTitle')}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('auth.loginSub')} <strong style={{ color: 'var(--text-primary)' }}>{gym.name}</strong></p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="gem-login-form-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 28, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.loginEmailLabel')} *</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color={inputFocus === 'email' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input autoFocus={step === 'email'} type="email" value={form.email} readOnly={step !== 'email'} onChange={e => { set('email', e.target.value); setErrors(er => ({ ...er, email: '' })); }} onFocus={() => setInputFocus('email')} onBlur={() => setInputFocus('')} placeholder={t('auth.loginEmailPh')} style={{ ...inputStyle('email'), ...(step !== 'email' ? lockedField : {}) }} />
                </div>
                {errors.email && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>⚠ {errors.email}</div>}
              </div>

              {step !== 'email' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{setupMode ? t('auth.firstTimeHere') : t('auth.signingInAs', { email: form.email.trim() })}</span>
                  <button type="button" onClick={backToEmail} style={{ background: 'none', border: 'none', color: gym.color, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', padding: 0 }}>{t('auth.changeEmail')}</button>
                </div>
              )}


              {step !== 'email' && setupMode && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.managerCodeLabel')} *</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={15} color={inputFocus === 'setupCode' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input value={setupCode} inputMode="numeric" maxLength={4} autoComplete="off"
                      onChange={e => { setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setErrors(er => ({ ...er, setupCode: '' })); }}
                      onFocus={() => setInputFocus('setupCode')} onBlur={() => setInputFocus('')}
                      placeholder="••••" style={{ ...inputStyle('setupCode'), fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.35em' }} />
                  </div>
                  {errors.setupCode
                    ? <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.setupCode}</div>
                    : <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{t('auth.managerCodeHint')}</div>}
                </div>
              )}

              {step !== 'email' && (<div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{setupMode ? t('auth.createPassword') : t('auth.loginPasswordLabel')} *</label>
                  {!setupMode && <span style={{ fontSize: 12, color: gym.color, cursor: 'pointer', fontWeight: 500 }} onClick={() => nav('/forgot-password', { state: { gymCode } })}>{t('auth.loginForgotFull')}</span>}
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={inputFocus === 'password' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type={showPw ? 'text' : 'password'} value={form.password} autoComplete="new-password" name="gem-login-secret" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore data-form-type="other" onChange={e => { set('password', e.target.value); setErrors(er => ({ ...er, password: '' })); }} onFocus={() => setInputFocus('password')} onBlur={() => setInputFocus('')} placeholder={t('auth.loginPasswordPh')} style={{ ...inputStyle('password'), paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>⚠ {errors.password}</div>}
              </div>)}

              {step !== 'email' && setupMode && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 7 }}>{t('auth.reenterPassword')} *</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color={inputFocus === 'password2' ? gym.color : 'var(--text-muted)'} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type={showPw ? 'text' : 'password'} value={password2} autoComplete="new-password"
                      onChange={e => { setPassword2(e.target.value); setErrors(er => ({ ...er, password2: '' })); }}
                      onFocus={() => setInputFocus('password2')} onBlur={() => setInputFocus('')}
                      placeholder={t('auth.reenterPassword')} style={inputStyle('password2')} />
                  </div>
                  {errors.password2 && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>&#9888; {errors.password2}</div>}
                </div>
              )}

              {apiError && (
                <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                  ⚠ {apiError}
                </div>
              )}

              <button type="submit" disabled={loading || checking} style={{ width: '100%', background: loading ? 'var(--bg-elevated)' : `linear-gradient(135deg, ${gym.color}, ${gym.color}cc)`, border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : `0 4px 18px ${gym.color}35`, transition: 'all 0.2s' }}>
                {(loading || checking) ? (
                  <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text-muted)', animation: 'spin 0.7s linear infinite' }} /> {t('auth.loginSigningIn')}</>
                ) : (
                  <><LogIn size={15} strokeWidth={2.5} /> {step === 'email' ? t('auth.continueBtn') : t('auth.loginSignInBtn')}</>
                )}
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('auth.loginWrongGym')}{' '}
            <span style={{ color: gym.color, cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/login')}>{t('auth.loginSearchGym')}</span>
          </p>

          {/* Contact */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px', letterSpacing: '0.2px' }}>
              {t('auth.loginSupport')}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:hello@gymgem.io" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#c9a96e', fontWeight: 600, textDecoration: 'none', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, padding: '6px 12px' }}>
                ✉ hello@gymgem.io
              </a>
              <a href="https://wa.me/237600000000" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', fontWeight: 600, textDecoration: 'none', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 8, padding: '6px 12px' }}>
                💬 WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
