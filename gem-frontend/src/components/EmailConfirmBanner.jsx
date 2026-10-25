import { useEffect, useState } from 'react';
import { MailCheck, X } from 'lucide-react';
import { getMe, resendConfirmation } from '../services/auth.service';
import { getAuth, updateSessionUser } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';

const HIDDEN_KEY = 'gem_confirm_hidden';

// "Confirm your email address", for a new owner or someone whose address
// changed, until the link is used (D-8). Nothing is locked meanwhile. Hidden
// for the rest of the tab's session on request; asked again on focus, so the
// reminder goes once the link was opened in another tab.
export default function EmailConfirmBanner({ isMobile }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(() => !!getAuth()?.user?.emailUnconfirmed);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } });
  const [sending, setSending] = useState('idle');

  useEffect(() => {
    const check = () => {
      if (document.hidden) return;
      getMe()
        .then(res => { const next = !!res.data?.emailUnconfirmed; setPending(next); updateSessionUser({ emailUnconfirmed: next }); })
        .catch(err => console.warn('Could not check the email confirmation:', err?.message));
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  if (!pending || hidden) return null;

  const sendAgain = async () => {
    setSending('sending');
    try { await resendConfirmation(); setSending('sent'); } catch { setSending('failed'); }
  };
  const hide = () => {
    setHidden(true);
    // A browser that refuses storage shows it again on the next page load
    try { sessionStorage.setItem(HIDDEN_KEY, '1'); } catch (err) { console.warn('Could not remember the hidden reminder:', err?.message); }
  };

  return (
    <div data-email-confirm style={{ margin: isMobile ? '12px 16px 0' : '0 0 18px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', background: 'var(--accent-yellow-dim)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 12, padding: '10px 12px 10px 14px', fontFamily: 'DM Sans', fontSize: 13, color: 'var(--text-primary)' }}>
      <MailCheck size={16} color="var(--accent-yellow)" style={{ flexShrink: 0 }} />
      <span style={{ flex: '1 1 220px', minWidth: 0, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        {t('auth.confirmBanner', { email: getAuth()?.user?.email || '' })}
        {/* Only the answer to Send it again is announced; the reminder itself is not news */}
        {sending === 'sent' && <strong role="status" style={{ marginLeft: 6 }}>{t('auth.confirmSent')}</strong>}
        {sending === 'failed' && <span role="alert" style={{ marginLeft: 6, color: 'var(--accent-red)' }}>{t('auth.confirmSendFailed')}</span>}
      </span>
      {sending !== 'sent' && (
        <button type="button" onClick={sendAgain} disabled={sending === 'sending'} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', opacity: sending === 'sending' ? 0.6 : 1 }}>
          {t('auth.confirmSendAgain')}
        </button>
      )}
      <button type="button" onClick={hide} aria-label={t('auth.confirmHide')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}>
        <X size={15} />
      </button>
    </div>
  );
}
