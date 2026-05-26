import { useState, useRef, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { getCode } from '../../services/staff.service';
import { getAuth } from '../../utils/auth';

/**
 * ManagerAuthModal
 *
 * Reusable 4-digit PIN gate for manager-level actions.
 *
 * Props:
 *   open        – boolean
 *   onClose     – called on cancel / close
 *   onConfirm   – called when correct code is entered
 *   action      – short description of the action being authorized (string)
 *   danger      – boolean, makes the confirm styling red instead of gold
 */
export default function ManagerAuthModal({ open, onClose, onConfirm, action = 'this action', danger = false }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError]   = useState('');
  const [shake, setShake]   = useState(false);
  const [managerCode, setManagerCode] = useState(null);
  const inputRefs           = useRef([]);

  useEffect(() => {
    if (open) {
      setDigits(['', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      if (managerCode === null) {
        const staffId = getAuth()?.user?.id;
        if (staffId) {
          getCode(staffId).then(res => setManagerCode(res.data?.accessCode || '')).catch(() => setManagerCode(''));
        } else {
          setManagerCode('');
        }
      }
    }
  }, [open]);

  if (!open) return null;

  const handleDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError('');
    if (val && idx < 3) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') handleSubmit();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(''));
      inputRefs.current[3]?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = () => {
    const code = digits.join('');
    if (code.length < 4) { setError('Please enter the full 4-digit code.'); return; }
    if (!managerCode || code !== managerCode) {
      setError('Incorrect authorization code. Try again.');
      setShake(true);
      setTimeout(() => { setShake(false); setDigits(['', '', '', '']); inputRefs.current[0]?.focus(); }, 600);
      return;
    }
    setDigits(['', '', '', '']);
    setError('');
    onConfirm();
  };

  const handleClose = () => {
    setDigits(['', '', '', '']);
    setError('');
    onClose();
  };

  const accentColor = danger ? 'var(--accent-red)' : 'var(--accent-gold)';
  const confirmBg   = danger
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
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: danger ? 'var(--accent-red-dim)' : 'var(--accent-gold-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert size={26} color={accentColor} strokeWidth={1.8} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Manager Authorization
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'DM Sans' }}>
            Enter the manager code to authorize:<br />
            <span style={{ color: accentColor, fontWeight: 600 }}>{action}</span>
          </div>
        </div>

        {/* PIN boxes */}
        <div style={{ display: 'flex', gap: 12 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              style={{
                width: 56, height: 64,
                textAlign: 'center',
                fontSize: 28, fontWeight: 700,
                fontFamily: 'Manrope, sans-serif',
                background: 'var(--bg-elevated)',
                border: `2px solid ${error ? 'var(--accent-red)' : d ? accentColor : 'var(--border-subtle)'}`,
                borderRadius: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                caretColor: accentColor,
                transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {/* Error */}
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

        {/* Buttons */}
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 1, background: confirmBg,
              border: 'none', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              padding: '10px 0', cursor: 'pointer', fontFamily: 'DM Sans',
            }}
          >
            Authorize
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>
          Only the gym manager can authorize this action.
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
