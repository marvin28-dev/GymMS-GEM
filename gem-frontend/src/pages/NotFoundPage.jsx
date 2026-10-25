import { useNavigate } from 'react-router-dom';
import { Dumbbell, Compass } from 'lucide-react';
import { isAuthed, getHomeRoute } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';

// An address that leads nowhere says so (D-6); it used to land silently on the
// home page, which read as the link working.
export default function NotFoundPage() {
  const nav = useNavigate();
  const { t } = useLanguage();
  const home = isAuthed() ? getHomeRoute() : '/';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '0 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/')}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={14} color="#0a0a0f" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>GEM</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Compass size={26} color="var(--accent-gold)" />
          </div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>{t('common.notFoundTitle')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px' }}>{t('common.notFoundText')}</p>
          <button type="button" onClick={() => nav(home, { replace: true })} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            {t('common.notFoundHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
