import RevenueSplit from '../components/ui/RevenueSplit';
import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { digitsOnly } from '../utils/number';
import { Plus, Download, TrendingUp, TrendingDown, AlertCircle, Banknote, Pencil, Trash2, FileText, Eye, BarChart2, CheckCircle } from 'lucide-react';
import RowMenu from '../components/ui/RowMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Modal from '../components/ui/Modal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import { getAll as getExpenses, create as createExpense, update as updateExpense, remove as removeExpense, getPending as getPendingExpenses, approve as approveExpenseApi } from '../services/expenses.service';
import { getRole } from '../utils/auth';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getPayments } from '../services/payments.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPayRecords, setStatus as setPayStatus, create as createPayRecord } from '../services/payroll.service';
import { previewMonth as previewPay } from '../services/payAdjustments.service';
import { fmtDate, dayStr, todayStr, payMonthText } from '../utils/date';
import { expenseCategoryName } from '../utils/expenseCategories';
import { readStored, store, storeJson, unstore } from '../utils/storage';
import { revenueOf } from '../utils/revenue';
import { getAll as getSales } from '../services/sales.service';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods, canonicalMethod, PAYMENT_METHODS } from '../utils/paymentMethods';
import { roleName } from '../utils/roleNames';

// One list of expense categories for every form, filter and breakdown. Entries
// made on the old phone form may carry Equipment or Marketing; they still show.
const EXPENSE_CATEGORIES = ['Utilities', 'Rent', 'Maintenance', 'Salaries', 'Supplies', 'Other'];
const EXPENSE_COLORS = { Utilities: '#60a5fa', Rent: '#fbbf24', Maintenance: '#f97316', Salaries: '#a78bfa', Supplies: '#34d399', Other: '#9ca3af', Equipment: '#fb923c', Marketing: '#4ade80' };
const categoriesIn = (list) => [...new Set([...EXPENSE_CATEGORIES, ...list.map(e => e.category).filter(Boolean)])];
import { softAll } from '../utils/loadAll';
import { escapeHtml, getGymInfo, openPrintWindow, safeImageSrc } from '../utils/receipt';
import { gymCache } from '../utils/gymCache';
import { SkeletonCards } from '../components/Skeleton';

const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };
// Header controls sit beside Export PDF, so they take the same treatment as
// secondaryBtn rather than the form-field styling used inside modals.
const toolbarControl = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  fontFamily: 'DM Sans',
  outline: 'none',
  cursor: 'pointer',
  width: 160,
};

const emptyForm = { title: '', category: 'Utilities', amount: '', date: '', paidTo: '', method: 'Cash', reference: '', recordedBy: '', notes: '', staffId: '', payMonth: '' };

// Pay periods are stored as "Sep 2026", generated the same way everywhere so a
// period always matches the records and adjustments tagged with it.
const payMonthLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
function payMonthOptions(forward = 12) {
  const now = new Date();
  return Array.from({ length: forward + 1 }, (_, i) =>
    payMonthLabel(new Date(now.getFullYear(), now.getMonth() + i, 1)));
}

function getPeriodDateRanges() {
  const now = new Date();
  // Local days: toISOString() would start "This Month" on the last day of the
  // month before, anywhere east of GMT
  const fmt = (d) => dayStr(d);
  const [y, m] = [now.getFullYear(), now.getMonth()];
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return {
    'This Week':     { from: fmt(monday), to: fmt(sunday) },
    'This Month':    { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) },
    'Last 3 Months': { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) },
    'Last 6 Months': { from: fmt(new Date(y, m - 5, 1)), to: fmt(new Date(y, m + 1, 0)) },
    'This Year':     { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) },
  };
}
const PERIOD_DATE_RANGES = getPeriodDateRanges();

function buildChartData(paymentsList, salesList, expenses, monthsBack) {
  const now = new Date();
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    // The gym's own month: toISOString() would give the previous month for
    // the 1st just after midnight anywhere east of GMT
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const month = fmtDate(d, { month: 'short' });
    const revenue = revenueOf(paymentsList, salesList, day => day.slice(0, 7) === prefix).total;
    const exp = expenses.filter(e => (e.date || '').slice(0, 7) === prefix).reduce((s, e) => s + Number(e.amount || 0), 0);
    return { month, revenue, expenses: exp };
  });
}

const PERIOD_MONTHS_BACK = {
  'This Week':       1,
  'This Month':      1,
  'Last 3 Months':   3,
  'Last 6 Months':   6,
  'This Year':      12,
};

const PERIOD_OPTIONS = ['This Week', 'This Month', 'Last 3 Months', 'Last 6 Months', 'This Year'];
const PERIOD_KEYS = { 'This Week': 'common.thisWeek', 'This Month': 'common.thisMonth', 'Last 3 Months': 'reports.last3Months', 'Last 6 Months': 'reports.last6Months', 'This Year': 'reports.thisYear' };

