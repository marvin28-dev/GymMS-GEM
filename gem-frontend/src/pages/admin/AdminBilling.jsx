import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Receipt, Send, Wand2, Search } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import RowMenu from '../../components/ui/RowMenu';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getInvoices, prepareInvoices, sendAllInvoices } from '../../services/admin.service';
import { Stat, PageTitle, Empty, BillPill, Chips } from './adminUi';
import { card, th, td, goldBtn, plainBtn, field, money, monthLabel, shiftPeriod, nt, refusal, billMenu } from './adminFormat';
import { useBillDialogs } from './useBillDialogs';

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const lastMonth = () => shiftPeriod(thisMonth(), -1);
// The server filters by these (invoice.controller STATES) and counts each
const STATES = ['all', 'overdue', 'draft', 'sent', 'paid', 'void'];

// GEM's bills, a month at a time: prepare them, check them, send them, and
// follow each to paid
export default function AdminBilling() {
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const asked = params.get('period');
  const period = /^\d{4}-\d{2}$/.test(asked || '') ? asked : lastMonth();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [state, setState] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    getInvoices({ period, state, q: q.trim() || undefined }).then(r => { setData(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, [period, state, q]);
  // A search waits for a pause in the typing
  useEffect(() => { const timer = setTimeout(load, q ? 250 : 0); return () => clearTimeout(timer); }, [load, q]);
  const bills = useBillDialogs({ t, lang, onChanged: load, isLocked: (inv) => !!inv.gym?.lockedAt });

  const goTo = (p) => { setData(null); setNotice(''); setProblem(''); setParams({ period: p }, { replace: true }); };
  const prepare = async () => {
    setBusy('prepare'); setNotice(''); setProblem('');
    try { const r = await prepareInvoices(period); setNotice(nt(t, 'admin.preparedN', { n: r.data.created })); load(); } catch (e) { setProblem(refusal(e, t('admin.saveFailed'))); }
    setBusy('');
  };
  const sendAll = async () => {
    setConfirmAll(false); setBusy('send'); setNotice(''); setProblem('');
    try { const r = await sendAllInvoices(period); setNotice(nt(t, 'admin.sentN', { n: r.data.sent })); load(); } catch (e) { setProblem(refusal(e, t('admin.saveFailed'))); }
    setBusy('');
  };

  const cur = data?.invoices[0]?.currency || 'XAF';
  const drafts = data?.totals.drafts || 0;
  const menu = (inv) => billMenu(inv, t, bills.open, [
    { label: t('admin.openGym'), onClick: () => navigate(`/admin/gyms/${inv.gymId}`) },
    { label: t('admin.pauseAccount'), onClick: () => bills.open('lock', inv), danger: true, hidden: inv.state !== 'overdue' || !!inv.gym?.lockedAt },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle title={t('admin.navBilling')} subtitle={t('admin.billingSub')}>
        {data?.canPrepare && (
          <button type="button" data-prepare style={{ ...plainBtn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={prepare}>
            <Wand2 size={15} /> {t('admin.prepareBills')}
          </button>
        )}
        {drafts > 0 && (
          <button type="button" data-send-all style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => setConfirmAll(true)}>
            <Send size={15} /> {nt(t, 'admin.sendAllN', { n: drafts })}
          </button>
        )}
      </PageTitle>

      {/* The month: one at a time, no month still to come */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" aria-label={t('admin.prevMonth')} onClick={() => goTo(shiftPeriod(period, -1))} style={{ ...plainBtn, padding: 8 }}><ChevronLeft size={16} /></button>
        <span data-period={period} style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 150, textAlign: 'center' }}>{monthLabel(period, lang)}</span>
        <button type="button" aria-label={t('admin.nextMonth')} disabled={period >= thisMonth()} onClick={() => goTo(shiftPeriod(period, 1))} style={{ ...plainBtn, padding: 8, opacity: period >= thisMonth() ? 0.4 : 1, cursor: period >= thisMonth() ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
      </div>

      {notice && <div role="status" data-notice style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: 'DM Sans, sans-serif' }}>{notice}</div>}
      {(problem || bills.problem) && <div role="alert" style={{ fontSize: 13, color: 'var(--accent-red)', fontFamily: 'DM Sans, sans-serif' }}>{problem || bills.problem}</div>}

      {failed && !data ? <LoadFailed message={t('admin.loadFailed')} onRetry={load} /> : !data ? <SkeletonCards count={3} /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <Stat label={t('admin.billed')} value={money(data.totals.billed, cur)} data-total="billed" />
            <Stat label={t('admin.paid')} value={money(data.totals.paid, cur)} tone="green" data-total="paid" />
            <Stat label={t('admin.statOutstanding')} value={money(data.totals.outstanding, cur)} data-total="outstanding" />
            <Stat label={t('admin.overdue')} value={money(data.totals.overdue, cur)} tone={data.totals.overdue ? 'red' : undefined} data-total="overdue" />
          </div>

          {data.counts.all > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 260px' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchBills')} aria-label={t('admin.searchBills')}
                  style={{ ...field, background: 'var(--bg-card)', paddingLeft: 34, fontSize: isMobile ? 16 : 13.5 }} />
              </div>
              <Chips label={t('admin.filter')} value={state} onChange={setState} items={STATES.map(s => [s, t(`admin.bills_${s}`), data.counts[s]])} />
            </div>
          )}
          {data.total > data.invoices.length && <div data-more-bills style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.showingFirst', { n: data.invoices.length, total: data.total })}</div>}

          {data.invoices.length === 0 ? (
            <div style={card}><Empty icon={Receipt} title={data.counts.all ? t('admin.noBillsMatch') : t('admin.noBills')} hint={data.counts.all ? '' : data.canPrepare ? t('admin.noBillsHint') : t('admin.monthNotOver')} /></div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.invoices.map(inv => (
                <div key={inv.id} data-bill-row={inv.gym?.code} style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.gym?.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{money(inv.amount, inv.currency)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 8px' }}>{t('admin.billLine', { n: inv.members, rate: money(inv.rate, inv.currency) })}</div>
                    <BillPill inv={inv} t={t} />
                  </div>
                  <RowMenu title={t('common.actions')} items={menu(inv)} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{[t('admin.colGym'), t('admin.members'), t('admin.pricePerMember'), t('admin.colDays'), t('admin.discount'), t('admin.amount'), t('admin.colStatus'), ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.invoices.map(inv => (
                    <tr key={inv.id} data-bill-row={inv.gym?.code}>
                      <td style={td}><button type="button" onClick={() => navigate(`/admin/gyms/${inv.gymId}`)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13, textAlign: 'left' }}>{inv.gym?.name}</button>{inv.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.note}</div>}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{inv.members}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{money(inv.rate, inv.currency)}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', color: inv.billableDays < inv.daysInPeriod ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>{inv.billableDays}/{inv.daysInPeriod}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{inv.discount ? `-${money(inv.discount, inv.currency)}` : '-'}</td>
                      <td style={{ ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(inv.amount, inv.currency)}</td>
                      <td style={td}><BillPill inv={inv} t={t} /></td>
                      <td style={{ ...td, width: 44 }}><RowMenu title={t('common.actions')} items={menu(inv)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmModal open={confirmAll} danger={false} onClose={() => setConfirmAll(false)} onConfirm={sendAll}
        title={t('admin.sendAllTitle')} message={nt(t, 'admin.sendAllMessage', { n: drafts, month: monthLabel(period, lang) })} confirmLabel={t('admin.sendBill')} />
      {bills.dialogs}
    </div>
  );
}
