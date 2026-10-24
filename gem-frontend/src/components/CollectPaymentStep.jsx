import { useState, useEffect } from 'react';
import { CreditCard, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods, acceptedMethod } from '../utils/paymentMethods';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { digitsOnly } from '../utils/number';

// Taking the money while adding someone (a new member's registration fee, a new
// visitor's bundle or day pass). The person does not exist yet, so nothing is
// written here: this only records what was collected and how, and the form
// refuses to create the person until it has. The payment itself is saved the
// moment they are created, so an abandoned form never leaves money behind.
//
// amountDue is the price; the amount can't go over it. minAmount (default: all
// of it) is the least that may be taken; with minPct set, the share collected
// shows as the staff type, red under the minimum and green once it is met.
export default function CollectPaymentStep({ amountDue, minAmount, minPct, collected, onCollect, onChange, error }) {
  const { t } = useLanguage();
  const methods = enabledMethods(useGymSettings());
  const min = minAmount ?? amountDue;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(amountDue || ''));
  const [picked, setPicked] = useState('');
  const method = acceptedMethod(picked, methods);

  // A different price (another bundle picked) starts the step over
  useEffect(() => { setAmount(String(amountDue || '')); setOpen(false); }, [amountDue]);

  const n = parseInt(amount, 10) || 0;
  const overMax = n > amountDue;
  const underMin = n < min;
  const pct = amountDue > 0 ? Math.floor((n / amountDue) * 100) : 0;
  const pctOk = minPct == null || pct >= minPct;
  const valid = n > 0 && !overMax && !underMin;
  const fixed = min >= amountDue;

  const box = { background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 };
  const inp = { width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };
  const methodLabel = (key) => { const m = methods.find(x => x.key === key); return m ? t(m.labelKey) : key; };

  if (collected) {
    return (
      <div style={{ ...box, borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.07)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#34d399', fontFamily: 'DM Sans' }}>
          <Check size={15} /> {t('collect.collected', { amount: formatMoney(collected.amount), method: methodLabel(collected.method) })}
          {collected.amount < amountDue && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {t('collect.remainder', { amount: formatMoney(amountDue - collected.amount) })}</span>}
        </span>
        <button type="button" onClick={() => { onChange?.(); setOpen(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'DM Sans' }}>
          {t('collect.change')}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div style={{ ...box, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('collect.dueNow')}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>{formatMoney(amountDue)}</div>
          {!fixed && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('collect.atLeast', { pct: minPct, amount: formatMoney(min) })}</div>}
          {error && <div style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4 }}>{error}</div>}
        </div>
        <button type="button" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>
          <CreditCard size={14} /> {t('memberProfile.collectPaymentPlain')}
        </button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>{t('memberProfile.amountInShort', { currency: getCurrencySymbol() })}</label>
          <input type="text" inputMode="numeric" value={amount} readOnly={fixed}
            onChange={e => setAmount(digitsOnly(e.target.value))}
            style={{ ...inp, ...(fixed ? { color: 'var(--text-muted)', cursor: 'not-allowed' } : {}), borderColor: (overMax || underMin) && n > 0 ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
        </div>
        <div>
          <label style={lbl}>{t('memberProfile.methodLabel')}</label>
          <select value={method} onChange={e => setPicked(e.target.value)} style={inp}>
            {methods.map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
          </select>
        </div>
      </div>
      {minPct != null && n > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pctOk && !overMax ? '#34d399' : '#ef4444', transition: 'width 0.2s, background 0.2s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: pctOk && !overMax ? '#34d399' : '#ef4444', minWidth: 44, textAlign: 'right' }}>{pct}%</span>
        </div>
      )}
      {overMax && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{t('memberProfile.amountOverMax', { amount: formatMoney(amountDue) })}</div>}
      {!overMax && underMin && n > 0 && (
        <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>
          {minPct != null ? t('memberProfile.amountUnderPct', { pct: minPct, amount: formatMoney(min) }) : t('memberProfile.amountUnderMin', { amount: formatMoney(min) })}
        </div>
      )}
      <button type="button" disabled={!valid} onClick={() => { onCollect({ amount: n, method }); setOpen(false); }}
        style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.45, fontFamily: 'DM Sans' }}>
        {t('memberProfile.confirmPayment')} {valid ? formatMoney(n) : ''}
      </button>
    </div>
  );
}
