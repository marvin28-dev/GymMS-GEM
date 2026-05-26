import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  FileText,
  UserCheck,
  UserPlus,
  CreditCard,
  Wallet,
  Megaphone,
  BarChart2,
  Clock,
  Users,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  ClipboardList,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import { AddMemberModal } from './MembersPage';
import { getAll as getTasks, create as createTask } from '../services/tasks.service';
import { getAll as getEquipment, update as updateEquipment, create as createEquipmentIssue } from '../services/equipment.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getAttendance } from '../services/attendance.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPayments } from '../services/payments.service';
import { getAll as getExpenses } from '../services/expenses.service';

const sName = s => s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id : 'Unassigned';

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

const staffActivity = [
  { name: 'Sandrine Kom', role: 'Front Desk', activity: 'Checked in 3 members', time: '9:42 AM', color: 'blue' },
  { name: 'Marvin Ekokobe', role: 'Manager', activity: 'Recorded 2 payments', time: '9:30 AM', color: 'gold' },
  { name: 'Michel Roko', role: 'Trainer', activity: 'Started PT session', time: '9:15 AM', color: 'green' },
  { name: 'Claude Nkemeni', role: 'Instructor', activity: 'HIIT class prep', time: '9:00 AM', color: 'purple' },
  { name: 'Marie Samba', role: 'Instructor', activity: 'Updated class schedule', time: '8:50 AM', color: 'red' },
];

const priorityColors = {
  high:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)'    },
  medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)'   },
};

const EOD_DATE = 'April 21, 2026';

const eodCheckins = [
  { name: 'Armand Kamga',       id: 'GEM-0342', time: '09:42 AM', type: 'Member'  },
  { name: 'Sophie Ngono',       id: 'GEM-0518', time: '09:38 AM', type: 'Member'  },
  { name: 'Marcel Fonkoua',     id: 'GEM-0201', time: '09:31 AM', type: 'Member'  },
  { name: 'Laure Tchinda',      id: 'GEM-0729', time: '09:15 AM', type: 'Member'  },
  { name: 'Dieudonne Wamba',    id: 'GEM-0455', time: '09:02 AM', type: 'Visitor' },
  { name: 'Patrick Mekontchou', id: 'GEM-0634', time: '10:05 AM', type: 'Member'  },
  { name: 'Christelle Abena',   id: 'GEM-0711', time: '10:22 AM', type: 'Member'  },
  { name: 'Esther Kouam',       id: 'GEM-0846', time: '10:44 AM', type: 'Member'  },
  { name: 'Joëlle Abanda',      id: 'GEM-V101', time: '11:00 AM', type: 'Visitor' },
  { name: 'Bruno Talla',        id: 'GEM-0503', time: '11:30 AM', type: 'Member'  },
];

const eodRegistrations = [
  { name: 'Esther Kouam',  id: 'GEM-0846', type: 'Membership', pkg: 'Standard 6M',  amount: 75000,  time: '08:55 AM' },
  { name: 'Joëlle Abanda', id: 'GEM-V101', type: 'Visitor',    pkg: '5 Sessions',   amount: 14000,  time: '10:58 AM' },
  { name: 'Kevin Simo',    id: 'GEM-V102', type: 'Visitor',    pkg: '3 Sessions',   amount: 9000,   time: '02:15 PM' },
];

const eodSales = [
  { item: 'Whey Protein (1kg)', qty: 2, unit: 13500, total: 27000, time: '09:10 AM', method: 'Card' },
  { item: 'Water Bottle',       qty: 5, unit: 600,   total: 3000,  time: '10:30 AM', method: 'Cash' },
  { item: 'Protein Bar',        qty: 8, unit: 1200,  total: 9600,  time: '11:15 AM', method: 'Cash' },
  { item: 'Gym Gloves',         qty: 1, unit: 5400,  total: 5400,  time: '01:00 PM', method: 'Card' },
  { item: 'Energy Drink',       qty: 6, unit: 1050,  total: 6300,  time: '03:45 PM', method: 'Cash' },
  { item: 'Protein Bar',        qty: 4, unit: 1200,  total: 4800,  time: '05:20 PM', method: 'Cash' },
];