const formatYAxis = (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v.toLocaleString();

// converts 'YYYY-MM' → 'Mar 2026' for matching paystub records
// Must match how pay periods are stored ("Sep 2026"). A locale-aware format
// would give "Sept 2026" in en-GB or "sept. 2026" in French and never match.
const fmtMonth = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return payMonthLabel(new Date(Number(y), Number(m) - 1));
};
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymOf = (label) => {
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(label || '').trim());
  const idx = m ? MONTH_ABBR.indexOf(m[1]) : -1;
  return idx < 0 ? '' : `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
};
const thisMonthYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const isYm = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''));

// Maps a PayRecord from the API onto the shape this page renders.
function toPaystub(r) {
  const bd = r.breakdown || null;
  return {
    id: r.id,
    staffId: r.staff?.id,
    staffName: `${r.staff?.firstName || ''} ${r.staff?.lastName || ''}`.trim(),
    role: r.staff?.role || '',
    month: r.month,
    basicPay: r.basePay ?? r.amount,
    allowances: bd?.totalBonuses || 0,
    deductions: r.deductions ?? bd?.totalDeductions ?? 0,
    // The pay as the books record it: basic plus bonuses
    grossPay: r.amount,
    // What changes hands: the pay less what is withheld for deductions
    netPay: r.netAmount ?? Math.max(0, r.amount - (r.deductions ?? bd?.totalDeductions ?? 0)),
    breakdown: bd,
    note: r.note || '',
    issuedAt: r.issuedAt,
    paidAt: r.paidAt,
    status: r.status || 'issued',
  };
}

const PAYSTUB_EXPENSE_MAP_KEY = 'gem_paystub_expense_map';
function loadPaystubExpenseMap() {
  try { return JSON.parse(localStorage.getItem(PAYSTUB_EXPENSE_MAP_KEY) || '{}'); } catch { return {}; }
}
function savePaystubExpenseMap(map) {
  storeJson(PAYSTUB_EXPENSE_MAP_KEY, map);
}

// Front-desk expenses live on the gym record now, not in this browser. A desk
// expense from the API is shaped for the Front Desk Expenses tab, which still
// reads description/submittedBy/status.
function normFdExpense(e) {
  return { ...e, description: e.title, submittedBy: e.recordedBy || e.createdByName || '', status: e.approvalStatus === 'pending' ? 'pending' : 'approved' };
}

// Bonuses and deductions are read as two separate ledgers, never one mixed list.
const PAY_KINDS = [
  { key: 'bonuses', titleKey: 'reports.bonuses', sign: '+', color: 'var(--accent-green)' },
  { key: 'deductions', titleKey: 'reports.deductions', sign: '-', color: 'var(--accent-red)' },
];

const StatusPill = ({ status, label }) => {
  const map = {
    pending:  { bg: 'rgba(234,179,8,0.15)',  color: '#eab308' },
    approved: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
    paid:     { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
    issued:   { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' },
    draft:    { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, textTransform: label ? 'none' : 'capitalize' }}>
      {label || status || 'pending'}
    </span>
  );
};

export default function AccountingPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const role = getRole();
  const canEditPayroll = role !== 'manager';
  // Changing a figure in the books, or taking one out, is the owner's alone.
  // Everybody else reads them.
  const gymSettings = useGymSettings();
  const canEditExpenses = role === 'general_manager';
  // Payroll per person is the owner's. A manager sees what it cost the gym,
  // rolled into the books, so there is no paystub tab for them.
  const mainTabs = [
    ['overview', t('reports.overview')],
    ...(canEditPayroll ? [['paystubs', t('reports.paystubs')]] : []),
    ['marketing', t('reports.marketing')],
  ];
  // Show the last figures at once and refresh quietly; a first-ever visit
  // falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('accounting');
  const [expenses, setExpenses] = useState(() => cache.read('expenses', []));
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [staffList, setStaffList] = useState(() => cache.read('staff', []));
  const [paymentsList, setPaymentsList] = useState(() => cache.read('payments', []));
  const [salesList, setSalesList] = useState(() => cache.read('sales', []));
  const [membersList, setMembersList] = useState(() => cache.read('members', []));
  const [loading, setLoading] = useState(() => !cache.has('expenses'));
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [salaryPreview, setSalaryPreview] = useState(null);
  // Issuing pay is a different action from booking an expense, so the form
  // swaps its fields rather than pretending salaries are an ordinary expense.
  const isSalaryEntry = !editingExpense && form.category === 'Salaries';
  const [showUnpaidAuth, setShowUnpaidAuth] = useState(false);
  const [pendingUnpaidId, setPendingUnpaidId] = useState(null);

  // Picking a staff member and month works out what they are owed, including
  // their bonuses and deductions for that period.
  const loadSalaryPreview = async (staffId, month) => {
    if (!staffId || !month) { setSalaryPreview(null); return; }
    try {
      const res = await previewPay(staffId, month);
      setSalaryPreview(res.data);
      setForm(f => ({ ...f, amount: String(res.data.net) }));
    } catch {
      setSalaryPreview(null);
    }
  };
  const [errors, setErrors] = useState({});
  const [period, setPeriod] = useState('This Month');
  const [activeTab, setActiveTab] = useState('All Expenses');
  const [fdStatusFilter, setFdStatusFilter] = useState('all');
  const [frontDeskExpenses, setFrontDeskExpenses] = useState([]);
  // Notifications and other deep links land here with ?tab=paystubs, so the
  // page opens on the tab the link was about rather than the default.
  const [searchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState(() => {
    const tab = searchParams.get('tab');
    if (tab === 'paystubs' && getRole() === 'manager') return 'overview';
    return ['overview', 'paystubs', 'marketing'].includes(tab) ? tab : 'overview';
  });
  const [paystubs, setPaystubs] = useState([]);
  const [paystubMonth, setPaystubMonth] = useState(() => (isYm(searchParams.get('month')) ? searchParams.get('month') : thisMonthYm()));
  const [marketingRange, setMarketingRange] = useState('all'); // 7d | 30d | 90d | 365d | all
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'paystubs' && role === 'manager') setMainTab('overview');
    else if (['overview', 'paystubs', 'marketing'].includes(tab)) setMainTab(tab);
    const month = searchParams.get('month');
    if (isYm(month)) setPaystubMonth(month);
  }, [searchParams]);
  const [showPaystubModal, setShowPaystubModal] = useState(false);
  const [editingPaystub, setEditingPaystub] = useState(null);
  const [payForm, setPayForm] = useState({});
  const [paystubDeductionLines, setPaystubDeductionLines] = useState({});
  const [newDedLine, setNewDedLine] = useState({ label: '', amount: '', note: '' });
  const [showAddDedLine, setShowAddDedLine] = useState(false);
  const [expenseImagePreview, setExpenseImagePreview] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [viewingPaystub, setViewingPaystub] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [showPaystubAuthModal, setShowPaystubAuthModal] = useState(false);
  const [showExpenseAuthModal, setShowExpenseAuthModal] = useState(false);
  const [pendingExpenseSave, setPendingExpenseSave] = useState(null);
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);

  const getReceiptKey = (id) => `gem_expense_receipt_${id}`;
  const loadReceipt = (id) => readStored(getReceiptKey(id)) || null;
  const saveReceipt = (id, dataUrl) => (dataUrl ? store(getReceiptKey(id), dataUrl) : unstore(getReceiptKey(id)));

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      getExpenses({ source: 'frontdesk', status: 'all' }).then(r => setFrontDeskExpenses((r.data || []).map(normFdExpense))).catch(() => {});
      // Pay may have been issued from a staff profile in the meantime
      getPayRecords().then(r => setPaystubs((r.data || []).map(toPaystub))).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Re-read payroll whenever the Paystubs tab is opened
  useEffect(() => {
    if (mainTab !== 'paystubs') return;
    getPayRecords().then(r => setPaystubs((r.data || []).map(toPaystub))).catch(() => {});
  }, [mainTab]);

  const liveTick = useLiveTick();
  useEffect(() => {
    // Each of these is allowed to fail on its own. Payroll is the owner's, so
    // it comes back 403 for a manager - and with Promise.all that one refusal
    // threw away the expenses, payments and members too, leaving the manager
    // an accounting page with nothing on it at all.
    // Shop sales count as revenue too; a year back covers every period and the chart
    const yearAgo = new Date(); yearAgo.setMonth(yearAgo.getMonth() - 11, 1);
    softAll([getExpenses(), getStaff(), getPayments(), getMembers(), getPayRecords(), getPendingExpenses(), getExpenses({ source: 'frontdesk', status: 'all' }), getSales({ from: dayStr(yearAgo), to: todayStr() })])
      .then(([eRes, sRes, pRes, mRes, payRes, pendRes, fdRes, salesRes]) => {
        const exp = eRes.data || [], stf = sRes.data || [], pay = pRes.data || [], mem = mRes.data || [];
        setExpenses(exp); cache.write('expenses', exp);
        setMembersList(mem); cache.write('members', mem);
        setStaffList(stf); cache.write('staff', stf);
        setPaymentsList(pay); cache.write('payments', pay);
        if (salesRes) { const sl = salesRes.data || []; setSalesList(sl); cache.write('sales', sl); }
        // Real issued payroll, not invented rows
        setPaystubs((payRes.data || []).map(toPaystub));
        setPendingApprovals(pendRes?.data || []);
        setFrontDeskExpenses((fdRes?.data || []).map(normFdExpense));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  // A desk expense over the limit waits here for a manager. Approving it moves
  // it into the books (it then shows up in the normal expense list and totals).
  const canApproveExpenses = ['general_manager', 'manager'].includes(role);
  const [approvingId, setApprovingId] = useState(null);
  // Reviewing a desk expense moves it into the books. (There is no "reject" -
  // the money is already spent; the manager is confirming the entry.) The
  // books themselves reload with every write (useLiveTick); a refusal is
  // shown under the expense it was for (F-120).
  const [reviewError, setReviewError] = useState(null);
  const reviewExpense = async (id) => {
    setApprovingId(id);
    setReviewError(null);
    try {
      await approveExpenseApi(id);
      setPendingApprovals(prev => prev.filter(e => e.id !== id));
      setFrontDeskExpenses(prev => prev.map(e => (e.id === id ? { ...e, status: 'approved' } : e)));
    } catch (err) {
      setReviewError({ id, text: err?.response?.data?.error || t('reports.reviewFailed') });
    } finally {
      setApprovingId(null);
    }
  };
  // A refused deletion reopens the expense with the reason
  const [viewError, setViewError] = useState('');

  const pendingPanel = (canApproveExpenses && pendingApprovals.length > 0) ? (
    <div style={{ ...cardStyle, marginBottom: 24, border: '1px solid rgba(201,169,110,0.4)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircle size={16} color="var(--accent-gold)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{t('reports.pendingApprovalTitle')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)', borderRadius: 10, padding: '2px 8px' }}>{pendingApprovals.length}</span>
      </div>
      <div>
        {pendingApprovals.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[e.category, e.paidTo && `→ ${e.paidTo}`, e.createdByName, String(e.date).slice(0, 10)].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatMoney(e.amount)}</div>
            <RowMenu title={t('common.actions')} items={[
              { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => openView(e) },
              { label: approvingId === e.id ? t('common.loading') : t('reports.markReviewed'), icon: <CheckCircle size={15} />,
                onClick: () => { if (approvingId !== e.id) reviewExpense(e.id); } },
            ]} />
            {reviewError?.id === e.id && <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.4 }}>{reviewError.text}</div>}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const chartData = buildChartData(paymentsList, salesList, expenses, PERIOD_MONTHS_BACK[period] || 1).map(d => ({ ...d, net: d.revenue - d.expenses }));

  const periodRange = PERIOD_DATE_RANGES[period] || PERIOD_DATE_RANGES['This Month'];

  // Money in for the period: what members paid plus what the shop sold
  const periodRev = revenueOf(paymentsList, salesList, d => d >= periodRange.from && d <= periodRange.to);
  const periodRevenue = periodRev.total;

  const periodExpensesAmt = expenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  }).reduce((s, e) => s + Number(e.amount || 0), 0);

  const periodNet = periodRevenue - periodExpensesAmt;
  // What members owe now (payments carry no status, so a sum of "pending" ones was always 0)
  const periodOutstanding = membersList.reduce((s, m) => s + Math.max(0, Number(m.balance) || 0), 0);
  // A payment method by name, never the stored code (mobile_money)
  const methodName = (code) => { const m = PAYMENT_METHODS.find(x => x.api === code || x.key === canonicalMethod(code)); return m ? t(m.labelKey) : (code || '-'); };
  const periodFilteredExpenses = expenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  });
  const periodFilteredFdExpenses = frontDeskExpenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  });

  // Split by what the money was for, from each payment's recorded type (the
  // old version guessed from a description payments do not have, so it put
  // everything under Other) plus the shop's own sales
  const paymentCategoryBreakdown = (() => {
    const total = periodRev.total;
    if (total === 0) return [];
    return [
      [t('reports.revMemberships'), periodRev.memberships],
      [t('reports.revRegistration'), periodRev.registration],
      [t('reports.revPasses'), periodRev.passes],
      [t('reports.revShop'), periodRev.shop],
      [t('reports.revOther'), periodRev.other],
    ].filter(([, v]) => v > 0)
      .map(([label, amount]) => ({ label, amount, pct: Math.round((amount / total) * 100) }));
  })();

  const openAdd = () => { setForm(emptyForm); setEditingExpense(null); setErrors({}); setExpenseImagePreview(null); setShowModal(true); };
  const openEdit = (exp) => {
    setForm({
      title: exp.title || '',
      category: exp.category || 'Utilities',
      amount: exp.amount || '',
      date: exp.date ? new Date(exp.date).toISOString().slice(0, 10) : '',
      paidTo: exp.paidTo || '',
      method: exp.method || 'cash',
      reference: '',
      recordedBy: exp.recordedBy || '',
      notes: exp.note || exp.notes || '',
    });
    setEditingExpense(exp);
    setErrors({});
    setExpenseImagePreview(loadReceipt(exp.id));
    setShowModal(true);
  };
  const openView = (exp) => { setViewError(''); setViewingExpense({ ...exp, receipt: loadReceipt(exp.id) }); };

  const validate = () => {
    const e = {};
    if (isSalaryEntry) {
      if (!form.staffId) e.staffId = t('common.required');
      if (!form.payMonth) e.payMonth = t('common.required');
      // 0 is a real pay (no hours, or deductions that exactly cancel it)
      if (String(form.amount ?? '').trim() === '' || !(Number(form.amount) >= 0)) e.amount = t('common.required');
      const short = salaryPreview?.month === form.payMonth ? (salaryPreview.shortfall || 0) : 0;
      if (short > 0) e._api = t('reports.payShortfall', { month: payMonthText(form.payMonth), amount: formatMoney(short) });
      return e;
    }
    if (!form.title) e.title = t('common.required');
    if (!form.amount) e.amount = t('common.required');
    if (!form.date) e.date = t('common.required');
    // Who the money went to is required so an entry is always traceable.
    if (!form.paidTo || !form.paidTo.trim()) e.paidTo = t('common.required');
    return e;
  };

  // Salaries are not booked as an expense here. Issuing pay creates a pay
  // record in the "issued" state; the expense is booked when it is settled.
  const commitPayrollSave = async (another = false) => {
    try {
      const res = await createPayRecord({
        staffId: form.staffId,
        month: form.payMonth,
        amount: Number(form.amount),
        note: form.notes || undefined,
      });
      setPaystubs(prev => [toPaystub(res.data), ...prev]);
      if (another) {
        setForm(f => ({ ...emptyForm, category: 'Salaries', payMonth: f.payMonth }));
        setErrors({});
        setSalaryPreview(null);
      } else {
        setShowModal(false);
        setMainTab('paystubs');
        if (ymOf(form.payMonth)) setPaystubMonth(ymOf(form.payMonth));
      }
    } catch (err) {
      setErrors({ _api: err.response?.data?.error || t('reports.failedToSave') });
    }
  };

  const commitExpenseSave = async (another = false) => {
    if (!editingExpense && form.category === 'Salaries') return commitPayrollSave(another);
    try {
      if (editingExpense) {
        const res = await updateExpense(editingExpense.id, form);
        saveReceipt(editingExpense.id, expenseImagePreview);
        setExpenses(prev => prev.map(ex => ex.id === editingExpense.id ? res.data : ex));
      } else {
        const res = await createExpense(form);
        saveReceipt(res.data.id, expenseImagePreview);
        setExpenses(prev => [res.data, ...prev]);
      }
      if (another) { setForm(emptyForm); setErrors({}); setExpenseImagePreview(null); } else { setShowModal(false); }
    } catch (err) {
      setErrors({ _api: err.response?.data?.error || t('reports.failedToSave') });
    }
  };

  const handleSave = (another = false) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (editingExpense) {
      setPendingExpenseSave(another);
      setShowExpenseAuthModal(true);
    } else {
      commitExpenseSave(another);
    }
  };

  // Approved front-desk expenses already arrive inside `expenses` (the books),
  // so the combined list is just that - adding the front-desk set again would
  // double-count them.
  const allExpenses = periodFilteredExpenses.map(e => ({ ...e, _source: e.source || 'operations' }));
  const tabExpensesRaw =
    activeTab === 'All Expenses' ? allExpenses :
    activeTab === 'Operations Expenses' ? periodFilteredExpenses.map(e => ({ ...e, _source: 'operations' })) :
    periodFilteredFdExpenses.map(e => ({ ...e, title: e.description, _source: 'frontdesk' }));

  const tabExpenses = categoryFilter === 'All Categories'
    ? tabExpensesRaw
    : tabExpensesRaw.filter(e => e.category === categoryFilter);

  const pendingCount = frontDeskExpenses.filter(e => !e.status || e.status === 'pending').length;

  const filteredFdExpenses = fdStatusFilter === 'all'
    ? frontDeskExpenses
    : fdStatusFilter === 'pending'
    ? frontDeskExpenses.filter(e => !e.status || e.status === 'pending')
    : frontDeskExpenses.filter(e => e.status === fdStatusFilter);

  const tabTotal = tabExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const summaryCards = [
    { label: t('reports.totalRevenue'), value: formatMoney(periodRevenue), sub: <RevenueSplit members={periodRev.members} shop={periodRev.shop} />, icon: TrendingUp, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
    { label: t('reports.totalExpenditures'), value: formatMoney(periodExpensesAmt), icon: TrendingDown, color: 'var(--accent-red)', dim: 'var(--accent-red-dim)' },
    // A gym that spent more than it took in should not read as good news
    { label: t('reports.netIncome'), value: formatMoney(periodNet), icon: periodNet < 0 ? TrendingDown : Banknote,
      color: periodNet < 0 ? 'var(--accent-red)' : 'var(--accent-green)',
      dim: periodNet < 0 ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)' },
    { label: t('reports.outstanding'), value: formatMoney(periodOutstanding), icon: AlertCircle, color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
  ];

  const tabs = ['All Expenses', 'Operations Expenses', 'Front Desk Expenses'];
  const tabLabels = { 'All Expenses': t('reports.allExpenses'), 'Operations Expenses': t('reports.operationsExpenses'), 'Front Desk Expenses': t('reports.frontDeskExpenses') };

  const monthPaystubs = paystubs.filter(p => p.month === fmtMonth(paystubMonth));
  // Only one month is on screen, so pay still owed in another month would
  // otherwise be invisible here.
  const otherMonthsDue = Object.entries(
    paystubs
      .filter(p => p.status !== 'paid' && p.month !== fmtMonth(paystubMonth) && ymOf(p.month))
      .reduce((acc, p) => ({ ...acc, [p.month]: (acc[p.month] || 0) + 1 }), {}),
  ).map(([month, count]) => ({ month, count, ym: ymOf(month) }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const otherMonthsNotice = otherMonthsDue.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
      <span>{t('reports.awaitingOtherMonths')}</span>
      {otherMonthsDue.map(o => (
        <button key={o.ym} type="button" onClick={() => setPaystubMonth(o.ym)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-yellow-dim)', border: '1px solid rgba(234,179,8,0.35)', color: 'var(--text-primary)', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer' }}>
          {payMonthText(o.month)}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-yellow)' }}>{o.count}</span>
        </button>
      ))}
    </div>
  );
  // Total is the month's full payroll obligation and stays fixed; paid and
  // outstanding are what actually move as paystubs are marked paid or unpaid.
  const totalPayroll = monthPaystubs.reduce((s, p) => s + p.grossPay, 0);
  const paidPayroll = monthPaystubs.filter(p => p.status === 'paid').reduce((s, p) => s + p.grossPay, 0);
  const outstandingPayroll = totalPayroll - paidPayroll;

  const openEditPaystub = (p) => {
    setEditingPaystub(p);
    setPayForm({ basicPay: p.basicPay, allowances: p.allowances });
    setNewDedLine({ label: '', amount: '', note: '' });
    setShowAddDedLine(false);
    setShowPaystubModal(true);
  };

  const commitSavePaystub = async () => {
    if (!editingPaystub) return;
    const lines = paystubDeductionLines[editingPaystub.id] || [];
    const totalDed = lines.reduce((s, d) => s + d.amount, 0);
    const allowances = Number(payForm.allowances) || 0;
    const basicPay = editingPaystub.basicPay;
    const newNet = basicPay + allowances - totalDed;
    const newGross = basicPay + allowances;
    setPaystubs(prev => prev.map(p =>
      p.id === editingPaystub.id
        ? { ...p, allowances, deductions: totalDed, netPay: newNet, grossPay: newGross }
        : p
    ));
    if (editingPaystub.status === 'paid') {
      const map = loadPaystubExpenseMap();
      const expenseId = map[editingPaystub.id];
      if (expenseId) {
        try {
          const res = await updateExpense(expenseId, {
            title: t('reports.salaryExpenseTitle', { name: editingPaystub.staffName }),
            category: 'Salaries',
            amount: newGross,
            date: todayStr(),
            paidTo: editingPaystub.staffName,
            method: 'cash',
            note: t('reports.paystubNote', { month: payMonthText(editingPaystub.month) }),
            recordedBy: '',
          });
          setExpenses(prev => prev.map(e => e.id === expenseId ? res.data : e));
        } catch (err) {
          console.error('Failed to update salary expense:', err);
        }
      }
    }
    setShowPaystubModal(false);
  };

  const handleSavePaystub = () => {
    if (!editingPaystub) return;
    const lines = paystubDeductionLines[editingPaystub.id] || [];
    const origLines = [];
    const allowancesChanged = Number(payForm.allowances) !== editingPaystub.allowances;
    const deductionsChanged = lines.length !== origLines.length || lines.length > 0;
    if (allowancesChanged || deductionsChanged) {
      setShowPaystubAuthModal(true);
    } else {
      commitSavePaystub();
    }
  };

  // Settling a paystub is what records the money actually leaving: the pay
  // record is flipped to paid and a matching expense is booked.
  const [confirmPaid, setConfirmPaid] = useState(null);
  const requestMarkPaid = (id) => {
    const stub = paystubs.find(p => p.id === id);
    if (stub) setConfirmPaid(stub);
  };

  const markPaid = async (id) => {
    const stub = paystubs.find(p => p.id === id);
    if (!stub) return;
    try {
      const res = await setPayStatus(id, 'paid');
      setPaystubs(prev => prev.map(p => (p.id === id ? toPaystub(res.data) : p)));
    } catch (err) {
      console.error('Failed to settle paystub:', err);
      return;
    }
    try {
      const expense = await createExpense({
        title: t('reports.salaryExpenseTitle', { name: stub.staffName }),
        category: 'Salaries',
        amount: stub.grossPay,
        date: todayStr(),
        paidTo: stub.staffName,
        method: 'cash',
        note: stub.deductions > 0
          ? t('reports.salaryExpenseNote', { month: payMonthText(stub.month), handOver: formatMoney(stub.netPay), withheld: formatMoney(stub.deductions) })
          : t('reports.payrollNote', { month: payMonthText(stub.month) }),
        recordedBy: '',
      });
      const map = loadPaystubExpenseMap();
      map[id] = expense.data.id;
      savePaystubExpenseMap(map);
      setExpenses(prev => [expense.data, ...prev]);
    } catch (err) {
      console.error('Failed to auto-create salary expense:', err);
    }
  };

  // Reversing a settled payment moves money back, so it takes a manager PIN.
  const requestUnpaid = (id) => {
    setPendingUnpaidId(id);
    setShowUnpaidAuth(true);
  };

  const markUnpaid = async (id) => {
    try {
      const res = await setPayStatus(id, 'issued');
      setPaystubs(prev => prev.map(p => (p.id === id ? toPaystub(res.data) : p)));
    } catch (err) {
      console.error('Failed to reopen paystub:', err);
      return;
    }
    const map = loadPaystubExpenseMap();
    const expenseId = map[id];
    if (expenseId) {
      try {
        await removeExpense(expenseId);
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
      } catch (err) {
        console.error('Failed to remove salary expense:', err);
      }
      delete map[id];
      savePaystubExpenseMap(map);
    }
  };

  const expenseCategoryBreakdown = (() => {
    const cats = categoriesIn(periodFilteredExpenses);
    const rows = cats.map(cat => ({ label: expenseCategoryName(cat, t), amount: periodFilteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0) })).filter(r => r.amount > 0);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? Math.round((r.amount / total) * 100) : 0 }));
  })();

  // Everything placed in a print window is escaped: the window shares the app's
  // origin, and titles, names and notes are typed by people (F-085).
  const handleExportOverview = () => {
    const gymName = escapeHtml(getGymInfo().name);
    openPrintWindow(`<html><head><meta charset="utf-8"><title>${escapeHtml(`${t('reports.financialOverview')} : ${t(PERIOD_KEYS[period])}`)}</title><style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
      h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:12px;margin-bottom:28px}
      .cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px}
      .card{border:1px solid #ddd;border-radius:8px;padding:14px}
      .card-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
      .card-value{font-size:20px;font-weight:700}
      h2{font-size:14px;font-weight:700;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid #eee;text-transform:uppercase;letter-spacing:.5px;color:#444}
      .row{margin-bottom:10px}
      .row-header{display:flex;justify-content:space-between;margin-bottom:4px}
      .bar-bg{height:7px;background:#eee;border-radius:4px}
      .bar-fill{height:7px;border-radius:4px}
      .pct{font-size:11px;color:#999;margin-top:2px}
      .footer{margin-top:40px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px}
    </style></head><body>
    <h1>${gymName}. ${escapeHtml(t('reports.financialOverview'))}</h1>
    <div class="sub">${escapeHtml(t('reports.periodLabel'))}: <strong>${escapeHtml(t(PERIOD_KEYS[period]))}</strong> &nbsp;·&nbsp; ${escapeHtml(t('reports.generatedLabel'))} ${escapeHtml(fmtDate(new Date(), { day: '2-digit', month: 'short', year: 'numeric' }))}</div>
    <div class="cards">
      <div class="card"><div class="card-label">${escapeHtml(t('reports.totalRevenue'))}</div><div class="card-value" style="color:#2563eb">${escapeHtml(formatMoney(periodRevenue))}</div></div>
      <div class="card"><div class="card-label">${escapeHtml(t('reports.totalExpenditures'))}</div><div class="card-value" style="color:#ef4444">${escapeHtml(formatMoney(periodExpensesAmt))}</div></div>
      <div class="card"><div class="card-label">${escapeHtml(t('reports.netIncome'))}</div><div class="card-value" style="color:${periodNet < 0 ? '#ef4444' : '#16a34a'}">${escapeHtml(formatMoney(periodNet))}</div></div>
      <div class="card"><div class="card-label">${escapeHtml(t('reports.outstanding'))}</div><div class="card-value" style="color:#ca8a04">${escapeHtml(formatMoney(periodOutstanding))}</div></div>
    </div>
    <h2>${escapeHtml(t('reports.revenueBreakdown'))}</h2>
    ${paymentCategoryBreakdown.length === 0 ? `<p style="color:#999">${escapeHtml(t('reports.noPaymentData'))}</p>` : paymentCategoryBreakdown.map(r => `
      <div class="row">
        <div class="row-header"><span>${escapeHtml(r.label)}</span><span><strong>${escapeHtml(formatMoney(r.amount))}</strong></span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${Number(r.pct) || 0}%;background:#c9a96e"></div></div>
        <div class="pct">${escapeHtml(`${r.pct}${t('reports.ofTotalRevenue')}`)}</div>
      </div>`).join('')}
    <h2>${escapeHtml(t('reports.expensesBreakdown'))}</h2>
    ${expenseCategoryBreakdown.length === 0 ? `<p style="color:#999">${escapeHtml(t('reports.noExpenseData'))}</p>` : expenseCategoryBreakdown.map(r => `
      <div class="row">
        <div class="row-header"><span>${escapeHtml(r.label)}</span><span><strong>${escapeHtml(formatMoney(r.amount))}</strong></span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${Number(r.pct) || 0}%;background:#ef4444"></div></div>
        <div class="pct">${escapeHtml(`${r.pct}${t('reports.ofTotalExpenses')}`)}</div>
      </div>`).join('')}
    <div class="footer">${escapeHtml(t('reports.printFooter'))}</div>
    </body></html>`, { features: 'width=820,height=1000' });
  };

  const handleExportPaystubs = () => {
    const gymName = escapeHtml(getGymInfo().name);
    openPrintWindow(`<html><head><meta charset="utf-8"><title>${escapeHtml(`${t('reports.payroll')} : ${payMonthText(fmtMonth(paystubMonth))}`)}</title><style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
      h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #ddd}
      td{padding:9px 12px;border-bottom:1px solid #eee}
      .total td{font-weight:700;background:#fafafa;border-top:2px solid #ddd}
      .footer{margin-top:32px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px}
    </style></head><body>
    <h1>${gymName}. ${escapeHtml(t('reports.paystubs'))}</h1>
    <div class="sub">${escapeHtml(t('reports.monthLabel'))}: <strong>${escapeHtml(payMonthText(fmtMonth(paystubMonth)))}</strong> &nbsp;·&nbsp; ${escapeHtml(t('reports.generatedLabel'))} ${escapeHtml(fmtDate(new Date(), { day: '2-digit', month: 'short', year: 'numeric' }))}</div>
    <table>
      <thead><tr>${[t('common.name'), t('staff.role'), t('reports.basicPay'), t('reports.allowances'), t('reports.deductions'), t('reports.netPay'), t('common.status')].map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${monthPaystubs.map(p => `<tr>
          <td><strong>${escapeHtml(p.staffName)}</strong></td><td>${escapeHtml(p.role)}</td>
          <td>${escapeHtml(formatMoney(p.basicPay))}</td>
          <td style="color:green">+${escapeHtml(formatMoney(p.allowances))}</td>
          <td style="color:red">-${escapeHtml(formatMoney(p.deductions))}</td>
          <td><strong>${escapeHtml(formatMoney(p.netPay))}</strong></td>
          <td style="text-transform:capitalize">${escapeHtml(p.status)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td colspan="5" style="text-align:right;padding-right:12px">${escapeHtml(t('reports.totalPayrollLabel'))}</td>
          <td colspan="2">${escapeHtml(formatMoney(totalPayroll))}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">${escapeHtml(t('reports.printFooter'))}</div>
    </body></html>`, { features: 'width=900,height=700' });
  };

  // ── Mobile layout ────────────────────────────────────────────────────────────
  // Drawn by both layouts. On a phone their buttons (view an expense or a
  // paystub, edit pay, mark paid) used to do nothing, and the phone had its
  // own add-expense sheet without "Paid to", so it could not save (F-109, F-110).
  const sharedDialogs = (
    <>
      {/* Add / Edit Expense Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editingExpense ? t('reports.editExpense') : (isSalaryEntry ? t('reports.issueStaffPay') : t('reports.addExpense'))}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: isSalaryEntry ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.category')}</label>
              <select style={inputStyle} value={form.category} disabled={!!editingExpense}
                onChange={e => {
                  const category = e.target.value;
                  setSalaryPreview(null);
                  setErrors({});
                  setForm(f => ({
                    ...f, category,
                    // Salary entries start clean: the amount is worked out, not typed
                    ...(category === 'Salaries'
                      ? { amount: '', staffId: '', payMonth: payMonthLabel(new Date()), title: '', paidTo: '' }
                      : { staffId: '', payMonth: '' }),
                  }));
                }}>
                {(EXPENSE_CATEGORIES.includes(form.category) || !form.category ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, form.category]).map(c => <option key={c} value={c}>{expenseCategoryName(c, t)}</option>)}
              </select>
            </div>
            {!isSalaryEntry && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.amount')} *</label>
                <input type="text" inputMode="numeric" style={{ ...inputStyle, borderColor: errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: digitsOnly(e.target.value) }))} placeholder="0" />
                {errors.amount && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.amount}</div>}
              </div>
            )}
          </div>

          {isSalaryEntry ? (
            <>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.staffMemberField')}</label>
                  <select style={{ ...inputStyle, borderColor: errors.staffId ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                    value={form.staffId}
                    onChange={e => { const staffId = e.target.value; setForm(f => ({ ...f, staffId })); loadSalaryPreview(staffId, form.payMonth); }}>
                    <option value="">{t('tasks.selectStaff')}</option>
                    {staffList.filter(s => s.isActive !== false).map(s => (
                      <option key={s.id} value={s.id}>{staffName(s)}</option>
                    ))}
                  </select>
                  {errors.staffId && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.staffId}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.payPeriodField')}</label>
                  <select style={{ ...inputStyle, borderColor: errors.payMonth ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                    value={form.payMonth}
                    onChange={e => { const payMonth = e.target.value; setForm(f => ({ ...f, payMonth })); loadSalaryPreview(form.staffId, payMonth); }}>
                    {payMonthOptions().map(m => <option key={m} value={m}>{payMonthText(m)}</option>)}
                  </select>
                  {errors.payMonth && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.payMonth}</div>}
                </div>
              </div>

              {salaryPreview && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span>{t('reports.baseSalary')}</span><span>{formatMoney(salaryPreview.basePay)}</span>
                  </div>
                  {salaryPreview.bonuses.map((b, i) => (
                    <div key={`b${i}`} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-green)', marginBottom: 3 }}>
                      <span>{b.label}{b.recurring ? '' : ` (${t('reports.oneTime')})`}</span><span>+{formatMoney(b.amount)}</span>
                    </div>
                  ))}
                  {salaryPreview.deductions.map((d, i) => (
                    <div key={`d${i}`} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-red)', marginBottom: 3 }}>
                      <span>{d.label}{d.recurring ? '' : ` (${t('reports.oneTime')})`}</span><span>-{formatMoney(d.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', marginTop: 6, paddingTop: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <span>{t('reports.net')}</span><span>{formatMoney(salaryPreview.net)}</span>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.amount')} *</label>
                <input type="text" inputMode="numeric" style={{ ...inputStyle, borderColor: errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: digitsOnly(e.target.value) }))} placeholder="0" />
                {errors.amount && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.amount}</div>}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--accent-gold-dim)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: '9px 12px', lineHeight: 1.5 }}>
                {t('reports.issueInfo')}
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.titleLabel')}</label>
                <input style={{ ...inputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('reports.expenseTitlePh')} />
                {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
              </div>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.date')} *</label>
                  <input type="date" style={{ ...inputStyle, borderColor: errors.date ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  {errors.date && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.date}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.paidTo')} *</label>
                  <input style={{ ...inputStyle, borderColor: errors.paidTo ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))} placeholder={t('reports.vendorName')} />
                  {errors.paidTo && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.paidTo}</div>}
                </div>
              </div>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('sales.paymentMethod')}</label>
                  {/* stored as a code (mobile_money); the list shows the gym's own methods by name */}
                  <select style={inputStyle} value={PAYMENT_METHODS.find(x => x.api === form.method || x.key === canonicalMethod(form.method))?.key || enabledMethods(gymSettings)[0]?.key} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {enabledMethods(gymSettings).map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.recordedBy')}</label>
                  <select style={inputStyle} value={form.recordedBy} onChange={e => setForm(f => ({ ...f, recordedBy: e.target.value }))}>
                    <option value="">{t('tasks.selectStaff')}</option>
                    {staffList.filter(s => s.isActive !== false || staffName(s) === form.recordedBy).map(s => <option key={s.id} value={staffName(s)}>{staffName(s)}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.notes')}</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: isSalaryEntry ? 'none' : 'block' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('reports.attachReceipt')}</label>
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ev => setExpenseImagePreview(ev.target.result);
                reader.readAsDataURL(file);
              }
            }} style={{ ...inputStyle, padding: '7px 14px', cursor: 'pointer' }} />
            {expenseImagePreview && (
              <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                <img src={expenseImagePreview} alt={t('reports.receiptPreview')} style={{ maxWidth: '100%', maxHeight: 130, borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'block' }} />
                <button onClick={() => setExpenseImagePreview(null)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
          </div>
          {errors._api && <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>⚠ {errors._api}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            {!editingExpense && <button style={secondaryBtn} onClick={() => handleSave(true)}>{t('tasks.saveAndAddAnother')}</button>}
            <button style={primaryBtn} onClick={() => handleSave(false)}>{isSalaryEntry ? t('reports.issuePay') : t('reports.saveExpense')}</button>
          </div>
        </div>
      </Modal>

      {/* Expense Detail Modal */}
      {viewingExpense && (
        <Modal open={!!viewingExpense} onClose={() => { setViewingExpense(null); setViewError(''); }} title={t('reports.expenseRecord')} maxWidth={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                [t('common.title'), viewingExpense.title],
                [t('reports.category'), expenseCategoryName(viewingExpense.category, t)],
                [t('common.amount'), formatMoney(Number(viewingExpense.amount))],
                [t('common.date'), viewingExpense.date ? fmtDate(viewingExpense.date) : '-'],
                [t('reports.paidTo'), viewingExpense.paidTo || '-'],
                [t('reports.method'), methodName(viewingExpense.method)],
                [t('reports.recordedBy'), viewingExpense.recordedBy || '-'],
                // Who put it in GEM, and when: taken from whoever was signed in
                [t('reports.createdBy'), viewingExpense.createdByName
                  ? `${viewingExpense.createdByName} · ${fmtDate(viewingExpense.createdAt)}`
                  : '-'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
            {viewingExpense.editedByName && (
              <div style={{ background: 'var(--accent-yellow-dim)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                {t('reports.editedStamp', { name: viewingExpense.editedByName, date: fmtDate(viewingExpense.editedAt) })}
              </div>
            )}
            {(viewingExpense.note || viewingExpense.notes) && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{t('common.notes')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{viewingExpense.note || viewingExpense.notes}</div>
              </div>
            )}
            {viewingExpense.receipt && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{t('reports.receiptPhoto')}</div>
                <img src={viewingExpense.receipt} alt={t('reports.receipt')} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)', maxHeight: 300, objectFit: 'contain', background: 'var(--bg-elevated)' }} />
              </div>
            )}
            {viewError && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{viewError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              {/* Changing the books happens here, with the entry open in front
                  of you, and each action is confirmed with the owner's code */}
              {canEditExpenses && (
                <button style={secondaryBtn} onClick={() => { setViewingExpense(null); openEdit(viewingExpense); }}><Pencil size={13} /> {t('common.edit')}</button>
              )}
              {canEditExpenses && (
                <button
                  style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                  onClick={() => { const exp = viewingExpense; setViewingExpense(null); setDeleteExpense(exp); setShowDeleteAuthModal(true); }}
                >
                  <Trash2 size={13} /> {t('common.delete')}
                </button>
              )}
              <button style={primaryBtn} onClick={() => {
                const exp = viewingExpense;
                const receipt = safeImageSrc(exp.receipt);
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(`${t('reports.expenseRecord')} : ${exp.title || ''}`)}</title><style>
                  body{font-family:Arial,sans-serif;margin:40px;color:#111;max-width:600px}
                  h1{font-size:20px;margin-bottom:4px}
                  .sub{font-size:12px;color:#666;margin-bottom:24px}
                  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
                  .field label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:2px}
                  .field span{font-size:14px;font-weight:600}
                  .notes-box{background:#f9f9f9;border-radius:6px;padding:12px;font-size:13px;margin-bottom:24px}
                  img{max-width:100%;border-radius:6px;border:1px solid #ddd;margin-top:8px}
                  .footer{margin-top:32px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
                </style></head><body>
                  <h1>${escapeHtml(t('reports.expenseRecord'))}</h1>
                  <div class="sub">${escapeHtml(t('reports.generatedLabel'))} ${escapeHtml(fmtDate(new Date(), { day: '2-digit', month: 'long', year: 'numeric' }))}</div>
                  <div class="grid">
                    <div class="field"><label>${escapeHtml(t('common.title'))}</label><span>${escapeHtml(exp.title || '-')}</span></div>
                    <div class="field"><label>${escapeHtml(t('reports.category'))}</label><span>${escapeHtml(exp.category || '-')}</span></div>
                    <div class="field"><label>${escapeHtml(t('common.amount'))}</label><span style="color:#dc2626">${escapeHtml(formatMoney(Number(exp.amount)))}</span></div>
                    <div class="field"><label>${escapeHtml(t('common.date'))}</label><span>${escapeHtml(fmtDate(exp.date))}</span></div>
                    <div class="field"><label>${escapeHtml(t('reports.paidTo'))}</label><span>${escapeHtml(exp.paidTo || '-')}</span></div>
                    <div class="field"><label>${escapeHtml(t('sales.paymentMethod'))}</label><span>${escapeHtml(methodName(exp.method))}</span></div>
                    <div class="field"><label>${escapeHtml(t('reports.recordedBy'))}</label><span>${escapeHtml(exp.recordedBy || '-')}</span></div>
                  </div>
                  ${(exp.note || exp.notes) ? `<div class="notes-box"><strong>${escapeHtml(t('common.notes'))}:</strong> ${escapeHtml(exp.note || exp.notes)}</div>` : ''}
                  ${receipt ? `<div><strong style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">${escapeHtml(t('reports.receipt'))}</strong><br/><img src="${escapeHtml(receipt)}" /></div>` : ''}
                  <div class="footer">GEM Gym Management · Expense ID: ${escapeHtml(exp.id)}</div>
                </body></html>`;
                openPrintWindow(html, { features: 'width=700,height=900' });
              }}><Download size={13} /> {t('reports.downloadPdf')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Paystub detail - read-only view of what this pay was made of */}
      {viewingPaystub && (() => {
        const p = viewingPaystub;
        const bd = p.breakdown || null;
        const basePay = bd?.basePay ?? p.basicPay;
        const lists = { bonuses: bd?.bonuses || [], deductions: bd?.deductions || [] };
        const totals = { bonuses: bd?.totalBonuses ?? p.allowances, deductions: bd?.totalDeductions ?? p.deductions };
        const meta = [
          [t('reports.payPeriod'), payMonthText(p.month)],
          [t('reports.issuedLabel'), p.issuedAt ? fmtDate(p.issuedAt) : '-'],
          [t('reports.paidLabel'), p.paidAt ? fmtDate(p.paidAt) : '-'],
        ];
        return (
          <Modal open onClose={() => setViewingPaystub(null)} title={p.staffName} maxWidth={520}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{String(p.role || '').replace(/_/g, ' ')}</span>
                <StatusPill status={p.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {meta.map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '9px 12px' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px', fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-secondary)' }}>
                  <span>{t('reports.basicPay')}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(basePay)}</span>
                </div>
                {PAY_KINDS.map(g => {
                  const items = lists[g.key];
                  const total = totals[g.key];
                  if (!items.length && !total) return null;
                  return (
                    <div key={g.key} style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, color: g.color }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t(g.titleKey)}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.sign}{formatMoney(total)}</span>
                      </div>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 10 }}>{t('reports.notItemised')}</div>
                      ) : items.map((x, i) => (
                        <div key={`${g.key}${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 10 }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}{x.recurring ? '' : ' · one time'}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(x.amount)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, borderTop: '1px solid var(--border-subtle)', marginTop: 12, paddingTop: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span>{t('staff.payRecorded')}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.grossPay)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span>{t('staff.toHandOver')}</span>
                  <span style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-gold)' }}>{formatMoney(p.netPay)}</span>
                </div>
              </div>

              {p.note && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{t('common.notes')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.note}</div>
                </div>
              )}

              {canEditPayroll && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button style={secondaryBtn} onClick={() => { setViewingPaystub(null); openEditPaystub(p); }}><Pencil size={13} /> {t('reports.editPay')}</button>
                  {p.status !== 'paid' && (
                    <button style={primaryBtn} onClick={() => { setViewingPaystub(null); requestMarkPaid(p.id); }}>{t('reports.markPaid')}</button>
                  )}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* View / Edit Paystub Modal */}
      <Modal open={showPaystubModal} onClose={() => { setShowPaystubModal(false); setShowAddDedLine(false); }} title={`${t('reports.paystubs')} : ${editingPaystub?.staffName}`} maxWidth={560}>
        {editingPaystub && (() => {
          const lines = paystubDeductionLines[editingPaystub.id] || [];
          const totalDed = lines.reduce((s, d) => s + d.amount, 0);
          const basicPay = editingPaystub.basicPay;
          const allowances = Number(payForm.allowances) || 0;
          const netPay = basicPay + allowances - totalDed;
          return (
            <div>
              {/* Header info */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{editingPaystub.staffName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{roleName(editingPaystub.role, t)} · {payMonthText(editingPaystub.month)}</div>
                  </div>
                  <StatusPill status={editingPaystub.status} />
                </div>
                <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('reports.basicPay')}</div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', opacity: 0.7 }}>{formatMoney(editingPaystub.basicPay)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('reports.allowances')}</div>
                    <input type="number" value={payForm.allowances ?? editingPaystub.allowances} onChange={e => setPayForm(f => ({ ...f, allowances: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 14, fontWeight: 700 }} />
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('reports.deductions')}</span>
                  <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddDedLine(v => !v)}>
                    <Plus size={11} />{showAddDedLine ? t('common.cancel') : t('staff.addDeduction')}
                  </button>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  {lines.length === 0 && !showAddDedLine && (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>{t('staff.noDeductions')}</div>
                  )}
                  {lines.map(d => (
                    <div key={d.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{d.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('common.notePrefixColon')} {d.note}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>-{formatMoney(d.amount)}</span>
                        <button onClick={() => setPaystubDeductionLines(prev => ({ ...prev, [editingPaystub.id]: prev[editingPaystub.id].filter(x => x.id !== d.id) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                  {showAddDedLine && (
                    <div style={{ padding: '12px 16px', borderTop: lines.length > 0 ? '1px solid var(--border-subtle)' : 'none', background: 'rgba(201,169,110,0.04)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8, marginBottom: 8 }}>
                        <input placeholder={t('staff.deductionLabelPh')} value={newDedLine.label} onChange={e => setNewDedLine(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                        <input placeholder={t('staff.amountPh')} type="text" inputMode="numeric" value={newDedLine.amount} onChange={e => setNewDedLine(f => ({ ...f, amount: digitsOnly(e.target.value) }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <input placeholder={t('staff.deductionNotePh')} value={newDedLine.note} onChange={e => setNewDedLine(f => ({ ...f, note: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <button style={{ ...primaryBtn, padding: '5px 14px', fontSize: 11 }} onClick={() => {
                        if (!newDedLine.label || !newDedLine.amount || !newDedLine.note) return;
                        setPaystubDeductionLines(prev => ({
                          ...prev,
                          [editingPaystub.id]: [...(prev[editingPaystub.id] || []), { id: Date.now(), label: newDedLine.label, amount: Number(newDedLine.amount), note: newDedLine.note }],
                        }));
                        setNewDedLine({ label: '', amount: '', note: '' });
                        setShowAddDedLine(false);
                      }}>{t('staff.saveDeduction')}</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Net pay summary */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))', border: '1px solid var(--accent-gold-dim)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('reports.calcNetPay')}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(netPay)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>{formatMoney(basicPay + allowances)} {t('reports.gross')}</div>
                  <div>− {formatMoney(totalDed)} {t('reports.deductions').toLowerCase()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingPaystub.status === 'paid' && (
                    <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }} onClick={() => { requestUnpaid(editingPaystub.id); setShowPaystubModal(false); }}>{t('reports.markUnpaid')}</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={secondaryBtn} onClick={() => { setShowPaystubModal(false); setShowAddDedLine(false); }}>{t('common.cancel')}</button>
                  <button style={primaryBtn} onClick={handleSavePaystub}>{t('common.saveChanges')}</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Settling pay: the figure to hand over is the one that stands out, so
          nobody hands over the full pay when deductions have been withheld */}
      <Modal open={!!confirmPaid} onClose={() => setConfirmPaid(null)} title={confirmPaid ? t('reports.settleTitle', { name: confirmPaid.staffName, month: payMonthText(confirmPaid.month) }) : ''} maxWidth={420}>
        {confirmPaid && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--accent-gold-glow)', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.toHandOver')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{formatMoney(confirmPaid.netPay)}</div>
            </div>
            <div style={{ fontSize: 12.5, fontFamily: 'DM Sans', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{t('staff.payRecorded')}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(confirmPaid.grossPay)}</span>
              </div>
              {confirmPaid.deductions > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-red)' }}>
                  <span>{t('staff.withheldDeductions')}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>−{formatMoney(confirmPaid.deductions)}</span>
                </div>
              )}
            </div>
            {confirmPaid.deductions > 0 && (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                {t('staff.handOverExplain', { gross: formatMoney(confirmPaid.grossPay), withheld: formatMoney(confirmPaid.deductions), handOver: formatMoney(confirmPaid.netPay) })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button style={secondaryBtn} onClick={() => setConfirmPaid(null)}>{t('common.cancel')}</button>
              <button style={primaryBtn} onClick={() => { const id = confirmPaid.id; setConfirmPaid(null); markPaid(id); }}>
                {t('reports.confirmHandedOver', { amount: formatMoney(confirmPaid.netPay) })}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ManagerAuthModal
        open={showUnpaidAuth}
        onClose={() => { setShowUnpaidAuth(false); setPendingUnpaidId(null); }}
        onConfirm={() => {
          const id = pendingUnpaidId;
          setShowUnpaidAuth(false);
          setPendingUnpaidId(null);
          if (id) markUnpaid(id);
        }}
        action="Reverse a settled salary payment"
        danger
      />

      <ManagerAuthModal
        open={showPaystubAuthModal}
        onClose={() => setShowPaystubAuthModal(false)}
        onConfirm={() => { setShowPaystubAuthModal(false); commitSavePaystub(); }}
        action={t('reports.actionEditPaystub', { name: editingPaystub?.staffName })}
      />

      <ManagerAuthModal
        open={showExpenseAuthModal}
        onClose={() => setShowExpenseAuthModal(false)}
        onConfirm={() => { setShowExpenseAuthModal(false); commitExpenseSave(pendingExpenseSave); }}
        action={t('reports.actionEditExpense', { title: editingExpense?.title })}
      />

      <ManagerAuthModal
        open={showDeleteAuthModal}
        onClose={() => { setShowDeleteAuthModal(false); setDeleteExpense(null); }}
        onConfirm={async () => {
          setShowDeleteAuthModal(false);
          const exp = deleteExpense;
          try {
            await removeExpense(exp.id);
            setExpenses(prev => prev.filter(e => e.id !== exp.id));
          } catch (err) {
            openView(exp);
            setViewError(err?.response?.data?.error || t('reports.deleteFailed'));
          }
          setDeleteExpense(null);
        }}
        action={t('reports.actionDeleteExpense', { title: deleteExpense?.title })}
        danger
      />
    </>
  );

  if (isMobile) {
    const EXPENSE_CATS = EXPENSE_COLORS;
    const SOURCES = [
      { key: 'Social Media', label: t('reports.srcSocial'),   color: '#818cf8' },
      { key: 'Friend',       label: t('reports.srcReferral'), color: '#34d399' },
      { key: 'Google',       label: 'Google',                color: '#60a5fa' },
      { key: 'Flyer',        label: t('reports.srcFlyer'),    color: '#f59e0b' },
      { key: 'Walk-in',      label: t('reports.srcWalkIn'),   color: '#fb7185' },
      { key: 'Other',        label: t('common.other'),        color: '#a78bfa' },
    ];
    const withSource = membersList.filter(m => m.howHeard);
    const srcCounts = Object.fromEntries(SOURCES.map(s => [s.key, 0]));
    withSource.forEach(m => { if (srcCounts[m.howHeard] !== undefined) srcCounts[m.howHeard]++; });
    const srcTotal = withSource.length || 1;

    const chip = (label, active, onClick) => (
      <button key={label} onClick={onClick} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', color: active ? 'var(--accent-gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans', WebkitTapHighlightColor: 'transparent' }}>
        {label}
      </button>
    );

    return (
      <div style={{ minHeight: '100%', paddingBottom: 16 }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('nav.accounting')}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
              {mainTab === 'overview' ? t(PERIOD_KEYS[period]) : mainTab === 'paystubs' ? payMonthText(fmtMonth(paystubMonth)) : t('reports.marketingInsights')}
            </p>
          </div>
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px', marginBottom: 14 }}>
          {mainTabs.map(([key, label]) => (
            <button key={key} onClick={() => setMainTab(key)} style={{ flexShrink: 0, padding: '10px 16px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${mainTab === key ? 'var(--accent-gold)' : 'transparent'}`, color: mainTab === key ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'DM Sans', fontWeight: mainTab === key ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {mainTab === 'overview' && (
          <div>
            {pendingPanel && <div style={{ padding: '0 16px 12px' }}>{pendingPanel}</div>}
            {/* Period chips */}
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {PERIOD_OPTIONS.map(p => chip(t(PERIOD_KEYS[p]), period === p, () => setPeriod(p)))}
            </div>

            {/* KPI 2x2 */}
            <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {summaryCards.map(({ label, value, color, sub }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                  {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3, lineHeight: 1.35 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Financial Health chart */}
            <div style={{ margin: '0 16px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 14px 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', marginBottom: 10 }}>{t('reports.financialHealth')}</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip formatter={(v, n) => [formatMoney(v), n]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} />
                    <Bar dataKey="revenue" name={t('reports.revenue')} fill="#c9a96e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name={t('reports.expenses')} fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="net" name={t('reports.net')} fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div style={{ margin: '0 16px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', marginBottom: 12 }}>{t('reports.revenueBreakdown')}</div>
              {paymentCategoryBreakdown.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>{t('reports.noPeriodData')}</div>
                : paymentCategoryBreakdown.map(r => (
                  <div key={r.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{formatMoney(r.amount)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.pct}%</div>
                  </div>
                ))
              }
            </div>

            {/* Expenses Breakdown */}
            <div style={{ margin: '0 16px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', marginBottom: 12 }}>{t('reports.expensesBreakdown')}</div>
              {loading ? <SkeletonCards count={3} height={44} /> : expenseCategoryBreakdown.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>{t('reports.noExpenseData')}</div>
                : expenseCategoryBreakdown.map(r => (
                  <div key={r.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{formatMoney(r.amount)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.pct}%</div>
                  </div>
                ))
              }
            </div>

            {/* Expense sub-tabs */}
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {tabs.map(t => chip(
                t === 'Front Desk Expenses' && pendingCount > 0 ? `${tabLabels[t]} (${pendingCount})` : tabLabels[t],
                activeTab === t,
                () => setActiveTab(t)
              ))}
            </div>

            {/* Category filter (non-FD tabs) */}
            {activeTab !== 'Front Desk Expenses' && (
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {['All Categories', ...categoriesIn(expenses)].map(c =>
                  chip(c === 'All Categories' ? t('reports.allCategories') : expenseCategoryName(c, t), categoryFilter === c, () => setCategoryFilter(c))
                )}
              </div>
            )}

            {/* FD status filter */}
            {activeTab === 'Front Desk Expenses' && (
              <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {['all', 'pending', 'approved'].map(f =>
                  chip(f === 'all' ? t('common.all') : f === 'approved' ? t('reports.reviewed') : t('reports.awaitingReview'), fdStatusFilter === f, () => setFdStatusFilter(f))
                )}
              </div>
            )}

            {/* Expenses list */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tabExpenses.length === 0
                ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('reports.noExpenses')}</div>
                : tabExpenses.map(exp => {
                  const catColor = EXPENSE_CATS[exp.category] || '#9ca3af';
                  return (
                    <div key={exp.id + '_' + exp._source} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${catColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', flex: 1, marginRight: 8 }}>{exp.title}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>-{formatMoney(exp.amount)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: exp._source === 'operations' ? 8 : 0 }}>
                        <span style={{ fontSize: 10, background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: 4, padding: '2px 6px', fontFamily: 'DM Sans' }}>{expenseCategoryName(exp.category, t)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{String(exp.date || '').slice(0, 10)}</span>
                        {exp.status && <StatusPill status={exp.status} label={exp.status === 'approved' ? t('reports.reviewed') : t('reports.awaitingReview')} />}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => openView(exp) },
                          { label: approvingId === exp.id ? t('common.loading') : t('reports.markReviewed'), icon: <CheckCircle size={15} />,
                            onClick: () => { if (approvingId !== exp.id) reviewExpense(exp.id); },
                            hidden: !(exp._source !== 'operations' && exp.status === 'pending' && canApproveExpenses) },
                        ]} />
                      </div>
                      {reviewError?.id === exp.id && <div role="alert" style={{ marginTop: 6, fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.4 }}>{reviewError.text}</div>}
                    </div>
                  );
                })
              }
            </div>

            <FAB onClick={openAdd} label={t('reports.addExpense')} />
          </div>
        )}

        {/* ── PAYSTUBS ── */}
        {mainTab === 'paystubs' && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Month picker */}
            <input type="month" value={paystubMonth} onChange={e => setPaystubMonth(e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' }} />
            {otherMonthsNotice}

            {/* KPI 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: t('reports.totalPayroll'), value: formatMoney(totalPayroll), color: 'var(--accent-blue)' },
                { label: t('reports.staffCount'), value: String(monthPaystubs.length), color: 'var(--accent-gold)' },
                { label: t('reports.paidLabel'), value: formatMoney(paidPayroll), color: 'var(--accent-green)' },
                { label: t('reports.outstanding'), value: formatMoney(outstandingPayroll), color: 'var(--accent-yellow)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Paystub cards */}
            {monthPaystubs.length === 0
              ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('reports.noPaystubs')}</div>
              : monthPaystubs.map(p => (
                <div key={p.id} onClick={() => setViewingPaystub(p)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 14px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{p.staffName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{roleName(p.role, t)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(p.grossPay)}</div>
                      {p.netPay !== p.grossPay && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginBottom: 3 }}>{t('staff.handOverShort', { amount: formatMoney(p.netPay) })}</div>}
                      <StatusPill status={p.status} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('reports.basicLabel')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(p.basicPay)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('reports.allowances')}</div>
                      <div style={{ fontSize: 12, color: 'var(--accent-green)', fontFamily: 'JetBrains Mono, monospace' }}>+{formatMoney(p.allowances)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('reports.deductions')}</div>
                      <div style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'JetBrains Mono, monospace' }}>-{formatMoney(p.deductions)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <RowMenu title={t('common.actions')} items={[
                      { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => setViewingPaystub(p) },
                      { label: t('reports.editPay'), icon: <Pencil size={15} />, onClick: () => openEditPaystub(p), hidden: !canEditPayroll },
                      { label: t('reports.markPaid'), icon: <CheckCircle size={15} />, onClick: () => requestMarkPaid(p.id), hidden: !canEditPayroll || p.status === 'paid' },
                    ]} />
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── MARKETING ── */}
        {mainTab === 'marketing' && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* KPI 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: t('reports.totalMembers'), value: String(membersList.length), color: 'var(--accent-gold)' },
                { label: t('reports.sourceRecorded'), value: String(withSource.length), color: '#818cf8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Source breakdown */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', marginBottom: 4 }}>{t('reports.sourceBreakdown')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 14 }}>{t('reports.basedOnMembers', { count: withSource.length })}</div>
              {SOURCES.map(s => {
                const count = srcCounts[s.key];
                const pct = withSource.length > 0 ? Math.round(count / srcTotal * 100) : 0;
                return (
                  <div key={s.key} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.color, fontFamily: 'DM Sans' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sharedDialogs}
      </div>
    );
  }

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('reports.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {mainTab === 'overview' ? `${t('reports.financialOverview')} : ${t(PERIOD_KEYS[period])}` : mainTab === 'paystubs' ? t('reports.payroll') : t('reports.marketingInsights')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mainTab === 'overview' && (
            <select value={period} onChange={e => setPeriod(e.target.value)} style={toolbarControl}>
              {PERIOD_OPTIONS.map(o => <option key={o} value={o} style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}>{t(PERIOD_KEYS[o])}</option>)}
            </select>
          )}
          {mainTab === 'paystubs' && (
            <input type="month" value={paystubMonth} onChange={e => setPaystubMonth(e.target.value)} style={toolbarControl} />
          )}
          {mainTab !== 'marketing' && <button style={secondaryBtn} onClick={mainTab === 'overview' ? handleExportOverview : handleExportPaystubs}><Download size={13} />{t('reports.exportPdf')}</button>}
          {mainTab !== 'marketing' && <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('reports.addExpense')}</button>}
        </div>
      </div>

      {/* Main tab nav */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        {mainTabs.map(([key, label]) => (
          <button key={key} onClick={() => setMainTab(key)} style={{ background: 'none', border: 'none', borderBottom: mainTab === key ? '2px solid #c9a96e' : '2px solid transparent', color: mainTab === key ? '#c9a96e' : 'var(--text-muted)', fontSize: 14, fontWeight: mainTab === key ? 600 : 400, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'overview' && (
        <>
          {pendingPanel}
          {/* Summary cards */}
          <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {summaryCards.map(c => (
              <div key={c.label} style={{ ...cardStyle, padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: c.color, filter: 'blur(40px)', opacity: 0.12 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: c.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={16} color={c.color} />
                  </div>
                </div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4 }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Financial Health chart */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('reports.financialHealthOverview')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{t(PERIOD_KEYS[period])}</span>
              </div>
            </div>
            <div style={{ padding: '20px 20px 12px 20px', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(value, name) => [formatMoney(value), name]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="revenue" name={t('reports.revenue')} fill="#c9a96e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name={t('reports.expenses')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name={t('reports.netIncome')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue breakdown */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('reports.revenueBreakdown')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(PERIOD_KEYS[period])}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loading ? <SkeletonCards count={3} height={44} /> : paymentCategoryBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>{t('reports.noPaymentData')}</div>
              ) : paymentCategoryBreakdown.map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(r.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.pct}{t('reports.ofTotalRevenue')}</div>
                </div>
              ))}
              {!loading && periodRev.shopMissing > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('sales.profitMissing', { n: periodRev.shopMissing })}</div>
              )}
            </div>
          </div>

          {/* Expenses breakdown */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('reports.expensesBreakdown')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(PERIOD_KEYS[period])}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loading ? <SkeletonCards count={3} height={44} /> : expenseCategoryBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>{t('reports.noExpenseData')}</div>
              ) : expenseCategoryBreakdown.map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(r.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.pct}{t('reports.ofTotalExpenses')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenditures table with tabs */}
          <div style={cardStyle}>
            <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 0 }}>
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #c9a96e' : '2px solid transparent', color: activeTab === tab ? '#c9a96e' : 'var(--text-muted)', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, padding: '14px 16px', cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: -1, transition: 'color 0.15s', whiteSpace: 'nowrap' }}>
                  {tabLabels[tab] || tab}
                  {tab === 'Front Desk Expenses' && pendingCount > 0 && (
                    <span style={{ marginLeft: 6, background: 'rgba(234,179,8,0.2)', color: '#eab308', fontSize: 10, padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>{pendingCount}</span>
                  )}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {activeTab === 'Front Desk Expenses' ? (
                <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                  {['all', 'pending', 'approved'].map(f => (
                    <button key={f} onClick={() => setFdStatusFilter(f)} style={{ background: fdStatusFilter === f ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', color: fdStatusFilter === f ? 'var(--accent-gold)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 20, fontSize: 11, padding: '4px 12px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: fdStatusFilter === f ? 600 : 400 }}>
                      {f === 'all' ? t('common.all') : f === 'approved' ? t('reports.reviewed') : t('reports.awaitingReview')}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <select style={{ ...inputStyle, width: 160, margin: '8px 0' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                  <option value="All Categories">{t('reports.allCategories')}</option>
                  {categoriesIn(expenses).map(c => <option key={c} value={c}>{expenseCategoryName(c, t)}</option>)}
                </select>
              )}
            </div>

            {activeTab !== 'Front Desk Expenses' && (
              <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('common.date'), t('common.title'), t('reports.category'), t('common.amount'), t('reports.paidTo'), t('reports.method'), t('common.actions')].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabExpenses.map(exp => (
                    <tr key={exp.id + '_' + exp._source} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{exp.date ? String(exp.date).slice(0, 10) : '-'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{exp.title}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>{expenseCategoryName(exp.category, t)}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>{formatMoney(Number(exp.amount))}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{exp.paidTo || exp.submittedBy || '-'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{methodName(exp.method || exp.paymentMethod)}</td>
                      <td style={{ padding: '12px 20px' }}>
                        {/* Everything in All/Operations is already in the books -
                            reviewing happens on the Front Desk Expenses tab, so
                            here it is view-only. */}
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => openView(exp) },
                        ]} />
                      </td>
                    </tr>
                  ))}
                  {tabExpenses.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('reports.noExpenses')}</td></tr>
                  )}
                </tbody>
              </table></div>
            )}

            {activeTab === 'Front Desk Expenses' && (
              <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('common.date'), t('common.description'), t('reports.category'), t('common.amount'), t('reports.submittedBy'), t('common.status'), t('common.actions')].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFdExpenses.map(exp => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{exp.date ? String(exp.date).slice(0, 10) : '-'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {exp.description}
                        {reviewError?.id === exp.id && <div role="alert" style={{ marginTop: 4, fontWeight: 400, fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.4 }}>{reviewError.text}</div>}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>{exp.category || '-'}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>{formatMoney(Number(exp.amount))}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{exp.submittedBy || '-'}</td>
                      <td style={{ padding: '12px 20px' }}><StatusPill status={exp.status} label={exp.status === 'approved' ? t('reports.reviewed') : t('reports.awaitingReview')} /></td>
                      <td style={{ padding: '12px 20px' }}>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => openView(exp) },
                          { label: approvingId === exp.id ? t('common.loading') : t('reports.markReviewed'), icon: <CheckCircle size={15} />,
                            onClick: () => { if (approvingId !== exp.id) reviewExpense(exp.id); },
                            hidden: !(exp.status === 'pending' && canApproveExpenses) },
                        ]} />
                      </td>
                    </tr>
                  ))}
                  {filteredFdExpenses.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('reports.noExpensesFilter')}</td></tr>
                  )}
                </tbody>
              </table></div>
            )}

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reports.totalExpensesLabel')} ({activeTab}):</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(tabTotal)}</span>
            </div>
          </div>
        </>
      )}

      {mainTab === 'paystubs' && (
        <div>

          {/* Payroll summary cards */}
          <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: t('reports.totalPayroll'), value: formatMoney(totalPayroll), color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)', icon: Banknote },
              { label: t('reports.staffCount'), value: String(monthPaystubs.length), color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', icon: FileText },
              { label: t('reports.paidLabel'), value: formatMoney(paidPayroll), color: 'var(--accent-green)', dim: 'var(--accent-green-dim)', icon: TrendingUp },
              { label: t('reports.outstanding'), value: formatMoney(outstandingPayroll), color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)', icon: AlertCircle },
            ].map(c => (
              <div key={c.label} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.icon size={18} color={c.color} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {otherMonthsNotice && <div style={{ marginBottom: 16 }}>{otherMonthsNotice}</div>}

          {/* Paystubs table */}
          <div style={cardStyle}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('reports.paystubsMonth')} : {payMonthText(fmtMonth(paystubMonth))}</span>
            </div>
            <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('common.name'), t('staff.role'), t('reports.basicPay'), t('reports.allowances'), t('reports.deductions'), t('reports.netPay'), t('common.status'), t('common.actions')].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthPaystubs.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => setViewingPaystub(p)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.staffName}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{roleName(p.role, t)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{formatMoney(p.basicPay)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-green)' }}>+{formatMoney(p.allowances)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-red)' }}>-{formatMoney(p.deductions)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(p.netPay)}</td>
                      <td style={{ padding: '12px 20px' }}><StatusPill status={p.status} /></td>
                      <td style={{ padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('reports.view'), icon: <Eye size={15} />, onClick: () => setViewingPaystub(p) },
                          { label: t('reports.editPay'), icon: <Pencil size={15} />, onClick: () => openEditPaystub(p), hidden: !canEditPayroll },
                          { label: t('reports.markPaid'), icon: <CheckCircle size={15} />, onClick: () => requestMarkPaid(p.id), hidden: !canEditPayroll || p.status === 'paid' },
                        ]} />
                      </td>
                    </tr>
                  ))}
                  {monthPaystubs.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('reports.noPaystubs')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Settlement summary: how much of this month's payroll has left the business */}
            {monthPaystubs.length > 0 && (() => {
              const pct = totalPayroll > 0 ? Math.round((paidPayroll / totalPayroll) * 100) : 0;
              const settled = outstandingPayroll <= 0;
              return (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {t('reports.totalPayrollLabel')} · {payMonthText(fmtMonth(paystubMonth))}
                      </div>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                        {formatMoney(totalPayroll)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 28 }}>
                      {[
                        { label: t('reports.paidLabel'), value: paidPayroll, color: 'var(--accent-green)' },
                        { label: t('reports.outstanding'), value: outstandingPayroll, color: settled ? 'var(--text-muted)' : 'var(--accent-yellow)' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</span>
                          </div>
                          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
                            {formatMoney(s.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', borderRadius: 999,
                        background: settled
                          ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                          : 'linear-gradient(90deg, #c9a96e, #b08d4a)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7 }}>
                      {settled
                        ? (monthPaystubs.length === 1 ? t('reports.settledAllOne') : t('reports.settledAll', { n: monthPaystubs.length }))
                        : t('reports.settledPart', { pct, n: monthPaystubs.filter(p => p.status !== 'paid').length })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Marketing Tab ── */}
      {mainTab === 'marketing' && (() => {
        const SOURCES = [
          { key: 'Social Media', label: t('members.howHeardSocialMedia'), color: '#818cf8' },
          { key: 'Friend',       label: t('members.howHeardFriend'),      color: '#34d399' },
          { key: 'Google',       label: t('members.howHeardGoogle'),      color: '#60a5fa' },
          { key: 'Flyer',        label: t('members.howHeardFlyer'),       color: '#f59e0b' },
          { key: 'Walk-in',      label: t('members.howHeardWalkIn'),      color: '#fb7185' },
          { key: 'Other',        label: t('common.other'),                color: '#a78bfa' },
        ];
        const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, all: null };
        const RANGE_OPTS = [
          { key: '7d', label: t('reports.last7Days') },
          { key: '30d', label: t('reports.last30Days') },
          { key: '90d', label: t('reports.last90Days') },
          { key: '365d', label: t('reports.lastYear') },
          { key: 'all', label: t('reports.allTime') },
        ];
        const days = RANGE_DAYS[marketingRange];
        const cutoff = days == null ? null : Date.now() - days * 86400000;
        const inRange = (m) => {
          if (cutoff == null) return true;
          const raw = m.createdAt || m.startDate;
          const ts = raw ? new Date(raw).getTime() : NaN;
          return Number.isNaN(ts) ? false : ts >= cutoff;
        };
        const scopedMembers = membersList.filter(inRange);

        const withSource = scopedMembers.filter(m => m.howHeard);
        const total = scopedMembers.length;
        const withSourceCount = withSource.length;
        const counts = Object.fromEntries(SOURCES.map(s => [s.key, 0]));
        withSource.forEach(m => { if (counts[m.howHeard] !== undefined) counts[m.howHeard]++; });
        const sorted = [...SOURCES].sort((a, b) => counts[b.key] - counts[a.key]);
        const detailMembers = scopedMembers.filter(m => m.howHeard || m.notes);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Time range filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('reports.showMembersWhoJoined')}</span>
              {RANGE_OPTS.map(o => {
                const active = marketingRange === o.key;
                return (
                  <button key={o.key} onClick={() => setMarketingRange(o.key)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
                    background: active ? 'var(--accent-gold)' : 'var(--bg-elevated)',
                    color: active ? '#0a0a0f' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
                  }}>{o.label}</button>
                );
              })}
            </div>
            {/* Summary cards */}
            <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: t('reports.totalMembers'), value: total, color: 'var(--accent-gold)', dim: 'rgba(201,169,110,0.12)', icon: FileText },
                { label: t('reports.sourceRecorded'), value: withSourceCount, color: '#818cf8', dim: 'rgba(129,140,248,0.12)', icon: BarChart2 },
                { label: t('reports.topSource'), value: sorted[0] && counts[sorted[0].key] > 0 ? sorted[0].label.split(' ')[0] : '-', color: sorted[0] ? sorted[0].color : 'var(--text-muted)', dim: sorted[0] ? `${sorted[0].color}1a` : 'var(--bg-elevated)', icon: TrendingUp },
              ].map(c => (
                <div key={c.label} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: c.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={18} color={c.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: 'Manrope' }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Breakdown bars */}
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('reports.sourceBreakdown')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {t('reports.basedOnMembers', { count: withSourceCount })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sorted.map(src => {
                  const count = counts[src.key];
                  const pct = withSourceCount > 0 ? Math.round((count / withSourceCount) * 100) : 0;
                  return (
                    <div key={src.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: src.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{src.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('reports.memberCount', { count })}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? src.color : 'var(--text-muted)', fontFamily: 'Manrope', minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: src.color, borderRadius: 99, transition: 'width 0.5s ease', opacity: count === 0 ? 0.15 : 1 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual member table */}
            <div style={cardStyle}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('reports.memberDetails')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('reports.memberDetailsDesc')}</div>
              </div>
              <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('members.member'), t('reports.source'), t('common.notes')].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('reports.noMarketingData')}
                      </td>
                    </tr>
                  ) : detailMembers.map(m => {
                    const src = SOURCES.find(s => s.key === m.howHeard);
                    return (
                      <tr key={m.id}>
                        <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{m.memberCode}</div>
                        </td>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                          {src ? (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${src.color}1a`, color: src.color }}>
                              {m.howHeard}
                            </span>
                          ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', maxWidth: 340 }}>
                          {m.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          </div>
        );
      })()}

      {sharedDialogs}
    </div>
  );
}
