// The admin dashboard's shared styles and how it writes money, days and months
import { formatMoneyIn } from '../../utils/currency';
import { fmtDate } from '../../utils/date';

export const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
export const goldBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, padding: '10px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
export const plainBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
export const dangerBtn = { ...plainBtn, color: 'var(--accent-red)', borderColor: 'rgba(248,113,113,0.45)' };
export const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' };
export const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' };
export const td = { padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', verticalAlign: 'middle' };
export const field = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none' };

export const money = (amount, currency) => formatMoneyIn(amount, currency);
export const day = (d) => (d ? fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
// "2026-11" -> "November 2026", in the reader's language
export const monthLabel = (period, lang = 'en') => {
  const [y, m] = String(period || '').split('-').map(Number);
  if (!m) return String(period || '');
  const s = new Date(y, m - 1, 1).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const shiftPeriod = (period, by) => {
  const [y, m] = String(period).split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
// "1 gym" / "3 gyms": key1 is the singular form
export const nt = (t, key, vars) => (vars.n === 1 ? t(`${key}1`, vars) : t(key, vars));
// How long ago, in whole days
export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null);
// When a gym last used GEM, in words
export const lastSeen = (g, t) => (g.lastActivity ? (daysSince(g.lastActivity) === 0 ? t('admin.today') : nt(t, 'admin.daysAgo', { n: daysSince(g.lastActivity) })) : t('admin.never'));
// The server's refusal, or a fallback
export const refusal = (err, fallback) => err?.response?.data?.error || fallback;

// The actions a bill offers in its row menu, for its state
export function billMenu(inv, t, open, extra = []) {
  return [
    { label: t('admin.editBill'), onClick: () => open('edit', inv), hidden: inv.state !== 'draft' },
    { label: t('admin.sendBill'), onClick: () => open('send', inv), hidden: inv.state !== 'draft' },
    { label: t('admin.markPaid'), onClick: () => open('paid', inv), hidden: !['sent', 'overdue'].includes(inv.state) },
    { label: t('admin.remind'), onClick: () => open('remind', inv), hidden: !['sent', 'overdue'].includes(inv.state) },
    ...extra,
    { label: t('admin.voidBill'), onClick: () => open('void', inv), danger: true, hidden: !['draft', 'sent', 'overdue'].includes(inv.state) },
  ];
}
