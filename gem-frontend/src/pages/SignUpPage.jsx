import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell, ArrowLeft, ArrowRight, Check, Building2, User,
  Mail, Lock, MapPin, Eye, EyeOff, Phone, Sparkles, Users,
  ShieldCheck, Zap, RefreshCw, CreditCard, Monitor, BarChart3, ChevronRight, ChevronDown, PlayCircle, Globe,
} from 'lucide-react';
import { register, checkGymCode as checkGymCodeApi } from '../services/auth.service';
import { setAuth, setPhoneFormat } from '../utils/auth';
import { COUNTRIES } from '../utils/countries';
import { useLanguage } from '../contexts/LanguageContext';
import LangToggle from '../components/LangToggle';
import { useIsMobile } from '../utils/useIsMobile';

// ─── Countries ────────────────────────────────────────────────────────────────


const TZ_COUNTRY = {
  'Africa/Douala': 'CM', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH',
  'Africa/Dakar': 'SN', 'Africa/Abidjan': 'CI', 'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA', 'Europe/Paris': 'FR', 'Europe/London': 'GB',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US', 'America/Denver': 'US',
};

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_COUNTRY[tz] || 'CM';
  } catch {
    return 'CM';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24);
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inp = (error) => ({
  width: '100%',
  background: 'var(--bg-elevated)',
  border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
});

