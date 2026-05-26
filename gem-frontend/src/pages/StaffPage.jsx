import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { MoreVertical, UserCircle, Pencil, Trash2, Plus, Camera, IdCard } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { ROLE_PROFILES } from '../data/mockData';
import { getAll as getStaffApi, create as createStaff, update as updateStaff, remove as removeStaff } from '../services/staff.service';
import { uploadPhoto } from '../services/upload.service';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function compressImage(dataUrl, maxW = 1000, maxH = 1000, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  role: 'Manager',
  department: '',
  joinDate: '',
  status: 'active',
  emergencyContact: '',
  emergencyPhone: '',
  notes: '',
  accessLevel: 'Staff',
  roleProfile: '',
  employmentType: 'Full Time',
  salary: '',
  photoData: '',
  photoFile: null,
  photoIdData: '',
  photoIdFile: null,
};

const AVATAR_COLORS = ['gold', 'blue', 'green', 'red', 'purple'];

// ─── Row Actions Dropdown ─────────────────────────────────────────────────────
function RowActions({ staffId, staffName, onView, onEdit, onDelete }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <MoreVertical size={16} strokeWidth={2} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 200, marginTop: 4,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow-elevated)', minWidth: 150, overflow: 'hidden',
        }}>
          {[
            { label: t('common.viewProfile'), icon: UserCircle, color: 'var(--text-primary)', action: onView },
            { label: t('common.edit'), icon: Pencil, color: 'var(--accent-gold)', action: onEdit },
            { label: t('common.delete'), icon: Trash2, color: 'var(--accent-red)', action: onDelete },
          ].map(item => (
            <button
              key={item.label}
              onClick={e => { e.stopPropagation(); item.action(); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: item.color, fontSize: 13, fontFamily: 'DM Sans, sans-serif', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <item.icon size={14} strokeWidth={2} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Staff Form Modal ─────────────────────────────────────────────────────────
function StaffFormModal({ open, onClose, onSave, initial, mode, saving, saveError }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(EMPTY_FORM);
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
      if (mode === 'edit' && initial) {
        setForm({
          firstName: initial.firstName || (initial.name || '').split(' ')[0] || '',
          lastName: initial.lastName || (initial.name || '').split(' ').slice(1).join(' ') || '',
          phone: initial.phone || '',
          email: initial.email || '',
          address: initial.address || '',
          role: initial.role || 'Manager',
          department: initial.department || 'Management',
          joinDate: initial.joinDate || (initial.createdAt ? String(initial.createdAt).slice(0, 10) : ''),
          status: initial.status !== undefined ? initial.status : (initial.isActive === false ? 'inactive' : 'active'),
          emergencyContact: initial.emergencyContact || '',
          emergencyPhone: initial.emergencyPhone || '',
          notes: initial.notes || '',
          accessLevel: initial.accessLevel || 'Staff',
          employmentType: initial.employmentType || 'Full Time',
          salary: initial.salary != null ? String(initial.salary) : '',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Profile photo upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          <div
            onClick={() => photoRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `2px dashed ${form.photoData ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: 'var(--bg-elevated)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = form.photoData ? 'var(--accent-gold)' : 'var(--border)'}
          >
            {form.photoData
              ? <img src={form.photoData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
              : <Camera size={28} color="var(--text-muted)" />
            }
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
            {form.photoData ? t('staff.clickToChangePhoto') : t('staff.uploadProfilePhoto')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <GemInput label={`${t('members.firstName')} *`} placeholder={t('members.firstName')} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          <GemInput label={`${t('members.lastName')} *`} placeholder={t('members.lastName')} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          <GemInput label={`${t('common.phone')} *`} placeholder="+237 6XX XXX XXX" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <GemInput label={t('common.email')} placeholder="email@gemgym.cm" value={form.email} onChange={e => set('email', e.target.value)} />
          <div style={{ gridColumn: '1 / -1' }}>
            <GemInput label={t('common.address')} placeholder="Quartier Bastos, Yaoundé" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <GemSelect label={`${t('staff.role')} *`} value={form.role} onChange={e => set('role', e.target.value)}
            options={['Manager','Trainer','Instructor','Front Desk','Receptionist','Other'].map(r => ({ value: r, label: r }))} />
          <GemSelect label={t('staff.department')} value={form.department} onChange={e => set('department', e.target.value)}
            options={[{ value: '', label: t('staff.selectDepartment') }, ...['Management','Fitness','Operations','Other'].map(d => ({ value: d, label: d }))]} />
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{t('staff.employmentType')}</label>
            <div style={{ display: 'flex' }}>
              {[{ value: 'Full Time', label: t('staff.fullTime') }, { value: 'Part Time', label: t('staff.partTime') }].map((item, i) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => set('employmentType', item.value)}
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
          </div>
          <div>
            <label style={labelStyle}>{t('staff.joinDate')}</label>
            <input type="date" style={{ ...fieldStyle, padding: '9px 14px' }} value={form.joinDate} onChange={e => set('joinDate', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{t('staff.monthlySalary')}</label>
            <input type="number" placeholder="e.g. 250000" style={{ ...fieldStyle, padding: '9px 14px' }} value={form.salary} onChange={e => set('salary', e.target.value)} />
          </div>
          <GemSelect label={t('common.status')} value={form.status} onChange={e => set('status', e.target.value)}
            options={[{ value: 'active', label: t('common.active') }, { value: 'inactive', label: t('common.inactive') }]} />
          <GemInput label={t('members.contactName')} placeholder={t('members.contactName')} value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} />
          <GemInput label={t('members.emergencyPhone')} placeholder="+237 6XX XXX XXX" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
          <GemSelect label={t('staff.loginAccess')} value={form.accessLevel} onChange={e => set('accessLevel', e.target.value)}
            options={['Admin','Manager','Staff','ReadOnly'].map(l => ({ value: l, label: l }))} />
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{t('staff.roleProfile')}</label>
            <select value={form.roleProfile} onChange={e => set('roleProfile', e.target.value)}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">{t('staff.selectProfile')}</option>
              {ROLE_PROFILES.map(rp => <option key={rp.id} value={rp.id}>{rp.name}</option>)}
            </select>
            {form.roleProfile && (() => {
              const profile = ROLE_PROFILES.find(r => r.id === form.roleProfile);
              return profile ? (
                <div style={{ marginTop: 8, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>{t('staff.canAccess')}</strong> {profile.pages.join(', ')}
                </div>
              ) : null;
            })()}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
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
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>{t('common.notes')}</label>
            <textarea style={{ ...fieldStyle, minHeight: 80 }} placeholder={t('staff.additionalNotes')} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        {saveError && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>
            {saveError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button style={secondaryBtn} onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={() => onSave(form)}
            disabled={saving}
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
  const [staffList, setStaffList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingStaff, setEditingStaff] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getStaffApi().then(res => setStaffList(res.data || [])).catch(console.error);
  }, []);

  function openAdd() { setModalMode('add'); setEditingStaff(null); setSaveError(''); setModalOpen(true); }
  function openEdit(s) { setModalMode('edit'); setEditingStaff(s); setSaveError(''); setModalOpen(true); }
  function openDelete(s) { setDeletingStaff(s); setConfirmOpen(true); }

  const ROLE_ENUM = {
    Manager: 'manager', Trainer: 'trainer', Instructor: 'instructor',
    'Front Desk': 'front_desk', Receptionist: 'front_desk', Other: 'coach',
  };

  async function handleSave(form) {
    if (!(form.firstName || '').trim()) { setSaveError(t('staff.firstNameRequired')); return; }
    if (!(form.lastName || '').trim()) { setSaveError(t('staff.lastNameRequired')); return; }
    setSaving(true);
    setSaveError('');
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const colorIdx = staffList.length % AVATAR_COLORS.length;
    const roleEnum = ROLE_ENUM[form.role] || form.role || 'coach';
    const payload = {
      firstName, lastName,
      email: form.email || `staff${Date.now()}@gem.local`,
      phone: form.phone || undefined,
      role: roleEnum,
      department: form.department || undefined,
      emergencyContact: form.emergencyContact || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      isActive: form.status !== 'inactive',
      avatarColor: AVATAR_COLORS[colorIdx],
      salary: form.salary !== '' ? parseFloat(form.salary) : null,
    };
    try {
      if (modalMode === 'edit' && editingStaff) {
        const res = await updateStaff(editingStaff.id, payload);
        setStaffList(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...res.data } : s));
        setModalOpen(false);
      } else {
        const res = await createStaff({ ...payload, password: `GEM${Date.now().toString().slice(-6)}` });
        const s = res.data;
        // Upload photos to Cloudinary and persist URLs on the staff record
        const photoUpdates = {};
        if (form.photoFile) {
          try { photoUpdates.photo = await uploadPhoto(form.photoFile, 'gem/staff'); } catch (err) { console.error('Profile photo upload failed:', err); }
        }
        if (form.photoIdFile) {
          try { photoUpdates.photoId = await uploadPhoto(form.photoIdFile, 'gem/staff/ids'); } catch (err) { console.error('ID photo upload failed:', err); }
        }
        if (Object.keys(photoUpdates).length > 0) {
          try { await updateStaff(s.id, photoUpdates); Object.assign(s, photoUpdates); } catch {}
        }
        setStaffList(prev => [s, ...prev]);
        setModalOpen(false);
        navigate(`/staff/${s.id}`, {
          state: {
            newStaff: {
              ...s,
              name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id,
              status: s.isActive !== false ? 'active' : 'inactive',
              department: form.department || null,
              emergencyContact: form.emergencyContact || null,
              emergencyPhone: form.emergencyPhone || null,
            },
          },
        });
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to save. Please try again.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingStaff) return;
    try {
      await removeStaff(deletingStaff.id);
      setStaffList(prev => prev.filter(s => s.id !== deletingStaff.id));
    } catch (err) { console.error(err); }
  }

  function getNameParts(s) {
    if (s.firstName && s.lastName !== undefined) return { firstName: s.firstName, lastName: s.lastName };
    const parts = (s.name || '').split(' ');
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <PageHeader title={t('staff.title')} subtitle={`${staffList.filter(s => s.isActive !== false && s.status !== 'inactive').length} ${t('common.active').toLowerCase()}`}>
        <button style={primaryBtn} onClick={openAdd}>
          <Plus size={14} strokeWidth={2.5} /> {t('staff.addStaff')}
        </button>
      </PageHeader>

      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('common.name'), t('common.phone'), t('common.email'), t('staff.role'), t('staff.department'), t('common.status'), t('staff.joinDate'), ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffList.map(s => {
                const { firstName, lastName } = getNameParts(s);
                return (
                  <tr
                    key={s.id}
                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                    onClick={() => navigate(`/staff/${s.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {s.photo
                          ? <img src={s.photo} alt={firstName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <Avatar firstName={firstName} lastName={lastName} avatarColor={s.avatarColor || 'gold'} size={32} />}
                        <span style={{ fontWeight: 500 }}>{s.name || `${firstName} ${lastName}`}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{s.phone}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{s.email}</td>
                    <td style={tdStyle}>{s.role}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{s.department}</td>
                    <td style={tdStyle}><StatusBadge status={s.isActive === false ? 'inactive' : (s.status || 'active')} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(s.joinDate || s.createdAt)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <RowActions
                        staffId={s.id}
                        staffName={s.name}
                        onView={() => navigate(`/staff/${s.id}`)}
                        onEdit={() => openEdit(s)}
                        onDelete={() => openDelete(s)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <StaffFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSaveError(''); }}
        onSave={handleSave}
        initial={editingStaff}
        mode={modalMode}
        saving={saving}
        saveError={saveError}
      />

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('staff.deleteTitle')}
        message={`${t('common.confirm')} — ${deletingStaff?.name}?`}
        confirmLabel={t('common.delete')}
        danger
      />
    </div>
  );
}
