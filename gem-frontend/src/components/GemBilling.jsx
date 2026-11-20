import { useCallback, useEffect, useState } from 'react';
import { Receipt, Info, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLiveTick } from '../hooks/useLiveRefresh';
import { getBilling } from '../services/billing.service';
import { formatMoneyIn } from '../utils/currency';
import { fmtDate } from '../utils/date';
import LoadFailed from './ui/LoadFailed';
import { SkeletonLine } from './Skeleton';

// What the gym pays GEM, for its owner: the plan, this month so far, the bills
// GEM has sent and how to pay them. In Settings (GEM billing) and on the
// screen a paused account shows.
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
const label = { fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' };
const TONE = { sent: ['var(--accent-blue)', 'var(--accent-blue-dim)'], overdue: ['var(--accent-red)', 'var(--accent-red-dim)'], paid: ['var(--accent-green)', 'var(--accent-green-dim)'], void: ['var(--text-secondary)', 'var(--bg-elevated)'] };

const monthOf = (period, lang) => {
  const [y, m] = String(period).split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const dayOf = (d) => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

export default function GemBilling({ onlyDue = false }) {
  const { t, lang } = useLanguage();
  const [b, setB] = useState(null);
  const [failed, setFailed] = useState(false);
  const liveTick = useLiveTick(['billing']);
  const load = useCallback(() => { getBilling().then(r => { setB(r.data); setFailed(false); }).catch(() => setFailed(true)); }, []);
  useEffect(() => { load(); }, [load, liveTick]);

  if (failed && !b) return <LoadFailed message={t('billing.loadFailed')} onRetry={load} />;
  if (!b) return <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{['50%', '70%', '40%'].map(w => <SkeletonLine key={w} width={w} height={14} />)}</div>;

  const money = (n) => formatMoneyIn(n, b.currency);
  const bills = onlyDue ? b.invoices.filter(i => ['sent', 'overdue'].includes(i.state)) : b.invoices;
  const pill = (i) => {
    const [fg, bg] = TONE[i.state] || TONE.void;
    const text = i.state === 'overdue' ? t(i.daysOverdue === 1 ? 'billing.overdue1' : 'billing.overdue', { n: i.daysOverdue })
      : i.state === 'paid' ? t('billing.paidOn', { date: dayOf(i.paidAt) })
        : i.state === 'void' ? t('billing.void') : t('billing.dueBy', { date: dayOf(i.dueDate) });
    return <span data-bill-state={i.state} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: fg, background: bg, whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>{text}</span>;
  };

  return (
    <div data-gem-billing style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'DM Sans, sans-serif' }}>
      {b.locked && !onlyDue && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
          <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />{t('billing.pausedNotice', { reason: b.locked.reason || '' })}
        </div>
      )}

      {!onlyDue && (
        <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={label}>{t('billing.plan')}</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {t('billing.planLine', { price: money(b.rate) })}
          </div>
          {b.onTrial ? (
            <div data-on-trial style={{ fontSize: 13, color: 'var(--accent-yellow)', fontWeight: 600 }}>{t('billing.trialUntil', { date: dayOf(b.trialEndsAt) })}</div>
          ) : (
            <div data-estimate style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{money(b.estimate)}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{t(b.members === 1 ? 'billing.estimateLine1' : 'billing.estimateLine', { n: b.members })}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ ...label, padding: '16px 18px 8px' }}>{onlyDue ? t('billing.toPay') : t('billing.bills')}</div>
        {bills.length === 0 ? (
          <div style={{ padding: '22px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Receipt size={22} style={{ display: 'block', margin: '0 auto 8px' }} />{onlyDue ? t('billing.nothingDue') : t('billing.noBills')}
          </div>
        ) : bills.map(i => (
          <div key={i.id} data-gem-bill={i.period} style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{monthOf(i.period, lang)}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{money(i.amount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {t('billing.billLine', { n: i.members, price: money(i.rate) })}
                {i.billableDays < i.daysInPeriod ? ` · ${t('billing.daysCharged', { n: i.billableDays, of: i.daysInPeriod })}` : ''}
                {i.discount ? ` · ${t('billing.discount', { amount: money(i.discount) })}` : ''}
              </span>
              {pill(i)}
            </div>
            {i.note && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{i.note}</span>}
          </div>
        ))}
      </div>

      {(b.paymentInstructions || bills.some(i => ['sent', 'overdue'].includes(i.state))) && (
        <div data-how-to-pay style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...card, padding: '14px 16px', background: 'var(--bg-elevated)' }}>
          <Info size={16} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('billing.howToPay')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{b.paymentInstructions || t('billing.askSupport')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
