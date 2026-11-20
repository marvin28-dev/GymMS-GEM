import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import GemMark from '../../components/ui/GemMark';
import GemInput from '../../components/ui/GemInput';
import LangToggle from '../../components/LangToggle';
import { useLanguage } from '../../contexts/LanguageContext';
import { isAdminAuthed, setAdminAuth } from '../../utils/adminAuth';
import { login } from '../../services/admin.service';
import { Problem } from './adminUi';
import { card, goldBtn, refusal } from './adminFormat';

// GEM's admin signs in here with the email and password set on the server.
// No gym account opens it, and it opens no gym.
export default function AdminLoginPage() {
  const { t, lang, switchLang } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (isAdminAuthed()) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setErr(t('admin.loginNeedBoth')); return; }
    setBusy(true); setErr('');
    try {
      const { data } = await login(email.trim(), password);
      setAdminAuth(data);
      navigate('/admin', { replace: true });
    } catch (error) {
      setErr(refusal(error, t('admin.loginFailed')));
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><LangToggle lang={lang} switchLang={switchLang} /></div>
      <form onSubmit={submit} data-admin-login style={{ ...card, width: '100%', maxWidth: 400, padding: '28px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GemMark size={40} />
          <div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{t('admin.loginTitle')}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.loginSub')}</p>
          </div>
        </div>
        <GemInput label={t('admin.email')} type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} />
        <GemInput label={t('admin.password')} type="password" value={password} onChange={e => { setPassword(e.target.value); setErr(''); }} />
        <Problem>{err}</Problem>
        <button type="submit" disabled={busy} style={{ ...goldBtn, padding: '12px 16px', opacity: busy ? 0.6 : 1 }}>
          <ShieldCheck size={16} /> {busy ? t('admin.signingIn') : t('admin.signIn')}
        </button>
      </form>
    </div>
  );
}
