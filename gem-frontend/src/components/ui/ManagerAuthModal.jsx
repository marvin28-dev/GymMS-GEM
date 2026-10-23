import { useState, useRef, useEffect } from 'react';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { verifyManager, verifyManagerPassword } from '../../services/auth.service';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAuth } from '../../utils/auth';
import CodeInput from './CodeInput';

/**
 * ManagerAuthModal
 *
 * Gate for manager-level actions, opened with the manager's own 4-digit access
 * code. The code is checked on the server and never sent to the browser, so
 * nothing that could pass the gate is ever in the page.
 *
 * Props:
 *   open        - boolean
 *   onClose     - called on cancel / close
 *   onConfirm   - called once the code is accepted
 *   onVerified  - alias for onConfirm, both are supported
 *   action      - short description of the action being authorised (string)
 *   usePassword - ask for the account password instead of the code. Only for
 *                 revealing your own access code, where asking for that code
 *                 would be circular. Anyone else's code takes your own code.
 *   danger      - boolean, makes the confirm styling red instead of gold
 */
export default function ManagerAuthModal({ open, onClose, onConfirm, onVerified, action = 'this action', usePassword = false, danger = false }) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setError('');
      setShowCode(false);
      setChecking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setCode(''); inputRef.current?.focus(); }, 600);
  };

  const handleSubmit = async () => {
    if (checking) return;
    if (usePassword ? !code : code.length < 4) { setError(t(usePassword ? 'managerAuth.incompletePassword' : 'managerAuth.incomplete')); return; }
    setChecking(true);
    setError('');
    try {
      const res = await (usePassword ? verifyManagerPassword(code, action) : verifyManager(code, action));
      if (res.data?.authorized) {
        setCode('');
        (onConfirm || onVerified)?.();
      } else {
        fail(t(usePassword ? 'managerAuth.incorrectPassword' : 'managerAuth.incorrect'));
      }
    } catch (err) {
      fail(err?.response?.data?.error || t(usePassword ? 'managerAuth.incorrectPassword' : 'managerAuth.incorrect'));
    } finally {
      setChecking(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    onClose?.();
  };

  const signedInUser = getAuth()?.user;
  const signedInName = signedInUser ? `${signedInUser.firstName || ''} ${signedInUser.lastName || ''}`.trim() : '';
  const accentColor = danger ? 'var(--accent-red)' : 'var(--accent-gold)';
  const confirmBg = danger
    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
    : 'linear-gradient(135deg, #c9a96e, #b08d4a)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${danger ? 'var(--accent-red)' : 'var(--border)'}`,
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          width: '100%',
          maxWidth: 380,
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          animation: shake ? 'shake 0.5s ease' : 'none',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: danger ? 'var(--accent-red-dim)' : 'var(--accent-gold-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert size={26} color={accentColor} strokeWidth={1.8} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {t('managerAuth.title')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'DM Sans' }}>
            {t(usePassword ? 'managerAuth.subtitlePassword' : 'managerAuth.subtitle')}<br />
            <span style={{ color: accentColor, fontWeight: 600 }}>{action}</span>
          </div>
          {/* The code is checked against this account and no other */}
          {signedInName && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, fontFamily: 'DM Sans' }}>
              {t(usePassword ? 'managerAuth.signedInAsPassword' : 'managerAuth.signedInAs', { name: signedInName })}
            </div>
          )}
        </div>

        <div style={{ width: '100%' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'DM Sans' }}>
            {t(usePassword ? 'managerAuth.passwordLabel' : 'managerAuth.codeLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            {!usePassword && !showCode ? (
              <CodeInput
                ref={inputRef}
                value={code}
                maxLength={4}
                onChange={(v) => { setCode(v); setError(''); }}
                onEnter={handleSubmit}
                placeholder={t('managerAuth.codePh')}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-elevated)',
                  border: `1.5px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                  borderRadius: 10, padding: '11px 40px 11px 14px',
                  fontSize: 22, letterSpacing: '0.5em', textAlign: 'center',
                  color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                }}
              />
            ) : (
            <input
              ref={inputRef}
              type={usePassword && !showCode ? 'password' : 'text'}
              value={code}
              onChange={e => { setCode(usePassword ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              inputMode={usePassword ? 'text' : 'numeric'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="gem-verify-field"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              maxLength={usePassword ? undefined : 4}
              placeholder={t(usePassword ? 'managerAuth.passwordPh' : 'managerAuth.codePh')}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                border: `1.5px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                borderRadius: 10, padding: '11px 40px 11px 14px',
                fontSize: usePassword ? 14 : 22,
                letterSpacing: usePassword ? 'normal' : '0.5em',
                textAlign: usePassword ? 'left' : 'center',
                color: 'var(--text-primary)',
                fontFamily: usePassword ? 'DM Sans' : 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
            )}
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2,
              }}
            >
              {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: 12, color: 'var(--accent-red)',
            fontFamily: 'DM Sans', textAlign: 'center',
            background: 'var(--accent-red-dim)',
            borderRadius: 8, padding: '6px 14px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1, background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', borderRadius: 8,
              fontSize: 13, fontWeight: 600, padding: '10px 0',
              cursor: 'pointer', fontFamily: 'DM Sans',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={checking}
            style={{
              flex: 1, background: confirmBg,
              border: 'none', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              padding: '10px 0', cursor: checking ? 'default' : 'pointer',
              fontFamily: 'DM Sans', opacity: checking ? 0.7 : 1,
            }}
          >
            {checking ? t('managerAuth.checking') : t('managerAuth.authorize')}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>
          {t('managerAuth.note')}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-10px); }
          40%       { transform: translateX(10px); }
          60%       { transform: translateX(-8px); }
          80%       { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
