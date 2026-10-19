import { useState, useEffect } from 'react';
import {
  UserCheck, UserPlus, CreditCard, ShoppingBag, Receipt, Users, Wrench,
  TrendingUp, ChevronDown, ChevronUp, Printer, Wallet,
} from 'lucide-react';
import Modal from './ui/Modal';
import VisitKindBadge from './ui/VisitKindBadge';
import RevenueSplit from './ui/RevenueSplit';
import { useLanguage } from '../contexts/LanguageContext';
import { getEod } from '../services/reports.service';
import { formatMoney } from '../utils/currency';
import { fmtDate, fmtTime, todayStr } from '../utils/date';
import { PAYMENT_METHODS, canonicalMethod } from '../utils/paymentMethods';
import { getGymInfo, escapeHtml } from '../utils/receipt';
import { getAuth } from '../utils/auth';
import { useIsMobile } from '../hooks/useIsMobile';

// Money first (what is in hand, what the gym earned), then the shop (what
// was sold and what it made), then the rest of the day's activity.
const MONEY = ['cash', 'revenue'];
const SHOP = ['sales'];
const ACTIVITY = ['checkins', 'registrations', 'payments', 'expenses', 'staff', 'issues'];
const SECTIONS = [...MONEY, ...SHOP, ...ACTIVITY];

