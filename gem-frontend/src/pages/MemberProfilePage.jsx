import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ArrowLeft, Edit2, CreditCard, LogIn, Snowflake, XCircle, BookOpen,
  Package, RefreshCw, MessageSquare, StickyNote, Plus, User,
  Eye, EyeOff, Save, Lock, Unlock, UserCheck, AlertTriangle,
  Download, FileText, Users, UserMinus, Ticket, Camera
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getAuth } from '../utils/auth';
import { getOne as getMemberById, update as updateMember } from '../services/members.service';
import { getAll as getPackages } from '../services/packages.service';
import { create as createPayment } from '../services/payments.service';
import { checkIn as checkInApi } from '../services/attendance.service';
import { getMyGym } from '../services/gym.service';
import { verifyManager } from '../services/auth.service';
import { uploadPhoto } from '../services/upload.service';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatMoney = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;

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
        {value || '—'}
      </span>
    </div>
  );
}

function DobRow({ dob }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const formatted = dob ? new Date(dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.dateOfBirth')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
          {visible ? formatted : (dob ? '••••••••••' : '—')}
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

  useState(() => {
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
      postalCode:       member.postalCode       || '',
      emergencyContact: member.emergencyContact || '',
      emergencyPhone:   member.emergencyPhone   || '',
      howHeard:         member.howHeard         || '',
      notes:            member.notes            || '',
    });
  }, [member, open]);

  if (!member) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave?.(form); onClose(); } catch {} finally { setSaving(false); }
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={`${t('memberProfile.firstName')} *`} value={form.firstName} onChange={set('firstName')} placeholder={t('memberProfile.firstName')} />
          <GemInput label={`${t('memberProfile.lastName')} *`}  value={form.lastName}  onChange={set('lastName')}  placeholder={t('memberProfile.lastName')} />
          <GemSelect label={`${t('memberProfile.gender')} *`} value={form.gender} onChange={set('gender')} options={[
            { value: '', label: t('memberProfile.selectOption') },
            { value: 'Male', label: t('common.male') },
            { value: 'Female', label: t('common.female') },
            { value: 'Other', label: t('memberProfile.other') },
          ]} />
          <GemInput label={t('memberProfile.dateOfBirth')} type="date" value={form.dob} onChange={set('dob')} />
          <GemInput label={`${t('memberProfile.phone')} *`} value={form.phone} onChange={set('phone')} placeholder="+237 6XX XXX XXX" />
          <GemInput label={`${t('memberProfile.email')} *`} value={form.email} onChange={set('email')} placeholder="email@example.com" />
        </div>

        <SectionLabel title={t('memberProfile.addressSection')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('memberProfile.houseNumber')} value={form.houseNumber} onChange={set('houseNumber')} placeholder="e.g. 12B" />
          <GemInput label={t('memberProfile.street')}      value={form.street}      onChange={set('street')}      placeholder="e.g. Rue de la Paix" />
          <GemInput label={t('common.city')}               value={form.city}        onChange={set('city')}        placeholder="e.g. Douala" />
          <GemInput label={t('common.postalCode')}         value={form.postalCode}  onChange={set('postalCode')}  placeholder="0000" />
        </div>

        <SectionLabel title={t('memberProfile.emergencySection')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('memberProfile.contactName')}  value={form.emergencyContact} onChange={set('emergencyContact')} placeholder={t('common.fullName')} />
          <GemInput label={t('memberProfile.contactPhone')} value={form.emergencyPhone}   onChange={set('emergencyPhone')}   placeholder="+237 6XX XXX XXX" />
        </div>

        <SectionLabel title={t('memberProfile.marketingSection')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' }}>{t('memberProfile.howHeardQuestion')}</label>
            <select
              value={form.howHeard}
              onChange={set('howHeard')}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            >
              <option value="">{t('memberProfile.selectOption')}</option>
              <option value="Social Media">{t('memberProfile.socialMedia')}</option>
              <option value="Friend">{t('memberProfile.friend')}</option>
              <option value="Google">{t('memberProfile.google')}</option>
              <option value="Flyer">{t('memberProfile.flyer')}</option>
              <option value="Walk-in">{t('memberProfile.walkIn')}</option>
              <option value="Other">{t('memberProfile.other')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' }}>{t('memberProfile.additionalNotesLabel')}</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder={t('memberProfile.additionalNotesPH')}
              rows={3}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none', resize: 'vertical', minHeight: 72, lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button style={primaryBtn} onClick={handleSave} disabled={saving}><Save size={13} /> {saving ? t('memberProfile.saving') : t('memberProfile.saveChanges')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Membership Modal ────────────────────────────────────────────────────
function EditMembershipModal({ open, onClose, member, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({});
  const [endDateUnlocked, setEndDateUnlocked] = useState(false);
  const [pin, setPin]         = useState('');
  const [pinError, setPinError]   = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  useState(() => {
    if (member) setForm({
      startDate: member.startDate || '',
      endDate:   member.endDate   || '',
      autoRenew: 'Yes',
    });
  }, [member, open]);

  useEffect(() => {
    if (!open) { setEndDateUnlocked(false); setPin(''); setPinError(''); setShowPinEntry(false); }
  }, [open]);

  if (!member) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleUnlock = async () => {
    if (!pin) return;
    setPinLoading(true); setPinError('');
    try {
      const res = await verifyManager(pin);
      if (res.data?.authorized) {
        setEndDateUnlocked(true);
        setShowPinEntry(false);
      } else {
        setPinError('Incorrect password — try again.');
        setPin('');
      }
    } catch (err) {
      setPinError(err?.response?.data?.error || t('memberProfile.verificationFailed'));
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.editMembershipTitle')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GemInput label={t('memberProfile.startDate')} type="date" value={form.startDate} onChange={set('startDate')} />

        {/* End date — locked unless manager unlocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
              {t('memberProfile.endDateLabel')}
            </label>
            {!endDateUnlocked && (
              <button
                onClick={() => setShowPinEntry(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Lock size={11} /> {t('memberProfile.managerOverride')}
              </button>
            )}
            {endDateUnlocked && (
              <span style={{ fontSize: 11, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Unlock size={11} /> {t('memberProfile.unlocked')}
              </span>
            )}
          </div>
          <input
            type="date"
            value={form.endDate}
            onChange={set('endDate')}
            readOnly={!endDateUnlocked}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '9px 14px', fontSize: 13,
              color: endDateUnlocked ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'DM Sans', outline: 'none', width: '100%', boxSizing: 'border-box',
              cursor: endDateUnlocked ? 'text' : 'not-allowed',
              opacity: endDateUnlocked ? 1 : 0.6,
            }}
          />
          {showPinEntry && !endDateUnlocked && (
            <div style={{
              background: 'var(--bg-elevated)', border: `1px solid ${pinError ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('memberProfile.enterManagerPassword')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password" value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  placeholder={t('memberProfile.loginPasswordPH')}
                  autoFocus
                  style={{
                    flex: 1, background: 'var(--bg-surface)', border: `1px solid ${pinError ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                    borderRadius: 8, padding: '8px 12px', fontSize: 14,
                    color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none',
                  }}
                />
                <button style={{ ...primaryBtn, opacity: (pin && !pinLoading) ? 1 : 0.5 }}
                  disabled={!pin || pinLoading} onClick={handleUnlock}>
                  {pinLoading ? '…' : t('memberProfile.unlock')}
                </button>
              </div>
              {pinError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{pinError}</div>}
            </div>
          )}
        </div>

        <GemSelect label={t('memberProfile.autoRenewLabel')} value={form.autoRenew} onChange={set('autoRenew')} options={[
          { value: 'Yes', label: t('memberProfile.yes') },
          { value: 'No',  label: t('memberProfile.no') },
        ]} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button style={primaryBtn} disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onSave?.({ startDate: form.startDate, endDate: form.endDate }); onClose(); } catch {} finally { setSaving(false); }
          }}><Save size={13} /> {saving ? t('memberProfile.saving') : t('memberProfile.saveChanges')}</button>
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

const PAYMENT_METHOD_MAP = { Card: 'card', Cash: 'cash', 'Bank Transfer': 'bank_transfer', 'Mobile Pay': 'mobile_money' };

function AddPaymentModal({ open, onClose, onSave, member }) {
  const { t } = useLanguage();
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const freshForm = () => ({ amount: '', method: 'Cash', type: 'membership', description: '', reference: generateRef() });
  const [form, setForm] = useState(freshForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(freshForm()); setError(''); } }, [open]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const owedBalance  = member?.balance || 0;
  const payAmt       = parseFloat(form.amount) || 0;
  const remaining    = Math.max(0, owedBalance - payAmt);
  const overpay      = payAmt > owedBalance && owedBalance > 0;

  const handleSave = async () => {
    if (!form.amount || payAmt <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true); setError('');
    try {
      await onSave?.({
        amount:      payAmt,
        method:      form.method,
        type:        form.type,
        description: form.description || undefined,
        reference:   form.reference,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save payment.');
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal open={open} onClose={onClose} title={`${t('memberProfile.addPaymentTitle')}${member ? ` — ${member.firstName} ${member.lastName}` : ''}`} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Balance owed banner */}
        {owedBalance > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>{t('memberProfile.outstandingBalance')}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', fontFamily: 'Manrope' }}>{fmtCFA(owedBalance)}</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>{t('memberProfile.amountFcfa')}</label>
            <input type="number" min="0" style={inp} value={form.amount} onChange={set('amount')} placeholder="0" autoFocus />
          </div>
          <div>
            <label style={lbl}>{t('memberProfile.methodLabel')}</label>
            <select style={inp} value={form.method} onChange={set('method')}>
              <option value="Cash">{t('memberProfile.cash')}</option>
              <option value="Card">{t('memberProfile.card')}</option>
              <option value="Bank Transfer">{t('memberProfile.bankTransfer')}</option>
              <option value="Mobile Pay">{t('memberProfile.mobilePay')}</option>
            </select>
          </div>
        </div>

        {/* Type */}
        <div>
          <label style={lbl}>{t('memberProfile.paymentType')}</label>
          <select style={inp} value={form.type} onChange={set('type')}>
            <option value="membership">{t('memberProfile.paymentTypeMembership')}</option>
            <option value="registration">{t('memberProfile.paymentTypeRegistration')}</option>
            <option value="product">{t('memberProfile.paymentTypeProduct')}</option>
            <option value="other">{t('memberProfile.paymentTypeOther')}</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label style={lbl}>{t('memberProfile.descriptionLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('memberProfile.optional')}</span></label>
          <input style={inp} value={form.description} onChange={set('description')} placeholder="e.g. Premium 12M Renewal" />
        </div>

        {/* Date locked */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px' }}>
          <Lock size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.dateLocked')} — {todayLabel}</span>
        </div>

        {/* Balance preview */}
        {payAmt > 0 && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('memberProfile.balanceAfterPayment')}</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope', color: remaining === 0 ? '#34d399' : overpay ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
              {remaining === 0 ? '✓ ' : ''}{fmtCFA(remaining)}
              {overpay && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{t('memberProfile.credit')}</span>}
            </span>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px' }}>⚠ {error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button type="button"
            style={{ ...primaryBtn, opacity: (form.amount && !saving) ? 1 : 0.45, cursor: (form.amount && !saving) ? 'pointer' : 'not-allowed' }}
            disabled={!form.amount || saving} onClick={handleSave}>
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
  const today = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  const handleDownload = () => {
    const lines = [
      '==============================',
      '         GEM GYM              ',
      '     PAYMENT RECEIPT          ',
      '==============================',
      `Reference:    ${payment.reference}`,
      `Date:         ${payment.date}`,
      `Member:       ${member?.firstName} ${member?.lastName}`,
      `Member ID:    ${member?.id}`,
      '------------------------------',
      `Description:  ${payment.description}`,
      `Method:       ${payment.method}`,
      `Amount:       ${payment.amount}`,
      `Balance After:${payment.balanceAfter}`,
      '------------------------------',
      `Recorded by:  ${payment.recordedBy}`,
      `Printed:      ${today}`,
      '==============================',
      'Thank you for your payment!',
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `receipt-${payment.reference}.txt`; a.click();
    URL.revokeObjectURL(url);
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
            <div style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: 800, color: '#0a0a0f', letterSpacing: '0.05em' }}>{t('memberProfile.gemGym')}</div>
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

// ─── Convert to Visitor Modal ─────────────────────────────────────────────────
function ConvertToVisitorModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => { if (!open) setAuthorized(false); }, [open]);

  const handleConfirm = () => {
    if (!member) return;
    member.status = 'visitor';
    member.package = 'Visitor Pass';
    member.passesTotal = 0;
    member.passesRemaining = 0;
    delete member.endDate;
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.convertToVisitorTitle')} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 14px', fontSize: 12,
          color: 'var(--text-secondary)', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#ef4444' }}>{t('memberProfile.convertWarning')}</strong> {t('memberProfile.convertWarningText')}
        </div>
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {[
            [t('memberProfile.memberLabel'), `${member?.firstName} ${member?.lastName}`],
            [t('memberProfile.currentPackage'), member?.package?.name ?? member?.package],
            [t('memberProfile.membershipEnd'), member?.endDate ? formatDate(member.endDate) : '—'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{l}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.newStatusLabel')}</span>
            <span style={{ color: '#f97316', fontWeight: 600 }}>{t('memberProfile.visitorLabel')}</span>
          </div>
        </div>
        <ManagerAuthSection authorized={authorized} onAuthorize={() => setAuthorized(true)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{ ...primaryBtn, background: authorized ? 'var(--accent-red)' : 'rgba(239,68,68,0.3)', border: 'none', opacity: authorized ? 1 : 0.5, cursor: authorized ? 'pointer' : 'not-allowed' }}
            disabled={!authorized} onClick={handleConfirm}
          >
            <UserMinus size={13} /> {t('memberProfile.convertToVisitor')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Convert Visitor to Member Modal ──────────────────────────────────────────
// Step 1: pay registration fee → status becomes 'registered'
// After that, the profile shows "Choose Membership" instead of "Renew"
function ConvertToMemberModal({ open, onClose, member, gymData }) {
  const { t } = useLanguage();
  const regFeeAmount = gymData?.registrationFee || 5000;
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  useEffect(() => { if (!open) { setExtraBalance(0); setShowPayment(false); } }, [open]);

  const effectiveBalance = (member?.balance || 0) + extraBalance;
  const canAfford = effectiveBalance >= regFeeAmount;
  const shortfall = Math.max(0, regFeeAmount - effectiveBalance);

  const handleConfirm = () => {
    if (!member) return;
    member.status      = 'registered'; // has reg fee, no membership yet
    member.regFeeDate  = new Date().toISOString().slice(0, 10);
    member.package     = 'None';
    delete member.passesTotal;
    delete member.passesRemaining;
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.convertToMemberTitle')} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DismissibleInfo dismissKey="convert_to_member" color="gold">
          {t('memberProfile.convertToMemberInfo')}
        </DismissibleInfo>

        {/* Registration fee summary */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.registrationFeeLabel')}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtCFA(regFeeAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.currentBalance')}</span>
            <span style={{ color: effectiveBalance >= regFeeAmount ? '#34d399' : '#ef4444', fontWeight: 500 }}>
              {fmtCFA(effectiveBalance)}
            </span>
          </div>
          {shortfall > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.shortfall')}</span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmtCFA(shortfall)}</span>
            </div>
          )}
        </div>

        {/* Add payment if needed */}
        {!canAfford && !showPayment && (
          <button onClick={() => setShowPayment(true)} style={{
            ...secondaryBtn, justifyContent: 'center',
            borderColor: 'rgba(212,175,55,0.35)', color: 'var(--accent-gold)',
          }}>
            <CreditCard size={13} /> {t('memberProfile.addPaymentToCover')}
          </button>
        )}
        {showPayment && shortfall > 0 && (
          <InlinePaymentSection
            shortfall={shortfall}
            onPaymentAdded={n => { setExtraBalance(e => e + n); setShowPayment(false); }}
          />
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canAfford ? 1 : 0.4, cursor: canAfford ? 'pointer' : 'not-allowed' }}
            disabled={!canAfford} onClick={handleConfirm}
          >
            <Users size={13} /> {t('memberProfile.confirmPayRegFee')}
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
  useEffect(() => { if (!open) { setEntered(''); setError(''); setDone(false); } }, [open]);

  const handleConfirm = () => {
    if (entered.trim() === member?.accessCode) {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 900);
    } else {
      setError(t('memberProfile.incorrectCodeMsg'));
    }
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
              <input
                autoFocus
                type="password"
                maxLength={6}
                value={entered}
                onChange={e => { setEntered(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
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
                style={{ ...primaryBtn, opacity: entered.trim() ? 1 : 0.4, cursor: entered.trim() ? 'pointer' : 'not-allowed' }}
                disabled={!entered.trim()}
                onClick={handleConfirm}
              >
                <LogIn size={13} /> {t('memberProfile.checkIn')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Send Code Modal ──────────────────────────────────────────────────────────
function SendCodeModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const [sent, setSent] = useState(false);
  useEffect(() => { if (!open) setSent(false); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.sendAccessCodeTitle')} maxWidth={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sent ? (
          <div style={{
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 10, padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>{t('memberProfile.codeSent')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('memberProfile.sentTo')} {member?.phone}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('memberProfile.sendCodeMessage')}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{member?.firstName} {member?.lastName}</strong>'s phone number:
            </div>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '12px 14px', fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-gold)',
              textAlign: 'center', letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {member?.phone}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('memberProfile.smsInfo')}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button style={secondaryBtn} onClick={onClose}>{sent ? t('common.close') : t('memberProfile.cancel')}</button>
          {!sent && (
            <button style={primaryBtn} onClick={() => setSent(true)}>
              <MessageSquare size={13} /> {t('memberProfile.sendViaSms')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Renew Registration Fee Modal ────────────────────────────────────────────
function RenewRegFeeModal({ open, onClose, member, gymData, onSave }) {
  const { t } = useLanguage();
  const feeAmount  = gymData?.registrationFee || 5000;
  const [method, setMethod]   = useState('Cash');
  const [ref]                 = useState(generateRef());
  const [saving, setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => { if (!open) { setApiError(''); setSaving(false); } }, [open]);

  const today    = new Date().toISOString().slice(0, 10);
  const newExpiry = (() => { const d = new Date(today + 'T00:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();

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
            <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>{fmtCFA(feeAmount)}</span>
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
        <GemSelect label={t('memberProfile.paymentMethodLabel')} value={method} onChange={e => setMethod(e.target.value)} options={[
          { value: 'Cash', label: t('memberProfile.cash') },
          { value: 'Card', label: t('memberProfile.card') },
          { value: 'Bank Transfer', label: t('memberProfile.bankTransfer') },
          { value: 'Mobile Pay', label: t('memberProfile.mobilePay') },
        ]} />
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
                await createPayment({ amount: feeAmount, method, reference: ref, memberId: member.id, type: 'registration', description: 'Annual registration fee renewal' });
                await updateMember(member.id, { regFeeDate: today, status: member.status === 'suspended' ? 'active' : member.status });
                onSave?.({ regFeeDate: today, status: member.status === 'suspended' ? 'active' : member.status });
                onClose();
              } catch (err) {
                setApiError(err?.response?.data?.error || 'Payment failed. Try again.');
                setSaving(false);
              }
            }}
          >
            <CreditCard size={13} /> {saving ? t('memberProfile.processing') : `Pay ${fmtCFA(feeAmount)} & Renew`}
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
function SendMessageModal({ open, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ subject: '', message: '', type: 'Email' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSend = () => {
    if (!form.subject.trim()) return;
    onSave?.(form);
    setForm({ subject: '', message: '', type: 'Email' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.sendMessageTitle')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GemInput label={t('memberProfile.subjectLabel')} placeholder={t('memberProfile.subjectPH')} value={form.subject} onChange={set('subject')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
            {t('memberProfile.messageLabel')}
          </label>
          <textarea
            value={form.message}
            onChange={set('message')}
            rows={5}
            placeholder={t('memberProfile.messagePH')}
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
          label={t('memberProfile.typeLabel')}
          value={form.type}
          onChange={set('type')}
          options={[
            { value: 'Email', label: t('memberProfile.typeEmail') },
            { value: 'SMS', label: t('memberProfile.typeSms') },
            { value: 'Notification', label: t('memberProfile.typeNotification') },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button style={primaryBtn} onClick={handleSend}>{t('memberProfile.sendMessageBtn')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Membership helpers ───────────────────────────────────────────────────────

const PKG_MONTHS = {
  'Basic Monthly':   1,
  'Standard 6M':     6,
  'Premium 12M':    12,
  'Student Monthly': 1,
  'Visitor Pass':    0,
};

function toDateStr(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

function addMonths(dateStr, n) {
  const d = new Date(toDateStr(dateStr) + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(toDateStr(dateStr) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function deriveStatus(startDate, endDate) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end   = endDate   ? new Date(endDate   + 'T00:00:00') : null;
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

function fmtCFA(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA';
}

// ─── Insufficient Balance Notice ──────────────────────────────────────────────

// Inline payment section — expands inside the parent modal, no context switching
function InlinePaymentSection({ shortfall, memberId, type = 'membership', onPaymentAdded, confirmLabel, savingLabel }) {
  const { t } = useLanguage();
  const [amount, setAmount]       = useState(String(shortfall > 0 ? shortfall : ''));
  const [method, setMethod]       = useState('Cash');
  const [ref]                     = useState(generateRef());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState('');

  const isRenewal = !!confirmLabel;
  const n = parseInt(amount, 10);
  const validAmount = n > 0;

  if (submitted) {
    return (
      <div style={{
        background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        color: 'var(--accent-green)',
      }}>
        <span style={{ fontSize: 18 }}>✓</span> Payment of {fmtCFA(n)} recorded.
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <GemInput label={t('memberProfile.amountFcfaShort')} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <GemSelect label={t('memberProfile.methodLabel')} value={method} onChange={e => setMethod(e.target.value)} options={[
          { value: 'Cash', label: t('memberProfile.cash') },
          { value: 'Card', label: t('memberProfile.card') },
          { value: 'Bank Transfer', label: t('memberProfile.bankTransfer') },
        ]} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t('memberProfile.refLabel')} {ref}</div>
      {apiError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{apiError}</div>}
      <button
        disabled={saving || !validAmount}
        onClick={async () => {
          if (!validAmount) return;
          setSaving(true); setApiError('');
          try {
            await createPayment({ amount: n, method, reference: ref, memberId, type });
            setSubmitted(true);
            onPaymentAdded(n);
          } catch (err) {
            setApiError(err?.response?.data?.error || 'Payment failed. Try again.');
            setSaving(false);
          }
        }}
        style={{
          ...primaryBtn,
          width: '100%', justifyContent: 'center',
          opacity: (saving || !validAmount) ? 0.5 : 1,
          cursor: (saving || !validAmount) ? 'not-allowed' : 'pointer',
          padding: isRenewal ? '11px 16px' : undefined,
          gap: 8,
        }}
      >
        {saving ? (
          <>{savingLabel || t('memberProfile.processing')}</>
        ) : isRenewal ? (
          <><CreditCard size={13} /> Pay {validAmount ? fmtCFA(n) : ''} &amp; Renew <RefreshCw size={13} /></>
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
        {t('memberProfile.balanceSufficient')} — {fmtCFA(effectiveBalance)} available · Package costs {fmtCFA(pkg.price)}
      </div>
    );
  }

  // Minimum payment is met — can proceed, remainder becomes debt
  if (minShortfall <= 0) {
    return (
      <div style={{
        background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)',
        borderRadius: 10, padding: '12px 16px', fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 4 }}>{t('memberProfile.minPaymentMet')}</div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('memberProfile.payingNow')} <strong style={{ color: 'var(--text-primary)' }}>{fmtCFA(effectiveBalance)}</strong>
          &ensp;·&ensp; {t('memberProfile.remainingDebt')} <strong style={{ color: 'var(--accent-red)' }}>{fmtCFA(remaining)}</strong>
          &ensp;·&ensp; {t('memberProfile.fullPrice')} {fmtCFA(pkg.price)}
        </div>
      </div>
    );
  }

  // Below minimum — cannot proceed
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 2 }}>{t('memberProfile.belowMinPayment')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('memberProfile.balanceLabel2')} {fmtCFA(effectiveBalance)}
          &ensp;·&ensp; {t('memberProfile.minimumRequired')} <strong style={{ color: 'var(--text-primary)' }}>{fmtCFA(minPayment)}</strong>
          &ensp;·&ensp; {t('memberProfile.shortBy')} {fmtCFA(minShortfall)}
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
  const [selectedPkg, setSelectedPkg]   = useState('');
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => { if (!open) { setSelectedPkg(''); setExtraBalance(0); setShowPayment(false); setSaving(false); } }, [open]);

  const pkg = packagesList.find(p => p.name === selectedPkg) || null;
  const today = new Date().toISOString().slice(0, 10);
  const effectiveBalance = extraBalance;
  const minPayment = pkg ? (pkg.minPayment ?? pkg.price) : 0;
  const canAfford = pkg && effectiveBalance >= minPayment;
  const shortfall = pkg ? Math.max(0, minPayment - effectiveBalance) : 0;

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.changePackageTitle')} maxWidth={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {t('memberProfile.changePackageInfo')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.current')} <strong style={{ color: 'var(--text-primary)' }}>{member.package?.name ?? member.package}</strong>
          &ensp;·&ensp; {t('memberProfile.balance')}: <strong style={{ color: extraBalance > 0 ? 'var(--accent-green)' : 'var(--accent-gold)' }}>{fmtCFA(effectiveBalance)}</strong>
          {extraBalance > 0 && <span style={{ color: 'var(--accent-green)' }}> (+{fmtCFA(extraBalance)} added)</span>}
        </div>
        <GemSelect
          label={t('memberProfile.newPackageLabel')}
          value={selectedPkg}
          onChange={e => { setSelectedPkg(e.target.value); setShowPayment(false); }}
          options={[
            { value: '', label: t('memberProfile.selectNewPackage') },
            ...packagesList.filter(p => !p.isVisitor && p.name !== (member.package?.name ?? member.package)).map(p => ({
              value: p.name, label: `${p.name} — ${fmtCFA(p.price)}`,
            })),
          ]}
        />
        {pkg && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InfoRow label={t('memberProfile.packagePrice')} value={fmtCFA(pkg.price)} />
            <InfoRow label={t('memberProfile.durationLabel')} value={pkg.duration} />
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
            memberId={member.id}
            type="membership"
            onPaymentAdded={n => { setExtraBalance(e => e + n); setShowPayment(false); }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
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
                onSave?.({ packageId: pkg.id, package: pkg, startDate: today, endDate: newEndDate, balance: newBalance, status: deriveStatus(today, newEndDate) });
                onClose();
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

function RenewMembershipModal({ open, onClose, member, packagesList = [], onSave }) {
  const { t } = useLanguage();
  const [selectedPkg, setSelectedPkg]   = useState('');
  const [startDate, setStartDate]       = useState('');
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPkg(member.package?.name || member.package || '');
      const isExpiredOrLapsed = !member.endDate || new Date(member.endDate) < new Date();
      const isDeactivated = member.status === 'deactivated' || member.status === 'cancelled';
      setStartDate((isExpiredOrLapsed || isDeactivated) ? new Date().toISOString().slice(0, 10) : member.endDate.slice(0, 10));
      setExtraBalance(0);
      setShowPayment(false);
      setSaving(false);
    }
  }, [open, member]);

  const pkg = packagesList.find(p => p.name === selectedPkg) || null;
  const endDate = (pkg && startDate) ? calcEndDateFromPkg(startDate, pkg) : null;
  const effectiveBalance = extraBalance;
  const minPayment = pkg ? (pkg.minPayment ?? pkg.price) : 0;
  const canAfford = pkg && effectiveBalance >= minPayment;
  const shortfall = pkg ? Math.max(0, minPayment - effectiveBalance) : 0;

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.renewMembershipTitle')} maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.balance')}: <strong style={{ color: extraBalance > 0 ? 'var(--accent-green)' : 'var(--accent-gold)' }}>{fmtCFA(effectiveBalance)}</strong>
          {extraBalance > 0 && <span style={{ color: 'var(--accent-green)' }}> (+{fmtCFA(extraBalance)} added)</span>}
          &ensp;·&ensp; {t('memberProfile.expiresLabel')} <strong style={{ color: 'var(--text-primary)' }}>{formatDate(member.endDate)}</strong>
        </div>
        <GemSelect
          label={t('memberProfile.package')}
          value={selectedPkg}
          onChange={e => { setSelectedPkg(e.target.value); setShowPayment(false); }}
          options={[
            { value: '', label: t('memberProfile.selectPackage') },
            ...packagesList.filter(p => !p.isVisitor).map(p => ({
              value: p.name, label: `${p.name} — ${fmtCFA(p.price)}`,
            })),
          ]}
        />
        <GemInput label={t('memberProfile.startDate')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('memberProfile.endDateAutoCalc')}</label>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '9px 14px', fontSize: 13,
            color: endDate ? 'var(--accent-gold)' : 'var(--text-muted)',
            fontWeight: endDate ? 600 : 400,
          }}>
            {endDate ? formatDate(endDate) : '—'}
          </div>
        </div>
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
            memberId={member.id}
            type="membership"
            confirmLabel="renew"
            savingLabel="Processing & Renewing…"
            onPaymentAdded={async (n) => {
              const newBalance = extraBalance + n;
              setExtraBalance(newBalance);
              setShowPayment(false);
              if (!pkg || !startDate) return;
              setSaving(true);
              try {
                const memberBalance = Math.max(0, pkg.price - newBalance);
                await updateMember(member.id, {
                  packageId: pkg.id,
                  startDate,
                  endDate: endDate || undefined,
                  balance: memberBalance,
                  status: 'active',
                });
                onSave?.({ packageId: pkg.id, package: pkg, startDate, endDate, balance: memberBalance, status: deriveStatus(startDate, endDate) });
                onClose();
              } catch { setSaving(false); }
            }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────

// ─── Reusable Manager Auth Section ───────────────────────────────────────────

function ManagerAuthSection({ authorized, onAuthorize, label }) {
  const { t } = useLanguage();
  const displayLabel = label ?? t('memberProfile.managerAuthRequired');
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPin(''); setError(''); }, [authorized]);

  if (authorized) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
        borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent-green)',
      }}>
        <Unlock size={13} /> {t('memberProfile.managerAuthorized')}
      </div>
    );
  }

  const attempt = async () => {
    if (!pin) return;
    setLoading(true); setError('');
    try {
      const res = await verifyManager(pin);
      if (res.data?.authorized) {
        onAuthorize();
      } else {
        setError(t('memberProfile.incorrectPassword'));
        setPin('');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || t('memberProfile.verificationFailed');
      setError(msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
      borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        <Lock size={12} /> {displayLabel}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="password" value={pin} autoFocus
          onChange={e => { setPin(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder={t('memberProfile.enterLoginPassword')}
          style={{
            flex: 1, background: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 14,
            color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none',
          }}
        />
        <button style={{ ...primaryBtn, opacity: (pin && !loading) ? 1 : 0.5, cursor: (pin && !loading) ? 'pointer' : 'not-allowed' }}
          disabled={!pin || loading} onClick={attempt}>
          {loading ? '…' : t('memberProfile.authorize')}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{error}</div>}
    </div>
  );
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────

function ExtendModal({ open, onClose, member }) {
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
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => { if (!open) { setPreset(0); setCustomDays(''); setAuthorized(false); } }, [open]);

  const days = PRESETS[preset].days ?? parseInt(customDays || '0', 10);
  const currentEnd = member.endDate || new Date().toISOString().slice(0, 10);
  const newEnd = days > 0 ? addDays(currentEnd, days) : currentEnd;

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.extendMembershipTitle')} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('memberProfile.currentEndDateLabel')} <strong style={{ color: 'var(--text-primary)' }}>{formatDate(currentEnd)}</strong>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 8 }}>
            {t('memberProfile.extendBy')}
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
        <ManagerAuthSection authorized={authorized} onAuthorize={() => setAuthorized(true)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: (days > 0 && authorized) ? 1 : 0.4, cursor: (days > 0 && authorized) ? 'pointer' : 'not-allowed' }}
            disabled={days <= 0 || !authorized}
            onClick={onClose}
          >
            {t('memberProfile.confirmExtension')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Freeze Modal ─────────────────────────────────────────────────────────────

function FreezeModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate]   = useState(today);
  const [duration, setDuration]     = useState('1M');
  const [reason, setReason]         = useState('');
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => { if (!open) { setStartDate(today); setDuration('1M'); setReason(''); setAuthorized(false); } }, [open]);

  const daysMap = { '1W': 7, '2W': 14, '1M': 30, '2M': 60 };
  const freezeDays = daysMap[duration];
  const currentEnd = member?.endDate || today;
  const newEnd = addDays(currentEnd, freezeDays);

  const handleConfirm = () => {
    // Write freeze data to member object in-place (mock persistence)
    member.preFreezEndDate = currentEnd;
    member.freezeStartDate = startDate;
    member.endDate         = newEnd;
    member.status          = 'frozen';
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('memberProfile.freezeMembershipTitle')} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DismissibleInfo dismissKey="freeze_membership" color="blue">
          {t('memberProfile.freezeInfo')}
        </DismissibleInfo>
        <GemInput label={t('memberProfile.freezeStartDate')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <GemSelect label={t('memberProfile.durationLabel')} value={duration} onChange={e => setDuration(e.target.value)} options={[
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('memberProfile.reasonLabel')}</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder={t('memberProfile.reasonPH')}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '9px 14px', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'DM Sans',
              outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
        <ManagerAuthSection authorized={authorized} onAuthorize={() => setAuthorized(true)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: authorized ? 1 : 0.4, cursor: authorized ? 'pointer' : 'not-allowed' }}
            disabled={!authorized}
            onClick={handleConfirm}
          >
            <Snowflake size={13} /> {t('memberProfile.freezeMembershipBtn')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Unfreeze Modal ───────────────────────────────────────────────────────────

function UnfreezeModal({ open, onClose, member }) {
  const { t } = useLanguage();
  const [authorized, setAuthorized] = useState(false);
  const [note, setNote]             = useState('');
  useEffect(() => { if (!open) { setAuthorized(false); setNote(''); } }, [open]);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Days actually frozen = today - freezeStartDate
  const freezeStart = member?.freezeStartDate
    ? new Date(member.freezeStartDate + 'T00:00:00')
    : null;
  const daysActuallyFrozen = freezeStart
    ? Math.max(0, Math.round((today - freezeStart) / 86400000))
    : 0;

  // New end date = pre-freeze end date + days actually frozen
  const baseEnd = member?.preFreezEndDate || member?.endDate;
  const newEndDate = baseEnd ? addDays(baseEnd, daysActuallyFrozen) : null;

  // Days the freeze was originally meant to last
  const originalExtendedEnd = member?.endDate;
  const originalDays = (baseEnd && originalExtendedEnd)
    ? Math.round((new Date(originalExtendedEnd + 'T00:00:00') - new Date(baseEnd + 'T00:00:00')) / 86400000)
    : 0;
  const daysReturned = Math.max(0, originalDays - daysActuallyFrozen);

  const handleConfirm = () => {
    if (!member) return;
    member.endDate         = newEndDate;
    member.status          = 'active';
    delete member.freezeStartDate;
    delete member.preFreezEndDate;
    onClose();
  };

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
              {freezeStart ? formatDate(member.freezeStartDate) : '—'}
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
              {newEndDate ? formatDate(newEndDate) : '—'}
            </span>
          </div>
        </div>

        <DismissibleInfo dismissKey="unfreeze_membership" color="green">
          Only the {daysActuallyFrozen} days actually frozen will be added back to the original end date. The remaining {daysReturned} extension days are cancelled.
        </DismissibleInfo>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
            {t('memberProfile.noteOptional')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span>
          </label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder={t('memberProfile.reasonUnfreezePH')}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '9px 14px', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'DM Sans',
              outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
        <ManagerAuthSection authorized={authorized} onAuthorize={() => setAuthorized(true)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{
              ...primaryBtn,
              background: authorized ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.35)',
              color: '#34d399',
              opacity: authorized ? 1 : 0.45,
              cursor: authorized ? 'pointer' : 'not-allowed',
            }}
            disabled={!authorized}
            onClick={handleConfirm}
          >
            <Snowflake size={13} /> {t('memberProfile.confirmUnfreeze')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Cancel Membership Modal ──────────────────────────────────────────────────

function CancelMembershipModal({ open, onClose, onConfirm }) {
  const { t } = useLanguage();
  const [reason, setReason]         = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving]         = useState(false);
  useEffect(() => { if (!open) { setReason(''); setAuthorized(false); setSaving(false); } }, [open]);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('memberProfile.reasonRequired')}</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder={t('memberProfile.reasonCancelPH')}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '9px 14px', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'DM Sans',
              outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
        <ManagerAuthSection authorized={authorized} onAuthorize={() => setAuthorized(true)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.goBack')}</button>
          <button
            style={{ ...primaryBtn, background: 'var(--accent-red)', border: 'none', opacity: (reason.trim() && authorized && !saving) ? 1 : 0.4, cursor: (reason.trim() && authorized && !saving) ? 'pointer' : 'not-allowed' }}
            disabled={!reason.trim() || !authorized || saving}
            onClick={async () => {
              setSaving(true);
              try { await onConfirm?.(reason); onClose(); } catch { setSaving(false); }
            }}
          >
            <XCircle size={13} /> {saving ? t('memberProfile.cancelling') : t('memberProfile.cancelMembershipBtn')}
          </button>
        </div>
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

function DayPassModal({ open, onClose, member, packagesList = [] }) {
  const { t } = useLanguage();
  const visitorPkg   = packagesList.find(p => p.isVisitor);
  const [qty, setQty]                   = useState(1);
  const [extraBalance, setExtraBalance] = useState(0);
  const [showPayment, setShowPayment]   = useState(false);
  useEffect(() => { if (!open) { setQty(1); setExtraBalance(0); setShowPayment(false); } }, [open]);

  const isVisitor = member?.status === 'visitor';
  const priceEach = visitorPkg?.price ?? 0;
  const totalPrice = priceEach * qty;
  const effectiveBalance = (member?.balance || 0) + extraBalance;
  const canAfford = visitorPkg && effectiveBalance >= totalPrice;
  const shortfall = Math.max(0, totalPrice - effectiveBalance);

  const handleConfirm = () => {
    if (!member) return;
    if (isVisitor) {
      // for visitors buying more passes
      member.passesTotal     = (member.passesTotal || 0) + qty;
      member.passesRemaining = (member.passesRemaining || 0) + qty;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isVisitor ? t('memberProfile.buyPassesTitle') : t('memberProfile.buyDayPassTitle')} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DismissibleInfo dismissKey={isVisitor ? 'buy_pass_visitor' : 'buy_day_pass'} color="gold">
          {isVisitor ? t('memberProfile.buyPassesInfo') : t('memberProfile.buyDayPassInfo')}
        </DismissibleInfo>

        {/* Qty selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
            {t('memberProfile.numberOfPasses')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
              × {fmtCFA(priceEach)} {t('memberProfile.each')}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          {isVisitor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.currentPassesRemaining')}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{member?.passesRemaining ?? 0}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.passesToAdd')}</span>
            <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>+{qty}</span>
          </div>
          {isVisitor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.newTotal')}</span>
              <span style={{ color: '#34d399', fontWeight: 600 }}>{(member?.passesRemaining ?? 0) + qty}</span>
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('memberProfile.totalLabel')}</span>
            <span style={{ color: 'var(--text-primary)' }}>{fmtCFA(totalPrice)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberProfile.balanceLabel')}</span>
            <span style={{ color: effectiveBalance >= totalPrice ? '#34d399' : '#ef4444', fontWeight: 500 }}>{fmtCFA(effectiveBalance)}</span>
          </div>
        </div>

        {visitorPkg && (
          <BalanceStatus
            effectiveBalance={effectiveBalance}
            pkg={{ ...visitorPkg, price: totalPrice }}
            showingPayment={showPayment}
            onShowPayment={() => setShowPayment(true)}
          />
        )}
        {showPayment && shortfall > 0 && (
          <InlinePaymentSection
            shortfall={shortfall}
            onPaymentAdded={n => { setExtraBalance(e => e + n); setShowPayment(false); }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('memberProfile.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canAfford ? 1 : 0.4, cursor: canAfford ? 'pointer' : 'not-allowed' }}
            disabled={!canAfford}
            onClick={handleConfirm}
          >
            <Ticket size={13} /> Confirm {qty > 1 ? `${qty} Passes` : 'Pass'}
          </button>
        </div>
      </div>
    </Modal>
  );
}


// ─── Tab definitions ──────────────────────────────────────────────────────────
const TAB_KEYS = ['Personal Details', 'Membership', 'Payments', 'Attendance', 'Messages', 'Notes'];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemberProfilePage({ memberId: propId, onBack, fromFrontDesk: propFromFrontDesk } = {}) {
  const { t } = useLanguage();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = propId || paramId;
  const fromFrontDesk = propFromFrontDesk !== undefined ? propFromFrontDesk : location.pathname.startsWith('/front-desk');

  const [member, setMember]         = useState(null);
  const [gymData, setGymData]       = useState(null);
  const [packagesList, setPackagesList] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getMemberById(id), getMyGym(), getPackages()])
      .then(([mRes, gRes, pRes]) => {
        setMember(mRes.data);
        setGymData(gRes.data);
        setPackagesList(pRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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

  const [activeTab, setActiveTab] = useState('Personal Details');
  const [showPersonalModal, setShowPersonalModal]         = useState(false);
  const [showMembershipModal, setShowMembershipModal]     = useState(false);
  const [showChangePackageModal, setShowChangePackageModal] = useState(false);
  const [showRenewModal, setShowRenewModal]               = useState(false);
  const [showExtendModal, setShowExtendModal]             = useState(false);
  const [showFreezeModal, setShowFreezeModal]             = useState(false);
  const [showUnfreezeModal, setShowUnfreezeModal]         = useState(false);
  const [showCancelModal, setShowCancelModal]             = useState(false);
  const [showDayPassModal, setShowDayPassModal]           = useState(false);
  const [showPaymentModal, setShowPaymentModal]               = useState(false);
  const [showPaidUpNotice, setShowPaidUpNotice]               = useState(false);
  const [showNoteModal, setShowNoteModal]                     = useState(false);
  const [showMessageModal, setShowMessageModal]               = useState(false);

  const handleAddPayment = () => {
    if ((member?.balance || 0) === 0) { setShowPaidUpNotice(true); }
    else { setShowPaymentModal(true); }
  };

  // Notes and messages — localStorage keyed by member id (no DB model)
  const [memberNotes, setMemberNotes] = useState([]);
  const [memberMessages, setMemberMessages] = useState([]);
  useEffect(() => {
    if (!id) return;
    try { setMemberNotes(JSON.parse(localStorage.getItem(`gem_member_notes_${id}`) || '[]')); } catch {}
    try { setMemberMessages(JSON.parse(localStorage.getItem(`gem_member_msgs_${id}`) || '[]')); } catch {}
  }, [id]);
  const [showCode, setShowCode]                               = useState(false);
  const [viewPayment, setViewPayment]                             = useState(null);
  const [showConvertToVisitorModal, setShowConvertToVisitorModal] = useState(false);
  const [showConvertToMemberModal, setShowConvertToMemberModal]   = useState(false);
  const [showCheckInCodeModal, setShowCheckInCodeModal]           = useState(false);
  const [showSendCodeModal, setShowSendCodeModal]                 = useState(false);
  const [showRegFeeModal, setShowRegFeeModal]                     = useState(false);

  // ── Reg fee suspension logic ────────────────────────────────────────────────
  const [regFeePaid, setRegFeePaid] = useState(false);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    if (!member) return;
    const type = member.status === 'visitor' ? 'Visitor' : 'Member';
    setAttendance((member.attendances || []).map(a => ({
      id:         a.id,
      date:       new Date(a.checkIn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeIn:     new Date(a.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : '—',
      type,
      notes:      a.note || '—',
    })));
  }, [member?.id]);

  const TAB_LABEL_KEYS = {
    'Personal Details': 'tabPersonal',
    'Membership':       'tabMembership',
    'Payments':         'tabPayments',
    'Attendance':       'tabAttendance',
    'Messages':         'tabMessages',
    'Notes':            'tabNotes',
  };
  const TABS = TAB_KEYS.map(k => ({ key: k, label: t(`memberProfile.${TAB_LABEL_KEYS[k]}`) }));

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
        <div style={{ fontSize: 14 }}>{t('memberProfile.loading')}</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
        <User size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
        <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{t('memberProfile.memberNotFound')}</p>
        <button style={{ ...secondaryBtn, margin: '16px auto' }} onClick={() => onBack ? onBack() : navigate(fromFrontDesk ? '/front-desk' : '/members')}>
          <ArrowLeft size={14} /> {fromFrontDesk ? t('memberProfile.returnToFrontDesk') : t('memberProfile.backToMembers')}
        </button>
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

  // ── Personal Details tab ────────────────────────────────────────────────────
  const PersonalDetailsTab = () => (
    <div style={{ ...cardStyle, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('memberProfile.personalInformation')}
        </span>
        <button style={secondaryBtn} onClick={() => setShowPersonalModal(true)}>
          <Edit2 size={13} /> {t('memberProfile.editPersonalDetails')}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <InfoRow label={t('memberProfile.firstName')} value={member.firstName} />
        <InfoRow label={t('memberProfile.lastName')} value={member.lastName} />
        <InfoRow label={t('memberProfile.gender')} value={member.gender} />
        <DobRow dob={member.dob} />
        <InfoRow label={t('memberProfile.phone')} value={member.phone} />
        <InfoRow label={t('memberProfile.email')} value={member.email} />
        <InfoRow label={t('memberProfile.address')} value={[member.houseNumber, member.street, member.city, member.postalCode].filter(Boolean).join(', ') || '—'} />
        <InfoRow label={t('memberProfile.emergencyContact')} value={member.emergencyContact || '—'} />
        <InfoRow label={t('memberProfile.emergencyPhone')} value={member.emergencyPhone || '—'} />
        <InfoRow label={t('memberProfile.howTheyHeard')} value={member.howHeard || '—'} />

        {/* Registration Fee — expiry only */}
        {gymData?.registrationFeeRequired && gymData?.registrationFeeFrequency === 'yearly' && member.regFeeDate && (() => {
          const paidOn = new Date(String(member.regFeeDate).slice(0, 10) + 'T00:00:00');
          const expiry = new Date(paidOn); expiry.setFullYear(expiry.getFullYear() + 1);
          const today2 = new Date(); today2.setHours(0,0,0,0);
          const daysLeft = Math.round((expiry - today2) / 86400000);
          const isExpired = daysLeft < 0;
          const isWarn = !isExpired && daysLeft <= 30;
          const expiryStr = expiry.toISOString().slice(0, 10);
          const badgeBg = isExpired ? 'rgba(239,68,68,0.12)' : isWarn ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)';
          const badgeColor = isExpired ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399';
          const badgeLabel = isExpired ? t('memberProfile.overdue') : isWarn ? `${daysLeft}d left` : t('status.active');
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
              {showCode ? member.accessCode : '••••'}
            </span>
            <button
              onClick={() => setShowCode(v => !v)}
              title={showCode ? 'Hide code' : 'Show code'}
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
            {/* Send code to phone */}
            <button
              onClick={() => setShowSendCodeModal(true)}
              title="Send access code via SMS"
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Membership tab ──────────────────────────────────────────────────────────
  const MembershipTab = () => {
    const actionBtn = (label, icon, onClick, opts = {}) => {
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

    const isVisitor    = member.status === 'visitor';
    const isRegistered = member.status === 'registered'; // paid reg fee, no package yet

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...cardStyle, padding: 24 }}>
          {/* Header — title + action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('memberProfile.membershipDetails')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              {isVisitor ? (
                <>
                  {actionBtn(t('memberProfile.buyPass'),          <Ticket size={13} />,   () => setShowDayPassModal(true))}
                  {actionBtn(t('memberProfile.convertToMember'),  <Users size={13} />,    () => setShowConvertToMemberModal(true), { success: true })}
                </>
              ) : isRegistered ? (
                <>
                  {actionBtn(t('memberProfile.chooseMembership'), <BookOpen size={13} />, () => setShowRenewModal(true), { success: true })}
                </>
              ) : member.status === 'deactivated' || member.status === 'cancelled' ? (
                <>
                  {actionBtn(t('memberProfile.reactivate'), <RefreshCw size={13} />, () => setShowRenewModal(true), { success: true })}
                </>
              ) : (
                <>
                  {actionBtn(t('memberProfile.renew'),             <RefreshCw size={13} />,() => setShowRenewModal(true))}
                  {actionBtn(t('memberProfile.extend'),            <Plus size={13} />,     () => setShowExtendModal(true))}
                  {member.status === 'frozen'
                    ? actionBtn(t('memberProfile.unfreeze'),        <Snowflake size={13} />,() => setShowUnfreezeModal(true), { active: true })
                    : actionBtn(t('memberProfile.freeze'),          <Snowflake size={13} />,() => setShowFreezeModal(true))}
                  {['suspended', 'frozen', 'expired'].includes(member.status) && actionBtn(t('memberProfile.dayPass'), <UserCheck size={13} />, () => setShowDayPassModal(true))}
                  {actionBtn(t('memberProfile.convertToVisitor'),  <UserMinus size={13} />,() => setShowConvertToVisitorModal(true))}
                  {actionBtn(t('memberProfile.cancelMembershipBtn'), <XCircle size={13} />, () => setShowCancelModal(true), { danger: true })}
                </>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <InfoRow label={t('memberProfile.package')} value={member.package?.name ?? member.package} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.balance')}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Manrope', color: (member.balance || 0) === 0 ? '#34d399' : '#f87171' }}>
                {fmtCFA(member.balance || 0)}
              </span>
            </div>
            <InfoRow label={t('memberProfile.startDate')} value={formatDate(member.startDate)} />
            {!isVisitor && <InfoRow label={t('memberProfile.endDate')} value={formatDate(member.endDate)} />}
            {gymData?.registrationFeeRequired && gymData?.registrationFeeFrequency === 'yearly' && (() => {
              const regDate = member.regFeeDate
                ? member.regFeeDate.slice(0, 10)
                : member.createdAt
                  ? new Date(member.createdAt).toISOString().slice(0, 10)
                  : null;
              if (!regDate) return null;
              const expiry = new Date(regDate + 'T00:00:00'); expiry.setFullYear(expiry.getFullYear() + 1);
              const today3 = new Date(); today3.setHours(0, 0, 0, 0);
              const daysLeft = Math.round((expiry - today3) / 86400000);
              const isOverdue = daysLeft < 0;
              const isWarn = !isOverdue && daysLeft <= 30;
              const badgeColor = isOverdue ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399';
              const badgeBg    = isOverdue ? 'rgba(239,68,68,0.12)' : isWarn ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)';
              const badgeLabel = isOverdue ? t('memberProfile.overdue') : isWarn ? `${daysLeft}d left` : t('status.active');
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.regRenewalDue')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', fontWeight: 500 }}>
                      {expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span style={{ background: badgeBg, color: badgeColor, borderRadius: 20, padding: '1px 9px', fontSize: 11, fontWeight: 600 }}>
                      {badgeLabel}
                    </span>
                    {(isOverdue || isWarn) && (
                      <button onClick={() => setShowRegFeeModal(true)} style={{ background: 'none', border: `1px solid ${badgeColor}`, color: badgeColor, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        {t('memberProfile.renew')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.status')}</span>
              <StatusBadge status={member.status} />
            </div>
            {isVisitor ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.passes')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {Array.from({ length: member.passesTotal || 0 }).map((_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: i < (member.passesRemaining || 0) ? 'var(--accent-gold)' : 'var(--bg-elevated)',
                        border: `1.5px solid ${i < (member.passesRemaining || 0) ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                        transition: 'all 0.15s',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {member.passesRemaining ?? 0}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> / {member.passesTotal ?? 0} {t('memberProfile.left')}</span>
                  </span>
                </div>
              </div>
            ) : (
              <InfoRow label={t('memberProfile.autoRenew')} value={t('common.yes')} />
            )}
            {!isVisitor && <InfoRow label={t('memberProfile.sessions')} value={member.package?.sessions || t('memberProfile.unlimited')} />}
          </div>

        </div>
      </div>
    );
  };

  // ── Payments tab ────────────────────────────────────────────────────────────
  const payments = (member?.payments || []).map(p => ({
    id:          p.id,
    date:        new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    amount:      formatMoney(p.amount),
    method:      p.method || 'Cash',
    description: p.note || p.description || '—',
    reference:   p.reference   || '—',
    recordedBy:  p.staff ? `${p.staff.firstName} ${p.staff.lastName}` : (p.recordedBy || '—'),
    balanceAfter: p.balanceAfter != null ? formatMoney(p.balanceAfter) : '—',
  }));

  const PaymentsTab = () => (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.paymentHistory')}</span>
        <button style={primaryBtn} onClick={handleAddPayment}>
          <Plus size={13} /> {t('memberProfile.addPayment')}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.amountCol'), t('memberProfile.methodCol'), t('memberProfile.descriptionCol'), t('memberProfile.referenceCol'), t('memberProfile.recordedByCol'), t('memberProfile.balanceAfterCol'), ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={p.id || i} style={{ transition: 'background 0.1s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setViewPayment(p)}
              >
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{p.date}</td>
                <td style={{ ...tdStyle, color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.amount}</td>
                <td style={tdStyle}>
                  <span style={{
                    background: p.method === 'Card' ? 'var(--accent-blue-dim)' : 'var(--accent-green-dim)',
                    color: p.method === 'Card' ? 'var(--accent-blue)' : 'var(--accent-green)',
                    borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500
                  }}>{p.method}</span>
                </td>
                <td style={tdStyle}>{p.description}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.reference}</td>
                <td style={tdStyle}>{p.recordedBy}</td>
                <td style={tdStyle}>{p.balanceAfter}</td>
                <td style={{ ...tdStyle, width: 40 }}>
                  <FileText size={14} color="var(--text-muted)" />
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
    let checkInRes = null;
    try {
      checkInRes = await checkInApi({ memberId: member.id });
    } catch {}
    const now = new Date();
    const authUser = getAuth()?.user;
    const staffName = checkInRes?.data?.staff
      ? `${checkInRes.data.staff.firstName} ${checkInRes.data.staff.lastName}`
      : (authUser ? `${authUser.firstName} ${authUser.lastName}` : '—');
    const serverMember = checkInRes?.data?.member;
    if (serverMember?.passesRemaining != null) {
      setMember(prev => ({ ...prev, passesRemaining: serverMember.passesRemaining }));
    }
    setAttendance(prev => [{
      id:         checkInRes?.data?.id || `local-${Date.now()}`,
      date:       now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeIn:     now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: staffName,
      type:       member.status === 'visitor' ? 'Visitor' : 'Member',
      notes:      '—',
    }, ...prev]);
  };

  const AttendanceTab = () => (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('memberProfile.attendanceHistory')}</span>
          {member.status === 'visitor' && (
            <span style={{ fontSize: 12, color: (member.passesRemaining ?? 0) > 0 ? 'var(--accent-gold)' : '#ef4444' }}>
              {member.passesRemaining ?? 0} pass{(member.passesRemaining ?? 0) !== 1 ? 'es' : ''} {t('memberProfile.passesRemainingLabel')}
            </span>
          )}
        </div>
        {member.status === 'visitor' && (member.passesRemaining ?? 0) <= 0 ? (
          <button style={primaryBtn} onClick={() => setShowDayPassModal(true)}>
            <Ticket size={13} /> {t('memberProfile.buyPasses')}
          </button>
        ) : ['active', 'expiring'].includes(member.status) || (member.status === 'visitor' && (member.passesRemaining ?? 0) > 0) ? (
          <button style={primaryBtn} onClick={() => setShowCheckInCodeModal(true)}>
            <LogIn size={13} /> {t('memberProfile.checkIn')}
          </button>
        ) : null}
      </div>
      {member.status === 'visitor' && (member.passesRemaining ?? 0) <= 0 && (
        <div style={{ margin: '0 20px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontFamily: 'DM Sans' }}>
          {t('memberProfile.noPassesRemaining')}
        </div>
      )}
      {!['active', 'expiring', 'visitor'].includes(member.status) && (
        <div style={{ margin: '0 20px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontFamily: 'DM Sans' }}>
          {t('memberProfile.checkInUnavailable')} <strong>{member.status}</strong>.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.timeInCol'), t('memberProfile.recordedByCol'), t('memberProfile.typeCol'), t('memberProfile.notesCol')].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendance.map((a, i) => (
              <tr key={a.id || i}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={tdStyle}>{a.date}</td>
                <td style={{ ...tdStyle, color: 'var(--accent-green)', fontWeight: 500 }}>{a.timeIn}</td>
                <td style={tdStyle}>{a.recordedBy}</td>
                <td style={tdStyle}>
                  <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
                    {a.type}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{a.notes}</td>
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
        <button style={primaryBtn} onClick={() => setShowMessageModal(true)}>
          <MessageSquare size={13} /> {t('memberProfile.sendNewMessage')}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {[t('memberProfile.dateCol'), t('memberProfile.subjectCol'), t('memberProfile.typeCol'), t('memberProfile.sentByCol'), t('memberProfile.statusCol')].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberMessages.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.noMessagesSent')}</td></tr>
            ) : memberMessages.map((m, i) => (
              <tr key={i}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{m.date}</td>
                <td style={tdStyle}>{m.subject}</td>
                <td style={tdStyle}>
                  <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 20, padding: '2px 8px', fontSize: 11 }}>
                    {m.type}
                  </span>
                </td>
                <td style={tdStyle}>{m.sentBy}</td>
                <td style={tdStyle}><StatusBadge status="sent" /></td>
              </tr>
            ))}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button style={primaryBtn} onClick={() => setShowNoteModal(true)}>
          <Plus size={13} /> {t('memberProfile.addNote')}
        </button>
      </div>
      {memberNotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontFamily: 'DM Sans', fontSize: 13 }}>
          {t('memberProfile.noNotesYet')}
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
                    <span style={{ background: cc.bg, color: cc.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 500 }}>{n.category}</span>
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
    'Payments':         <PaymentsTab />,
    'Attendance':       <AttendanceTab />,
    'Messages':         <MessagesTab />,
    'Notes':            <NotesTab />,
  };

  return (
    <div className={onBack ? undefined : 'page-fade'} style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Back button */}
      <button style={{ ...secondaryBtn, marginBottom: 20 }} onClick={() => onBack ? onBack() : navigate(fromFrontDesk ? '/front-desk' : '/members')}>
        <ArrowLeft size={14} /> {fromFrontDesk ? t('memberProfile.returnToFrontDesk') : t('memberProfile.backToMembers')}
      </button>

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
                  &ensp;·&ensp; {t('memberProfile.feeLabel')} {(gymData?.registrationFee || 5000).toLocaleString('fr-FR')} FCFA
                  {(gymData?.registrationGracePeriodDays || 0) > 0 && regFeeStatusVal === 'grace' &&
                    ` · ${gymData.registrationGracePeriodDays}${t('memberProfile.gracePeriodActive')}`}
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

      {/* Page header: name + status + actions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {member.firstName} {member.lastName}
          </h1>
          <StatusBadge status={member.status} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button style={primaryBtn} onClick={handleAddPayment}><CreditCard size={13} /> {t('memberProfile.addPayment')}</button>
          <button
            style={{ ...secondaryBtn, opacity: isSuspended ? 0.4 : 1, cursor: isSuspended ? 'not-allowed' : 'pointer' }}
            disabled={isSuspended}
            title={isSuspended ? 'Cannot check in — account suspended' : undefined}
            onClick={() => !isSuspended && setShowCheckInCodeModal(true)}
          >
            <LogIn size={13} /> {t('memberProfile.checkIn')}
          </button>
          <button style={secondaryBtn} onClick={() => setShowMessageModal(true)}><MessageSquare size={13} /> {t('memberProfile.sendMessage')}</button>
          <button style={secondaryBtn} onClick={() => setShowNoteModal(true)}><StickyNote size={13} /> {t('memberProfile.addNote')}</button>
        </div>
      </div>

      {/* Summary card */}
      <div style={{ ...cardStyle, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMemberPhotoUpload} />
          {member.photo ? (
            <img
              src={member.photo}
              onClick={() => setShowPhotoModal(true)}
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--accent-gold)', opacity: photoUploading ? 0.5 : 1 }}
              alt={member.firstName}
              title="Click to view / change photo"
            />
          ) : (
            <button
              type="button"
              onClick={() => memberPhotoRef.current?.click()}
              title="Upload profile photo"
              disabled={photoUploading}
              style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                border: '2px dashed var(--border)', background: 'var(--bg-elevated)',
                cursor: photoUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Camera size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 7, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1 }}>{photoUploading ? '...' : 'Photo'}</span>
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 24px', flex: 1 }}>
            <div style={{ gridColumn: '1 / -1', marginBottom: 4 }}>
              <div style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {member.firstName} {member.lastName}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{member.memberCode || member.id}</div>
            </div>
            <InfoRow label={t('memberProfile.phone')} value={member.phone} />
            <InfoRow label={t('memberProfile.email')} value={member.email} />
            <InfoRow label={t('memberProfile.package')} value={member.package?.name ?? member.package} />
            <InfoRow label={t('memberProfile.startDate')} value={formatDate(member.startDate)} />
            <InfoRow label={t('memberProfile.endDate')} value={formatDate(member.endDate)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.balance')}</span>
              <span style={{ fontSize: 13, fontFamily: 'DM Sans', fontWeight: 700, color: (member.balance || 0) > 0 ? '#f87171' : '#34d399' }}>
                {formatMoney(member.balance)}
              </span>
            </div>
            <InfoRow label={t('memberProfile.lastCheckIn')} value={formatDate(member.lastVisit)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('memberProfile.status')}</span>
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
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
              marginBottom: -1,
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
      <EditMembershipModal  open={showMembershipModal}  onClose={() => setShowMembershipModal(false)}  member={member}
        onSave={async (form) => { await updateMember(member.id, form); setMember(m => ({ ...m, ...form })); }} />
      <ChangePackageModal   open={showChangePackageModal} onClose={() => setShowChangePackageModal(false)} member={member} packagesList={packagesList}
        onSave={(updates) => setMember(m => ({ ...m, ...updates }))} />
      <RenewMembershipModal open={showRenewModal}       onClose={() => setShowRenewModal(false)}       member={member} packagesList={packagesList}
        onSave={(updates) => setMember(m => ({ ...m, ...updates }))} />
      <ExtendModal          open={showExtendModal}      onClose={() => setShowExtendModal(false)}      member={member} />
      <FreezeModal          open={showFreezeModal}      onClose={() => setShowFreezeModal(false)}      member={member} />
      <UnfreezeModal        open={showUnfreezeModal}    onClose={() => setShowUnfreezeModal(false)}    member={member} />
      <CancelMembershipModal open={showCancelModal} onClose={() => setShowCancelModal(false)}
        onConfirm={async (reason) => {
          await updateMember(member.id, { status: 'deactivated' });
          setMember(m => ({ ...m, status: 'deactivated' }));
          if (reason?.trim()) {
            const note = {
              date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              content: `Membership cancelled — ${reason.trim()}`,
              category: 'Cancellation',
              author: 'Staff',
            };
            const updated = [note, ...memberNotes];
            setMemberNotes(updated);
            try { localStorage.setItem(`gem_member_notes_${id}`, JSON.stringify(updated)); } catch {}
          }
        }} />
      <DayPassModal          open={showDayPassModal}    onClose={() => setShowDayPassModal(false)}     member={member} packagesList={packagesList} />
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
            {t('memberProfile.createBalanceDesc')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" style={{ ...primaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowRenewModal(true); }}>
              <RefreshCw size={13} /> {t('memberProfile.renewMembershipBtn')}
            </button>
            <button type="button" style={{ ...secondaryBtn, justifyContent: 'flex-start', gap: 10 }} onClick={() => { setShowPaidUpNotice(false); setShowChangePackageModal(true); }}>
              <Package size={13} /> {t('memberProfile.changePackageBtn')}
            </button>
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
            setMember(m => ({ ...fresh.data, balance: newBalance }));
          } catch {
            setMember(m => ({ ...m, balance: newBalance, payments: [res.data, ...(m.payments || [])] }));
          }
        }} />
      <PaymentDetailModal open={!!viewPayment} onClose={() => setViewPayment(null)} payment={viewPayment} member={member} />
      <ConvertToVisitorModal open={showConvertToVisitorModal} onClose={() => setShowConvertToVisitorModal(false)} member={member} />
      <ConvertToMemberModal  open={showConvertToMemberModal}  onClose={() => setShowConvertToMemberModal(false)}  member={member} gymData={gymData} />
      <AddNoteModal open={showNoteModal} onClose={() => setShowNoteModal(false)}
        onSave={(form) => {
          const note = { date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), content: form.note, category: form.category, author: 'Staff' };
          const updated = [note, ...memberNotes];
          setMemberNotes(updated);
          try { localStorage.setItem(`gem_member_notes_${id}`, JSON.stringify(updated)); } catch {}
        }} />
      <SendMessageModal open={showMessageModal} onClose={() => setShowMessageModal(false)}
        onSave={(form) => {
          const msg = { date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), subject: form.subject, type: form.type, sentBy: 'Staff' };
          const updated = [msg, ...memberMessages];
          setMemberMessages(updated);
          try { localStorage.setItem(`gem_member_msgs_${id}`, JSON.stringify(updated)); } catch {}
        }} />
      <CheckInCodeModal open={showCheckInCodeModal} onClose={() => setShowCheckInCodeModal(false)} member={member} onSuccess={handleCheckIn} />
      <SendCodeModal    open={showSendCodeModal}    onClose={() => setShowSendCodeModal(false)}    member={member} />

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
          <button
            onClick={e => { e.stopPropagation(); memberPhotoRef.current?.click(); }}
            style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, padding: '10px 24px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Camera size={14} />
            {t('memberProfile.uploadNewPhoto')}
          </button>
          <button
            onClick={() => setShowPhotoModal(false)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >×</button>
        </div>
      )}
    </div>
  );
}
