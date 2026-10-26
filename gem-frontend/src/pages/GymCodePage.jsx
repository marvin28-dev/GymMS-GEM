import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, Search, Users, CreditCard, Monitor, BarChart3 } from 'lucide-react';
import { getGymByCode } from '../services/gym.service';
import { isAuthed } from '../utils/auth';
import LangToggle from '../components/LangToggle';
import SupportLinks from '../components/SupportLinks';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';
import GemMark from '../components/ui/GemMark';
import PoweredBy from '../components/ui/PoweredBy';

const PERK_ICONS = [Users, CreditCard, Monitor, BarChart3];

export default function GymCodePage() {
  const nav = useNavigate();
  const { lang, switchLang, t } = useLanguage();
  const isMobile = useIsMobile();

  const PERKS = [
    { icon: PERK_ICONS[0], text: t('auth.perk1') },
    { icon: PERK_ICONS[1], text: t('auth.perk2') },
    { icon: PERK_ICONS[2], text: t('auth.perk3') },
    { icon: PERK_ICONS[3], text: t('auth.perk4') },
  ];

  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthed()) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = code.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) { setError(t('auth.codeErrorEmpty')); return; }
    setLoading(true);
    setError('');
    try {
      const res = await getGymByCode(trimmed);
      // Navigate with the code as the server stored it, not as it was typed
      nav(`/${res.data?.code || trimmed}/login`);
    } catch (err) {
      if (err?.response?.status === 404) setError(t('auth.codeErrorNotFound'));
      else if (err?.response) setError(t('auth.codeErrorServer'));
      else setError(t('auth.codeErrorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div onClick={() => nav('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <GemMark size={30} />
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LangToggle lang={lang} switchLang={switchLang} />
            <button onClick={() => nav('/signup')} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--accent-gold)', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('auth.signUp')}</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 60px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <GemMark size={60} style={{ boxShadow: '0 8px 24px rgba(201,169,110,0.3)' }} />
          </div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.4px' }}>
            {t('auth.codeTitle')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, marginBottom: 36 }}>
            {t('auth.codeSub')}
          </p>

          <div style={{ position: 'relative', marginBottom: error ? 8 : 14 }}>
            <Search size={16} color={focused ? '#c9a96e' : 'var(--text-muted)'} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 0.2s' }} />
            <input
              autoFocus
              value={code}
              onChange={e => { setCode(e.target.value); setError(''); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder={t('auth.codePlaceholder')}
              style={{ width: '100%', background: 'var(--bg-card)', border: `1.5px solid ${error ? 'var(--accent-red)' : focused ? '#c9a96e' : 'var(--border-subtle)'}`, borderRadius: 12, padding: '15px 14px 15px 46px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            />
          </div>

          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 12 }}>&#9888; {error}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: loading ? 'var(--text-muted)' : '#0a0a0f', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 4px 16px rgba(201,169,110,0.3)' }}>
            {loading ? t('auth.codeChecking') : <><ArrowRight size={16} strokeWidth={2.5} /> {t('auth.codeContinue')}</>}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('auth.codeNoAccount')}{' '}
            <button type="button" onClick={() => nav('/signup')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: '#c9a96e', fontWeight: 600, cursor: 'pointer' }}>{t('auth.codeStartTrial')}</button>
            {t('auth.code7daysFree')}
          </p>
          <PoweredBy style={{ textAlign: 'center', marginTop: 24 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── LEFT: Branded panel ─────────────────────────────────────── */}
      <div className="gem-login-left" style={{
        width: 420, flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        padding: '40px 48px',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Decorative gold glows */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,169,110,0.13) 0%, transparent 68%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,169,110,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div onClick={() => nav('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 'auto', position: 'relative', zIndex: 1, cursor: 'pointer' }}>
          <GemMark size={32} />
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
        </div>

        {/* Centre content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '48px 0' }}>
          <h2 style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 30, fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.2, letterSpacing: '-0.5px',
            marginBottom: 14,
          }}>
            {t('auth.codePanelTitle1')}<br />
            <span style={{ color: '#c9a96e' }}>{t('auth.codePanelTitle2')}</span>
          </h2>

          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32, maxWidth: 300 }}>
            {t('auth.codePanelSub')}
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PERKS.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: 'rgba(201,169,110,0.12)',
                  border: '1px solid rgba(201,169,110,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={12} color="#c9a96e" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom - signup prompt */}
        <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {t('auth.codePanelNew')}{' '}
            <span
              onClick={() => nav('/signup')}
              style={{ color: '#c9a96e', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {t('auth.codePanelTrial')}
            </span>
          </p>
        </div>
      </div>

      {/* ── RIGHT: Login form ───────────────────────────────────────── */}
      <div className="gem-login-form-panel" style={{
        flex: 1,
        background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 20, right: 24 }}>
          <LangToggle lang={lang} switchLang={switchLang} />
        </div>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <GemMark size={52} style={{ boxShadow: '0 6px 24px rgba(201,169,110,0.3)' }} />
          </div>

          <h1 style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 24, fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 6, letterSpacing: '-0.4px',
            textAlign: 'center',
          }}>
            {t('auth.codeTitle')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32, textAlign: 'center' }}>
            {t('auth.codeSub')}
          </p>

          {/* Form card */}
          <div className="gem-login-form-card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18, padding: 24,
            boxShadow: 'var(--shadow-card)',
          }}>
            <label style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-muted)', display: 'block',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              {t('auth.codeLabel')} *
            </label>

            <div style={{ position: 'relative', marginBottom: error ? 6 : 16 }}>
              <Search
                size={16}
                color={focused ? 'var(--accent-gold)' : 'var(--text-muted)'}
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 0.2s' }}
              />
              <input
                autoFocus
                value={code}
                onChange={e => { setCode(e.target.value); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={t('auth.codePlaceholder')}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: `1.5px solid ${error ? 'var(--accent-red)' : focused ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                  borderRadius: 10, padding: '13px 14px 13px 42px',
                  fontSize: 15, color: 'var(--text-primary)', fontFamily: 'DM Sans',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚠ {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)',
                border: 'none',
                color: loading ? 'var(--text-muted)' : '#0a0a0f',
                borderRadius: 10, padding: '13px',
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 2px 12px rgba(201,169,110,0.25)',
              }}
            >
              {loading ? t('auth.codeChecking') : <>{t('auth.codeContinue')} <ArrowRight size={16} strokeWidth={2.5} /></>}
            </button>
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
            {t('auth.codeDontHave')}{' '}
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => nav('/signup')}
            >
              {t('auth.codeStartTrial')}
            </button>
            {'. '}{t('auth.codeDays')}
          </p>

          {/* Contact */}
          <SupportLinks label={t('auth.codeSupport')} style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }} />
          <PoweredBy style={{ textAlign: 'center', marginTop: 20 }} />

        </div>
      </div>
    </div>
  );
}
