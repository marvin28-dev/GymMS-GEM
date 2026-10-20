import CoachDashboard from './CoachDashboard';
import { checkInErrorText } from '../utils/checkin';
import RevenueSplit from '../components/ui/RevenueSplit';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { getCurrencySymbol, formatMoney } from '../utils/currency';
import { digitsOnly } from '../utils/number';
import { autoPaymentDescription } from '../utils/paymentDescription';
import { fmtDate, fmtTime, capFirst, getDateLocale, todayStr } from '../utils/date';
import { membershipEndsThisWeek, isActiveMember } from '../utils/attention';
import { revenueOf } from '../utils/revenue';
import { getAll as getSales } from '../services/sales.service';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, CheckSquare, Banknote, AlertCircle,
  UserPlus, LogIn, CreditCard, ShoppingBag, Plus, FileText, Wrench,
  ChevronLeft, ChevronRight, Printer, Lock, Search, Calendar, Trash2, ClipboardList,
} from 'lucide-react';

import Avatar from '../components/ui/Avatar';
import CodeInput from '../components/ui/CodeInput';
import StatusBadge from '../components/ui/StatusBadge';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import VisitKindBadge from '../components/ui/VisitKindBadge';
import EodReport from '../components/EodReport';
import Modal from '../components/ui/Modal';
import VisitorCodeModal from '../components/ui/VisitorCodeModal';
import { AddMemberModal, AddVisitorModal } from './MembersPage';
import { TransactionModal } from './PaymentsPage';

import { getAuth, getRole } from '../utils/auth';
import { getAll as getAttendance, checkIn as checkInApi } from '../services/attendance.service';
import { getAll as getPayments, create as createPayment } from '../services/payments.service';
import { getAll as getCalendar } from '../services/calendar.service';
import { getAll as getNotifications, markAllRead as markNotifsRead } from '../services/notifications.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { create as createTask, getAll as getTasks } from '../services/tasks.service';
import { create as createEquipmentIssue } from '../services/equipment.service';
import { getAll as getPackages } from '../services/packages.service';
import OpenShiftsWarning, { useOpenShifts } from '../components/OpenShiftsWarning';
import { getMyGym } from '../services/gym.service';
import { TASK_CATEGORIES } from '../utils/taskCategories';
import { assignFields } from '../utils/departments';
import TaskAssigneeField from '../components/TaskAssigneeField';
import { isFitness } from '../utils/rolePages';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods, PAYMENT_METHODS, canonicalMethod } from '../utils/paymentMethods';
import { gymAddress } from '../utils/gymAddress';
import { SkeletonCards, SkeletonLine } from '../components/Skeleton';
import { softAll } from '../utils/loadAll';

const MobileCtx = createContext(false);

// ─── helpers ─────────────────────────────────────────────────────────────────


const formatTime = (isoStr) => {
  if (!isoStr) return '-';
  return fmtTime(isoStr);
};

// Weeks start on Monday, as on the Calendar page
function buildCalendar(year, month) {
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false });
  }
  return cells;
}

const getMonthName = (year, month, lang) =>
  new Date(year, month, 1).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' });

const getDayLabels = (lang) => {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  // 2 January 2023 was a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, i + 2).toLocaleDateString(locale, { weekday: 'short' })
  );
};

