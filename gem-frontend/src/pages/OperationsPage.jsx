import RevenueSplit from '../components/ui/RevenueSplit';
import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLanguage } from '../contexts/LanguageContext';
import OpenShiftsWarning from '../components/OpenShiftsWarning';
import useOpenShifts from '../hooks/useOpenShifts';
import {
  FileText,
  UserCheck,
  UserPlus,
  CreditCard,
  Wallet,
  Megaphone,
  Clock,
  Users,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  ClipboardList,
  Wrench,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import { AddMemberModal } from './MembersPage';
import EodReport from '../components/EodReport';
import { getEod } from '../services/reports.service';
import { getMyGym } from '../services/gym.service';
import { formatMoney } from '../utils/currency';
import { getAll as getTasks, create as createTask } from '../services/tasks.service';
import { getAll as getEquipment, update as updateEquipment, create as createEquipmentIssue } from '../services/equipment.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getAttendance } from '../services/attendance.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPayments } from '../services/payments.service';
import { getAll as getExpenses } from '../services/expenses.service';
import { todayStr, dayStr } from '../utils/date';
import { membershipEndsThisWeek } from '../utils/attention';
import { TASK_CATEGORIES } from '../utils/taskCategories';
import { assignFields, assigneeName } from '../utils/departments';
import { roleName } from '../utils/roleNames';
import { getRole } from '../utils/auth';
import { pagesFor } from '../utils/rolePages';
import { serverFieldError } from '../utils/formErrors';
import TaskAssigneeField from '../components/TaskAssigneeField';
import { SkeletonCards } from '../components/Skeleton';
import { softAll, failed } from '../utils/loadAll';
import { gymCache } from '../utils/gymCache';