function Field({ label, icon: Icon, required, error, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7,
        fontFamily: 'DM Sans',
      }}>
        {Icon && <Icon size={12} color="var(--text-muted)" />}
        {label}{required && <span style={{ color: 'var(--accent-gold)' }}>*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans', lineHeight: 1.5 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, fontFamily: 'DM Sans' }}>{error}</div>}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, onStepClick }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const labels = [t('signup.stepGymSetup'), t('signup.stepYourAccount'), t('signup.stepDone')];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: isMobile ? 20 : 36, padding: isMobile ? '0 16px' : 0 }}>
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        const clickable = done && onStepClick;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div
                onClick={() => clickable && onStepClick(stepNum)}
                style={{
                  width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%',
                  background: done ? '#22c55e' : active ? 'linear-gradient(135deg, #c9a96e, #b08d4a)' : 'var(--bg-elevated)',
                  border: `2px solid ${done ? '#22c55e' : active ? '#c9a96e' : 'var(--border-subtle)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s',
                  cursor: clickable ? 'pointer' : 'default',
                }}
                title={clickable ? `${t('signup.goBackTo')} ${label}` : undefined}
              >
                {done
                  ? <Check size={12} color="#fff" strokeWidth={3} />
                  : <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#0a0a0f' : 'var(--text-muted)', fontFamily: 'Manrope' }}>{stepNum}</span>
                }
              </div>
              <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 600, color: active ? 'var(--accent-gold)' : done ? '#22c55e' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{
                width: isMobile ? 40 : 60, height: 2, margin: '0 4px', marginBottom: isMobile ? 16 : 20,
                background: done ? '#22c55e' : 'var(--border-subtle)',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const nav = useNavigate();
  const { lang, switchLang, t } = useLanguage();
  const [step, setStep] = useState(0);
  const [managerCode, setManagerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [codeStatus, setCodeStatus] = useState(null);
  const codeTimerRef = useRef(null);
  const [codeEdited, setCodeEdited] = useState(false);

  const [form, setForm] = useState({
    gymCountry: detectCountry(),
    gymName: '', city: '', customCity: '', address: '', phone: '', gymCode: '', countryCode: detectCountry(),
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    managerPhone: '', managerCountryCode: detectCountry(),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!codeEdited && form.gymName) {
      const slug = slugify(form.gymName);
      set('gymCode', slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gymName]);

  useEffect(() => {
    if (!form.gymCode || step !== 1) { setCodeStatus(null); return; }
    setCodeStatus('checking');
    clearTimeout(codeTimerRef.current);
    codeTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkGymCodeApi(form.gymCode);
        setCodeStatus(res.data.available ? 'available' : 'taken');
      } catch {
        setCodeStatus(null);
      }
    }, 600);
    return () => clearTimeout(codeTimerRef.current);
  }, [form.gymCode, step]);

  function regenerateCode() {
    if (!form.gymName) return;
    const base = slugify(form.gymName);
    const suffix = String(Math.floor(10 + Math.random() * 90));
    set('gymCode', `${base}-${suffix}`);
    setCodeEdited(false);
  }

  function validateStep1() {
    const e = {};
    if (!form.gymName.trim()) e.gymName = t('signup.errGymName');
    if (!form.gymCode.trim()) e.gymCode = t('signup.errGymCode');
    else if (!/^[a-z0-9-]+$/.test(form.gymCode)) e.gymCode = t('signup.errGymCodeFormat');
    else if (codeStatus === 'taken') e.gymCode = t('signup.errGymCodeTaken');
    else if (codeStatus === 'checking') e.gymCode = t('signup.errGymCodeChecking');
    if (!form.city) e.city = t('signup.errCity');
    else if (form.city === '__other__' && !form.customCity.trim()) e.city = t('signup.errCustomCity');
    if (!form.phone.trim()) e.phone = t('signup.errPhone');
    return e;
  }

  function validateStep2() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = t('signup.errRequired');
    if (!form.lastName.trim()) e.lastName = t('signup.errRequired');
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = t('signup.errEmail');
    if (!form.managerPhone.trim()) e.managerPhone = t('signup.errPhone');
    if (form.password.length < 6) e.password = t('signup.errPasswordMin');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('signup.errPasswordMatch');
    return e;
  }

  function next() {
    setApiError('');
    if (step === 1) {
      const e = validateStep1();
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    setErrors({});
    setStep(s => s + 1);
  }

  function back() {
    setErrors({});
    setApiError('');
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    const e = validateStep2();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    try {
      const dialCode = COUNTRIES.find(c => c.code === form.countryCode)?.dial || '';
      const fullPhone = form.phone.trim() ? `${dialCode} ${form.phone.trim()}` : '';
      const managerDialCode = COUNTRIES.find(c => c.code === form.managerCountryCode)?.dial || '';
      const fullManagerPhone = form.managerPhone.trim() ? `${managerDialCode} ${form.managerPhone.trim()}` : '';
      const gymCountryData = COUNTRIES.find(c => c.code === form.gymCountry);
      const resolvedCity = form.city === '__other__' ? form.customCity.trim() : form.city;
      const locationParts = [resolvedCity, form.address.trim()].filter(Boolean);
      const res = await register({
        gymCode: form.gymCode.trim(),
        gymName: form.gymName.trim(),
        location: locationParts.join(', '),
        phone: fullPhone,
        // Sent separately as well so the gym profile fields are populated -
        // location keeps the combined string for display elsewhere
        city: resolvedCity,
        country: gymCountryData?.name || '',
        currency: gymCountryData?.currency || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        managerPhone: fullManagerPhone,
      });
      setAuth({ token: res.data.token, user: res.data.user });
      if (gymCountryData) setPhoneFormat(gymCountryData.dial, gymCountryData.placeholder);
      setManagerCode(res.data.accessCode || '');
      setStep(3);
    } catch (err) {
      setApiError(err.response?.data?.error || t('signup.errFailed'));
    } finally {
      setLoading(false);
    }
  }

  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: isMobile ? '0 20px' : '0 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', height: isMobile ? 52 : 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => nav('/')}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dumbbell size={15} color="#0a0a0f" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LangToggle lang={lang} switchLang={switchLang} />
            <button onClick={() => nav('/login')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent-gold)', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('signup.signIn')}</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: isMobile ? '100%' : (step === 0 ? 960 : 560), margin: '0 auto', padding: isMobile ? (step === 1 || step === 2 ? '20px 0 60px' : '20px 20px 60px') : (step === 0 ? '52px 32px 72px' : '48px 24px 80px') }}>

        {step === 0 && <WelcomeStep onStart={() => setStep(1)} onDemo={() => nav('/elite/login')} onSignIn={() => nav('/login')} />}

        {(step === 1 || step === 2) && (
          <>
            <div style={{ textAlign: isMobile ? 'left' : 'center', padding: isMobile ? '0 16px' : 0, marginBottom: 8 }}>
              <button onClick={() => step === 1 ? nav('/') : back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'DM Sans', marginBottom: isMobile ? 16 : 24 }}>
                <ArrowLeft size={14} /> {t('signup.back')}
              </button>
            </div>

            <StepIndicator current={step} onStepClick={(s) => setStep(s)} />

            <div style={{ background: 'var(--bg-card)', border: isMobile ? 'none' : '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', borderRadius: isMobile ? 0 : 18, boxShadow: isMobile ? 'none' : 'var(--shadow-card)' }}>

              {step === 1 && (
                <GymStep
                  form={form} set={set} errors={errors}
                  codeStatus={codeStatus} codeEdited={codeEdited}
                  setCodeEdited={setCodeEdited} regenerateCode={regenerateCode}
                />
              )}

              {step === 2 && (
                <AccountStep
                  form={form} set={set} errors={errors}
                  showPw={showPw} setShowPw={setShowPw}
                  showConfirm={showConfirm} setShowConfirm={setShowConfirm}
                  countries={COUNTRIES}
                />
              )}

              {apiError && (
                <div style={{ margin: isMobile ? '0 16px 16px' : '0 28px 16px', fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                  &#9888; {apiError}
                </div>
              )}

              <div style={{ padding: isMobile ? '16px 16px' : '20px 28px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('signup.step')} {step} {t('signup.stepOf')} 2
                </span>
                {step === 1 && (
                  <button
                    onClick={next}
                    disabled={codeStatus === 'checking'}
                    style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: codeStatus === 'checking' ? 0.6 : 1 }}
                  >
                    {t('signup.continue')} <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                )}
                {step === 2 && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{ background: loading ? 'var(--bg-card)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    {loading ? t('signup.launching') : <>{t('signup.launch')} <Zap size={15} strokeWidth={2.5} /></>}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {step === 3 && <SuccessStep gymCode={form.gymCode} gymName={form.gymName} firstName={form.firstName} managerCode={managerCode} onGo={() => nav('/dashboard')} />}
      </div>
    </div>
  );
}

// ─── Step 0: Welcome / Pricing ────────────────────────────────────────────────

function WelcomeStep({ onStart, onDemo, onSignIn }) {
  const { t } = useLanguage();
  const [hov,       setHov]       = useState(false);
  const [demoHov,   setDemoHov]   = useState(false);
  const [signInHov, setSignInHov] = useState(false);
  const isMobile = useIsMobile();

  const features = [
    { icon: Users,       label: t('signup.feat1') },
    { icon: CreditCard,  label: t('signup.feat2') },
    { icon: Monitor,     label: t('signup.feat3') },
    { icon: BarChart3,   label: t('signup.feat4') },
    { icon: Zap,         label: t('signup.feat5') },
    { icon: ShieldCheck, label: t('signup.feat6') },
  ];

  if (isMobile) {
    return (
      <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.28)', borderRadius: 20, padding: '4px 13px', marginBottom: 18 }}>
          <Sparkles size={11} color="#c9a96e" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c9a96e' }}>{t('signup.welcomeBadge')}</span>
        </div>

        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.5px', marginBottom: 12 }}>
          {t('signup.welcomeTitle1')}{' '}
          <span style={{ color: '#c9a96e' }}>{t('signup.welcomeTitle2')}</span>
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          {t('signup.welcomeSub')}
        </p>

        {/* Video - mobile */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(201,169,110,0.25)', boxShadow: '0 8px 28px rgba(0,0,0,0.28)', marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.14)' }} />)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <PlayCircle size={10} color="#c9a96e" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('signup.welcomeVideoTitle')}</span>
            </div>
            <div style={{ background: 'rgba(201,169,110,0.12)', borderRadius: 20, padding: '2px 7px' }}>
              <span style={{ fontSize: 10, color: '#c9a96e', fontWeight: 600 }}>2 min</span>
            </div>
          </div>
          <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#050508' }}>
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="GEM: How it works"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 28 }}>
          {features.map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(201,169,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={12} color="#c9a96e" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        <button onClick={onStart} style={{ width: '100%', background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 4px 16px rgba(201,169,110,0.3)', marginBottom: 12 }}>
          {t('signup.welcomeStart')} <ArrowRight size={15} strokeWidth={2.5} />
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDemo} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <PlayCircle size={13} color="#c9a96e" strokeWidth={2} /> {t('signup.welcomeDemo')}
          </button>
          <button onClick={onSignIn} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {t('signup.welcomeSignIn')} <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gem-welcome-step" style={{ display: 'flex', alignItems: 'center', gap: 56, fontFamily: 'DM Sans, sans-serif' }}>

      <div style={{ width: 360, flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.28)', borderRadius: 20, padding: '4px 13px', marginBottom: 22 }}>
          <Sparkles size={11} color="#c9a96e" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c9a96e', letterSpacing: '0.3px' }}>{t('signup.welcomeBadge')}</span>
        </div>

        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.18, letterSpacing: '-0.7px', marginBottom: 16, margin: '0 0 16px' }}>
          {t('signup.welcomeTitle1')}{' '}
          <span style={{ color: '#c9a96e' }}>{t('signup.welcomeTitle2')}</span>
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 10px' }}>
          {t('signup.welcomeSub')}
        </p>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          {t('signup.welcomePricing')}{' '}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('signup.welcomePricingHL')}</span>
        </p>

        <button
          onClick={onStart}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          className="gem-welcome-cta"
          style={{
            background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
            border: 'none', color: '#0a0a0f',
            borderRadius: 12, padding: '14px 28px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'DM Sans',
            display: 'inline-flex', alignItems: 'center', gap: 9,
            boxShadow: hov ? '0 8px 28px rgba(201,169,110,0.5)' : '0 4px 16px rgba(201,169,110,0.3)',
            transform: hov ? 'translateY(-2px)' : 'none',
            transition: 'all 0.18s ease',
            marginBottom: 14,
          }}
        >
          {t('signup.welcomeStart')} <ArrowRight size={15} strokeWidth={2.5} />
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onDemo}
            onMouseEnter={() => setDemoHov(true)}
            onMouseLeave={() => setDemoHov(false)}
            style={{
              background: demoHov ? 'rgba(201,169,110,0.07)' : 'transparent',
              border: `1px solid ${demoHov ? 'rgba(201,169,110,0.4)' : 'var(--border-subtle)'}`,
              color: demoHov ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: 9, padding: '9px 16px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              transition: 'all 0.15s',
            }}
          >
            <PlayCircle size={13} color="#c9a96e" strokeWidth={2} />
            {t('signup.welcomeDemo')}
          </button>

          <button
            onClick={onSignIn}
            onMouseEnter={() => setSignInHov(true)}
            onMouseLeave={() => setSignInHov(false)}
            style={{
              background: signInHov ? 'rgba(255,255,255,0.04)' : 'transparent',
              border: `1px solid ${signInHov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'}`,
              color: signInHov ? 'var(--text-secondary)' : 'var(--text-muted)',
              borderRadius: 9, padding: '9px 16px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            {t('signup.welcomeSignIn')} <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(201,169,110,0.25)', boxShadow: '0 24px 72px rgba(0,0,0,0.32)', marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.14)' }} />)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <PlayCircle size={11} color="#c9a96e" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.2px' }}>
                {t('signup.welcomeVideoTitle')}
              </span>
            </div>
            <div style={{ background: 'rgba(201,169,110,0.12)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: '#c9a96e', fontWeight: 600 }}>2 min</span>
            </div>
          </div>
          <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#050508' }}>
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="GEM: How it works"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
          {features.map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'rgba(201,169,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={13} color="#c9a96e" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('signup.welcomeSupport')}</span>
          <a href="mailto:hello@gymgem.io" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#c9a96e', fontWeight: 600, textDecoration: 'none', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '4px 10px' }}>
            ✉ hello@gymgem.io
          </a>
          <a href="https://wa.me/237600000000" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#22c55e', fontWeight: 600, textDecoration: 'none', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 6, padding: '4px 10px' }}>
            💬 WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Mini flag renderer ───────────────────────────────────────────────────────

function MiniFlag({ country, size = 16 }) {
  if (!country?.stripes) return null;
  const { stripes, orient } = country;
  return (
    <div style={{
      width: Math.round(size * 1.5),
      height: size,
      borderRadius: 2,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: orient === 'v' ? 'row' : 'column',
      flexShrink: 0,
      border: '1px solid rgba(128,128,128,0.25)',
    }}>
      {stripes.map((color, i) => (
        <div key={i} style={{ flex: 1, background: color }} />
      ))}
    </div>
  );
}

// ─── Custom dial-code selector ─────────────────────────────────────────────────

function DialCodeSelect({ countries, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = countries.find(c => c.code === value) || countries[0];

  function computePos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dropW = 230;
    const dropH = 240;
    const gap = 4;

    let left = r.left;
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
    if (left < 8) left = 8;

    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < dropH + gap && r.top > dropH + gap;
    const top = openUp ? r.top - dropH - gap : r.bottom + gap;

    setDropPos({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    function onScroll(e) {
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function onMouseDown(e) {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  function handleToggle() {
    computePos();
    setOpen(v => !v);
  }

  const dropdown = open && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        left: dropPos.left,
        width: 230,
        background: '#16161f',
        border: '1px solid #2a2a3a',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        zIndex: 999999,
        maxHeight: 240,
        overflowY: 'auto',
      }}
    >
      {countries.map(c => {
        const active = c.code === value;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => { onChange(c.code); setOpen(false); }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: active ? '#c9a96e' : '#9a9aaa',
              textAlign: 'left',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e1e2a'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            <MiniFlag country={c} size={14} />
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#555568' }}>{c.dial}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '0 10px',
          height: 44,
          cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        <MiniFlag country={current} size={14} />
        <span>{current.dial}</span>
        <ChevronDown
          size={11}
          color="var(--text-muted)"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {dropdown}
    </div>
  );
}

// ─── Step 1: Gym Setup ────────────────────────────────────────────────────────

function GymStep({ form, set, errors, codeStatus, codeEdited, setCodeEdited, regenerateCode }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const statusColor = codeStatus === 'available' ? '#22c55e' : codeStatus === 'taken' ? 'var(--accent-red)' : 'var(--text-muted)';
  const statusText  = codeStatus === 'available' ? t('signup.gymCodeAvail') : codeStatus === 'taken' ? t('signup.gymCodeTaken') : codeStatus === 'checking' ? t('signup.gymCodeChecking') : '';
  const hp = isMobile ? 16 : 28;

  return (
    <>
      <div style={{ padding: `24px ${hp}px 0` }}>
        <h2 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{t('signup.gymTitle')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          {t('signup.gymSub')}
        </p>
      </div>
      <div style={{ padding: `0 ${hp}px 24px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={t('signup.gymCountry')} icon={Globe} required hint={t('signup.gymCountryHint')}>
          <select
            value={form.gymCountry}
            onChange={e => {
              const code = e.target.value;
              set('gymCountry', code);
              set('countryCode', code);
              set('managerCountryCode', code);
              set('city', '');
              set('customCity', '');
            }}
            style={{ ...inp(false), cursor: 'pointer' }}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label={t('signup.gymName')} icon={Building2} required error={errors.gymName}>
          <input
            style={inp(errors.gymName)}
            value={form.gymName}
            onChange={e => { set('gymName', e.target.value); }}
            placeholder={t('signup.gymNamePh')}
            autoFocus
          />
        </Field>

        <Field label={t('signup.gymCode')} icon={Building2} required error={errors.gymCode} hint={t('signup.gymCodeHint')}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                style={{ ...inp(errors.gymCode || codeStatus === 'taken'), paddingRight: 90 }}
                value={form.gymCode}
                onChange={e => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  set('gymCode', v);
                  setCodeEdited(true);
                }}
                placeholder={t('signup.gymCodePh')}
              />
              {statusText && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: statusColor, whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
                  {statusText}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={regenerateCode}
              title={t('signup.regenCode')}
              style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <RefreshCw size={13} color="var(--text-muted)" />
            </button>
          </div>
        </Field>

        {(() => {
          const countryData = COUNTRIES.find(c => c.code === form.gymCountry);
          const cities = countryData?.cities || [];
          const isOther = form.city === '__other__';
          return (
            <>
              <Field label={t('signup.gymCity')} icon={MapPin} required error={errors.city}>
                <select
                  value={form.city}
                  onChange={e => { set('city', e.target.value); set('customCity', ''); }}
                  style={{ ...inp(errors.city), cursor: 'pointer', color: form.city ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <option value="">{t('signup.gymCityPh')}</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__other__">{t('signup.gymCityOther')}</option>
                </select>
              </Field>

              {isOther && (
                <div style={{ marginTop: -8 }}>
                  <input
                    autoFocus
                    style={{ ...inp(errors.city && !form.customCity.trim()), width: '100%', boxSizing: 'border-box' }}
                    value={form.customCity}
                    onChange={e => set('customCity', e.target.value)}
                    placeholder={t('signup.gymCityOtherPh')}
                  />
                </div>
              )}

              <Field label={t('signup.gymAddress')} icon={MapPin} hint={t('signup.gymAddressHint')}>
                <input
                  style={inp(false)}
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder={countryData?.addressPh || t('signup.gymAddressPh')}
                />
              </Field>
            </>
          );
        })()}

        <Field label={t('signup.gymPhone')} icon={Phone} required error={errors?.phone}>
          <div style={{ display: 'flex', gap: 8 }}>
            <DialCodeSelect countries={COUNTRIES} value={form.countryCode} onChange={v => set('countryCode', v)} />
            <input
              style={{ ...inp(errors?.phone), flex: 1 }}
              inputMode="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/[^\d\s+\-()]/g, ''))}
              placeholder={COUNTRIES.find(c => c.code === form.countryCode)?.placeholder || '6XX XXX XXX'}
            />
          </div>
        </Field>
      </div>
    </>
  );
}

// ─── Step 2: Account ──────────────────────────────────────────────────────────

function AccountStep({ form, set, errors, showPw, setShowPw, showConfirm, setShowConfirm, countries }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const hp = isMobile ? 16 : 28;

  return (
    <>
      <div style={{ padding: `24px ${hp}px 0` }}>
        <h2 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{t('signup.accountTitle')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          {t('signup.accountSubPre')} <strong style={{ color: 'var(--text-primary)' }}>{form.gymName || t('signup.accountYourGym')}</strong>{t('signup.accountSubPost')}
        </p>
      </div>
      <div style={{ padding: `0 ${hp}px 24px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label={t('signup.firstName')} icon={User} required error={errors.firstName}>
            <input style={inp(errors.firstName)} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder={t('signup.firstNamePh')} autoFocus />
          </Field>
          <Field label={t('signup.lastName')} icon={User} required error={errors.lastName}>
            <input style={inp(errors.lastName)} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder={t('signup.lastNamePh')} />
          </Field>
        </div>

        <Field label={t('signup.email')} icon={Mail} required error={errors.email}>
          <input type="email" style={inp(errors.email)} value={form.email} onChange={e => set('email', e.target.value)} placeholder={t('signup.emailPh')} />
        </Field>

        <Field label={t('signup.phone')} icon={Phone} required error={errors.managerPhone}>
          <div style={{ display: 'flex', gap: 8 }}>
            <DialCodeSelect countries={countries} value={form.managerCountryCode} onChange={v => set('managerCountryCode', v)} />
            <input
              style={{ ...inp(errors.managerPhone), flex: 1 }}
              inputMode="tel"
              value={form.managerPhone}
              onChange={e => set('managerPhone', e.target.value.replace(/[^\d\s+\-()]/g, ''))}
              placeholder={countries.find(c => c.code === form.managerCountryCode)?.placeholder || '6XX XXX XXX'}
            />
          </div>
        </Field>

        <Field label={t('signup.password')} icon={Lock} required error={errors.password}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              style={{ ...inp(errors.password), paddingRight: 40 }}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={t('signup.passwordPh')}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <Field label={t('signup.confirmPw')} icon={Lock} required error={errors.confirmPassword}>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              style={{ ...inp(errors.confirmPassword), paddingRight: 40 }}
              value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)}
              placeholder={t('signup.confirmPwPh')}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
      </div>
    </>
  );
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────

function SuccessStep({ gymCode, gymName, firstName, managerCode, onGo }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const cardPad = isMobile ? '16px' : '20px 24px';
  return (
    <div style={{ textAlign: 'center', padding: isMobile ? '0 16px' : 0 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <Check size={36} color="#22c55e" strokeWidth={2.5} />
      </div>

      <h1 style={{ fontFamily: 'Manrope', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
        {t('signup.successTitle')} {firstName}{t('signup.successExclaim')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
        <strong style={{ color: 'var(--text-primary)' }}>{gymName}</strong> {t('signup.successSub')}
      </p>

      <div style={{ background: 'rgba(248,113,113,0.06)', border: '1.5px solid rgba(248,113,113,0.35)', borderRadius: 16, padding: cardPad, marginBottom: 20, boxShadow: '0 4px 20px rgba(248,113,113,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#f87171' }}>
            {t('signup.successImportant')}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          {t('signup.successCodeDesc')}
        </div>

        {managerCode ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: isMobile ? '14px' : '18px 24px', display: 'inline-block', margin: '0 auto', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
              {t('signup.successCodeLabel')}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? 48 : 56, fontWeight: 800, letterSpacing: '0.35em', color: '#f87171', lineHeight: 1 }}>
              {managerCode}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('signup.successCodeFallback')}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
          {t('signup.successCodeHint')}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: cardPad, marginBottom: 28, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>{t('signup.successGymCodeLabel')}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '0.05em', marginBottom: 6 }}>
          {gymCode}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('signup.successGymCodeHint')}
        </div>
      </div>

      <button
        onClick={onGo}
        style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: isMobile ? 'flex' : 'inline-flex', width: isMobile ? '100%' : 'auto', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(201,169,110,0.35)', marginBottom: 16 }}
      >
        {t('signup.successGo')} <ArrowRight size={16} strokeWidth={2.5} />
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {t('signup.successTrial')}
      </div>
    </div>
  );
}