const EVENT_COLORS = {
  gold: 'var(--accent-gold)',
  blue: 'var(--accent-blue)',
  green: 'var(--accent-green)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, iconColor, iconBg, glowColor, trend, trendColor, trendBg, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isMobile = useContext(MobileCtx);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? glowColor : 'var(--border-subtle)'}`,
        borderRadius: 12,
        padding: isMobile ? 12 : 20,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${glowColor}22` : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: glowColor, filter: 'blur(30px)', opacity: 0.12, pointerEvents: 'none',
      }} />
      {isMobile ? (
        <>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon size={13} color={iconColor} strokeWidth={2} />
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3, marginBottom: 6 }}>{label}</div>
          <span style={{ fontSize: 9, background: trendBg, color: trendColor, borderRadius: 4, padding: '2px 6px', display: 'inline-block', fontWeight: 600 }}>{trend}</span>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.35, flex: 1, minWidth: 0 }}>{label}</span>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color={iconColor} strokeWidth={2} />
            </div>
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 8px', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </div>
          <span style={{ fontSize: 9, background: trendBg, color: trendColor, borderRadius: 4, padding: '2px 6px', display: 'inline-block', fontWeight: 600 }}>{trend}</span>
        </>
      )}
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isMobile = useContext(MobileCtx);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--accent-gold-glow)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: isMobile ? '10px 10px' : '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: 7,
        fontSize: isMobile ? 11 : 12, color: hovered ? 'var(--accent-gold)' : 'var(--text-secondary)',
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
        width: isMobile ? '100%' : 'auto', overflow: 'hidden',
      }}
    >
      <Icon size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function SectionCard({ children, style }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }) {
  const isMobile = useContext(MobileCtx);
  return (
    <div style={{ padding: isMobile ? '11px 14px' : '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      {action}
    </div>
  );
}

function ViewAllLink({ label = 'View All →', onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: hovered ? '#e0c27a' : 'var(--accent-gold)', fontFamily: 'DM Sans, sans-serif', transition: 'color 0.15s' }}
    >
      {label}
    </button>
  );
}

const METHOD_COLORS = {
  card: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  Card: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  cash: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  Cash: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  transfer: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  Transfer: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  bank_transfer: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  mobile_pay: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  mobile_money: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
};

// Payments are stored with codes (mobile_money, registration); people read names
const methodName = (m, t) => { const pm = PAYMENT_METHODS.find(x => x.api === m || x.key === canonicalMethod(m)); return pm ? t(pm.labelKey) : m; };
const payTypeName = (p, t) => p.note || p.description || ({ membership: t('eod.typeMembership'), registration: t('eod.typeRegistration'), product: t('eod.typePass'), other: t('eod.typeOther') }[p.type] || p.type);

function MiniCalendar({ lang = 'en' }) {
  const now = new Date();
  const [current, setCurrent] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const cells = buildCalendar(current.year, current.month);
  const dayLabels = getDayLabels(lang);
  const isToday = (cell) =>
    cell.current &&
    cell.day === now.getDate() &&
    current.month === now.getMonth() &&
    current.year === now.getFullYear();

  const prevMonth = () => {
    setCurrent(c => {
      const d = new Date(c.year, c.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const nextMonth = () => {
    setCurrent(c => {
      const d = new Date(c.year, c.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <SectionCard>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {getMonthName(current.year, current.month, lang)} {current.year}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[ChevronLeft, ChevronRight].map((Icon, i) => (
            <button key={i} onClick={i === 0 ? prevMonth : nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Icon size={16} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {dayLabels.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {cells.map((cell, idx) => {
            const today_ = isToday(cell);
            const dimmed = !cell.current;
            return (
              <div key={idx} style={{ height: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: 6 }}>
                <div style={{ width: today_ ? 26 : 'auto', height: today_ ? 26 : 'auto', borderRadius: today_ ? '50%' : 0, background: today_ ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: today_ ? 700 : 400, color: today_ ? '#0a0a0f' : dimmed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {cell.day}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Shared modal styles ──────────────────────────────────────────────────────

const mInputStyle = {
  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
  borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)',
  fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box',
};
const mPrimaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none',
  borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer',
  fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const mSecondaryBtn = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)',
  borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer',
  fontFamily: 'DM Sans',
};
const mLabel = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

const taskEmptyForm = {
  title: '', description: '', dueDate: '',
  assignedTo: '', priority: 'Medium', category: '', status: 'Pending', notes: '',
};

// ─── Add Task Modal ───────────────────────────────────────────────────────────

// ─── Report Issue Modal ───────────────────────────────────────────────────────

const issueEmpty = { equipment: '', location: '', description: '', severity: 'Medium' };

function ReportIssueModal({ open, onClose }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(issueEmpty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => { setForm(issueEmpty); setErrors({}); setSuccess(false); onClose(); };
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

  const severityOpts = [
    { value: 'Low', label: t('operations.severityLow') },
    { value: 'Medium', label: t('operations.severityMedium') },
    { value: 'High', label: t('operations.severityHigh') },
    { value: 'Critical', label: t('operations.severityCritical') },
  ];

  return (
    <Modal open={open} onClose={handleClose} title={t('dashboard.reportIssue')}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('operations.issueReported')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('operations.issueSavedSuccess')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={mLabel}>{t('operations.equipmentArea')}</label>
            <input style={{ ...mInputStyle, borderColor: errors.equipment ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.equipment} onChange={set('equipment')} placeholder={t('operations.equipmentPlaceholder')} />
            {errors.equipment && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.equipment}</div>}
          </div>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={mLabel}>{t('operations.location')}</label>
              <input style={mInputStyle} value={form.location} onChange={set('location')} placeholder={t('operations.locationPlaceholder')} />
            </div>
            <div>
              <label style={mLabel}>{t('operations.severity')}</label>
              <select style={mInputStyle} value={form.severity} onChange={set('severity')}>
                {severityOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={mLabel}>{t('common.description')} *</label>
            <textarea style={{ ...mInputStyle, minHeight: 80, resize: 'vertical', borderColor: errors.description ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.description} onChange={set('description')} placeholder={t('operations.descriptionPlaceholder')} />
            {errors.description && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button style={mSecondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
            <button style={{ ...mPrimaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? t('common.submitting') : t('dashboard.reportIssue')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function AddTaskModal({ open, onClose, staffList = [], onCreated }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(taskEmptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleClose = () => { setForm(taskEmptyForm); setErrors({}); onClose(); };
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const e = {};
    if (!form.title.trim()) e.title = t('tasks.titleRequired');
    if (!form.assignedTo) e.assignedTo = t('tasks.assigneeRequired');
    if (!form.dueDate) e.dueDate = t('tasks.dueDateRequired');
    if (!form.category) e.category = t('tasks.categoryRequired');
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const saved = await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        ...assignFields(form.assignedTo),
        priority: form.priority,
        category: form.category || undefined,
        // Status is not set when raising a task. Only the assignee moves it on.
      });
      handleClose();
      if (onCreated) onCreated(saved?.data || saved);
    } catch {
      setErrors({ title: t('tasks.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('dashboard.addTask')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={mLabel}>{t('tasks.titleLabel')}</label>
          <input style={{ ...mInputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={set('title')} placeholder={t('tasks.taskTitlePlaceholder')} />
          {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
        </div>
        <div>
          <label style={mLabel}>{t('tasks.descriptionLabel')}</label>
          <textarea style={{ ...mInputStyle, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={set('description')} placeholder={t('tasks.taskDescriptionPlaceholder')} />
        </div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLabel}>{t('tasks.dueDate')}</label>
            <input type="date" style={{ ...mInputStyle, borderColor: errors.dueDate ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.dueDate} onChange={e => { set('dueDate')(e); setErrors(er => ({ ...er, dueDate: '' })); }} />
            {errors.dueDate && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.dueDate}</div>}
          </div>
          <div>
            <label style={mLabel}>{t('tasks.priority')}</label>
            <select style={mInputStyle} value={form.priority} onChange={set('priority')}>
              <option value="High">{t('tasks.priorityHigh')}</option>
              <option value="Medium">{t('tasks.priorityMedium')}</option>
              <option value="Low">{t('tasks.priorityLow')}</option>
            </select>
          </div>
        </div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <TaskAssigneeField
              value={form.assignedTo}
              dueDate={form.dueDate}
              onChange={v => { setForm(f => ({ ...f, assignedTo: v })); setErrors(er => ({ ...er, assignedTo: '' })); }}
              staffList={staffList}
              fieldStyle={mInputStyle}
              labelStyle={mLabel}
              required
            />
            {errors.assignedTo && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.assignedTo}</div>}
          </div>
          <div>
            <label style={mLabel}>{t('tasks.category')} *</label>
            <select
              style={{ ...mInputStyle, borderColor: errors.category ? 'var(--accent-red)' : undefined }}
              value={form.category}
              onChange={e => { set('category')(e); setErrors(er => ({ ...er, category: '' })); }}
            >
              <option value="">{t('tasks.selectCategory')}</option>
              {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            </select>
            {errors.category && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.category}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button style={mSecondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
          <button style={{ ...mPrimaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('tasks.saveTask')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Check-In Modal ───────────────────────────────────────────────────────────

function CheckInModal({ open, onClose, membersList = [], onCheckedIn }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [visitorCodeOpen, setVisitorCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [pickedId, setPickedId] = useState(null);

  // A member's own code or member ID names one person. A name or a phone can
  // match several (two John Smiths, "Ann" and Anna), so every match is offered
  // and the staff pick, as on the Attendance page and the desk (F-113).
  const trimmed = search.trim();
  const lower = trimmed.toLowerCase();
  const exact = trimmed ? membersList.find(m => m.accessCode === trimmed || m.memberCode === trimmed) : null;
  const matches = !trimmed || exact ? [] : membersList.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
    (m.phone || '').toLowerCase().includes(lower));
  const found = exact || (matches.length === 1 ? matches[0] : matches.find(m => m.id === pickedId)) || null;
  const foundByCode = !!(found && found.accessCode === trimmed);

  const hasPhoto = !!(found?.photo);
  const isVisitorFound = !!(found && (found.isVisitor || found.status === 'visitor'));
  const needsCodeVerify = !!(found && !foundByCode && !isVisitorFound && !hasPhoto);

  const handleClose = () => { setSearch(''); setPickedId(null); setCheckedIn(false); setError(''); setCodeInput(''); setCodeError(''); onClose(); };

  const doCheckIn = async () => {
    if (!found) return;
    setLoading(true);
    setError('');
    try {
      const res = await checkInApi({ memberId: found.id });
      setCheckedIn(true);
      if (onCheckedIn) {
        onCheckedIn({ ...res.data, member: { ...res.data.member, package: found.package } });
      }
    } catch (err) {
      setError(checkInErrorText(err, t, t('frontDesk.checkInFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = () => {
    if (!found) return;
    // Same rule as members: a photo the desk can check by sight lets them straight in
    if (isVisitorFound && !foundByCode && !found.photo) { setVisitorCodeOpen(true); return; }
    if (needsCodeVerify) return;
    doCheckIn();
  };

  const verifyAndCheckIn = () => {
    const code = codeInput.trim();
    if (!code) { setCodeError(t('frontDesk.pleaseEnterCode')); return; }
    if (code !== found.accessCode) { setCodeError(t('frontDesk.incorrectAccessCode')); return; }
    setCodeError('');
    doCheckIn();
  };

  const openProfile = () => { if (found) { handleClose(); navigate(`/members/${found.id}`); } };

  return (
    <>
    <Modal open={open} onClose={handleClose} title={t('frontDesk.quickCheckIn')} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); setPickedId(null); setCheckedIn(false); setError(''); }}
          placeholder={t('frontDesk.searchPlaceholderCheckin')}
          style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-gold)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
        />

        {!found && matches.length > 1 && (
          <div data-match-list style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{t('attendance.pickOne', { n: matches.length })}</div>
            {matches.slice(0, 8).map((m, i) => (
              <button key={m.id} type="button" onClick={() => setPickedId(m.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontFamily: 'DM Sans' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {m.photo ? <img src={m.photo} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={34} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.firstName} {m.lastName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[m.package?.name, m.memberCode].filter(Boolean).join(' · ') || '-'}</div>
                </div>
                <MemberStatusTags member={m} typeOnly />
              </button>
            ))}
          </div>
        )}

        {found && matches.length > 1 && !checkedIn && (
          <button type="button" onClick={() => setPickedId(null)} style={{ alignSelf: 'flex-start', marginTop: -8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}>
            {t('attendance.seeAllMatches', { n: matches.length })}
          </button>
        )}

        {found && (
          <div
            onClick={openProfile}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ background: hovered ? 'var(--bg-card-hover)' : 'var(--bg-elevated)', border: `1px solid ${hovered ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {found.photo ? <img src={found.photo} alt={found.firstName} onClick={e => { e.stopPropagation(); setPhotoLightbox(found.photo); }} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }}/> : <Avatar firstName={found.firstName} lastName={found.lastName} avatarColor={found.avatarColor} size={44} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{found.firstName} {found.lastName}</span>
                  <MemberStatusTags member={found} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                  {found.memberCode} · {found.package?.name || '-'}
                </div>
                {(found.balance || 0) > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    ⚠ {t('frontDesk.owes')} {formatMoney(found.balance)}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: hovered ? 'var(--accent-gold)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {t('common.viewProfile')} →
              </span>
            </div>
          </div>
        )}

        {checkedIn && found && (
          <div style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-green)', textAlign: 'center' }}>
            {t('frontDesk.checkedInSuccessName', { firstName: found.firstName, lastName: found.lastName })}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-red)' }}>
            ⚠ {error}
          </div>
        )}

        {needsCodeVerify && !checkedIn && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('frontDesk.noPhotoEnterCode')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <CodeInput
                value={codeInput}
                onChange={v => { setCodeInput(v); setCodeError(''); }}
                onEnter={verifyAndCheckIn}
                placeholder={t('frontDesk.typeOrPaste')}
                style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid ${codeError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', letterSpacing: '0.5px' }}
                onFocus={e => { if (!codeError) e.target.style.borderColor = 'var(--accent-gold)'; }}
                onBlur={e => { if (!codeError) e.target.style.borderColor = 'var(--border-subtle)'; }}
              />
              <button onClick={verifyAndCheckIn} disabled={loading} style={{ ...mPrimaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? t('frontDesk.checkingIn') : t('frontDesk.verifyCheckIn')}
              </button>
            </div>
            {codeError && <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>⚠ {codeError}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={mSecondaryBtn}>{t('common.cancel')}</button>
          {!needsCodeVerify && (
            <button
              onClick={handleCheckIn}
              disabled={!found || loading || checkedIn}
              style={{ background: found && !loading && !checkedIn ? 'linear-gradient(135deg, #c9a96e, #b08d4a)' : 'var(--bg-elevated)', color: found && !loading && !checkedIn ? '#0a0a0f' : 'var(--text-muted)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: found && !loading && !checkedIn ? 'pointer' : 'default', fontFamily: 'DM Sans' }}
            >
              {loading ? t('frontDesk.checkingIn') : t('frontDesk.checkIn')}
            </button>
          )}
        </div>
      </div>
    </Modal>
    {photoLightbox && (
      <div onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
        <img src={photoLightbox} alt="Profile" style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
        <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>{t('common.clickToClose')}</div>
      </div>
    )}
    <VisitorCodeModal
      open={visitorCodeOpen}
      onClose={() => setVisitorCodeOpen(false)}
      visitor={found}
      onSuccess={doCheckIn}
    />
    </>
  );
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────

const genRef = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
};

function AddPaymentModal({ open, onClose, membersList = [], onSaved }) {
  const { t } = useLanguage();
  const gymSettings = useGymSettings();
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'Cash', type: 'membership', description: '' });
  const [ref, setRef] = useState(() => genRef());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setMemberSearch('');
      setSelectedMember(null);
      setForm({ amount: '', method: 'Cash', type: 'membership', description: '' });
      setRef(genRef());
      setErrors({});
    }
  }, [open]);

  const filteredMembers = memberSearch.trim().length > 0
    ? membersList.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.memberCode || '').toLowerCase().includes(memberSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const owedBalance = Number(selectedMember?.balance) || 0;
  const payAmt = parseFloat(form.amount) || 0;
  const remaining = Math.max(0, owedBalance - payAmt);
  const reducesBalance = form.type === 'membership' || form.type === 'other';
  const todayLabel = fmtDate(new Date());

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  const handleSave = async () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = t('payments.invalidAmount');
    // A payment towards what the member owes can never be more than that
    else if (reducesBalance && Number(form.amount) > owedBalance) e.amount = t('memberProfile.amountOverMax', { amount: formatMoney(owedBalance) });
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const res = await createPayment({
        memberId: selectedMember.id,
        amount: Number(form.amount),
        type: form.type,
        method: form.method,
        description: form.description,
        reference: ref,
        towardBalance: reducesBalance,
      });
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      setErrors({ amount: err?.response?.data?.error || t('payments.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  // 'search' → 'form' (balance > 0) or 'no-balance' (balance = 0)
  const view = !selectedMember ? 'search' : owedBalance > 0 ? 'form' : 'no-balance';

  const MemberChip = ({ gold }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', border: `1px solid ${gold ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '9px 14px' }}>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMember?.firstName} {selectedMember?.lastName}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{selectedMember?.memberCode}</span>
      </div>
      <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('dashboard.addPayment')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Step 1: Search for member ── */}
        {view === 'search' && (
          <>
            <div>
              <label style={lbl}>{t('payments.searchMember')} *</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  style={{ ...inp, paddingLeft: 32 }}
                  placeholder={t('payments.namOrCode')}
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                />
                {filteredMembers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, marginTop: 4, overflow: 'hidden' }}>
                    {filteredMembers.map(m => (
                      <div key={m.id}
                        onClick={() => { setSelectedMember(m); setForm(f => ({ ...f, description: f.description || autoPaymentDescription(m, f.type) })); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.firstName} {m.lastName}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{m.memberCode}</span>
                        </div>
                        {Number(m.balance) > 0 && (
                          <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, background: 'rgba(248,113,113,0.1)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            {t('payments.owes')} {formatMoney(m.balance)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={mSecondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
            </div>
          </>
        )}

        {/* ── Step 2a: Member has no outstanding balance ── */}
        {view === 'no-balance' && (
          <>
            <MemberChip gold={false} />
            <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>{t('payments.noOutstandingBalance')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {t('payments.memberHasNoBalance', { firstName: selectedMember.firstName, lastName: selectedMember.lastName })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={mSecondaryBtn} onClick={() => setSelectedMember(null)}>← {t('common.back')}</button>
              <button style={mSecondaryBtn} onClick={onClose}>{t('common.close')}</button>
            </div>
          </>
        )}

        {/* ── Step 2b: Payment form ── */}
        {view === 'form' && (
          <>
            <MemberChip gold />

            {/* Balance banner */}
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>{t('payments.outstandingBalance')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope' }}>{formatMoney(owedBalance)}</div>
              </div>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, amount: String(owedBalance) }))}
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}
              >{t('payments.payInFull')}</button>
            </div>

            {/* Reference */}
            <div>
              <label style={lbl}>{t('payments.reference')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('payments.autoGenerated')})</span></label>
              <div style={{ ...inp, background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', userSelect: 'all' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0, display: 'inline-block' }} />
                {ref}
              </div>
            </div>

            {/* Amount + Method */}
            <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{t('payments.amountLabel').replace('*', '')} ({getCurrencySymbol()}) *</label>
                <input type="text" inputMode="numeric"
                  style={{ ...inp, border: `1px solid ${errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)'}` }}
                  value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: digitsOnly(e.target.value) })); setErrors(v => ({ ...v, amount: '' })); }}
                  placeholder="0"
                />
                {errors.amount && <span style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, display: 'block' }}>{errors.amount}</span>}
              </div>
              <div>
                <label style={lbl}>{t('payments.method')} *</label>
                <select style={inp} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  {enabledMethods(gymSettings).map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                </select>
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <label style={lbl}>{t('payments.paymentType')}</label>
              <select style={inp} value={form.type} onChange={e => {
                const newType = e.target.value;
                setForm(f => {
                  const custom = f.description && f.description !== autoPaymentDescription(selectedMember, f.type);
                  return { ...f, type: newType, description: custom ? f.description : autoPaymentDescription(selectedMember, newType) };
                });
              }}>
                <option value="membership">{t('payments.membership')}</option>
                <option value="registration">{t('members.registrationFee')}</option>
                <option value="product">{t('payments.product')}</option>
                <option value="other">{t('common.other')}</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={lbl}>{t('payments.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span></label>
              <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('payments.descriptionPlaceholder')} />
            </div>

            {/* Date locked */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
              <Lock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('payments.dateLocked')} : {todayLabel}</span>
            </div>

            {/* Balance after payment preview */}
            {payAmt > 0 && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('payments.balanceAfterPayment')}</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : 'var(--text-primary)' }}>
                  {remaining === 0 ? '✓ ' : ''}{formatMoney(remaining)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
              <button style={mSecondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
              <button
                style={{ ...mPrimaryBtn, opacity: (form.amount && !saving) ? 1 : 0.45, cursor: (form.amount && !saving) ? 'pointer' : 'not-allowed' }}
                disabled={!form.amount || saving}
                onClick={handleSave}
              >
                {saving ? t('common.saving') : t('payments.savePayment')}
              </button>
            </div>
          </>
        )}

      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Coaches get their own dashboard (clients, today's classes, follow-ups);
// everyone else gets the gym's.
export default function DashboardPage() {
  return isFitness(getRole()) ? <CoachDashboard /> : <GymDashboard />;
}

function GymDashboard() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const auth = getAuth();
  const userName = auth?.user ? `${auth.user.firstName} ${auth.user.lastName}` : 'Manager';
  const role = getRole();
  const canManage  = ['general_manager', 'manager', 'front_desk'].includes(role);
  const canPayment = ['general_manager', 'manager'].includes(role);

  const isMobile = useIsMobile();

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showNoPackageWarn, setShowNoPackageWarn] = useState(false);
  // The owner's setup list, from the server so every browser agrees
  const setup = useSetupStatus();
  const setupActive = !!setup && !setup.complete;
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAddTask,      setShowAddTask]      = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showEOD, setShowEOD] = useState(false);
  // Only shifts that have run past when they should have ended. The end-of-day
  // report shows every open one; the dashboard only nags about the late ones.
  const openShifts = useOpenShifts(canManage, { overdueOnly: true });
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Cache scoped to gymId so different accounts never share data
  const gymId = auth?.user?.gymId || 'default';
  const cacheKey = (k) => `gem_dash_${gymId}_${k}`;
  const cache = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(cacheKey(key)) || 'null'); if (v == null) return fallback; if (Array.isArray(fallback) && !Array.isArray(v)) return fallback; return v; } catch { return fallback; } };
  const setCache = (key, val) => { try { localStorage.setItem(cacheKey(key), JSON.stringify(val)); } catch {} };

  const [membersList, setMembersList] = useState(() => cache('members', []));
  const [staffList, setStaffList] = useState(() => cache('staff', []));
  const [checkins, setCheckins] = useState(() => cache('checkins', []));
  const [payments, setPayments] = useState(() => { const c = cache('payments', []); return Array.isArray(c) ? c : []; });
  const [shopToday, setShopToday] = useState(() => { const c = cache('shopToday', []); return Array.isArray(c) ? c : []; });
  const [todayEvents, setTodayEvents] = useState(() => cache('events', []));
  const [notifs, setNotifs] = useState(() => cache('notifs', []));
  const [packagesList, setPackagesList] = useState(() => cache('packages', []));
  const [gymData, setGymData] = useState(() => cache('gym', {}));
  const [myTasks, setMyTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  // A dashboard that has been open before renders its last known figures at
  // once and quietly refreshes them. A first visit has nothing to show, and
  // eight requests landing one after another made the page assemble itself in
  // front of the reader - every card popping in, every number counting up from
  // zero. It waits for the batch and appears in one piece instead.
  const [ready, setReady] = useState(() => cache('members', null) !== null);

  const today = todayStr();

  const loadDashboard = () => {
    const todayParam = today;
    const upd = (setter, key) => (res) => {
      const d = res.data || (Array.isArray(res.data) ? [] : {});
      setter(d);
      setCache(key, d);
    };
    softAll([
      getMembers(),
      getAttendance({ date: todayParam }),
      // The takings are not a trainer's to read, so the call is not made
      isFitness(role) ? Promise.resolve({ data: [] }) : getPayments(),
      getCalendar({ date: todayParam }),
      getNotifications(),
      getStaff(),
      getPackages(),
      getMyGym(),
      isFitness(role) ? Promise.resolve({ data: [] }) : getSales(todayStr()),
    ]).then(([mem, att, pay, cal, not, stf, pkg, gymRes, shop]) => {
      upd(setMembersList, 'members')(mem);
      upd(setCheckins, 'checkins')(att);
      if (!isFitness(role)) { upd(setPayments, 'payments')(pay); upd(setShopToday, 'shopToday')(shop); }
      upd(setTodayEvents, 'events')(cal);
      upd(setNotifs, 'notifs')(not);
      upd(setStaffList, 'staff')(stf);
      upd(setPackagesList, 'packages')(pkg);
      const d = gymRes.data || {};
      setGymData(d);
      setCache('gym', d);
    }).finally(() => setReady(true));
    const myId = auth?.user?.id;
    if (myId) getTasks().then(r => setMyTasks((r.data || []).filter(t => t.assignedToId != null && String(t.assignedToId) === String(myId)))).catch(() => {});
  };

  useEffect(() => { loadDashboard(); }, []);
  useLiveRefresh(loadDashboard);

  const markAllRead = async () => {
    try {
      await markNotifsRead();
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    } catch {
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    }
  };

  // Everything taken in today, members and shop alike, on the gym's own day
  const todayRev = revenueOf(Array.isArray(payments) ? payments : [], shopToday, d => d === todayStr());
  const todayRevenue = todayRev.total;

  const activeMembers = membersList.filter(isActiveMember).length;

  const currentDateStr = capFirst(new Date().toLocaleDateString(getDateLocale(), {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }));

  const isFitnessRole = ['trainer', 'instructor', 'coach'].includes(role);
  const myClassesToday = todayEvents.filter(e => (e.assignedStaff || []).includes(auth?.user?.id));
  const myPendingTasks = myTasks.filter(t => t.status !== 'Done' && t.status !== 'done' && t.status !== 'completed');

  const kpis = isFitnessRole ? [
    {
      label: 'My Classes Today',
      value: myClassesToday.length,
      icon: Calendar,
      iconColor: 'var(--accent-gold)', iconBg: 'var(--accent-gold-dim)', glowColor: '#c9a96e',
      trend: myClassesToday.length === 0 ? 'none scheduled' : `${myClassesToday.map(e => e.startTime).filter(Boolean).join(', ')}`,
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/calendar'),
    },
    {
      label: 'My Tasks',
      value: myPendingTasks.length,
      icon: ClipboardList,
      iconColor: 'var(--accent-blue)', iconBg: 'var(--accent-blue-dim)', glowColor: '#60a5fa',
      trend: myPendingTasks.length === 0 ? 'all done' : `${myPendingTasks.filter(t => t.priority === 'High').length} high priority`,
      trendColor: myPendingTasks.some(t => t.priority === 'High') ? 'var(--accent-red)' : 'var(--accent-green)',
      trendBg: myPendingTasks.some(t => t.priority === 'High') ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)',
      onClick: () => navigate('/my-profile?tab=tasks'),
    },
    {
      label: t('attendance.checkInsLabel'),
      value: checkins.length,
      icon: CheckSquare,
      iconColor: 'var(--accent-green)', iconBg: 'var(--accent-green-dim)', glowColor: '#4ade80',
      trend: t('dashboard.asOfNow'),
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/attendance'),
    },
    {
      label: t('dashboard.totalMembers'),
      value: membersList.length,
      icon: Users,
      iconColor: 'var(--accent-purple)', iconBg: 'var(--accent-purple-dim)', glowColor: '#a78bfa',
      trend: `${activeMembers} ${t('common.active').toLowerCase()}`,
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/members'),
    },
  ] : [
    {
      label: t('dashboard.totalMembers'),
      value: membersList.length,
      icon: Users,
      iconColor: 'var(--accent-gold)', iconBg: 'var(--accent-gold-dim)', glowColor: '#c9a96e',
      trend: `${activeMembers} ${t('common.active').toLowerCase()}`,
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/members'),
    },
    {
      label: t('attendance.checkInsLabel'),
      value: checkins.length,
      icon: CheckSquare,
      iconColor: 'var(--accent-green)', iconBg: 'var(--accent-green-dim)', glowColor: '#4ade80',
      trend: t('dashboard.asOfNow'),
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/attendance'),
    },
    canPayment && {
      label: t('operations.revenueToday'),
      value: formatMoney(todayRevenue),
      icon: Banknote,
      iconColor: 'var(--accent-blue)', iconBg: 'var(--accent-blue-dim)', glowColor: '#60a5fa',
      trend: <RevenueSplit members={todayRev.members} shop={todayRev.shop} />,
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/accounting'),
    },
    {
      label: t('dashboard.expiringSoon'),
      value: membersList.filter(membershipEndsThisWeek).length,
      icon: AlertCircle,
      iconColor: 'var(--accent-red)', iconBg: 'var(--accent-red-dim)', glowColor: '#f87171',
      trend: t('dashboard.membersExpiring'),
      trendColor: 'var(--accent-yellow)', trendBg: 'var(--accent-yellow-dim)',
      onClick: () => navigate('/members', { state: { tab: 'Active', expiring: true } }),
    },
  ].filter(Boolean);

  const quickActions = [
    canManage      && { icon: UserPlus,  label: t('dashboard.addMember'),   action: () => { if (packagesList.length === 0) { setShowNoPackageWarn(true); return; } setShowAddMember(true); } },
    canManage      && { icon: Users,     label: t('dashboard.addVisitor'),   action: () => setShowAddVisitor(true) },
    canManage      && { icon: LogIn,     label: t('dashboard.checkIn'),      action: () => setShowCheckIn(true) },
    canPayment     && { icon: CreditCard,label: t('dashboard.addPayment'),   action: () => setShowAddPayment(true) },
                       { icon: Plus,      label: t('dashboard.addTask'),      action: () => setShowAddTask(true) },
                       { icon: Wrench,   label: t('dashboard.reportIssue'),  action: () => setShowReportIssue(true) },
    canManage      && { icon: FileText,  label: t('operations.generateEod'), action: () => setShowEOD(true) },
  ].filter(Boolean);

  const checkinRows = checkins.slice(0, isMobile ? 5 : 8);
  const paymentRows = payments.slice(0, 3);

  const thStyle = {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px',
    color: 'var(--text-muted)', padding: '10px 20px',
    background: 'rgba(255,255,255,0.01)', textAlign: 'left', fontWeight: 500,
    borderBottom: '1px solid var(--border-subtle)',
  };
  const tdStyle = { padding: '12px 20px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)' };

  // Nothing cached and nothing back yet: hold the shape of the page rather
  // than draw it empty and fill it in piece by piece.
  if (!ready) {
    return (
      <div style={{ padding: isMobile ? '16px 16px 32px' : '28px 32px', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SkeletonLine width={isMobile ? 42 : 52} height={isMobile ? 42 : 52} style={{ borderRadius: 14, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine width="38%" height={18} />
            <SkeletonLine width="24%" height={11} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, height: 116 }}>
              <SkeletonLine width="52%" height={11} />
              <SkeletonLine width="34%" height={26} />
              <SkeletonLine width="44%" height={10} />
            </div>
          ))}
        </div>
        <SkeletonCards count={3} height={68} />
      </div>
    );
  }

  return (
    <MobileCtx.Provider value={isMobile}>
    <div style={{ padding: isMobile ? '0 16px 32px' : '28px 32px', minHeight: '100%' }}>

      {/* ── Gym identity hero ─────────────────────────────────────────────── */}
      {(() => {
        const gymName = gymData?.name || auth?.user?.gymName || 'My Gym';
        const gymLocation = gymAddress(gymData);
        const logoSrc = gymData?.logo || (() => { try { return localStorage.getItem('gem_gym_logo') || null; } catch { return null; } })();
        const initials = gymName.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'G';
        const hour = new Date().getHours();
        const greeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');
        const firstName = auth?.user?.firstName || 'Manager';
        const size = isMobile ? 42 : 52;

        const logo = (
          <div style={{ width: size, height: size, borderRadius: isMobile ? 12 : 14, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: logoSrc ? 'var(--bg-elevated)' : 'var(--accent-gold-dim)', border: '1px solid var(--border-subtle)' }}>
            {logoSrc
              ? <img src={logoSrc} alt={gymName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 15 : 18, fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '-0.5px' }}>{initials}</span>}
          </div>
        );

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: isMobile ? 18 : 28 }}>
            {/* Left: gym identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 14, minWidth: 0 }}>
              {logo}
              <div style={{ minWidth: 0 }}>
                <h1 style={{
                  fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 19 : 24, fontWeight: 800,
                  letterSpacing: '-0.5px', lineHeight: 1.2, margin: 0,
                  display: 'block', width: 'fit-content', maxWidth: '100%',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  // Stays primary-coloured through most of the word, warming to
                  // gold on the tail so it reads as branding, not a colour change
                  color: 'var(--text-primary)',
                  backgroundImage: 'linear-gradient(100deg, var(--text-primary) 55%, #c9a96e 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {gymName}
                </h1>
                {gymLocation && (
                  <p style={{ fontSize: isMobile ? 11 : 12.5, color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gymLocation}
                  </p>
                )}
              </div>
            </div>
            {/* Right: who's looking, and when */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: isMobile ? 12 : 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                {greeting}, {firstName}
              </div>
              <div style={{ fontSize: isMobile ? 11 : 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {isMobile
                  ? capFirst(new Date().toLocaleDateString(getDateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }))
                  : currentDateStr}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Setup checklist */}
      {setupActive && (() => {
        const gmStaff = staffList.find(s => s.role === 'general_manager');
        const tasks = [
          { label: t('dashboard.setupTask1'), done: setup.items.ownerProfile, path: `/staff/${auth?.user?.id}`, hint: t('dashboard.setupTask1Hint') },
          { label: t('dashboard.setupTask2'), done: setup.items.settings, path: '/settings', hint: t('dashboard.setupTask2Hint') },
          { label: t('dashboard.setupTask3'), done: setup.items.packages, path: '/packages', hint: t('dashboard.setupTask3Hint') },
          { label: t('dashboard.setupTask4'), done: setup.items.staff, path: '/staff', hint: t('dashboard.setupTask4Hint') },
        ];
        const doneCount = tasks.filter(t => t.done).length;
        const pct = Math.round(doneCount / tasks.length * 100);
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: 14, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{doneCount === tasks.length ? '🎉' : '🚀'}</span>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
                    {doneCount === tasks.length ? t('dashboard.setupComplete') : t('dashboard.finishSetup')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10, fontFamily: 'DM Sans' }}>{t('dashboard.setupProgress', { done: doneCount, total: tasks.length })}</span>
                </div>
              </div>
            </div>
            <div style={{ height: 3, background: 'var(--border-subtle)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', transition: 'width 0.4s ease' }} />
            </div>
            <div>
              {tasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '10px 16px' : '11px 20px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: task.done ? 'none' : '1.5px solid var(--border)', background: task.done ? 'var(--accent-green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {task.done && <span style={{ color: '#0a0a0f', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 12 : 13, fontFamily: 'DM Sans', color: task.done ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: task.done ? 400 : 500, textDecoration: task.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.label}</div>
                    {!task.done && !isMobile && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'DM Sans' }}>{task.hint}</div>}
                  </div>
                  {!task.done && (
                    <button
                      onClick={() => navigate(task.path)}
                      style={{ background: 'var(--accent-gold-dim)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: 6, padding: isMobile ? '4px 10px' : '5px 12px', fontSize: 11, color: 'var(--accent-gold)', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                    >{t('dashboard.setupGo')}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {openShifts.length > 0 && (
        <div style={{ marginBottom: isMobile ? 14 : 20 }}>
          <OpenShiftsWarning shifts={openShifts} compact={isMobile} />
        </div>
      )}

      <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${kpis.length}, 1fr)`, gap: isMobile ? 8 : 16, marginBottom: isMobile ? 14 : 24 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} onClick={k.onClick} />)}
      </div>

      <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr 1fr' : undefined, flexWrap: 'wrap', gap: 8, marginBottom: isMobile ? 16 : 24 }}>
        {quickActions.map((a, idx) => {
          const isLastOdd = isMobile && idx === quickActions.length - 1 && quickActions.length % 2 !== 0;
          return (
            <div key={a.label} style={isLastOdd ? { gridColumn: '1 / -1' } : {}}>
              <QuickActionButton icon={a.icon} label={a.label} onClick={a.action} />
            </div>
          );
        })}
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Mobile check-ins: card list */}
          <SectionCard>
            <CardHeader
              title={t('dashboard.recentAttendance')}
              action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/attendance')} />}
            />
            {checkinRows.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('dashboard.noAttendance')}
              </div>
            ) : checkinRows.map((ci, idx) => {
              const m = ci.member;
              if (!m) return null;
              return (
                <div key={ci.id || idx} onClick={() => navigate(`/members/${m.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < checkinRows.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                >
                  {m.photo ? <img src={m.photo} alt={m.firstName} style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={34} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.firstName} {m.lastName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.member?.package?.name || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{formatTime(ci.checkIn)}</span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <MemberStatusTags member={m} typeOnly />
                      <VisitKindBadge kind={ci.kind} isVisitor={m.isVisitor} />
                    </div>
                  </div>
                </div>
              );
            })}
          </SectionCard>

          {/* Mini calendar */}
          <MiniCalendar lang={lang} />

          {/* Today's schedule */}
          <SectionCard>
            <CardHeader title={t('dashboard.todaySchedule')} action={<ViewAllLink label={t('nav.calendar') + ' →'} onClick={() => navigate('/calendar')} />} />
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayEvents.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                  {t('dashboard.noClassesToday')}
                </div>
              )}
              {todayEvents.slice(0, 3).map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'stretch', gap: 10, background: 'var(--bg-elevated)', borderRadius: 9, padding: '9px 10px' }}>
                  <div style={{ width: 3, minHeight: 36, borderRadius: 2, background: EVENT_COLORS[ev.color] || 'var(--accent-gold)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{ev.time}</span>
                      <span style={{ fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 4, padding: '1px 6px' }}>{ev.duration}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.instructor ? `${ev.instructor.firstName} ${ev.instructor.lastName}` : '-'} · {ev.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Mobile payments: card list - management/finance only */}
          {canPayment && <SectionCard>
            <CardHeader title={t('payments.paymentHistory')} action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/payments')} />} />
            {paymentRows.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('payments.noPaymentsYet')}
              </div>
            ) : paymentRows.map((p, idx) => {
              const m = p.member;
              const mc = METHOD_COLORS[p.method] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
              return (
                <div key={p.id || idx} onClick={() => setSelectedPayment(p)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < paymentRows.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                >
                  {m && (m.photo ? <img src={m.photo} alt={m.firstName} style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} size={34} />)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m ? `${m.firstName} ${m.lastName}` : '-'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{methodName(p.method, t)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payTypeName(p, t)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{formatMoney(p.amount)}</span>
                  </div>
                </div>
              );
            })}
          </SectionCard>}

        </div>
      ) : (
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Recent Check-ins */}
            <SectionCard>
              <CardHeader
                title={t('dashboard.recentAttendance')}
                action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/attendance')} />}
              />
              <div className="gem-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('attendance.member'), t('members.package'), t('attendance.time'), t('common.status')].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checkinRows.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('dashboard.noAttendance')}
                      </td>
                    </tr>
                  )}
                  {checkinRows.map((ci, idx) => {
                    const m = ci.member;
                    if (!m) return null;
                    return (
                      <tr key={ci.id || idx}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => navigate(`/members/${m.id}`)}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {m.photo ? <img src={m.photo} alt={m.firstName} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={32} />}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.firstName} {m.lastName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.memberCode}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{ci.member?.package?.name || '-'}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(ci.checkIn)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <MemberStatusTags member={m} typeOnly />
                            <VisitKindBadge kind={ci.kind} isVisitor={m.isVisitor} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </SectionCard>

            {/* Recent Payments - management/finance only */}
            {canPayment && <SectionCard>
              <CardHeader title={t('payments.paymentHistory')} action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/payments')} />} />
              <div className="gem-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('attendance.member'), t('payments.description'), t('payments.method'), t('common.amount')].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h === t('common.amount') ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('payments.noPaymentsYet')}
                      </td>
                    </tr>
                  )}
                  {paymentRows.map((p, idx) => {
                    const m = p.member;
                    const mc = METHOD_COLORS[p.method] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
                    return (
                      <tr key={p.id || idx}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedPayment(p)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {m && (m.photo ? <img src={m.photo} alt={m.firstName} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} size={32} />)}
                            <span style={{ fontWeight: 600 }}>{m ? `${m.firstName} ${m.lastName}` : '-'}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{payTypeName(p, t)}</td>
                        <td style={tdStyle}>
                          <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {methodName(p.method, t)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--accent-green)', fontWeight: 700 }}>
                          {formatMoney(p.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </SectionCard>}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <MiniCalendar lang={lang} />

            {/* Today's Schedule */}
            <SectionCard>
              <CardHeader title={t('dashboard.todaySchedule')} action={<ViewAllLink label={t('nav.calendar') + ' →'} onClick={() => navigate('/calendar')} />} />
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todayEvents.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    {t('dashboard.noClassesToday')}
                  </div>
                )}
                {todayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'stretch', gap: 12, background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ width: 3, minHeight: 40, borderRadius: 2, background: EVENT_COLORS[ev.color] || 'var(--accent-gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'monospace', fontWeight: 600 }}>{ev.time}</span>
                        <span style={{ fontSize: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 4, padding: '1px 7px' }}>
                          {ev.duration}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {ev.instructor ? `${ev.instructor.firstName} ${ev.instructor.lastName}` : '-'} · {ev.location} · {ev.spots} spots
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

          </div>
        </div>
      )}

      {/* Modals */}
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} onCreated={(newId) => { setShowAddMember(false); loadDashboard(); navigate(`/members/${newId}`); }} packagesList={packagesList} gymData={gymData ?? {}} />
      <AddVisitorModal open={showAddVisitor} onClose={() => setShowAddVisitor(false)} onCreated={(newId) => { setShowAddVisitor(false); loadDashboard(); navigate(`/members/${newId}`); }} packagesList={packagesList} gymData={gymData ?? {}} />
      <CheckInModal open={showCheckIn} onClose={() => setShowCheckIn(false)} membersList={membersList} onCheckedIn={(newCheckin) => setCheckins(prev => [newCheckin, ...prev])} />
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} staffList={staffList} onCreated={(task) => { const myId = auth?.user?.id; if (myId && task?.assignedToId != null && String(task.assignedToId) === String(myId)) setMyTasks(prev => [task, ...prev]); }} />
      <ReportIssueModal open={showReportIssue} onClose={() => setShowReportIssue(false)} />
      <EodReport open={showEOD} onClose={() => setShowEOD(false)} />
      <AddPaymentModal open={showAddPayment} onClose={() => setShowAddPayment(false)} membersList={membersList} onSaved={(newPayment) => { if (newPayment) { const paidAmt = Number(newPayment.amount) || 0; const paidMember = membersList.find(m => m.id === newPayment.memberId); setPayments(prev => [{ ...newPayment, amount: paidAmt, member: paidMember ? { id: paidMember.id, firstName: paidMember.firstName, lastName: paidMember.lastName } : null }, ...prev]); if (newPayment.memberId) { setMembersList(prev => prev.map(m => m.id === newPayment.memberId ? { ...m, balance: Math.max(0, Number(m.balance || 0) - paidAmt) } : m)); } } else { loadDashboard(); } }} />
      <TransactionModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />

      {/* No-packages warning */}
      {showNoPackageWarn && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNoPackageWarn(false)}
        >
          <div
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 32, maxWidth: 380, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
            <h3 style={{ fontFamily: 'Manrope', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('tasks.noPackagesYet')}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
              {t('tasks.noPackagesDesc')}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans' }}
                onClick={() => setShowNoPackageWarn(false)}
              >{t('common.cancel')}</button>
              <button
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', color: '#0a0a0f', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}
                onClick={() => { setShowNoPackageWarn(false); navigate('/packages'); }}
              >{t('tasks.goToPackages')} →</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </MobileCtx.Provider>
  );
}