const eodPayments = [
  { member: 'Armand Kamga',     desc: 'Premium 12M Renewal',    amount: 130000, method: 'Card', time: '08:50 AM' },
  { member: 'Marcel Fonkoua',   desc: 'Personal Training (4x)', amount: 100000, method: 'Cash', time: '09:05 AM' },
  { member: 'Esther Kouam',     desc: 'Standard 6M — New',      amount: 75000,  method: 'Cash', time: '08:55 AM' },
  { member: 'Sophie Ngono',     desc: 'Outstanding Balance',     amount: 25000,  method: 'Card', time: '09:40 AM' },
  { member: 'Nadège Bisseck',   desc: 'Basic Monthly Renewal',   amount: 15000,  method: 'Cash', time: '11:20 AM' },
  { member: 'Christelle Abena', desc: 'Student Monthly',         amount: 10000,  method: 'Cash', time: '10:15 AM' },
];

const emptyTaskForm = { title: '', assignedTo: '', dueDate: '', priority: 'Medium', notes: '' };

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
            {errors.equipment && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.equipment}</div>}
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
            {errors.description && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.description}</div>}
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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.title) return;
    onSave(form);
    onClose();
    setForm(emptyTaskForm);
  };
  const handleClose = () => { onClose(); setForm(emptyTaskForm); };

  return (
    <Modal open={open} onClose={handleClose} title={t('tasks.addTask')} maxWidth={500}>
      <div style={{ display: 'grid', gap: 14 }}>
        <GemInput label={t('tasks.titleLabel')} value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('tasks.taskTitlePlaceholder')} />
        <GemSelect
          label={t('tasks.assignTo')}
          value={form.assignedTo}
          onChange={e => set('assignedTo', e.target.value)}
          options={[{ value: '', label: `— ${t('common.none')} —` }, ...staffList.map(s => ({ value: s.id, label: sName(s) }))]}
        />
        <GemInput label={t('tasks.dueDate')} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        <GemSelect
          label={t('tasks.priority')}
          value={form.priority}
          onChange={e => set('priority', e.target.value)}
          options={[['Low', t('tasks.priorityLow')], ['Medium', t('tasks.priorityMedium')], ['High', t('tasks.priorityHigh')]].map(([v, l]) => ({ value: v, label: l }))}
        />
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('tasks.notesLabel')}</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder={t('tasks.notesPlaceholder')}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
        <button style={primaryBtn} onClick={handleSave}>{t('tasks.saveTask')}</button>
      </div>
    </Modal>
  );
}

