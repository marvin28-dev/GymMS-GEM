import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, RefreshCw, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLiveTick } from '../hooks/useLiveRefresh';
import GemMark from '../components/ui/GemMark';
import LangToggle from '../components/LangToggle';
import SupportLinks from '../components/SupportLinks';
import PoweredBy from '../components/ui/PoweredBy';
import GemBilling from '../components/GemBilling';
import { getBillingStatus } from '../services/billing.service';
import { clearAuth, getAuth, getHomeRoute, signInPath, updateSessionUser } from '../utils/auth';

// What a gym's staff see while GEM has paused its account (an unpaid bill):
// why, and for the owner what is due and how to pay. They stay signed in, and
// the screen moves on by itself once GEM reopens the account.
export default function AccountPausedPage() {
  const { t, lang, switchLang } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const liveTick = useLiveTick(['billing']);

  const check = useCallback(() => {
    getBillingStatus().then(r => {
      setChecking(false);
      if (!r.data.locked) {
        updateSessionUser({ gymLocked: false });
        navigate(getHomeRoute(), { replace: true });
        return;
      }
      setStatus(r.data);
    }).catch(() => setChecking(false));
  }, [navigate]);
  useEffect(() => { check(); }, [check, liveTick]);

  const signOut = () => {
    const to = signInPath();
    clearAuth();
    navigate(to, { replace: true });
  };
  const isOwner = status ? status.isOwner : getAuth()?.user?.role === 'general_manager';

  return (
    <div data-account-paused style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GemMark size={28} />
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15 }}>GEM</span>
        </div>
        <LangToggle lang={lang} switchLang={switchLang} />
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: 640, margin: '0 auto', padding: '28px 16px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={24} color="var(--accent-red)" /></div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, margin: 0, textWrap: 'balance' }}>{t('paused.title', { gym: getAuth()?.user?.gymName || '' })}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 480 }}>{isOwner ? t('paused.ownerBody') : t('paused.staffBody')}</p>
          {status?.reason && <div data-paused-reason style={{ fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px' }}><span style={{ color: 'var(--text-muted)' }}>{t('paused.reason')}</span> {status.reason}</div>}
        </div>

        {isOwner && <GemBilling onlyDue />}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" data-check-again onClick={() => { setChecking(true); check(); }} disabled={checking}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: checking ? 0.6 : 1 }}>
            <RefreshCw size={15} /> {t('paused.checkAgain')}
          </button>
          <button type="button" onClick={signOut}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <LogOut size={15} /> {t('paused.signOut')}
          </button>
        </div>
        <SupportLinks label={t('paused.contact')} />
      </main>
      <footer style={{ padding: '14px 16px', textAlign: 'center' }}><PoweredBy /></footer>
    </div>
  );
}
