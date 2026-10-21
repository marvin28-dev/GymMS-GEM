import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useRef, useEffect } from 'react';
import { formatMoney } from '../utils/currency';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { UserCircle, Pencil, Plus, Camera, IdCard, ChevronRight, UserX, UserCheck } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import RowMenu from '../components/ui/RowMenu';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getAll as getStaffApi, create as createStaff, update as updateStaff } from '../services/staff.service';
import { uploadPhoto } from '../services/upload.service';
import { getRole, getAuth, getPhonePlaceholder } from '../utils/auth';
import { roleName } from '../utils/roleNames';
import { canView, canManage, isOwner, rankOf } from '../utils/hierarchy';
import { fmtDate, todayStr } from '../utils/date';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { SkeletonCards, SkeletonTableRows } from '../components/Skeleton';
import { gymCache } from '../utils/gymCache';
import AddressInputs from '../components/AddressInputs';
import { addressErrors } from '../utils/address';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';

const formatDate = (d) => fmtDate(d);

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card)',
};

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
  display: 'inline-flex',
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
  fontFamily: 'DM Sans, sans-serif',
};

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  fontFamily: 'DM Sans, sans-serif',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

// One colour per job, on the table and the phone cards alike
const ROLE_COLORS = {
  manager: { bg: 'rgba(201,169,110,0.12)', color: '#c9a96e' },
  trainer: { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
  instructor: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  front_desk: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80' },
  coach: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  other: { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
};

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  houseNumber: '', street: '', city: '', region: '', postalCode: '', country: '',
  role: '',
  joinDate: '',
  status: 'active',
  emergencyContact: '',
  emergencyPhone: '',
  notes: '',
  employmentType: 'Full Time',
  photoData: '',
  photoFile: null,
  photoIdData: '',
  photoIdFile: null,
};

const AVATAR_COLORS = ['gold', 'blue', 'green', 'red', 'purple'];

// Hours a staff member is rostered for across a week. Used to suggest what
// their pay becomes when they move between hourly and salaried.
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function weeklyHours(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return 0;
  const mins = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  return WEEK_DAYS.reduce((sum, d) => {
    const day = schedule[d];
    if (!day || day.off) return sum;
    const a = mins(day.start), b = mins(day.end);
    return a !== null && b !== null && b > a ? sum + (b - a) / 60 : sum;
  }, 0);
}

// The form shows labels; the server stores these values. Seeding the form with
// the stored value used to leave the role dropdown blank on every edit.
// The jobs a gym hires for. What someone may open follows from this alone.
const ROLE_ENUM = {
  Manager: 'manager', 'Front Desk': 'front_desk', Trainer: 'trainer', Other: 'other',
};
const ROLE_LABEL = {
  manager: 'Manager', front_desk: 'Front Desk', trainer: 'Trainer', other: 'Other',
  // Older accounts were given these, and they do a trainer's job
  instructor: 'Trainer', coach: 'Trainer',
};
const ROLE_ORDER = ['Manager', 'Front Desk', 'Trainer', 'Other'];
const roleLabelFor = (role) => ROLE_LABEL[role] || role || '';

const SectionHeader = ({ title }) => (
  <div style={{
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px',
    color: 'var(--text-muted)', fontWeight: 600, marginTop: 6,
    paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)',
  }}>{title}</div>
);

