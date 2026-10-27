import { useNavigate } from 'react-router-dom';
import { Users, BarChart2, Calendar, ChevronRight, CheckCircle2, ArrowRight, Zap, Shield, Mail, MessageCircle } from 'lucide-react';
import { SUPPORT, hasSupport } from '../utils/support';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LangToggle from '../components/LangToggle';
import { useIsMobile } from '../hooks/useIsMobile';
import GemMark from '../components/ui/GemMark';
import PoweredBy from '../components/ui/PoweredBy';

export default function LandingPage() {
  const nav = useNavigate();
  const { lang, switchLang, t } = useLanguage();
  const isMobile = useIsMobile();

  const px = isMobile ? '0 20px' : '0 24px';

  const FEATURES = [
    { icon: Users,    title: t('landing.feat1Title'), desc: t('landing.feat1Desc'), color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)'   },
    { icon: BarChart2,title: t('landing.feat2Title'), desc: t('landing.feat2Desc'), color: 'var(--accent-gold)',   dim: 'var(--accent-gold-dim)'   },
    { icon: Calendar, title: t('landing.feat3Title'), desc: t('landing.feat3Desc'), color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)'  },
    { icon: Shield,   title: t('landing.feat4Title'), desc: t('landing.feat4Desc'), color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      {/* ── Navbar ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-header)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: px, height: isMobile ? 56 : 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
            <GemMark size={isMobile ? 30 : 36} style={{ boxShadow: '0 2px 12px rgba(201,169,110,0.3)' }} />
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: isMobile ? 15 : 17, color: 'var(--text-primary)', lineHeight: 1.1 }}>GEM</div>
              {!isMobile && <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.5px', lineHeight: 1 }}>GymElite Manager</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
            <LangToggle lang={lang} switchLang={switchLang} />
            {!isMobile && <NavLink onClick={() => nav('/login')}>{t('landing.signIn')}</NavLink>}
            <GoldBtn onClick={() => nav('/signup')} small={isMobile}>
              {isMobile ? t('landing.getStarted') : <><span>{t('landing.getStarted')}</span> <ArrowRight size={14} strokeWidth={2.5} /></>}
            </GoldBtn>
            {isMobile && (
              <button onClick={() => nav('/login')} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                {t('landing.signIn')}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '48px 20px 36px' : '96px 24px 72px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: isMobile ? 300 : 600, height: isMobile ? 180 : 300, background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-gold-dim)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 999, padding: isMobile ? '5px 12px' : '6px 16px', marginBottom: isMobile ? 22 : 32 }}>
          <Zap size={11} color="var(--accent-gold)" />
          <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 600, color: 'var(--accent-gold)', letterSpacing: '0.3px' }}>
            {isMobile ? t('landing.badgeMobile') : t('landing.badge')}
          </span>
        </div>

        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 36 : 'clamp(40px, 7vw, 78px)', fontWeight: 800, lineHeight: 1.1, marginBottom: isMobile ? 16 : 22, letterSpacing: isMobile ? '-1px' : '-2px' }}>
          {t('landing.heroTitle1')}<br />
          <span style={{ background: 'linear-gradient(125deg, #c9a96e 10%, #f0d090 50%, #b08d4a 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {t('landing.heroTitle2')}
          </span>
        </h1>

        <p style={{ fontSize: isMobile ? 15 : 18, color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto', marginBottom: isMobile ? 28 : 40, lineHeight: 1.7 }}>
          {isMobile ? t('landing.heroSubMobile') : t('landing.heroSub')}
        </p>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, justifyContent: 'center', alignItems: 'center', marginBottom: isMobile ? 24 : 36, padding: isMobile ? '0 8px' : 0 }}>
          <GoldBtn large={!isMobile} fullWidth={isMobile} onClick={() => nav('/signup')}>
            {t('landing.requestAccess')} <ArrowRight size={isMobile ? 14 : 16} strokeWidth={2.5} />
          </GoldBtn>
          <OutlineBtn large={!isMobile} fullWidth={isMobile} onClick={() => nav('/login')}>
            {t('landing.signInGym')} <ChevronRight size={isMobile ? 14 : 16} />
          </OutlineBtn>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 24, alignItems: 'center', justifyContent: 'center' }}>
          {[t('landing.trustNoCard'), t('landing.trustTrial'), t('landing.trustSetup')].map(text => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle2 size={13} color="var(--accent-green)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '48px 20px' : '88px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 56 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 12 }}>{t('landing.featuresLabel')}</div>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 24 : 'clamp(26px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>
            {t('landing.featuresTitle')}
          </h2>
          <p style={{ fontSize: isMobile ? 13 : 15, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            {t('landing.featuresSub')}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: isMobile ? 12 : 16 }}>
          {FEATURES.map(f => <FeatureCard key={f.title} feature={f} isMobile={isMobile} />)}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '40px 20px' : '88px 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.1) 0%, rgba(201,169,110,0.03) 100%)', border: '1px solid rgba(201,169,110,0.22)', borderRadius: isMobile ? 16 : 24, padding: isMobile ? '36px 20px' : '64px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'var(--accent-gold)', filter: 'blur(100px)', opacity: 0.07, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 14 }}>{t('landing.ctaLabel')}</div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 22 : 'clamp(24px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>
              {t('landing.ctaTitle')}
            </h2>
            <p style={{ fontSize: isMobile ? 13 : 15, color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
              {isMobile ? t('landing.ctaSubMobile') : t('landing.ctaSub')}
            </p>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, justifyContent: 'center', padding: isMobile ? '0 8px' : 0 }}>
              <GoldBtn large={!isMobile} fullWidth={isMobile} onClick={() => nav('/signup')}>
                {t('landing.requestAccess')} <ArrowRight size={isMobile ? 14 : 16} strokeWidth={2.5} />
              </GoldBtn>
              <OutlineBtn large={!isMobile} fullWidth={isMobile} onClick={() => nav('/login')}>
                {t('landing.signIn')} <ChevronRight size={isMobile ? 14 : 16} />
              </OutlineBtn>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact: GEM's own, once they are set (D-33) ── */}
      {hasSupport && (
      <section style={{ borderTop: '1px solid var(--border-subtle)', padding: isMobile ? '40px 20px' : '72px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: isMobile ? 24 : 40 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 10 }}>{t('landing.contactLabel')}</div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 22 : 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.4px', margin: '0 0 10px' }}>
              {t('landing.contactTitle')}
            </h2>
            <p style={{ fontSize: isMobile ? 13 : 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
              {isMobile ? t('landing.contactSubMobile') : t('landing.contactSub')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, width: isMobile ? '100%' : 'auto' }}>
            {SUPPORT.email && (
            <a href={`mailto:${SUPPORT.email}`} style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: isMobile ? '14px 20px' : '18px 24px', cursor: 'pointer', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201,169,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={17} color="#c9a96e" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Email</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{SUPPORT.email}</div>
                </div>
              </div>
            </a>
            )}

            {SUPPORT.whatsapp && (
            <a href={SUPPORT.whatsappUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: isMobile ? '14px 20px' : '18px 24px', cursor: 'pointer', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageCircle size={17} color="#22c55e" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>WhatsApp</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{SUPPORT.whatsappLabel}</div>
                </div>
              </div>
            </a>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', padding: isMobile ? '20px' : '28px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => nav('/')}>
            <GemMark size={24} />
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13 }}>GEM</span>
            {!isMobile && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· GymElite Manager</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 2 : 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('landing.footerRights')}</span>
            {!isMobile && <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>}
            <PoweredBy style={{ fontSize: 12 }} />
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Reusable micro-components ── */
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

function GoldBtn({ onClick, children, large, small, fullWidth }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'linear-gradient(135deg, #d4b47a, #c9a96e)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)',
        border: 'none', color: '#0a0a0f', borderRadius: 10,
        padding: large ? '13px 28px' : small ? '8px 14px' : '8px 18px',
        fontSize: large ? 15 : small ? 12 : 13,
        fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s',
        width: fullWidth ? '100%' : 'auto',
        justifyContent: fullWidth ? 'center' : 'flex-start',
      }}
    >
      {children}
    </button>
  );
}

function OutlineBtn({ onClick, children, large, fullWidth }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--bg-elevated)' : 'transparent',
        border: `1px solid ${hov ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        color: hov ? 'var(--accent-gold)' : 'var(--text-secondary)',
        borderRadius: 10,
        padding: large ? '13px 28px' : '8px 18px',
        fontSize: large ? 15 : 13,
        fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s',
        width: fullWidth ? '100%' : 'auto',
        justifyContent: fullWidth ? 'center' : 'flex-start',
      }}
    >
      {children}
    </button>
  );
}

function FeatureCard({ feature, isMobile }) {
  const [hov, setHov] = useState(false);
  const { icon: Icon, title, desc, color, dim } = feature;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${hov ? color : 'var(--border-subtle)'}`,
        borderRadius: isMobile ? 12 : 16,
        padding: isMobile ? 16 : 24,
        transition: 'all 0.2s',
        cursor: 'default',
      }}
    >
      <div style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 10, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 12 : 16 }}>
        <Icon size={isMobile ? 17 : 20} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 13 : 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: isMobile ? 6 : 8 }}>{title}</div>
      <p style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
    </div>
  );
}
