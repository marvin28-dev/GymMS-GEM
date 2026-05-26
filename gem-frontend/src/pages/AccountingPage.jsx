import { useState, useEffect } from 'react';
import { Plus, Download, TrendingUp, TrendingDown, AlertCircle, Banknote, Pencil, Trash2, FileText, ChevronDown, Eye, BarChart2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import { getAll as getExpenses, create as createExpense, update as updateExpense, remove as removeExpense } from '../services/expenses.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getPayments } from '../services/payments.service';
import { getAll as getMembers } from '../services/members.service';

const formatMoney = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;
const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const emptyForm = { title: '', category: 'Utilities', amount: '', date: '', paidTo: '', method: 'Cash', reference: '', recordedBy: '', notes: '' };

function getPeriodDateRanges() {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
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

const getRevenueCategory = (description) => {
  const d = (description || '').toLowerCase();
  if (d.includes('personal training') || d.includes('coaching') || d.includes('pt session')) return 'Personal Training';
  if (d.includes('protein') || d.includes('shake') || d.includes('supplement') || d.includes('merchandise') || d.includes('product')) return 'Product Sales';
  if (d.includes('renewal') || d.includes('package') || d.includes('monthly') || d.includes('membership') || d.includes('basic') || d.includes('standard') || d.includes('premium') || d.includes('visitor')) return 'Memberships';
  return 'Other';
};

function buildChartData(paymentsList, expenses, monthsBack) {
  const now = new Date();
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    const prefix = d.toISOString().slice(0, 7); // 'YYYY-MM'
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const revenue = paymentsList.filter(p => (p.createdAt || '').slice(0, 7) === prefix).reduce((s, p) => s + (p.amount || 0), 0);
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

const formatYAxis = (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v.toLocaleString();

const PAY_RATES = { general_manager: 450000, manager: 350000, accountant: 280000, trainer: 200000, instructor: 180000, coach: 180000, front_desk: 150000, Other: 120000 };

function generateLastNMonths(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  });
}
const PAYSTUB_MONTHS = generateLastNMonths(6);

// converts 'YYYY-MM' → 'Mar 2026' for matching paystub records
const fmtMonth = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

function buildPaystubs(staffArr) {
  return staffArr.map(s => {
    const basic = s.salary || PAY_RATES[s.role] || PAY_RATES.Other;
    return PAYSTUB_MONTHS.map((month, i) => ({
      id: `${s.id}-${i}`,
      staffId: s.id,
      staffName: staffName(s),
      role: s.role || 'Other',
      month,
      basicPay: basic,
      allowances: 0,
      deductions: 0,
      netPay: basic,
      status: i === 0 ? 'issued' : 'paid',
    }));
  }).flat();
}

const PAYSTUB_PAID_KEY = 'gem_paystub_paid';
function loadPaidIds() {
  try { return new Set(JSON.parse(localStorage.getItem(PAYSTUB_PAID_KEY) || '[]')); } catch { return new Set(); }
}
function savePaidIds(ids) {
  try { localStorage.setItem(PAYSTUB_PAID_KEY, JSON.stringify([...ids])); } catch {}
}

const PAYSTUB_EXPENSE_MAP_KEY = 'gem_paystub_expense_map';
function loadPaystubExpenseMap() {
  try { return JSON.parse(localStorage.getItem(PAYSTUB_EXPENSE_MAP_KEY) || '{}'); } catch { return {}; }
}
function savePaystubExpenseMap(map) {
  try { localStorage.setItem(PAYSTUB_EXPENSE_MAP_KEY, JSON.stringify(map)); } catch {}
}

function loadFrontDeskExpenses() {
  try {
    const raw = localStorage.getItem('gem_expenses');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveFrontDeskExpenses(list) {
  try { localStorage.setItem('gem_expenses', JSON.stringify(list)); } catch { /* ignore */ }
}

const StatusPill = ({ status }) => {
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
    <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>
      {status || 'pending'}
    </span>
  );
};

export default function AccountingPage() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [period, setPeriod] = useState('This Month');
  const [activeTab, setActiveTab] = useState('All Expenses');
  const [fdStatusFilter, setFdStatusFilter] = useState('pending');
  const [frontDeskExpenses, setFrontDeskExpenses] = useState(loadFrontDeskExpenses);
  const [mainTab, setMainTab] = useState('overview');
  const [paystubs, setPaystubs] = useState([]);
  const [paystubMonth, setPaystubMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showPaystubModal, setShowPaystubModal] = useState(false);
  const [editingPaystub, setEditingPaystub] = useState(null);
  const [payForm, setPayForm] = useState({});
  const [paystubDeductionLines, setPaystubDeductionLines] = useState({});
  const [newDedLine, setNewDedLine] = useState({ label: '', amount: '', note: '' });
  const [showAddDedLine, setShowAddDedLine] = useState(false);
  const [expenseImagePreview, setExpenseImagePreview] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [showPaystubAuthModal, setShowPaystubAuthModal] = useState(false);
  const [showExpenseAuthModal, setShowExpenseAuthModal] = useState(false);
  const [pendingExpenseSave, setPendingExpenseSave] = useState(null);
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);

  const getReceiptKey = (id) => `gem_expense_receipt_${id}`;
  const loadReceipt = (id) => { try { return localStorage.getItem(getReceiptKey(id)) || null; } catch { return null; } };
  const saveReceipt = (id, dataUrl) => { try { if (dataUrl) localStorage.setItem(getReceiptKey(id), dataUrl); else localStorage.removeItem(getReceiptKey(id)); } catch {} };

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setFrontDeskExpenses(loadFrontDeskExpenses()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    setFrontDeskExpenses(loadFrontDeskExpenses());
    Promise.all([getExpenses(), getStaff(), getPayments(), getMembers()])
      .then(([eRes, sRes, pRes, mRes]) => {
        setExpenses(eRes.data || []);
        setMembersList(mRes.data || []);
        const loaded = sRes.data || [];
        setStaffList(loaded);
        setPaymentsList(pRes.data || []);
        const paidIds = loadPaidIds();
        const stubs = buildPaystubs(loaded).map(p => paidIds.has(p.id) ? { ...p, status: 'paid' } : p);
        setPaystubs(stubs);
        const initDed = {};
        stubs.forEach(p => {
          initDed[p.id] = [
            { id: 1, label: 'Health Insurance', amount: 10000, note: 'Monthly premium deduction' },
            { id: 2, label: 'Pension Fund', amount: 5000, note: 'Pension contribution' },
          ];
        });
        setPaystubDeductionLines(initDed);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const chartData = buildChartData(paymentsList, expenses, PERIOD_MONTHS_BACK[period] || 1).map(d => ({ ...d, net: d.revenue - d.expenses }));

  const periodRange = PERIOD_DATE_RANGES[period] || PERIOD_DATE_RANGES['This Month'];

  const periodRevenue = paymentsList.filter(p => {
    const d = (p.createdAt || '').slice(0, 10);
    return d >= periodRange.from && d <= periodRange.to;
  }).reduce((s, p) => s + (p.amount || 0), 0);

  const periodExpensesAmt = expenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  }).reduce((s, e) => s + Number(e.amount || 0), 0);

  const periodNet = periodRevenue - periodExpensesAmt;
  const periodOutstanding = paymentsList.filter(p => p.status === 'Pending').reduce((s, p) => s + (p.amount || 0), 0);
  const periodFilteredExpenses = expenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  });
  const periodFilteredFdExpenses = frontDeskExpenses.filter(e => {
    const d = e.date ? String(e.date).slice(0, 10) : '';
    return d >= periodRange.from && d <= periodRange.to;
  });

  const paymentCategoryBreakdown = (() => {
    const filtered = paymentsList.filter(p => { const d = (p.createdAt || '').slice(0, 10); return d >= periodRange.from && d <= periodRange.to; });
    const totals = { Memberships: 0, 'Personal Training': 0, 'Product Sales': 0, Other: 0 };
    filtered.forEach(p => { totals[getRevenueCategory(p.description)] += p.amount; });
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
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
  const openView = (exp) => setViewingExpense({ ...exp, receipt: loadReceipt(exp.id) });

  const validate = () => {
    const e = {};
    if (!form.title) e.title = 'Required';
    if (!form.amount) e.amount = 'Required';
    if (!form.date) e.date = 'Required';
    return e;
  };

  const commitExpenseSave = async (another = false) => {
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
      setErrors({ _api: err.response?.data?.error || 'Failed to save expense. Please try again.' });
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

  const handleFrontDeskAction = (id, action) => {
    const updated = frontDeskExpenses.map(e => e.id === id ? { ...e, status: action } : e);
    setFrontDeskExpenses(updated);
    saveFrontDeskExpenses(updated);
  };

  const allExpenses = [
    ...periodFilteredExpenses.map(e => ({ ...e, _source: 'operations' })),
    ...periodFilteredFdExpenses.map(e => ({ ...e, title: e.description, _source: 'frontdesk' })),
  ];
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
    { label: 'Total Revenue', value: formatMoney(periodRevenue), icon: TrendingUp, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
    { label: 'Total Expenditures', value: formatMoney(periodExpensesAmt), icon: TrendingDown, color: 'var(--accent-red)', dim: 'var(--accent-red-dim)' },
    { label: 'Net Income', value: formatMoney(periodNet), icon: Banknote, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
    { label: 'Outstanding', value: formatMoney(periodOutstanding), icon: AlertCircle, color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
  ];

  const tabs = ['All Expenses', 'Operations Expenses', 'Front Desk Expenses'];
  const tabLabels = { 'All Expenses': t('reports.allExpenses'), 'Operations Expenses': t('reports.operationsExpenses'), 'Front Desk Expenses': t('reports.frontDeskExpenses') };

  const monthPaystubs = paystubs.filter(p => p.month === fmtMonth(paystubMonth));
  const totalPayroll = monthPaystubs.reduce((s, p) => s + p.netPay, 0);

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
    setPaystubs(prev => prev.map(p =>
      p.id === editingPaystub.id
        ? { ...p, allowances, deductions: totalDed, netPay: newNet }
        : p
    ));
    if (editingPaystub.status === 'paid') {
      const map = loadPaystubExpenseMap();
      const expenseId = map[editingPaystub.id];
      if (expenseId) {
        try {
          const res = await updateExpense(expenseId, {
            title: `Salary — ${editingPaystub.staffName}`,
            category: 'Salaries',
            amount: newNet,
            date: new Date().toISOString().slice(0, 10),
            paidTo: editingPaystub.staffName,
            method: 'cash',
            note: `Paystub for ${editingPaystub.month}`,
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

  const markPaid = async (id) => {
    const stub = paystubs.find(p => p.id === id);
    if (!stub) return;
    setPaystubs(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' } : p));
    const paidIds = loadPaidIds();
    paidIds.add(id);
    savePaidIds(paidIds);
    try {
      const lines = paystubDeductionLines[id] || [];
      const totalDed = lines.reduce((s, d) => s + d.amount, 0);
      const net = stub.netPay || (stub.basicPay + (stub.allowances || 0) - totalDed);
      const res = await createExpense({
        title: `Salary — ${stub.staffName}`,
        category: 'Salaries',
        amount: net,
        date: new Date().toISOString().slice(0, 10),
        paidTo: stub.staffName,
        method: 'cash',
        note: `Paystub for ${stub.month}`,
        recordedBy: '',
      });
      const map = loadPaystubExpenseMap();
      map[id] = res.data.id;
      savePaystubExpenseMap(map);
      setExpenses(prev => [res.data, ...prev]);
    } catch (err) {
      console.error('Failed to auto-create salary expense:', err);
    }
  };

  const markUnpaid = async (id) => {
    setPaystubs(prev => prev.map(p => p.id === id ? { ...p, status: 'issued' } : p));
    const paidIds = loadPaidIds();
    paidIds.delete(id);
    savePaidIds(paidIds);
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
    const cats = ['Utilities', 'Rent', 'Maintenance', 'Salaries', 'Supplies', 'Other'];
    const rows = cats.map(cat => ({ label: cat, amount: periodFilteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0) })).filter(r => r.amount > 0);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? Math.round((r.amount / total) * 100) : 0 }));
  })();

  const handleExportOverview = () => {
    const win = window.open('', '_blank', 'width=820,height=1000');
    win.document.write(`<html><head><title>Financial Overview — ${period}</title><style>
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
    <h1>GEM Fitness — Financial Overview</h1>
    <div class="sub">Period: <strong>${period}</strong> &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    <div class="cards">
      <div class="card"><div class="card-label">Total Revenue</div><div class="card-value" style="color:#2563eb">${formatMoney(periodRevenue)}</div></div>
      <div class="card"><div class="card-label">Total Expenditures</div><div class="card-value" style="color:#ef4444">${formatMoney(periodExpensesAmt)}</div></div>
      <div class="card"><div class="card-label">Net Income</div><div class="card-value" style="color:#16a34a">${formatMoney(periodNet)}</div></div>
      <div class="card"><div class="card-label">Outstanding</div><div class="card-value" style="color:#ca8a04">${formatMoney(periodOutstanding)}</div></div>
    </div>
    <h2>Revenue Breakdown</h2>
    ${paymentCategoryBreakdown.length === 0 ? '<p style="color:#999">No payment data for this period.</p>' : paymentCategoryBreakdown.map(r => `
      <div class="row">
        <div class="row-header"><span>${r.label}</span><span><strong>${formatMoney(r.amount)}</strong></span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${r.pct}%;background:#c9a96e"></div></div>
        <div class="pct">${r.pct}% of total revenue</div>
      </div>`).join('')}
    <h2>Expenses Breakdown</h2>
    ${expenseCategoryBreakdown.length === 0 ? '<p style="color:#999">No expense data for this period.</p>' : expenseCategoryBreakdown.map(r => `
      <div class="row">
        <div class="row-header"><span>${r.label}</span><span><strong>${formatMoney(r.amount)}</strong></span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${r.pct}%;background:#ef4444"></div></div>
        <div class="pct">${r.pct}% of total expenses</div>
      </div>`).join('')}
    <div class="footer">GEM Fitness Management System</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportPaystubs = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<html><head><title>Payroll — ${fmtMonth(paystubMonth)}</title><style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
      h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #ddd}
      td{padding:9px 12px;border-bottom:1px solid #eee}
      .total td{font-weight:700;background:#fafafa;border-top:2px solid #ddd}
      .footer{margin-top:32px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px}
    </style></head><body>
    <h1>GEM Fitness — Payroll</h1>
    <div class="sub">Month: <strong>${paystubMonth}</strong> &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    <table>
      <thead><tr><th>Staff</th><th>Role</th><th>Basic Pay</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
      <tbody>
        ${monthPaystubs.map(p => `<tr>
          <td><strong>${p.staffName}</strong></td><td>${p.role}</td>
          <td>${formatMoney(p.basicPay)}</td>
          <td style="color:green">+${formatMoney(p.allowances)}</td>
          <td style="color:red">-${formatMoney(p.deductions)}</td>
          <td><strong>${formatMoney(p.netPay)}</strong></td>
          <td style="text-transform:capitalize">${p.status}</td>
        </tr>`).join('')}
        <tr class="total">
          <td colspan="5" style="text-align:right;padding-right:12px">Total Payroll</td>
          <td colspan="2">${formatMoney(totalPayroll)}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">GEM Fitness Management System</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('reports.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {mainTab === 'overview' ? `${t('reports.financialOverview')} — ${period}` : mainTab === 'paystubs' ? t('reports.payroll') : t('reports.marketingInsights')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mainTab === 'overview' && (
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...inputStyle, width: 160 }}>
              {PERIOD_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          )}
          {mainTab === 'paystubs' && (
            <input type="month" value={paystubMonth} onChange={e => setPaystubMonth(e.target.value)} style={{ ...inputStyle, width: 160 }} />
          )}
          {mainTab !== 'marketing' && <button style={secondaryBtn} onClick={mainTab === 'overview' ? handleExportOverview : handleExportPaystubs}><Download size={13} />{t('reports.exportPdf')}</button>}
          {mainTab !== 'marketing' && <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('reports.addExpense')}</button>}
        </div>
      </div>

      {/* Main tab nav */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        {[['overview', t('reports.overview')], ['paystubs', t('reports.paystubs')], ['marketing', t('reports.marketing')]].map(([key, label]) => (
          <button key={key} onClick={() => setMainTab(key)} style={{ background: 'none', border: 'none', borderBottom: mainTab === key ? '2px solid #c9a96e' : '2px solid transparent', color: mainTab === key ? '#c9a96e' : 'var(--text-muted)', fontSize: 14, fontWeight: mainTab === key ? 600 : 400, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'overview' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
              </div>
            ))}
          </div>

          {/* Financial Health chart */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Financial Health Overview</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{period}</span>
              </div>
            </div>
            <div style={{ padding: '20px 20px 12px 20px', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(value, name) => [formatMoney(value), name]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#c9a96e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue breakdown */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Revenue Breakdown</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{period}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {paymentCategoryBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No payment data for this period.</div>
              ) : paymentCategoryBreakdown.map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(r.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.pct}% of total revenue</div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses breakdown */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Expenses Breakdown</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{period}</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {expenseCategoryBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No expense data available.</div>
              ) : expenseCategoryBreakdown.map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(r.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{r.pct}% of total expenses</div>
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
                  {['all', 'pending', 'approved', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFdStatusFilter(f)} style={{ background: fdStatusFilter === f ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', color: fdStatusFilter === f ? 'var(--accent-gold)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 20, fontSize: 11, padding: '4px 12px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: fdStatusFilter === f ? 600 : 400, textTransform: 'capitalize' }}>
                      {f === 'all' ? 'All' : f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <select style={{ ...inputStyle, width: 160, margin: '8px 0' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                  <option value="All Categories">All Categories</option>
                  {['Utilities', 'Rent', 'Maintenance', 'Salaries', 'Supplies', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            {activeTab !== 'Front Desk Expenses' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Title', 'Category', 'Amount', 'Paid To', 'Method', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabExpenses.map(exp => (
                    <tr key={exp.id + '_' + exp._source} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{exp.date ? String(exp.date).slice(0, 10) : '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{exp.title}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>{exp.category}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>{formatMoney(Number(exp.amount))}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{exp.paidTo || exp.submittedBy || '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{exp.method || exp.paymentMethod || '—'}</td>
                      <td style={{ padding: '12px 20px' }}>
                        {exp._source === 'operations' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} title="View" onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => openView(exp)}><Eye size={14} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} title="Edit" onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => openEdit(exp)}><Pencil size={14} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} title="Delete" onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => { setDeleteExpense(exp); setShowDeleteAuthModal(true); }}><Trash2 size={14} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={{ ...primaryBtn, fontSize: 11, padding: '4px 10px', opacity: exp.status === 'approved' ? 0.5 : 1 }} disabled={exp.status === 'approved'} onClick={() => handleFrontDeskAction(exp.id, 'approved')}>Approve</button>
                            <button style={{ ...secondaryBtn, fontSize: 11, padding: '4px 10px', color: '#ef4444', borderColor: '#ef4444', opacity: exp.status === 'rejected' ? 0.5 : 1 }} disabled={exp.status === 'rejected'} onClick={() => handleFrontDeskAction(exp.id, 'rejected')}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tabExpenses.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No expenses found.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'Front Desk Expenses' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Category', 'Amount', 'Submitted By', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFdExpenses.map(exp => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{exp.date ? String(exp.date).slice(0, 10) : '—'}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{exp.description}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>{exp.category || '—'}</span>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>{formatMoney(Number(exp.amount))}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{exp.submittedBy || '—'}</td>
                      <td style={{ padding: '12px 20px' }}><StatusPill status={exp.status} /></td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ ...primaryBtn, fontSize: 11, padding: '4px 10px', opacity: exp.status === 'approved' ? 0.5 : 1 }} disabled={exp.status === 'approved'} onClick={() => handleFrontDeskAction(exp.id, 'approved')}>Approve</button>
                          <button style={{ ...secondaryBtn, fontSize: 11, padding: '4px 10px', color: '#ef4444', borderColor: '#ef4444', opacity: exp.status === 'rejected' ? 0.5 : 1 }} disabled={exp.status === 'rejected'} onClick={() => handleFrontDeskAction(exp.id, 'rejected')}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFdExpenses.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No expenses match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total ({activeTab}):</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(tabTotal)}</span>
            </div>
          </div>
        </>
      )}

      {mainTab === 'paystubs' && (
        <div>

          {/* Payroll summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: t('reports.totalPayroll'), value: formatMoney(totalPayroll), color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)', icon: Banknote },
              { label: t('reports.staffCount'), value: String(monthPaystubs.length), color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', icon: FileText },
              { label: t('reports.avgNetPay'), value: formatMoney(Math.round(totalPayroll / (monthPaystubs.length || 1))), color: 'var(--accent-green)', dim: 'var(--accent-green-dim)', icon: TrendingUp },
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

          {/* Paystubs table */}
          <div style={cardStyle}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Paystubs — {fmtMonth(paystubMonth)}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Staff', 'Role', 'Basic Pay', 'Allowances', 'Deductions', 'Net Pay', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthPaystubs.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.staffName}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.role}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{formatMoney(p.basicPay)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-green)' }}>+{formatMoney(p.allowances)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-red)' }}>-{formatMoney(p.deductions)}</td>
                      <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(p.netPay)}</td>
                      <td style={{ padding: '12px 20px' }}><StatusPill status={p.status} /></td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} title="Edit pay" onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => openEditPaystub(p)}><Pencil size={14} /></button>
                          {p.status !== 'paid' && (
                            <button style={{ ...primaryBtn, fontSize: 11, padding: '4px 10px' }} onClick={() => markPaid(p.id)}>Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {monthPaystubs.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No paystubs for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Payroll ({fmtMonth(paystubMonth)}):</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(totalPayroll)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Marketing Tab ── */}
      {mainTab === 'marketing' && (() => {
        const SOURCES = [
          { key: 'Social Media', label: 'Social Media (Facebook / Instagram)', color: '#818cf8' },
          { key: 'Friend',       label: 'Friend or Family Referral',            color: '#34d399' },
          { key: 'Google',       label: 'Google Search',                        color: '#60a5fa' },
          { key: 'Flyer',        label: 'Flyer / Poster',                       color: '#f59e0b' },
          { key: 'Walk-in',      label: 'Walk-in',                              color: '#fb7185' },
          { key: 'Other',        label: 'Other',                                color: '#a78bfa' },
        ];
        const withSource = membersList.filter(m => m.howHeard);
        const total = membersList.length;
        const withSourceCount = withSource.length;
        const counts = Object.fromEntries(SOURCES.map(s => [s.key, 0]));
        withSource.forEach(m => { if (counts[m.howHeard] !== undefined) counts[m.howHeard]++; });
        const sorted = [...SOURCES].sort((a, b) => counts[b.key] - counts[a.key]);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: t('reports.totalMembers'), value: total, color: 'var(--accent-gold)', dim: 'rgba(201,169,110,0.12)', icon: FileText },
                { label: t('reports.sourceRecorded'), value: withSourceCount, color: '#818cf8', dim: 'rgba(129,140,248,0.12)', icon: BarChart2 },
                { label: t('reports.topSource'), value: sorted[0] && counts[sorted[0].key] > 0 ? sorted[0].label.split(' ')[0] : '—', color: sorted[0] ? sorted[0].color : 'var(--text-muted)', dim: sorted[0] ? `${sorted[0].color}1a` : 'var(--bg-elevated)', icon: TrendingUp },
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
              <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Source Breakdown</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Based on {withSourceCount} member{withSourceCount !== 1 ? 's' : ''} with recorded source data
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
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{count} {count === 1 ? 'member' : 'members'}</span>
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
                <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Member Details</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Individual source and referral notes per member</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Member', 'Source', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {membersList.filter(m => m.howHeard || m.notes).length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        No marketing data recorded yet. Source data is collected when adding new members.
                      </td>
                    </tr>
                  ) : membersList.filter(m => m.howHeard || m.notes).map(m => {
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
                          ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', maxWidth: 340 }}>
                          {m.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Add / Edit Expense Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingExpense ? 'Edit Expense' : 'Add Expense'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Title *</label>
            <input style={{ ...inputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Electricity Bill" />
            {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['Utilities', 'Rent', 'Maintenance', 'Salaries', 'Supplies', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Amount *</label>
              <input type="number" style={{ ...inputStyle, borderColor: errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              {errors.amount && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.amount}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Date *</label>
              <input type="date" style={{ ...inputStyle, borderColor: errors.date ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              {errors.date && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.date}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Paid To</label>
              <input style={inputStyle} value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))} placeholder="Vendor name" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Payment Method</label>
              <select style={inputStyle} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {['Cash', 'Card', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Recorded By</label>
              <select style={inputStyle} value={form.recordedBy} onChange={e => setForm(f => ({ ...f, recordedBy: e.target.value }))}>
                <option value="">Select staff...</option>
                {staffList.map(s => <option key={s.id} value={staffName(s)}>{staffName(s)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Attach Receipt / Photo</label>
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
                <img src={expenseImagePreview} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: 130, borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'block' }} />
                <button onClick={() => setExpenseImagePreview(null)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
          </div>
          {errors._api && <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>⚠ {errors._api}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)}>Cancel</button>
            {!editingExpense && <button style={secondaryBtn} onClick={() => handleSave(true)}>Save & Add Another</button>}
            <button style={primaryBtn} onClick={() => handleSave(false)}>Save Expense</button>
          </div>
        </div>
      </Modal>

      {/* Expense Detail Modal */}
      {viewingExpense && (
        <Modal open={!!viewingExpense} onClose={() => setViewingExpense(null)} title="Expense Details" maxWidth={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Title', viewingExpense.title],
                ['Category', viewingExpense.category],
                ['Amount', formatMoney(Number(viewingExpense.amount))],
                ['Date', viewingExpense.date ? new Date(viewingExpense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                ['Paid To', viewingExpense.paidTo || '—'],
                ['Method', viewingExpense.method || '—'],
                ['Recorded By', viewingExpense.recordedBy || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
            {(viewingExpense.note || viewingExpense.notes) && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{viewingExpense.note || viewingExpense.notes}</div>
              </div>
            )}
            {viewingExpense.receipt && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Receipt / Photo</div>
                <img src={viewingExpense.receipt} alt="Receipt" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)', maxHeight: 300, objectFit: 'contain', background: 'var(--bg-elevated)' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button style={secondaryBtn} onClick={() => { setViewingExpense(null); openEdit(viewingExpense); }}><Pencil size={13} /> Edit</button>
              <button style={primaryBtn} onClick={() => {
                const exp = viewingExpense;
                const receipt = exp.receipt;
                const html = `<!DOCTYPE html><html><head><title>Expense — ${exp.title}</title><style>
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
                  <h1>Expense Record</h1>
                  <div class="sub">Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  <div class="grid">
                    <div class="field"><label>Title</label><span>${exp.title || '—'}</span></div>
                    <div class="field"><label>Category</label><span>${exp.category || '—'}</span></div>
                    <div class="field"><label>Amount</label><span style="color:#dc2626">${formatMoney(Number(exp.amount))}</span></div>
                    <div class="field"><label>Date</label><span>${exp.date ? new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
                    <div class="field"><label>Paid To</label><span>${exp.paidTo || '—'}</span></div>
                    <div class="field"><label>Payment Method</label><span>${exp.method || '—'}</span></div>
                    <div class="field"><label>Recorded By</label><span>${exp.recordedBy || '—'}</span></div>
                  </div>
                  ${(exp.note || exp.notes) ? `<div class="notes-box"><strong>Notes:</strong> ${exp.note || exp.notes}</div>` : ''}
                  ${receipt ? `<div><strong style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Receipt</strong><br/><img src="${receipt}" /></div>` : ''}
                  <div class="footer">GEM Gym Management · Expense ID: ${exp.id}</div>
                </body></html>`;
                const w = window.open('', '_blank', 'width=700,height=900');
                w.document.write(html);
                w.document.close();
                w.focus();
                setTimeout(() => w.print(), 400);
              }}><Download size={13} /> Download PDF</button>
            </div>
          </div>
        </Modal>
      )}

      {/* View / Edit Paystub Modal */}
      <Modal open={showPaystubModal} onClose={() => { setShowPaystubModal(false); setShowAddDedLine(false); }} title={`Paystub — ${editingPaystub?.staffName}`} maxWidth={560}>
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
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{editingPaystub.role} · {editingPaystub.month}</div>
                  </div>
                  <StatusPill status={editingPaystub.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Basic Pay</div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', opacity: 0.7 }}>{formatMoney(editingPaystub.basicPay)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Allowances</div>
                    <input type="number" value={payForm.allowances ?? editingPaystub.allowances} onChange={e => setPayForm(f => ({ ...f, allowances: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 14, fontWeight: 700 }} />
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Deductions</span>
                  <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddDedLine(v => !v)}>
                    <Plus size={11} />{showAddDedLine ? 'Cancel' : 'Add Deduction'}
                  </button>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  {lines.length === 0 && !showAddDedLine && (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No deductions for this period</div>
                  )}
                  {lines.map(d => (
                    <div key={d.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{d.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Note: {d.note}</div>
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
                        <input placeholder="Deduction label *" value={newDedLine.label} onChange={e => setNewDedLine(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                        <input placeholder="Amount *" type="number" value={newDedLine.amount} onChange={e => setNewDedLine(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <input placeholder="Reason / note (required) *" value={newDedLine.note} onChange={e => setNewDedLine(f => ({ ...f, note: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <button style={{ ...primaryBtn, padding: '5px 14px', fontSize: 11 }} onClick={() => {
                        if (!newDedLine.label || !newDedLine.amount || !newDedLine.note) return;
                        setPaystubDeductionLines(prev => ({
                          ...prev,
                          [editingPaystub.id]: [...(prev[editingPaystub.id] || []), { id: Date.now(), label: newDedLine.label, amount: Number(newDedLine.amount), note: newDedLine.note }],
                        }));
                        setNewDedLine({ label: '', amount: '', note: '' });
                        setShowAddDedLine(false);
                      }}>Save Deduction</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Net pay summary */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))', border: '1px solid var(--accent-gold-dim)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Calculated Net Pay</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(netPay)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>{formatMoney(basicPay + allowances)} gross</div>
                  <div>− {formatMoney(totalDed)} deductions</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingPaystub.status === 'paid' && (
                    <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }} onClick={() => { markUnpaid(editingPaystub.id); setShowPaystubModal(false); }}>Mark Unpaid</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={secondaryBtn} onClick={() => { setShowPaystubModal(false); setShowAddDedLine(false); }}>Cancel</button>
                  <button style={primaryBtn} onClick={handleSavePaystub}>Save Changes</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ManagerAuthModal
        open={showPaystubAuthModal}
        onClose={() => setShowPaystubAuthModal(false)}
        onConfirm={() => { setShowPaystubAuthModal(false); commitSavePaystub(); }}
        action={`edit paystub for ${editingPaystub?.staffName}`}
      />

      <ManagerAuthModal
        open={showExpenseAuthModal}
        onClose={() => setShowExpenseAuthModal(false)}
        onConfirm={() => { setShowExpenseAuthModal(false); commitExpenseSave(pendingExpenseSave); }}
        action={`edit expense "${editingExpense?.title}"`}
      />

      <ManagerAuthModal
        open={showDeleteAuthModal}
        onClose={() => { setShowDeleteAuthModal(false); setDeleteExpense(null); }}
        onConfirm={async () => {
          setShowDeleteAuthModal(false);
          try {
            await removeExpense(deleteExpense.id);
            setExpenses(prev => prev.filter(e => e.id !== deleteExpense.id));
          } catch (err) { console.error(err); }
          setDeleteExpense(null);
        }}
        action={`delete expense "${deleteExpense?.title}"`}
        danger
      />
    </div>
  );
}