// ─── Staff Form Modal ─────────────────────────────────────────────────────────
function StaffFormModal({ open, onClose, onSave, initial, mode, saving, saveError, saveField }) {
  const { t } = useLanguage();
  // One field per line on a phone: two half-width selects clip their own text
  const formColumns = useIsMobile() ? '1fr' : '1fr 1fr';
  const [form, setForm] = useState(EMPTY_FORM);
  // Each check names its field, and the message sits under that field
  const [addrErrors, setAddrErrors] = useState({});
  const fieldErr = (k) => addrErrors[k] || (saveField === k ? saveError : undefined);
  const gymCountry = getAuth()?.user?.gymCountry || '';
  // Until the figure is touched, the field shows the suggestion
  const [salaryTouched, setSalaryTouched] = useState(false);
  // The owner account is always active and cannot be deactivated
  const isOwnerAccount = mode === 'edit' && initial?.role === 'general_manager';
  // Nobody switches their own account off, so the field is locked on your own
  // row exactly as it is on the owner's.
  const isOwnRow = mode === 'edit' && String(initial?.id ?? '') === String(getAuth()?.user?.id ?? '');
  // Only the general manager may switch a staff member active/inactive.
  const statusLocked = isOwnerAccount || isOwnRow || !isOwner(getRole());
  // Role and department decide someone's standing: yours are for someone more
  // senior to change, the owner's role never changes, and nobody may hand out
  // a role at or above their own.
  const myRole = getRole();
  const roleLocked = isOwnerAccount || (isOwnRow && !isOwner(myRole));
  const canSetPay = isOwner(myRole);
  const ROLE_LABELS = {
    Manager: t('staff.roleManager'), 'Front Desk': t('staff.roleFrontDesk'),
    Trainer: t('staff.roleTrainer'), Other: t('staff.roleOther'),
  };
  // You may only hire below your own level
  const ROLE_OPTIONS = ROLE_ORDER
    .filter(v => rankOf(ROLE_ENUM[v]) < rankOf(myRole))
    .map(v => ({ value: v, label: ROLE_LABELS[v] }));

  // Moving between hourly and salaried changes what the salary figure means,
  // so it has to be re-stated rather than silently reinterpreted.
  const originalType = initial?.employmentType || 'Full Time';
  const typeChanged = mode === 'edit' && form.employmentType !== originalType;
  const hoursPerWeek = weeklyHours(initial?.schedule);
  const currentPay = Number(initial?.salary) || 0;
  const suggestedPay = hoursPerWeek > 0 && currentPay > 0
    ? (form.employmentType === 'Full Time'
      ? Math.round(currentPay * hoursPerWeek)
      : Math.round(currentPay / hoursPerWeek))
    : 0;
  // Whatever ends up in the field once the type has changed
  const resolvedPay = typeChanged ? Number(salaryTouched ? form.salary : suggestedPay) : null;
  const payMissing = typeChanged && !(resolvedPay > 0);
  const photoRef = useRef(null);
  const photoIdRef = useRef(null);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    set('photoFile', file);
    const reader = new FileReader();
    reader.onload = ev => set('photoData', ev.target.result);
    reader.readAsDataURL(file);
  }

  function handlePhotoIdChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    set('photoIdFile', file);
    const reader = new FileReader();
    reader.onload = ev => set('photoIdData', ev.target.result);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (open) {
      setAddrErrors({});
      if (mode === 'edit' && initial) {
        setForm({
          firstName: initial.firstName || (initial.name || '').split(' ')[0] || '',
          lastName: initial.lastName || (initial.name || '').split(' ').slice(1).join(' ') || '',
          phone: initial.phone || '',
          email: initial.email || '',
          houseNumber: initial.houseNumber || '', street: initial.street || '', city: initial.city || '',
          region: initial.region || '', postalCode: initial.postalCode || '', country: initial.country || '',
          role: roleLabelFor(initial.role),
          joinDate: initial.joinDate || (initial.createdAt ? String(initial.createdAt).slice(0, 10) : ''),
          status: initial.status !== undefined ? initial.status : (initial.isActive === false ? 'inactive' : 'active'),
          emergencyContact: initial.emergencyContact || '',
          emergencyPhone: initial.emergencyPhone || '',
          notes: '',
          employmentType: initial.employmentType || 'Full Time',
          salary: initial.salary ?? '',
          photoData: initial.photo || initial.photoData || '',
          photoIdData: initial.photoId || initial.photoIdData || '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, mode, initial]);

  function set(field, value) { setForm(p => ({ ...p, [field]: value })); }

  const fieldStyle = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    padding: '9px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
  };

  const labelStyle = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 5,
    display: 'block',
    fontFamily: 'DM Sans, sans-serif',
    fontWeight: 500,
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'edit' ? t('staff.editStaff') : t('staff.addStaff')} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>

        {/* ── Profile Photo ── */}
        <SectionHeader title={t('members.profilePhoto')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          <div
            onClick={() => photoRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
              border: `2px dashed ${form.photoData ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: 'var(--bg-elevated)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = form.photoData ? 'var(--accent-gold)' : 'var(--border)'}
          >
            {form.photoData
              ? <img src={form.photoData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={t('common.preview')} />
              : <Camera size={28} color="var(--text-muted)" />
            }
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
              {form.photoData ? t('staff.clickToChangePhoto') : t('staff.uploadProfilePhoto')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans' }}>{t('members.photoHint')}</div>
          </div>
        </div>

        {/* ── Personal Information ── */}
        <SectionHeader title={t('members.personalInfo')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: formColumns, gap: 14 }}>
          <GemInput label={`${t('members.firstName')} *`} error={fieldErr('firstName')} placeholder={t('members.firstName')} value={form.firstName} onChange={e => { set('firstName', e.target.value); setAddrErrors(x => ({ ...x, firstName: undefined })); }} />
          <GemInput label={`${t('members.lastName')} *`} error={fieldErr('lastName')} placeholder={t('members.lastName')} value={form.lastName} onChange={e => { set('lastName', e.target.value); setAddrErrors(x => ({ ...x, lastName: undefined })); }} />
          <GemInput label={`${t('common.phone')} *`} error={fieldErr('phone')} placeholder={getPhonePlaceholder()} inputMode="tel" value={form.phone} onChange={e => { set('phone', e.target.value.replace(/[^\d\s+\-()]/g, '')); setAddrErrors(x => ({ ...x, phone: undefined })); }} />
          <GemInput label={t('common.email')} error={fieldErr('email')} required={mode !== 'edit'} type="email" placeholder="email@gemgym.cm" value={form.email} onChange={e => { set('email', e.target.value); setAddrErrors(x => ({ ...x, email: undefined })); }} />
        </div>

        {/* ── Address ── */}
        <SectionHeader title={t('common.address')} />
        <AddressInputs value={form} gymCountry={gymCountry} errors={{ street: fieldErr('street'), city: fieldErr('city'), region: fieldErr('region') }} onChange={(k, v) => { set(k, v); setAddrErrors(e => ({ ...e, [k]: undefined })); }} />

        {/* ── Employment Details ── */}
        <SectionHeader title={t('staff.employmentDetails')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: formColumns, gap: 14 }}>
          {roleLocked ? (
            <div>
              <label style={labelStyle}>{t('staff.role')}</label>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                {isOwnerAccount ? t('staff.ownerRole') : (ROLE_LABELS[form.role] || form.role)}
              </div>
            </div>
          ) : (
            <GemSelect label={`${t('staff.role')} *`} error={fieldErr('role')} value={form.role} onChange={e => { set('role', e.target.value); setAddrErrors(x => ({ ...x, role: undefined })); }}
              hint={ROLE_OPTIONS.length === 0 ? t('staff.noRoleBelowYou') : t(`staff.roleHint_${ROLE_ENUM[form.role] || 'none'}`)}
              options={[{ value: '', label: t('staff.selectRole') }, ...ROLE_OPTIONS]} />
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{t('staff.employmentType')}</label>
            {!canSetPay && mode === 'edit' && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{form.employmentType === 'Part Time' ? t('staff.partTime') : t('staff.fullTime')}</div>
            )}
            <div style={{ display: (canSetPay || mode !== 'edit') ? 'flex' : 'none' }}>
              {[{ value: 'Full Time', label: t('staff.fullTime') }, { value: 'Part Time', label: t('staff.partTime') }].map((item, i) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => { set('employmentType', item.value); setSalaryTouched(false); }}
                  style={{
                    flex: 1, padding: '9px 14px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: i === 0 ? '10px 0 0 10px' : '0 10px 10px 0',
                    background: form.employmentType === item.value ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                    color: form.employmentType === item.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                    fontWeight: form.employmentType === item.value ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          {typeChanged && (
            <div style={{ gridColumn: '1 / -1' }}>
              <GemInput
                label={form.employmentType === 'Part Time' ? t('staff.newHourlyRate') : t('staff.newMonthlySalary')}
                type="number"
                min="0"
                value={salaryTouched ? form.salary : (suggestedPay || '')}
                onChange={e => { setSalaryTouched(true); set('salary', e.target.value); }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                {hoursPerWeek > 0 && currentPay > 0
                  ? (form.employmentType === 'Full Time'
                    ? t('staff.payFromHourly', { rate: formatMoney(currentPay), hours: hoursPerWeek, total: formatMoney(suggestedPay) })
                    : t('staff.payFromSalary', { salary: formatMoney(currentPay), hours: hoursPerWeek, total: formatMoney(suggestedPay) }))
                  : t('staff.noRotaForPay')}
              </div>
              {payMissing && (
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-red)', marginTop: 6 }}>
                  {t('staff.payRequiredOnSwitch')}
                </div>
              )}
            </div>
          )}
          </div>
          <div>
            <label style={{ ...labelStyle, color: isOwnerAccount ? 'var(--text-muted)' : undefined }}>{t('staff.joinDate')} *</label>
            <input
              type="date"
              disabled={isOwnerAccount}
              style={{
                ...fieldStyle, padding: '9px 14px',
                ...(isOwnerAccount ? { background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.7 } : {}),
              }}
              value={form.joinDate}
              onChange={e => { set('joinDate', e.target.value); setAddrErrors(x => ({ ...x, joinDate: undefined })); }}
            />
            {fieldErr('joinDate') && <span role="alert" style={fieldErrorStyle}>{fieldErr('joinDate')}</span>}
            {isOwnerAccount && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block', fontFamily: 'DM Sans' }}>
                {t('staff.ownerJoinDateFixed')}
              </span>
            )}
          </div>
        </div>

        {/* ── Access & Status ── */}
        <SectionHeader title={t('staff.accessStatus')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: formColumns, gap: 14 }}>
          <GemSelect label={t('common.status')} value={statusLocked ? 'active' : form.status}
            onChange={e => set('status', e.target.value)}
            disabled={statusLocked}
            hint={isOwnerAccount ? t('staff.ownerAlwaysActive') : (isOwnRow ? t('staff.cannotDeactivateSelf') : undefined)}
            options={[{ value: 'active', label: t('common.active') }, { value: 'inactive', label: t('common.inactive') }]} />
        </div>

        {/* ── Emergency Contact ── */}
        <SectionHeader title={t('members.emergencyContact')} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: formColumns, gap: 14 }}>
          <GemInput label={t('staff.contactName')} placeholder={t('common.fullName')} value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} />
          <GemInput label={t('staff.contactPhone')} placeholder={getPhonePlaceholder()} inputMode="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value.replace(/[^\d\s+\-()]/g, ''))} />
        </div>

        {/* ── Documents & Notes ── */}
        <SectionHeader title={t('staff.documentsNotes')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('staff.photoId')}</label>
            <input ref={photoIdRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoIdChange} />
            <div
              onClick={() => photoIdRef.current?.click()}
              style={{
                border: `2px dashed ${form.photoIdData ? 'var(--accent-gold)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = form.photoIdData ? 'var(--accent-gold)' : 'var(--border)'}
            >
              {form.photoIdData ? (
                <>
                  <img src={form.photoIdData} style={{ width: 72, height: 46, objectFit: 'cover', borderRadius: 6 }} alt="ID" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('staff.clickToReplaceId')}</span>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 32, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IdCard size={16} color="var(--text-muted)" />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.clickToUploadId')}</span>
                </>
              )}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('common.notes')}</label>
            <textarea style={{ ...fieldStyle, minHeight: 80 }} placeholder={t('staff.additionalNotes')} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {saveError && !saveField && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>
            {saveError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button style={secondaryBtn} onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: (saving || payMissing) ? 0.5 : 1, cursor: (saving || payMissing) ? 'not-allowed' : 'pointer' }}
            onClick={() => {
              const req = t('common.required');
              const ae = {
                ...(!(form.firstName || '').trim() && { firstName: req }),
                ...(!(form.lastName || '').trim() && { lastName: req }),
                ...(!(form.phone || '').trim() && { phone: req }),
                ...(mode !== 'edit' && !(form.email || '').trim() && { email: req }),
                ...(!roleLocked && !(form.role || '').trim() && { role: req }),
                ...(!isOwnerAccount && !(form.joinDate || '').trim() && { joinDate: req }),
                ...addressErrors(form, req),
              };
              setAddrErrors(ae);
              if (Object.keys(ae).length) { revealFirstError(); return; }
              onSave(typeChanged ? { ...form, salary: resolvedPay } : form);
            }}
            disabled={saving || payMissing}
          >
            {saving ? t('common.loading') : (mode === 'edit' ? t('common.saveChanges') : t('staff.addStaff'))}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  // Your own row: you cannot switch your own account off
  const myId = getAuth()?.user?.id;
  const me = { id: myId, role: getRole() };
  // Only the owner takes people on; a manager works with who is already here
  const canAdd = isOwner(me.role);
  // Only the general manager deals with deactivated staff: seeing them, switching
  // someone off, or back on.
  const isGM = isOwner(me.role);
  const setup = useSetupStatus();
  // Show the last staff list at once and refresh it quietly; only a first-ever
  // visit falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('staff');
  const [staffList, setStaffList] = useState(() => cache.read('list', []));
  const [staffLoading, setStaffLoading] = useState(() => !cache.has('list'));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingStaff, setEditingStaff] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveField, setSaveField] = useState(null);
  // A staff member is never deleted, only switched off. The deactivated ones
  // live under their own tab instead of cluttering the main roster.
  const [staffTab, setStaffTab] = useState('Active');
  const [authTarget, setAuthTarget] = useState(null); // { staff, action: 'deactivate' | 'reactivate' }
  const [showStaffAuth, setShowStaffAuth] = useState(false);

  const liveTick = useLiveTick();
  useEffect(() => {
    getStaffApi().then(res => setStaffList(res.data || [])).catch(console.error).finally(() => setStaffLoading(false));
  }, [liveTick]);

  // Keep the cache in step with the list so a return visit shows the current
  // roster, including staff just added, edited or removed.
  useEffect(() => {
    cache.write('list', staffList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffList]);

  function openAdd() { setModalMode('add'); setEditingStaff(null); setSaveError(''); setModalOpen(true); }
  function openEdit(s) { setModalMode('edit'); setEditingStaff(s); setSaveError(''); setModalOpen(true); }
  // A refused (de)activation is shown at the top of the list (F-120)
  const [statusError, setStatusError] = useState('');
  function requestDeactivate(s) { setAuthTarget({ staff: s, action: 'deactivate' }); setShowStaffAuth(true); }
  function requestReactivate(s) { setAuthTarget({ staff: s, action: 'reactivate' }); setShowStaffAuth(true); }
  async function confirmStaffAuth() {
    if (!authTarget) return;
    const { staff, action } = authTarget;
    const isActive = action === 'reactivate';
    setStatusError('');
    try {
      await updateStaff(staff.id, { isActive });
      setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, isActive, status: isActive ? 'active' : 'inactive' } : s));
    } catch (err) { setStatusError(err?.response?.data?.error || t('staff.failedSave')); }
    setShowStaffAuth(false); setAuthTarget(null);
  }

  async function handleSave(form) {
    setSaving(true);
    setSaveError(''); setSaveField(null);
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const colorIdx = staffList.length % AVATAR_COLORS.length;
    const roleEnum = ROLE_ENUM[form.role] || form.role || 'coach';
    const payload = {
      firstName, lastName,
      email: (form.email || '').trim() || undefined,
      phone: form.phone || undefined,
      role: roleEnum,
      employmentType: form.employmentType || undefined,
      // Salary only travels when the employment type changed, since that is what
      // changes its meaning. Otherwise it stays a profile-only field.
      ...(form.salary !== undefined && form.salary !== '' && form.employmentType !== editingStaff?.employmentType ? { salary: form.salary } : {}),
      emergencyContact: form.emergencyContact || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      houseNumber: (form.houseNumber || '').trim(), street: (form.street || '').trim(), city: (form.city || '').trim(),
      region: (form.region || '').trim(), postalCode: (form.postalCode || '').trim(), country: form.country || getAuth()?.user?.gymCountry || '',
      // A note typed here becomes the first entry on their profile
      ...(form.notes || '').trim() ? { staffNotes: [...(Array.isArray(editingStaff?.staffNotes) ? editingStaff.staffNotes : []), {
        id: Date.now(),
        date: todayStr(),
        content: form.notes.trim(),
        createdBy: [getAuth()?.user?.firstName, getAuth()?.user?.lastName].filter(Boolean).join(' ') || roleName(getRole(), t),
        category: 'General',
      }] } : {},
      // The owner's join date is fixed at account creation and never edited
      ...(editingStaff?.role === 'general_manager' ? {} : { joinDate: form.joinDate || undefined }),
      // The owner account is always active and cannot be deactivated
      isActive: editingStaff?.role === 'general_manager' ? true : form.status !== 'inactive',
      ...(modalMode === 'edit' ? {} : { avatarColor: AVATAR_COLORS[colorIdx] }),
      // Salary is set on the staff profile itself, behind the manager PIN
    };
    try {
      if (modalMode === 'edit' && editingStaff) {
        const res = await updateStaff(editingStaff.id, payload);
        setStaffList(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...res.data } : s));
        setModalOpen(false);
      } else {
        const res = await createStaff(payload);
        const s = res.data;
        // Upload photos to Cloudinary and persist URLs on the staff record. The
        // person exists by now, so a photo that fails is reported on their
        // profile rather than lost without a word (F-120).
        const photoUpdates = {};
        let photoProblem = '';
        if (form.photoFile) {
          try { photoUpdates.photo = await uploadPhoto(form.photoFile, 'gem/staff'); } catch { photoProblem = t('staff.photoFailedAfterCreate'); }
        }
        if (form.photoIdFile) {
          try { photoUpdates.photoId = await uploadPhoto(form.photoIdFile, 'gem/staff/ids'); } catch { photoProblem = t('staff.photoFailedAfterCreate'); }
        }
        if (Object.keys(photoUpdates).length > 0) {
          try { await updateStaff(s.id, photoUpdates); Object.assign(s, photoUpdates); } catch { photoProblem = t('staff.photoFailedAfterCreate'); }
        }
        setStaffList(prev => [s, ...prev]);
        setModalOpen(false);
        navigate(`/staff/${s.id}`, {
          state: {
            newStaff: {
              ...s,
              name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id,
              status: s.isActive !== false ? 'active' : 'inactive',
              emergencyContact: form.emergencyContact || null,
              emergencyPhone: form.emergencyPhone || null,
              emailSent: s.emailSent === true,
              inviteEmail: s.email || null,
              photoProblem,
            },
          },
        });
      }
    } catch (err) {
      console.error(err);
      const se = serverFieldError(err, err?.message || t('staff.failedSave'));
      setSaveError(se.message); setSaveField(se.field);
    } finally {
      setSaving(false);
    }
  }

  function getNameParts(s) {
    if (s.firstName && s.lastName !== undefined) return { firstName: s.firstName, lastName: s.lastName };
    const parts = (s.name || '').split(' ');
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  }

  // The owner is never listed, and nobody sees themselves here: your own
  // record is under My Profile, from the avatar
  const rosterStaff = staffList.filter(s => s.role !== 'general_manager' && String(s.id) !== String(myId));
  const isActiveStaff = (s) => s.isActive !== false && s.status !== 'inactive';
  const deactivatedCount = rosterStaff.filter(s => !isActiveStaff(s)).length;
  // The main list is the active roster; the deactivated ones only appear once
  // the general manager switches to their tab (nobody else sees that tab).
  const showingDeactivated = isGM && staffTab === 'Deactivated';
  const displayStaff = rosterStaff
    .filter(s => showingDeactivated ? !isActiveStaff(s) : isActiveStaff(s));
  const tabCount = { Active: rosterStaff.filter(isActiveStaff).length, Deactivated: deactivatedCount };
  const roleChip = (r) => {
    const rc = ROLE_COLORS[r] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: rc.bg, color: rc.color, fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>{roleName(r, t)}</span>;
  };

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    function getNameParts(s) {
      if (s.firstName) return { firstName: s.firstName, lastName: s.lastName || '' };
      const parts = (s.name || '').trim().split(' ');
      return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
    }
    return (
      <div style={{ minHeight: '100%' }}>
        {statusError && <div role="alert" style={{ margin: '12px 16px 0', fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{statusError}</div>}
        <div style={{ padding: '16px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('staff.title')}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
              {staffLoading ? ' ' : `${rosterStaff.filter(isActiveStaff).length} ${t('common.active').toLowerCase()} · ${deactivatedCount} ${t('status.deactivated').toLowerCase()}`}
            </p>
          </div>
        </div>

        {/* Active / Deactivated tabs - only the general manager sees deactivated staff */}
        {isGM && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[['Active', t('staff.activeStatus')], ['Deactivated', `${t('status.deactivated')}${deactivatedCount ? ` (${deactivatedCount})` : ''}`]].map(([key, label]) => (
            <button key={key} onClick={() => setStaffTab(key)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer', border: `1px solid ${staffTab === key ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: staffTab === key ? 'var(--accent-gold-dim)' : 'var(--bg-card)', color: staffTab === key ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{label}</button>
          ))}
        </div>
        )}

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffLoading ? (
            <SkeletonCards count={5} />
          ) : displayStaff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('staff.noStaffYet')}</div>
          ) : displayStaff.map(s => {
            const { firstName, lastName } = getNameParts(s);
            const fullName = s.name || `${firstName} ${lastName}`.trim();
            const isActive = s.isActive !== false && s.status !== 'inactive';
            return (
              <div
                key={s.id}
                onClick={() => { if (canView(me, s)) navigate(`/staff/${s.id}`); }}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                {s.photo
                  ? <img src={s.photo} alt={firstName} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <Avatar firstName={firstName} lastName={lastName} avatarColor={s.avatarColor || 'gold'} size={42} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fullName}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                    {roleChip(s.role)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: isActive ? '#22c55e' : '#6b7280', fontFamily: 'DM Sans', textTransform: 'capitalize' }}>
                    {isActive ? t('staff.activeStatus') : t('staff.inactiveStatus')}
                  </span>
                  <ChevronRight size={14} color="var(--text-muted)" strokeWidth={2} />
                </div>
              </div>
            );
          })}
        </div>

        {canAdd && <FAB onClick={openAdd} label={t('staff.addStaff')} />}

        {modalOpen && (
          <StaffFormModal
            open={modalOpen}
            mode={modalMode}
            initial={editingStaff}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
            saveError={saveError}
            saveField={saveField}
            saving={saving}
          />
        )}
        <ManagerAuthModal
          open={showStaffAuth}
          onClose={() => { setShowStaffAuth(false); setAuthTarget(null); }}
          danger={authTarget?.action === 'deactivate'}
          action={authTarget ? `${authTarget.action === 'deactivate' ? t('staff.deactivate').toLowerCase() : t('staff.reactivate').toLowerCase()} ${authTarget.staff?.name || `${authTarget.staff?.firstName || ''} ${authTarget.staff?.lastName || ''}`.trim()}` : ''}
          onConfirm={confirmStaffAuth}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {statusError && <div role="alert" style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{statusError}</div>}
      {/* A blank subtitle drops the <p> from the DOM entirely (PageHeader only
          renders it when truthy), which shifts the button row down the instant
          the real count arrives. A non-breaking space keeps the line's height
          reserved throughout, so nothing moves. */}
      <PageHeader title={t('staff.title')} subtitle={staffLoading ? ' ' : `${rosterStaff.filter(isActiveStaff).length} ${t('common.active').toLowerCase()} · ${deactivatedCount} ${t('status.deactivated').toLowerCase()}`}>
        {canAdd && <button style={primaryBtn} onClick={openAdd}>
          <Plus size={14} strokeWidth={2.5} /> {t('staff.addStaff')}
        </button>}
      </PageHeader>


      {/* Not while the list is still on its way: an empty list is the loading
          state too, and the banner appearing then vanishing shoved the table
          down the page a moment after it drew. */}
      {!staffLoading && displayStaff.length === 0 && setup && !setup.complete && (
        <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>👥</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', marginBottom: 3 }}>{t('staff.addFirstStaff')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('staff.addFirstStaffDesc')}
            </div>
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {/* Active / Deactivated - only the general manager sees deactivated staff */}
        {isGM && (
          <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px' }}>
            {[['Active', t('staff.activeStatus')], ['Deactivated', t('status.deactivated')]].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={staffTab === key} onClick={() => setStaffTab(key)}
                style={{ padding: '12px 20px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', whiteSpace: 'nowrap', borderBottom: `2px solid ${staffTab === key ? 'var(--accent-gold)' : 'transparent'}`, color: staffTab === key ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', fontWeight: staffTab === key ? 600 : 400 }}>
                {label}
                <span style={{ marginLeft: 6, background: staffTab === key ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: staffTab === key ? '#000' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '1px 7px' }}>{tabCount[key]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('staff.colStaff'), t('common.phone'), t('staff.role'), t('common.status'), t('staff.joinDate'), t('common.actions')].map((h, i) => (
                  <th key={h} style={{ ...thStyle, ...(i === 5 ? { textAlign: 'right' } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffLoading && <SkeletonTableRows rows={6} cols={6} />}
              {!staffLoading && displayStaff.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>{t('staff.noStaffYet')}</td></tr>
              )}
              {!staffLoading && displayStaff.map(s => {
                const { firstName, lastName } = getNameParts(s);
                return (
                  <tr
                    key={s.id}
                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                    onClick={() => { if (canView(me, s)) navigate(`/staff/${s.id}`); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {s.photo
                          ? <img src={s.photo} alt={firstName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <Avatar firstName={firstName} lastName={lastName} avatarColor={s.avatarColor || 'gold'} size={32} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{s.name || `${firstName} ${lastName}`}</div>
                          {s.email && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{s.phone || '-'}</td>
                    <td style={tdStyle}>{roleChip(s.role)}</td>
                    <td style={tdStyle}><StatusBadge status={s.isActive === false ? 'inactive' : (s.status || 'active')} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{formatDate(s.joinDate || s.createdAt)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {/* Deactivate/reactivate is the general manager's alone. */}
                      <RowMenu title={t('common.actions')} items={[
                        { label: t('common.viewProfile'), icon: <UserCircle size={15} />, onClick: () => navigate(`/staff/${s.id}`), hidden: !canView(me, s) },
                        { label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => openEdit(s), hidden: !(canManage(me, s) || String(s.id) === String(myId)) },
                        ...(isGM && s.role !== 'general_manager' && String(s.id) !== String(myId)
                          ? [isActiveStaff(s)
                              ? { label: t('staff.deactivate'), icon: <UserX size={15} />, onClick: () => requestDeactivate(s), danger: true }
                              : { label: t('staff.reactivate'), icon: <UserCheck size={15} />, onClick: () => requestReactivate(s) }]
                          : []),
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!staffLoading && displayStaff.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>{t('staff.showingN', { n: displayStaff.length })}</div>
        )}
      </div>

      <StaffFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSaveError(''); }}
        onSave={handleSave}
        initial={editingStaff}
        mode={modalMode}
        saving={saving}
        saveError={saveError}
        saveField={saveField}
      />

      <ManagerAuthModal
        open={showStaffAuth}
        onClose={() => { setShowStaffAuth(false); setAuthTarget(null); }}
        danger={authTarget?.action === 'deactivate'}
        action={authTarget ? `${authTarget.action === 'deactivate' ? t('staff.deactivate').toLowerCase() : t('staff.reactivate').toLowerCase()} ${authTarget.staff?.name || `${authTarget.staff?.firstName || ''} ${authTarget.staff?.lastName || ''}`.trim()}` : ''}
        onConfirm={confirmStaffAuth}
      />
    </div>
  );
}
