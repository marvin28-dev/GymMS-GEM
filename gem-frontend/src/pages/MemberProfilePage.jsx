import MemberProgressTab from '../components/MemberProgressTab';
import MemberCoachRow from '../components/MemberCoachRow';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import useLiveRefresh from '../hooks/useLiveRefresh';
import useOnOpen from '../hooks/useOnOpen';
import { useState, useEffect, useRef } from 'react';
import { getCurrencySymbol, formatMoney } from '../utils/currency';
import { durationText } from '../utils/packageText';
import { roleName } from '../utils/roleNames';
import { readStoredJson, storeJson } from '../utils/storage';
import { digitsOnly } from '../utils/number';
import { autoPaymentDescription } from '../utils/paymentDescription';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import CodeInput from '../components/ui/CodeInput';
import LoadFailed from '../components/ui/LoadFailed';
import { Edit2, CreditCard, LogIn, Snowflake, XCircle,
  Package, RefreshCw, MessageSquare, StickyNote, Plus, User,
  Eye, EyeOff, Save, Lock, UserCheck, AlertTriangle,
  Download, FileText, Users, UserMinus, Ticket, Camera, Trash2, Mail, Smartphone, X, Phone, Check
} from 'lucide-react';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import RowMenu from '../components/ui/RowMenu';
import VisitKindBadge from '../components/ui/VisitKindBadge';
import Modal from '../components/ui/Modal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getAuth, getRole, getPhonePlaceholder } from '../utils/auth';
import { isFitness } from '../utils/rolePages';
import AddressInputs from '../components/AddressInputs';
import { formatAddress } from '../utils/address';
import { serverFieldError, revealFirstError } from '../utils/formErrors';
import { getOne as getMemberById, update as updateMember, sendCode as sendMemberCode } from '../services/members.service';
import { applyDirect as applyMemberAction, create as createApproval, listForMember as listApprovals, approve as approveRequest, reject as rejectRequest, cancel as cancelRequest } from '../services/approvals.service';
import { getAll as getPackages } from '../services/packages.service';
import { create as createPayment, remove as removePayment, sendReceipt as sendPaymentReceiptApi, removeKeepalive as removePaymentKeepalive } from '../services/payments.service';
import { useGymSettings } from '../hooks/useGymSettings';
import { enabledMethods, PAYMENT_METHODS, canonicalMethod } from '../utils/paymentMethods';
import { checkIn as checkInApi } from '../services/attendance.service';
import { checkInBlockReason, passesLeft, passesOf, checkInErrorText } from '../utils/checkin';
import { getMyGym } from '../services/gym.service';
import { getForMember as getMemberMessages } from '../services/communications.service';
import SendMessageModal from '../components/SendMessageModal';
import { uploadPhoto } from '../services/upload.service';
import { fmtDate, fmtTime, todayStr, dayStr } from '../utils/date';
import { getGymInfo, gymContactFooterHtml, printReceiptDocument, escapeHtml } from '../utils/receipt';
import { packageAllowance } from '../utils/packages';

const formatDate = (d) => fmtDate(d);

// ─── Shared button styles ────────────────────────────────────────────────────
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
  display: 'flex',
  alignItems: 'center',
  gap: 6,
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
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card)',
};

// ─── Table helpers ────────────────────────────────────────────────────────────
const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  fontFamily: 'DM Sans',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
        {value || '-'}
      </span>
    </div>
  );
}