const sName = s => `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id;

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans',
};
const secondaryBtn = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans',
};
const card = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card)',
};

const priorityColors = {
  high:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)'    },
  medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)'   },
};

const emptyTaskForm = { title: '', assignedTo: '', dueDate: '', priority: 'Medium', category: '' };

const emptyIssueForm = { equipment: '', location: '', description: '', severity: 'Medium' };

function ReportIssueModal({ open, onClose }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyIssueForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => { setForm(emptyIssueForm); setErrors({}); setSuccess(false); onClose(); };
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const e = {};
    if (!form.equipment.trim()) e.equipment = t('operations.equipmentRequired');
    if (!form.description.trim()) e.description = t('operations.descriptionRequired');
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await createEquipmentIssue({
        equipment: form.equipment.trim(),
        location: form.location.trim() || undefined,
        description: form.description.trim(),
        severity: form.severity.toLowerCase(),
      });
      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch {
      setErrors({ equipment: t('operations.saveIssueFailed') });
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontFamily: 'DM Sans' };

  return (
    <Modal open={open} onClose={handleClose} title={t('operations.reportIssue')}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('operations.issueReported')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('operations.issueSavedSuccess')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>{t('operations.equipmentArea')}</label>
            <input style={{ ...inp, borderColor: errors.equipment ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.equipment} onChange={set('equipment')} placeholder={t('operations.equipmentPlaceholder')} />
            {errors.equipment && <div role="alert" data-field-error style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.equipment}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>{t('operations.location')}</label>
              <input style={inp} value={form.location} onChange={set('location')} placeholder={t('operations.locationPlaceholder')} />
            </div>
            <div>
              <label style={lbl}>{t('operations.severity')}</label>
              <select style={inp} value={form.severity} onChange={set('severity')}>
                {[['Low', t('operations.severityLow')], ['Medium', t('operations.severityMedium')], ['High', t('operations.severityHigh')], ['Critical', t('operations.severityCritical')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>{t('tasks.descriptionLabel')} *</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', borderColor: errors.description ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.description} onChange={set('description')} placeholder={t('operations.descriptionPlaceholder')} />
            {errors.description && <div role="alert" data-field-error style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '9px 18px', cursor: 'pointer', fontFamily: 'DM Sans' }} onClick={handleClose}>{t('common.cancel')}</button>
            <button style={{ background: 'linear-gradient(135deg,#c9a96e,#b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '9px 18px', cursor: 'pointer', fontFamily: 'DM Sans', opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? t('operations.submitting') : t('operations.reportIssue')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AddTaskModal({ open, onClose, onSave, staffList = [] }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyTaskForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '', _form: '' })); };

  // The same fields the Tasks page asks for, which the server also insists on.
  // The dialog closes only once the task is saved; a refusal stays in it (F-107).
  const handleSave = async () => {
    const e = {};
    if (!form.title.trim()) e.title = t('tasks.titleRequired');
    if (!form.assignedTo) e.assignedTo = t('tasks.assigneeRequired');
    if (!form.dueDate) e.dueDate = t('tasks.dueDateRequired');
    if (!form.category) e.category = t('tasks.categoryRequired');
    if (Object.keys(e).length) { setErrors(e); return; }
    if (saving) return;
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      const se = serverFieldError(err, t('tasks.saveFailed'));
      setErrors(se.field && ['title', 'dueDate', 'category'].includes(se.field) ? { [se.field]: se.message } : { _form: se.message });
      return;
    } finally {
      setSaving(false);
    }
    onClose();
    setForm(emptyTaskForm);
  };
  const handleClose = () => { onClose(); setForm(emptyTaskForm); setErrors({}); };

  return (
    <Modal open={open} onClose={handleClose} title={t('tasks.addTask')} maxWidth={500}>
      <div style={{ display: 'grid', gap: 14 }}>
        <GemInput label={t('tasks.titleLabel')} required error={errors.title} value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('tasks.taskTitlePlaceholder')} />
        <div>
          <TaskAssigneeField
            value={form.assignedTo}
            dueDate={form.dueDate}
            onChange={v => set('assignedTo', v)}
            staffList={staffList}
            fieldStyle={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' }}
            labelStyle={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}
            required
          />
          {errors.assignedTo && <span role="alert" data-field-error style={{ fontSize: 11, color: 'var(--accent-red)' }}>{errors.assignedTo}</span>}
        </div>
        <GemInput label={t('tasks.dueDate')} required error={errors.dueDate} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        <GemSelect
          label={t('tasks.category')}
          required
          error={errors.category}
          value={form.category}
          onChange={e => set('category', e.target.value)}
          options={[{ value: '', label: t('tasks.selectCategory') }, ...TASK_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }))]}
        />
        <GemSelect
          label={t('tasks.priority')}
          value={form.priority}
          onChange={e => set('priority', e.target.value)}
          options={[['Low', t('tasks.priorityLow')], ['Medium', t('tasks.priorityMedium')], ['High', t('tasks.priorityHigh')]].map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>
      {errors._form && (
        <div role="alert" style={{ marginTop: 16, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{errors._form}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>{t('tasks.saveTask')}</button>
      </div>
    </Modal>
  );
}

const TODAY_DAY_NAME = new Date().toLocaleDateString('en-US', { weekday: 'long' });
function isWorkingToday(s) {
  if (!s.schedule || typeof s.schedule !== 'object') return true;
  const day = s.schedule[TODAY_DAY_NAME];
  return !day?.off;
}

function SummaryCard({ label, value, sub, icon: Icon, accent, dim, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s', transform: hovered && onClick ? 'translateY(-2px)' : 'none', boxShadow: hovered && onClick ? `0 6px 20px ${accent}22` : 'var(--shadow-card)' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color={accent} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

const severityConfig = {
  critical: { bg: 'rgba(220,38,38,0.18)', color: '#dc2626', icon: AlertTriangle },
  high:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)',    icon: AlertTriangle },
  medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)', icon: AlertTriangle },
  low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)',   icon: AlertTriangle },
};

const issueStatusConfig = {
  open:        { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)'    },
  in_progress: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  resolved:    { bg: 'var(--accent-green-dim)',  color: 'var(--accent-green)'  },
};

// A task that is done, or a calendar invite already answered, is not pending
const SETTLED_TASK = ['Done', 'done', 'Accepted', 'accepted', 'Declined', 'declined'];

export default function OperationsPage() {
  const { t } = useLanguage();
  // Names, never the stored codes (high, in_progress)
  const severityLabel = (sev) => ({ low: t('operations.severityLow'), medium: t('operations.severityMedium'), high: t('operations.severityHigh'), critical: t('operations.severityCritical') }[String(sev || '').toLowerCase()] || sev);
  const issueStatusLabel = (st) => ({ open: t('operations.issueOpen'), in_progress: t('tasks.statusInProgress'), resolved: t('operations.issueResolved') }[st] || st);
  // A card or a quick action only leads to a page this role can open; the
  // others sent the front desk to a page that sent them straight back
  const allowedPages = pagesFor(getRole()).pages;
  const canOpen = (path) => !allowedPages || allowedPages.includes(path.split('/').filter(Boolean)[0]);
  const linkTo = (path) => (canOpen(path) ? () => navigate(path) : undefined);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // Show the last overview at once and refresh quietly; a first-ever visit
  // falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('operations');
  const [tasks, setTasks] = useState(() => cache.read('tasks', []));
  const [staffList, setStaffList] = useState(() => cache.read('staff', []));
  const [showEOD, setShowEOD] = useState(false);
  const openShifts = useOpenShifts();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [issues, setIssues] = useState(() => cache.read('issues', []));
  // A refused status change, shown under that issue (F-120)
  const [issueActionError, setIssueActionError] = useState({});
  const [issueFilter, setIssueFilter] = useState('All');
  // Today's figures come from the same server report as the end-of-day report,
  // so the two can never disagree; gym holds the opening hours.
  const [eod, setEod] = useState(null);
  const [gym, setGym] = useState(null);
  const [attendance, setAttendance] = useState(() => cache.read('attendance', []));
  const [members, setMembers] = useState(() => cache.read('members', []));
  const [payments, setPayments] = useState(() => cache.read('payments', []));
  const [expenses, setExpenses] = useState(() => cache.read('expenses', []));

  // The gym's own calendar day, never the UTC one (a day off east of GMT)
  const today = todayStr();

  const [loading, setLoading] = useState(() => !cache.has('tasks'));

  const liveTick = useLiveTick();
  useEffect(() => {
    softAll([getTasks(), getEquipment(), getStaff(), getAttendance(), getMembers(), getPayments(), getExpenses()])
      .then(([tasksRes, equipRes, staffRes, attRes, membRes, payRes, expRes]) => {
        // A request that failed leaves what is shown, and its saved copy, alone
        const apply = (res, set, key) => { if (failed(res)) return; const d = res.data || []; set(d); cache.write(key, d); };
        apply(tasksRes, setTasks, 'tasks');
        apply(equipRes, setIssues, 'issues');
        apply(staffRes, setStaffList, 'staff');
        apply(attRes, setAttendance, 'attendance');
        apply(membRes, setMembers, 'members');
        apply(payRes, setPayments, 'payments');
        apply(expRes, setExpenses, 'expenses');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    getEod(todayStr()).then(r => setEod(r.data)).catch(() => {});
    getMyGym().then(r => setGym(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  const todayAttendance = attendance.filter(a => dayStr(a.checkIn || a.createdAt) === today && !a.staffWorkout);
  const todayCheckIns = eod ? eod.totals.checkins : todayAttendance.length;
  const todayVisitors = eod ? eod.checkins.filter(c => c.who === 'visitor').length : todayAttendance.filter(a => a.member?.isVisitor).length;
  const todayMembers = eod ? eod.totals.registrations : members.filter(m => dayStr(m.createdAt) === today).length;
  const todayPayments = eod ? eod.payments : payments.filter(p => dayStr(p.createdAt) === today);
  // Revenue is membership payments plus shop sales, as on the end-of-day report
  const todayRevenue = eod ? eod.totals.revenue : todayPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const revenueSplit = <RevenueSplit members={eod ? eod.totals.paymentsTotal : todayRevenue} shop={eod ? (eod.totals.salesProfit ?? 0) : 0} />;
  const todayExpenses = eod ? eod.totals.expensesTotal : expenses.filter(e => dayStr(e.date) === today).reduce((s, e) => s + Number(e.amount || 0), 0);
  const fmtMoney = (n) => formatMoney(n);

  // ── Today at a glance ──
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  const hoursToday = gym?.schedule?.[weekday];
  const hoursLabel = !gym ? '-'
    : !hoursToday ? t('operations.hoursNotSet')
    : !hoursToday.open ? t('operations.closedToday')
    : (hoursToday.slots || []).map(s => `${s.from} - ${s.to}`).join(', ');
  const memberVisits = attendance.filter(a => !a.staffWorkout && a.memberId);
  const lastHour = memberVisits.filter(a => Date.now() - new Date(a.checkIn).getTime() <= 3600000).length;
  const endingSoon = members.filter(membershipEndsThisWeek).length;
  const owing = members.filter(m => (m.balance || 0) > 0);
  const owedTotal = owing.reduce((s, m) => s + (m.balance || 0), 0);
  const openIssues = issues.filter(i => i.status !== 'resolved').length;
  const glanceRows = [
    { icon: Clock, label: t('operations.openingHours'), value: hoursLabel },
    { icon: UserCheck, label: t('operations.checkInsLastHour'), value: lastHour, color: lastHour ? 'var(--accent-green)' : undefined },
    { icon: AlertTriangle, label: t('operations.endingThisWeek'), value: endingSoon, color: endingSoon ? 'var(--accent-yellow)' : undefined },
    { icon: Wallet, label: t('operations.membersOwing'), value: owing.length ? `${owing.length} · ${formatMoney(owedTotal)}` : '0', color: owing.length ? 'var(--accent-red)' : undefined },
    { icon: Wrench, label: t('operations.openIssues'), value: openIssues, color: openIssues ? 'var(--accent-red)' : undefined },
  ];

  const pendingTasks = tasks.filter(task => !SETTLED_TASK.includes(task.status));

  const handleSaveTask = async (form) => {
    const payload = {
      title: form.title,
      description: form.notes || undefined,
      ...assignFields(form.assignedTo),
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      priority: form.priority.toLowerCase(),
      category: form.category,
    };
    // A refusal goes back to the dialog, which shows it
    const res = await createTask(payload);
    setTasks(ts => [res.data, ...ts]);
  };

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    const kpis = [
      { label: t('operations.checkInsToday'), value: todayCheckIns, icon: UserCheck, path: '/attendance', color: '#22c55e' },
      { label: t('operations.newMembers'), value: todayMembers, icon: UserPlus, path: '/members', color: '#c9a96e' },
      { label: t('operations.revenueToday'), value: fmtMoney(todayRevenue), sub: revenueSplit, icon: TrendingUp, path: '/accounting', color: '#60a5fa' },
      { label: t('operations.expendituresToday'), value: fmtMoney(todayExpenses), icon: TrendingDown, path: '/accounting', color: '#f87171' },
    ];
    return (
      <div style={{ minHeight: '100%' }}>
        <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('nav.operations')}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>{t('operations.todayGlance')}</p>
          </div>
          <button onClick={() => setShowEOD(true)} style={{ ...primaryBtn, padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <FileText size={13} /> {t('eod.title')}
          </button>
        </div>

        {/* KPI grid */}
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {kpis.map(({ label, value, sub, icon: Icon, path, color }) => (
            <div
              key={label}
              onClick={() => navigate(path)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 14px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon size={13} strokeWidth={2} color={color} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Pending tasks */}
        {pendingTasks.length > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'DM Sans' }}>
              {t('operations.pendingTasksCount', { n: pendingTasks.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingTasks.slice(0, 5).map(task => (
                <div key={task.id} onClick={() => navigate('/tasks')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClipboardList size={14} strokeWidth={1.8} color="var(--text-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                    {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{String(task.dueDate).slice(0, 10)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open equipment issues */}
        {issues.filter(i => i.status !== 'resolved').length > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'DM Sans' }}>
              {t('operations.equipmentIssues')}
            </div>
            {issues.filter(i => i.status !== 'resolved').slice(0, 3).map(issue => (
              <div key={issue.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '11px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{issue.equipment || issue.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{issue.description || issueStatusLabel(issue.status)}</div>
              </div>
            ))}
          </div>
        )}
        <EodReport open={showEOD} onClose={() => setShowEOD(false)} footer={openShifts.length > 0 ? <OpenShiftsWarning shifts={openShifts} /> : null} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <PageHeader title={t('operations.title')} subtitle={t('operations.subtitle')}>
        <button style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowEOD(true)}>
          <FileText size={13} /> {t('operations.generateEod')}
        </button>
      </PageHeader>

      {/* Row 1 : 4 cards */}
      <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <SummaryCard label={t('operations.checkInsToday')} value={String(todayCheckIns)} icon={UserCheck} accent="var(--accent-green)" dim="var(--accent-green-dim)" onClick={linkTo('/attendance')} />
        <SummaryCard label={t('operations.newMembers')} value={String(todayMembers)} icon={UserPlus} accent="var(--accent-gold)" dim="var(--accent-gold-dim)" onClick={linkTo('/members')} />
        <SummaryCard label={t('operations.paymentsReceived')} value={String(todayPayments.length)} icon={CreditCard} accent="var(--accent-blue)" dim="var(--accent-blue-dim)" onClick={linkTo('/payments')} />
        <SummaryCard label={t('operations.revenueToday')} value={fmtMoney(todayRevenue)} sub={revenueSplit} icon={TrendingUp} accent="var(--accent-purple)" dim="var(--accent-purple-dim)" onClick={linkTo('/accounting')} />
      </div>

      {/* Row 2 : 3 cards */}
      <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <SummaryCard label={t('operations.visitorsToday')} value={String(todayVisitors)} icon={Users} accent="var(--accent-blue)" dim="var(--accent-blue-dim)" onClick={linkTo('/attendance')} />
        <SummaryCard label={t('operations.staffCount')} value={String(staffList.filter(s => s.isActive !== false && isWorkingToday(s)).length)} icon={ShoppingBag} accent="var(--accent-yellow)" dim="var(--accent-yellow-dim)" onClick={linkTo('/staff')} />
        <SummaryCard label={t('operations.expendituresToday')} value={fmtMoney(todayExpenses)} icon={TrendingDown} accent="var(--accent-red)" dim="var(--accent-red-dim)" onClick={linkTo('/accounting')} />
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Staff on Duty */}
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.staffOnDuty')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{staffList.filter(s => s.isActive !== false && isWorkingToday(s)).length} {t('operations.onDuty')}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {loading ? (
                <div style={{ padding: '8px 16px' }}><SkeletonCards count={3} height={56} /></div>
              ) : staffList.filter(s => s.isActive !== false && isWorkingToday(s)).length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('operations.noStaffOnDuty')}</div>
              ) : staffList.filter(s => s.isActive !== false && isWorkingToday(s)).slice(0, 8).map((s, i, arr) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <Avatar firstName={s.firstName || ''} lastName={s.lastName || ''} avatarColor={s.avatarColor || ['gold','green','blue','purple','red'][i % 5]} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{sName(s)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 1 }}>{roleName(s.role, t)}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} title={t('common.active')} />
                </div>
              ))}
            </div>
          </div>

          {/* Pending Tasks */}
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.pendingItems')}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {loading ? (
                <div style={{ padding: '8px 16px' }}><SkeletonCards count={3} height={56} /></div>
              ) : pendingTasks.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('operations.allTasksDone')}</div>
              ) : pendingTasks.map((task, i) => {
                const pc = priorityColors[(task.priority || '').toLowerCase()] || priorityColors.low;
                const assignee = assigneeName(task, t) || t('common.unassigned');
                const dueDisplay = task.dueDate ? String(task.dueDate).slice(0, 10) : '-';
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: i < pendingTasks.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <ClipboardList size={15} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{task.title}</span>
                        <span style={{ ...pc, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans', whiteSpace: 'nowrap', flexShrink: 0 }}>{t(`tasks.priority${task.priority}`)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>
                        {assignee} · {t('operations.due')} {dueDisplay}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                );
              })}
            </div>
            {pendingTasks.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                <span onClick={() => navigate('/tasks')} style={{ fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: 500 }}>
                  {t('operations.viewAllTasks')} →
                </span>
              </div>
            )}
          </div>
          {/* Equipment Issues */}
          {(() => {
            const filterMap = { 'All': null, 'Open': 'open', 'In Progress': 'in_progress', 'Resolved': 'resolved' };
            const filtered = filterMap[issueFilter] ? issues.filter(i => i.status === filterMap[issueFilter]) : issues;
            const openCount = issues.filter(i => i.status === 'open').length;
            return (
              <div style={card}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wrench size={15} color="var(--accent-yellow)" />
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.equipmentIssues')}</span>
                    {openCount > 0 && (
                      <span style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'DM Sans' }}>{t('operations.nOpen', { n: openCount })}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['All', t('common.all')], ['Open', t('operations.issueOpen')], ['In Progress', t('tasks.statusInProgress')], ['Resolved', t('operations.issueResolved')]].map(([key, label]) => (
                      <button key={key} onClick={() => setIssueFilter(key)} style={{ background: issueFilter === key ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: issueFilter === key ? '#0a0a0f' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{label}</button>
                    ))}
                  </div>
                </div>
                {loading ? (
                  <div style={{ padding: '8px 16px' }}><SkeletonCards count={2} height={56} /></div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                    <CheckCircle2 size={28} color="var(--accent-green)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('operations.noIssues')}</div>
                  </div>
                ) : (
                  <div style={{ padding: '8px 0' }}>
                    {filtered.map((issue, i) => {
                      const sev = severityConfig[String(issue.severity || '').toLowerCase()] || severityConfig.medium;
                      const ist = issueStatusConfig[issue.status] || issueStatusConfig.open;
                      return (
                        <div key={issue.id} style={{ padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Wrench size={13} color={sev.color} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{issue.equipment}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 1 }}>{issue.location}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <span style={{ background: sev.bg, color: sev.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, fontFamily: 'DM Sans' }}>{severityLabel(issue.severity)}</span>
                              <span style={{ background: ist.bg, color: ist.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, fontFamily: 'DM Sans' }}>{issueStatusLabel(issue.status)}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.5, marginBottom: 6, paddingLeft: 36 }}>{issue.description}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 36 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{issue.reportedAt ? String(issue.reportedAt).slice(0, 10) : '-'}</span>
                            {issue.status !== 'resolved' && (
                              <button
                                onClick={async () => {
                                  const nextStatus = issue.status === 'open' ? 'in_progress' : 'resolved';
                                  setIssueActionError(prev => ({ ...prev, [issue.id]: '' }));
                                  try {
                                    const res = await updateEquipment(issue.id, { status: nextStatus });
                                    setIssues(prev => prev.map(it => it.id === issue.id ? res.data : it));
                                  } catch (err) {
                                    setIssueActionError(prev => ({ ...prev, [issue.id]: err?.response?.data?.error || t('operations.saveIssueFailed') }));
                                  }
                                }}
                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 11, color: 'var(--text-secondary)', padding: '3px 8px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}
                              >
                                {issue.status === 'open' ? t('operations.markInProgress') : t('operations.markResolved')}
                              </button>
                            )}
                          </div>
                          {issueActionError[issue.id] && (
                            <div role="alert" style={{ marginTop: 6, paddingLeft: 36, fontSize: 11.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{issueActionError[issue.id]}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Quick Actions */}
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.quickActions')}</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('operations.recordCheckIn'), icon: UserCheck, accent: 'var(--accent-green)', dim: 'var(--accent-green-dim)', action: () => navigate('/attendance'), to: '/attendance' },
                { label: t('dashboard.addMember'), icon: UserPlus, accent: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', action: () => setShowAddMember(true) },
                { label: t('operations.recordPayment'), icon: CreditCard, accent: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)', action: () => navigate('/payments'), to: '/payments' },
                { label: t('dashboard.recordExpense'), icon: Wallet, accent: 'var(--accent-red)', dim: 'var(--accent-red-dim)', action: () => navigate('/accounting'), to: '/accounting' },
                { label: t('operations.sendAnnouncement'), icon: Megaphone, accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', action: () => navigate('/communication'), to: '/communication' },
                { label: t('tasks.addTask'), icon: ClipboardList, accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', action: () => setShowAddTask(true) },
                { label: t('operations.reportIssue'), icon: Wrench, accent: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)', action: () => setShowReportIssue(true) },
              ].filter(a => !a.to || canOpen(a.to)).map(({ label, icon: Icon, accent, dim, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={accent} strokeWidth={2} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Today at a Glance: every line comes from the gym's own records */}
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.todayGlance')}</span>
            </div>
            <div style={{ padding: '6px 16px 10px' }}>
              {glanceRows.map(({ icon: Ic, label, value, color }, i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < glanceRows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Ic size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: color || 'var(--text-primary)', fontFamily: 'DM Sans', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EodReport open={showEOD} onClose={() => setShowEOD(false)} footer={openShifts.length > 0 ? <OpenShiftsWarning shifts={openShifts} /> : null} />
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} onSave={handleSaveTask} staffList={staffList} />
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} />
      <ReportIssueModal open={showReportIssue} onClose={() => setShowReportIssue(false)} />
    </div>
  );
}
