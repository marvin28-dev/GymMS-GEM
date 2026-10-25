import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, CheckCircle2, AlertCircle } from 'lucide-react';
import { verifyEmail } from '../services/auth.service';
import { getAuth, isAuthed, getHomeRoute, updateSessionUser } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)' };
const goldBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 10, padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' };

// Where the link in a confirmation email lands (D-8). It works signed in or
// not, often on a phone opened from the inbox.
export default function VerifyEmailPage() {
  const nav = useNavigate();
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState(token ? 'checking' : 'failed');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) return;
    let live = true;
    verifyEmail(token)
      .then(res => {
        if (!live) return;
        setEmail(res.data?.email || '');
        // The reminder in the app goes at once if this is the person signed in here
        if (getAuth()?.user?.email && getAuth().user.email.toLowerCase() === String(res.data?.email || '').toLowerCase()) {
          updateSessionUser({ emailUnconfirmed: false });
        }
        setState('done');
      })
      .catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [token]);

  const open = () => nav(isAuthed() ? getHomeRoute() : '/login');

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
        <div style={{ width: '100%', maxWidth: 420 }}>
          {state === 'checking' ? (
            <div style={card} role="status">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('auth.confirmChecking')}</p>
            </div>
          ) : (
            <div style={card}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: state === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${state === 'done' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                {state === 'done' ? <CheckCircle2 size={26} color="#22c55e" /> : <AlertCircle size={26} color="#ef4444" />}
              </div>
              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {state === 'done' ? t('auth.confirmDoneTitle') : t('auth.confirmFailTitle')}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 28px', overflowWrap: 'anywhere' }}>
                {state === 'done' ? t('auth.confirmDoneDesc', { email }) : t('auth.confirmFailDesc')}
              </p>
              <button type="button" onClick={open} style={goldBtn}>{t('auth.confirmOpenApp')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
