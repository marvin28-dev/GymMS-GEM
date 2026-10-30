import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SkeletonLine } from '../Skeleton';
import GemMark from './GemMark';
import SupportLinks from '../SupportLinks';

// What a screen shows while it is still on its way: a page's code arriving the
// first time it is opened, or a profile's record. It used to be nothing at all.
//   page     the shape of a page, in the app's content area (sidebar and header stay)
//   profile  the shape of a member's or a staff member's profile
//   screen   a whole screen with no frame yet (public pages, the front desk)
// It appears after a moment, so a page already on its way never blinks, and
// after a while says it is slow and offers to reload.
const SHOW_AFTER_MS = 150;
const SLOW_AFTER_MS = 10_000;

const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
const pulse = (i) => ({ animationDelay: `${i * 70}ms` });

function SlowNotice({ t }) {
  return (
    <div data-page-loader-slow style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 16px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans', maxWidth: 360 }}>{t('common.stillLoading')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer', minHeight: 44 }}
      >
        {t('common.reload')}
      </button>
      <SupportLinks quiet label={t('common.supportLine')} />
    </div>
  );
}

function PageShape({ isMobile }) {
  const tiles = isMobile ? 2 : 4;
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonLine width={isMobile ? '55%' : 240} height={22} />
        <SkeletonLine width={isMobile ? '80%' : 340} height={12} style={pulse(1)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles}, minmax(0, 1fr))`, gap: isMobile ? 10 : 16 }}>
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} style={{ ...card, padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonLine width="45%" height={10} style={pulse(i)} />
            <SkeletonLine width="65%" height={20} style={pulse(i + 1)} />
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: isMobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20 }}>
        <SkeletonLine width={isMobile ? '45%' : '22%'} height={14} />
        {['72%', '58%', '66%', '50%', '62%'].slice(0, isMobile ? 4 : 5).map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', animation: 'gem-skeleton 1.4s ease-in-out infinite', flexShrink: 0, ...pulse(i) }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <SkeletonLine width={w} style={pulse(i)} />
              <SkeletonLine width="30%" height={10} style={pulse(i + 1)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileShape({ isMobile }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>
      <div style={{ ...card, padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: '50%', background: 'var(--bg-elevated)', animation: 'gem-skeleton 1.4s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonLine width={isMobile ? '60%' : 260} height={20} style={pulse(1)} />
            <SkeletonLine width={isMobile ? '40%' : 180} height={11} style={pulse(2)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 5}, minmax(0, 1fr))`, gap: 12 }}>
          {Array.from({ length: isMobile ? 4 : 5 }, (_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonLine width="50%" height={9} style={pulse(i)} />
              <SkeletonLine width="75%" height={14} style={pulse(i + 1)} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {[88, 104, 92, 80, 96].slice(0, isMobile ? 3 : 5).map((w, i) => (
          <SkeletonLine key={i} width={w} height={32} style={{ borderRadius: 9, flexShrink: 0, ...pulse(i) }} />
        ))}
      </div>
      <div style={{ ...card, padding: isMobile ? 16 : 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {['40%', '85%', '70%', '78%', '55%'].map((w, i) => <SkeletonLine key={i} width={w} height={i ? 12 : 15} style={pulse(i)} />)}
      </div>
    </div>
  );
}

// A small "Loading" for a part of a page whose frame is already drawn, such as
// the calendar's grid while its events arrive. `compact` shows only the dots.
export function InlineLoader({ compact = false, style }) {
  const { t } = useLanguage();
  return (
    <span role="status" data-inline-loader style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', flexShrink: 0, ...style }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 4 }}>
        {[0, 1, 2].map(i => <span key={i} className="gem-loader-dot" style={{ animationDelay: `${i * 160}ms` }} />)}
      </span>
      <span style={compact ? srOnly : undefined}>{t('common.loading')}</span>
    </span>
  );
}

export default function PageLoader({ variant = 'page' }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [shown, setShown] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    const late = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => { clearTimeout(show); clearTimeout(late); };
  }, []);

  const label = <span style={srOnly}>{t('common.loading')}</span>;

  if (variant === 'screen') {
    return (
      <div data-page-loader="screen" role="status" aria-live="polite" style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16, boxSizing: 'border-box' }}>
        {label}
        {shown && (
          <>
            <div className="gem-loader-mark"><GemMark size={56} /></div>
            <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map(i => <span key={i} className="gem-loader-dot" style={{ animationDelay: `${i * 160}ms` }} />)}
            </div>
          </>
        )}
        {slow && <SlowNotice t={t} />}
      </div>
    );
  }

  return (
    <div data-page-loader={variant} role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 320 }}>
      {label}
      {shown && (variant === 'profile' ? <ProfileShape isMobile={isMobile} /> : <PageShape isMobile={isMobile} />)}
      {slow && <SlowNotice t={t} />}
    </div>
  );
}
