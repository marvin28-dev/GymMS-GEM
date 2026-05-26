import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, CheckSquare, Banknote, AlertCircle,
  UserPlus, LogIn, CreditCard, ShoppingBag, Plus, FileText, Wrench,
  ChevronLeft, ChevronRight, Printer, Lock, Search, Calendar,
} from 'lucide-react';

import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import VisitorCodeModal from '../components/ui/VisitorCodeModal';
import { AddMemberModal, AddVisitorModal } from './MembersPage';
import { TransactionModal } from './PaymentsPage';

import { getAuth } from '../utils/auth';
import { getAll as getAttendance, checkIn as checkInApi } from '../services/attendance.service';
import { getAll as getPayments, create as createPayment } from '../services/payments.service';
import { getAll as getCalendar } from '../services/calendar.service';
import { getAll as getNotifications, markAllRead as markNotifsRead } from '../services/notifications.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { create as createTask } from '../services/tasks.service';
import { create as createEquipmentIssue } from '../services/equipment.service';
import { getAll as getPackages } from '../services/packages.service';
import { getMyGym } from '../services/gym.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatMoney = (amount) =>
  `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

const formatTime = (isoStr) => {
  if (!isoStr) return '--';
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
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
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, i + 1).toLocaleDateString(locale, { weekday: 'short' })
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
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? glowColor : 'var(--border-subtle)'}`,
        borderRadius: 14,
        padding: 20,
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
        width: 100, height: 100, borderRadius: '50%',
        background: glowColor, filter: 'blur(40px)', opacity: 0.15, pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={iconColor} strokeWidth={2} />
        </div>
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 8px', lineHeight: 1 }}>
        {value}
      </div>
      <span style={{ fontSize: 11, background: trendBg, color: trendColor, borderRadius: 4, padding: '3px 8px', display: 'inline-block' }}>
        {trend}
      </span>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--accent-gold-glow)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: hovered ? 'var(--accent-gold)' : 'var(--text-secondary)',
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
      }}
    >
      <Icon size={14} strokeWidth={2} />
      {label}
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
  return (
    <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
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
};

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
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
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
              <div key={idx} style={{ height: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => { if (!today_) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { if (!today_) e.currentTarget.style.background = 'transparent'; }}
              >
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
  title: '', description: '', dueDate: '', dueTime: '',
  assignedTo: '', priority: 'Medium', category: '', status: 'Pending', notes: '',
};

// ─── Add Task Modal ───────────────────────────────────────────────────────────

// ─── Report Issue Modal ───────────────────────────────────────────────────────

const issueEmpty = { equipment: '', location: '', description: '', severity: 'Medium' };

function ReportIssueModal({ open, onClose }) {
  const [form, setForm] = useState(issueEmpty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => { setForm(issueEmpty); setErrors({}); setSuccess(false); onClose(); };
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const e = {};
    if (!form.equipment.trim()) e.equipment = 'Equipment name is required';
    if (!form.description.trim()) e.description = 'Description is required';
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
      setErrors({ equipment: 'Failed to save issue. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Report Issue">
      {success ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>Issue Reported</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>The issue has been saved successfully.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={mLabel}>Equipment / Area *</label>
            <input style={{ ...mInputStyle, borderColor: errors.equipment ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.equipment} onChange={set('equipment')} placeholder="e.g. Treadmill #3, Men's Locker Room" />
            {errors.equipment && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.equipment}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={mLabel}>Location</label>
              <input style={mInputStyle} value={form.location} onChange={set('location')} placeholder="e.g. Ground Floor" />
            </div>
            <div>
              <label style={mLabel}>Severity</label>
              <select style={mInputStyle} value={form.severity} onChange={set('severity')}>
                {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={mLabel}>Description *</label>
            <textarea style={{ ...mInputStyle, minHeight: 80, resize: 'vertical', borderColor: errors.description ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.description} onChange={set('description')} placeholder="Describe the issue in detail..." />
            {errors.description && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button style={mSecondaryBtn} onClick={handleClose}>Cancel</button>
            <button style={{ ...mPrimaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Submitting...' : 'Report Issue'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function AddTaskModal({ open, onClose, staffList = [] }) {
  const [form, setForm] = useState(taskEmptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleClose = () => { setForm(taskEmptyForm); setErrors({}); onClose(); };
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.dueDate) e.dueDate = 'Due date is required';
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        dueTime: form.dueTime,
        assignedToId: form.assignedTo || undefined,
        priority: form.priority,
        category: form.category,
        status: form.status,
        notes: form.notes,
      });
      handleClose();
    } catch {
      setErrors({ title: 'Failed to save task. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Task">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={mLabel}>Title *</label>
          <input style={{ ...mInputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={set('title')} placeholder="Task title" />
          {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
        </div>
        <div>
          <label style={mLabel}>Description</label>
          <textarea style={{ ...mInputStyle, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={set('description')} placeholder="Task description..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLabel}>Due Date *</label>
            <input type="date" style={{ ...mInputStyle, borderColor: errors.dueDate ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.dueDate} onChange={set('dueDate')} />
            {errors.dueDate && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.dueDate}</div>}
          </div>
          <div>
            <label style={mLabel}>Due Time</label>
            <input type="time" style={mInputStyle} value={form.dueTime} onChange={set('dueTime')} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLabel}>Assign To</label>
            <select style={mInputStyle} value={form.assignedTo} onChange={set('assignedTo')}>
              <option value="">Select staff...</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={mLabel}>Priority</label>
            <select style={mInputStyle} value={form.priority} onChange={set('priority')}>
              {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLabel}>Status</label>
            <select style={mInputStyle} value={form.status} onChange={set('status')}>
              {['Pending', 'In Progress', 'Done'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={mLabel}>Category</label>
            <input style={mInputStyle} value={form.category} onChange={set('category')} placeholder="e.g. Maintenance" />
          </div>
        </div>
        <div>
          <label style={mLabel}>Notes</label>
          <textarea style={{ ...mInputStyle, minHeight: 56, resize: 'vertical' }} value={form.notes} onChange={set('notes')} placeholder="Additional notes..." />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button style={mSecondaryBtn} onClick={handleClose}>Cancel</button>
          <button style={{ ...mPrimaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── EOD Report Modal ─────────────────────────────────────────────────────────

function EODModal({ open, onClose, checkins = [], payments = [], events = [], members = [] }) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const membersOwing = members.filter(m => (m.balance || 0) > 0);
  const totalOutstanding = membersOwing.reduce((sum, m) => sum + (m.balance || 0), 0);

  const Row = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  const SectionHeading = ({ title }) => (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 16, marginBottom: 4 }}>
      {title}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="End of Day Report" maxWidth={500}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{dateStr}</div>

        <SectionHeading title="Attendance" />
        <Row label="Today's Check-ins" value={checkins.length} />
        <Row label="Scheduled Classes" value={events.length} />

        <SectionHeading title="Finance" />
        <Row label="Today's Revenue" value={formatMoney(totalRevenue)} color="var(--accent-green)" />
        <Row label="Members with Balance Due" value={membersOwing.length} color={membersOwing.length > 0 ? 'var(--accent-red)' : undefined} />
        <Row label="Total Outstanding" value={formatMoney(totalOutstanding)} color={totalOutstanding > 0 ? 'var(--accent-red)' : 'var(--accent-green)'} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={mSecondaryBtn} onClick={onClose}>Close</button>
          <button style={mPrimaryBtn} onClick={() => window.print()}>
            <Printer size={13} strokeWidth={2} /> Print Report
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Check-In Modal ───────────────────────────────────────────────────────────

function CheckInModal({ open, onClose, membersList = [], onCheckedIn }) {
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

  const trimmed = search.trim();
  const lower = trimmed.toLowerCase();
  const found = trimmed.length >= 1
    ? membersList.find(m =>
        m.accessCode === trimmed ||
        m.memberCode === trimmed ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
        (m.phone || '').toLowerCase().includes(lower)
      )
    : null;
  const foundByCode = !!(found && found.accessCode === trimmed);

  const hasPhoto = !!(found?.photo);
  const isVisitorFound = !!(found && (found.isVisitor || found.status === 'visitor'));
  const needsCodeVerify = !!(found && !foundByCode && !isVisitorFound && !hasPhoto);

  const handleClose = () => { setSearch(''); setCheckedIn(false); setError(''); setCodeInput(''); setCodeError(''); onClose(); };

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
      setError(err.response?.data?.error || 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = () => {
    if (!found) return;
    if (isVisitorFound && !foundByCode) { setVisitorCodeOpen(true); return; }
    if (needsCodeVerify) return;
    doCheckIn();
  };

  const verifyAndCheckIn = () => {
    const code = codeInput.trim();
    if (!code) { setCodeError('Please enter the access code.'); return; }
    if (code !== found.accessCode) { setCodeError('Incorrect access code. Try again.'); return; }
    setCodeError('');
    doCheckIn();
  };

  const openProfile = () => { if (found) { handleClose(); navigate(`/members/${found.id}`); } };

  return (
    <>
    <Modal open={open} onClose={handleClose} title="Quick Check-In" maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); setCheckedIn(false); setError(''); }}
          placeholder="Enter access code, name, phone, or member code..."
          style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-gold)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
        />

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
                  <StatusBadge status={found.status} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                  {found.memberCode} · {found.package?.name || '—'}
                </div>
                {(found.balance || 0) > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    ⚠ Owes {formatMoney(found.balance)}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: hovered ? 'var(--accent-gold)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                View profile →
              </span>
            </div>
          </div>
        )}

        {checkedIn && found && (
          <div style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-green)', textAlign: 'center' }}>
            ✓ {found.firstName} {found.lastName} checked in successfully!
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
              No photo on file — enter <strong style={{ color: 'var(--text-primary)' }}>{found.firstName}'s</strong> access code to verify identity
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && verifyAndCheckIn()}
                placeholder="Access code…"
                style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid ${codeError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', letterSpacing: '0.5px' }}
                onFocus={e => { if (!codeError) e.target.style.borderColor = 'var(--accent-gold)'; }}
                onBlur={e => { if (!codeError) e.target.style.borderColor = 'var(--border-subtle)'; }}
              />
              <button onClick={verifyAndCheckIn} disabled={loading} style={{ ...mPrimaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Checking in...' : 'Verify & Check In'}
              </button>
            </div>
            {codeError && <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>⚠ {codeError}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={mSecondaryBtn}>Cancel</button>
          {!needsCodeVerify && (
            <button
              onClick={handleCheckIn}
              disabled={!found || loading || checkedIn}
              style={{ background: found && !loading && !checkedIn ? 'linear-gradient(135deg, #c9a96e, #b08d4a)' : 'var(--bg-elevated)', color: found && !loading && !checkedIn ? '#0a0a0f' : 'var(--text-muted)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: found && !loading && !checkedIn ? 'pointer' : 'default', fontFamily: 'DM Sans' }}
            >
              {loading ? 'Checking in...' : 'Check In'}
            </button>
          )}
        </div>
      </div>
    </Modal>
    {photoLightbox && (
      <div onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
        <img src={photoLightbox} alt="Profile" style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
        <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>Click anywhere to close</div>
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
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  const handleSave = async () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
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
      });
      onSaved?.(res.data);
      onClose();
    } catch {
      setErrors({ amount: 'Failed to save payment. Try again.' });
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
    <Modal open={open} onClose={onClose} title="Add Payment" maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Step 1: Search for member ── */}
        {view === 'search' && (
          <>
            <div>
              <label style={lbl}>Search for a member</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  style={{ ...inp, paddingLeft: 32 }}
                  placeholder="Name or member code..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                />
                {filteredMembers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, marginTop: 4, overflow: 'hidden' }}>
                    {filteredMembers.map(m => (
                      <div key={m.id}
                        onClick={() => setSelectedMember(m)}
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
                            owes {formatMoney(m.balance)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={mSecondaryBtn} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* ── Step 2a: Member has no outstanding balance ── */}
        {view === 'no-balance' && (
          <>
            <MemberChip gold={false} />
            <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>No Outstanding Balance</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {selectedMember.firstName} {selectedMember.lastName} has no pending payments due.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={mSecondaryBtn} onClick={() => setSelectedMember(null)}>← Back</button>
              <button style={mSecondaryBtn} onClick={onClose}>Close</button>
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
                <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Outstanding Balance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope' }}>{formatMoney(owedBalance)}</div>
              </div>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, amount: String(owedBalance) }))}
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}
              >Pay in Full</button>
            </div>

            {/* Reference */}
            <div>
              <label style={lbl}>Reference <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(auto-generated)</span></label>
              <div style={{ ...inp, background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', userSelect: 'all' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0, display: 'inline-block' }} />
                {ref}
              </div>
            </div>

            {/* Amount + Method */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Amount (FCFA) *</label>
                <input type="number" min="0"
                  style={{ ...inp, border: `1px solid ${errors.amount ? 'var(--accent-red)' : 'var(--border-subtle)'}` }}
                  value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setErrors(v => ({ ...v, amount: '' })); }}
                  placeholder="0"
                />
                {errors.amount && <span style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4, display: 'block' }}>{errors.amount}</span>}
              </div>
              <div>
                <label style={lbl}>Method *</label>
                <select style={inp} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  {['Cash', 'Card', 'Bank Transfer', 'Mobile Pay'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <label style={lbl}>Payment Type</label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="membership">Membership</option>
                <option value="registration">Registration Fee</option>
                <option value="product">Product</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={lbl}>Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Premium 12M Renewal" />
            </div>

            {/* Date locked */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
              <Lock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>Date locked to today — {todayLabel}</span>
            </div>

            {/* Balance after payment preview */}
            {payAmt > 0 && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Balance after payment</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : 'var(--text-primary)' }}>
                  {remaining === 0 ? '✓ ' : ''}{formatMoney(remaining)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
              <button style={mSecondaryBtn} onClick={onClose}>Cancel</button>
              <button
                style={{ ...mPrimaryBtn, opacity: (form.amount && !saving) ? 1 : 0.45, cursor: (form.amount && !saving) ? 'pointer' : 'not-allowed' }}
                disabled={!form.amount || saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          </>
        )}

      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const auth = getAuth();
  const userName = auth?.user ? `${auth.user.firstName} ${auth.user.lastName}` : 'Manager';

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showAddTask,      setShowAddTask]      = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showEOD, setShowEOD] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Cache scoped to gymId so different accounts never share data
  const gymId = auth?.user?.gymId || 'default';
  const cacheKey = (k) => `gem_dash_${gymId}_${k}`;
  const cache = (key, fallback) => { try { return JSON.parse(localStorage.getItem(cacheKey(key)) || 'null') ?? fallback; } catch { return fallback; } };
  const setCache = (key, val) => { try { localStorage.setItem(cacheKey(key), JSON.stringify(val)); } catch {} };

  const [membersList, setMembersList] = useState(() => cache('members', []));
  const [staffList, setStaffList] = useState(() => cache('staff', []));
  const [checkins, setCheckins] = useState(() => cache('checkins', []));
  const [payments, setPayments] = useState(() => cache('payments', []));
  const [todayEvents, setTodayEvents] = useState(() => cache('events', []));
  const [notifs, setNotifs] = useState(() => cache('notifs', []));
  const [packagesList, setPackagesList] = useState(() => cache('packages', []));
  const [gymData, setGymData] = useState(() => cache('gym', {}));
  const [loadingData, setLoadingData] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadDashboard = () => {
    const todayParam = today;
    const upd = (setter, key) => (res) => {
      const d = res.data || (Array.isArray(res.data) ? [] : {});
      setter(d);
      setCache(key, d);
    };
    getMembers().then(upd(setMembersList, 'members')).catch(() => {});
    getAttendance({ date: todayParam }).then(upd(setCheckins, 'checkins')).catch(() => {});
    getPayments().then(upd(setPayments, 'payments')).catch(() => {});
    getCalendar({ date: todayParam }).then(upd(setTodayEvents, 'events')).catch(() => {});
    getNotifications().then(upd(setNotifs, 'notifs')).catch(() => {});
    getStaff().then(upd(setStaffList, 'staff')).catch(() => {});
    getPackages().then(upd(setPackagesList, 'packages')).catch(() => {});
    getMyGym().then(r => { const d = r.data || {}; setGymData(d); setCache('gym', d); }).catch(() => {});
  };

  useEffect(() => { loadDashboard(); }, []);

  const markAllRead = async () => {
    try {
      await markNotifsRead();
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    } catch {
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    }
  };

  const todayRevenue = payments
    .filter(p => p.createdAt?.slice(0, 10) === today)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const activeMembers = membersList.filter(m => m.status === 'active').length;

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const kpis = [
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
      trend: 'as of now',
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/attendance'),
    },
    {
      label: t('operations.revenueToday'),
      value: formatMoney(todayRevenue),
      icon: Banknote,
      iconColor: 'var(--accent-blue)', iconBg: 'var(--accent-blue-dim)', glowColor: '#60a5fa',
      trend: `${payments.filter(p => p.createdAt?.slice(0, 10) === today).length} transactions`,
      trendColor: 'var(--accent-green)', trendBg: 'var(--accent-green-dim)',
      onClick: () => navigate('/accounting'),
    },
    {
      label: t('dashboard.expiringSoon'),
      value: membersList.filter(m => m.status === 'expiring').length,
      icon: AlertCircle,
      iconColor: 'var(--accent-red)', iconBg: 'var(--accent-red-dim)', glowColor: '#f87171',
      trend: t('dashboard.membersExpiring'),
      trendColor: 'var(--accent-yellow)', trendBg: 'var(--accent-yellow-dim)',
      onClick: () => navigate('/members', { state: { tab: 'Active', expiring: true } }),
    },
  ];

  const quickActions = [
    { icon: UserPlus, label: t('dashboard.addMember'), action: () => setShowAddMember(true) },
    { icon: Users, label: t('dashboard.addVisitor'), action: () => setShowAddVisitor(true) },
    { icon: LogIn, label: t('dashboard.checkIn'), action: () => setShowCheckIn(true) },
    { icon: CreditCard, label: t('dashboard.addPayment'), action: () => setShowAddPayment(true) },
{ icon: Plus, label: t('dashboard.addTask'), action: () => setShowAddTask(true) },
    { icon: Wrench, label: t('dashboard.reportIssue'), action: () => setShowReportIssue(true) },
    { icon: FileText, label: t('operations.generateEod'), action: () => setShowEOD(true) },
  ];

  const checkinRows = checkins.slice(0, 8);
  const paymentRows = payments.slice(0, 3);

  const thStyle = {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px',
    color: 'var(--text-muted)', padding: '10px 20px',
    background: 'rgba(255,255,255,0.01)', textAlign: 'left', fontWeight: 500,
    borderBottom: '1px solid var(--border-subtle)',
  };
  const tdStyle = { padding: '12px 20px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)' };

  return (
    <div className="page-fade" style={{ padding: '28px 32px', minHeight: '100%' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {t('dashboard.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {currentDateStr} &nbsp;·&nbsp; Welcome back, {userName}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} onClick={k.onClick} />)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {quickActions.map(a => (
          <QuickActionButton key={a.label} icon={a.icon} label={a.label} onClick={a.action} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Recent Check-ins */}
          <SectionCard>
            <CardHeader
              title={t('dashboard.recentAttendance')}
              action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/attendance')} />}
            />
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
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{ci.member?.package?.name || '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(ci.checkIn)}</td>
                      <td style={tdStyle}><StatusBadge status={m.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>

          {/* Recent Payments */}
          <SectionCard>
            <CardHeader title={t('payments.paymentHistory')} action={<ViewAllLink label={t('dashboard.viewAll') + ' →'} onClick={() => navigate('/payments')} />} />
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
                          <span style={{ fontWeight: 600 }}>{m ? `${m.firstName} ${m.lastName}` : '—'}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{p.note || p.description || p.type}</td>
                      <td style={tdStyle}>
                        <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>
                          {p.method}
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
          </SectionCard>
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
                      {ev.instructor ? `${ev.instructor.firstName} ${ev.instructor.lastName}` : '—'} · {ev.location} · {ev.spots} spots
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard>
            <CardHeader
              title={t('nav.notifications')}
              action={
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'DM Sans, sans-serif' }}>
                  {t('common.markAsPaid')}
                </button>
              }
            />
            <div style={{ padding: '8px 0' }}>
              {notifs.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  {t('common.noData')}
                </div>
              )}
              {notifs.slice(0, 6).map((n, idx) => (
                <div key={n.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', background: !n.isRead ? 'var(--accent-gold-glow)' : 'transparent', borderRadius: !n.isRead ? 8 : 0, margin: !n.isRead ? '0 8px' : 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: !n.isRead ? 'var(--accent-gold)' : 'var(--text-muted)', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: !n.isRead ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.4, fontWeight: !n.isRead ? 500 : 400 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Modals */}
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} onCreated={(newId) => { setShowAddMember(false); navigate(`/members/${newId}`); }} packagesList={packagesList} gymData={gymData ?? {}} />
      <AddVisitorModal open={showAddVisitor} onClose={() => setShowAddVisitor(false)} onCreated={(newId) => { setShowAddVisitor(false); navigate(`/members/${newId}`); }} packagesList={packagesList} gymData={gymData ?? {}} />
      <CheckInModal open={showCheckIn} onClose={() => setShowCheckIn(false)} membersList={membersList} onCheckedIn={(newCheckin) => setCheckins(prev => [newCheckin, ...prev])} />
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} staffList={staffList} />
      <ReportIssueModal open={showReportIssue} onClose={() => setShowReportIssue(false)} />
      <EODModal open={showEOD} onClose={() => setShowEOD(false)} checkins={checkins} payments={payments} events={todayEvents} members={membersList} />
      <AddPaymentModal open={showAddPayment} onClose={() => setShowAddPayment(false)} membersList={membersList} onSaved={(newPayment) => { if (newPayment) { const paidAmt = Number(newPayment.amount) || 0; const paidMember = membersList.find(m => m.id === newPayment.memberId); setPayments(prev => [{ ...newPayment, amount: paidAmt, member: paidMember ? { id: paidMember.id, firstName: paidMember.firstName, lastName: paidMember.lastName } : null }, ...prev]); if (newPayment.memberId) { setMembersList(prev => prev.map(m => m.id === newPayment.memberId ? { ...m, balance: Math.max(0, Number(m.balance || 0) - paidAmt) } : m)); } } else { loadDashboard(); } }} />
      <TransactionModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
