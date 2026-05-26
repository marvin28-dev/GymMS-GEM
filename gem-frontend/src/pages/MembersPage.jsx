import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, UserPlus, Search, ChevronLeft, ChevronRight, MoreHorizontal, ChevronDown, X, MessageSquare, CreditCard, Check, SquareCheck, Lock } from 'lucide-react';
import { getAuth } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';

import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import MemberProfilePage from './MemberProfilePage';

import { getAll as getMembers, create as createMember, update as updateMember, remove as removeMember } from '../services/members.service';
import { getAll as getPackages } from '../services/packages.service';
import { getMyGym } from '../services/gym.service';
import { create as createPayment } from '../services/payments.service';
import { checkIn as checkInApi } from '../services/attendance.service';
import { uploadPhoto } from '../services/upload.service';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatMoney = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)', borderRadius: 10,
  padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif', outline: 'none',
};

const labelStyle = {
  fontSize: 12, color: 'var(--text-secondary)',
  marginBottom: 5, display: 'block',
};

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 0 };
const errorStyle = { fontSize: 11, color: 'var(--accent-red)', marginTop: 3 };

// ─── Stable modal sub-components (must be outside modal fn to avoid focus loss) ─
function ModalSectionHeader({ title }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px',
      color: 'var(--text-muted)', fontWeight: 600, marginTop: 6,
      paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)',
    }}>{title}</div>
  );
}

