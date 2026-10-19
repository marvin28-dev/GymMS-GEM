import { useState, useEffect } from 'react';
import Modal from './Modal';
import CodeInput from './CodeInput';
import { useLanguage } from '../../contexts/LanguageContext';

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
};
const secondaryBtn = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
};

export default function VisitorCodeModal({ open, onClose, visitor, onSuccess }) {
  const { t } = useLanguage();
  const [entered, setEntered] = useState('');
  const [error, setError]     = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => { if (!open) { setEntered(''); setError(''); setVerified(false); } }, [open]);

  const handleConfirm = () => {
    if (entered.trim() === visitor?.accessCode) {
      setVerified(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 700);
    } else {
      setError(t('members.incorrectCodeRetry'));
      setEntered('');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('members.visitorAccessCode')} maxWidth={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {verified ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#34d399', fontWeight: 700, fontSize: 16, fontFamily: 'Manrope' }}>
            {t('members.verified')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('members.askForAccessCode', { name: `${visitor?.firstName} ${visitor?.lastName}` })}
            </div>
            <CodeInput
              autoFocus
              maxLength={6}
              value={entered}
              onChange={v => { setEntered(v); setError(''); }}
              onEnter={handleConfirm}
              placeholder="••••"
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)'}`,
                borderRadius: 10, padding: '11px 14px',
                fontSize: 24, color: 'var(--accent-gold)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.35em', textAlign: 'center',
                outline: 'none', width: '100%', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
            {error && <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'DM Sans' }}>{error}</span>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
              <button
                style={{ ...primaryBtn, opacity: entered.trim() ? 1 : 0.4, cursor: entered.trim() ? 'pointer' : 'not-allowed' }}
                disabled={!entered.trim()}
                onClick={handleConfirm}
              >
                {t('common.confirm')} →
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
