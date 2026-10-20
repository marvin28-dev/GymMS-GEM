import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { getCurrencySymbol, formatMoney, getMoneyLocale } from '../utils/currency';
import { digitsOnly } from '../utils/number';
import { autoPaymentDescription } from '../utils/paymentDescription';
import { Plus, Search, Printer, CheckCircle, Clock, XCircle, CreditCard, Banknote, ArrowLeftRight, Calendar, ChevronRight } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';
import { getAll as getPayments, create as createPayment } from '../services/payments.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { fmtDate, getDateLocale, todayStr, dayStr } from '../utils/date';
import { getGymInfo, gymContactFooterHtml, printReceiptDocument, escapeHtml } from '../utils/receipt';
import { softAll } from '../utils/loadAll';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods, PAYMENT_METHODS, canonicalMethod } from '../utils/paymentMethods';
import { gymCache } from '../utils/gymCache';

const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const METHOD_STYLES = {
  card: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  cash: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
  bank_transfer: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  mobile_money: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
};

// A payment is stored with a code (mobile_money); it is shown by the name
// Settings uses, and styled by its code
const methodOf = (m) => PAYMENT_METHODS.find(x => x.api === m || x.key === canonicalMethod(m));
const methodName = (m, t) => { const pm = methodOf(m); return pm ? t(pm.labelKey) : (m || '-'); };
const methodStyle = (m) => METHOD_STYLES[methodOf(m)?.api] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };

const emptyForm = { memberId: '', date: '', amount: '', method: 'Cash', reference: '', description: '', receivedBy: '', packageFor: '', notes: '' };