function ModalField({ label, required, error, children, span }) {
  return (
    <div style={{ ...fieldStyle, ...(span ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}

const thStyle = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px',
  color: 'var(--text-muted)', padding: '10px 20px',
  background: 'rgba(255,255,255,0.01)', textAlign: 'left',
  fontWeight: 500, borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 20px', fontSize: 13,
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
};

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
};

const secondaryBtn = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = !!value;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: active ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
          border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
          borderRadius: 6, padding: '6px 12px', fontSize: 12,
          color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          transition: 'all 0.15s',
        }}
      >
        {active ? value : label}
        {active
          ? <X size={11} strokeWidth={2.5} onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }} />
          : <ChevronDown size={12} strokeWidth={2} />
        }
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: 160, overflow: 'hidden',
        }}>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt === value ? '' : opt); setOpen(false); }}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                color: opt === value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                background: opt === value ? 'var(--accent-gold-dim)' : 'transparent',
                fontFamily: 'DM Sans', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={e => { if (opt !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MAIN_TAB_KEYS = ['allMembers', 'active', 'inactive', 'visitors'];
const MAIN_TABS = ['All Members', 'Active', 'Inactive', 'Visitors'];

const SESSIONS_LEFT_OPTIONS = ['1 left', '≤ 3 left', '≤ 5 left'];
const GENDER_OPTIONS   = ['Male', 'Female', 'Other'];
const JOINED_OPTIONS   = ['This week', 'This month', 'Last 3 months', 'This year'];

function filterByTab(list, tab) {
  if (tab === 'All Members') return list.filter(m => m.status !== 'visitor' && !m.isVisitor);
  if (tab === 'Active')      return list.filter(m => m.status === 'active' || m.status === 'expiring');
  if (tab === 'Visitors')    return list.filter(m => m.status === 'visitor');
  if (tab === 'Inactive')    return list.filter(m => ['suspended', 'frozen', 'expired', 'deactivated', 'pending'].includes(m.status));
  return list;
}

function applyFilters(list, { pkg, sessionsLeft, gender, joined, owing, expiring, inactiveSub, sort }) {
  let out = [...list];
  if (pkg)                         out = out.filter(m => m.package?.name === pkg);
  if (sessionsLeft === '1 left')   out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining === 1);
  if (sessionsLeft === '≤ 3 left') out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining <= 3);
  if (sessionsLeft === '≤ 5 left') out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining <= 5);
  if (gender)   out = out.filter(m => (m.gender ?? '') === gender);
  if (owing)    out = out.filter(m => (m.balance || 0) > 0);
  if (expiring) out = out.filter(m => m.status === 'expiring');
  if (inactiveSub === 'Frozen')      out = out.filter(m => m.status === 'frozen');
  if (inactiveSub === 'Expired')     out = out.filter(m => m.status === 'expired');
  if (inactiveSub === 'Deactivated') out = out.filter(m => m.status === 'deactivated');
  if (inactiveSub === 'Suspended')   out = out.filter(m => m.status === 'suspended');
  if (inactiveSub === 'Not Started') out = out.filter(m => m.status === 'pending');
  if (joined) {
    const now = new Date();
    out = out.filter(m => {
      const d = new Date(m.startDate);
      if (joined === 'This week')      { const w = new Date(now); w.setDate(now.getDate() - 7);   return d >= w; }
      if (joined === 'This month')     { return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
      if (joined === 'Last 3 months')  { const t = new Date(now); t.setMonth(now.getMonth() - 3); return d >= t; }
      if (joined === 'This year')      { return d.getFullYear() === now.getFullYear(); }
      return true;
    });
  }
  if (sort === 'Oldest')        out.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  else if (sort === 'Name A–Z') out.sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`));
  else if (sort === 'Name Z–A') out.sort((a, b) => `${b.firstName}${b.lastName}`.localeCompare(`${a.firstName}${a.lastName}`));
  else if (sort === 'Balance owed') out.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  else if (sort === 'Renewal date') out.sort((a, b) => new Date(a.endDate || '9999') - new Date(b.endDate || '9999'));
  else out.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
  return out;
}

function filterBySearch(list, term) {
  if (!term.trim()) return list;
  const t = term.toLowerCase();
  return list.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(t) ||
    (m.phone || '').toLowerCase().includes(t) ||
    (m.email || '').toLowerCase().includes(t) ||
    (m.memberCode || '').toLowerCase().includes(t) ||
    (m.accessCode || '').toLowerCase().includes(t)
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

// ─── Action Modals ────────────────────────────────────────────────────────────

function MemberEditModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({});
  useEffect(() => {
    if (member && open) {
      setForm({
        firstName: member.firstName || '', lastName: member.lastName || '',
        gender: member.gender || '', dob: member.dob || '',
        phone: member.phone || '', email: member.email || '',
        houseNumber: member.houseNumber || '', street: member.street || '',
        city: member.city || '', postalCode: member.postalCode || '',
        emergencyContact: member.emergencyContact || '',
        emergencyPhone: member.emergencyPhone || '',
        package: member.package || '',
        startDate: member.startDate || '', endDate: member.endDate || '',
      });
    }
  }, [member, open]);

  if (!member) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = (err) => ({ ...inputStyle, borderColor: err ? 'var(--accent-red)' : 'var(--border-subtle)' });

  const Section = ({ title }) => (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginTop: 4 }}>{title}</div>
  );
  const Field = ({ label, children, span }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: span ? '1 / -1' : undefined }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={`Edit — ${member.firstName} ${member.lastName}`} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        <Section title={t('members.personalInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={`${t('members.firstName')} *`}><input style={inp()} value={form.firstName} onChange={set('firstName')} placeholder={t('members.firstName')} /></Field>
          <Field label={`${t('members.lastName')} *`}><input style={inp()} value={form.lastName}  onChange={set('lastName')}  placeholder={t('members.lastName')} /></Field>
          <Field label={`${t('members.gender')} *`}>
            <select style={inp()} value={form.gender} onChange={set('gender')}>
              <option value="">{t('common.select')}</option>
              <option value="Male">{t('common.male')}</option>
              <option value="Female">{t('common.female')}</option>
              <option value="Other">{t('common.other')}</option>
            </select>
          </Field>
          <Field label={t('members.dob')}><input type="date" style={inp()} value={form.dob} onChange={set('dob')} /></Field>
          <Field label={`${t('common.phone')} *`}><input style={inp()} value={form.phone} onChange={set('phone')} placeholder="+237 6XX XXX XXX" /></Field>
          <Field label={`${t('common.email')} *`}><input style={inp()} value={form.email} onChange={set('email')} placeholder="email@example.com" /></Field>
        </div>

        <Section title={t('common.address')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('members.houseNumber')}><input style={inp()} value={form.houseNumber} onChange={set('houseNumber')} placeholder="e.g. 12B" /></Field>
          <Field label={`${t('members.street')} *`}><input style={inp()} value={form.street} onChange={set('street')} placeholder="e.g. Rue de la Paix" /></Field>
          <Field label={`${t('common.city')} *`}><input style={inp()} value={form.city} onChange={set('city')} placeholder="e.g. Douala" /></Field>
          <Field label={t('common.postalCode')}><input style={inp()} value={form.postalCode} onChange={set('postalCode')} placeholder="0000" /></Field>
          <Field label={t('common.country')} span><input style={{ ...inp(), color: 'var(--text-muted)', cursor: 'not-allowed' }} value="Cameroon" readOnly /></Field>
        </div>

        <Section title={t('members.emergencyContact')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('members.contactName')}><input style={inp()} value={form.emergencyContact} onChange={set('emergencyContact')} placeholder={t('common.fullName')} /></Field>
          <Field label={t('members.contactPhone')}><input style={inp()} value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder="+237 6XX XXX XXX" /></Field>
        </div>

        <Section title={t('members.membershipInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('members.package')}>
            <select style={inp()} value={form.package} onChange={set('package')}>
              <option value="">{t('common.select')}</option>
              <option>{member?.package?.name || ''}</option>
            </select>
          </Field>
          <Field label={t('members.startDate')}><input type="date" style={inp()} value={form.startDate} onChange={set('startDate')} /></Field>
          <Field label={t('members.endDate')}><input type="date" style={inp()} value={form.endDate} onChange={set('endDate')} /></Field>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button style={primaryBtn} onClick={onClose}>{t('common.saveChanges')}</button>
        </div>
      </div>
    </Modal>
  );
}

function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

function MemberPaymentModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const freshForm = () => ({ amount: '', method: 'Cash', reference: generateRef(), description: '', type: 'membership' });
  const [form, setForm] = useState(freshForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(freshForm()); setError(''); } }, [open]);

  if (!member) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const owedBalance = member.balance || 0;
  const payAmt      = parseFloat(form.amount) || 0;
  const remaining   = Math.max(0, owedBalance - payAmt);
  const overpay     = payAmt > owedBalance && owedBalance > 0;

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  const handleSave = async () => {
    if (!form.amount || payAmt <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true); setError('');
    try {
      await createPayment({ memberId: member.id, amount: payAmt, method: form.method, description: form.description || undefined, type: form.type, reference: form.reference });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment.');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${t('members.addPayment')} — ${member.firstName} ${member.lastName}`} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Outstanding balance banner */}
        {owedBalance === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22 }}>✓</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399', fontFamily: 'Manrope', marginBottom: 4 }}>{t('payments.accountFullyPaid')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('payments.noBalanceToCollect')}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Outstanding balance banner */}
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>{t('payments.outstandingBalance')}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope' }}>{formatMoney(owedBalance)}</div>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, amount: String(owedBalance) }))}
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
                {t('payments.payInFull')}
              </button>
            </div>

            {/* Reference */}
            <div>
              <label style={lbl}>{t('payments.reference')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('payments.autoGenerated')})</span></label>
              <div style={{ ...inp, background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', userSelect: 'all' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0, display: 'inline-block' }} />
                {form.reference}
              </div>
            </div>

            {/* Amount + Method */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{t('payments.amountLabel')}</label>
                <input type="number" min="0" style={inp} value={form.amount} onChange={set('amount')} placeholder="0" autoFocus />
              </div>
              <div>
                <label style={lbl}>{t('payments.method')} *</label>
                <select style={inp} value={form.method} onChange={set('method')}>
                  <option value="Cash">{t('payments.cash')}</option>
                  <option value="Card">{t('payments.card')}</option>
                  <option value="Bank Transfer">{t('payments.bankTransfer')}</option>
                  <option value="Mobile Pay">{t('payments.mobileMoney')}</option>
                </select>
              </div>
            </div>

            {/* Type */}
            <div>
              <label style={lbl}>{t('payments.paymentType')}</label>
              <select style={inp} value={form.type} onChange={set('type')}>
                <option value="membership">{t('payments.membership')}</option>
                <option value="registration">{t('members.registrationFee')}</option>
                <option value="product">{t('payments.product')}</option>
                <option value="other">{t('common.other')}</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={lbl}>{t('payments.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span></label>
              <input style={inp} value={form.description} onChange={set('description')} placeholder="e.g. Premium 12M Renewal" />
            </div>

            {/* Date locked */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
              <Lock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('payments.dateLocked')} — {todayLabel}</span>
            </div>

            {/* Balance preview */}
            {payAmt > 0 && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('payments.balanceAfterPayment')}</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : overpay ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                  {remaining === 0 ? '✓ ' : ''}{formatMoney(remaining)}
                  {overpay && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{t('payments.credit')}</span>}
                </span>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>⚠ {error}</div>}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          {owedBalance === 0 ? (
            <button style={primaryBtn} onClick={onClose}>{t('common.close')}</button>
          ) : (
            <>
              <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
              <button
                style={{ ...primaryBtn, opacity: (form.amount && !saving) ? 1 : 0.45, cursor: (form.amount && !saving) ? 'pointer' : 'not-allowed' }}
                disabled={!form.amount || saving} onClick={handleSave}>
                {saving ? t('common.saving') : t('payments.savePayment')}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MemberCheckinModal({ open, onClose, member, onCheckedIn }) {
  const { t } = useLanguage();
  const isVisitor = member?.isVisitor || member?.status === 'visitor';
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  useEffect(() => {
    if (open) { setDone(false); setError(''); setCodeInput(''); setCodeError(''); setCodeVerified(false); }
  }, [open]);

  if (!member) return null;

  const handleVerifyCode = () => {
    if (codeInput.trim() === member.accessCode) {
      setCodeVerified(true);
    } else {
      setCodeError(t('members.incorrectCode'));
      setCodeInput('');
    }
  };

  const handleCheckIn = async () => {
    setLoading(true); setError('');
    try {
      const res = await checkInApi({ memberId: member.id });
      const serverMember = res?.data?.member;
      if (serverMember?.passesRemaining != null) {
        onCheckedIn?.({ passesRemaining: serverMember.passesRemaining });
      }
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || t('members.incorrectCode'));
    } finally {
      setLoading(false);
    }
  };

  const memberPhoto = member.photo || null;

  if (isVisitor && !codeVerified) {
    const noPasses = (member.passesRemaining ?? 0) <= 0;
    return (
      <Modal open={open} onClose={onClose} title={t('members.visitorCheckIn')} maxWidth={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {memberPhoto
              ? <img src={memberPhoto} alt={member.firstName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <Avatar firstName={member.firstName} lastName={member.lastName} avatarColor={member.avatarColor} size={48} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{member.firstName} {member.lastName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{member.memberCode} · {t('members.visitors')} · {member.passesRemaining ?? 0} {t('members.passesRemaining')}</div>
            </div>
          </div>
          {noPasses ? (
            <>
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#ef4444', fontFamily: 'DM Sans' }}>
                {t('members.noPasses')}
              </div>
              <button style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans' }} onClick={onClose}>{t('common.close')}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t('members.askAccessCode')}
              </div>
              <input
                autoFocus
                type="password"
                maxLength={6}
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                placeholder="••••"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${codeError ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)'}`,
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 24, color: 'var(--accent-gold)',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.35em', textAlign: 'center',
                  outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              {codeError && <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'DM Sans' }}>{codeError}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...secondaryBtn, flex: 1, justifyContent: 'center' }} onClick={onClose}>{t('common.cancel')}</button>
                <button
                  style={{ ...primaryBtn, flex: 1, justifyContent: 'center', opacity: codeInput.trim() ? 1 : 0.4, cursor: codeInput.trim() ? 'pointer' : 'not-allowed' }}
                  disabled={!codeInput.trim()}
                  onClick={handleVerifyCode}
                >
                  {t('members.verify')}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('members.checkInMember')} maxWidth={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
        {memberPhoto
          ? <img src={memberPhoto} alt={member.firstName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <Avatar firstName={member.firstName} lastName={member.lastName} avatarColor={member.avatarColor} size={56} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{member.firstName} {member.lastName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{member.memberCode} · {member.package?.name || '—'}</div>
        </div>
        {done ? (
          <div style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: 'var(--accent-green)', fontWeight: 600, width: '100%' }}>
            {t('members.checkedInSuccess')}
          </div>
        ) : error ? (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-red)', width: '100%' }}>
            ⚠ {error}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button style={{ ...secondaryBtn, flex: 1, justifyContent: 'center' }} onClick={onClose}>{t('common.cancel')}</button>
            <button style={{ ...primaryBtn, flex: 1, justifyContent: 'center', opacity: loading ? 0.6 : 1 }} onClick={handleCheckIn} disabled={loading}>
              {loading ? t('members.checkingIn') : t('members.confirmCheckIn')}
            </button>
          </div>
        )}
        {(done || error) && <button style={{ ...secondaryBtn, width: '100%', justifyContent: 'center' }} onClick={onClose}>{t('common.close')}</button>}
      </div>
    </Modal>
  );
}

function MemberMessageModal({ open, onClose, member, recipients }) {
  const { t } = useLanguage();
  // recipients = array (bulk), member = single object (from row action)
  const targets = recipients && recipients.length > 0 ? recipients : (member ? [member] : []);
  const [form, setForm] = useState({ type: 'SMS', subject: '', message: '' });
  useEffect(() => { if (!open) setForm({ type: 'SMS', subject: '', message: '' }); }, [open]);
  if (targets.length === 0) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const isBulk = targets.length > 1;
  const title = isBulk ? `${t('members.messageMembers')} ${targets.length} ${t('members.title')}` : `${t('members.messageMembers')} — ${targets[0].firstName} ${targets[0].lastName}`;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Recipients preview */}
        {isBulk ? (
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6,
          }}>
            {targets.slice(0, 8).map(m => (
              <span key={m.id} style={{
                fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 20, padding: '2px 9px', color: 'var(--text-secondary)',
              }}>
                {m.firstName} {m.lastName}
              </span>
            ))}
            {targets.length > 8 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>
                +{targets.length - 8} more
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('members.messageTo')} <strong style={{ color: 'var(--text-secondary)' }}>{targets[0].phone}{form.type === 'Email' ? ` · ${targets[0].email}` : ''}</strong>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={labelStyle}>{t('members.messageType')}</label>
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            {['SMS', 'Email', 'Notification'].map(tp => <option key={tp}>{tp}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={labelStyle}>{t('members.messageTitle2')}</label>
          <input style={inputStyle} value={form.subject} onChange={set('subject')} placeholder={t('members.messageTitlePlaceholder')} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={labelStyle}>{t('members.messageBody')}</label>
          <textarea rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} value={form.message} onChange={set('message')} placeholder={t('members.messagePlaceholder')} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button style={{ ...primaryBtn, opacity: form.message.trim() && form.subject.trim() ? 1 : 0.45, cursor: form.message.trim() && form.subject.trim() ? 'pointer' : 'not-allowed' }}
            disabled={!form.message.trim() || !form.subject.trim()} onClick={onClose}>
            {isBulk ? `${t('members.sendTo')} ${targets.length}` : t('members.send')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{ ...primaryBtn, background: 'var(--accent-red)', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Action Dropdown ──────────────────────────────────────────────────────────

function ActionMenu({ member, onAction, onClose, anchorRect }) {
  const { t } = useLanguage();
  const ACTION_ITEMS = [
    { label: t('members.viewProfile'),  key: 'view'    },
    { label: t('members.checkIn'),      key: 'checkin' },
    { label: t('members.sendMessage'),  key: 'message' },
    { label: t('members.addPayment'),   key: 'payment' },
  ];
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.addEventListener('wheel', prevent, { passive: false });
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.removeEventListener('wheel', prevent);
      document.removeEventListener('touchmove', prevent);
    };
  }, []);


  if (!anchorRect) return null;

  const menuWidth = 190;
  const estimatedHeight = ACTION_ITEMS.length * 38;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUp = spaceBelow < estimatedHeight + 8;

  const style = {
    position: 'fixed',
    right: window.innerWidth - anchorRect.right,
    ...(openUp
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
    width: menuWidth,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    zIndex: 9999,
    overflow: 'hidden',
  };

  return createPortal(
    <div ref={ref} style={style}>
      {ACTION_ITEMS.map(item => (
        <button
          key={item.key}
          onClick={(e) => { e.stopPropagation(); onAction(item.key, member); onClose(); }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '9px 14px', fontSize: 13,
            color: item.danger ? 'var(--accent-red)' : 'var(--text-primary)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────


export function AddMemberModal({ open, onClose, onCreated, packagesList = [], gymData: gymDataProp = {} }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [gymData, setGymData] = useState(gymDataProp);

  useEffect(() => {
    if (open) {
      getMyGym().then(r => setGymData(r.data || {})).catch(() => {});
    }
  }, [open]);

  const emptyForm = {
    firstName: '', lastName: '', gender: '', dob: '',
    phone: '', email: '',
    houseNumber: '', street: '', city: '', postalCode: '',
    emergencyContact: '', emergencyPhone: '',
    packageId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '',
    howHeard: '', notes: '', photo: null, photoPreview: null,
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const [regFeeMethod, setRegFeeMethod] = useState('Cash');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const memberPackages = packagesList.filter(p => !p.isVisitor && p.status === 'active');

  const computeEndDate = (startStr, pkgId) => {
    const pkg = memberPackages.find(p => p.id === pkgId);
    if (!startStr || !pkg?.durationDays) return '';
    const d = new Date(startStr);
    d.setDate(d.getDate() + Number(pkg.durationDays));
    return d.toISOString().slice(0, 10);
  };

  const handlePackageChange = (pkgId) => {
    setForm(f => ({ ...f, packageId: pkgId, endDate: computeEndDate(f.startDate, pkgId) }));
  };

  const handleStartDateChange = (dateStr) => {
    setForm(f => ({ ...f, startDate: dateStr, endDate: computeEndDate(dateStr, f.packageId) }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.gender) e.gender = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.street.trim()) e.street = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.emergencyContact.trim()) e.emergencyContact = 'Required';
    if (!form.emergencyPhone.trim())   e.emergencyPhone   = 'Required';
    if (!form.packageId) e.package = 'Required';
    if (!form.howHeard) e.howHeard = 'Required';
    return e;
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    set('photo', file);
    const reader = new FileReader();
    reader.onload = (ev) => set('photoPreview', ev.target.result);
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setForm(emptyForm); setErrors({}); setApiError('');
    setRegFeeMethod('Cash');
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setApiError('');
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Member owes only the membership fee; registration fee is always collected at signup
      const selectedPkg = memberPackages.find(p => p.id === form.packageId);
      const pkgDebt = selectedPkg?.price || 0;
      const regFeeAmount = gymData.registrationFee || 0;
      const initialBalance = pkgDebt;

      const res = await createMember({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        gender: form.gender,
        dob: form.dob || undefined,
        houseNumber: form.houseNumber?.trim() || undefined,
        street: form.street?.trim() || undefined,
        city: form.city?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        emergencyContact: form.emergencyContact?.trim() || undefined,
        emergencyPhone: form.emergencyPhone?.trim() || undefined,
        packageId: form.packageId,
        startDate: form.startDate || today,
        endDate: form.endDate || undefined,
        status: 'active',
        balance: initialBalance,
        howHeard: form.howHeard || undefined,
        notes: form.notes || undefined,
      });
      const newMember = res.data;

      // Always record registration fee as a payment so a receipt can be downloaded
      if (regFeeAmount > 0) {
        try {
          await createPayment({
            memberId: newMember.id,
            amount: regFeeAmount,
            method: regFeeMethod,
            type: 'Registration Fee',
            description: 'Registration fee',
          });
        } catch (err) {
          console.error('Failed to record registration fee payment:', err);
        }
      }

      // Upload photo to Cloudinary and persist URL on the member record
      if (form.photo) {
        try {
          const photoUrl = await uploadPhoto(form.photo, 'gem/members');
          await updateMember(newMember.id, { photo: photoUrl });
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }
      reset();
      if (onCreated) {
        onCreated(newMember.id, newMember);
      } else {
        onClose();
        navigate(`/members/${newMember.id}`);
      }
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to create member. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  // SectionHeader and Field are defined at module level to keep them stable across re-renders

  const inp = (hasErr) => ({
    ...inputStyle,
    borderColor: hasErr ? 'var(--accent-red)' : 'var(--border-subtle)',
  });

  return (
    <Modal open={open} onClose={handleClose} title={t('members.addMember')} maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>

        {/* ── Photo Upload ── */}
        <ModalSectionHeader title={t('members.profilePhoto')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            background: form.photoPreview ? 'transparent' : 'var(--bg-elevated)',
            border: `2px dashed ${errors.photo ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {form.photoPreview
              ? <img src={form.photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: 'var(--text-muted)' }}>👤</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="member-photo" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
              color: 'var(--text-secondary)', fontFamily: 'DM Sans',
            }}>
              {t('members.choosePhoto')}
            </label>
            <input id="member-photo" type="file" accept="image/*" onChange={handlePhoto}
              style={{ display: 'none' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              {t('members.photoHint')}
            </div>
            {errors.photo && <div style={errorStyle}>{errors.photo}</div>}
          </div>
        </div>

        {/* ── Personal Information ── */}
        <ModalSectionHeader title={t('members.personalInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.firstName')} required error={errors.firstName}>
            <input autoComplete="given-name" style={inp(errors.firstName)} value={form.firstName}
              onChange={e => set('firstName', e.target.value)} placeholder={t('members.firstName')} />
          </ModalField>
          <ModalField label={t('members.lastName')} required error={errors.lastName}>
            <input autoComplete="family-name" style={inp(errors.lastName)} value={form.lastName}
              onChange={e => set('lastName', e.target.value)} placeholder={t('members.lastName')} />
          </ModalField>
          <ModalField label={t('members.gender')} required error={errors.gender}>
            <select style={inp(errors.gender)} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">{t('common.select')}</option>
              <option value="Male">{t('common.male')}</option>
              <option value="Female">{t('common.female')}</option>
              <option value="Other">{t('common.other')}</option>
            </select>
          </ModalField>
          <ModalField label={t('members.dob')}>
            <input autoComplete="bday" style={inp(false)} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
          </ModalField>
          <ModalField label={t('common.email')} required error={errors.email}>
            <input autoComplete="email" style={inp(errors.email)} value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </ModalField>
          <ModalField label={t('common.phoneNumber')} required error={errors.phone}>
            <input autoComplete="tel" style={inp(errors.phone)} value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="+237 6XX XXX XXX" />
          </ModalField>
        </div>

        {/* ── Address ── */}
        <ModalSectionHeader title={t('common.address')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.houseNumber')}>
            <input autoComplete="off" style={inp(false)} value={form.houseNumber}
              onChange={e => set('houseNumber', e.target.value)} placeholder="e.g. 12B" />
          </ModalField>
          <ModalField label={t('members.street')} required error={errors.street}>
            <input autoComplete="street-address" style={inp(errors.street)} value={form.street}
              onChange={e => set('street', e.target.value)} placeholder="e.g. Rue de la Paix" />
          </ModalField>
          <ModalField label={t('common.city')} required error={errors.city}>
            <input autoComplete="address-level2" style={inp(errors.city)} value={form.city}
              onChange={e => set('city', e.target.value)} placeholder="e.g. Douala" />
          </ModalField>
          <ModalField label={t('common.postalCode')}>
            <input autoComplete="postal-code" style={inp(false)} value={form.postalCode}
              onChange={e => set('postalCode', e.target.value)} placeholder="0000" />
          </ModalField>
          <ModalField label={t('common.country')} span>
            <input style={{ ...inp(false), color: 'var(--text-muted)', cursor: 'not-allowed' }}
              value="Cameroon" readOnly />
          </ModalField>
        </div>

        {/* ── Emergency Contact ── */}
        <ModalSectionHeader title={t('members.emergencyContact')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.contactName')} required error={errors.emergencyContact}>
            <input autoComplete="off" style={inp(errors.emergencyContact)} value={form.emergencyContact}
              onChange={e => set('emergencyContact', e.target.value)} placeholder={t('common.fullName')} />
          </ModalField>
          <ModalField label={t('members.contactPhone')} required error={errors.emergencyPhone}>
            <input autoComplete="off" style={inp(errors.emergencyPhone)} value={form.emergencyPhone}
              onChange={e => set('emergencyPhone', e.target.value)} placeholder="+237 6XX XXX XXX" />
          </ModalField>
        </div>

        {/* ── Membership ── */}
        <ModalSectionHeader title={t('members.membershipInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.membershipOption')} required error={errors.package}>
            <select style={inp(errors.package)} value={form.packageId} onChange={e => handlePackageChange(e.target.value)}>
              <option value="">{t('members.selectPackage')}</option>
              {memberPackages.map(p => <option key={p.id} value={p.id}>{p.name} — {(p.price || 0).toLocaleString('fr-FR')} FCFA</option>)}
            </select>
          </ModalField>
          <ModalField label={t('members.startDate')}>
            <input autoComplete="off" style={inp(false)} type="date" value={form.startDate}
              onChange={e => handleStartDateChange(e.target.value)} />
          </ModalField>
          <ModalField label={t('members.endDateAuto')}>
            {form.endDate
              ? <input autoComplete="off" style={{ ...inp(false), background: 'var(--bg-elevated)', cursor: 'not-allowed' }} type="date" value={form.endDate} readOnly tabIndex={-1} />
              : <div style={{ ...inp(false), background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{t('members.selectPackageFirst')}</div>
            }
          </ModalField>
        </div>

        {/* ── Registration Fee ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ModalSectionHeader title={t('members.registrationFee')} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '2px 10px', letterSpacing: '0.5px' }}>{t('members.dueNow')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.amountToBePaid')}>
            <div style={{ ...inp(false), background: 'var(--bg-elevated)', cursor: 'not-allowed', color: 'var(--accent-gold)', fontWeight: 700 }}>
              {(gymData?.registrationFee || 0).toLocaleString('fr-FR')} FCFA
            </div>
          </ModalField>
          <ModalField label={t('payments.paymentMethod')}>
            <select style={inp(false)} value={regFeeMethod} onChange={e => setRegFeeMethod(e.target.value)}>
              <option value="Cash">{t('payments.cash')}</option>
              <option value="Card">{t('payments.card')}</option>
              <option value="Transfer">{t('payments.transfer')}</option>
            </select>
          </ModalField>
        </div>

        {/* ── Additional Info ── */}
        <ModalSectionHeader title={t('members.additionalInfo')} />
        <ModalField label={t('members.howHeard')} required error={errors.howHeard}>
          <select style={inp(errors.howHeard)} value={form.howHeard} onChange={e => set('howHeard', e.target.value)}>
            <option value="">{t('common.select')}</option>
            <option value="Social Media">{t('members.howHeardSocialMedia')}</option>
            <option value="Friend">{t('members.howHeardFriend')}</option>
            <option value="Google">{t('members.howHeardGoogle')}</option>
            <option value="Flyer">{t('members.howHeardFlyer')}</option>
            <option value="Walk-in">{t('members.howHeardWalkIn')}</option>
            <option value="Other">{t('common.other')}</option>
          </select>
        </ModalField>
        <ModalField label={t('members.additionalNotes')}>
          <textarea
            autoComplete="off"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder={t('members.additionalNotesPlaceholder')}
            rows={3}
            style={{
              ...inp(false),
              resize: 'vertical',
              minHeight: 76,
              lineHeight: 1.6,
            }}
          />
        </ModalField>

        {apiError && (
          <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            ⚠ {apiError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={handleClose} style={secondaryBtn}>{t('common.cancel')}</button>
          <button type="button" onClick={handleSubmit} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? t('members.creating') : t('members.createMember')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Visitor Modal ────────────────────────────────────────────────────────

export function AddVisitorModal({ open, onClose, onCreated, packagesList = [], gymData = {} }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const minPct   = gymData.minUpfrontPercent   || 50;
  const deadDays = gymData.paymentDeadlineDays || 30;

  const vPkgs = packagesList
    .filter(p => p.isVisitor && p.status === 'active')
    .map(p => ({
      id: p.id,
      label: p.name,
      sessions: p.sessions || 1,
      totalPrice: p.price || 0,
      pricePerSession: p.sessions ? Math.ceil((p.price || 0) / p.sessions) : (p.price || 0),
    }));

  const emptyForm = {
    firstName: '', lastName: '', gender: '', dob: '',
    email: '', phone: '',
    houseNumber: '', street: '', city: '', postalCode: '',
    emergencyContact: '', emergencyPhone: '',
    bundleId: '',
    amountPaid: '', paymentMethod: 'Cash',
    remainderDeadline: '', howHeard: '', notes: '',
  };
  const [form, setForm]     = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedBundle = vPkgs.find(p => p.id === form.bundleId) || null;
  const totalPrice     = selectedBundle ? selectedBundle.totalPrice : 0;
  const amountPaidN    = Number(form.amountPaid) || 0;
  const remainder      = Math.max(0, totalPrice - amountPaidN);
  const minRequired    = Math.ceil(totalPrice * minPct / 100);
  const pctPaid        = totalPrice > 0 ? Math.round((amountPaidN / totalPrice) * 100) : 0;
  const meetsMinimum   = amountPaidN >= minRequired;

  const handleBundleChange = (id) => {
    const pkg = vPkgs.find(p => p.id === id);
    const minDue = pkg ? Math.ceil(pkg.totalPrice * minPct / 100) : 0;
    const dl = new Date();
    dl.setDate(dl.getDate() + deadDays);
    setForm(f => ({
      ...f,
      bundleId: id,
      amountPaid: pkg ? String(minDue) : '',
      remainderDeadline: pkg ? dl.toISOString().slice(0, 10) : '',
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim())        e.firstName        = 'Required';
    if (!form.lastName.trim())         e.lastName         = 'Required';
    if (!form.gender)                  e.gender           = 'Required';
    if (!form.email.trim())            e.email            = 'Required';
    if (!form.phone.trim())            e.phone            = 'Required';
    if (!form.street.trim())           e.street           = 'Required';
    if (!form.city.trim())             e.city             = 'Required';
    if (!form.emergencyContact.trim()) e.emergencyContact = 'Required';
    if (!form.emergencyPhone.trim())   e.emergencyPhone   = 'Required';
    if (!form.bundleId)                e.bundleId         = 'Required';
    if (!form.amountPaid)              e.amountPaid       = 'Required';
    if (!meetsMinimum)                 e.amountPaid       = `Minimum ${minPct}% required (${minRequired.toLocaleString('fr-FR')} FCFA)`;
    if (!form.howHeard)                e.howHeard         = 'Required';
    return e;
  };

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setApiError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await createMember({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        gender: form.gender,
        dob: form.dob || undefined,
        houseNumber: form.houseNumber.trim() || undefined,
        street: form.street.trim() || undefined,
        city: form.city.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        packageId: form.bundleId,
        startDate: today,
        status: 'visitor',
        isVisitor: true,
        balance: Math.max(0, (selectedBundle?.totalPrice || 0) - (Number(form.amountPaid) || 0)),
        passesTotal: selectedBundle?.sessions || 1,
        passesRemaining: selectedBundle?.sessions || 1,
        howHeard: form.howHeard || undefined,
        notes: form.notes || undefined,
      });
      const newMember = res.data;
      setForm(emptyForm); setErrors({}); setApiError('');
      if (onCreated) {
        onCreated(newMember.id, newMember);
      } else {
        onClose();
        navigate(`/members/${newMember.id}`);
      }
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to register visitor. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { setForm(emptyForm); setErrors({}); setApiError(''); onClose(); };
  const inp = (hasErr) => ({ ...inputStyle, borderColor: hasErr ? 'var(--accent-red)' : 'var(--border-subtle)' });

  return (
    <Modal open={open} onClose={handleClose} title={t('members.registerVisitor')} maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>

        {/* ── Personal Info ── */}
        <ModalSectionHeader title={t('members.personalInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.firstName')} required error={errors.firstName}>
            <input autoComplete="given-name" style={inp(errors.firstName)} value={form.firstName}
              onChange={e => set('firstName', e.target.value)} placeholder={t('members.firstName')} />
          </ModalField>
          <ModalField label={t('members.lastName')} required error={errors.lastName}>
            <input autoComplete="family-name" style={inp(errors.lastName)} value={form.lastName}
              onChange={e => set('lastName', e.target.value)} placeholder={t('members.lastName')} />
          </ModalField>
          <ModalField label={t('members.gender')} required error={errors.gender}>
            <select style={inp(errors.gender)} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">{t('common.select')}</option>
              <option value="Male">{t('common.male')}</option>
              <option value="Female">{t('common.female')}</option>
              <option value="Other">{t('common.other')}</option>
            </select>
          </ModalField>
          <ModalField label={t('members.dob')}>
            <input autoComplete="bday" style={inp(false)} type="date" value={form.dob}
              onChange={e => set('dob', e.target.value)} />
          </ModalField>
          <ModalField label={t('common.email')} required error={errors.email}>
            <input autoComplete="email" style={inp(errors.email)} value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </ModalField>
          <ModalField label={t('common.phone')} required error={errors.phone}>
            <input autoComplete="tel" style={inp(errors.phone)} value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="+237 6XX XXX XXX" />
          </ModalField>
        </div>

        {/* ── Address ── */}
        <ModalSectionHeader title={t('common.address')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.houseNumber')}>
            <input autoComplete="off" style={inp(false)} value={form.houseNumber}
              onChange={e => set('houseNumber', e.target.value)} placeholder="e.g. 12B" />
          </ModalField>
          <ModalField label={t('members.street')} required error={errors.street}>
            <input autoComplete="street-address" style={inp(errors.street)} value={form.street}
              onChange={e => set('street', e.target.value)} placeholder="e.g. Rue de la Paix" />
          </ModalField>
          <ModalField label={t('common.city')} required error={errors.city}>
            <input autoComplete="address-level2" style={inp(errors.city)} value={form.city}
              onChange={e => set('city', e.target.value)} placeholder="e.g. Douala" />
          </ModalField>
          <ModalField label={t('common.postalCode')}>
            <input autoComplete="postal-code" style={inp(false)} value={form.postalCode}
              onChange={e => set('postalCode', e.target.value)} placeholder="0000" />
          </ModalField>
          <ModalField label={t('common.country')} span>
            <input style={{ ...inp(false), color: 'var(--text-muted)', cursor: 'not-allowed' }}
              value="Cameroon" readOnly />
          </ModalField>
        </div>

        {/* ── Emergency Contact ── */}
        <ModalSectionHeader title={t('members.emergencyContact')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.contactName')} required error={errors.emergencyContact}>
            <input autoComplete="off" style={inp(errors.emergencyContact)} value={form.emergencyContact}
              onChange={e => set('emergencyContact', e.target.value)} placeholder={t('common.fullName')} />
          </ModalField>
          <ModalField label={t('members.contactPhone')} required error={errors.emergencyPhone}>
            <input autoComplete="off" style={inp(errors.emergencyPhone)} value={form.emergencyPhone}
              onChange={e => set('emergencyPhone', e.target.value)} placeholder="+237 6XX XXX XXX" />
          </ModalField>
        </div>

        {/* ── Session Bundle ── */}
        <ModalSectionHeader title={t('members.sessionBundle')} />

        {/* Bundle cards */}
        <ModalField label={t('members.chooseBundle')} required error={errors.bundleId}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            {vPkgs.sort((a, b) => a.sessions - b.sessions).map(pkg => {
              const selected = form.bundleId === pkg.id;
              return (
                <label key={pkg.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${selected ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                  background: selected ? 'var(--accent-gold-glow)' : 'var(--bg-elevated)',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="radio" name="visitorBundle" value={pkg.id}
                      checked={selected} onChange={() => handleBundleChange(pkg.id)}
                      style={{ accentColor: 'var(--accent-gold)', width: 15, height: 15 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{pkg.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {pkg.pricePerSession.toLocaleString('fr-FR')} FCFA / session
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'Manrope' }}>
                      {pkg.totalPrice.toLocaleString('fr-FR')} FCFA
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pkg.sessions} session{pkg.sessions > 1 ? 's' : ''}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </ModalField>

        {selectedBundle && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <ModalField label={`Amount Paid (min ${minPct}%)`} required error={errors.amountPaid}>
              <input autoComplete="off" style={inp(errors.amountPaid)} type="number" min="0"
                value={form.amountPaid} onChange={e => set('amountPaid', e.target.value)}
                placeholder={`Min ${minRequired.toLocaleString('fr-FR')} FCFA`} />
            </ModalField>
            <ModalField label="Payment Method">
              <select style={inp(false)} value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                <option>Cash</option><option>Card</option><option>Transfer</option>
              </select>
            </ModalField>
            {remainder > 0 && (
              <ModalField label="Remainder Due By">
                <input autoComplete="off" style={inp(false)} type="date" value={form.remainderDeadline}
                  onChange={e => set('remainderDeadline', e.target.value)} />
              </ModalField>
            )}
          </div>
        )}

        {/* Payment summary bar */}
        {totalPrice > 0 && form.amountPaid && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>Payment progress</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: meetsMinimum ? '#10b981' : '#ef4444', fontFamily: 'DM Sans' }}>
                {pctPaid}% paid · {remainder > 0 ? `${remainder.toLocaleString('fr-FR')} FCFA remaining` : 'Fully paid ✓'}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: meetsMinimum ? '#10b981' : '#ef4444',
                width: `${Math.min(100, pctPaid)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            {!meetsMinimum && totalPrice > 0 && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontFamily: 'DM Sans' }}>
                Minimum {minPct}% ({minRequired.toLocaleString('fr-FR')} FCFA) must be paid to activate account
              </div>
            )}
            {meetsMinimum && remainder === 0 && (
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontFamily: 'DM Sans' }}>
                ✓ Visitor will be registered as <strong>Active</strong>
              </div>
            )}
            {meetsMinimum && remainder > 0 && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontFamily: 'DM Sans' }}>
                ⏳ Visitor will be <strong>Active</strong> — remainder due by {form.remainderDeadline || `${deadDays} days`}
              </div>
            )}
          </div>
        )}

        {/* ── Additional Info ── */}
        <ModalSectionHeader title={t('members.additionalInfo')} />
        <ModalField label={t('members.howHeard')} required error={errors.howHeard}>
          <select style={inp(errors.howHeard)} value={form.howHeard} onChange={e => set('howHeard', e.target.value)}>
            <option value="">{t('common.select')}</option>
            <option value="Social Media">{t('members.howHeardSocialMedia')}</option>
            <option value="Friend">{t('members.howHeardFriend')}</option>
            <option value="Google">{t('members.howHeardGoogle')}</option>
            <option value="Flyer">{t('members.howHeardFlyer')}</option>
            <option value="Walk-in">{t('members.howHeardWalkIn')}</option>
            <option value="Other">{t('common.other')}</option>
          </select>
        </ModalField>
        <ModalField label={t('members.additionalNotes')}>
          <textarea autoComplete="off" value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder={t('members.additionalNotesPlaceholder')}
            rows={3} style={{ ...inp(false), resize: 'vertical', minHeight: 72, lineHeight: 1.6 }} />
        </ModalField>

        {apiError && (
          <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            ⚠ {apiError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={handleClose} style={secondaryBtn}>{t('common.cancel')}</button>
          <button onClick={handleSave} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? t('members.creating') : t('members.createVisitor')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [membersList, setMembersList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [gymData, setGymData] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab]       = useState(() => location.state?.tab || 'All Members');
  const [inactiveSub, setInactiveSub]   = useState('All Inactive');
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterPackage, setFilterPackage]         = useState('');
  const [filterSessionsLeft, setFilterSessionsLeft] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterJoined, setFilterJoined] = useState('');
  const [filterOwing, setFilterOwing]     = useState(false);
  const [filterExpiring, setFilterExpiring] = useState(() => !!location.state?.expiring);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const [openMenuId, setOpenMenuId]     = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [inlineProfileId, setInlineProfileId] = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [authAction, setAuthAction]         = useState(null);
  const [editMember, setEditMember]         = useState(null);
  const [paymentMember, setPaymentMember]   = useState(null);
  const [checkinMember, setCheckinMember]   = useState(null);
  const [messageMember, setMessageMember]         = useState(null);
  const [bulkMessageOpen, setBulkMessageOpen]     = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getMembers().catch(() => ({ data: [] })),
      getPackages().catch(() => ({ data: [] })),
      getMyGym().catch(() => ({ data: {} })),
    ]).then(([mRes, pRes, gRes]) => {
      setMembersList(mRes.data || []);
      setPackagesList(pRes.data || []);
      setGymData(gRes.data || {});
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const resetFilters = () => {
    setFilterPackage(''); setFilterSessionsLeft(''); setFilterGender(''); setFilterJoined('');
    setFilterOwing(false); setFilterExpiring(false); setInactiveSub('All Inactive'); setCurrentPage(1);
  };

  const tabCounts = Object.fromEntries(MAIN_TABS.map(t => [t, filterByTab(membersList, t).length]));

  const tabBase  = filterByTab(membersList, activeTab);
  const searched = filterBySearch(tabBase, searchTerm);
  const filtered = applyFilters(searched, {
    pkg: filterPackage, sessionsLeft: filterSessionsLeft, gender: filterGender, joined: filterJoined,
    owing: filterOwing, expiring: filterExpiring,
    inactiveSub: activeTab === 'Inactive' ? inactiveSub : '',
    sort: '',
  });

  const anyFilterActive = filterPackage || filterSessionsLeft || filterGender || filterJoined || filterOwing || filterExpiring
    || (activeTab === 'Inactive' && inactiveSub !== 'All Inactive');

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allSelected    = pagedFiltered.length > 0 && pagedFiltered.every(m => selectedIds.has(m.id));
  const someSelected   = selectedIds.size > 0;
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(pagedFiltered.map(m => m.id)));
  const toggleSelectOne = (id) => setSelectedIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const selectedMembers = filtered.filter(m => selectedIds.has(m.id));

  const MANAGER_ACTIONS = {
    freeze:  { label: (m) => `Freeze membership for ${m.firstName} ${m.lastName}`, danger: false },
    cancel:  { label: (m) => `Cancel membership for ${m.firstName} ${m.lastName}`, danger: true  },
    delete:  { label: (m) => `Permanently delete ${m.firstName} ${m.lastName}`,    danger: true  },
  };

  const handleAction = (key, member) => {
    if (key === 'view')     { navigate(`/members/${member.id}`); return; }
    if (key === 'edit')     { setEditMember(member);    return; }
    if (key === 'payment')  { setPaymentMember(member); return; }
    if (key === 'checkin')  { setCheckinMember(member); return; }
    if (key === 'message')  { setMessageMember(member); return; }
    if (MANAGER_ACTIONS[key]) {
      const cfg = MANAGER_ACTIONS[key];
      setAuthAction({ key, member, label: cfg.label(member), danger: cfg.danger });
    }
  };

  const handleAuthConfirmed = () => {
    if (!authAction) return;
    const { key, member } = authAction;
    if (key === 'delete') setConfirmDelete(member);
    setAuthAction(null);
  };

  const handleDeleteConfirmed = async (member) => {
    try {
      await removeMember(member.id);
      setMembersList(prev => prev.filter(m => m.id !== member.id));
    } catch {
      // silently fail — member stays in list
    }
  };

  const printPDF = (headers, rows, title) => {
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const thStyle = 'padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:2px solid #e5e7eb;white-space:nowrap';
    const tdStyle = 'padding:8px 12px;font-size:12px;color:#111;border-bottom:1px solid #f3f4f6;white-space:nowrap';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px;color:#111}
      h1{font-size:20px;font-weight:700;margin:0 0 4px}
      .sub{font-size:13px;color:#666;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}
      @media print{body{padding:16px}@page{margin:16mm}}
    </style></head><body>
    <h1>${title}</h1>
    <div class="sub">Generated ${date} &nbsp;·&nbsp; ${rows.length} record${rows.length !== 1 ? 's' : ''}</div>
    <table>
      <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">${r.map(c => `<td style="${tdStyle}">${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const handleExport = () => {
    const headers = ['Code', 'First Name', 'Last Name', 'Gender', 'Email', 'Phone', 'Package', 'Status', 'Start Date', 'End Date', 'Balance'];
    const rows = filtered.map(m => [
      m.memberCode, m.firstName, m.lastName, m.gender ?? '', m.email, m.phone,
      m.package?.name ?? '', m.status, m.startDate ? m.startDate.slice(0,10) : '', m.endDate ? m.endDate.slice(0,10) : '', m.balance ?? 0,
    ]);
    printPDF(headers, rows, 'GEM Members Report');
  };

  if (inlineProfileId) {
    return <MemberProfilePage memberId={inlineProfileId} onBack={() => setInlineProfileId(null)} fromFrontDesk={false} />;
  }

  return (
    <div className="page-fade" style={{ padding: '28px 32px', minHeight: '100%' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {t('members.title')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {loading ? t('common.loading') : `${membersList.length} total · ${membersList.filter(m => m.status === 'active').length} ${t('common.active').toLowerCase()} · ${membersList.filter(m => m.status === 'expiring').length} ${t('members.expiringSoon').toLowerCase()}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={secondaryBtn} onClick={handleExport}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} strokeWidth={2} />
              {t('common.export')}
            </span>
          </button>
          <button onClick={() => setShowAddVisitor(true)} style={secondaryBtn}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={13} strokeWidth={2} />
              {t('members.addVisitor')}
            </span>
          </button>
          <button onClick={() => setShowAddMember(true)} style={primaryBtn}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={13} strokeWidth={2} />
              {t('members.addMember')}
            </span>
          </button>
        </div>
      </div>

      {/* Card wrapper */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}>

        {/* ── Main Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px', alignItems: 'center' }}>
          {MAIN_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setInactiveSub('All Inactive'); resetFilters(); exitSelectionMode(); }}
              style={{
                padding: '12px 20px', fontSize: 13, cursor: 'pointer',
                background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-gold)' : 'transparent'}`,
                color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: activeTab === tab ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {t(`members.${MAIN_TAB_KEYS[MAIN_TABS.indexOf(tab)]}`) || tab}
              <span style={{
                marginLeft: 6,
                background: activeTab === tab ? 'var(--accent-gold)' : 'var(--bg-elevated)',
                color: activeTab === tab ? '#000' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 600,
                borderRadius: 10,
                padding: '1px 7px',
                transition: 'all 0.15s',
              }}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}

          {/* Select mode trigger — lives in the tab row, right side */}
          <div style={{ marginLeft: 'auto', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* When active: show how many are selected */}
            {selectionMode && selectedIds.size > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--accent-gold)',
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 20, padding: '2px 9px', transition: 'all 0.2s',
              }}>
                {selectedIds.size} {t('members.selected')}
              </span>
            )}
            <button
              title={selectionMode ? 'Exit selection' : 'Select members'}
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${selectionMode ? 'rgba(212,175,55,0.5)' : 'var(--border-subtle)'}`,
                background: selectionMode ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: selectionMode ? 'var(--accent-gold)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: selectionMode ? '0 0 0 3px rgba(212,175,55,0.08)' : 'none',
              }}
              onMouseEnter={e => {
                if (!selectionMode) {
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.35)';
                  e.currentTarget.style.color = 'var(--accent-gold)';
                  e.currentTarget.style.background = 'rgba(212,175,55,0.06)';
                }
              }}
              onMouseLeave={e => {
                if (!selectionMode) {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {selectionMode
                ? <X size={14} strokeWidth={2.5} />
                : <SquareCheck size={15} strokeWidth={1.8} />
              }
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div style={{
          padding: '12px 20px',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 220, maxWidth: 300, position: 'relative' }}>
            <Search size={14} strokeWidth={2} style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              autoComplete="new-password"
              disabled={showAddMember || showAddVisitor}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={t('members.searchPlaceholder')}
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>

          {/* Dropdowns */}
          {activeTab === 'Visitors'
            ? <FilterDropdown label="Sessions Left" options={SESSIONS_LEFT_OPTIONS} value={filterSessionsLeft} onChange={v => { setFilterSessionsLeft(v); setCurrentPage(1); }} />
            : <FilterDropdown label="Package" options={packagesList.filter(p => !p.isVisitor).map(p => p.name)} value={filterPackage} onChange={v => { setFilterPackage(v); setCurrentPage(1); }} />
          }
          <FilterDropdown label="Gender"  options={GENDER_OPTIONS}  value={filterGender}  onChange={v => { setFilterGender(v);  setCurrentPage(1); }} />
          <FilterDropdown label="Joined"  options={JOINED_OPTIONS}  value={filterJoined}  onChange={v => { setFilterJoined(v);  setCurrentPage(1); }} />

          {/* Inactive sub-status */}
          {activeTab === 'Inactive' && (
            <FilterDropdown
              label="Status"
              options={['Not Started', 'Frozen', 'Expired', 'Suspended', 'Deactivated']}
              value={inactiveSub === 'All Inactive' ? '' : inactiveSub}
              onChange={v => { setInactiveSub(v || 'All Inactive'); setCurrentPage(1); }}
            />
          )}

          {/* Toggle: Owing */}
          {(activeTab === 'Active' || activeTab === 'Visitors') && (
            <button onClick={() => { setFilterOwing(v => !v); setCurrentPage(1); }} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans', transition: 'all 0.15s',
              background: filterOwing ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
              border: `1px solid ${filterOwing ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'}`,
              color: filterOwing ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}>
              Owing
            </button>
          )}

          {/* Toggle: Expiring Soon */}
          {activeTab === 'Active' && (
            <button onClick={() => { setFilterExpiring(v => !v); setCurrentPage(1); }} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans', transition: 'all 0.15s',
              background: filterExpiring ? 'rgba(249,115,22,0.1)' : 'var(--bg-card)',
              border: `1px solid ${filterExpiring ? 'rgba(249,115,22,0.4)' : 'var(--border-subtle)'}`,
              color: filterExpiring ? '#f97316' : 'var(--text-secondary)',
            }}>
              Expiring Soon
            </button>
          )}


          {/* Clear filters */}
          {anyFilterActive && (
            <button onClick={resetFilters} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <X size={12} strokeWidth={2} /> Clear
            </button>
          )}
        </div>

        {/* Table + Pagination */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {selectionMode && (
                  <th style={{ ...thStyle, width: 44, paddingRight: 0 }}>
                    <div
                      onClick={toggleSelectAll}
                      style={{
                        width: 16, height: 16, borderRadius: 4, cursor: 'pointer',
                        border: `2px solid ${allSelected ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                        background: allSelected ? 'var(--accent-gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      {allSelected && <Check size={10} strokeWidth={3} color="#0a0a0f" />}
                    </div>
                  </th>
                )}
                {(activeTab === 'Visitors'
                  ? [t('members.member'), t('common.phone'), t('members.package'), t('members.startDate'), t('members.balance'), t('members.lastVisit'), t('members.actions')]
                  : activeTab === 'Inactive'
                  ? [t('members.member'), t('common.phone'), t('members.package'), t('members.startDate'), t('members.expiry'), 'Status', t('members.balance'), t('members.lastVisit'), t('members.actions')]
                  : [t('members.member'), t('common.phone'), t('members.package'), t('members.startDate'), t('members.expiry'), t('members.balance'), t('members.lastVisit'), t('members.actions')]
                ).map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: h === t('members.balance') ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={selectionMode ? (activeTab === 'Visitors' ? 8 : activeTab === 'Inactive' ? 10 : 9) : (activeTab === 'Visitors' ? 7 : activeTab === 'Inactive' ? 9 : 8)} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('members.loading')}
                  </td>
                </tr>
              ) : pagedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? (activeTab === 'Visitors' ? 8 : activeTab === 'Inactive' ? 10 : 9) : (activeTab === 'Visitors' ? 7 : activeTab === 'Inactive' ? 9 : 8)} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('members.noMembers')}
                  </td>
                </tr>
              ) : (
                pagedFiltered.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    hideExpiry={activeTab === 'Visitors'}
                    showStatus={activeTab === 'Inactive'}
                    isMenuOpen={openMenuId === member.id}
                    onMenuToggle={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(prev => prev === member.id ? null : member.id);
                    }}
                    onMenuClose={() => setOpenMenuId(null)}
                    onAction={handleAction}
                    onRowClick={() => navigate(`/members/${member.id}`)}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(member.id)}
                    onSelect={() => toggleSelectOne(member.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} members
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <PageBtn onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft size={14} strokeWidth={2} />
            </PageBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
              <PageBtn key={n} active={currentPage === n} onClick={() => setCurrentPage(n)}>
                {n}
              </PageBtn>
            ))}
            {totalPages > 5 && <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 2px' }}>...</span>}
            <PageBtn onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              <ChevronRight size={14} strokeWidth={2} />
            </PageBtn>
          </div>
        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      {createPortal(
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: `translateX(-50%) translateY(${someSelected ? 0 : 80}px)`,
          opacity: someSelected ? 1 : 0, pointerEvents: someSelected ? 'auto' : 'none',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 10px 16px',
          minWidth: 420,
        }}>
          {/* Count badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(212,175,55,0.15)',
              border: '1px solid rgba(212,175,55,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={14} strokeWidth={2.5} color="var(--accent-gold)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'member' : 'members'} selected
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* Send Message */}
          <button
            onClick={() => setBulkMessageOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; e.currentTarget.style.color = 'var(--accent-gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <MessageSquare size={13} strokeWidth={2} />
            Send Message
          </button>

          {/* Export selected */}
          <button
            onClick={() => {
              printPDF(
                ['Code', 'First Name', 'Last Name', 'Phone', 'Package', 'Status', 'Balance'],
                selectedMembers.map(m => [m.memberCode, m.firstName, m.lastName, m.phone, m.package?.name ?? '', m.status, m.balance ?? 0]),
                'GEM Selected Members'
              );
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; e.currentTarget.style.color = 'var(--accent-gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <Download size={13} strokeWidth={2} />
            Export
          </button>

          {/* Dismiss */}
          <button
            onClick={exitSelectionMode}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border-subtle)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', transition: 'all 0.15s', marginLeft: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>,
        document.body
      )}

      {/* Modals */}
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} onCreated={(newId) => { setShowAddMember(false); loadData(); setInlineProfileId(newId); }} packagesList={packagesList} gymData={gymData} />
      <AddVisitorModal open={showAddVisitor} onClose={() => setShowAddVisitor(false)} onCreated={(newId) => { setShowAddVisitor(false); loadData(); setInlineProfileId(newId); }} packagesList={packagesList} gymData={gymData} />
      <MemberEditModal    open={!!editMember}    onClose={() => setEditMember(null)}    member={editMember} />
      <MemberPaymentModal open={!!paymentMember} onClose={() => setPaymentMember(null)} member={paymentMember} />
      <MemberCheckinModal
        open={!!checkinMember}
        onClose={() => setCheckinMember(null)}
        member={checkinMember}
        onCheckedIn={({ passesRemaining }) => {
          setMembersList(prev => prev.map(m => m.id === checkinMember.id ? { ...m, passesRemaining } : m));
          setCheckinMember(prev => prev ? { ...prev, passesRemaining } : prev);
        }}
      />
      <MemberMessageModal open={!!messageMember} onClose={() => setMessageMember(null)} member={messageMember} />
      <MemberMessageModal open={bulkMessageOpen} onClose={() => setBulkMessageOpen(false)} recipients={selectedMembers} />
      <ManagerAuthModal
        open={!!authAction}
        onClose={() => setAuthAction(null)}
        onConfirm={handleAuthConfirmed}
        action={authAction?.label ?? ''}
        danger={authAction?.danger ?? false}
      />
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { handleDeleteConfirmed(confirmDelete); setConfirmDelete(null); }}
        title="Delete Member"
        message={confirmDelete
          ? `Are you sure you want to delete ${confirmDelete.firstName} ${confirmDelete.lastName}? This action cannot be undone.`
          : ''}
      />
    </div>
  );
}

// ─── Page Button ──────────────────────────────────────────────────────────────

function PageBtn({ children, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32,
        border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
        borderRadius: 6,
        background: active ? 'var(--accent-gold)' : 'var(--bg-card)',
        color: active ? '#0a0a0f' : disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ member, hideExpiry, showStatus, isMenuOpen, onMenuToggle, onMenuClose, onAction, onRowClick, selectionMode, isSelected, onSelect }) {
  const [hovered, setHovered]     = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const savedPhoto = member.photo || null;

  const handleToggle = (e) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    onMenuToggle(e);
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onRowClick}
      style={{
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(212,175,55,0.06)'
          : hovered ? 'var(--bg-card-hover)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Checkbox */}
      {selectionMode && (
        <td style={{ ...tdStyle, width: 44, paddingRight: 0 }} onClick={e => { e.stopPropagation(); onSelect(); }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4, cursor: 'pointer',
            border: `2px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
            background: isSelected ? 'var(--accent-gold)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }}>
            {isSelected && <Check size={10} strokeWidth={3} color="#0a0a0f" />}
          </div>
        </td>
      )}

      {/* Member */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {savedPhoto
            ? <img src={savedPhoto} alt={member.firstName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <Avatar firstName={member.firstName} lastName={member.lastName} avatarColor={member.avatarColor} size={32} />
          }
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
              {member.firstName} {member.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {member.memberCode}
            </div>
          </div>
        </div>
      </td>

      {/* Phone */}
      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{member.phone}</td>

      {/* Package */}
      <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>{member.package?.name ?? '—'}</td>

      {/* Start Date */}
      <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {formatDate(member.startDate)}
      </td>

      {/* Expiry — hidden on Visitors tab */}
      {!hideExpiry && (
        <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {member.endDate ? formatDate(member.endDate) : '—'}
        </td>
      )}

      {/* Status — shown on Inactive tab */}
      {showStatus && (
        <td style={tdStyle}>
          <StatusBadge status={member.status} />
        </td>
      )}

      {/* Balance */}
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {(member.balance || 0) === 0 ? (
          <span style={{ color: 'var(--accent-green)' }}>{formatMoney(0)}</span>
        ) : (
          <span style={{ color: 'var(--accent-red)' }}>{formatMoney(member.balance)}</span>
        )}
      </td>

      {/* Last Visit */}
      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {member.lastVisit ? formatDate(member.lastVisit) : '—'}
      </td>

      {/* Actions */}
      <td style={{ ...tdStyle, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={handleToggle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', borderRadius: 6,
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
        {isMenuOpen && (
          <ActionMenu
            member={member}
            onAction={onAction}
            onClose={onMenuClose}
            anchorRect={anchorRect}
          />
        )}
      </td>
    </tr>
  );
}