// The end-of-day report, built from the gym's real records for the chosen day.
// It is the one report every screen opens (Daily Overview, Dashboard, Front
// Desk), so they can never disagree. onPrinted runs after it is printed, which
// the front desk uses to close the day's open shifts.
//
// Two different questions, kept apart:
//   Money at hand - what physically came in today less what was paid out, per
//                   payment method; what the drawer and accounts should hold.
//   Revenue       - what the gym earned: what members paid plus the shop's
//                   profit (sales less the cost of the items sold).
export default function EodReport({ open, onClose, onPrinted, footer = null }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [day, setDay] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [include, setInclude] = useState(() => Object.fromEntries(SECTIONS.map(s => [s, true])));
  const [openSec, setOpenSec] = useState(() => Object.fromEntries(SECTIONS.map(s => [s, !ACTIVITY.includes(s)])));

  useEffect(() => { if (open) { setDay(todayStr()); setNotes(''); } }, [open]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setError('');
    getEod(day)
      .then(r => { if (alive) setData(r.data); })
      .catch(err => { if (alive) { setData(null); setError(err?.response?.data?.error || t('eod.failed')); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, day]);

  const methodLabel = (m) => {
    const pm = PAYMENT_METHODS.find(x => x.api === m || x.key === canonicalMethod(m));
    return pm ? t(pm.labelKey) : (m || '');
  };
  const payType = (p) => p.note || ({ membership: t('eod.typeMembership'), registration: t('eod.typeRegistration'), product: t('eod.typePass'), other: t('eod.typeOther') }[p.type] || p.type);
  const who = (c) => (c.who === 'staff' ? t('eod.staffWorkout') : c.who === 'visitor' ? t('eod.visitor') : t('eod.member'));
  const tt = data?.totals || {};

  const sectionMeta = {
    cash: { title: t('eod.moneyAtHand'), icon: Wallet, accent: 'var(--accent-blue)' },
    revenue: { title: t('eod.revenueTitle'), icon: TrendingUp, accent: 'var(--accent-green)' },
    checkins: { title: t('eod.checkins'), icon: UserCheck, accent: 'var(--accent-green)', count: data?.checkins.length },
    registrations: { title: t('eod.registrations'), icon: UserPlus, accent: 'var(--accent-gold)', count: data?.registrations.length },
    payments: { title: t('eod.payments'), icon: CreditCard, accent: 'var(--accent-blue)', count: data?.payments.length },
    sales: { title: t('eod.shopTitle'), icon: ShoppingBag, accent: 'var(--accent-yellow)', count: data?.sales.length },
    expenses: { title: t('eod.expenses'), icon: Receipt, accent: 'var(--accent-red)', count: data?.expenses.length },
    staff: { title: t('eod.staff'), icon: Users, accent: 'var(--accent-purple)', count: data?.staff.length },
    issues: { title: t('eod.issues'), icon: Wrench, accent: 'var(--accent-red)', count: tt.openIssues },
  };

  // ── Money at hand: one row per method that moved, cash always shown ──
  const cashRows = (tt.byMethod || []).filter(m => m.method === 'cash' || m.in || m.out);
  const cashHead = [t('eod.method'), t('eod.moneyIn'), t('eod.paidOut'), t('eod.atHand')];
  const cashBody = cashRows.map(m => [methodLabel(m.method), formatMoney(m.in), m.out ? `- ${formatMoney(m.out)}` : formatMoney(0), formatMoney(m.atHand)]);
  const cashFoot = [t('eod.total'), formatMoney(tt.moneyIn || 0), tt.moneyOut ? `- ${formatMoney(tt.moneyOut)}` : formatMoney(0), formatMoney(tt.moneyAtHand || 0)];

  // ── Revenue statement ──
  const shopDetail = t('eod.shopProfitDetail', { sales: formatMoney(tt.salesCounted ?? tt.salesTotal ?? 0), cost: formatMoney(tt.costOfSales ?? 0) });
  const revenueLines = data ? [
    { heading: t('eod.fromMembers') },
    { label: t('eod.membershipPayments'), value: formatMoney(tt.membershipRevenue), indent: true },
    { label: t('eod.registrationFees'), value: formatMoney(tt.registrationRevenue), indent: true },
    { label: t('eod.passSales'), value: formatMoney(tt.passRevenue), indent: true },
    { label: t('eod.membersSubtotal'), value: formatMoney(tt.paymentsTotal), sub: true },
    { heading: t('eod.fromShop') },
    { label: t('eod.shopProfitLine'), value: formatMoney(tt.salesProfit ?? 0), detail: shopDetail, indent: true, sub: true },
    { label: t('eod.totalRevenue'), value: formatMoney(tt.revenue), strong: true },
    { label: t('eod.totalExpenses'), value: `- ${formatMoney(tt.expensesTotal)}` },
    { label: t('eod.netResult'), value: formatMoney(tt.net), strong: true, color: tt.net < 0 ? 'var(--accent-red)' : 'var(--accent-gold)' },
  ] : [];
  const shopStrip = data ? [
    [t('eod.itemsSold'), String(tt.itemsSold)],
    [t('eod.salesAmount'), formatMoney(tt.salesTotal)],
    [t('eod.costOfItems'), formatMoney(tt.costOfSales ?? 0)],
    [t('eod.profit'), formatMoney(tt.salesProfit ?? 0)],
  ] : [];
  const revenueNotes = data ? [
    tt.salesProfitMissing > 0 ? t('sales.profitMissing', { n: tt.salesProfitMissing }) : null,
    tt.expensesPending ? t('eod.pendingNote', { amount: formatMoney(tt.expensesPending) }) : null,
  ].filter(Boolean) : [];

  // ── Activity rows, written once and used both on screen and in the printout ──
  const rows = data ? {
    checkins: data.checkins.map(c => [fmtTime(c.at), c.name, c.code || '-', who(c), c.kind ? <VisitKindBadge kind={c.kind} onlyPasses /> : '']),
    registrations: data.registrations.map(r => [fmtTime(r.at), r.name, r.dayPass ? t('checkin.kindDayPass') : (r.type === 'visitor' ? t('eod.visitor') : t('eod.member')), r.package || '-', formatMoney(r.paid)]),
    payments: data.payments.map(p => [fmtTime(p.at), p.name || '-', payType(p), methodLabel(p.method), formatMoney(p.amount)]),
    sales: data.sales.map(s => [fmtTime(s.at), s.items.map(i => `${i.name} ×${i.qty}`).join(', '), methodLabel(s.method), formatMoney(s.total), s.profit == null ? t('eod.noCost') : formatMoney(s.profit)]),
    expenses: data.expenses.map(e => [e.title + (e.pending ? ` (${t('eod.awaitingReview')})` : ''), e.category, e.paidTo || '-', formatMoney(e.amount)]),
    staff: data.staff.map(s => [s.name, s.role ? t(`staff.${({ general_manager: 'generalManager', manager: 'manager', front_desk: 'frontDesk', trainer: 'trainer', other: 'roleOther' })[s.role] || 'roleOther'}`) : '-', s.in ? fmtTime(s.in) : '-', s.open ? t('eod.stillIn') : (s.out ? fmtTime(s.out) : '-')]),
    issues: data.issues.map(i => [i.equipment + (i.location ? ` (${i.location})` : ''), i.severity, i.status === 'resolved' ? t('eod.fixed') : t('eod.open'), i.reportedToday ? t('eod.reportedToday') : fmtDate(i.reportedAt)]),
  } : {};
  const heads = {
    checkins: [t('eod.time'), t('eod.name'), t('eod.id'), t('eod.type'), ''],
    registrations: [t('eod.time'), t('eod.name'), t('eod.type'), t('eod.package'), t('eod.paidToday')],
    payments: [t('eod.time'), t('eod.member'), t('eod.description'), t('eod.method'), t('eod.amount')],
    sales: [t('eod.time'), t('eod.items'), t('eod.method'), t('eod.amount'), t('eod.profit')],
    expenses: [t('eod.title'), t('eod.category'), t('eod.paidTo'), t('eod.amount')],
    staff: [t('eod.name'), t('eod.role'), t('eod.in'), t('eod.out')],
    issues: [t('eod.equipment'), t('eod.severity'), t('eod.status'), t('eod.reported')],
  };
  // A footer is either the last column's total, or one value per column
  const footTotals = data ? {
    payments: formatMoney(tt.paymentsTotal),
    sales: ['', '', '', formatMoney(tt.salesTotal), formatMoney(tt.salesProfit ?? 0)],
    expenses: formatMoney(data.expenses.reduce((s, e) => s + e.amount, 0)),
    registrations: formatMoney(data.registrations.reduce((s, r) => s + r.paid, 0)),
  } : {};

  const handlePrint = () => {
    if (!data) return;
    const gym = getGymInfo();
    const user = getAuth()?.user;
    const cell = (v) => (typeof v === 'string' || typeof v === 'number') ? escapeHtml(String(v)) : '';
    const table = (head, body, foot) => {
      const tbody = body.length
        ? body.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${head.length}" class="muted">${escapeHtml(t('eod.none'))}</td></tr>`;
      const tfoot = foot ? `<tr class="total">${foot.map(c => `<td>${cell(c)}</td>`).join('')}</tr>` : '';
      return `<table><thead><tr>${head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${tbody}${tfoot}</tbody></table>`;
    };
    const footRow = (k) => (Array.isArray(footTotals[k]) ? [t('eod.total'), ...footTotals[k].slice(1)] : [t('eod.total'), ...Array(heads[k].length - 2).fill(''), footTotals[k]]);
    const activityTable = (k) => table(heads[k], rows[k], footTotals[k] && rows[k].length ? footRow(k) : null);
    const hero = `<div class="hero">${heroes.map(h => `<div><span>${escapeHtml(h.label)}</span><b>${escapeHtml(h.value)}</b><small>${escapeHtml(h.subText)}</small></div>`).join('')}</div>
    <div class="tiles">${counts.map(c => `<div class="tile"><b>${escapeHtml(String(c.value))}</b><span>${escapeHtml(c.label)}</span>${c.sub ? `<small>${escapeHtml(c.sub)}</small>` : ''}</div>`).join('')}</div>`;
    const money = [
      include.cash ? `<h3>${escapeHtml(t('eod.moneyAtHand'))}</h3>${table(cashHead, cashBody, cashFoot)}<p class="strong">${escapeHtml(t('eod.cashShouldBe'))}: ${escapeHtml(formatMoney(tt.cashAtHand || 0))}</p>` : '',
      include.revenue ? `<h3>${escapeHtml(t('eod.revenueTitle'))}</h3><table><tbody>${revenueLines.map(l => (l.heading ? `<tr><td colspan="2" class="sub-head">${escapeHtml(l.heading)}</td></tr>` : `<tr${l.strong ? ' class="total"' : l.sub ? ' class="subtotal"' : ''}><td${l.indent ? ' class="indent"' : ''}>${escapeHtml(l.label)}${l.detail ? `<div class="muted">${escapeHtml(l.detail)}</div>` : ''}</td><td class="num">${escapeHtml(l.value)}</td></tr>`)).join('')}</tbody></table>${revenueNotes.map(n => `<p class="muted">${escapeHtml(n)}</p>`).join('')}` : '',
    ].join('');
    const shop = include.sales ? `<h3>${escapeHtml(sectionMeta.sales.title)}</h3><div class="strip">${shopStrip.map(([l, v]) => `<div><span>${escapeHtml(l)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>${activityTable('sales')}` : '';
    const activity = ACTIVITY.filter(k => include[k]).map(k => `<h3>${escapeHtml(sectionMeta[k].title)}</h3>${activityTable(k)}`).join('');
    const css = `body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:28px;color:#111827}
      header{display:flex;justify-content:space-between;border-bottom:3px solid #c9a96e;padding-bottom:12px;margin-bottom:18px}
      h1{font-size:20px;margin:0}h2{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin:22px 0 4px}
      h3{font-size:13px;margin:14px 0 6px;padding-bottom:4px;border-bottom:2px solid #c9a96e}
      .hero{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}.hero div{border:1px solid #d1d5db;border-radius:8px;padding:10px 12px}
      .hero span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280}.hero b{display:block;font-size:20px;margin:3px 0}.hero small{font-size:10.5px;color:#4b5563}
      .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.tile{border:1px solid #e5e7eb;border-radius:8px;padding:8px;text-align:center}
      .tile b{display:block;font-size:16px}.tile span{font-size:10px;color:#6b7280}.tile small{display:block;font-size:10px;color:#059669;margin-top:2px}
      .strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 8px}.strip div{border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px}.strip span{display:block;font-size:9.5px;text-transform:uppercase;color:#6b7280}.strip b{font-size:13px}
      .sub-head{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;padding-top:10px;border-bottom:none}.indent{padding-left:16px}.subtotal td{font-weight:600;border-top:1px dashed #e5e7eb}
      table{width:100%;border-collapse:collapse;font-size:11.5px}th{text-align:left;color:#6b7280;font-weight:600;font-size:10px;text-transform:uppercase;padding:4px 6px;border-bottom:1px solid #e5e7eb}
      td{padding:5px 6px;border-bottom:1px solid #f1f1f1}td.num{text-align:right}.total td{font-weight:700;border-top:1px solid #d1d5db}
      .muted{color:#9ca3af;font-size:10.5px}.strong{font-weight:700;font-size:12.5px;margin:6px 0}.notes{white-space:pre-wrap;font-size:12px}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(t('eod.title'))} ${escapeHtml(data.date)}</title><style>${css}</style></head><body>
      <header><div><h1>${escapeHtml((gym.name || '').toUpperCase())}</h1><div class="muted">${escapeHtml(t('eod.title'))}</div></div>
      <div style="text-align:right"><b>${escapeHtml(fmtDate(data.date))}</b><div class="muted">${escapeHtml(t('eod.generatedBy', { name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '', time: fmtTime(new Date()) }))}</div></div></header>
      ${hero}
      ${money ? `<h2>${escapeHtml(t('eod.groupMoney'))}</h2>${money}` : ''}
      ${shop ? `<h2>${escapeHtml(t('eod.groupShop'))}</h2>${shop}` : ''}
      ${activity ? `<h2>${escapeHtml(t('eod.groupActivity'))}</h2>${activity}` : ''}
      ${notes.trim() ? `<h3>${escapeHtml(t('eod.notes'))}</h3><div class="notes">${escapeHtml(notes.trim())}</div>` : ''}
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html); win.document.close(); win.focus(); win.print();
    onPrinted?.();
  };

  const heroes = data ? [
    { label: t('eod.moneyAtHand'), value: formatMoney(tt.moneyAtHand || 0), subText: `${t('eod.cashInDrawer')}: ${formatMoney(tt.cashAtHand || 0)}`, color: (tt.moneyAtHand || 0) < 0 ? 'var(--accent-red)' : 'var(--text-primary)' },
    { label: t('eod.totalRevenue'), value: formatMoney(tt.revenue), subText: `${t('reports.revMembersPart', { amount: formatMoney(tt.paymentsTotal) })} · ${t('reports.revShopPart', { amount: formatMoney(tt.salesProfit ?? 0) })}`, sub: <RevenueSplit members={tt.paymentsTotal} shop={tt.salesProfit ?? 0} />, color: 'var(--accent-green)' },
    { label: t('eod.netResult'), value: formatMoney(tt.net), subText: t('eod.netHint', { amount: formatMoney(tt.expensesTotal) }), color: tt.net < 0 ? 'var(--accent-red)' : 'var(--accent-gold)' },
  ] : [];
  const counts = data ? [
    { label: t('eod.checkins'), value: tt.checkins, color: 'var(--accent-green)' },
    { label: t('eod.registrations'), value: tt.registrations, color: 'var(--accent-gold)' },
    { label: t('eod.itemsSold'), value: tt.itemsSold, color: 'var(--accent-blue)', sub: t('eod.itemsProfit', { amount: formatMoney(tt.salesProfit ?? 0) }) },
    { label: t('eod.expenses'), value: formatMoney(data.expenses.reduce((n, e) => n + e.amount, 0)), color: data.expenses.length ? 'var(--accent-red)' : 'var(--text-primary)', sub: t('eod.nEntries', { n: data.expenses.length }) },
  ] : [];

  const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'DM Sans', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)' };
  const td = { padding: '9px 12px', fontSize: 12.5, fontFamily: 'DM Sans', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const groupHead = (label) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 6 }}>{label}</div>
  );

  const Table = ({ k }) => (
    <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{heads[k].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows[k].length === 0 ? (
            <tr><td colSpan={heads[k].length} style={{ ...td, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 12px' }}>{t('eod.none')}</td></tr>
          ) : rows[k].map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, ...(j === 0 ? { color: 'var(--text-primary)' } : {}), ...(j === r.length - 1 && footTotals[k] ? { fontWeight: 700, color: 'var(--text-primary)' } : {}) }}>{c}</td>)}</tr>
          ))}
        </tbody>
        {footTotals[k] && rows[k].length > 0 && (Array.isArray(footTotals[k]) ? (
          <tfoot><tr>{footTotals[k].map((c, j) => <td key={j} style={{ ...td, fontWeight: j ? 800 : 700, color: j ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: 'none' }}>{j === 0 ? t('eod.total') : c}</td>)}</tr></tfoot>
        ) : (
          <tfoot><tr><td colSpan={heads[k].length - 1} style={{ ...td, fontWeight: 700, color: 'var(--text-muted)', borderBottom: 'none' }}>{t('eod.total')}</td><td style={{ ...td, fontWeight: 800, color: 'var(--text-primary)', borderBottom: 'none' }}>{footTotals[k]}</td></tr></tfoot>
        ))}
      </table>
    </div>
  );

  // On a phone the four columns do not fit, so each method is a small block
  // with its three figures side by side, at hand last and strongest
  const CashList = () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[...cashRows.map(m => ({ label: methodLabel(m.method), in: m.in, out: m.out, at: m.atHand })), { label: t('eod.total'), in: tt.moneyIn || 0, out: tt.moneyOut || 0, at: tt.moneyAtHand || 0, total: true }].map(r => (
        <div key={r.label} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'DM Sans' }}>
          <div style={{ fontSize: 13, fontWeight: r.total ? 800 : 600, color: r.total ? 'var(--text-muted)' : 'var(--text-primary)', marginBottom: 6 }}>{r.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[[t('eod.moneyIn'), formatMoney(r.in)], [t('eod.paidOut'), r.out ? `- ${formatMoney(r.out)}` : formatMoney(0)], [t('eod.atHand'), formatMoney(r.at)]].map(([l, v], i) => (
              <div key={l} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{l}</div>
                <div style={{ fontSize: 12.5, fontWeight: i === 2 ? 800 : 500, color: i === 2 ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: 2, overflowWrap: 'anywhere' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const CashTable = () => (
    <div>
      {isMobile ? <CashList /> : <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cashHead.map((h, i) => <th key={i} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {cashBody.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, textAlign: j ? 'right' : 'left', ...(j === 0 ? { color: 'var(--text-primary)' } : {}), ...(j === 3 ? { fontWeight: 700, color: 'var(--text-primary)' } : {}) }}>{c}</td>)}</tr>
            ))}
          </tbody>
          <tfoot><tr>{cashFoot.map((c, j) => <td key={j} style={{ ...td, textAlign: j ? 'right' : 'left', fontWeight: 800, color: j ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: 'none' }}>{c}</td>)}</tr></tfoot>
        </table>
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', margin: '10px 12px 12px', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontFamily: 'DM Sans' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('eod.cashShouldBe')}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: (tt.cashAtHand || 0) < 0 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'Manrope' }}>{formatMoney(tt.cashAtHand || 0)}</span>
      </div>
    </div>
  );

  const RevenueStatement = () => (
    <div style={{ padding: '4px 0 8px' }}>
      {revenueLines.map(l => l.heading ? (
        <div key={l.heading} style={{ padding: '12px 14px 2px', fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{l.heading}</div>
      ) : (
        <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: l.indent ? '6px 14px 6px 26px' : '8px 14px', fontFamily: 'DM Sans', borderTop: l.strong ? '1px solid var(--border-subtle)' : l.sub && !l.indent ? '1px dashed var(--border-subtle)' : 'none', marginTop: l.strong ? 6 : 0 }}>
          <span style={{ fontSize: l.strong ? 14 : 13, fontWeight: l.strong ? 700 : l.sub ? 600 : 500, color: l.strong || l.sub ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {l.label}
            {l.detail && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{l.detail}</span>}
          </span>
          <span style={{ fontSize: l.strong ? 15 : 13, fontWeight: l.strong ? 800 : 600, color: l.color || (l.strong ? 'var(--text-primary)' : 'var(--text-secondary)'), textAlign: 'right', whiteSpace: 'nowrap' }}>{l.value}</span>
        </div>
      ))}
      {revenueNotes.map(n => <div key={n} style={{ padding: '4px 14px', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{n}</div>)}
      <div style={{ padding: '8px 14px 2px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
        {t('eod.outstanding')}: {formatMoney(tt.outstanding)} · {t('eod.membersOwing', { n: tt.membersOwing })}
      </div>
    </div>
  );

  const ShopBlock = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 8, padding: '12px 12px 4px' }}>
        {shopStrip.map(([l, v], i) => (
          <div key={l} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Manrope', marginTop: 2, color: i === 3 ? ((tt.salesProfit ?? 0) < 0 ? 'var(--accent-red)' : 'var(--accent-green)') : 'var(--text-primary)', overflowWrap: 'anywhere' }}>{v}</div>
          </div>
        ))}
      </div>
      {tt.salesProfitMissing > 0 && <div style={{ padding: '2px 14px 6px', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.profitMissing', { n: tt.salesProfitMissing })}</div>}
      <Table k="sales" />
    </div>
  );

  const Section = ({ k }) => {
    const meta = sectionMeta[k];
    const Icon = meta.icon;
    return (
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', opacity: include[k] ? 1 : 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)' }}>
          <button type="button" onClick={() => setOpenSec(s => ({ ...s, [k]: !s[k] }))}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <Icon size={14} color={meta.accent} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.title}</span>
            {meta.count != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{meta.count}</span>}
            {openSec[k] ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={include[k]} onChange={() => setInclude(s => ({ ...s, [k]: !s[k] }))} style={{ accentColor: 'var(--accent-gold)' }} />
            {t('eod.include')}
          </label>
        </div>
        {openSec[k] && (k === 'cash' ? <CashTable /> : k === 'revenue' ? <RevenueStatement /> : k === 'sales' ? <ShopBlock /> : <Table k={k} />)}
      </div>
    );
  };

  const heroCard = (label, value, sub, color) => (
    <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{label}</div>
      <div style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, color, lineHeight: 1.2, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('eod.title')} maxWidth={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <input type="date" value={day} max={todayStr()} onChange={e => e.target.value && setDay(e.target.value)} aria-label={t('eod.day')}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', colorScheme: 'dark light' }} />
        </div>

        {loading && !data && <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loading')}</div>}
        {error && <div style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 14px' }}>{error}</div>}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {heroes.map(h => heroCard(h.label, h.value, h.sub || h.subText, h.color))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {counts.map(c => (
                <div key={c.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: 800, color: c.color, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>{c.label}</div>
                  {c.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2, fontWeight: 600 }}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {groupHead(t('eod.groupMoney'))}
            {MONEY.map(k => <Section key={k} k={k} />)}
            {groupHead(t('eod.groupShop'))}
            {SHOP.map(k => <Section key={k} k={k} />)}
            {groupHead(t('eod.groupActivity'))}
            {ACTIVITY.map(k => <Section key={k} k={k} />)}

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('eod.notes')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t('eod.notesPh')}
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {footer}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('common.close')}</button>
          <button type="button" onClick={handlePrint} disabled={!data}
            style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '9px 16px', cursor: data ? 'pointer' : 'not-allowed', opacity: data ? 1 : 0.5, fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Printer size={14} /> {t('eod.print')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