const STATUS_META = {
  Completed: { icon: CheckCircle, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  Pending:   { icon: Clock,        color: 'var(--accent-yellow)', bg: 'var(--accent-yellow-dim)' },
  Failed:    { icon: XCircle,      color: 'var(--accent-red)',    bg: 'var(--accent-red-dim)' },
};

const METHOD_ICONS = { cash: Banknote, card: CreditCard, bank_transfer: ArrowLeftRight, mobile_money: CreditCard };

export function TransactionModal({ payment, onClose }) {
  const { t } = useLanguage();
  if (!payment) return null;
  const m = payment.member;
  const recordedBy = payment.staff ? staffName(payment.staff) : payment.recordedBy || '-';
  const ms = methodStyle(payment.method);
  const sm = STATUS_META[payment.status] || STATUS_META.Completed;
  const StatusIcon = sm.icon;
  const MethodIcon = METHOD_ICONS[methodOf(payment.method)?.api] || CreditCard;

  const handlePrint = () => {
    const gym = getGymInfo();
    const statusColor = payment.status === 'Completed' ? 'green' : payment.status === 'Failed' ? 'red' : 'orange';
    const row = (label, value) =>
      `<div class="row"><span class="label">${escapeHtml(label)}</span><span>${escapeHtml(value ?? '')}</span></div>`;

    printReceiptDocument({
      title: `Receipt ${payment.reference}`,
      bodyHtml: `
        <h2>${escapeHtml(gym.name.toUpperCase())}</h2>
        <div class="sub">${escapeHtml(t('payments.paymentReceiptTitle'))}</div>
        <hr/>
        ${row(t('payments.receiptReference'), payment.reference)}
        ${row(t('payments.receiptDate'), fmtDate(payment.createdAt || payment.date))}
        ${row(t('common.name'), m ? `${m.firstName} ${m.lastName}` : payment.memberId)}
        ${row(t('payments.memberId'), payment.memberId)}
        <hr/>
        ${row(t('payments.receiptDescription'), payment.note || payment.description || '')}
        ${row(t('payments.receiptMethod'), methodName(payment.method, t))}
        ${row(t('payments.receiptRecordedBy'), recordedBy)}
        <hr/>
        <div class="amount">${escapeHtml(formatMoney(payment.amount))}</div>
        <div class="status" style="color:${statusColor}">${escapeHtml(payment.status)}</div>
        <div class="footer">${escapeHtml(t('payments.thankYouReceipt'))}</div>
        ${gymContactFooterHtml()}
      `,
    });
  };

  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <Modal open={!!payment} onClose={onClose} title={t('payments.transactionDetails')} maxWidth={460}>
      <div>
        {/* Amount hero */}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 12,
          padding: '24px 20px', textAlign: 'center', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 8 }}>
            {t('common.amount')}
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--accent-green)', lineHeight: 1 }}>
            {formatMoney(payment.amount)}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 12, background: sm.bg, color: sm.color,
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
          }}>
            <StatusIcon size={12} strokeWidth={2.5} />
            {payment.status}
          </div>
        </div>

        {/* Details */}
        <Row label={t('payments.reference')} value={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{payment.reference}</span>} />
        <Row label={t('common.date')} value={(payment.createdAt || payment.date || '').slice(0, 10)} />
        <Row label={t('attendance.member')} value={m ? `${m.firstName} ${m.lastName}` : '-'} />
        <Row label={t('payments.memberId')} value={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.memberId}</span>} />
        <Row label={t('payments.description')} value={payment.note || payment.description} />
        <Row
          label={t('payments.method')}
          value={
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: ms.bg, color: ms.color,
              borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 500,
            }}>
              <MethodIcon size={11} strokeWidth={2} />
              {methodName(payment.method, t)}
            </span>
          }
        />
        <Row label={t('payments.recordedBy')} value={recordedBy} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}
          >
            {t('common.close')}
          </button>
          <button
            onClick={handlePrint}
            style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={13} strokeWidth={2} /> {t('common.downloadReceipt')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  // Show the last payments at once and refresh quietly; a first-ever visit
  // falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('payments');
  const [payments, setPayments] = useState(() => cache.read('list', []));
  const [membersList, setMembersList] = useState(() => cache.read('members', []));
  const [staffList, setStaffList] = useState(() => cache.read('staff', []));
  const [loading, setLoading] = useState(() => !cache.has('list'));
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  // The methods this gym takes, as chosen in Settings
  const methods = enabledMethods(useGymSettings());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [datePreset, setDatePreset] = useState('All');

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = dayStr;
    if (preset === 'Today') { setDateFrom(fmt(today)); setDateTo(fmt(today)); }
    else if (preset === 'This Week') {
      // Back to this week's Monday (on a Sunday that is six days back, not tomorrow)
      const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      setDateFrom(fmt(mon)); setDateTo(fmt(today));
    } else if (preset === 'This Month') {
      setDateFrom(fmt(new Date(today.getFullYear(), today.getMonth(), 1))); setDateTo(fmt(today));
    } else if (preset === 'Custom') {
      setDateFrom(''); setDateTo('');
    } else {
      setDateFrom(''); setDateTo('');
    }
  };
  const [showModal, setShowModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [form, setForm] = useState(emptyForm);
  // The form always holds a method the gym takes, also right after a reset
  useEffect(() => {
    if (!methods.some(m => m.key === canonicalMethod(form.method))) setForm(f => ({ ...f, method: methods[0]?.key || 'Cash' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.method, methods.map(m => m.key).join()]);
  const [errors, setErrors] = useState({});
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const liveTick = useLiveTick();
  useEffect(() => {
    softAll([getPayments(), getMembers(), getStaff()])
      .then(([pRes, mRes, sRes]) => {
        const pay = pRes.data || [], mem = mRes.data || [], stf = sRes.data || [];
        setPayments(pay); cache.write('list', pay);
        setMembersList(mem); cache.write('members', mem);
        setStaffList(stf); cache.write('staff', stf);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  // Today and this month are the gym's local ones, read against each payment's local day
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const totalThisMonth = payments.filter(p => dayStr(p.createdAt).slice(0, 7) === thisMonth).reduce((s, p) => s + (p.amount || 0), 0);
  const totalToday = payments.filter(p => dayStr(p.createdAt) === today).reduce((s, p) => s + (p.amount || 0), 0);

  const filtered = payments.filter(p => {
    const name = p.member ? `${p.member.firstName} ${p.member.lastName}` : '';
    const pDate = dayStr(p.createdAt);
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || (p.reference || '').toLowerCase().includes(search.toLowerCase());
    const matchMethod = methodFilter === 'All' || methodOf(p.method)?.key === methodFilter;
    const matchFrom = !dateFrom || pDate >= dateFrom;
    const matchTo = !dateTo || pDate <= dateTo;
    return matchSearch && matchMethod && matchFrom && matchTo;
  });

  const filteredTotal = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  const fmtShort = (d) => fmtDate(d + 'T12:00:00', { month: 'short', day: 'numeric' });
  const dynamicLabel = (() => {
    if (datePreset === 'This Week') return t('payments.paymentsThisWeek');
    if (datePreset === 'This Month') return t('payments.paymentsThisMonth');
    if (datePreset === 'Today') return t('payments.paymentsToday');
    if (datePreset === 'Custom') {
      if (dateFrom && dateTo) return `${fmtShort(dateFrom)} - ${fmtShort(dateTo)}`;
      if (dateFrom) return `${t('common.from')} ${fmtShort(dateFrom)}`;
      if (dateTo) return `${t('common.until')} ${fmtShort(dateTo)}`;
    }
    return t('payments.paymentsToday');
  })();
  const dynamicValue = (datePreset !== 'All' || search || methodFilter !== 'All') ? filteredTotal : totalToday;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPayments = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [search, methodFilter, dateFrom, dateTo]);

  const chipStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? 'var(--accent-gold)' : 'var(--border-subtle)',
  });

  const matchingMembers = memberSearch ? membersList.filter(m => `${m.firstName} ${m.lastName} ${m.memberCode || m.id}`.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 5) : [];

  const validate = () => {
    const req = t('common.required');
    const e = {};
    if (!form.date) e.date = req;
    if (!form.amount) e.amount = req;
    // This records a payment towards what the member owes, so it can never be more than that
    else if (selectedMember && Number(form.amount) > Math.max(0, Number(selectedMember.balance) || 0)) {
      e.amount = t('memberProfile.amountOverMax', { amount: formatMoney(Math.max(0, Number(selectedMember.balance) || 0)) });
    }
    if (!form.method) e.method = req;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    try {
      const payload = {
        memberId: form.memberId || undefined,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        towardBalance: true,
      };
      const res = await createPayment(payload);
      setPayments(prev => [res.data, ...prev]);
      setShowModal(false);
    } catch (err) {
      setErrors({ amount: err?.response?.data?.error || t('payments.saveFailed') });
    }
  };

  // ── Mobile layout ────────────────────────────────────────────────────────────
  // Drawn by both layouts. The phone had its own add sheet with no member
  // picker, so the server refused every payment made from it (F-110).
  const paymentDialogs = (
    <>
      <TransactionModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />

      {/* Add Payment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('payments.addPayment')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Step 1: Search for member ── */}
          {!selectedMember && (
            <>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.searchMember')} *</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    autoFocus
                    style={{ ...inputStyle, paddingLeft: 32 }}
                    placeholder={t('payments.namOrCode')}
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                  />
                  {matchingMembers.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, boxShadow: 'var(--shadow-elevated)', overflow: 'hidden' }}>
                      {matchingMembers.map(m => (
                        <div key={m.id}
                          onClick={() => { setSelectedMember(m); setForm(f => ({ ...f, memberId: m.id, description: f.description || autoPaymentDescription(m, 'membership') })); setMemberSearch(''); }}
                          style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.firstName} {m.lastName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.memberCode} · {m.package?.name || '-'}</div>
                          </div>
                          {Number(m.balance) > 0 && (
                            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, background: 'rgba(248,113,113,0.1)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                              {t('payments.owes')} {(Number(m.balance) || 0).toLocaleString(getMoneyLocale())} {getCurrencySymbol()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              </div>
            </>
          )}

          {/* ── Step 2a: No outstanding balance ── */}
          {selectedMember && !(Number(selectedMember.balance) > 0) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMember.firstName} {selectedMember.lastName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{selectedMember.memberCode}</span>
                </div>
                <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 38, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>{t('payments.noOutstandingBalance')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {t('payments.memberHasNoBalance', { firstName: selectedMember.firstName, lastName: selectedMember.lastName })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={() => setSelectedMember(null)}>← {t('common.back')}</button>
                <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.close')}</button>
              </div>
            </>
          )}

          {/* ── Step 2b: Payment form (member has outstanding balance) ── */}
          {selectedMember && Number(selectedMember.balance) > 0 && (
            <>
              {/* Member chip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: '1px solid var(--accent-gold)', borderRadius: 10, padding: '9px 14px' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMember.firstName} {selectedMember.lastName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{selectedMember.memberCode}</span>
                </div>
                <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>

              {/* Outstanding balance banner */}
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>{t('payments.outstandingBalance')}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope, sans-serif' }}>{(Number(selectedMember.balance) || 0).toLocaleString(getMoneyLocale())} {getCurrencySymbol()}</div>
                </div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, amount: String(selectedMember.balance) }))}
                  style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}
                >{t('payments.payInFull')}</button>
              </div>

              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.paymentDate')} *</label>
                  <input type="date" style={{ ...inputStyle, borderColor: errors.date ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  {errors.date && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.date}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.amount')} *</label>
                  <input type="text" inputMode="numeric" style={{ ...inputStyle, borderColor: errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: digitsOnly(e.target.value) }))} placeholder="0" />
                  {errors.amount && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.amount}</div>}
                </div>
              </div>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.paymentMethod')} *</label>
                  <select style={inputStyle} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {methods.map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.referenceId')}</label>
                  <input style={inputStyle} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="TXN-XXX" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.description')}</label>
                <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Premium 12M Renewal" />
              </div>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.receivedBy')}</label>
                  <select style={inputStyle} value={form.receivedBy} onChange={e => setForm(f => ({ ...f, receivedBy: e.target.value }))}>
                    <option value="">{t('payments.selectStaff')}</option>
                    {staffList.filter(s => s.isActive !== false || staffName(s) === form.receivedBy).map(s => <option key={s.id} value={staffName(s)}>{staffName(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('payments.packageFor')}</label>
                  <input style={inputStyle} value={form.packageFor} onChange={e => setForm(f => ({ ...f, packageFor: e.target.value }))} placeholder="e.g. Premium 12M" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.notes')}</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button style={primaryBtn} onClick={handleSave}>{t('payments.savePayment')}</button>
              </div>
            </>
          )}

        </div>
      </Modal>
    </>
  );

  if (isMobile) {
    const METHOD_CHIPS = [{ key: 'All', label: t('payments.allMethods') }, ...methods.map(m => ({ key: m.key, label: t(m.labelKey) }))];
    return (
      <div style={{ minHeight: '100%' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 10px' }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('payments.title')}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
            {formatMoney(totalThisMonth)} {t('common.thisMonth').toLowerCase()}
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: t('common.today'), value: formatMoney(totalToday) },
            { label: t('common.thisMonth'), value: formatMoney(totalThisMonth) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 8px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('payments.searchPlaceholder')}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px 9px 34px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Method chips */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {METHOD_CHIPS.map(({ key, label }) => (
            <button key={key} onClick={() => setMethodFilter(key)} style={{ ...chipStyle(methodFilter === key), flexShrink: 0 }}>{label}</button>
          ))}
        </div>

        {/* Payment list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>
          ) : paginatedPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('payments.noPaymentsYet')}</div>
          ) : paginatedPayments.map(p => {
            const name = p.member ? `${p.member.firstName} ${p.member.lastName}` : t('common.anonymous');
            const date = (p.createdAt || '').slice(0, 10);
            const pillStyle = methodStyle(p.method);
            return (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: pillStyle.bg, color: pillStyle.color }}>{methodName(p.method || 'cash', t)}</span>
                    <span>{date}</span>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                  {formatMoney(p.amount)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', marginTop: 4 }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer', fontFamily: 'DM Sans' }}>{t('common.previous')}</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', alignSelf: 'center' }}>{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer', fontFamily: 'DM Sans' }}>{t('common.next')}</button>
          </div>
        )}

        <FAB onClick={() => { setForm(emptyForm); setErrors({}); setMemberSearch(''); setSelectedMember(null); setShowModal(true); }} label={t('payments.addPayment')} />

        {paymentDialogs}
      </div>
    );
  }

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('payments.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{loading ? t('common.loading') : t('payments.paymentManagement')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={primaryBtn} onClick={() => { setForm(emptyForm); setErrors({}); setMemberSearch(''); setSelectedMember(null); setShowModal(true); }}>
            <Plus size={13} />{t('payments.addPayment')}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('payments.totalThisMonth'), value: formatMoney(totalThisMonth), color: 'var(--accent-blue)', dimColor: 'var(--accent-blue-dim)' },
          { label: dynamicLabel, value: formatMoney(dynamicValue), color: 'var(--accent-green)', dimColor: 'var(--accent-green-dim)' },
        ].map(c => (
          <div key={c.label} style={{ ...cardStyle, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: c.color, filter: 'blur(40px)', opacity: 0.12 }} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180, maxWidth: 260 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              style={{ ...inputStyle, paddingLeft: 32, borderRadius: 8, fontSize: 12, padding: '7px 12px 7px 32px' }}
              placeholder={t('payments.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Method segmented control */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)', gap: 2 }}>
            {[['All', t('payments.allMethods')], ...methods.map(m => [m.key, t(m.labelKey)])].map(([key, label]) => (
              <button key={key} onClick={() => setMethodFilter(key)} style={{
                padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: methodFilter === key ? 600 : 400,
                background: methodFilter === key ? 'var(--accent-gold)' : 'transparent',
                color: methodFilter === key ? '#0a0a0f' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
          </div>

          {/* Thin divider */}
          <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', flexShrink: 0 }} />

          {/* Date segmented control */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, border: '1px solid var(--border-subtle)', gap: 2 }}>
            {[['All', t('common.all')], ['Today', t('common.today')], ['This Week', t('common.thisWeek')], ['This Month', t('common.thisMonth')]].map(([key, label]) => (
              <button key={key} onClick={() => applyPreset(key)} style={{
                padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: datePreset === key ? 600 : 400,
                background: datePreset === key ? 'rgba(201,169,110,0.18)' : 'transparent',
                color: datePreset === key ? 'var(--accent-gold)' : 'var(--text-secondary)',
                border: datePreset === key ? '1px solid rgba(201,169,110,0.4)' : '1px solid transparent',
                cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
            <button onClick={() => applyPreset('Custom')} style={{
              padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: datePreset === 'Custom' ? 600 : 400,
              background: datePreset === 'Custom' ? 'rgba(201,169,110,0.18)' : 'transparent',
              color: datePreset === 'Custom' ? 'var(--accent-gold)' : 'var(--text-secondary)',
              border: datePreset === 'Custom' ? '1px solid rgba(201,169,110,0.4)' : '1px solid transparent',
              cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.15s', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}><Calendar size={11} />{t('common.custom')}</button>
          </div>

          {/* Custom date range - shown inline when Custom is active */}
          {datePreset === 'Custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ ...inputStyle, width: 140, padding: '5px 10px', fontSize: 12, borderRadius: 8, borderColor: dateFrom ? 'var(--accent-gold)' : 'var(--border-subtle)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ ...inputStyle, width: 140, padding: '5px 10px', fontSize: 12, borderRadius: 8, borderColor: dateTo ? 'var(--accent-gold)' : 'var(--border-subtle)' }}
              />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{
                  background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Sans', padding: '4px 10px', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  {t('common.clear')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('payments.paymentHistory')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('common.date'), t('attendance.member'), t('payments.description'), t('common.amount'), t('payments.method'), t('payments.reference'), t('payments.recordedBy')].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map(p => {
                const m = p.member;
                const ms = methodStyle(p.method);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={() => setSelectedPayment(p)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{(p.createdAt || '').slice(0, 10)}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {m ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {m.photo
                            ? <img src={m.photo} alt={m.firstName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}/>
                            : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={28}/>}
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{m.firstName} {m.lastName}</span>
                        </div>
                      ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.note || p.description}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>{formatMoney(p.amount)}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ ...ms, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4 }}>{methodName(p.method, t)}</span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{p.reference}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.staff ? staffName(p.staff) : p.recordedBy || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('common.showing')} {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filtered.length)} {t('common.of')} {filtered.length} {t('payments.paymentsLabel')}
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1).reduce((acc, p, idx, arr) => {
                if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('…');
                acc.push(p);
                return acc;
              }, []).map((p, i) => (
                <button key={i} onClick={() => typeof p === 'number' && setCurrentPage(p)} disabled={p === '…'}
                  style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: p === safePage ? 'var(--accent-gold)' : 'var(--bg-card)', color: p === safePage ? '#0a0a0f' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: p === '…' ? 'default' : 'pointer' }}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </div>
      </div>

      {paymentDialogs}
    </div>
  );
}