function DobRow({ dob }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const formatted = fmtDate(dob);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.dateOfBirth')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
          {visible ? formatted : (dob ? '••••••••••' : '-')}
        </span>
        {dob && (
          <button
            onClick={() => setVisible(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            {visible ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────
function EditPersonalModal({ open, onClose, member, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Filled when it opens: the profile reloads on every change in the gym
  useOnOpen(open, () => {
    if (member) setForm({
      firstName:        member.firstName        || '',
      lastName:         member.lastName         || '',
      gender:           member.gender           || '',
      dob:              member.dob              || '',
      phone:            member.phone            || '',
      email:            member.email            || '',
      houseNumber:      member.houseNumber      || '',
      street:           member.street           || '',
      city:             member.city             || '',
      region:           member.region           || '',
      postalCode:       member.postalCode       || '',
      country:          member.country          || '',
      emergencyContact: member.emergencyContact || '',
      emergencyPhone:   member.emergencyPhone   || '',
    });
  });
  useEffect(() => { if (open) setFieldErrors({}); }, [open]);

  if (!member) return null;
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setFieldErrors(fe => ({ ...fe, [k]: undefined })); };
  const gymCountry = getAuth()?.user?.gymCountry || '';

  const handleSave = async () => {
    const req = t('common.required');
    const fe = Object.fromEntries(['firstName', 'lastName', 'gender', 'phone', 'email', 'street', 'city', 'region']
      .filter(k => !String(form[k] || '').trim()).map(k => [k, req]));
    setFieldErrors(fe);
    if (Object.keys(fe).length) { revealFirstError(); return; }
    setError('');
    setSaving(true);
    try { await onSave?.(form); onClose(); }
    catch (err) {
      const se = serverFieldError(err, t('memberProfile.actionFailed'));
      if (se.field) setFieldErrors(f => ({ ...f, [se.field]: se.message })); else setError(se.message);
    }
    finally { setSaving(false); }
  };

  const SectionLabel = ({ title }) => (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px',
      color: 'var(--text-muted)', fontWeight: 600,
      paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginTop: 4,
    }}>{title}</div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.editPersonalTitle')} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        <SectionLabel title={t('memberProfile.personalInfoSection')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={`${t('memberProfile.firstName')} *`} error={fieldErrors.firstName} value={form.firstName} onChange={set('firstName')} placeholder={t('memberProfile.firstName')} />
          <GemInput label={`${t('memberProfile.lastName')} *`} error={fieldErrors.lastName} value={form.lastName}  onChange={set('lastName')}  placeholder={t('memberProfile.lastName')} />
          <GemSelect label={`${t('memberProfile.gender')} *`} error={fieldErrors.gender} value={form.gender} onChange={set('gender')} options={[
            { value: '', label: t('memberProfile.selectOption') },
            { value: 'Male', label: t('common.male') },
            { value: 'Female', label: t('common.female') },
            { value: 'Other', label: t('memberProfile.other') },
          ]} />
          <GemInput label={t('memberProfile.dateOfBirth')} type="date" value={form.dob} onChange={set('dob')} />
          <GemInput label={`${t('memberProfile.phone')} *`} error={fieldErrors.phone} inputMode="tel" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value.replace(/[^\d\s+\-()]/g, '') })); setFieldErrors(fe => ({ ...fe, phone: undefined })); }} placeholder={getPhonePlaceholder()} />
          <GemInput label={`${t('memberProfile.email')} *`} error={fieldErrors.email} type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
        </div>

        <SectionLabel title={t('memberProfile.addressSection')} />
        <AddressInputs value={form} gymCountry={gymCountry} errors={fieldErrors} onChange={(k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErrors(fe => ({ ...fe, [k]: undefined })); }} />

        <SectionLabel title={t('memberProfile.emergencySection')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('memberProfile.contactName')}  value={form.emergencyContact} onChange={set('emergencyContact')} placeholder={t('common.fullName')} />
          <GemInput label={t('memberProfile.contactPhone')} inputMode="tel" value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value.replace(/[^\d\s+\-()]/g, '') }))} placeholder={getPhonePlaceholder()} />
        </div>

        {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button style={primaryBtn} onClick={handleSave} disabled={saving}><Save size={13} /> {saving ? t('memberProfile.saving') : t('memberProfile.saveChanges')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────
function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

function AddPaymentModal({ open, onClose, onSave, member }) {
  const { t } = useLanguage();
  const gymSettings = useGymSettings();
  const todayLabel = fmtDate(new Date());
  const freshForm = () => ({ amount: '', method: 'Cash', type: 'membership', description: autoPaymentDescription(member, 'membership'), reference: generateRef() });
  const [form, setForm] = useState(freshForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [amountError, setAmountError] = useState('');
  useEffect(() => { if (open) { setForm(freshForm()); setError(''); } }, [open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const owedBalance  = Math.max(0, member?.balance || 0);
  const payAmt       = parseFloat(form.amount) || 0;
  const remaining    = Math.max(0, owedBalance - payAmt);
  // A membership (or "other") payment pays down what the member owes, so it can
  // never be more than that - the gym never owes a member.
  const reducesBalance = form.type === 'membership' || form.type === 'other';
  const overpay      = reducesBalance && payAmt > owedBalance;

  const handleSave = async () => {
    if (!form.amount || payAmt <= 0) { setAmountError(t('payments.invalidAmount')); return; }
    if (overpay) return;
    setAmountError('');
    setSaving(true); setError('');
    try {
      await onSave?.({
        amount:      payAmt,
        method:      form.method,
        type:        form.type,
        description: form.description || undefined,
        reference:   form.reference,
        towardBalance: reducesBalance,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || t('memberProfile.paymentSaveFailed'));
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal open={open} onClose={onClose} title={`${t('memberProfile.addPaymentTitle')}${member ? ` : ${member.firstName} ${member.lastName}` : ''}`} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Balance owed banner */}
        {owedBalance > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>{t('memberProfile.outstandingBalance')}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope' }}>{fmtMoney(owedBalance)}</div>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, amount: String(owedBalance) }))}
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}
            >
              {t('memberProfile.payInFull')}
            </button>
          </div>
        )}
        {owedBalance === 0 && (
          <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#34d399', fontFamily: 'DM Sans', fontWeight: 500 }}>
            {t('memberProfile.accountFullyPaid')}
          </div>
        )}

        {/* Reference */}
        <div>
          <label style={lbl}>{t('memberProfile.referenceLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('memberProfile.autoGenerated')}</span></label>
          <div style={{ ...inp, background: 'var(--bg-card)', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', userSelect: 'all' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0, display: 'inline-block' }} />
            {form.reference}
          </div>
        </div>

        {/* Amount + Method */}
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>{t('memberProfile.amountIn', { currency: getCurrencySymbol() })}</label>
            <input type="text" inputMode="numeric" style={{ ...inp, borderColor: overpay || amountError ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.amount} onChange={e => { e.target.value = digitsOnly(e.target.value); set('amount')(e); setAmountError(''); }} placeholder="0" autoFocus />
            {overpay && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{t('memberProfile.amountOverMax', { amount: fmtMoney(owedBalance) })}</div>}
            {!overpay && amountError && <div role="alert" style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{amountError}</div>}
          </div>
          <div>
            <label style={lbl}>{t('memberProfile.methodLabel')}</label>
            <select style={inp} value={form.method} onChange={set('method')}>
              {enabledMethods(gymSettings).map(m => <option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
            </select>
          </div>
        </div>

        {/* Type */}
        <div>
          <label style={lbl}>{t('memberProfile.paymentType')}</label>
          <select style={inp} value={form.type} onChange={e => {
            const newType = e.target.value;
            setForm(f => {
              const custom = f.description && f.description !== autoPaymentDescription(member, f.type);
              return { ...f, type: newType, description: custom ? f.description : autoPaymentDescription(member, newType) };
            });
          }}>
            <option value="membership">{t('memberProfile.paymentTypeMembership')}</option>
            <option value="registration">{t('memberProfile.paymentTypeRegistration')}</option>
            <option value="product">{t('memberProfile.paymentTypeProduct')}</option>
            <option value="other">{t('memberProfile.paymentTypeOther')}</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label style={lbl}>{t('memberProfile.descriptionLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('memberProfile.optional')}</span></label>
          <input style={inp} value={form.description} onChange={set('description')} placeholder={t('members.paymentDescPh')} />
        </div>

        {/* Date locked */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
          <Lock size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.dateLocked')} : {todayLabel}</span>
        </div>

        {/* Balance preview */}
        {payAmt > 0 && reducesBalance && !overpay && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('memberProfile.balanceAfterPayment')}</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : 'var(--text-primary)' }}>
              {remaining === 0 ? '✓ ' : ''}{fmtMoney(remaining)}
            </span>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>⚠ {error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button type="button"
            style={{ ...primaryBtn, opacity: (form.amount && !saving && !overpay) ? 1 : 0.45, cursor: (form.amount && !saving && !overpay) ? 'pointer' : 'not-allowed' }}
            disabled={!form.amount || saving || overpay} onClick={handleSave}>
            {saving ? t('memberProfile.saving') : t('memberProfile.savePayment')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Payment Detail Modal ────────────────────────────────────────────────────
function PaymentDetailModal({ open, onClose, payment, member }) {
  const { t } = useLanguage();
  if (!payment) return null;
  const today = fmtDate(new Date()) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleDownload = () => {
    const gym = getGymInfo();
    const row = (label, value) =>
      `<div class="row"><span class="label">${escapeHtml(label)}</span><span>${escapeHtml(value ?? '')}</span></div>`;

    printReceiptDocument({
      title: `Receipt ${payment.reference}`,
      bodyHtml: `
        <h2>${escapeHtml(gym.name.toUpperCase())}</h2>
        <div class="sub">${escapeHtml(t('memberProfile.paymentReceiptHeader'))}</div>
        <hr/>
        ${row(t('memberProfile.receiptReference'), payment.reference)}
        ${row(t('memberProfile.receiptDate'), payment.date)}
        ${row(t('common.name'), `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim())}
        ${row(t('payments.memberId'), member?.memberCode || member?.id)}
        <hr/>
        ${row(t('memberProfile.receiptDescription'), payment.description)}
        ${row(t('memberProfile.receiptMethod'), payment.method)}
        ${row(t('memberProfile.receiptRecordedBy'), payment.recordedBy)}
        <hr/>
        <div class="amount">${escapeHtml(payment.amount)}</div>
        ${row(t('memberProfile.receiptBalanceAfter'), payment.balanceAfter)}
        <div class="footer">${escapeHtml(t('memberProfile.thankYouReceipt'))}<br/>${escapeHtml(today)}</div>
        ${gymContactFooterHtml()}
      `,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.paymentReceiptTitle')} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Receipt card */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        }}>
          {/* Header strip */}
          <div style={{
            background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
            padding: '14px 18px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: 800, color: '#0a0a0f', letterSpacing: '0.05em' }}>{getGymInfo().name.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>{t('memberProfile.paymentReceiptHeader')}</div>
          </div>
          {/* Body */}
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              [t('memberProfile.receiptReference'), payment.reference],
              [t('memberProfile.receiptDate'), payment.date],
              [t('memberProfile.receiptDescription'), payment.description],
              [t('memberProfile.receiptMethod'), payment.method],
              [t('memberProfile.receiptRecordedBy'), payment.recordedBy],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('memberProfile.receiptAmount')}</span>
              <span style={{ color: 'var(--accent-green)' }}>{payment.amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.receiptBalanceAfter')}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{payment.balanceAfter}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.close')}</button>
          <button style={primaryBtn} onClick={handleDownload}>
            <Download size={13} /> {t('memberProfile.downloadReceipt')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// When a prerequisite payment is collected inside an action modal and the user
// then backs out, the money must not stay in the books. This tracks every
// payment collected in the modal and, on cancel, refunds (deletes) them before
// closing - so the gym is never left holding income for an action it didn't do.
function usePaymentRefund(rawClose) {
  const [paidIds, setPaidIds]     = useState([]);
  const [refunding, setRefunding] = useState(false);
  // A ref mirrors paidIds so the unload / unmount handlers (which capture a
  // stale closure) always see the current set.
  const paidRef = useRef([]);
  const settledRef = useRef(false); // true once confirmed or cancelled - no revert then
  useEffect(() => { paidRef.current = paidIds; }, [paidIds]);

  const addPaid = (id) => { if (id) setPaidIds(ids => [...ids, id]); };
  const reset   = () => { setPaidIds([]); paidRef.current = []; settledRef.current = false; };
  const cancel  = async () => {
    if (refunding) return;
    settledRef.current = true;
    if (paidIds.length) {
      setRefunding(true);
      try { for (const id of paidIds) { await removePayment(id).catch(() => {}); } }
      finally { setRefunding(false); }
      setPaidIds([]); paidRef.current = [];
    }
    rawClose();
  };
  const confirmClose = () => { settledRef.current = true; setPaidIds([]); paidRef.current = []; rawClose(); };
  // The receipt email is held until the action is confirmed, then sent for each
  // payment collected in the modal (best-effort, never blocks the close).
  const sendReceipts = async () => { for (const id of paidIds) { await sendPaymentReceiptApi(id).catch(() => {}); } };

  // Closing/refreshing the tab mid-transaction (payment taken, action not yet
  // confirmed) must not strand the money. While a payment is pending we warn
  // with the browser's native "leave site" prompt and, on actual unload, fire a
  // keepalive refund for each collected payment so it is removed from the books.
  useEffect(() => {
    if (!paidIds.length) return;
    // beforeunload only asks the browser to confirm leaving (it must NOT refund
    // yet - the person may choose to stay). The actual refund goes out on
    // pagehide, which fires only once the page is really being torn down.
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    const onPageHide = () => { for (const id of paidRef.current) removePaymentKeepalive(id); };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [paidIds.length]);

  // If the modal is torn down with money still pending and neither confirmed nor
  // cancelled (e.g. a parent force-closed it), refund what was collected.
  useEffect(() => () => {
    if (!settledRef.current && paidRef.current.length) {
      for (const id of paidRef.current) removePayment(id).catch(() => {});
    }
  }, []);

  return { paidIds, addPaid, reset, cancel, confirmClose, sendReceipts, refunding, hasPaid: paidIds.length > 0 };
}

// The cancel control for an action modal: a plain "Cancel" until money has been
// taken, then a "Refund payment & cancel" that undoes the income first.
function CancelOrRefund({ refund, saving }) {
  const { t } = useLanguage();
  const { hasPaid, refunding, cancel } = refund;
  return (
    <button
      onClick={cancel}
      disabled={saving || refunding}
      style={{
        ...secondaryBtn,
        opacity: (saving || refunding) ? 0.6 : 1,
        cursor: (saving || refunding) ? 'not-allowed' : 'pointer',
        ...(hasPaid ? { borderColor: 'rgba(239,68,68,0.4)', color: 'var(--accent-red)' } : {}),
      }}
    >
      {hasPaid ? (refunding ? t('memberProfile.refunding') : t('memberProfile.refundAndCancel')) : t('memberProfile.cancel')}
    </button>
  );
}

// ─── Convert to Visitor Modal ─────────────────────────────────────────────────
function ConvertToVisitorModal({ open, onClose, member, gymData, packagesList = [], onApplied, onSettleBalance }) {
  const { t } = useLanguage();
  const refund = usePaymentRefund(onClose);
  const outstanding = Math.max(0, Number(member?.balance) || 0);
  const visitorPkgs = packagesList.filter(p => p.isVisitor);
  const [selectedId, setSelectedId]   = useState('');
  const [paidNow, setPaidNow]         = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving]           = useState(false);
  useEffect(() => { if (open) { setSelectedId(visitorPkgs[0]?.id || ''); setPaidNow(0); setShowPayment(false); setSaving(false); refund.reset(); } }, [open]);

  const pkg = visitorPkgs.find(p => p.id === selectedId) || visitorPkgs[0] || null;
  const price = pkg?.price ?? 0;
  const sessions = packageAllowance(pkg); // the bundle's own session count; null = unlimited
  // Same deal as registering a new visitor: at least a minimum upfront (50% by
  // default), the rest becomes the member's balance (a debt). Never offset by
  // what the member already owes - this is money for the new bundle.
  const minPct = gymData?.minUpfrontPercent || 50;
  const minRequired = pkg ? Math.ceil(price * minPct / 100) : 0;
  const canAfford = !!pkg && paidNow >= minRequired;
  const toMinimum = Math.max(0, minRequired - paidNow);
  const remainderDebt = Math.max(0, price - paidNow);

  const handleConfirm = async () => {
    if (!member || !pkg || !canAfford || saving) return;
    setSaving(true);
    try {
      const today = todayStr();
      const data = {
        isVisitor: true, status: 'visitor', packageId: pkg.id,
        startDate: today, endDate: pkg.durationDays ? addDays(today, pkg.durationDays) : null,
        passesTotal: sessions, passesRemaining: sessions, balance: remainderDebt,
      };
      const res = await updateMember(member.id, data);
      await refund.sendReceipts();
      onApplied?.(res?.data || data);
      refund.confirmClose();
    } catch { setSaving(false); }
  };

  const row = (label, value, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );

  if (outstanding > 0) {
    return (
      <Modal open={open} onClose={onClose} title={t('memberProfile.convertToVisitorTitle')} maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f87171', marginBottom: 6 }}>{t('memberProfile.settleFirstTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.settleFirstBody')} <strong style={{ color: '#f87171' }}>{fmtMoney(outstanding)}</strong>{t('memberProfile.settleBeforeConvert')}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
            <button style={primaryBtn} onClick={() => onSettleBalance?.()}>
              <CreditCard size={13} /> {t('memberProfile.settleBalanceBtn')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={refund.cancel} hideClose={refund.hasPaid} title={t('memberProfile.convertToVisitorTitle')} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: '#ef4444' }}>{t('memberProfile.convertWarning')}</strong> {t('memberProfile.convertWarningText')}
        </div>

        {visitorPkgs.length === 0 ? (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            {t('memberProfile.noVisitorPackage')}
          </div>
        ) : (
          <>
            <GemSelect
              label={t('memberProfile.visitorPackageLabel')}
              value={pkg?.id || ''}
              onChange={e => { setSelectedId(e.target.value); setPaidNow(0); setShowPayment(false); refund.reset(); }}
              options={visitorPkgs.map(p => ({ value: p.id, label: `${p.name} - ${fmtMoney(p.price)}` }))}
            />
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {row(t('memberProfile.sessionsLabel'), sessions == null ? t('memberProfile.unlimited') : sessions)}
              {row(t('memberProfile.amountToPay'), fmtMoney(price), 'var(--accent-gold)')}
              {row(t('memberProfile.minimumRequired') + ` (${minPct}%)`, fmtMoney(minRequired))}
              {paidNow > 0 && <>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
                {row(t('memberProfile.payingNow'), fmtMoney(paidNow), '#34d399')}
                {remainderDebt > 0 && row(t('memberProfile.remainingDebt'), fmtMoney(remainderDebt), 'var(--accent-red)')}
              </>}
            </div>

            {price > 0 && paidNow < minRequired && !showPayment && (
              <button onClick={() => setShowPayment(true)} style={{ ...secondaryBtn, justifyContent: 'center', borderColor: 'rgba(212,175,55,0.35)', color: 'var(--accent-gold)' }}>
                <CreditCard size={13} /> {t('memberProfile.collectPaymentPlain')}
              </button>
            )}
            {showPayment && toMinimum > 0 && (
              <InlinePaymentSection
                shortfall={toMinimum} minAmount={toMinimum}
                defaultAmount={price - paidNow} maxAmount={price - paidNow}
                pctBase={price} pctAlready={paidNow} minPct={minPct}
                memberId={member?.id} type="product" notify={false}
                description={`${t('memberProfile.convertToVisitor')} - ${pkg?.name || ''}`}
                onPaymentAdded={(n, id) => { setPaidNow(p => p + n); refund.addPaid(id); setShowPayment(false); }}
              />
            )}
            {price > 0 && paidNow >= minRequired && (
              <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#34d399', fontWeight: 600 }}>✓ {t('memberProfile.paymentReceived')}</div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <CancelOrRefund refund={refund} saving={saving} />
          <button
            style={{ ...primaryBtn, background: 'var(--accent-red)', border: 'none', opacity: (canAfford && !saving) ? 1 : 0.4, cursor: (canAfford && !saving) ? 'pointer' : 'not-allowed' }}
            disabled={!canAfford || saving} onClick={handleConfirm}
          >
            <UserMinus size={13} /> {saving ? t('memberProfile.processing') : t('memberProfile.convertToVisitor')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Check-In Code Modal ─────────────────────────────────────────────────────
function CheckInCodeModal({ open, onClose, member, onSuccess }) {
  const { t } = useLanguage();
  const [entered, setEntered] = useState('');
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);
  const [busy, setBusy]       = useState(false);
  useEffect(() => { if (!open) { setEntered(''); setError(''); setDone(false); setBusy(false); } }, [open]);

  // "Check-in confirmed" only once the server has checked them in; its refusal
  // (already in at 10:15, a lapsed membership) stays in the dialog (F-107).
  // onSuccess answers with the reason it could not check them in, or nothing.
  const handleConfirm = async () => {
    if (busy) return;
    if (entered.trim() !== member?.accessCode) {
      setError(t('memberProfile.incorrectCodeMsg'));
      return;
    }
    setBusy(true);
    const problem = await onSuccess?.();
    setBusy(false);
    if (problem) { setError(problem); return; }
    setDone(true);
    setTimeout(() => onClose(), 900);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.verifyAccessCodeTitle')} maxWidth={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {done ? (
          <div style={{
            textAlign: 'center', padding: '24px 0',
            color: '#34d399', fontWeight: 700, fontSize: 16, fontFamily: 'Manrope',
          }}>
            {t('memberProfile.checkInConfirmed')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.ask')} <strong style={{ color: 'var(--text-primary)' }}>{member?.firstName} {member?.lastName}</strong> {t('memberProfile.askForCode')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CodeInput
                autoFocus
                maxLength={6}
                value={entered}
                onChange={v => { setEntered(v); setError(''); }}
                onEnter={handleConfirm}
                placeholder="••••"
                style={{
                  background: 'var(--bg-elevated)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)'}`,
                  borderRadius: 10, padding: '11px 14px', fontSize: 20,
                  color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.25em', textAlign: 'center', outline: 'none',
                  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
              />
              {error && <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'DM Sans' }}>{error}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
              <button
                style={{ ...primaryBtn, opacity: entered.trim() && !busy ? 1 : 0.4, cursor: entered.trim() && !busy ? 'pointer' : 'not-allowed' }}
                disabled={!entered.trim() || busy}
                onClick={handleConfirm}
              >
                <LogIn size={13} /> {busy ? t('memberProfile.processing') : t('memberProfile.checkIn')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Send Code Modal ──────────────────────────────────────────────────────────
// Re-sends a member their own check-in code. Email goes through the server;
// a text opens this device's messaging app prefilled, since there is no SMS gateway.
function SendCodeModal({ open, onClose, member, gymName }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState('');
  const [ok, setOk]     = useState(false);
  useEffect(() => { if (!open) { setBusy(false); setMsg(''); setOk(false); } }, [open]);

  const emailIt = async () => {
    if (busy) return;
    if (!member?.email) { setOk(false); setMsg(t('memberProfile.noEmailOnFile')); return; }
    setBusy(true); setMsg('');
    try {
      await sendMemberCode(member.id);
      setOk(true); setMsg(t('memberProfile.codeEmailedTo', { email: member.email }));
    } catch (err) {
      setOk(false); setMsg(err?.response?.data?.error || t('memberProfile.codeSendFailed'));
    } finally { setBusy(false); }
  };
  const textIt = () => {
    if (!member?.phone) { setOk(false); setMsg(t('memberProfile.noPhoneOnFile')); return; }
    const body = t('memberProfile.codeSmsBody', { gym: gymName || 'the gym', code: member.accessCode || '' });
    window.location.href = `sms:${member.phone}?body=${encodeURIComponent(body)}`;
    setOk(true); setMsg(t('memberProfile.codeTextOpened'));
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.sendAccessCodeTitle')} maxWidth={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('memberProfile.sendCodeMessage')}{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{member?.firstName} {member?.lastName}</strong>.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...secondaryBtn, flex: 1, justifyContent: 'center', opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }} onClick={emailIt} disabled={busy}>
            <Mail size={13} /> {busy ? t('memberProfile.sending') : t('memberProfile.sendByEmail')}
          </button>
          <button style={{ ...secondaryBtn, flex: 1, justifyContent: 'center' }} onClick={textIt}>
            <Smartphone size={13} /> {t('memberProfile.sendByText')}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, fontFamily: 'DM Sans', color: ok ? '#34d399' : 'var(--accent-red)' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Renew Registration Fee Modal ────────────────────────────────────────────
function RenewRegFeeModal({ open, onClose, member, gymData, onSave }) {
  const { t } = useLanguage();
  const gymSettings = useGymSettings();
  const feeAmount  = gymData?.registrationFee || 5000;
  const [method, setMethod]   = useState('Cash');
  const [ref]                 = useState(generateRef());
  const [saving, setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => { if (!open) { setApiError(''); setSaving(false); } }, [open]);

  const today    = todayStr();
  // A year on, as a local day: a local midnight turned into UTC read a day early
  const newExpiry = (() => { const d = new Date(today + 'T00:00:00'); d.setFullYear(d.getFullYear() + 1); return dayStr(d); })();

  if (!open || !member) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ ...cardStyle, width: '100%', maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(201,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={16} style={{ color: 'var(--accent-gold)' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.renewRegistrationTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.firstName} {member.lastName}</div>
          </div>
        </div>

        {/* Summary card */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.annualRegFee')}</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>{fmtMoney(feeAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.validFrom')}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDate(today)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.expiresOn')}</span>
            <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatDate(newExpiry)}</span>
          </div>
        </div>

        {/* Method */}
        <GemSelect label={t('memberProfile.paymentMethodLabel')} value={method} onChange={e => setMethod(e.target.value)}
          options={enabledMethods(gymSettings).map(m => ({ value: m.key, label: t(m.labelKey) }))} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t('memberProfile.refLabel')} {ref}</div>

        {apiError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{apiError}</div>}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={async () => {
              setSaving(true); setApiError('');
              try {
                await createPayment({ amount: feeAmount, method, reference: ref, memberId: member.id, type: 'registration', description: t('memberProfile.regFeeRenewalDesc') });
                await updateMember(member.id, { regFeeDate: today, status: member.status === 'suspended' ? 'active' : member.status });
                onSave?.({ regFeeDate: today, status: member.status === 'suspended' ? 'active' : member.status });
                onClose();
              } catch (err) {
                setApiError(err?.response?.data?.error || t('memberProfile.paymentFailedRetry'));
                setSaving(false);
              }
            }}
          >
            <CreditCard size={13} /> {saving ? t('memberProfile.processing') : `Pay ${fmtMoney(feeAmount)} & Renew`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Note Modal ───────────────────────────────────────────────────────────
function AddNoteModal({ open, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ note: '', category: 'General' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSave = () => {
    if (!form.note.trim()) return;
    onSave?.(form);
    setForm({ note: '', category: 'General' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.addNoteTitle')} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
            {t('memberProfile.noteLabel')}
          </label>
          <textarea
            value={form.note}
            onChange={set('note')}
            rows={4}
            placeholder={t('memberProfile.notePlaceholder')}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'DM Sans',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              width: '100%',
            }}
          />
        </div>
        <GemSelect
          label={t('memberProfile.categoryLabel')}
          value={form.category}
          onChange={set('category')}
          options={[
            { value: 'General', label: t('memberProfile.categoryGeneral') },
            { value: 'Health', label: t('memberProfile.categoryHealth') },
            { value: 'Financial', label: t('memberProfile.categoryFinancial') },
            { value: 'Other', label: t('memberProfile.categoryOther') },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button style={primaryBtn} onClick={handleSave}>{t('memberProfile.saveNote')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Send Message Modal ───────────────────────────────────────────────────────
// ─── Membership helpers ───────────────────────────────────────────────────────

const PKG_MONTHS = {
  'Basic Monthly':   1,
  'Standard 6M':     6,
  'Premium 12M':    12,
  'Student Monthly': 1,
  'Visitor Pass':    0,
};

function toDateStr(raw) {
  if (!raw) return todayStr();
  return String(raw).slice(0, 10);
}

function addMonths(dateStr, n) {
  const d = new Date(toDateStr(dateStr) + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return dayStr(d);
}

function addDays(dateStr, n) {
  const d = new Date(toDateStr(dateStr) + 'T00:00:00');
  d.setDate(d.getDate() + (Number.isFinite(n) ? n : 0));
  if (Number.isNaN(d.getTime())) return toDateStr(dateStr);
  return dayStr(d);
}

function deriveStatus(startDate, endDate) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = startDate ? new Date(toDateStr(startDate) + 'T00:00:00') : null;
  const end   = endDate   ? new Date(toDateStr(endDate)   + 'T00:00:00') : null;
  if (start && start > now) return 'pending';
  if (end && end < now) return 'expired';
  if (end && end >= now && end <= in7Days) return 'expiring';
  return 'active';
}

function calcEndDate(startDate, pkgName) {
  const months = PKG_MONTHS[pkgName];
  if (!months) return startDate;
  return addMonths(startDate, months);
}

function calcEndDateFromPkg(startDate, pkg) {
  if (!pkg || !startDate) return startDate;
  // Prefer the pre-computed durationDays stored on the package
  if (pkg.durationDays) return addDays(startDate, pkg.durationDays);
  // Parse duration string e.g. "1 Months", "6 Months", "30 Days", "1 Year"
  if (pkg.duration) {
    const m = pkg.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      if (unit.startsWith('day'))   return addDays(startDate, n);
      if (unit.startsWith('week'))  return addDays(startDate, n * 7);
      if (unit.startsWith('month')) return addMonths(startDate, n);
      if (unit.startsWith('year'))  return addMonths(startDate, n * 12);
    }
  }
  // Final fallback to legacy name-based lookup
  return calcEndDate(startDate, pkg.name);
}

function fmtMoney(n) {
  return formatMoney(n || 0);
}

// ─── Insufficient Balance Notice ──────────────────────────────────────────────

// Inline payment section. expands inside the parent modal, no context switching.
// Every payment taken here is toward something being bought in the modal that is
// not on the account yet, so it can never be more than what is left of that
// charge (maxAmount), and that charge goes to the server so the payment records
// the balance it really leaves the member on. minAmount, when set, is the least
// that may be taken; pctBase/pctAlready/minPct show the share paid as the staff
// types, red under the minimum and green once it is met.
function InlinePaymentSection({ shortfall, maxAmount, minAmount = 0, defaultAmount, pctBase, pctAlready = 0, minPct, memberId, type = 'membership', onPaymentAdded, confirmLabel, savingLabel, description, notify = true }) {
  const { t } = useLanguage();
  const gymSettings = useGymSettings();
  const cap = maxAmount ?? shortfall;
  const start = defaultAmount ?? shortfall;
  const [amount, setAmount]       = useState(String(start > 0 ? start : ''));
  const [method, setMethod]       = useState('Cash');
  const [ref]                     = useState(generateRef());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState('');

  const isRenewal = !!confirmLabel;
  const n = parseInt(amount, 10) || 0;
  const overMax  = cap > 0 && n > cap;
  const underMin = n > 0 && n < minAmount;
  const validAmount = n > 0 && !overMax && !underMin;
  const pct = pctBase > 0 ? Math.floor(((pctAlready + n) / pctBase) * 100) : null;
  const pctOk = minPct == null || (pct != null && pct >= minPct);

  if (submitted) {
    return (
      <div style={{
        background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        color: 'var(--accent-green)',
      }}>
        <span style={{ fontSize: 18 }}>✓</span> Payment of {fmtMoney(n)} recorded.
      </div>
    );
  }

  return (
    <div style={{
      background: isRenewal ? 'rgba(201,169,110,0.06)' : 'var(--bg-elevated)',
      border: `1px solid ${isRenewal ? 'rgba(201,169,110,0.3)' : 'var(--border-subtle)'}`,
      borderRadius: 12, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CreditCard size={13} style={{ color: 'var(--accent-gold)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: isRenewal ? 'var(--accent-gold)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {isRenewal ? t('memberProfile.paymentRequired') : t('memberProfile.addPaymentBtn')}
        </span>
      </div>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <GemInput label={t('memberProfile.amountInShort', { currency: getCurrencySymbol() })} required type="text" inputMode="numeric" value={amount} onChange={e => setAmount(digitsOnly(e.target.value))} />
        <GemSelect label={t('memberProfile.methodLabel')} value={method} onChange={e => setMethod(e.target.value)}
          options={enabledMethods(gymSettings).map(m => ({ value: m.key, label: t(m.labelKey) }))} />
      </div>
      {pct != null && n > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pctOk && !overMax ? '#34d399' : '#ef4444', transition: 'width 0.2s, background 0.2s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: pctOk && !overMax ? '#34d399' : '#ef4444', minWidth: 44, textAlign: 'right' }}>{pct}%</span>
        </div>
      )}
      {overMax && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{t('memberProfile.amountOverMax', { amount: fmtMoney(cap) })}</div>}
      {underMin && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{minPct != null ? t('memberProfile.amountUnderPct', { pct: minPct, amount: fmtMoney(minAmount) }) : t('memberProfile.amountUnderMin', { amount: fmtMoney(minAmount) })}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t('memberProfile.refLabel')} {ref}</div>
      {apiError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{apiError}</div>}
      <button
        disabled={saving || !validAmount}
        onClick={async () => {
          if (!validAmount) return;
          setSaving(true); setApiError('');
          try {
            const res = await createPayment({ amount: n, method, reference: ref, memberId, type, description: description || undefined, notify, pendingCharge: cap > 0 ? cap : undefined });
            setSubmitted(true);
            onPaymentAdded(n, res?.data?.id);
          } catch (err) {
            setApiError(err?.response?.data?.error || t('memberProfile.paymentFailedRetry'));
            setSaving(false);
          }
        }}
        style={{
          ...primaryBtn,
          width: '100%', justifyContent: 'center',
          opacity: (saving || !validAmount) ? 0.5 : 1,
          cursor: (saving || !validAmount) ? 'not-allowed' : 'pointer',
          ...(isRenewal ? { padding: '11px 16px' } : {}),
          gap: 8,
        }}
      >
        {saving ? (
          <>{savingLabel || t('memberProfile.processing')}</>
        ) : isRenewal ? (
          <><CreditCard size={13} /> Pay {validAmount ? fmtMoney(n) : ''} &amp; Renew <RefreshCw size={13} /></>
        ) : (
          t('memberProfile.confirmPayment')
        )}
      </button>
    </div>
  );
}

function BalanceStatus({ effectiveBalance, pkg, onShowPayment, showingPayment }) {
  const { t } = useLanguage();
  if (!pkg) return null;
  const minPayment = pkg.minPayment ?? pkg.price;
  const minShortfall = minPayment - effectiveBalance;
  const remaining = pkg.price - effectiveBalance;

  // Full balance covers the package
  if (remaining <= 0) {
    return (
      <div style={{
        background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
        borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent-green)',
      }}>
        {t('memberProfile.balanceSufficient')} : {fmtMoney(effectiveBalance)} available · Package costs {fmtMoney(pkg.price)}
      </div>
    );
  }

  // Minimum payment is met. can proceed, remainder becomes debt
  if (minShortfall <= 0) {
    return (
      <div style={{
        background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)',
        borderRadius: 10, padding: '12px 16px', fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 4 }}>{t('memberProfile.minPaymentMet')}</div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('memberProfile.payingNow')} <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(effectiveBalance)}</strong>
          &ensp;·&ensp; {t('memberProfile.remainingDebt')} <strong style={{ color: 'var(--accent-red)' }}>{fmtMoney(remaining)}</strong>
          &ensp;·&ensp; {t('memberProfile.fullPrice')} {fmtMoney(pkg.price)}
        </div>
      </div>
    );
  }

  // Below minimum. cannot proceed
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 2 }}>{t('memberProfile.belowMinPayment')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('memberProfile.balanceLabel2')} {fmtMoney(effectiveBalance)}
          &ensp;·&ensp; {t('memberProfile.minimumRequired')} <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(minPayment)}</strong>
          &ensp;·&ensp; {t('memberProfile.shortBy')} {fmtMoney(minShortfall)}
        </div>
      </div>
      {!showingPayment && (
        <button onClick={onShowPayment} style={{ ...primaryBtn, background: 'var(--accent-red)', border: 'none', whiteSpace: 'nowrap' }}>
          {t('memberProfile.addPaymentBtn')}
        </button>
      )}
    </div>
  );
}

// ─── Change Package Modal ─────────────────────────────────────────────────────

function ChangePackageModal({ open, onClose, member, packagesList = [], onSave }) {
  const { t } = useLanguage();
  const refund = usePaymentRefund(onClose);
  const [selectedPkg, setSelectedPkg]   = useState('');
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => { if (!open) { setSelectedPkg(''); setExtraBalance(0); setShowPayment(false); setSaving(false); refund.reset(); } }, [open]);

  const pkg = packagesList.find(p => p.name === selectedPkg) || null;
  const today = todayStr();
  const effectiveBalance = extraBalance;
  const minPayment = pkg ? (pkg.minPayment ?? pkg.price) : 0;
  const canAfford = pkg && effectiveBalance >= minPayment;
  const shortfall = pkg ? Math.max(0, minPayment - effectiveBalance) : 0;

  return (
    <Modal open={open} onClose={refund.cancel} hideClose={refund.hasPaid} title={t('memberProfile.changePackageTitle')} maxWidth={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {t('memberProfile.changePackageInfo')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.current')} <strong style={{ color: 'var(--text-primary)' }}>{member.package?.name ?? member.package}</strong>
          &ensp;·&ensp; {t('memberProfile.balance')}: <strong style={{ color: extraBalance > 0 ? 'var(--accent-green)' : 'var(--accent-gold)' }}>{fmtMoney(effectiveBalance)}</strong>
          {extraBalance > 0 && <span style={{ color: 'var(--accent-green)' }}> (+{fmtMoney(extraBalance)} added)</span>}
        </div>
        <GemSelect
          label={t('memberProfile.newPackageLabel')}
          required
          value={selectedPkg}
          onChange={e => { setSelectedPkg(e.target.value); setShowPayment(false); }}
          options={[
            { value: '', label: t('memberProfile.selectNewPackage') },
            ...packagesList.filter(p => !p.isVisitor && p.name !== (member.package?.name ?? member.package)).map(p => ({
              value: p.name, label: `${p.name} : ${fmtMoney(p.price)}`,
            })),
          ]}
        />
        {pkg && (
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InfoRow label={t('memberProfile.packagePrice')} value={fmtMoney(pkg.price)} />
            <InfoRow label={t('memberProfile.durationLabel')} value={durationText(pkg.duration, t)} />
            <InfoRow label={t('memberProfile.accessLabel')} value={pkg.access} />
            <InfoRow label={t('memberProfile.newEndDateLabel')} value={formatDate(calcEndDateFromPkg(today, pkg))} />
          </div>
        )}
        {pkg && (
          <BalanceStatus
            effectiveBalance={effectiveBalance}
            pkg={pkg}
            showingPayment={showPayment}
            onShowPayment={() => setShowPayment(true)}
          />
        )}
        {showPayment && shortfall > 0 && (
          <InlinePaymentSection
            shortfall={shortfall}
            minAmount={shortfall}
            maxAmount={Math.max(0, pkg.price - extraBalance)}
            memberId={member.id}
            type="product"
            notify={false}
            description={`${t('memberProfile.changePackageTitle')} - ${pkg?.name || ''}`}
            onPaymentAdded={(n, id) => { setExtraBalance(e => e + n); refund.addPaid(id); setShowPayment(false); }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <CancelOrRefund refund={refund} saving={saving} />
          <button
            style={{ ...primaryBtn, opacity: (!pkg || !canAfford || saving) ? 0.4 : 1, cursor: (!pkg || !canAfford || saving) ? 'not-allowed' : 'pointer' }}
            disabled={!pkg || !canAfford || saving}
            onClick={async () => {
              if (!pkg) return;
              setSaving(true);
              try {
                const newEndDate = calcEndDateFromPkg(today, pkg);
                const newBalance = Math.max(0, pkg.price - extraBalance);
                await updateMember(member.id, {
                  packageId: pkg.id,
                  startDate: today,
                  endDate: newEndDate,
                  balance: newBalance,
                  status: 'active',
                });
                await refund.sendReceipts();
                onSave?.({ packageId: pkg.id, package: pkg, startDate: today, endDate: newEndDate, balance: newBalance, status: deriveStatus(today, newEndDate) });
                refund.confirmClose();
              } catch { setSaving(false); }
            }}
          >
            <Package size={13} /> {saving ? t('memberProfile.saving') : t('memberProfile.confirmChange')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Renew Membership Modal ───────────────────────────────────────────────────

function RenewMembershipModal({ open, onClose, member, packagesList = [], onSave, onSettleBalance }) {
  const { t } = useLanguage();
  const outstanding = Math.max(0, Number(member?.balance) || 0);
  const todayIso = todayStr();
  const [selectedPkg, setSelectedPkg]   = useState('');
  const [startDate, setStartDate]       = useState('');
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  const [saving, setSaving]             = useState(false);

  // Set when it opens, so a reload of the member does not undo the choices
  useOnOpen(open, () => {
    setSelectedPkg(member.package?.name || member.package || '');
    const isExpiredOrLapsed = !member.endDate || new Date(member.endDate) < new Date();
    const isDeactivated = member.status === 'deactivated' || member.status === 'cancelled';
    setStartDate((isExpiredOrLapsed || isDeactivated) ? todayStr() : member.endDate.slice(0, 10));
    setExtraBalance(0);
    setShowPayment(false);
    setSaving(false);
  });

  const pkg = packagesList.find(p => p.name === selectedPkg) || null;
  const endDate = (pkg && startDate) ? calcEndDateFromPkg(startDate, pkg) : null;
  const effectiveBalance = extraBalance;
  const minPayment = pkg ? (pkg.minPayment ?? pkg.price) : 0;
  const canAfford = pkg && effectiveBalance >= minPayment;
  const shortfall = pkg ? Math.max(0, minPayment - effectiveBalance) : 0;

  // Shared by the confirm button and the inline payment flow, so a member who
  // owes nothing can still be renewed without going through a payment step.
  const commitRenewal = async (balanceUsed) => {
    if (!pkg || !startDate) return;
    setSaving(true);
    try {
      const memberBalance = Math.max(0, pkg.price - balanceUsed);
      // Renewal re-issues the allowance from the package as it stands today,
      // so unused sessions do not carry into the new term
      const allowance = packageAllowance(pkg);
      await updateMember(member.id, {
        packageId: pkg.id,
        startDate,
        endDate: endDate || undefined,
        balance: memberBalance,
        status: 'active',
        isVisitor: false,
        passesTotal: allowance,
        passesRemaining: allowance,
        _notify: 'renew_membership',
      });
      onSave?.({
        packageId: pkg.id, package: pkg, startDate, endDate,
        balance: memberBalance, status: deriveStatus(startDate, endDate),
        passesTotal: allowance, passesRemaining: allowance,
      });
      onClose();
    } catch { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.renewMembershipTitle')} maxWidth={480}>
      {outstanding > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f87171', marginBottom: 6 }}>{t('memberProfile.settleFirstTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.settleFirstBody')} <strong style={{ color: '#f87171' }}>{fmtMoney(outstanding)}</strong>{t('memberProfile.settleFirstBodyEnd')}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
            <button style={primaryBtn} onClick={() => onSettleBalance?.()}>
              <CreditCard size={13} /> {t('memberProfile.settleBalanceBtn')}
            </button>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.balance')}: <strong style={{ color: extraBalance > 0 ? 'var(--accent-green)' : 'var(--accent-gold)' }}>{fmtMoney(effectiveBalance)}</strong>
          {extraBalance > 0 && <span style={{ color: 'var(--accent-green)' }}> (+{fmtMoney(extraBalance)} added)</span>}
          &ensp;·&ensp; {t('memberProfile.expiresLabel')} <strong style={{ color: 'var(--text-primary)' }}>{formatDate(member.endDate)}</strong>
        </div>
        <GemSelect
          label={t('memberProfile.package')}
          required
          value={selectedPkg}
          onChange={e => { setSelectedPkg(e.target.value); setShowPayment(false); }}
          options={[
            { value: '', label: t('memberProfile.selectPackage') },
            ...packagesList.filter(p => !p.isVisitor).map(p => ({
              value: p.name, label: `${p.name} : ${fmtMoney(p.price)}`,
            })),
          ]}
        />
        <GemInput label={t('memberProfile.startDate')} required type="date" min={todayIso} value={startDate} onChange={e => setStartDate(e.target.value)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('memberProfile.endDateAutoCalc')}</label>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '9px 14px', fontSize: 13,
            color: endDate ? 'var(--accent-gold)' : 'var(--text-muted)',
            fontWeight: endDate ? 600 : 400,
          }}>
            {endDate ? formatDate(endDate) : ''}
          </div>
        </div>
        {pkg && (() => {
          const allowance = packageAllowance(pkg);
          const current = member?.passesRemaining;
          return (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px' }}>
              {allowance == null
                ? <>{t('memberProfile.renewUnlimitedA')} <strong style={{ color: 'var(--accent-gold)' }}>{t('memberProfile.renewUnlimitedB')}</strong>{t('memberProfile.renewUnlimitedC')}</>
                : <>{t('memberProfile.renewSetsA')} <strong style={{ color: 'var(--accent-gold)' }}>{allowance}</strong>{current != null ? t('memberProfile.renewReplacing', { n: current }) : '.'}</>}
            </div>
          );
        })()}
        {pkg && (
          <BalanceStatus
            effectiveBalance={effectiveBalance}
            pkg={pkg}
            showingPayment={showPayment}
            onShowPayment={() => setShowPayment(true)}
          />
        )}
        {showPayment && shortfall > 0 && (
          <InlinePaymentSection
            shortfall={shortfall}
            minAmount={shortfall}
            maxAmount={Math.max(0, pkg.price - extraBalance)}
            memberId={member.id}
            type="membership"
            confirmLabel="renew"
            savingLabel={t('memberProfile.processingRenewing')}
            onPaymentAdded={async (n) => {
              const newBalance = extraBalance + n;
              setExtraBalance(newBalance);
              setShowPayment(false);
              await commitRenewal(newBalance);
            }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          {pkg && canAfford && !showPayment && (
            <button
              style={{ ...primaryBtn, opacity: saving || !startDate || startDate < todayIso ? 0.6 : 1 }}
              disabled={saving || !startDate || startDate < todayIso}
              onClick={() => commitRenewal(effectiveBalance)}
            >
              <RefreshCw size={13} /> {saving ? t('memberProfile.processing') : t('memberProfile.confirmRenew')}
            </button>
          )}
        </div>
      </div>
      )}
    </Modal>
  );
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────

// ─── Action confirm (apply directly, or request a manager's approval) ─────────
// A manager applies the change at once; anyone else sends it to the managers as
// a request they approve, which then applies the change server-side.
// withReason: the action takes a reason (freeze, cancel). There is one box for
// it: a manager types the reason; the front desk's reason IS the note the
// manager reads when deciding, so nobody types the same thing twice.
// A member can have only one request waiting at a time; the desk is told before
// typing anything, and the server refuses a second one regardless.
function ActionConfirm({ member, action, params, valid = true, confirmLabel, confirmIcon, danger, withReason = false, reasonRequired = false, reasonPH, onApplied, onClose }) {
  const { t } = useLanguage();
  const mgmt = ['general_manager', 'manager'].includes(getRole());
  const [note, setNote]       = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);
  const [waiting, setWaiting] = useState(null);
  const [checking, setChecking] = useState(!mgmt);
  const [withdrawing, setWithdrawing] = useState(false);
  // The front desk is a shared screen: a manager signed in there confirms with
  // their own 4-digit code before the change is applied
  const atDesk = useLocation().pathname.startsWith('/front-desk');
  const [codeOpen, setCodeOpen] = useState(false);
  const mine = !!waiting && waiting.requestedById === getAuth()?.user?.id;
  const withdraw = async () => {
    if (!waiting || withdrawing) return;
    setWithdrawing(true); setError('');
    try { await cancelRequest(waiting.id); setWaiting(null); }
    catch (err) { setError(err?.response?.data?.error || t('memberProfile.actionFailed')); }
    setWithdrawing(false);
  };
  const noteRef = useRef(null);

  useEffect(() => {
    if (mgmt || !member?.id) return;
    let alive = true;
    listApprovals(member.id, { status: 'pending' })
      .then(r => { if (alive) setWaiting((r.data || [])[0] || null); })
      .catch(() => {})
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [mgmt, member?.id]);

  // The box is held while the check runs, so it takes the cursor once that is done
  useEffect(() => { if (!mgmt && !checking && !waiting) noteRef.current?.focus(); }, [mgmt, checking, waiting]);

  const text = note.trim();
  const needText = mgmt ? (withReason && reasonRequired) : true;
  const ready = valid && !busy && !checking && !waiting && (!needText || !!text);
  const sendParams = withReason && text ? { ...params, reason: text } : params;

  const doApply = async () => {
    if (!ready) { if (needText && !text) setError(t('memberProfile.reasonNeeded')); return; }
    setBusy(true); setError('');
    try {
      const res = await applyMemberAction({ memberId: member.id, action, params: sendParams });
      onApplied?.(res.data?.member);
      onClose?.();
    } catch (err) { setError(err?.response?.data?.error || t('memberProfile.actionFailed')); setBusy(false); }
  };
  const doRequest = async () => {
    if (!text) { setError(t('memberProfile.approvalNoteRequired')); return; }
    if (!ready) return;
    setBusy(true); setError('');
    try {
      await createApproval({ memberId: member.id, action, params: sendParams, note: text });
      setSent(true);
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.pending) setWaiting(err.response.data.pending);
      setError(err?.response?.data?.error || t('memberProfile.actionFailed'));
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#34d399', lineHeight: 1.6 }}>
          ✓ {t('memberProfile.approvalSent')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={primaryBtn} onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    );
  }

  const btnStyle = {
    ...primaryBtn,
    ...(danger ? { background: 'var(--accent-red)', border: 'none' } : {}),
    opacity: ready ? 1 : 0.5,
    cursor: ready ? 'pointer' : 'not-allowed',
  };
  // A plain box with a firmer outline than the fields around it; gold only
  // while it is being typed in
  const restBorder = 'color-mix(in srgb, var(--text-muted) 55%, transparent)';
  const boxStyle = (strong) => ({
    background: 'var(--bg-card)', border: `1px solid ${error && !text ? 'var(--accent-red)' : strong ? restBorder : 'var(--border-subtle)'}`,
    borderRadius: 10, padding: '11px 14px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'DM Sans',
    outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box', minHeight: strong ? 88 : 64, transition: 'border-color 0.15s',
  });
  const focusGold = { onFocus: e => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; }, onBlur: e => { e.currentTarget.style.borderColor = error && !text ? 'var(--accent-red)' : restBorder; } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {mgmt && withReason && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 600 }}>{t('memberProfile.reasonLabel')}{reasonRequired ? ' *' : ''}</label>
          <textarea value={note} onChange={e => { setNote(e.target.value); setError(''); }} rows={2} placeholder={reasonPH || t('memberProfile.reasonPH')} style={boxStyle(false)} />
        </div>
      )}
      {!mgmt && waiting && (
        <div role="alert" style={{ background: 'rgba(248,113,113,0.08)', border: '1.5px solid rgba(248,113,113,0.45)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#f87171' }}>
            <Lock size={14} /> {t('memberProfile.requestAlreadyWaiting')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{waiting.summary}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {waiting.requestedByName ? t('memberProfile.requestSentBy', { name: waiting.requestedByName }) + ' ' : ''}{mine ? t('memberProfile.requestWaitingMine') : t('memberProfile.requestWaitingHint')}
          </div>
          {mine && (
            <button onClick={withdraw} disabled={withdrawing} style={{ ...secondaryBtn, alignSelf: 'flex-start', marginTop: 4, padding: '6px 14px', fontSize: 12, color: 'var(--accent-red)', borderColor: 'rgba(248,113,113,0.4)' }}>
              <XCircle size={13} /> {withdrawing ? t('memberProfile.processing') : t('memberProfile.cancelRequest')}
            </button>
          )}
        </div>
      )}
      {!mgmt && !waiting && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, opacity: checking ? 0.6 : 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
              <Lock size={13} color="var(--text-secondary)" /> {t('memberProfile.approvalPanelTitle')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 3 }}>{t('memberProfile.approvalPanelHint')}</div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('memberProfile.reasonForManager')} *</span>
            <textarea ref={noteRef} value={note} disabled={checking} onChange={e => { setNote(e.target.value); setError(''); }} rows={3}
              placeholder={reasonPH || t('memberProfile.approvalNotePH')} style={boxStyle(true)} {...focusGold} />
          </label>
        </div>
      )}
      {mgmt && atDesk && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
          <Lock size={12} /> {t('memberProfile.deskCodeHint')}
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: 'var(--accent-red)' }}>{error}</div>}
      <ManagerAuthModal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        onConfirm={() => { setCodeOpen(false); doApply(); }}
        action={confirmLabel}
        danger={danger}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <button style={secondaryBtn} onClick={onClose}>{waiting ? t('common.close') : t('memberProfile.cancel')}</button>
        {!(waiting && !mgmt) && (
          <button style={btnStyle} disabled={!ready} onClick={mgmt ? (atDesk ? () => ready && setCodeOpen(true) : doApply) : doRequest}>
            {confirmIcon} {busy ? t('memberProfile.processing') : (mgmt ? confirmLabel : t('memberProfile.sendForApproval'))}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────

function ExtendModal({ open, onClose, member, onApplied }) {
  const { t } = useLanguage();
  const PRESETS = [
    { label: t('memberProfile.plus7days'),   days: 7 },
    { label: t('memberProfile.plus14days'),  days: 14 },
    { label: t('memberProfile.plus1month'),  days: 30 },
    { label: t('memberProfile.plus3months'), days: 90 },
    { label: t('memberProfile.customLabel'), days: null },
  ];
  const [preset, setPreset]         = useState(0);
  const [customDays, setCustomDays] = useState('');
  useEffect(() => { if (!open) { setPreset(0); setCustomDays(''); } }, [open]);

  const days = PRESETS[preset].days ?? parseInt(customDays || '0', 10);
  const currentEnd = member.endDate || todayStr();
  const newEnd = days > 0 ? addDays(currentEnd, days) : currentEnd;

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.extendMembershipTitle')} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.currentEndDateLabel')} <strong style={{ color: 'var(--text-primary)' }}>{formatDate(currentEnd)}</strong>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 8 }}>
            {t('memberProfile.extendBy')} *
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => setPreset(i)} style={{
                padding: '7px 14px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                fontFamily: 'DM Sans', transition: 'all 0.15s',
                border: preset === i ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                background: preset === i ? 'rgba(212,175,55,0.1)' : 'var(--bg-elevated)',
                color: preset === i ? 'var(--accent-gold)' : 'var(--text-secondary)',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {PRESETS[preset].days === null && (
          <GemInput label={t('memberProfile.numberOfDays')} type="number" value={customDays}
            onChange={e => setCustomDays(e.target.value)} placeholder="e.g. 45" />
        )}
        {days > 0 && (
          <div style={{
            background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent-gold)',
          }}>
            {t('memberProfile.newEndDate')} <strong>{formatDate(newEnd)}</strong>
          </div>
        )}
        <ActionConfirm
          member={member}
          action="extend_membership"
          params={{ days }}
          valid={days > 0}
          confirmLabel={t('memberProfile.confirmExtension')}
          onApplied={onApplied}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

// ─── Freeze Modal ─────────────────────────────────────────────────────────────

function FreezeModal({ open, onClose, member, onApplied }) {
  const { t } = useLanguage();
  const gymSettings = useGymSettings();
  // A freeze always starts today, so there is no start date to pick.
  const today = todayStr();
  const [duration, setDuration]     = useState('1M');
  useEffect(() => { if (!open) { setDuration('1M'); } }, [open]);

  const daysMap = { '1W': 7, '2W': 14, '1M': 30, '2M': 60 };
  const freezeDays = daysMap[duration];
  const currentEnd = member?.endDate || today;
  const newEnd = addDays(currentEnd, freezeDays);
  const freezeFee = Number(gymSettings?.freeze?.fee) || 0;
  const freezeInterval = Number(gymSettings?.freeze?.intervalDays) || 0;

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.freezeMembershipTitle')} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DismissibleInfo dismissKey="freeze_membership" color="blue">
          {t('memberProfile.freezeInfo')}
        </DismissibleInfo>
        <GemSelect label={t('memberProfile.durationLabel')} required value={duration} onChange={e => setDuration(e.target.value)} options={[
          { value: '1W', label: t('memberProfile.duration1w') },
          { value: '2W', label: t('memberProfile.duration2w') },
          { value: '1M', label: t('memberProfile.duration1m') },
          { value: '2M', label: t('memberProfile.duration2m') },
        ]} />
        {/* Date summary */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.currentEndDateLabel').replace(':', '')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatDate(currentEnd)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.freezeDuration')}</span>
            <span style={{ color: '#63b3ed' }}>+{freezeDays} {t('memberProfile.days')}</span>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('memberProfile.newEndDate').replace(':', '')}</span>
            <span style={{ color: 'var(--text-primary)' }}>{formatDate(newEnd)}</span>
          </div>
        </div>
        {freezeFee > 0 && (
          <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{t('memberProfile.freezeFeeNoticeTitle')}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMoney(freezeFee)}</span>
            </div>
            {t('memberProfile.freezeFeeNotice', { amount: fmtMoney(freezeFee), days: freezeInterval })}
          </div>
        )}
        <ActionConfirm
          member={member}
          action="freeze_membership"
          params={{ days: freezeDays }}
          valid={freezeDays > 0}
          withReason
          reasonPH={t('memberProfile.reasonPH')}
          confirmLabel={t('memberProfile.freezeMembershipBtn')}
          confirmIcon={<Snowflake size={13} />}
          onApplied={onApplied}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

// ─── Unfreeze Modal ───────────────────────────────────────────────────────────

function UnfreezeModal({ open, onClose, member, onApplied }) {
  const { t } = useLanguage();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Days actually frozen = today - freezeStartDate. Dates off the server are full
  // ISO strings, so normalise to YYYY-MM-DD before adding a time, or `new Date`
  // yields Invalid Date and the whole profile render throws.
  const freezeStart = member?.freezeStartDate
    ? new Date(toDateStr(member.freezeStartDate) + 'T00:00:00')
    : null;
  const daysActuallyFrozen = freezeStart && !Number.isNaN(freezeStart.getTime())
    ? Math.max(0, Math.round((today - freezeStart) / 86400000))
    : 0;

  // New end date = pre-freeze end date + days actually frozen
  const baseEnd = member?.preFreezEndDate || member?.endDate;
  const newEndDate = baseEnd ? addDays(baseEnd, daysActuallyFrozen) : null;

  // Days the freeze was originally meant to last
  const originalExtendedEnd = member?.endDate;
  const originalDays = (baseEnd && originalExtendedEnd)
    ? Math.round((new Date(toDateStr(originalExtendedEnd) + 'T00:00:00') - new Date(toDateStr(baseEnd) + 'T00:00:00')) / 86400000)
    : 0;
  const daysReturned = Math.max(0, originalDays - daysActuallyFrozen);

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.unfreezeMembershipTitle')} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Freeze summary */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.frozenSince')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {freezeStart ? formatDate(member.freezeStartDate) : '-'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.daysActuallyFrozen')}</span>
            <span style={{ color: '#63b3ed', fontWeight: 600 }}>{daysActuallyFrozen} {t('memberProfile.days')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.daysReturned')}</span>
            <span style={{ color: '#f97316' }}>−{daysReturned} {t('memberProfile.daysFromExtension')}</span>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('memberProfile.newEndDate').replace(':', '')}</span>
            <span style={{ color: '#34d399' }}>
              {newEndDate ? formatDate(newEndDate) : '-'}
            </span>
          </div>
        </div>

        <DismissibleInfo dismissKey="unfreeze_membership" color="green">
          {t('memberProfile.unfreezeAddBack', { frozen: daysActuallyFrozen, returned: daysReturned })}
        </DismissibleInfo>
        <ActionConfirm
          member={member}
          action="unfreeze_membership"
          params={{}}
          confirmLabel={t('memberProfile.confirmUnfreeze')}
          confirmIcon={<Snowflake size={13} />}
          onApplied={onApplied}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

// ─── Cancel Membership Modal ──────────────────────────────────────────────────

function CancelMembershipModal({ open, onClose, member, onApplied }) {
  const { t } = useLanguage();
  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.cancelMembershipTitle')} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 4 }}>{t('memberProfile.cannotBeUndone')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t('memberProfile.cancelWarning')}
          </div>
        </div>
        <ActionConfirm
          member={member}
          action="cancel_membership"
          params={{}}
          withReason
          reasonRequired
          reasonPH={t('memberProfile.reasonCancelPH')}
          danger
          confirmLabel={t('memberProfile.cancelMembershipBtn')}
          confirmIcon={<XCircle size={13} />}
          onApplied={onApplied}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}

// ─── Dismissible Info Box ─────────────────────────────────────────────────────
// dismissKey: unique string stored in localStorage so "don't show again" persists
function DismissibleInfo({ dismissKey, children, color = 'gold' }) {
  const { t } = useLanguage();
  const lsKey = `gem_dismiss_${dismissKey}`;
  const [hidden, setHidden] = useState(() => localStorage.getItem(lsKey) === '1');
  if (hidden) return null;
  const colors = {
    gold:  { bg: 'rgba(212,175,55,0.07)',  border: 'rgba(212,175,55,0.25)',  text: 'var(--text-secondary)' },
    blue:  { bg: 'rgba(99,179,237,0.08)',  border: 'rgba(99,179,237,0.2)',   text: 'var(--text-secondary)' },
    green: { bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)',   text: 'var(--text-secondary)' },
  };
  const c = colors[color] || colors.gold;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      color: c.text, lineHeight: 1.6,
    }}>
      <div style={{ marginBottom: 8 }}>{children}</div>
      <button
        onClick={() => { localStorage.setItem(lsKey, '1'); setHidden(true); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans',
          padding: 0, textDecoration: 'underline',
        }}
      >
        {t('memberProfile.dontShowAgain')}
      </button>
    </div>
  );
}

// ─── Day Pass Modal ───────────────────────────────────────────────────────────

function DayPassModal({ open, onClose, member, packagesList = [], onApplied, onSettleBalance }) {
  const { t } = useLanguage();
  const refund = usePaymentRefund(onClose);
  const isVisitor = !!member?.isVisitor || member?.status === 'visitor';
  // A day pass is always for a monthly package, priced at its day-pass rate. A
  // lapsed member buys one on their own package; a visitor picks which monthly
  // package the day is for (visitor bundles are renewed, not bought as passes).
  const monthlyPkgs = packagesList.filter(p => !p.isVisitor && p.dayPassPrice != null && p.isActive !== false && (p.status || 'active') === 'active');
  const ownPkg = packagesList.find(p => String(p.id) === String(member?.packageId))
    || (member?.package && typeof member.package === 'object' ? member.package : null);
  const [pickedId, setPickedId]         = useState('');
  const [paidNow, setPaidNow]           = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [purchased, setPurchased]       = useState(false);
  const [checkingIn, setCheckingIn]     = useState(false);
  useEffect(() => {
    if (!open) { setPaidNow(0); setShowPayment(false); setSaving(false); setPurchased(false); setCheckingIn(false); refund.reset(); }
    // A visitor's own package comes first, so a top-up starts on the right one
    else setPickedId(isVisitor ? ((monthlyPkgs.find(p => String(p.id) === String(member?.packageId)) || monthlyPkgs[0])?.id || '') : '');
  }, [open]);

  const pkg = isVisitor ? (monthlyPkgs.find(p => String(p.id) === String(pickedId)) || null) : ownPkg;
  const hasPrice = pkg?.dayPassPrice != null;
  const totalPrice = hasPrice ? Number(pkg.dayPassPrice) || 0 : 0;
  // Paid in full with money taken NOW - never offset by what the member already
  // owes (balance > 0 is a debt, not credit; the gym never owes them).
  const held = member?.dayPasses || 0;
  // A visitor with passes still usable on their current package uses those up
  // before buying a pass for a different one
  const visitorUnused = isVisitor
    ? ((member?.endDate && dayStr(member.endDate) >= todayStr()) ? Math.max(0, member?.passesRemaining || 0) : 0) + held
    : 0;
  const switchBlocked = isVisitor && !!pkg && visitorUnused > 0 && String(pkg.id) !== String(member?.packageId);
  const canAfford = hasPrice && paidNow >= totalPrice && !switchBlocked;
  const shortfall = Math.max(0, totalPrice - paidNow);

  const handleConfirm = async () => {
    if (!member || !canAfford || saving) return;
    setSaving(true);
    try {
      // A spent visitor reads as expired; a day pass puts them back in use.
      const today = todayStr();
      // Once every pass is spent the count starts again: a single pass bought
      // after a used-up bundle of 11 reads 1/1, not 1/12. Passes left on a
      // bundle that has run out are gone with it.
      const data = isVisitor
        ? {
            dayPasses: held + 1, status: 'visitor',
            passesTotal: visitorUnused > 0 ? passesOf(member) + 1 : 1,
            ...(visitorUnused > 0 ? {} : { passesRemaining: 0 }),
            ...(!member.endDate || dayStr(member.endDate) < today ? { endDate: today } : {}),
          }
        : { dayPasses: held + 1 };
      const res = await updateMember(member.id, data);
      await refund.sendReceipts();
      onApplied?.(res?.data || data);
      // Don't close yet - offer to check them in now so the staff don't forget.
      setPurchased(true);
      setSaving(false);
    } catch { setSaving(false); }
  };

  const [checkInErr, setCheckInErr] = useState('');
  const checkInNow = async () => {
    setCheckingIn(true); setCheckInErr('');
    // Hand the server's record back so the profile (passes, history) updates at once
    try {
      const res = await checkInApi({ memberId: member.id });
      onApplied?.(res?.data?.member || null);
    } catch (err) {
      // The pass is bought either way; say why they could not go in just now
      setCheckInErr(checkInErrorText(err, t, t('attendance.checkInFailed')));
      setCheckingIn(false);
      return;
    }
    refund.confirmClose();
  };

  const line = (label, value, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );

  const visitorOwes = isVisitor ? Math.max(0, Number(member?.balance) || 0) : 0;
  if (visitorOwes > 0 && !purchased) {
    return (
      <Modal open={open} onClose={onClose} title={t('memberProfile.buyDayPassTitle')} maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f87171', marginBottom: 6 }}>{t('memberProfile.settleFirstPassTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.settleFirstBody')} <strong style={{ color: '#f87171' }}>{fmtMoney(visitorOwes)}</strong>{t('memberProfile.settleBeforeBuyPass')}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
            <button style={primaryBtn} onClick={() => onSettleBalance?.()}>
              <CreditCard size={13} /> {t('memberProfile.settleBalanceBtn')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // After buying a pass: offer check in now / later so the staff don't forget.
  if (purchased) {
    return (
      <Modal open={open} onClose={refund.confirmClose} hideClose title={t('memberProfile.buyDayPassTitle')} maxWidth={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#34d399', fontWeight: 600 }}>
            ✓ {t('memberProfile.passAddedCheckInPrompt')}
          </div>
          {checkInErr && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', lineHeight: 1.5 }}>{checkInErr}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} disabled={checkingIn} onClick={refund.confirmClose}>{t('memberProfile.checkInLater')}</button>
            <button style={primaryBtn} disabled={checkingIn} onClick={checkInNow}>
              <LogIn size={13} /> {checkingIn ? t('memberProfile.processing') : t('memberProfile.checkInNow')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={refund.cancel} hideClose={refund.hasPaid} title={t('memberProfile.buyDayPassTitle')} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DismissibleInfo dismissKey={isVisitor ? 'buy_day_pass_visitor' : 'buy_day_pass'} color="gold">
          {isVisitor ? t('memberProfile.buyDayPassVisitorInfo') : t('memberProfile.buyDayPassInfo')}
        </DismissibleInfo>

        {isVisitor && (monthlyPkgs.length ? (
          <GemSelect
            label={t('memberProfile.dayPassForPackage')}
            required
            value={pickedId}
            onChange={e => { setPickedId(e.target.value); setShowPayment(false); }}
            disabled={refund.hasPaid}
            options={monthlyPkgs.map(p => ({ value: p.id, label: `${p.name} - ${fmtMoney(p.dayPassPrice)}` }))}
          />
        ) : (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            {t('memberProfile.noMonthlyDayPass')}
          </div>
        ))}

        {!isVisitor && !hasPrice && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            {t('memberProfile.noDayPassPrice')}
          </div>
        )}

        {hasPrice && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {line(t('memberProfile.package'), pkg.name)}
            {line(t('memberProfile.dayPassesHeld'), `${held} → ${held + 1}`, 'var(--accent-gold)')}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
            {line(t('memberProfile.totalLabel'), fmtMoney(totalPrice))}
            {paidNow > 0 && line(t('memberProfile.payingNow'), fmtMoney(paidNow), '#34d399')}
          </div>
        )}

        {switchBlocked && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#f87171', lineHeight: 1.5 }}>
            {t('memberProfile.useUpPassesFirst', { n: visitorUnused, pkg: member?.package?.name || '' })}
          </div>
        )}
        {/* A day pass is always paid in full upfront - no partial / "becomes debt". */}
        {!switchBlocked && hasPrice && totalPrice > 0 && paidNow < totalPrice && !showPayment && (
          <button onClick={() => setShowPayment(true)} style={{ ...secondaryBtn, justifyContent: 'center', borderColor: 'rgba(212,175,55,0.35)', color: 'var(--accent-gold)' }}>
            <CreditCard size={13} /> {t('memberProfile.collectPaymentPlain')}
          </button>
        )}
        {showPayment && shortfall > 0 && (
          <InlinePaymentSection
            shortfall={shortfall}
            minAmount={shortfall}
            memberId={member?.id}
            type="product"
            notify={false}
            description={`${t('memberProfile.dayPass')} - ${pkg?.name || ''}`}
            onPaymentAdded={(n, id) => { setPaidNow(p => p + n); refund.addPaid(id); setShowPayment(false); }}
          />
        )}
        {hasPrice && totalPrice > 0 && paidNow >= totalPrice && (
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#34d399', fontWeight: 600 }}>✓ {t('memberProfile.paymentReceived')}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <CancelOrRefund refund={refund} saving={saving} />
          <button
            style={{ ...primaryBtn, opacity: (canAfford && !saving) ? 1 : 0.4, cursor: (canAfford && !saving) ? 'pointer' : 'not-allowed' }}
            disabled={!canAfford || saving}
            onClick={handleConfirm}
          >
            <Ticket size={13} /> {saving ? t('memberProfile.processing') : t('memberProfile.confirmDayPass')}
          </button>
        </div>
      </div>
    </Modal>
  );
}


// ─── Renew Passes Modal (visitors) ────────────────────────────────────────────
// A visitor renews by buying another visitor bundle. Old debt is settled first.
// Unused passes carry over while the bundle is still valid, and the validity is
// extended from whichever is later, today or the current end date.
function RenewPassesModal({ open, onClose, member, gymData, packagesList = [], onApplied, onSettleBalance }) {
  const { t } = useLanguage();
  const refund = usePaymentRefund(onClose);
  const outstanding = Math.max(0, Number(member?.balance) || 0);
  const bundles = packagesList.filter(p => p.isVisitor && p.isActive !== false && (p.status || 'active') === 'active');
  const [selectedId, setSelectedId]   = useState('');
  const [paidNow, setPaidNow]         = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving]           = useState(false);
  useEffect(() => {
    if (open) {
      const current = bundles.find(p => String(p.id) === String(member?.packageId));
      setSelectedId((current || bundles[0])?.id || '');
      setPaidNow(0); setShowPayment(false); setSaving(false); refund.reset();
    }
  }, [open]);

  const pkg = bundles.find(p => String(p.id) === String(selectedId)) || null;
  const price = pkg?.price ?? 0;
  const sessions = packageAllowance(pkg) || 0;
  const minPct = gymData?.minUpfrontPercent || 50;
  const minRequired = pkg ? Math.ceil(price * minPct / 100) : 0;
  const toMinimum = Math.max(0, minRequired - paidNow);
  const remainderDebt = Math.max(0, price - paidNow);

  const today = todayStr();
  const stillValid = !!member?.endDate && String(member.endDate).slice(0, 10) >= today;
  const carryOver = stillValid ? Math.max(0, member?.passesRemaining || 0) : 0;
  const newPasses = carryOver + sessions;
  const dayPassesHeld = Math.max(0, member?.dayPasses || 0);
  // Passes still usable on the current package must be used before switching to another
  const unusedLeft = carryOver + dayPassesHeld;
  const switchBlocked = !!pkg && unusedLeft > 0 && String(pkg.id) !== String(member?.packageId);
  const canConfirm = !!pkg && paidNow >= minRequired && !saving && !switchBlocked;
  const currentPkgName = member?.package?.name || '';
  const extendFrom = stillValid ? String(member.endDate).slice(0, 10) : today;
  const newEnd = pkg?.durationDays ? addDays(extendFrom, pkg.durationDays) : null;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      const data = {
        isVisitor: true, status: 'visitor', packageId: pkg.id,
        passesTotal: newPasses + dayPassesHeld, passesRemaining: newPasses,
        endDate: newEnd, balance: remainderDebt,
        ...(stillValid ? {} : { startDate: today }),
      };
      const res = await updateMember(member.id, data);
      await refund.sendReceipts();
      onApplied?.(res?.data || data);
      refund.confirmClose();
    } catch { setSaving(false); }
  };

  const line = (label, value, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );

  if (outstanding > 0) {
    return (
      <Modal open={open} onClose={onClose} title={t('memberProfile.renewPassesTitle')} maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f87171', marginBottom: 6 }}>{t('memberProfile.settleFirstTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.settleFirstBody')} <strong style={{ color: '#f87171' }}>{fmtMoney(outstanding)}</strong>{t('memberProfile.settleBeforeRenewPasses')}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
            <button style={primaryBtn} onClick={() => onSettleBalance?.()}>
              <CreditCard size={13} /> {t('memberProfile.settleBalanceBtn')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={refund.cancel} hideClose={refund.hasPaid} title={t('memberProfile.renewPassesTitle')} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bundles.length === 0 ? (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            {t('memberProfile.noVisitorPackage')}
          </div>
        ) : (
          <>
            <GemSelect
              label={t('memberProfile.visitorPackageLabel')}
              required
              value={selectedId}
              disabled={refund.hasPaid}
              onChange={e => { setSelectedId(e.target.value); setShowPayment(false); }}
              options={bundles.map(p => ({ value: p.id, label: `${p.name} - ${fmtMoney(p.price)}` }))}
            />
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {line(t('memberProfile.passesAfterRenewal'), carryOver > 0 ? `${carryOver} + ${sessions} = ${newPasses}` : newPasses, 'var(--accent-gold)')}
              {line(t('memberProfile.validUntil'), newEnd ? formatDate(newEnd) : t('memberProfile.noExpiry'))}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
              {line(t('memberProfile.amountToPay'), fmtMoney(price))}
              {paidNow > 0 && line(t('memberProfile.payingNow'), fmtMoney(paidNow), '#34d399')}
              {paidNow > 0 && remainderDebt > 0 && line(t('memberProfile.remainingDebt'), fmtMoney(remainderDebt), 'var(--accent-red)')}
            </div>

            {switchBlocked && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#f87171', lineHeight: 1.5 }}>
                {t('memberProfile.useUpPassesFirst', { n: unusedLeft, pkg: currentPkgName })}
              </div>
            )}
            {!switchBlocked && price > 0 && paidNow < minRequired && !showPayment && (
              <button onClick={() => setShowPayment(true)} style={{ ...secondaryBtn, justifyContent: 'center', borderColor: 'rgba(212,175,55,0.35)', color: 'var(--accent-gold)' }}>
                <CreditCard size={13} /> {t('memberProfile.collectPaymentPlain')}
              </button>
            )}
            {!switchBlocked && showPayment && toMinimum > 0 && (
              <InlinePaymentSection
                shortfall={toMinimum} minAmount={toMinimum}
                defaultAmount={price - paidNow} maxAmount={price - paidNow}
                pctBase={price} pctAlready={paidNow} minPct={minPct}
                memberId={member?.id} type="product" notify={false}
                description={`${t('memberProfile.visitorBundle')} - ${pkg?.name || ''}`}
                onPaymentAdded={(n, id) => { setPaidNow(p => p + n); refund.addPaid(id); setShowPayment(false); }}
              />
            )}
            {price > 0 && paidNow >= minRequired && (
              <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#34d399', fontWeight: 600 }}>✓ {t('memberProfile.paymentReceived')}</div>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <CancelOrRefund refund={refund} saving={saving} />
          <button
            style={{ ...primaryBtn, opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            disabled={!canConfirm} onClick={handleConfirm}
          >
            <Ticket size={13} /> {saving ? t('memberProfile.processing') : t('memberProfile.renewPasses')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Empty state (used wherever a tab/table has nothing yet) ──────────────────
function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {Icon && <Icon size={22} color="var(--text-muted)" />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Manrope' }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', maxWidth: 340, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TAB_KEYS = ['Personal Details', 'Membership', 'Payments', 'Attendance', 'Progress', 'Messages', 'Notes'];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemberProfilePage({ memberId: propId, onBack, fromFrontDesk: propFromFrontDesk, initialAction, hideBack, seedMember, seedGym, seedPackages } = {}) {
  const { t } = useLanguage();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = propId || paramId;
  const fromFrontDesk = propFromFrontDesk !== undefined ? propFromFrontDesk : location.pathname.startsWith('/front-desk');

  // When the opener already has the data (the front desk does), render from it at
  // once and refresh in the background - no "Loading…" flash on first open.
  const [member, setMember]         = useState(seedMember || null);
  const [gymData, setGymData]       = useState(seedGym || null);
  const [packagesList, setPackagesList] = useState(seedPackages && seedPackages.length ? seedPackages : []);
  const [loading, setLoading]       = useState(!seedMember);

  // The member, the gym and the packages load apart, so one failing does not
  // hide the rest, and a member who could not be fetched is not called
  // missing: only a 404 is "not found" (F-102).
  const [loadFailed, setLoadFailed] = useState(null);
  const [partsFailed, setPartsFailed] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  useEffect(() => {
    if (!id) return;
    setLoadFailed(null);
    setPartsFailed(false);
    getMemberById(id)
      .then(r => setMember(r.data))
      .catch(err => setLoadFailed(err?.response?.status === 404 ? { notFound: true } : { message: err?.response?.data?.error }))
      .finally(() => setLoading(false));
    getMyGym().then(r => setGymData(r.data)).catch(() => setPartsFailed(true));
    getPackages().then(r => setPackagesList(r.data || [])).catch(() => setPartsFailed(true));
  }, [id, loadTick]);
  const retryLoad = () => setLoadTick(n => n + 1);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const memberPhotoRef = useRef(null);

  async function handleMemberPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadPhoto(file, 'gem/members');
      await updateMember(id, { photo: url });
      setMember(prev => ({ ...prev, photo: url }));
      setShowPhotoModal(false);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemoveMemberPhoto() {
    setPhotoUploading(true);
    try {
      await updateMember(id, { photo: null });
      setMember(prev => ({ ...prev, photo: null }));
      setShowPhotoModal(false);
    } catch (err) {
      console.error('Photo removal failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  }

  const [activeTab, setActiveTab] = useState('Personal Details');
  const [showPersonalModal, setShowPersonalModal]         = useState(false);
  const [showChangePackageModal, setShowChangePackageModal] = useState(false);
  const [showRenewModal, setShowRenewModal]               = useState(false);
  const [showExtendModal, setShowExtendModal]             = useState(false);
  const [showFreezeModal, setShowFreezeModal]             = useState(false);
  const [showUnfreezeModal, setShowUnfreezeModal]         = useState(false);
  const [showCancelModal, setShowCancelModal]             = useState(false);
  const [showDayPassModal, setShowDayPassModal]           = useState(false);
  const [showRenewPassesModal, setShowRenewPassesModal]   = useState(false);
  const [showPaymentModal, setShowPaymentModal]               = useState(false);
  const [showPaidUpNotice, setShowPaidUpNotice]               = useState(false);
  const [showNoteModal, setShowNoteModal]                     = useState(false);
  const [showMessageModal, setShowMessageModal]               = useState(false);

  // A coach trains members: money, membership changes, check-in and check-in
  // codes belong to the desk and management (the server refuses them too).
  const canManage = ['general_manager', 'manager', 'front_desk'].includes(getRole());
  // The front desk may send a member their check-in code but must never see it -
  // neither a front_desk account nor anyone viewing a profile inside the kiosk.
  const canViewCode = !fromFrontDesk && getRole() !== 'front_desk' && !isFitness(getRole());

  const handleAddPayment = () => {
    if ((member?.balance || 0) === 0) { setShowPaidUpNotice(true); }
    else { setShowPaymentModal(true); }
  };

  // Merge a member record the server returned after an action was applied directly.
  // A background refresh: if it fails, what is shown stays and the next one tries again
  const reloadMember = async () => { try { const r = await getMemberById(id); if (r?.data) setMember(prev => ({ ...prev, ...r.data })); } catch { return; } };
  // Merge the record the server returned at once (snappy), then re-fetch so the
  // profile always matches the server after an action like freeze/extend/renew.
  const applyMemberUpdate = (updated) => { if (updated) setMember(m => ({ ...m, ...updated })); reloadMember(); };

  const isMgmt = ['general_manager', 'manager'].includes(getRole());
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const myAccountId = getAuth()?.user?.id;
  const [withdrawingId, setWithdrawingId] = useState(null);
  const withdrawApproval = async (reqId) => {
    setWithdrawingId(reqId);
    try { await cancelRequest(reqId); setPendingApprovals(prev => prev.filter(r => r.id !== reqId)); }
    catch { loadApprovals(); }
    setWithdrawingId(null);
  };
  // Membership requests are the desk's and management's business, not a coach's
  const loadApprovals = () => {
    if (!id || !canManage) return;
    listApprovals(id, { status: 'pending' }).then(r => setPendingApprovals(r.data || [])).catch(() => {});
  };
  useEffect(() => { loadApprovals(); }, [id]);
  // Live: a payment, pass or check-in made on another screen shows here at once
  useLiveRefresh(() => { reloadMember(); loadApprovals(); getPackages().then(r => setPackagesList(r.data || [])).catch(() => {}); });
  // A refused approval stays in the list with the server's reason (F-120)
  const [approvalError, setApprovalError] = useState({});
  const resolveApproval = async (reqId, doApprove) => {
    setApprovalError(prev => ({ ...prev, [reqId]: '' }));
    try {
      const res = doApprove ? await approveRequest(reqId) : await rejectRequest(reqId);
      if (doApprove) applyMemberUpdate(res.data?.member);
      setPendingApprovals(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      setApprovalError(prev => ({ ...prev, [reqId]: err?.response?.data?.error || t('memberProfile.actionFailed') }));
    }
  };

  // When opened straight onto an action (front desk "Add payment"/"Renew" on the
  // quick drawer), pop that modal once the member is loaded.
  const didInitialAction = useRef(false);
  useEffect(() => {
    if (!member || !initialAction || didInitialAction.current) return;
    didInitialAction.current = true;
    if (initialAction === 'payment') handleAddPayment();
    else if (initialAction === 'renew') setShowRenewModal(true);
  }, [member, initialAction]);

  // Notes: localStorage keyed by member id (no DB model). Messages are every
  // email and text this member was really sent.
  const [memberNotes, setMemberNotes] = useState([]);
  const [notesError, setNotesError] = useState('');
  const [memberMessages, setMemberMessages] = useState([]);
  const [messagesFailed, setMessagesFailed] = useState(false);
  const loadMessages = () => {
    if (!id || isFitness(getRole())) return;
    getMemberMessages(id)
      .then(r => { setMemberMessages(r.data || []); setMessagesFailed(false); })
      .catch(() => setMessagesFailed(true));
  };
  useEffect(() => {
    if (!id) return;
    const stored = readStoredJson(`gem_member_notes_${id}`, []);
    setMemberNotes(Array.isArray(stored) ? stored : []);
    setNotesError('');
    loadMessages();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(loadMessages, ['communications']);
  const [showCode, setShowCode]                               = useState(false);
  const [viewPayment, setViewPayment]                             = useState(null);
  const [showConvertToVisitorModal, setShowConvertToVisitorModal] = useState(false);
  const [showCheckInCodeModal, setShowCheckInCodeModal]           = useState(false);
  const [checkedInFlash, setCheckedInFlash]                       = useState(false);
  const [checkInError, setCheckInError]                           = useState('');
  const [showSendCodeModal, setShowSendCodeModal]                 = useState(false);
  const [showRegFeeModal, setShowRegFeeModal]                     = useState(false);

  // ── Reg fee suspension logic ────────────────────────────────────────────────
  const [regFeePaid, setRegFeePaid] = useState(false);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    if (!member) return;
    setAttendance((member.attendances || []).map(a => ({
      id:         a.id,
      date:       fmtDate(a.checkIn),
      timeIn:     fmtTime(a.checkIn),
      recordedBy: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : '-',
      kind:       a.kind || null,
      notes:      a.note || '-',
    })));
    // Re-read whenever the server's list changes, so a check-in shows at once
  }, [member?.id, member?.attendances]);

  const TAB_LABEL_KEYS = {
    'Personal Details': 'tabPersonal',
    'Membership':       'tabMembership',
    'Payments':         'tabPayments',
    'Attendance':       'tabAttendance',
    'Progress':         'tabProgress',
    'Messages':         'tabMessages',
    'Notes':            'tabNotes',
  };
  const showsMoney = !isFitness(getRole());
  const TABS = TAB_KEYS
    .filter(k => showsMoney || k !== 'Payments')
    .map(k => ({ key: k, label: t(`memberProfile.${TAB_LABEL_KEYS[k]}`) }));

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
        <div style={{ fontSize: 14 }}>{t('memberProfile.loading')}</div>
      </div>
    );
  }

  if (!member) {
    if (loadFailed && !loadFailed.notFound) {
      return (
        <div style={{ padding: 32, maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <LoadFailed message={loadFailed.message || t('memberProfile.loadFailed')} onRetry={retryLoad} style={{ width: '100%' }} />
          {!hideBack && (
            <button style={secondaryBtn} onClick={() => onBack ? onBack() : navigate(fromFrontDesk ? '/front-desk' : '/members')}>
              <X size={14} /> {t('common.close')}
            </button>
          )}
        </div>
      );
    }
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
        <User size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
        <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{t('memberProfile.memberNotFound')}</p>
        {!hideBack && (
          <button style={{ ...secondaryBtn, margin: '16px auto' }} onClick={() => onBack ? onBack() : navigate(fromFrontDesk ? '/front-desk' : '/members')}>
            <X size={14} /> {t('common.close')}
          </button>
        )}
      </div>
    );
  }

  const getRegFeeStatus = () => {
    if (!gymData?.registrationFeeRequired) return 'not-required';
    if (gymData?.registrationFeeFrequency === 'one-time') return 'ok';
    if (!member?.regFeeDate) return 'ok';
    const paidOn  = new Date(String(member.regFeeDate).slice(0, 10) + 'T00:00:00');
    const dueDate = new Date(paidOn);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    const suspendDate = new Date(dueDate);
    suspendDate.setDate(suspendDate.getDate() + (gymData?.registrationGracePeriodDays || 0));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < dueDate) return 'ok';
    if (today < suspendDate) return 'grace';
    return 'overdue';
  };

  const regFeeStatusVal = regFeePaid ? 'ok' : getRegFeeStatus();
  const isSuspended = (member?.status === 'suspended' || regFeeStatusVal === 'overdue') && !regFeePaid;
  // Shared check-in rule (same as front desk + attendance page). A reason here
  // means the member can't be checked in right now - gate every check-in button.
  const checkInBlock = checkInBlockReason(member, t, fmtDate);
  const isVisitorMember = !!member?.isVisitor || member?.status === 'visitor';
  const checkInBlocked = !!checkInBlock || isSuspended;

  // ── Personal Details tab ────────────────────────────────────────────────────
  const PersonalDetailsTab = () => (
    <div style={{ ...cardStyle, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('memberProfile.personalInformation')}
        </span>
        {canManage && (
          <button style={secondaryBtn} onClick={() => setShowPersonalModal(true)}>
            <Edit2 size={13} /> {t('memberProfile.editPersonalDetails')}
          </button>
        )}
      </div>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <InfoRow label={t('memberProfile.firstName')} value={member.firstName} />
        <InfoRow label={t('memberProfile.lastName')} value={member.lastName} />
        <InfoRow label={t('memberProfile.gender')} value={member.gender} />
        <DobRow dob={member.dob} />
        <InfoRow label={t('memberProfile.phone')} value={member.phone} />
        <InfoRow label={t('memberProfile.email')} value={member.email} />
        {/* Paired on desktop: address with how they heard, the emergency contact with its number */}
        <InfoRow label={t('memberProfile.address')} value={formatAddress(member) || '-'} />
        <InfoRow label={t('memberProfile.howTheyHeard')} value={member.howHeard || '-'} />
        <InfoRow label={t('memberProfile.emergencyContact')} value={member.emergencyContact || '-'} />
        <InfoRow label={t('memberProfile.emergencyPhone')} value={member.emergencyPhone || '-'} />

        {/* Registration Fee. expiry only */}
        {gymData?.registrationFeeRequired && gymData?.registrationFeeFrequency === 'yearly' && member.regFeeDate && (() => {
          const paidOn = new Date(String(member.regFeeDate).slice(0, 10) + 'T00:00:00');
          const expiry = new Date(paidOn); expiry.setFullYear(expiry.getFullYear() + 1);
          const today2 = new Date(); today2.setHours(0,0,0,0);
          const daysLeft = Math.round((expiry - today2) / 86400000);
          const isExpired = daysLeft < 0;
          const isWarn = !isExpired && daysLeft <= 30;
          const expiryStr = dayStr(expiry);
          const badgeBg = isExpired ? 'rgba(239,68,68,0.12)' : isWarn ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)';
          const badgeColor = isExpired ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399';
          const badgeLabel = isExpired ? t('memberProfile.overdue') : isWarn ? t('memberProfile.daysLeftShort', { n: daysLeft }) : t('status.active');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.registrationExpiry')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
                  {formatDate(expiryStr)}
                </span>
                <span style={{
                  background: badgeBg, color: badgeColor,
                  borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 600,
                }}>
                  {badgeLabel}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Access Code row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.accessCode')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--accent-gold)',
              letterSpacing: showCode ? '0.25em' : '0.15em',
            }}>
              {showCode && canViewCode ? member.accessCode : '••••'}
            </span>
            {canViewCode && (
              <button
                onClick={() => setShowCode(v => !v)}
                title={showCode ? t('staff.hideCode') : t('memberProfile.showCode')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  borderRadius: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            {/* Send code to phone */}
            {canManage && <button
              onClick={() => setShowSendCodeModal(true)}
              title={t('members.sendSmsCode')}
              style={{
                background: 'none', border: '1px solid var(--border-subtle)',
                cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                alignItems: 'center', padding: 4, borderRadius: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-gold)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <MessageSquare size={13} />
            </button>}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Membership tab ──────────────────────────────────────────────────────────
  const MembershipTab = () => {
    const actionBtn = (label, icon, onClick, opts = {}) => {
      if (opts.primary) {
        return (
          <button
            key={label}
            onClick={onClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', fontSize: 12, borderRadius: 10,
              fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer',
              border: '1px solid transparent',
              background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
              color: '#0a0a0f', transition: 'all 0.15s',
              boxShadow: '0 1px 3px rgba(176,141,74,0.35)',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
          >
            {icon} {label}
          </button>
        );
      }
      const borderColor = opts.danger  ? 'rgba(239,68,68,0.3)'
                        : opts.active  ? 'rgba(99,179,237,0.4)'
                        : opts.success ? 'rgba(52,211,153,0.4)'
                        : 'var(--border-subtle)';
      const bgColor     = opts.danger  ? 'rgba(239,68,68,0.06)'
                        : opts.active  ? 'rgba(99,179,237,0.08)'
                        : opts.success ? 'rgba(52,211,153,0.08)'
                        : 'var(--bg-elevated)';
      const textColor   = opts.danger  ? 'var(--accent-red)'
                        : opts.active  ? '#63b3ed'
                        : opts.success ? '#34d399'
                        : 'var(--text-secondary)';
      return (
      <button
        key={label}
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 16px', fontSize: 12, borderRadius: 10,
          fontFamily: 'DM Sans', fontWeight: 500, cursor: 'pointer',
          border: `1px solid ${borderColor}`,
          background: bgColor,
          color: textColor,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = opts.danger  ? 'rgba(239,68,68,0.12)'
                                           : opts.active  ? 'rgba(99,179,237,0.14)'
                                           : opts.success ? 'rgba(52,211,153,0.14)'
                                           : 'var(--bg-card-hover)';
          e.currentTarget.style.color = textColor === 'var(--text-secondary)' ? 'var(--text-primary)' : textColor;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = bgColor;
          e.currentTarget.style.color = textColor;
        }}
      >
        {icon} {label}
      </button>
      );
    };

    // A visitor stays a visitor when their passes run out (status flips to
    // expired), so this reads the flag, not the status.
    const isVisitor    = !!member.isVisitor || member.status === 'visitor';
    const passesTotal  = passesOf(member);
    const passesUsed   = Math.max(0, passesTotal - passesLeft(member));
    // The end date is the last day the passes can be used, so it lapses the day after
    const bundleLapsed = !!member.endDate && dayStr(member.endDate) < todayStr();
    // Renewing passes opens up once a visitor has used at least half of them, or
    // once the bundle has run out or passed its end date.
    const canRenewPasses = isVisitor && (passesTotal === 0 || passesUsed * 2 >= passesTotal || bundleLapsed);

    const rowValue = (v, color) => (
      <span style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)', textAlign: 'right', overflowWrap: 'anywhere' }}>
        {v}
      </span>
    );
    const row = (key, label, body) => (
      <div key={key} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        minWidth: 0, minHeight: 48, padding: '10px 0', borderTop: '1px solid var(--border-subtle)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', flexShrink: 0 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          {body}
        </div>
      </div>
    );

    const isLapsed = member.status === 'cancelled' || member.status === 'deactivated';

    const primaryAction = isVisitor
      ? actionBtn(t('memberProfile.convertToMember'),  <Users size={13} />,     () => setShowRenewModal(true), { primary: true })
      : isLapsed
          ? actionBtn(t('memberProfile.reactivate'),     <RefreshCw size={13} />, () => setShowRenewModal(true), { primary: true })
          : actionBtn(t('memberProfile.renew'),          <RefreshCw size={13} />, () => setShowRenewModal(true), { primary: true });

    const secondaryActions = isVisitor ? (
      <>
        {canRenewPasses && actionBtn(t('memberProfile.renewPasses'), <Ticket size={13} />, () => setShowRenewPassesModal(true), { primary: true })}
        {actionBtn(t('memberProfile.buyDayPassBtn'), <Ticket size={13} />, () => setShowDayPassModal(true))}
        {actionBtn(t('memberProfile.convertToMember'), <Users size={13} />, () => setShowRenewModal(true))}
      </>
    ) : isLapsed ? (
      <>
        {primaryAction}
        {/* A cancelled/deactivated membership can still drop in on a day pass or move to a visitor plan. */}
        {actionBtn(t('memberProfile.dayPass'), <UserCheck size={13} />, () => setShowDayPassModal(true))}
        {actionBtn(t('memberProfile.convertToVisitor'), <UserMinus size={13} />, () => setShowConvertToVisitorModal(true))}
      </>
    ) : (
      <>
        {primaryAction}
        {actionBtn(t('memberProfile.extend'), <Plus size={13} />, () => setShowExtendModal(true))}
        {member.status === 'frozen'
          ? actionBtn(t('memberProfile.unfreeze'), <Snowflake size={13} />, () => setShowUnfreezeModal(true), { active: true })
          : actionBtn(t('memberProfile.freeze'),   <Snowflake size={13} />, () => setShowFreezeModal(true))}
        {/* A monthly member buys a day pass only when their membership
           isn't usable - frozen, suspended or expired. */}
        {['frozen', 'suspended', 'expired'].includes(member.status) && actionBtn(t('memberProfile.dayPass'), <UserCheck size={13} />, () => setShowDayPassModal(true))}
        {actionBtn(t('memberProfile.convertToVisitor'), <UserMinus size={13} />, () => setShowConvertToVisitorModal(true))}
        {actionBtn(t('memberProfile.cancelMembershipBtn'), <XCircle size={13} />, () => setShowCancelModal(true), { danger: true })}
      </>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...cardStyle, padding: 24 }}>
          <div style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            {t('memberProfile.membershipDetails')}
          </div>

          <div className="gem-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 40 }}>
            {row('package', t('memberProfile.package'), rowValue(member.package?.name ?? member.package ?? '-'))}
            {row('status', t('memberProfile.status'), <MemberStatusTags member={member} />)}
            {row('start', t('memberProfile.startDate'), rowValue(formatDate(member.startDate)))}
            {row('end', t('memberProfile.endDate'), rowValue(formatDate(member.endDate), isVisitor && bundleLapsed ? '#f87171' : undefined))}
            {showsMoney && row('balance', t('memberProfile.balance'),
              rowValue(fmtMoney(member.balance || 0), (member.balance || 0) === 0 ? '#34d399' : '#f87171'))}
            {!isVisitor && (member.dayPasses || 0) > 0 && row('dayPasses', t('memberProfile.dayPassesHeldRow'), rowValue(member.dayPasses, 'var(--accent-gold)'))}
            {!isVisitor && gymData?.registrationFeeRequired && gymData?.registrationFeeFrequency === 'yearly' && (() => {
              const regDate = member.regFeeDate
                ? member.regFeeDate.slice(0, 10)
                : member.createdAt
                  ? dayStr(member.createdAt)
                  : null;
              if (!regDate) return null;
              const expiry = new Date(regDate + 'T00:00:00'); expiry.setFullYear(expiry.getFullYear() + 1);
              const today3 = new Date(); today3.setHours(0, 0, 0, 0);
              const daysLeft = Math.round((expiry - today3) / 86400000);
              const isOverdue = daysLeft < 0;
              const isWarn = !isOverdue && daysLeft <= 30;
              const badgeColor = isOverdue ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399';
              const badgeBg    = isOverdue ? 'rgba(239,68,68,0.12)' : isWarn ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)';
              const badgeLabel = isOverdue ? t('memberProfile.overdue') : isWarn ? t('memberProfile.daysLeftShort', { n: daysLeft }) : t('status.active');
              return row('regRenewal', t('memberProfile.regRenewalDue'), <>
                {(isOverdue || isWarn) && (
                  <button onClick={() => setShowRegFeeModal(true)} style={{ background: 'none', border: `1px solid ${badgeColor}`, color: badgeColor, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    {t('memberProfile.renew')}
                  </button>
                )}
                <span style={{ background: badgeBg, color: badgeColor, borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 600 }}>
                  {badgeLabel}
                </span>
                {rowValue(fmtDate(expiry))}
              </>);
            })()}
            {isVisitor ? row('passes', t('memberProfile.passes'),
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Array.from({ length: passesOf(member) }).map((_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: i < passesLeft(member) ? 'var(--accent-gold)' : 'transparent',
                        border: `1.5px solid ${i < passesLeft(member) ? 'var(--accent-gold)' : 'var(--text-muted)'}`,
                        opacity: i < passesLeft(member) ? 1 : 0.55,
                        transition: 'all 0.15s',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {passesLeft(member)}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> / {passesOf(member)} {t('memberProfile.left')}</span>
                  </span>
                </div>
              ) : row('sessions', t('memberProfile.sessions'), rowValue(member.package?.sessions || t('memberProfile.unlimited')))}
          </div>

          {canManage && secondaryActions && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end',
              paddingTop: 18, borderTop: '1px solid var(--border-subtle)',
            }}>
              {secondaryActions}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Payments tab ────────────────────────────────────────────────────────────
  const methodOf = (m) => PAYMENT_METHODS.find(x => x.api === m || x.key === canonicalMethod(m));
  const payments = (member?.payments || []).map(p => ({
    id:          p.id,
    date:        fmtDate(p.createdAt),
    amount:      formatMoney(p.amount),
    // Stored as a code (mobile_money); shown by name, coloured by kind
    methodCode:  methodOf(p.method)?.api || 'cash',
    method:      methodOf(p.method) ? t(methodOf(p.method).labelKey) : (p.method || '-'),
    description: p.note || p.description || '-',
    reference:   p.reference   || '-',
    recordedBy:  p.staff ? `${p.staff.firstName} ${p.staff.lastName}` : (p.recordedBy || '-'),
    balanceAfter: p.balanceAfter != null ? formatMoney(p.balanceAfter) : '-',
  }));

  const PaymentsTab = () => (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.paymentHistory')}</span>
        {canManage && (
          <button style={primaryBtn} onClick={handleAddPayment}>
            <Plus size={13} /> {t('memberProfile.addPayment')}
          </button>
        )}
      </div>
      <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.amountCol'), t('memberProfile.methodCol'), t('memberProfile.descriptionCol'), t('memberProfile.referenceCol'), t('memberProfile.recordedByCol'), t('memberProfile.balanceAfterCol'), ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 0 }}><EmptyState icon={CreditCard} title={t('memberProfile.noPaymentsTitle')} hint={t('memberProfile.noPaymentsHint')} /></td></tr>
            ) : payments.map((p, i) => (
              <tr key={p.id || i} style={{ transition: 'background 0.1s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setViewPayment(p)}
              >
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{p.date}</td>
                <td style={{ ...tdStyle, color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.amount}</td>
                <td style={tdStyle}>
                  <span style={{
                    background: { card: 'var(--accent-blue-dim)', mobile_money: 'var(--accent-gold-dim)', bank_transfer: 'var(--accent-purple-dim)' }[p.methodCode] || 'var(--accent-green-dim)',
                    color: { card: 'var(--accent-blue)', mobile_money: 'var(--accent-gold)', bank_transfer: 'var(--accent-purple)' }[p.methodCode] || 'var(--accent-green)',
                    borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'
                  }}>{p.method}</span>
                </td>
                <td style={tdStyle}>{p.description}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.reference}</td>
                <td style={tdStyle}>{p.recordedBy}</td>
                <td style={tdStyle}>{p.balanceAfter}</td>
                <td style={{ ...tdStyle, width: 44 }} onClick={e => e.stopPropagation()}>
                  <RowMenu title={t('common.actions')} items={[
                    { label: t('common.viewDetails'), icon: <FileText size={15} />, onClick: () => setViewPayment(p) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Attendance tab ──────────────────────────────────────────────────────────

  const handleCheckIn = async () => {
    // Same gate as everywhere else: a frozen/lapsed member with no pass can't be
    // checked in. Surface the reason instead of firing a request that 403s.
    const block = checkInBlockReason(member, t, fmtDate);
    if (block) { setCheckInError(block); return block; }
    setCheckInError('');
    let checkInRes = null;
    try {
      checkInRes = await checkInApi({ memberId: member.id });
    } catch (err) {
      // A second check-in within 30 minutes is the same visit: the server
      // refuses it and records nothing, and the profile says so (it used to
      // flash "Check-in confirmed", which read as a second check-in).
      const reason = checkInErrorText(err, t, t('attendance.checkInFailed'));
      setCheckInError(reason);
      return reason;
    }
    const now = new Date();
    const authUser = getAuth()?.user;
    const staffName = checkInRes?.data?.staff
      ? `${checkInRes.data.staff.firstName} ${checkInRes.data.staff.lastName}`
      : (authUser ? `${authUser.firstName} ${authUser.lastName}` : '-');
    const serverMember = checkInRes?.data?.member;
    if (serverMember) {
      setMember(prev => ({
        ...prev,
        ...(serverMember.passesRemaining !== undefined ? { passesRemaining: serverMember.passesRemaining } : {}),
        ...(serverMember.dayPasses !== undefined ? { dayPasses: serverMember.dayPasses } : {}),
        ...(serverMember.status ? { status: serverMember.status } : {}),
      }));
    }
    setAttendance(prev => [{
      id:         checkInRes?.data?.id || `local-${Date.now()}`,
      date:       fmtDate(now),
      timeIn:     fmtTime(now),
      recordedBy: staffName,
      kind:       checkInRes?.data?.kind || null,
      notes:      '',
    }, ...prev]);
    setMember(prev => ({ ...prev, lastVisit: now.toISOString() }));
    setCheckedInFlash(true);
    setTimeout(() => setCheckedInFlash(false), 2500);
    return null;
  };

  const AttendanceTab = () => (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.attendanceHistory')}</span>
          {isVisitorMember && (
            <span style={{ fontSize: 12, color: passesLeft(member) > 0 ? 'var(--accent-gold)' : '#ef4444' }}>
              {passesLeft(member)} {t('memberProfile.passesRemainingLabel')}
            </span>
          )}
        </div>
        {!canManage ? null : !checkInBlocked ? (
          <button style={primaryBtn} onClick={() => member.photo ? handleCheckIn() : setShowCheckInCodeModal(true)}>
            <LogIn size={13} /> {t('memberProfile.checkIn')}
          </button>
        ) : (
          <button style={primaryBtn} onClick={() => setShowDayPassModal(true)}>
            <Ticket size={13} /> {t('memberProfile.buyDayPassBtn')}
          </button>
        )}
      </div>
      {checkInBlock && (
        <div style={{ margin: '0 20px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontFamily: 'DM Sans' }}>
          {checkInBlock}
        </div>
      )}
      <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.timeInCol'), t('memberProfile.recordedByCol'), t('memberProfile.typeCol')].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 0 }}><EmptyState icon={LogIn} title={t('memberProfile.noAttendanceTitle')} hint={t('memberProfile.noAttendanceHint')} /></td></tr>
            ) : attendance.map((a, i) => (
              <tr key={a.id || i}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={tdStyle}>{a.date}</td>
                <td style={{ ...tdStyle, color: 'var(--accent-green)', fontWeight: 500 }}>{a.timeIn}</td>
                <td style={tdStyle}>{a.recordedBy}</td>
                <td style={tdStyle}>
                  <VisitKindBadge kind={a.kind} isVisitor={isVisitorMember} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Messages tab ────────────────────────────────────────────────────────────

  const MessagesTab = () => (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.messagesHeader')}</span>
        {!isFitness(getRole()) && <button style={primaryBtn} onClick={() => setShowMessageModal(true)}>
          <MessageSquare size={13} /> {t('memberProfile.sendNewMessage')}
        </button>}
      </div>
      <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.subjectCol'), t('memberProfile.typeCol'), t('memberProfile.sentByCol'), t('memberProfile.statusCol')].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberMessages.length === 0 && messagesFailed ? (
              <tr><td colSpan={5} style={{ padding: 16 }}><LoadFailed message={t('memberProfile.messagesLoadFailed')} onRetry={loadMessages} /></td></tr>
            ) : memberMessages.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><EmptyState icon={MessageSquare} title={t('memberProfile.noMessagesTitle')} hint={t('memberProfile.noMessagesHint')} /></td></tr>
            ) : memberMessages.map(m => {
              const c = m.communication || {};
              const tone = m.status === 'sent' ? ['var(--accent-green)', 'var(--accent-green-dim)'] : m.status === 'failed' ? ['var(--accent-red)', 'var(--accent-red-dim)'] : ['var(--text-muted)', 'rgba(140,140,150,0.14)'];
              return (
                <tr key={m.id} data-member-message={m.status}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(c.sentAt || m.createdAt)}</td>
                  <td style={{ ...tdStyle, maxWidth: 320 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.channel === 'sms' ? (c.body || '') : (c.subject || c.body || '')}</div>
                    {m.channel !== 'sms' && c.body && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{c.body}</div>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: m.channel === 'sms' ? 'var(--accent-gold-dim)' : 'var(--accent-blue-dim)', color: m.channel === 'sms' ? 'var(--accent-gold)' : 'var(--accent-blue)', borderRadius: 20, padding: '2px 9px', fontSize: 11 }}>
                      {m.channel === 'sms' ? <MessageSquare size={11} /> : <Mail size={11} />}{t(`communication.ch_${m.channel}`)}
                    </span>
                  </td>
                  <td style={tdStyle}>{c.sentBy ? `${c.sentBy.firstName} ${c.sentBy.lastName}` : ''}</td>
                  <td style={tdStyle} title={m.error || undefined}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, color: tone[0], background: tone[1] }}>{t(`communication.d_${m.status}`)}</span>
                    {m.error && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{m.error}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Notes tab ───────────────────────────────────────────────────────────────
  const categoryColors = {
    General: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
    Health: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
    Financial: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
    Other: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  };

  const NotesTab = () => (
    <div>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button style={primaryBtn} onClick={() => setShowNoteModal(true)}>
            <Plus size={13} /> {t('memberProfile.addNote')}
          </button>
        </div>
      )}
      {notesError && <div role="alert" style={{ marginBottom: 12, fontSize: 12.5, lineHeight: 1.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 12px' }}>{notesError}</div>}
      {memberNotes.length === 0 ? (
        <div style={cardStyle}>
          <EmptyState icon={StickyNote} title={t('memberProfile.noNotesTitle')} hint={t('memberProfile.noNotesHint')} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberNotes.map((n, i) => {
            const cc = categoryColors[n.category] || categoryColors.Other;
            return (
              <div key={i} style={cardStyle}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{n.date}</span>
                    <span style={{ background: cc.bg, color: cc.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 500 }}>{({ General: t('memberProfile.categoryGeneral'), Health: t('memberProfile.categoryHealth'), Financial: t('memberProfile.categoryFinancial'), Other: t('memberProfile.categoryOther') })[n.category] || n.category}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.by')} {n.author}</span>
                </div>
                <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.6 }}>{n.content}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const tabContent = {
    'Personal Details': <PersonalDetailsTab />,
    'Membership':       <MembershipTab />,
    'Payments':         showsMoney ? <PaymentsTab /> : null,
    'Attendance':       <AttendanceTab />,
    'Progress':         <MemberProgressTab member={member} visits={(member.attendances || []).map(a => a.checkIn)} onGoalsChanged={(g) => g && setMember(m => ({ ...m, ...g }))} />,
    'Messages':         <MessagesTab />,
    'Notes':            <NotesTab />,
  };

  return (
    <div className={onBack ? undefined : 'page-fade'} style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>

      {(partsFailed || (loadFailed && !loadFailed.notFound)) && (
        <LoadFailed message={t('memberProfile.partLoadFailed')} onRetry={retryLoad} style={{ marginBottom: 20 }} />
      )}

      {/* ── Suspension / reg fee overdue banner ── */}
      {(isSuspended || regFeeStatusVal === 'overdue' || regFeeStatusVal === 'grace') && (
        <div style={{
          marginBottom: 20,
          background: isSuspended || regFeeStatusVal === 'overdue'
            ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
          border: `1px solid ${isSuspended || regFeeStatusVal === 'overdue'
            ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}`,
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{
              color: isSuspended || regFeeStatusVal === 'overdue' ? 'var(--accent-red)' : '#f59e0b',
              flexShrink: 0, marginTop: 1,
            }} />
            <div>
              <div style={{
                fontSize: 13, fontWeight: 700, marginBottom: 4,
                color: isSuspended || regFeeStatusVal === 'overdue' ? 'var(--accent-red)' : '#f59e0b',
              }}>
                {isSuspended || regFeeStatusVal === 'overdue'
                  ? t('memberProfile.accountSuspended')
                  : t('memberProfile.regFeeDueSoon')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {isSuspended || regFeeStatusVal === 'overdue'
                  ? t('memberProfile.suspendedMsg')
                  : t('memberProfile.graceMsg')}
              </div>
              {member.regFeeDate && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {t('memberProfile.lastPaid')} {formatDate(member.regFeeDate)}
                  &ensp;·&ensp; {t('memberProfile.feeLabel')} {formatMoney(gymData?.registrationFee || 0)}
                  {(gymData?.registrationGracePeriodDays || 0) > 0 && regFeeStatusVal === 'grace' &&
                    ` · ${t('memberProfile.gracePeriodActive', { n: gymData.registrationGracePeriodDays })}`}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowRegFeeModal(true)}
            style={{
              ...primaryBtn,
              background: isSuspended || regFeeStatusVal === 'overdue' ? 'var(--accent-red)' : 'linear-gradient(135deg,#c9a96e,#b08d4a)',
              border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <CreditCard size={13} /> {t('memberProfile.renewRegistrationBtn')}
          </button>
        </div>
      )}

      {/* Profile hero: identity + key stats + actions, in one card */}
      <div style={{ ...cardStyle, padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        {/* Identity band */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '22px 24px' }}>
          <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMemberPhotoUpload} />
          {member.photo ? (
            <img src={member.photo} onClick={() => setShowPhotoModal(true)} alt={member.firstName} title={t('members.changePhoto')}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--accent-gold)', opacity: photoUploading ? 0.5 : 1 }} />
          ) : (
            <button type="button" onClick={() => memberPhotoRef.current?.click()} title={t('members.uploadProfilePhoto')} disabled={photoUploading}
              style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, border: '2px dashed var(--border)', background: 'var(--bg-elevated)', cursor: photoUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <Camera size={18} color="var(--text-muted)" />
              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1 }}>{photoUploading ? '...' : t('members.photo')}</span>
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{member.firstName} {member.lastName}</h1>
              <MemberStatusTags member={member} />
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{member.memberCode || member.id}</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
              {member.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}><Phone size={13} color="var(--text-muted)" />{member.phone}</span>}
              {member.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}><Mail size={13} color="var(--text-muted)" />{member.email}</span>}
            </div>
          </div>
          {!hideBack && (
            <button style={{ ...secondaryBtn, flexShrink: 0 }} onClick={() => onBack ? onBack() : navigate(fromFrontDesk ? '/front-desk' : '/members')}>
              <X size={14} /> {t('common.close')}
            </button>
          )}
        </div>

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1, background: 'var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: t('memberProfile.package'), value: member.package?.name ?? member.package ?? '-' },
            { label: t('memberProfile.startDate'), value: formatDate(member.startDate) },
            { label: t('memberProfile.endDate'), value: formatDate(member.endDate) },
            ...(showsMoney ? [{ label: t('memberProfile.balance'), value: formatMoney(member.balance), color: (member.balance || 0) > 0 ? '#f87171' : '#34d399' }] : []),
            { label: t('memberProfile.lastCheckIn'), value: formatDate(member.lastVisit) },
          ].map((s, i) => (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.color || 'var(--text-primary)', fontFamily: 'DM Sans' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <MemberCoachRow member={member} onChanged={(patch) => setMember(m => ({ ...m, ...patch }))} />

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
          {canManage && <button style={primaryBtn} onClick={handleAddPayment}><CreditCard size={13} /> {t('memberProfile.addPayment')}</button>}
          {canManage && <button
            style={checkedInFlash
              ? { ...secondaryBtn, background: 'rgba(52,211,153,0.12)', color: '#34d399', borderColor: 'rgba(52,211,153,0.4)' }
              : { ...secondaryBtn, opacity: checkInBlocked ? 0.4 : 1, cursor: checkInBlocked ? 'not-allowed' : 'pointer' }}
            disabled={checkInBlocked || checkedInFlash}
            title={checkInBlock || (isSuspended ? t('checkin.suspended') : undefined)}
            onClick={() => { if (checkInBlocked) { setCheckInError(checkInBlock || t('checkin.suspended')); return; } member.photo ? handleCheckIn() : setShowCheckInCodeModal(true); }}
          >
            {checkedInFlash ? t('memberProfile.checkInConfirmed') : <><LogIn size={13} /> {t('memberProfile.checkIn')}</>}
          </button>}
          {canManage && <button style={secondaryBtn} onClick={() => setShowSendCodeModal(true)}><Mail size={13} /> {t('memberProfile.sendCheckInCode')}</button>}
          {!isFitness(getRole()) && <button style={secondaryBtn} data-hero-message onClick={() => setShowMessageModal(true)}><MessageSquare size={13} /> {t('memberProfile.sendMessage')}</button>}
          <button style={secondaryBtn} onClick={() => setShowNoteModal(true)}><StickyNote size={13} /> {t('memberProfile.addNote')}</button>
        </div>
        {checkInError && (
          <div style={{ padding: '0 24px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--accent-red)', fontWeight: 600 }}>⚠ {checkInError}</div>
          </div>
        )}
      </div>

      {/* Pending approval requests */}
      {canManage && pendingApprovals.length > 0 && (
        <div style={{ ...cardStyle, padding: 0, marginBottom: 24, border: '1px solid var(--accent-gold-dim)' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={13} /> {t('memberProfile.pendingApprovalsTitle')} ({pendingApprovals.length})
          </div>
          {pendingApprovals.map(r => (
            <div key={r.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{r.summary}</div>
              {r.note && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>“{r.note}”</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('memberProfile.requestedBy')} {r.requestedByName || '-'}</div>
              {isMgmt ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button style={{ ...primaryBtn, padding: '6px 16px', fontSize: 12 }} onClick={() => resolveApproval(r.id, true)}><UserCheck size={13} /> {t('memberProfile.approve')}</button>
                  <button style={{ ...secondaryBtn, padding: '6px 16px', fontSize: 12 }} onClick={() => resolveApproval(r.id, false)}><XCircle size={13} /> {t('memberProfile.decline')}</button>
                </div>
              ) : null}
              {approvalError[r.id] ? (
                <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{approvalError[r.id]}</div>
              ) : null}
              {isMgmt ? null : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--accent-yellow)', fontWeight: 600 }}>{t('memberProfile.awaitingApproval')}</span>
                  {r.requestedById === myAccountId && (
                    <button onClick={() => withdrawApproval(r.id)} disabled={withdrawingId === r.id} style={{ ...secondaryBtn, padding: '5px 12px', fontSize: 12, color: 'var(--accent-red)', borderColor: 'rgba(248,113,113,0.4)' }}>
                      <XCircle size={13} /> {withdrawingId === r.id ? t('memberProfile.processing') : t('memberProfile.cancelRequest')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs. The row scrolls on its own: wider than a phone, it used to push
          the whole page sideways when a tab near the edge was tapped. */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, boxShadow: 'inset 0 -1px 0 var(--border-subtle)', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--accent-gold)' : '2px solid transparent',
              color: activeTab === key ? 'var(--accent-gold)' : 'var(--text-muted)',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'DM Sans',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabContent[activeTab]}

      {/* Modals */}
      <EditPersonalModal    open={showPersonalModal}    onClose={() => setShowPersonalModal(false)}    member={member}
        onSave={async (form) => { await updateMember(member.id, form); setMember(m => ({ ...m, ...form })); }} />
      <ChangePackageModal   open={showChangePackageModal} onClose={() => setShowChangePackageModal(false)} member={member} packagesList={packagesList}
        onSave={(updates) => setMember(m => ({ ...m, ...updates }))} />
      <RenewMembershipModal open={showRenewModal}       onClose={() => setShowRenewModal(false)}       member={member} packagesList={packagesList}
        onSave={(updates) => setMember(m => ({ ...m, ...updates }))}
        onSettleBalance={() => { setShowRenewModal(false); setShowPaymentModal(true); }} />
      <ExtendModal          open={showExtendModal}      onClose={() => setShowExtendModal(false)}      member={member} onApplied={applyMemberUpdate} />
      <FreezeModal          open={showFreezeModal}      onClose={() => setShowFreezeModal(false)}      member={member} onApplied={applyMemberUpdate} />
      <UnfreezeModal        open={showUnfreezeModal}    onClose={() => setShowUnfreezeModal(false)}    member={member} onApplied={applyMemberUpdate} />
      <CancelMembershipModal open={showCancelModal} onClose={() => setShowCancelModal(false)} member={member} onApplied={applyMemberUpdate} />
      <DayPassModal          open={showDayPassModal}    onClose={() => setShowDayPassModal(false)}     member={member} packagesList={packagesList} onApplied={applyMemberUpdate} onSettleBalance={() => { setShowDayPassModal(false); handleAddPayment(); }} />
      <RenewPassesModal      open={showRenewPassesModal} onClose={() => setShowRenewPassesModal(false)} member={member} gymData={gymData} packagesList={packagesList} onApplied={applyMemberUpdate} onSettleBalance={() => { setShowRenewPassesModal(false); handleAddPayment(); }} />
      <Modal open={showPaidUpNotice} onClose={() => setShowPaidUpNotice(false)} title={t('memberProfile.accountPaidUpTitle')} maxWidth={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '14px 16px' }}>
            <span style={{ fontSize: 28 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, color: '#34d399', fontFamily: 'Manrope', fontSize: 14, marginBottom: 3 }}>{t('memberProfile.noOutstandingBalance')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
                {t('memberProfile.accountPaidUpDesc')}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.6 }}>
            {isVisitorMember ? t('memberProfile.createBalanceDescVisitor') : t('memberProfile.createBalanceDesc')}
          </div>
          {/* A visitor pays for passes, never a membership or a package change */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isVisitorMember ? (
              <>
                <button type="button" style={{ ...primaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowDayPassModal(true); }}>
                  <Ticket size={13} /> {t('memberProfile.buyDayPassBtn')}
                </button>
                <button type="button" style={{ ...secondaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowRenewPassesModal(true); }}>
                  <Ticket size={13} /> {t('memberProfile.renewPasses')}
                </button>
              </>
            ) : (
              <>
                <button type="button" style={{ ...primaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowRenewModal(true); }}>
                  <RefreshCw size={13} /> {t('memberProfile.renewMembershipBtn')}
                </button>
                <button type="button" style={{ ...secondaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowChangePackageModal(true); }}>
                  <Package size={13} /> {t('memberProfile.changePackageBtn')}
                </button>
              </>
            )}
          </div>
          <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={secondaryBtn} onClick={() => setShowPaidUpNotice(false)}>{t('common.close')}</button>
          </div>
        </div>
      </Modal>
      <RenewRegFeeModal open={showRegFeeModal} onClose={() => setShowRegFeeModal(false)} member={member} gymData={gymData}
        onSave={(updates) => {
          setMember(m => ({ ...m, ...updates }));
          setRegFeePaid(true);
        }} />
      <AddPaymentModal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} member={member}
        onSave={async (paymentData) => {
          const res = await createPayment({ ...paymentData, memberId: member.id });
          const newBalance = res.data?.balanceAfter ?? Math.max(0, (member.balance || 0) - paymentData.amount);
          // Re-fetch member so payments list has full staff info
          try {
            const fresh = await getMemberById(member.id);
            setMember({ ...fresh.data, balance: newBalance });
          } catch {
            setMember(m => ({ ...m, balance: newBalance, payments: [res.data, ...(m.payments || [])] }));
          }
        }} />
      <PaymentDetailModal open={!!viewPayment} onClose={() => setViewPayment(null)} payment={viewPayment} member={member} />
      <ConvertToVisitorModal open={showConvertToVisitorModal} onClose={() => setShowConvertToVisitorModal(false)} member={member} gymData={gymData} packagesList={packagesList} onApplied={applyMemberUpdate} onSettleBalance={() => { setShowConvertToVisitorModal(false); handleAddPayment(); }} />
      <AddNoteModal open={showNoteModal} onClose={() => setShowNoteModal(false)}
        onSave={(form) => {
          const note = { date: fmtDate(new Date()), content: form.note, category: form.category, author: [getAuth()?.user?.firstName, getAuth()?.user?.lastName].filter(Boolean).join(' ') || roleName(getRole(), t) };
          const updated = [note, ...memberNotes];
          setNotesError('');
          if (storeJson(`gem_member_notes_${id}`, updated)) setMemberNotes(updated);
          else setNotesError(t('memberProfile.noteNotKept'));
        }} />
      <SendMessageModal open={showMessageModal} onClose={() => setShowMessageModal(false)} members={member ? [member] : []}
        onSent={() => setTimeout(loadMessages, 800)} />
      <CheckInCodeModal open={showCheckInCodeModal} onClose={() => setShowCheckInCodeModal(false)} member={member} onSuccess={handleCheckIn} />
      <SendCodeModal    open={showSendCodeModal}    onClose={() => setShowSendCodeModal(false)}    member={member} gymName={gymData?.name} />

      {/* Profile Photo Modal */}
      {showPhotoModal && (
        <div
          onClick={() => setShowPhotoModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 2000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <img
            src={member.photo}
            alt={member.firstName}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '80vw', maxHeight: '72vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 32px 96px rgba(0,0,0,0.7)', marginBottom: 24 }}
          />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => memberPhotoRef.current?.click()}
              disabled={photoUploading}
              style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, padding: '10px 24px', cursor: photoUploading ? 'not-allowed' : 'pointer', opacity: photoUploading ? 0.6 : 1, fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Camera size={14} />
              {t('memberProfile.uploadNewPhoto')}
            </button>
            <button
              onClick={handleRemoveMemberPhoto}
              disabled={photoUploading}
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6, fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: photoUploading ? 'not-allowed' : 'pointer', opacity: photoUploading ? 0.6 : 1, fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Trash2 size={14} />
              {t('memberProfile.removePhoto')}
            </button>
          </div>
          <button
            onClick={() => setShowPhotoModal(false)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >×</button>
        </div>
      )}
    </div>
  );
}
