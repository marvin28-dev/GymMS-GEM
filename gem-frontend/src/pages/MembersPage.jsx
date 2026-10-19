import useLiveRefresh from '../hooks/useLiveRefresh';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrencySymbol, formatMoney, getMoneyLocale } from '../utils/currency';
import { packageAllowance } from '../utils/packages';
import { autoPaymentDescription } from '../utils/paymentDescription';
import CollectPaymentStep from '../components/CollectPaymentStep';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, UserPlus, Search, ChevronLeft, ChevronRight, MoreHorizontal, ChevronDown, X, MessageSquare, CreditCard, Check, SquareCheck, Lock, Phone, Eye, UserCheck, Clock, ChevronRight as ArrowRight } from 'lucide-react';
import RowMenu from '../components/ui/RowMenu';
import { passesLeft, checkInErrorText } from '../utils/checkin';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { getAuth, getRole, getPhonePlaceholder, getAddressPlaceholder } from '../utils/auth';
import { gymCache } from '../utils/gymCache';
import { isFitness } from '../utils/rolePages';
import { useLanguage } from '../contexts/LanguageContext';
import CodeInput from '../components/ui/CodeInput';

import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import Modal from '../components/ui/Modal';
import SendMessageModal from '../components/SendMessageModal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import MemberProfilePage from './MemberProfilePage';

import { getAll as getMembers, create as createMember, update as updateMember, remove as removeMember } from '../services/members.service';
import { getAll as getPackages } from '../services/packages.service';
import { getMyGym } from '../services/gym.service';
import { create as createPayment } from '../services/payments.service';
import { checkIn as checkInApi } from '../services/attendance.service';
import { uploadPhoto } from '../services/upload.service';
import { fmtDate, fmtTime, todayStr, addDaysStr, dayStr } from '../utils/date';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods } from '../utils/paymentMethods';
import { memberNeedsAttention, membershipEndsThisWeek } from '../utils/attention';
import { citiesOf, regionsOf } from '../utils/address';
import { CountryField } from '../components/AddressInputs';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';
import { digitsOnly } from '../utils/number';
import { softAll } from '../utils/loadAll';

const formatDate = (d) => fmtDate(d);

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