function Section({ title, icon: Icon, accent, dim, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', background: 'var(--bg-elevated)', border: 'none', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={12} color={accent} />
        </div>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{title}</span>
        {badge !== undefined && <span style={{ background: dim, color: accent, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, fontFamily: 'DM Sans', marginRight: 4 }}>{badge}</span>}
        {open ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
      </button>
      {open && <div style={{ background: 'var(--bg-card)' }}>{children}</div>}
    </div>
  );
}

const TODAY_DAY_NAME = new Date().toLocaleDateString('en-US', { weekday: 'long' });
function isWorkingToday(s) {
  if (!s.schedule || typeof s.schedule !== 'object') return true;
  const day = s.schedule[TODAY_DAY_NAME];
  return !day?.off;
}

function EODModal({ open, onClose, issues, staffList = [] }) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState('');

  const memberRev  = eodPayments.reduce((s, p) => s + p.amount, 0);
  const productRev = eodSales.reduce((s, p) => s + p.total, 0);
  const totalRev   = memberRev + productRev;
  const regRev     = eodRegistrations.reduce((s, r) => s + r.amount, 0);
  const openIssues = (issues || []).filter(i => i.status !== 'resolved');
  const fmt = n => `${n.toLocaleString('fr-FR')} FCFA`;

  const thStyle = { padding: '8px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'DM Sans' };
  const tdBase  = { padding: '9px 14px', fontFamily: 'DM Sans' };
  const rowSep  = { borderBottom: '1px solid var(--border-subtle)' };

  const handleDownload = () => {
    const sep = '─'.repeat(54);
    const lines = [
      'GEM FITNESS CENTER', `END OF DAY REPORT — ${EOD_DATE}`, sep, '',
      '── SUMMARY ──',
      `  Check-ins        : ${eodCheckins.length}`,
      `  New Registrations: ${eodRegistrations.length}`,
      `  Product Sales    : ${eodSales.length} items`,
      `  Membership Rev.  : ${fmt(memberRev)}`,
      `  Product Rev.     : ${fmt(productRev)}`,
      `  TOTAL REVENUE    : ${fmt(totalRev)}`,
      `  Open Issues      : ${openIssues.length}`, '',
      '── CHECK-INS ──',
      ...eodCheckins.map(c => `  ${c.time}  ${c.name} (${c.id}) [${c.type}]`), '',
      '── NEW REGISTRATIONS ──',
      ...eodRegistrations.map(r => `  ${r.time}  ${r.name} — ${r.type} · ${r.pkg} · ${fmt(r.amount)}`), '',
      '── MEMBERSHIP PAYMENTS ──',
      ...eodPayments.map(p => `  ${p.time}  ${p.member}  ${p.desc}  ${fmt(p.amount)}  [${p.method}]`),
      `  SUBTOTAL: ${fmt(memberRev)}`, '',
      '── PRODUCT SALES ──',
      ...eodSales.map(s => `  ${s.time}  ${s.item} ×${s.qty}  ${fmt(s.total)}  [${s.method}]`),
      `  SUBTOTAL: ${fmt(productRev)}`, '',
      '── STAFF ON DUTY ──',
      ...staffList.filter(s => s.isActive !== false && isWorkingToday(s)).map(s => `  ${sName(s)} — ${s.role || ''}${s.shiftStart ? ` (Shift: ${s.shiftStart})` : ''}`), '',
      '── EQUIPMENT ISSUES ──',
      ...(issues || []).map(i => `  [${i.status}] ${i.equipment} (${i.location}) — ${i.severity}`),
      notes ? `\n── NOTES ──\n  ${notes}` : '',
      '', sep, `Generated: ${new Date().toLocaleString('en-US')}`,
    ];
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    a.download = `EOD_${EOD_DATE.replace(/ /g, '_')}.txt`;
    a.click();
  };

  return (
    <Modal open={open} onClose={onClose} title={`End of Day Report — ${EOD_DATE}`} maxWidth={760}>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: t('operations.checkInsToday'),  value: eodCheckins.length,         icon: UserCheck,  accent: 'var(--accent-green)',  dim: 'var(--accent-green-dim)'  },
          { label: t('operations.eodNewSignups'),  value: eodRegistrations.length,    icon: UserPlus,   accent: 'var(--accent-gold)',   dim: 'var(--accent-gold-dim)'   },
          { label: t('operations.eodItemsSold'),   value: eodSales.reduce((s,x)=>s+x.qty,0), icon: ShoppingBag, accent: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
          { label: t('operations.eodMemberRev'),   value: fmt(memberRev),             icon: CreditCard, accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)' },
          { label: t('operations.eodProductRev'),  value: fmt(productRev),            icon: ShoppingBag,accent: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
          { label: t('operations.revenueToday'),   value: fmt(totalRev),              icon: TrendingUp, accent: 'var(--accent-green)',  dim: 'var(--accent-green-dim)'  },
        ].map(({ label, value, icon: Ic, accent, dim }) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic size={13} color={accent} />
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Check-ins ── */}
      <Section title={t('operations.checkInsToday')} icon={UserCheck} accent="var(--accent-green)" dim="var(--accent-green-dim)" badge={eodCheckins.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={rowSep}>{['Time','Name','ID','Type'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {eodCheckins.map((c,i) => (
              <tr key={i} style={rowSep}>
                <td style={{ ...tdBase, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.time}</td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                <td style={{ ...tdBase, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.id}</td>
                <td style={tdBase}><span style={{ background: c.type==='Member'?'var(--accent-blue-dim)':'var(--accent-purple-dim)', color: c.type==='Member'?'var(--accent-blue)':'var(--accent-purple)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{c.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ── New Registrations ── */}
      <Section title={t('operations.eodNewRegistrations')} icon={UserPlus} accent="var(--accent-gold)" dim="var(--accent-gold-dim)" badge={eodRegistrations.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={rowSep}>{['Time','Name','Type','Package','Amount'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {eodRegistrations.map((r,i) => (
              <tr key={i} style={rowSep}>
                <td style={{ ...tdBase, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.time}</td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                <td style={tdBase}><span style={{ background: r.type==='Membership'?'var(--accent-gold-dim)':'var(--accent-purple-dim)', color: r.type==='Membership'?'var(--accent-gold)':'var(--accent-purple)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{r.type}</span></td>
                <td style={{ ...tdBase, fontSize: 12, color: 'var(--text-secondary)' }}>{r.pkg}</td>
                <td style={{ ...tdBase, fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <td colSpan={4} style={{ ...tdBase, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL</td>
              <td style={{ ...tdBase, fontSize: 13, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Manrope, sans-serif' }}>{fmt(regRev)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* ── Membership Payments ── */}
      <Section title={t('operations.eodMembershipPayments')} icon={CreditCard} accent="var(--accent-blue)" dim="var(--accent-blue-dim)" badge={eodPayments.length}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={rowSep}>{['Time','Member','Description','Method','Amount'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {eodPayments.map((p,i) => (
              <tr key={i} style={rowSep}>
                <td style={{ ...tdBase, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.time}</td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.member}</td>
                <td style={{ ...tdBase, fontSize: 12, color: 'var(--text-secondary)' }}>{p.desc}</td>
                <td style={tdBase}><span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, color: 'var(--text-secondary)' }}>{p.method}</span></td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{fmt(p.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <td colSpan={4} style={{ ...tdBase, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL</td>
              <td style={{ ...tdBase, fontSize: 13, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Manrope, sans-serif' }}>{fmt(memberRev)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* ── Product Sales ── */}
      <Section title={t('operations.eodProductSales')} icon={ShoppingBag} accent="var(--accent-yellow)" dim="var(--accent-yellow-dim)" badge={`${eodSales.length} items`}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={rowSep}>{['Time','Product','Qty','Unit Price','Method','Total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {eodSales.map((s,i) => (
              <tr key={i} style={rowSep}>
                <td style={{ ...tdBase, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{s.time}</td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.item}</td>
                <td style={{ ...tdBase, fontSize: 12, color: 'var(--text-secondary)' }}>×{s.qty}</td>
                <td style={{ ...tdBase, fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(s.unit)}</td>
                <td style={tdBase}><span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, color: 'var(--text-secondary)' }}>{s.method}</span></td>
                <td style={{ ...tdBase, fontSize: 13, fontWeight: 700, color: 'var(--accent-yellow)' }}>{fmt(s.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <td colSpan={5} style={{ ...tdBase, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL</td>
              <td style={{ ...tdBase, fontSize: 13, fontWeight: 800, color: 'var(--accent-yellow)', fontFamily: 'Manrope, sans-serif' }}>{fmt(productRev)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* ── Staff on Duty ── */}
      {(() => {
        const activeStaff = staffList.filter(s => s.isActive !== false && isWorkingToday(s));
        return (
          <Section title={t('operations.staffOnDuty')} icon={Users} accent="var(--accent-purple)" dim="var(--accent-purple-dim)" badge={activeStaff.length} defaultOpen={false}>
            <div>
              {activeStaff.map((s,i,arr) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i<arr.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <Avatar firstName={s.firstName || ''} lastName={s.lastName || ''} avatarColor={['gold','green','blue','purple','red'][i%5]} size={32}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{sName(s)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{s.role}{s.department ? ` · ${s.department}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>from {s.shiftStart || '—'}</span>
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* ── Equipment Issues ── */}
      <Section title={t('operations.equipmentIssues')} icon={Wrench} accent="var(--accent-red)" dim="var(--accent-red-dim)" badge={`${openIssues.length} open`} defaultOpen={openIssues.length > 0}>
        {(issues||[]).length === 0
          ? <div style={{ padding: '18px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('operations.noIssuesReported')}</div>
          : (issues||[]).map((iss,i,arr) => (
              <div key={iss.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: i<arr.length-1?'1px solid var(--border-subtle)':'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{iss.equipment}</span>
                    {(() => { const sv = severityConfig[iss.severity] || severityConfig.medium; return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: sv.bg, color: sv.color }}>{iss.severity}</span>; })()}
                    {(() => { const sc = issueStatusConfig[iss.status] || issueStatusConfig.open; return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: sc.bg, color: sc.color }}>{iss.status}</span>; })()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{iss.location} · Reported by {iss.reportedBy}</div>
                </div>
              </div>
            ))
        }
      </Section>

      {/* ── Financial Summary ── */}
      <div style={{ border: '1px solid var(--accent-gold-dim)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'rgba(201,169,110,0.02)' }}>
        <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--accent-gold-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={13} color="var(--accent-gold)"/>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.eodFinancialSummary')}</span>
        </div>
        {[
          { label: t('operations.eodMemberRev'),       value: fmt(memberRev),  accent: null,                      bold: false },
          { label: t('operations.eodProductRev'),     value: fmt(productRev), accent: null,                      bold: false },
          { label: t('operations.revenueToday'),      value: fmt(totalRev),   accent: 'var(--accent-green)',      bold: true  },
          { label: t('operations.eodTotalExp'),       value: fmt(0),          accent: null,                      bold: false },
          { label: t('operations.eodNetRevenue'),     value: fmt(totalRev),   accent: 'var(--accent-green)',      bold: true  },
          { label: t('operations.eodOutstanding'),    value: '437 500 FCFA',  accent: 'var(--accent-yellow)',     bold: false },
        ].map((row,i,arr) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i<arr.length-1?'1px solid var(--border-subtle)':'none', background: row.bold?'rgba(201,169,110,0.04)':'transparent' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: row.bold?600:400 }}>{row.label}</span>
            <span style={{ fontSize: row.bold?15:13, fontWeight: row.bold?800:600, color: row.accent||'var(--text-primary)', fontFamily: row.bold?'Manrope, sans-serif':'DM Sans' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* ── Notes ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('operations.eodNotes')}</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder={t('operations.eodNotesPlaceholder')} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}/>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={secondaryBtn} onClick={onClose}>{t('common.close')}</button>
        <button style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownload}>
          <Download size={13}/> {t('operations.downloadReport')}
        </button>
      </div>
    </Modal>
  );
}

function SummaryCard({ label, value, icon: Icon, accent, dim, onClick }) {
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
      </div>
    </div>
  );
}

const severityConfig = {
  high:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)',    icon: AlertTriangle },
  medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)', icon: AlertTriangle },
  low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)',   icon: AlertTriangle },
};

const issueStatusConfig = {
  open:        { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)'    },
  in_progress: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  resolved:    { bg: 'var(--accent-green-dim)',  color: 'var(--accent-green)'  },
};

export default function OperationsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showEOD, setShowEOD] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [issues, setIssues] = useState([]);
  const [issueFilter, setIssueFilter] = useState('All');
  const [glanceNote, setGlanceNote] = useState('');
  const [glanceNoteSaved, setGlanceNoteSaved] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([getTasks(), getEquipment(), getStaff(), getAttendance(), getMembers(), getPayments(), getExpenses()])
      .then(([tasksRes, equipRes, staffRes, attRes, membRes, payRes, expRes]) => {
        setTasks(tasksRes.data || []);
        setIssues(equipRes.data || []);
        setStaffList(staffRes.data || []);
        setAttendance(attRes.data || []);
        setMembers(membRes.data || []);
        setPayments(payRes.data || []);
        setExpenses(expRes.data || []);
      })
      .catch(console.error);
  }, []);

  const todayAttendance = attendance.filter(a => (a.checkIn || a.createdAt || '').slice(0, 10) === todayStr);
  const todayCheckIns = todayAttendance.length;
  const todayVisitors = todayAttendance.filter(a => a.type === 'visitor' || a.memberType === 'visitor').length;
  const todayMembers = members.filter(m => (m.createdAt || '').slice(0, 10) === todayStr).length;
  const todayPayments = payments.filter(p => (p.createdAt || '').slice(0, 10) === todayStr);
  const todayRevenue = todayPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const todayExpenses = expenses.filter(e => (e.date || '').slice(0, 10) === todayStr).reduce((s, e) => s + Number(e.amount || 0), 0);
  const fmtMoney = (n) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

  const pendingTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'done');

  const handleSaveTask = async (form) => {
    const payload = {
      title: form.title,
      description: form.notes || undefined,
      assignedToId: form.assignedTo || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      priority: form.priority.toLowerCase(),
    };
    try {
      const res = await createTask(payload);
      setTasks(ts => [res.data, ...ts]);
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <PageHeader title={t('operations.title')} subtitle={t('operations.subtitle')}>
        <button style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowEOD(true)}>
          <FileText size={13} /> {t('operations.generateEod')}
        </button>
      </PageHeader>

      {/* Row 1 — 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <SummaryCard label={t('operations.checkInsToday')} value={String(todayCheckIns)} icon={UserCheck} accent="var(--accent-green)" dim="var(--accent-green-dim)" onClick={() => navigate('/attendance')} />
        <SummaryCard label={t('operations.newMembers')} value={String(todayMembers)} icon={UserPlus} accent="var(--accent-gold)" dim="var(--accent-gold-dim)" onClick={() => navigate('/members')} />
        <SummaryCard label={t('operations.paymentsReceived')} value={String(todayPayments.length)} icon={CreditCard} accent="var(--accent-blue)" dim="var(--accent-blue-dim)" onClick={() => navigate('/payments')} />
        <SummaryCard label={t('operations.revenueToday')} value={fmtMoney(todayRevenue)} icon={TrendingUp} accent="var(--accent-purple)" dim="var(--accent-purple-dim)" onClick={() => navigate('/accounting')} />
      </div>

      {/* Row 2 — 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <SummaryCard label={t('operations.visitorsToday')} value={String(todayVisitors)} icon={Users} accent="var(--accent-blue)" dim="var(--accent-blue-dim)" onClick={() => navigate('/attendance')} />
        <SummaryCard label={t('operations.staffCount')} value={String(staffList.filter(s => s.isActive !== false && isWorkingToday(s)).length)} icon={ShoppingBag} accent="var(--accent-yellow)" dim="var(--accent-yellow-dim)" onClick={() => navigate('/staff')} />
        <SummaryCard label={t('operations.expendituresToday')} value={fmtMoney(todayExpenses)} icon={TrendingDown} accent="var(--accent-red)" dim="var(--accent-red-dim)" onClick={() => navigate('/accounting')} />
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
              {staffList.filter(s => s.isActive !== false && isWorkingToday(s)).length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('operations.noStaffOnDuty')}</div>
              ) : staffList.filter(s => s.isActive !== false && isWorkingToday(s)).slice(0, 8).map((s, i, arr) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <Avatar firstName={s.firstName || ''} lastName={s.lastName || ''} avatarColor={s.avatarColor || ['gold','green','blue','purple','red'][i % 5]} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{sName(s)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 1 }}>{s.role}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} title="Active" />
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
              {pendingTasks.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('operations.allTasksDone')}</div>
              ) : pendingTasks.map((t, i) => {
                const pc = priorityColors[(t.priority || '').toLowerCase()] || priorityColors.low;
                const assigneeName = typeof t.assignedTo === 'string' ? (t.assignedTo || 'Unassigned') : (t.assignedTo ? sName(t.assignedTo) : 'Unassigned');
                const dueDisplay = t.dueDate ? String(t.dueDate).slice(0, 10) : '—';
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: i < pendingTasks.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <ClipboardList size={15} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t.title}</span>
                        <span style={{ ...pc, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.priority}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>
                        {assigneeName} · {t('operations.due')} {dueDisplay}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
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
                      <span style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'DM Sans' }}>{openCount} open</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['All', t('common.all')], ['Open', t('operations.issueOpen')], ['In Progress', t('tasks.statusInProgress')], ['Resolved', t('operations.issueResolved')]].map(([key, label]) => (
                      <button key={key} onClick={() => setIssueFilter(key)} style={{ background: issueFilter === key ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: issueFilter === key ? '#0a0a0f' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{label}</button>
                    ))}
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                    <CheckCircle2 size={28} color="var(--accent-green)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('operations.noIssues')}</div>
                  </div>
                ) : (
                  <div style={{ padding: '8px 0' }}>
                    {filtered.map((issue, i) => {
                      const sev = severityConfig[issue.severity] || severityConfig.medium;
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
                              <span style={{ background: sev.bg, color: sev.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, fontFamily: 'DM Sans' }}>{issue.severity}</span>
                              <span style={{ background: ist.bg, color: ist.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, fontFamily: 'DM Sans' }}>{issue.status}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.5, marginBottom: 6, paddingLeft: 36 }}>{issue.description}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 36 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{issue.reportedAt ? String(issue.reportedAt).slice(0, 10) : '—'}</span>
                            {issue.status !== 'resolved' && (
                              <button
                                onClick={async () => {
                                  const nextStatus = issue.status === 'open' ? 'in_progress' : 'resolved';
                                  try {
                                    const res = await updateEquipment(issue.id, { status: nextStatus });
                                    setIssues(prev => prev.map(it => it.id === issue.id ? res.data : it));
                                  } catch (err) { console.error(err); }
                                }}
                                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 11, color: 'var(--text-secondary)', padding: '3px 8px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}
                              >
                                {issue.status === 'open' ? t('operations.markInProgress') : t('operations.markResolved')}
                              </button>
                            )}
                          </div>
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
                { label: t('operations.recordCheckIn'), icon: UserCheck, accent: 'var(--accent-green)', dim: 'var(--accent-green-dim)', action: () => navigate('/attendance') },
                { label: t('dashboard.addMember'), icon: UserPlus, accent: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', action: () => setShowAddMember(true) },
                { label: t('operations.recordPayment'), icon: CreditCard, accent: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)', action: () => navigate('/payments') },
                { label: t('dashboard.recordExpense'), icon: Wallet, accent: 'var(--accent-red)', dim: 'var(--accent-red-dim)', action: () => navigate('/accounting') },
                { label: t('operations.sendAnnouncement'), icon: Megaphone, accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', action: () => navigate('/communication') },
                { label: t('tasks.addTask'), icon: ClipboardList, accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', action: () => setShowAddTask(true) },
                { label: t('operations.reportIssue'), icon: Wrench, accent: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)', action: () => setShowReportIssue(true) },
              ].map(({ label, icon: Icon, accent, dim, action }) => (
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

          {/* Today at a Glance */}
          <div style={card}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('operations.todayGlance')}</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('operations.openingHours')}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>6:00 AM – 10:00 PM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('operations.currentOccupancy')}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', fontFamily: 'DM Sans' }}>42 members present</span>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('operations.shiftNotes')}</label>
                <textarea
                  rows={3}
                  value={glanceNote}
                  onChange={e => { setGlanceNote(e.target.value); setGlanceNoteSaved(false); }}
                  placeholder={t('operations.shiftNotesPlaceholder')}
                  style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {glanceNoteSaved && (
                    <span style={{ fontSize: 11, color: 'var(--accent-green)', fontFamily: 'DM Sans' }}>✓ {t('operations.saved')}</span>
                  )}
                  <button
                    onClick={() => { if (glanceNote.trim()) setGlanceNoteSaved(true); }}
                    disabled={!glanceNote.trim() || glanceNoteSaved}
                    style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: glanceNote.trim() && !glanceNoteSaved ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans', opacity: glanceNote.trim() && !glanceNoteSaved ? 1 : 0.45 }}
                  >
                    {t('operations.saveNote')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EODModal open={showEOD} onClose={() => setShowEOD(false)} issues={issues} staffList={staffList} />
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} onSave={handleSaveTask} staffList={staffList} />
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} />
      <ReportIssueModal open={showReportIssue} onClose={() => setShowReportIssue(false)} />
    </div>
  );
}