// Where a member lives: street, city and region required, the country starting
// as the gym's own. City and region suggest the country's names (utils/address.js).
function AddressFields({ form, set, errors, inp, gymCountry }) {
  const { t } = useLanguage();
  const country = gymCountry || form.country || '';
  return (
    <>
      <ModalField label={t('members.houseNumber')}>
        <input autoComplete="off" style={inp(false)} value={form.houseNumber}
          onChange={e => set('houseNumber', e.target.value)} placeholder="e.g. 12B" />
      </ModalField>
      <ModalField label={t('members.street')} required error={errors.street}>
        <input autoComplete="street-address" style={inp(errors.street)} value={form.street}
          onChange={e => set('street', e.target.value)} placeholder={getAddressPlaceholder()} />
      </ModalField>
      <ModalField label={t('common.city')} required error={errors.city}>
        <input autoComplete="address-level2" list="gem-cities" style={inp(errors.city)} value={form.city}
          onChange={e => set('city', e.target.value)} placeholder={t('common.city')} />
        <datalist id="gem-cities">{citiesOf(country).map(c => <option key={c} value={c} />)}</datalist>
      </ModalField>
      <ModalField label={t('common.region')} required error={errors.region}>
        <input autoComplete="address-level1" list="gem-regions" style={inp(errors.region)} value={form.region || ''}
          onChange={e => set('region', e.target.value)} placeholder={regionsOf(country)[0] || t('common.region')} />
        <datalist id="gem-regions">{regionsOf(country).map(r => <option key={r} value={r} />)}</datalist>
      </ModalField>
      <ModalField label={t('common.postalCode')}>
        <input autoComplete="postal-code" style={inp(false)} value={form.postalCode}
          onChange={e => set('postalCode', e.target.value)} placeholder="0000" />
      </ModalField>
      <CountryField country={country} labelStyle={labelStyle} />
    </>
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
  color: 'var(--text-muted)', padding: '10px 14px',
  background: 'rgba(255,255,255,0.01)', textAlign: 'left',
  fontWeight: 500, borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px', fontSize: 13,
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

// The actions column stays pinned to the right edge, so the row menu is always
// in reach even when a narrow screen has to scroll the table sideways. Its edge
// shadow is only drawn while rows actually pass under it: Firefox paints a cell's
// shadow on every row, which left a dark stripe down a table that fits.
const stickyActions = { position: 'sticky', right: 0, zIndex: 1 };
const pinnedShadow = { boxShadow: '-10px 0 12px -12px rgba(0,0,0,0.6)' };
// The header row is a faint wash over the card; the pinned cell must be opaque, so it
// paints the same wash over the card colour instead of a plain, darker card colour.
const stickyHeadBg = 'linear-gradient(rgba(255,255,255,0.01), rgba(255,255,255,0.01)), var(--bg-card)';

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

function FilterDropdown({ label, options, labels, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = !!value;
  const activeLabel = active && labels ? (labels[options.indexOf(value)] ?? value) : value;

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
        {active ? activeLabel : label}
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
          {options.map((opt, i) => (
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
              {labels ? (labels[i] ?? opt) : opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MAIN_TAB_KEYS = ['allMembers', 'active', 'inactive'];
const isVisitorRec = (m) => !!m.isVisitor || m.status === 'visitor';

// All types / Monthly / Visitors, as one segmented control
function TypeFilter({ value, onChange, t }) {
  const opts = [['', t('members.typeAll')], ['monthly', t('members.typeMonthly')], ['visitor', t('members.visitors')]];
  return (
    <div role="group" aria-label={t('members.filterType')} style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 2, flexShrink: 0 }}>
      {opts.map(([v, label]) => (
        <button key={v || 'all'} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            padding: '5px 11px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap',
            background: value === v ? 'var(--accent-gold-dim)' : 'transparent',
            color: value === v ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: value === v ? 600 : 400,
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}
const MAIN_TABS = ['All Members', 'Active', 'Inactive'];

const SESSIONS_LEFT_OPTIONS = ['1 left', '≤ 3 left', '≤ 5 left'];
const GENDER_OPTIONS   = ['Male', 'Female', 'Other'];
const JOINED_OPTIONS   = ['This week', 'This month', 'Last 3 months', 'This year'];

// All Members is everyone: monthly members and visitors alike. Active and
// Inactive split them by whether they can come in on what they have; a visitor
// with passes left is active, one who has used them all (expired) is inactive.
const INACTIVE_STATUSES = ['suspended', 'frozen', 'expired', 'deactivated', 'cancelled', 'pending'];
function filterByTab(list, tab) {
  if (tab === 'All Members') return list;
  if (tab === 'Active')      return list.filter(m => ['active', 'expiring', 'visitor'].includes(m.status));
  if (tab === 'Inactive')    return list.filter(m => INACTIVE_STATUSES.includes(m.status));
  return list;
}

function applyFilters(list, { pkg, sessionsLeft, gender, joined, owing, expiring, needsAttention, mine, inactiveSub, sort }) {
  let out = [...list];
  if (pkg)                         out = out.filter(m => m.package?.name === pkg);
  if (sessionsLeft === '1 left')   out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining === 1);
  if (sessionsLeft === '≤ 3 left') out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining <= 3);
  if (sessionsLeft === '≤ 5 left') out = out.filter(m => m.sessionsRemaining != null && m.sessionsRemaining <= 5);
  if (gender)   out = out.filter(m => (m.gender ?? '') === gender);
  if (owing)    out = out.filter(m => (m.balance || 0) > 0);
  if (expiring) out = out.filter(membershipEndsThisWeek);
  if (needsAttention) out = out.filter(memberNeedsAttention);
  // A coach looking at only the members they train
  if (mine) out = out.filter(m => String(m.coachId) === String(mine));
  if (inactiveSub === 'Frozen')      out = out.filter(m => m.status === 'frozen');
  if (inactiveSub === 'Expired')     out = out.filter(m => m.status === 'expired');
  if (inactiveSub === 'Deactivated') out = out.filter(m => m.status === 'deactivated' || m.status === 'cancelled');
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
  else if (sort === 'Name A-Z') out.sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`));
  else if (sort === 'Name Z-A') out.sort((a, b) => `${b.firstName}${b.lastName}`.localeCompare(`${a.firstName}${a.lastName}`));
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
  // Country is fixed to the gym's own country rather than hardcoded
  const [gymCountry, setGymCountry] = useState('');
  useEffect(() => {
    if (open) getMyGym().then(r => setGymCountry(r.data?.country || '')).catch(() => {});
  }, [open]);
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
    <Modal open={open} onClose={onClose} title={`Edit : ${member.firstName} ${member.lastName}`} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        <Section title={t('members.personalInfo')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
          <Field label={`${t('common.phone')} *`}><input style={inp()} inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^\d\s+\-()]/g, '') }))} placeholder={getPhonePlaceholder()} /></Field>
          <Field label={`${t('common.email')} *`}><input type="email" style={inp()} value={form.email} onChange={set('email')} placeholder="email@example.com" /></Field>
        </div>

        <Section title={t('common.address')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('members.houseNumber')}><input style={inp()} value={form.houseNumber} onChange={set('houseNumber')} placeholder="e.g. 12B" /></Field>
          <Field label={`${t('members.street')} *`}><input style={inp()} value={form.street} onChange={set('street')} placeholder={getAddressPlaceholder()} /></Field>
          <Field label={`${t('common.city')} *`}><input style={inp()} value={form.city} onChange={set('city')} placeholder={t('common.city')} /></Field>
          <Field label={t('common.postalCode')}><input style={inp()} value={form.postalCode} onChange={set('postalCode')} placeholder="0000" /></Field>
          <Field label={t('common.country')} span><input style={{ ...inp(), color: 'var(--text-muted)', cursor: 'not-allowed' }} value={gymCountry} readOnly /></Field>
        </div>

        <Section title={t('members.emergencyContact')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('members.contactName')}><input style={inp()} value={form.emergencyContact} onChange={set('emergencyContact')} placeholder={t('common.fullName')} /></Field>
          <Field label={t('members.contactPhone')}><input style={inp()} inputMode="tel" value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value.replace(/[^\d\s+\-()]/g, '') }))} placeholder={getPhonePlaceholder()} /></Field>
        </div>

        <Section title={t('members.membershipInfo')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
  const gymSettings = useGymSettings();
  const todayLabel = fmtDate(new Date());
  const freshForm = () => ({ amount: '', method: 'Cash', reference: generateRef(), description: autoPaymentDescription(member, 'membership'), type: 'membership' });
  const [form, setForm] = useState(freshForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [amountError, setAmountError] = useState('');

  useEffect(() => { if (open) { setForm(freshForm()); setError(''); } }, [open]);

  if (!member) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const owedBalance = Math.max(0, member.balance || 0);
  const payAmt      = parseFloat(form.amount) || 0;
  const remaining   = Math.max(0, owedBalance - payAmt);
  // A membership (or "other") payment pays down what is owed, so it can never be more than that
  const reducesBalance = form.type === 'membership' || form.type === 'other';
  const overpay     = reducesBalance && payAmt > owedBalance;

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  const handleSave = async () => {
    if (!form.amount || payAmt <= 0) { setAmountError(t('payments.invalidAmount')); return; }
    if (overpay) { setAmountError(t('memberProfile.amountOverMax', { amount: formatMoney(owedBalance) })); return; }
    setSaving(true); setError(''); setAmountError('');
    try {
      await createPayment({ memberId: member.id, amount: payAmt, method: form.method, description: form.description || undefined, type: form.type, reference: form.reference, towardBalance: reducesBalance });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('payments.saveFailed'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${t('members.addPayment')} : ${member.firstName} ${member.lastName}`} maxWidth={480}>
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
            <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{t('payments.amountLabel')}</label>
                <input type="text" inputMode="numeric" style={{ ...inp, borderColor: amountError ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.amount} onChange={e => { e.target.value = digitsOnly(e.target.value); set('amount')(e); setAmountError(''); }} placeholder="0" autoFocus />
                {amountError && <span role="alert" style={fieldErrorStyle}>{amountError}</span>}
              </div>
              <div>
                <label style={lbl}>{t('payments.method')} *</label>
                <select style={inp} value={form.method} onChange={set('method')}>
                  {enabledMethods(gymSettings).map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                </select>
              </div>
            </div>

            {/* Type */}
            <div>
              <label style={lbl}>{t('payments.paymentType')}</label>
              <select style={inp} value={form.type} onChange={e => {
                const newType = e.target.value;
                // Refill the description for the new type, unless the staff wrote their own
                setForm(f => {
                  const custom = f.description && f.description !== autoPaymentDescription(member, f.type);
                  return { ...f, type: newType, description: custom ? f.description : autoPaymentDescription(member, newType) };
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
              <input style={inp} value={form.description} onChange={set('description')} placeholder="e.g. Premium 12M Renewal" />
            </div>

            {/* Date locked */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
              <Lock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('payments.dateLocked')} : {todayLabel}</span>
            </div>

            {/* Balance preview */}
            {payAmt > 0 && overpay && (
              <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{t('memberProfile.amountOverMax', { amount: formatMoney(owedBalance) })}</div>
            )}
            {payAmt > 0 && reducesBalance && !overpay && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('payments.balanceAfterPayment')}</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : 'var(--text-primary)' }}>
                  {remaining === 0 ? '✓ ' : ''}{formatMoney(remaining)}
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
                style={{ ...primaryBtn, opacity: (form.amount && !saving && !overpay) ? 1 : 0.45, cursor: (form.amount && !saving && !overpay) ? 'pointer' : 'not-allowed' }}
                disabled={!form.amount || saving || overpay} onClick={handleSave}>
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
      if (serverMember) {
        onCheckedIn?.({ passesRemaining: serverMember.passesRemaining, dayPasses: serverMember.dayPasses, status: serverMember.status });
      }
      setDone(true);
    } catch (err) {
      setError(checkInErrorText(err, t, t('members.incorrectCode')));
    } finally {
      setLoading(false);
    }
  };

  const memberPhoto = member.photo || null;

  if (isVisitor && !codeVerified) {
    const noPasses = passesLeft(member) <= 0;
    return (
      <Modal open={open} onClose={onClose} title={t('members.visitorCheckIn')} maxWidth={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {memberPhoto
              ? <img src={memberPhoto} alt={member.firstName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <Avatar firstName={member.firstName} lastName={member.lastName} avatarColor={member.avatarColor} size={48} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{member.firstName} {member.lastName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{member.memberCode} · {t('members.visitors')} · {passesLeft(member)} {t('members.passesRemaining')}</div>
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
              <CodeInput
                autoFocus
                maxLength={6}
                value={codeInput}
                onChange={v => { setCodeInput(v); setCodeError(''); }}
                onEnter={handleVerifyCode}
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
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{member.memberCode} · {member.package?.name || '-'}</div>
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

function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtn}>{t('common.cancel')}</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{ ...primaryBtn, background: 'var(--accent-red)', color: '#fff' }}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Action Dropdown ──────────────────────────────────────────────────────────

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
    houseNumber: '', street: '', city: '', region: '', postalCode: '', country: '',
    emergencyContact: '', emergencyPhone: '',
    packageId: '', startDate: '', endDate: '',
    howHeard: '', notes: '', photo: null, photoPreview: null,
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  // The registration fee is collected before the member can be added
  const [regPaid, setRegPaid] = useState(null);
  const regFee = Number(gymData?.registrationFee) || 0;
  const feeRequired = !!gymData?.registrationFeeRequired && regFee > 0;

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
    const req = t('common.required');
    if (!form.firstName.trim()) e.firstName = req;
    if (!form.lastName.trim()) e.lastName = req;
    if (!form.gender) e.gender = req;
    if (!form.email.trim()) e.email = req;
    if (!form.phone.trim()) e.phone = req;
    if (!form.street.trim()) e.street = req;
    if (!form.city.trim()) e.city = req;
    if (!form.region.trim()) e.region = req;
    if (!form.emergencyContact.trim()) e.emergencyContact = req;
    if (!form.emergencyPhone.trim())   e.emergencyPhone   = req;
    if (!form.packageId) e.package = req;
    if (!form.startDate) e.startDate = req;
    else if (form.startDate < todayStr()) e.startDate = t('members.startDateNotPast');
    if (!form.howHeard) e.howHeard = req;
    if (feeRequired && !regPaid) e.regFee = t('collect.required');
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
    setRegPaid(null);
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); revealFirstError(); return; }
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
        region: form.region?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        country: gymData?.country || undefined,
        emergencyContact: form.emergencyContact?.trim() || undefined,
        emergencyPhone: form.emergencyPhone?.trim() || undefined,
        packageId: form.packageId,
        startDate: form.startDate || today,
        endDate: form.endDate || undefined,
        status: 'active',
        balance: initialBalance,
        // Session allowance from the package. null means unlimited.
        passesTotal: packageAllowance(selectedPkg),
        passesRemaining: packageAllowance(selectedPkg),
        howHeard: form.howHeard || undefined,
        notes: form.notes || undefined,
        // The server collects the registration fee as a payment (and emails the
        // receipt) when the gym charges one; it just needs how it was paid.
        regFeeMethod: regPaid?.method,
      });
      const newMember = res.data;

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
      const fe = serverFieldError(err, t('members.createFailed'));
      if (fe.field) { setErrors(e => ({ ...e, [fe.field]: fe.message })); setApiError(''); }
      else setApiError(fe.message);
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label htmlFor="member-photo" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-secondary)', fontFamily: 'DM Sans',
              }}>
                {form.photoPreview ? t('members.changePhoto') : t('members.choosePhoto')}
              </label>
              {form.photoPreview && (
                <button type="button"
                  onClick={() => { set('photo', null); set('photoPreview', null); const el = document.getElementById('member-photo'); if (el) el.value = ''; }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
                  <X size={13} /> {t('members.remove')}
                </button>
              )}
            </div>
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
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            <input type="email" autoComplete="email" style={inp(errors.email)} value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </ModalField>
          <ModalField label={t('common.phoneNumber')} required error={errors.phone}>
            <input autoComplete="tel" inputMode="tel" style={inp(errors.phone)} value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/[^\d\s+\-()]/g, ''))} placeholder={getPhonePlaceholder()} />
          </ModalField>
        </div>

        {/* ── Address ── */}
        <ModalSectionHeader title={t('common.address')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <AddressFields form={form} set={set} errors={errors} inp={inp} gymCountry={gymData?.country} />
        </div>

        {/* ── Emergency Contact ── */}
        <ModalSectionHeader title={t('members.emergencyContact')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.contactName')} required error={errors.emergencyContact}>
            <input autoComplete="off" style={inp(errors.emergencyContact)} value={form.emergencyContact}
              onChange={e => set('emergencyContact', e.target.value)} placeholder={t('common.fullName')} />
          </ModalField>
          <ModalField label={t('members.contactPhone')} required error={errors.emergencyPhone}>
            <input autoComplete="off" inputMode="tel" style={inp(errors.emergencyPhone)} value={form.emergencyPhone}
              onChange={e => set('emergencyPhone', e.target.value.replace(/[^\d\s+\-()]/g, ''))} placeholder={getPhonePlaceholder()} />
          </ModalField>
        </div>

        {/* ── Membership ── */}
        <ModalSectionHeader title={t('members.membershipInfo')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.membershipOption')} required error={errors.package}>
            <select style={inp(errors.package)} value={form.packageId} onChange={e => handlePackageChange(e.target.value)}>
              <option value="">{t('members.selectPackage')}</option>
              {memberPackages.map(p => <option key={p.id} value={p.id}>{p.name} : {(p.price || 0).toLocaleString(getMoneyLocale())} {getCurrencySymbol()}</option>)}
            </select>
          </ModalField>
          <ModalField label={t('members.startDate')} required error={errors.startDate}>
            <input autoComplete="off" style={inp(errors.startDate)} type="date" min={new Date().toISOString().slice(0, 10)} value={form.startDate}
              onChange={e => { handleStartDateChange(e.target.value); setErrors(er => ({ ...er, startDate: undefined })); }} />
          </ModalField>
          <ModalField label={t('members.endDateAuto')}>
            {form.endDate
              ? <input autoComplete="off" style={{ ...inp(false), background: 'var(--bg-elevated)', cursor: 'not-allowed' }} type="date" value={form.endDate} readOnly tabIndex={-1} />
              : <div style={{ ...inp(false), background: 'var(--bg-elevated)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{t('members.selectPackageFirst')}</div>
            }
          </ModalField>
        </div>

        {/* ── Registration Fee: collected here, before the member can be added ── */}
        {feeRequired && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ModalSectionHeader title={t('members.registrationFee')} />
            <span style={{ fontSize: 11, fontWeight: 700, color: regPaid ? '#34d399' : '#ef4444', background: regPaid ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${regPaid ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 20, padding: '2px 10px', letterSpacing: '0.5px' }}>{regPaid ? t('collect.paid') : t('members.dueNow')}</span>
          </div>
          <CollectPaymentStep amountDue={regFee} collected={regPaid} onCollect={(c) => { setRegPaid(c); setErrors(er => ({ ...er, regFee: undefined })); }} onChange={() => setRegPaid(null)} error={errors.regFee} />
        </>}

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
          <button type="button" onClick={handleSubmit} title={feeRequired && !regPaid ? t('collect.required') : undefined} style={{ ...primaryBtn, opacity: (saving || (feeRequired && !regPaid)) ? 0.45 : 1, cursor: (saving || (feeRequired && !regPaid)) ? 'not-allowed' : 'pointer' }} disabled={saving || (feeRequired && !regPaid)}>
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
      durationDays: p.durationDays || null,
      sessions: p.sessions || 1,
      totalPrice: p.price || 0,
      pricePerSession: p.sessions ? Math.ceil((p.price || 0) / p.sessions) : (p.price || 0),
    }));
  // A one-day visitor can also buy a single day pass priced off a monthly
  // package. These are 1-session, paid in full, and leave the person a visitor
  // with one session that empties on their first check-in.
  const dayPassPkgs = packagesList
    .filter(p => !p.isVisitor && p.status === 'active' && p.dayPassPrice != null)
    .map(p => ({
      id: `dp:${p.id}`,
      realId: p.id,
      label: `${t('members.dayPassFor')} ${p.name}`,
      sessions: 1,
      totalPrice: p.dayPassPrice || 0,
      pricePerSession: p.dayPassPrice || 0,
      isDayPass: true,
    }));
  const allOptions = [...vPkgs, ...dayPassPkgs];

  const emptyForm = {
    firstName: '', lastName: '', gender: '', dob: '',
    email: '', phone: '',
    houseNumber: '', street: '', city: '', region: '', postalCode: '', country: '',
    emergencyContact: '', emergencyPhone: '',
    bundleId: '',
    amountPaid: '', paymentMethod: 'Cash',
    remainderDeadline: '', howHeard: '', notes: '',
    photo: null, photoPreview: null,
  };
  const [form, setForm]     = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    set('photo', file);
    const reader = new FileReader();
    reader.onload = (ev) => set('photoPreview', ev.target.result);
    reader.readAsDataURL(file);
  };

  const selectedBundle = allOptions.find(p => p.id === form.bundleId) || null;
  const totalPrice     = selectedBundle ? selectedBundle.totalPrice : 0;
  // What was collected in the Collect payment step; nothing until it is
  const [visitorPaid, setVisitorPaid] = useState(null);
  const amountPaidN    = visitorPaid?.amount || 0;
  const remainder      = Math.max(0, totalPrice - amountPaidN);
  // A day pass is paid in full upfront; a visitor bundle takes the usual minimum.
  const minRequired    = selectedBundle?.isDayPass ? totalPrice : Math.ceil(totalPrice * minPct / 100);
  const pctPaid        = totalPrice > 0 ? Math.round((amountPaidN / totalPrice) * 100) : 0;
  const meetsMinimum   = amountPaidN >= minRequired;

  const handleBundleChange = (id) => {
    const pkg = allOptions.find(p => p.id === id);
    // A different bundle is a different price, so anything collected is redone
    setVisitorPaid(null);
    const dl = new Date();
    dl.setDate(dl.getDate() + deadDays);
    setForm(f => ({
      ...f,
      bundleId: id,
      remainderDeadline: pkg ? dayStr(dl) : '',
    }));
  };

  const validate = () => {
    const e = {};
    const req = t('common.required');
    if (!form.firstName.trim())        e.firstName        = req;
    if (!form.lastName.trim())         e.lastName         = req;
    if (!form.gender)                  e.gender           = req;
    if (!form.email.trim())            e.email            = req;
    if (!form.phone.trim())            e.phone            = req;
    if (!form.street.trim())           e.street           = req;
    if (!form.city.trim())             e.city             = req;
    if (!form.region.trim())           e.region           = req;
    if (!form.emergencyContact.trim()) e.emergencyContact = req;
    if (!form.emergencyPhone.trim())   e.emergencyPhone   = req;
    if (!form.bundleId)                e.bundleId         = req;
    if (selectedBundle && !visitorPaid) e.amountPaid      = t('collect.required');
    if (!form.howHeard)                e.howHeard         = req;
    return e;
  };

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  // After creating the visitor we hold the new record and offer to check them
  // in now or later, so the staff don't forget (day pass / bundle both).
  const [created, setCreated] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); revealFirstError(); return; }
    setSaving(true);
    setApiError('');
    try {
      const today = todayStr();
      const isDayPass = !!selectedBundle?.isDayPass;
      // A bundle runs for its own validity; a day pass is spent on one visit.
      const endDate = isDayPass ? today : (selectedBundle?.durationDays ? addDaysStr(today, selectedBundle.durationDays) : undefined);
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
        region: form.region.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        country: gymData?.country || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        packageId: isDayPass ? selectedBundle.realId : form.bundleId,
        startDate: today,
        endDate,
        status: 'visitor',
        isVisitor: true,
        balance: remainder,
        passesTotal: isDayPass ? 1 : (selectedBundle?.sessions || 1),
        passesRemaining: isDayPass ? 0 : (selectedBundle?.sessions || 1),
        dayPasses: isDayPass ? 1 : 0,
        howHeard: form.howHeard || undefined,
        notes: form.notes || undefined,
        // Saved with the visitor, so the visitor and the payment exist together or not at all
        initialPayment: {
          amount: amountPaidN, method: visitorPaid.method,
          description: isDayPass ? selectedBundle.label : `${t('members.visitorBundlePayment')} - ${selectedBundle.label}`,
        },
      });
      const newVisitor = res.data;
      if (form.photo) {
        try {
          const photoUrl = await uploadPhoto(form.photo, 'gem/members');
          await updateMember(newVisitor.id, { photo: photoUrl });
          newVisitor.photo = photoUrl;
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }
      setCreated(newVisitor);
    } catch (err) {
      const fe = serverFieldError(err, t('members.visitorCreateFailed'));
      if (fe.field) { setErrors(e => ({ ...e, [fe.field]: fe.message })); setApiError(''); }
      else setApiError(fe.message);
    } finally {
      setSaving(false);
    }
  };

  const finish = (member) => {
    setForm(emptyForm); setErrors({}); setApiError(''); setCreated(null); setVisitorPaid(null);
    if (onCreated) onCreated(member.id, member);
    else { onClose(); navigate(`/members/${member.id}`); }
  };
  const checkInNow = async () => {
    setCheckingIn(true);
    try { await checkInApi({ memberId: created.id }); } catch { /* profile will show it */ }
    setCheckingIn(false);
    finish(created);
  };

  const handleClose = () => { setForm(emptyForm); setErrors({}); setApiError(''); setCreated(null); setVisitorPaid(null); onClose(); };
  const inp = (hasErr) => ({ ...inputStyle, borderColor: hasErr ? 'var(--accent-red)' : 'var(--border-subtle)' });

  if (created) {
    return (
      <Modal open={open} onClose={() => finish(created)} title={t('members.registerVisitor')} maxWidth={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#34d399', fontWeight: 600 }}>
            ✓ {t('members.visitorCreatedCheckInPrompt')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} disabled={checkingIn} onClick={() => finish(created)}>{t('memberProfile.checkInLater')}</button>
            <button style={primaryBtn} disabled={checkingIn} onClick={checkInNow}>{checkingIn ? t('common.saving') : t('memberProfile.checkInNow')}</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('members.registerVisitor')} maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>

        {/* ── Photo Upload ── */}
        {/* A visitor with no photo has to give their check-in code at the desk,
            the same rule as members. */}
        <ModalSectionHeader title={t('members.profilePhoto')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            background: form.photoPreview ? 'transparent' : 'var(--bg-elevated)',
            border: '2px dashed var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {form.photoPreview
              ? <img src={form.photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: 'var(--text-muted)' }}>👤</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label htmlFor="visitor-photo" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-secondary)', fontFamily: 'DM Sans',
              }}>
                {form.photoPreview ? t('members.changePhoto') : t('members.choosePhoto')}
              </label>
              {form.photoPreview && (
                <button type="button"
                  onClick={() => { set('photo', null); set('photoPreview', null); const el = document.getElementById('visitor-photo'); if (el) el.value = ''; }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
                  <X size={13} /> {t('members.remove')}
                </button>
              )}
            </div>
            <input id="visitor-photo" type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              {t('members.visitorPhotoHint')}
            </div>
          </div>
        </div>

        {/* ── Personal Info ── */}
        <ModalSectionHeader title={t('members.personalInfo')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            <input type="email" autoComplete="email" style={inp(errors.email)} value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </ModalField>
          <ModalField label={t('common.phone')} required error={errors.phone}>
            <input autoComplete="tel" inputMode="tel" style={inp(errors.phone)} value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/[^\d\s+\-()]/g, ''))} placeholder={getPhonePlaceholder()} />
          </ModalField>
        </div>

        {/* ── Address ── */}
        <ModalSectionHeader title={t('common.address')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <AddressFields form={form} set={set} errors={errors} inp={inp} gymCountry={gymData?.country} />
        </div>

        {/* ── Emergency Contact ── */}
        <ModalSectionHeader title={t('members.emergencyContact')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ModalField label={t('members.contactName')} required error={errors.emergencyContact}>
            <input autoComplete="off" style={inp(errors.emergencyContact)} value={form.emergencyContact}
              onChange={e => set('emergencyContact', e.target.value)} placeholder={t('common.fullName')} />
          </ModalField>
          <ModalField label={t('members.contactPhone')} required error={errors.emergencyPhone}>
            <input autoComplete="off" inputMode="tel" style={inp(errors.emergencyPhone)} value={form.emergencyPhone}
              onChange={e => set('emergencyPhone', e.target.value.replace(/[^\d\s+\-()]/g, ''))} placeholder={getPhonePlaceholder()} />
          </ModalField>
        </div>

        {/* ── Session Bundle ── */}
        <ModalSectionHeader title={t('members.sessionBundle')} />

        {/* Bundle cards */}
        <ModalField label={t('members.chooseBundle')} required error={errors.bundleId}>
          {/* Visitor bundles and day passes are different buys, so they are listed apart. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 2 }}>
            {[
              { key: 'bundles', title: t('members.visitorBundlesGroup'), hint: t('members.visitorBundlesGroupHint'), items: vPkgs },
              { key: 'daypasses', title: t('members.dayPassesGroup'), hint: t('members.dayPassesGroupHint'), items: dayPassPkgs },
            ].filter(g => g.items.length > 0).map(group => (
              <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{group.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{group.hint}</div>
                </div>
                {group.items.map(pkg => {
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
                            {pkg.pricePerSession.toLocaleString(getMoneyLocale())} {getCurrencySymbol()} {t('common.perSession')}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'Manrope' }}>
                          {pkg.totalPrice.toLocaleString(getMoneyLocale())} {getCurrencySymbol()}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pkg.isDayPass ? t('members.dayPassOneSession') : `${pkg.sessions} ${t('members.visitorSessions')}`}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </ModalField>

        {/* Collected here, before the visitor can be added: a day pass in full, a bundle at least the minimum */}
        {selectedBundle && (
          <CollectPaymentStep
            amountDue={totalPrice}
            minAmount={minRequired}
            minPct={selectedBundle.isDayPass ? undefined : minPct}
            collected={visitorPaid}
            onCollect={(c) => { setVisitorPaid(c); setErrors(er => ({ ...er, amountPaid: undefined })); }}
            onChange={() => setVisitorPaid(null)}
            error={errors.amountPaid}
          />
        )}
        {visitorPaid && remainder > 0 && (
          <ModalField label={t('members.remainderDueBy')}>
            <input autoComplete="off" style={inp(false)} type="date" value={form.remainderDeadline}
              onChange={e => set('remainderDeadline', e.target.value)} />
          </ModalField>
        )}

        {/* Payment summary bar */}
        {totalPrice > 0 && visitorPaid && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('members.paymentProgress')}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: meetsMinimum ? '#10b981' : '#ef4444', fontFamily: 'DM Sans' }}>
                {pctPaid}% paid · {remainder > 0 ? `${remainder.toLocaleString(getMoneyLocale())} ${getCurrencySymbol()} remaining` : 'Fully paid ✓'}
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
                {t('members.minPctRequiredMsg', { pct: minPct, amount: minRequired.toLocaleString(getMoneyLocale()), currency: getCurrencySymbol() })}
              </div>
            )}
            {meetsMinimum && remainder === 0 && (
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontFamily: 'DM Sans' }}>
                ✓ {t('members.visitorRegisteredActive')}
              </div>
            )}
            {meetsMinimum && remainder > 0 && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontFamily: 'DM Sans' }}>
                ⏳ {t('members.visitorActiveRemainder', { deadline: form.remainderDeadline || `${deadDays} days` })}
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
          <button onClick={handleSave} title={!visitorPaid ? t('collect.required') : undefined} style={{ ...primaryBtn, opacity: (saving || !visitorPaid) ? 0.45 : 1, cursor: (saving || !visitorPaid) ? 'not-allowed' : 'pointer' }} disabled={saving || !visitorPaid}>
            {saving ? t('members.creating') : t('members.createVisitor')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// A request waiting for a manager on this member (shown under Needs attention)
function ApprovalChip({ member, inline = false }) {
  const { t } = useLanguage();
  if (!member?.pendingApproval || isFitness(getRole())) return null;
  return (
    <span title={member.pendingApproval} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: inline ? 0 : 4, ...(inline ? { lineHeight: '14px' } : {}), fontSize: 10.5, fontWeight: 600, fontFamily: 'DM Sans', color: 'var(--accent-yellow)', background: 'var(--accent-yellow-dim)', borderRadius: 20, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      <Clock size={10} /> {t('members.awaitingApproval')}
    </span>
  );
}

export default function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // Show the last members list at once and refresh it quietly; a first-ever
  // visit falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('members');
  const [membersList, setMembersList] = useState(() => cache.read('list', []));
  const [packagesList, setPackagesList] = useState(() => cache.read('packages', []));
  const [gymData, setGymData] = useState(() => cache.read('gym', {}));
  const [loading, setLoading] = useState(() => !cache.has('list'));

  const [activeTab, setActiveTab]       = useState(() => (MAIN_TABS.includes(location.state?.tab) ? location.state.tab : 'All Members'));
  const [filterType, setFilterType]     = useState(() => (location.state?.tab === 'Visitors' ? 'visitor' : ''));
  const [inactiveSub, setInactiveSub]   = useState('All Inactive');
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterPackage, setFilterPackage]         = useState('');
  const [filterSessionsLeft, setFilterSessionsLeft] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterJoined, setFilterJoined] = useState('');
  const [filterOwing, setFilterOwing]     = useState(false);
  const [filterExpiring, setFilterExpiring] = useState(() => !!location.state?.expiring);
  // Whether rows are passing under the pinned Actions column right now
  const [pinnedEdge, setPinnedEdge] = useState(false);
  const pinnedWatch = useRef(null);
  const tableScrollRef = useCallback((el) => {
    pinnedWatch.current?.();
    pinnedWatch.current = null;
    if (!el) return;
    const measure = () => setPinnedEdge(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', measure, { passive: true });
    measure();
    pinnedWatch.current = () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, []);
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(() => !!location.state?.needsAttention);
  const isCoach = isFitness(getRole());
  const [filterMine, setFilterMine] = useState(() => !!location.state?.mine);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const canManage = ['general_manager', 'manager', 'front_desk'].includes(getRole());
  // Fitness staff work with the members, not with their money
  const showsMoney = !isFitness(getRole());

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
    softAll([
      getMembers().catch(() => ({ data: [] })),
      getPackages().catch(() => ({ data: [] })),
      getMyGym().catch(() => ({ data: {} })),
    ]).then(([mRes, pRes, gRes]) => {
      const mem = mRes.data || [], pkg = pRes.data || [], gym = gRes.data || {};
      setMembersList(mem); cache.write('list', mem);
      setPackagesList(pkg); cache.write('packages', pkg);
      setGymData(gym); cache.write('gym', gym);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);
  useLiveRefresh(loadData);

  const resetFilters = () => {
    setFilterPackage(''); setFilterSessionsLeft(''); setFilterGender(''); setFilterJoined('');
    setFilterOwing(false); setFilterExpiring(false); setFilterNeedsAttention(false); setInactiveSub('All Inactive'); setCurrentPage(1);
  };

  const ofType = (list) => (filterType ? list.filter(m => (filterType === 'visitor' ? isVisitorRec(m) : !isVisitorRec(m))) : list);
  const tabCounts = Object.fromEntries(MAIN_TABS.map(t => [t, ofType(filterByTab(membersList, t)).length]));

  const tabBase  = ofType(filterByTab(membersList, activeTab));
  const searched = filterBySearch(tabBase, searchTerm);
  const filtered = applyFilters(searched, {
    pkg: filterPackage, sessionsLeft: filterSessionsLeft, gender: filterGender, joined: filterJoined,
    owing: filterOwing, expiring: filterExpiring, needsAttention: filterNeedsAttention,
    mine: isCoach && filterMine ? getAuth()?.user?.id : null,
    inactiveSub: activeTab === 'Inactive' ? inactiveSub : '',
    sort: '',
  });

  const anyFilterActive = filterType || filterPackage || filterSessionsLeft || filterGender || filterJoined || filterOwing || filterExpiring || filterNeedsAttention
    || (activeTab === 'Inactive' && inactiveSub !== 'All Inactive');

  const GENDER_LABELS = [t('common.male'), t('common.female'), t('common.other')];
  const JOINED_LABELS = [t('members.joinedThisWeek'), t('members.joinedThisMonth'), t('members.joinedLast3M'), t('members.joinedThisYear')];
  const SESSIONS_LEFT_LABELS = [t('members.sl1'), t('members.sl3'), t('members.sl5')];
  const INACTIVE_STATUS_OPTIONS = ['Not Started', 'Frozen', 'Expired', 'Suspended', 'Deactivated'];
  const INACTIVE_STATUS_LABELS = [t('status.pending'), t('status.frozen'), t('status.expired'), t('status.suspended'), t('status.deactivated')];

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showStatusCol = activeTab === 'Inactive' || activeTab === 'All Members';
  const tableHeaders = [
    t('members.member'), t('common.phone'), t('members.package'), t('members.startDate'),
    t('members.expiry'),
    ...(showStatusCol ? [t('common.status')] : []),
    ...(showsMoney ? [t('members.balance')] : []),
    t('members.lastVisit'), t('members.actions'),
  ];

  const allSelected    = pagedFiltered.length > 0 && pagedFiltered.every(m => selectedIds.has(m.id));
  const someSelected   = selectedIds.size > 0;
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(pagedFiltered.map(m => m.id)));
  const toggleSelectOne = (id) => setSelectedIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const selectedMembers = filtered.filter(m => selectedIds.has(m.id));

  const MANAGER_ACTIONS = {
    freeze:  { label: (m) => t('members.freezeFor', { name: `${m.firstName} ${m.lastName}` }), danger: false },
    cancel:  { label: (m) => t('members.cancelFor', { name: `${m.firstName} ${m.lastName}` }), danger: true  },
    delete:  { label: (m) => t('members.deleteFor', { name: `${m.firstName} ${m.lastName}` }), danger: true  },
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
      // silently fail. member stays in list
    }
  };

  const printPDF = (headers, rows, title) => {
    const date = fmtDate(new Date(), { day: '2-digit', month: 'long', year: 'numeric' });
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
    <div class="sub">${t('common.generatedOn')} ${date} &nbsp;·&nbsp; ${rows.length} ${t('common.records')}</div>
    <table>
      <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">${r.map(c => `<td style="${tdStyle}">${c ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const handleExport = () => {
    const headers = [t('members.memberCode'), t('members.firstName'), t('members.lastName'), t('members.gender'), t('common.email'), t('common.phone'), t('members.package'), t('common.status'), t('members.startDate'), t('members.endDate'), ...(showsMoney ? [t('members.balance')] : [])];
    const rows = filtered.map(m => [
      m.memberCode, m.firstName, m.lastName, m.gender ?? '', m.email, m.phone,
      m.package?.name ?? '', m.status, m.startDate ? m.startDate.slice(0,10) : '', m.endDate ? m.endDate.slice(0,10) : '', ...(showsMoney ? [m.balance ?? 0] : []),
    ]);
    printPDF(headers, rows, 'GEM Members Report');
  };

  if (inlineProfileId) {
    return <MemberProfilePage memberId={inlineProfileId} onBack={() => setInlineProfileId(null)} fromFrontDesk={false} />;
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    const statusColor = (s) => {
      if (s === 'active') return { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' };
      if (s === 'expiring') return { bg: 'rgba(249,115,22,0.12)', color: '#f97316' };
      if (s === 'visitor') return { bg: 'rgba(99,102,241,0.12)', color: '#818cf8' };
      return { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
    };

    return (
      <div style={{ minHeight: '100%' }}>
        {/* Mobile header strip */}
        <div style={{ padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('nav.members')}
            </h1>
            {canManage && (
              <button
                onClick={() => setShowAddVisitor(true)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 12,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <UserPlus size={13} strokeWidth={2} /> {t('members.visitor')}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontFamily: 'DM Sans' }}>
            {loading ? t('common.loading') : t('members.summaryLine', { total: membersList.length, active: filterByTab(membersList, 'Active').length, expiring: membersList.filter(membershipEndsThisWeek).length })}
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', overflowX: 'auto', padding: '0 16px',
          borderBottom: '1px solid var(--border-subtle)',
          scrollbarWidth: 'none', gap: 0,
        }}>
          {MAIN_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetFilters(); exitSelectionMode(); }}
              style={{
                padding: '10px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                background: 'none', border: 'none', flexShrink: 0,
                borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-gold)' : 'transparent'}`,
                color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)',
                fontFamily: 'DM Sans', fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {t(`members.${MAIN_TAB_KEYS[MAIN_TABS.indexOf(tab)]}`) || tab}
              <span style={{
                marginLeft: 5,
                background: activeTab === tab ? 'var(--accent-gold)' : 'var(--bg-elevated)',
                color: activeTab === tab ? '#000' : 'var(--text-muted)',
                fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '1px 6px',
              }}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>
        {isCoach && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0' }}>
            <button onClick={() => { setFilterMine(v => !v); setCurrentPage(1); }} aria-pressed={filterMine} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', flexShrink: 0,
              fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: filterMine ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
              border: `1px solid ${filterMine ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
              color: filterMine ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: filterMine ? 600 : 400,
            }}>
              {t('coach.myClientsFilter')}
            </button>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '10px 16px', position: 'relative' }}>
          <Search size={14} strokeWidth={2} style={{
            position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder={t('members.searchPlaceholder')}
            style={{
              width: '100%', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)', borderRadius: 10,
              padding: '9px 14px 9px 34px', fontSize: 16,
              color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <TypeFilter value={filterType} onChange={v => { setFilterType(v); setFilterPackage(''); setFilterSessionsLeft(''); setCurrentPage(1); }} t={t} />
        </div>

        {/* Member card list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('members.loading')}
            </div>
          ) : pagedFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('members.noMembers')}
            </div>
          ) : pagedFiltered.map(m => {
            const initials = ([m.firstName?.[0], m.lastName?.[0]].filter(Boolean).join('') || '?').toUpperCase();
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/members/${m.id}`)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)',
                  fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: 'DM Sans',
                }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                    fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.package?.name || t('members.noPackage')} {m.phone ? `· ${m.phone}` : ''}
                  </div>
                  <ApprovalChip member={m} />
                </div>

                {/* Status + arrow */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <MemberStatusTags member={m} vertical />
                  <ChevronRight size={14} color="var(--text-muted)" strokeWidth={2} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination - simple prev/next on mobile */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 16px', marginTop: 4,
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: '7px 14px', fontSize: 12,
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === 1 ? 'default' : 'pointer', fontFamily: 'DM Sans',
              }}
            >
              {t('common.previous')}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: '7px 14px', fontSize: 12,
                color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'default' : 'pointer', fontFamily: 'DM Sans',
              }}
            >
              {t('common.next')}
            </button>
          </div>
        )}

        {/* FAB - add member (management/front-desk only) */}
        {canManage && <FAB onClick={() => setShowAddMember(true)} label="Add Member" />}

        {/* Modals */}
        {showAddMember && (
          <AddMemberModal open={showAddMember} packagesList={packagesList} gymData={gymData} onClose={() => setShowAddMember(false)}
            onCreated={(m) => { setMembersList(p => [m, ...p]); setShowAddMember(false); }} />
        )}
        {showAddVisitor && (
          <AddVisitorModal open={showAddVisitor} packagesList={packagesList} gymData={gymData} onClose={() => setShowAddVisitor(false)}
            onCreated={(m) => { setMembersList(p => [m, ...p]); setShowAddVisitor(false); }} />
        )}
      </div>
    );
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
            {loading ? t('common.loading') : t('members.summaryLine', { total: membersList.length, active: filterByTab(membersList, 'Active').length, expiring: membersList.filter(membershipEndsThisWeek).length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={secondaryBtn} onClick={handleExport}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} strokeWidth={2} />
              {t('common.export')}
            </span>
          </button>
          {canManage && (
            <button onClick={() => setShowAddVisitor(true)} style={secondaryBtn}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={13} strokeWidth={2} />
                {t('members.addVisitor')}
              </span>
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowAddMember(true)} style={primaryBtn}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={13} strokeWidth={2} />
                {t('members.addMember')}
              </span>
            </button>
          )}
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

          {/* Select mode trigger. lives in the tab row, right side */}
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
              title={selectionMode ? t('common.close') : t('members.selectMembers')}
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

          {/* Type: works inside every tab, so Active/Inactive can be narrowed to visitors or monthly members */}
          <TypeFilter value={filterType} onChange={v => { setFilterType(v); setFilterPackage(''); setFilterSessionsLeft(''); setCurrentPage(1); }} t={t} />

          {/* Dropdowns */}
          {filterType === 'visitor'
            ? <FilterDropdown label={t('members.sessionsLeft')} options={SESSIONS_LEFT_OPTIONS} labels={SESSIONS_LEFT_LABELS} value={filterSessionsLeft} onChange={v => { setFilterSessionsLeft(v); setCurrentPage(1); }} />
            : <FilterDropdown label={t('members.filterPackage')} options={packagesList.filter(p => (filterType === 'monthly' ? !p.isVisitor : true)).map(p => p.name)} value={filterPackage} onChange={v => { setFilterPackage(v); setCurrentPage(1); }} />
          }
          <FilterDropdown label={t('members.filterGender')} options={GENDER_OPTIONS} labels={GENDER_LABELS} value={filterGender} onChange={v => { setFilterGender(v); setCurrentPage(1); }} />
          <FilterDropdown label={t('members.filterJoined')} options={JOINED_OPTIONS} labels={JOINED_LABELS} value={filterJoined} onChange={v => { setFilterJoined(v); setCurrentPage(1); }} />

          {/* Inactive sub-status */}
          {activeTab === 'Inactive' && (
            <FilterDropdown
              label={t('members.filterStatus')}
              options={INACTIVE_STATUS_OPTIONS}
              labels={INACTIVE_STATUS_LABELS}
              value={inactiveSub === 'All Inactive' ? '' : inactiveSub}
              onChange={v => { setInactiveSub(v || 'All Inactive'); setCurrentPage(1); }}
            />
          )}

          {/* Toggle: a coach's own clients */}
          {isCoach && (
            <button onClick={() => { setFilterMine(v => !v); setCurrentPage(1); }} aria-pressed={filterMine} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', flexShrink: 0,
              fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: filterMine ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
              border: `1px solid ${filterMine ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
              color: filterMine ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: filterMine ? 600 : 400,
            }}>
              {t('coach.myClientsFilter')}
            </button>
          )}

          {/* Toggle: Needs attention (money and membership requests, neither a coach's) */}
          {filterType !== 'visitor' && !isCoach && (
            <button onClick={() => { setFilterNeedsAttention(v => !v); setCurrentPage(1); }} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: filterNeedsAttention ? 'var(--accent-yellow-dim)' : 'var(--bg-card)',
              border: `1px solid ${filterNeedsAttention ? 'var(--accent-yellow)' : 'var(--border-subtle)'}`,
              color: filterNeedsAttention ? 'var(--accent-yellow)' : 'var(--text-secondary)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: filterNeedsAttention ? 'var(--accent-yellow)' : 'var(--text-muted)' }} />
              {t('common.needsAttention')}
            </button>
          )}

          {/* Toggle: Owing */}
          {showsMoney && (activeTab === 'Active' || filterType === 'visitor') && (
            <button onClick={() => { setFilterOwing(v => !v); setCurrentPage(1); }} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans', transition: 'all 0.15s',
              background: filterOwing ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
              border: `1px solid ${filterOwing ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'}`,
              color: filterOwing ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}>
              {t('members.owing')}
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
              {t('members.expiringSoon')}
            </button>
          )}


          {/* Clear filters */}
          {anyFilterActive && (
            <button onClick={() => { resetFilters(); setFilterType(''); }} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <X size={12} strokeWidth={2} /> {t('members.clearFilters')}
            </button>
          )}
        </div>

        {/* Table + Pagination */}
        <div ref={tableScrollRef} className="gem-table-scroll" style={{ overflowX: 'auto' }}>
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
                {tableHeaders.map(h => (
                  <th key={h} className={h === t('members.startDate') ? 'gem-col-start' : undefined} style={{
                    ...thStyle, textAlign: h === t('members.balance') ? 'right' : 'left',
                    ...(h === t('members.actions') ? { ...stickyActions, ...(pinnedEdge ? pinnedShadow : {}), background: stickyHeadBg } : {}),
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableHeaders.length + (selectionMode ? 1 : 0)} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('members.loading')}
                  </td>
                </tr>
              ) : pagedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length + (selectionMode ? 1 : 0)} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('members.noMembers')}
                  </td>
                </tr>
              ) : (
                pagedFiltered.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    pinnedEdge={pinnedEdge}
                    showStatus={showStatusCol}
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
            {t('common.showing')} {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} {t('common.of')} {filtered.length} {t('members.membersCount')}
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
              {selectedIds.size} {t('members.membersCount')} {t('members.selected')}
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 4px' }} />

          {/* Send Message: to a group, management only */}
          {['general_manager', 'manager'].includes(getRole()) && <button
            data-bulk-message
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
            {t('members.sendMessage')}
          </button>}

          {/* Export selected */}
          <button
            onClick={() => {
              printPDF(
                [t('members.memberCode'), t('members.firstName'), t('members.lastName'), t('common.phone'), t('members.package'), t('common.status'), ...(showsMoney ? [t('members.balance')] : [])],
                selectedMembers.map(m => [m.memberCode, m.firstName, m.lastName, m.phone, m.package?.name ?? '', m.status, ...(showsMoney ? [m.balance ?? 0] : [])]),
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
            {t('common.export')}
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
        onCheckedIn={(after) => {
          setMembersList(prev => prev.map(m => m.id === checkinMember.id ? { ...m, ...after } : m));
          setCheckinMember(prev => prev ? { ...prev, ...after } : prev);
        }}
      />
      <SendMessageModal open={!!messageMember} onClose={() => setMessageMember(null)} members={messageMember ? [messageMember] : []} />
      <SendMessageModal open={bulkMessageOpen} onClose={() => setBulkMessageOpen(false)} members={selectedMembers} />
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
        title={t('members.deleteMember')}
        message={confirmDelete
          ? t('members.deleteMemberConfirm', { name: `${confirmDelete.firstName} ${confirmDelete.lastName}` })
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

function MemberRow({ member, hideExpiry, showStatus, isMenuOpen, onMenuToggle, onMenuClose, onAction, onRowClick, selectionMode, isSelected, onSelect, pinnedEdge }) {
  const { t } = useLanguage();
  const showsMoney = !isFitness(getRole());
  const [hovered, setHovered]     = useState(false);
  const savedPhoto = member.photo || null;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 16, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{member.memberCode}</span>
              <ApprovalChip member={member} inline />
            </div>
          </div>
        </div>
      </td>

      {/* Phone */}
      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{member.phone}</td>

      {/* Package */}
      <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>{member.package?.name ?? '-'}</td>

      {/* Start Date. hidden on narrower screens so the row fits beside the pinned actions */}
      <td className="gem-col-start" style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {formatDate(member.startDate)}
      </td>

      {/* Expiry. hidden on Visitors tab */}
      {!hideExpiry && (
        <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {member.endDate ? formatDate(member.endDate) : '-'}
        </td>
      )}

      {/* Status. shown on Inactive tab */}
      {showStatus && (
        <td style={tdStyle}>
          <MemberStatusTags member={member} />
        </td>
      )}

      {/* Balance */}
      {showsMoney && (
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {(member.balance || 0) === 0 ? (
            <span style={{ color: 'var(--accent-green)' }}>{formatMoney(0)}</span>
          ) : (
            <span style={{ color: 'var(--accent-red)' }}>{formatMoney(member.balance)}</span>
          )}
        </td>
      )}

      {/* Last Visit */}
      <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {member.lastVisit ? formatDate(member.lastVisit) : '-'}
      </td>

      {/* Actions */}
      <td style={{ ...tdStyle, ...stickyActions, ...(pinnedEdge ? pinnedShadow : {}), background: hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
        <RowMenu title={t('members.actions')} items={[
          { label: t('members.viewProfile'), icon: <Eye size={15} />,           onClick: () => onAction('view', member) },
          { label: t('members.checkIn'),     icon: <UserCheck size={15} />,     onClick: () => onAction('checkin', member),
            hidden: !['general_manager', 'manager', 'front_desk'].includes(getRole()) },
          { label: t('members.sendMessage'), icon: <MessageSquare size={15} />, onClick: () => onAction('message', member),
            hidden: !['general_manager', 'manager', 'front_desk'].includes(getRole()) },
          { label: t('members.addPayment'),  icon: <CreditCard size={15} />,    onClick: () => onAction('payment', member),
            hidden: !['general_manager', 'manager', 'front_desk'].includes(getRole()) },
        ]} />
      </td>
    </tr>
  );
}
