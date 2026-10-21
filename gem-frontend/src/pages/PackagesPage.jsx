import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { getCurrencySymbol, formatMoney } from '../utils/currency';
import { durationText, sessionsText } from '../utils/packageText';
import { Plus, Pencil, Trash2, Eye, Users } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import { ACCESS_TYPES_KEY, DEFAULT_ACCESS_TYPES } from './SettingsPage';
import { useGymSettings, legacyList } from '../hooks/useGymSettings';
import ConfirmModal from '../components/ui/ConfirmModal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import StatusBadge from '../components/ui/StatusBadge';
import RowMenu from '../components/ui/RowMenu';
import { getAll as getPackages, create as createPackage, update as updatePackage, remove as removePackage } from '../services/packages.service';
import { getAll as getMembers } from '../services/members.service';
import { getRole, getAuth } from '../utils/auth';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { softAll } from '../utils/loadAll';
import { serverFieldError } from '../utils/formErrors';
import { isActiveMember } from '../utils/attention';
import { SkeletonCards, SkeletonTableRows } from '../components/Skeleton';


const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const emptyForm = { name: '', code: '', description: '', price: '', dayPassPrice: '', durationType: 'Months', durationValue: '', sessionLimit: 'Unlimited', accessType: [], status: 'active', notes: '' };
const emptyVisitorForm = { label: '', sessions: '', pricePerSession: '', durationDays: '', status: 'active' };

export default function PackagesPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const setup = useSetupStatus();
  // Only the owner prices the gym. Everyone else reads.
  const canPrice = getRole() === 'general_manager';
  // The gym's list, set in Settings
  const gymSettings = useGymSettings();
  const accessTypeOptions = gymSettings.accessTypes || legacyList(ACCESS_TYPES_KEY) || DEFAULT_ACCESS_TYPES;

  // Cache the last packages this account saw, scoped per gym so accounts never
  // share. A page that has been open before shows those at once and refreshes
  // them quietly; only a first-ever visit falls back to a skeleton. This is
  // what stops the skeleton-then-shorter-real-list jump that read as flicker.
  const gymId = getAuth()?.user?.gymId || 'default';
  const cacheKey = (k) => `gem_pkg_${gymId}_${k}`;
  const readCache = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(cacheKey(k)) || 'null'); if (v == null) return fb; if (Array.isArray(fb) && !Array.isArray(v)) return fb; return v; } catch { return fb; } };

  const [tab, setTab] = useState('member'); // 'member' | 'visitor'
  const [packages, setPackages] = useState(() => readCache('packages', []));
  const [membersList, setMembersList] = useState(() => readCache('members', []));
  const [loading, setLoading] = useState(() => readCache('packages', null) === null);
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [showEditAuth, setShowEditAuth] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [deletePkg, setDeletePkg] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  // A refused delete, shown at the top of the page (the dialogs close at once)
  const [deleteError, setDeleteError] = useState('');
  const [profilePkg, setProfilePkg] = useState(null);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);

  const liveTick = useLiveTick();
  useEffect(() => {
    softAll([getPackages(), getMembers()])
      .then(([pkgsRes, membersRes]) => {
        setPackages(pkgsRes.data || []);
        const mem = membersRes.data || [];
        setMembersList(mem);
        try { localStorage.setItem(cacheKey('members'), JSON.stringify(mem)); } catch {}
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  // Keep the cache in step with the list, so creating, editing or deleting a
  // package is reflected the next time the page opens, not just the fetch.
  useEffect(() => {
    try { localStorage.setItem(cacheKey('packages'), JSON.stringify(packages)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages]);

  // Visitor session packages - stored in backend with isVisitor: true
  const vPkgs = packages
    .filter(p => p.isVisitor)
    .map(p => ({
      id: p.id,
      label: p.name,
      sessions: Number(p.sessions) || 1,
      pricePerSession: Number(p.sessions) > 0 ? Math.ceil(p.price / Number(p.sessions)) : p.price,
      totalPrice: p.price,
      status: p.status || (p.isActive !== false ? 'active' : 'inactive'),
    }));

  const [showVModal, setShowVModal] = useState(false);
  const [editingVPkg, setEditingVPkg] = useState(null);
  const [deleteVPkg, setDeleteVPkg] = useState(null);
  const [vForm, setVForm] = useState(emptyVisitorForm);
  const [vErrors, setVErrors] = useState({});

  const openAddV = () => { setVForm(emptyVisitorForm); setEditingVPkg(null); setVErrors({}); setShowVModal(true); };
  const openEditV = (pkg) => {
    const rawPkg = packages.find(p => p.id === pkg.id);
    setVForm({ label: pkg.label, sessions: String(pkg.sessions), pricePerSession: String(pkg.pricePerSession), durationDays: rawPkg?.durationDays ? String(rawPkg.durationDays) : '', status: pkg.status });
    setEditingVPkg(pkg); setVErrors({}); setShowVModal(true);
  };
  const validateV = () => {
    const e = {};
    if (!vForm.label.trim()) e.label = t('common.required');
    if (!vForm.sessions || Number(vForm.sessions) < 1) e.sessions = t('common.required');
    if (!vForm.pricePerSession || Number(vForm.pricePerSession) < 1) e.pricePerSession = t('common.required');
    const nameLower = vForm.label.trim().toLowerCase();
    const duplicate = packages.find(p => p.name.toLowerCase() === nameLower && p.id !== editingVPkg?.id);
    if (duplicate) e.label = t('packages.duplicateName');
    return e;
  };
  const handleSaveV = async () => {
    const e = validateV();
    if (Object.keys(e).length) { setVErrors(e); return; }
    const sessions = Number(vForm.sessions);
    const pps = Number(vForm.pricePerSession);
    const payload = {
      name: vForm.label,
      price: sessions * pps,
      sessions: String(sessions),
      isVisitor: true,
      status: vForm.status,
      durationDays: vForm.durationDays ? Number(vForm.durationDays) : undefined,
    };
    try {
      if (editingVPkg) {
        const res = await updatePackage(editingVPkg.id, payload);
        setPackages(prev => prev.map(p => p.id === editingVPkg.id ? res.data : p));
      } else {
        const res = await createPackage(payload);
        setPackages(prev => [...prev, res.data]);
      }
      setShowVModal(false);
    } catch (err) {
      const se = serverFieldError(err, t('sales.saveFailed'));
      if (se.field === 'name' || se.message.toLowerCase().includes('name')) setVErrors(e => ({ ...e, label: se.message }));
      else setVErrors(e => ({ ...e, _form: se.message }));
    }
  };

  const openAdd = () => { setForm(emptyForm); setEditingPkg(null); setErrors({}); setShowModal(true); };
  const openEdit = (pkg) => {
    const durationParts = pkg.duration ? pkg.duration.split(' ') : [];
    const existingAccess = pkg.access ? pkg.access.split(',').map(s => s.trim()).filter(Boolean) : [];
    setForm({ name: pkg.name, code: pkg.code || '', description: pkg.description || '', price: String(pkg.price), dayPassPrice: pkg.dayPassPrice != null ? String(pkg.dayPassPrice) : '', durationType: durationParts[1] || 'Days', durationValue: durationParts[0] || '', sessionLimit: pkg.sessions, accessType: existingAccess, status: pkg.status, notes: '' });
    setEditingPkg(pkg);
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name) e.name = t('common.required');
    if (!form.price) e.price = t('common.required');
    if (!form.dayPassPrice) e.dayPassPrice = t('common.required');
    const nameLower = form.name.trim().toLowerCase();
    const duplicate = packages.find(p => p.name.toLowerCase() === nameLower && p.id !== editingPkg?.id);
    if (duplicate) e.name = t('packages.duplicateName');
    return e;
  };

  // The actual write, run once a create is submitted or an edit is confirmed
  // with the manager's code.
  const doSave = async (payload, another) => {
    try {
      if (editingPkg) {
        const res = await updatePackage(editingPkg.id, payload);
        setPackages(prev => prev.map(p => p.id === editingPkg.id ? res.data : p));
      } else {
        const res = await createPackage(payload);
        setPackages(prev => [...prev, res.data]);
      }
      if (another) { setForm(emptyForm); setErrors({}); } else { setShowModal(false); }
    } catch (err) {
      const se = serverFieldError(err, t('sales.saveFailed'));
      if (se.field === 'name' || se.message.toLowerCase().includes('name')) setErrors(e => ({ ...e, name: se.message }));
      else setErrors(e => ({ ...e, _form: se.message }));
    }
  };

  const handleSave = async (another = false) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const daysMap = { Days: 1, Weeks: 7, Months: 30, Year: 365 };
    const durationDays = form.durationValue
      ? Number(form.durationValue) * (daysMap[form.durationType] || 30)
      : undefined;
    const payload = {
      name: form.name,
      code: form.code || undefined,
      description: form.description || undefined,
      price: Number(form.price),
      dayPassPrice: form.dayPassPrice !== '' ? Number(form.dayPassPrice) : undefined,
      duration: form.durationValue ? `${form.durationValue} ${form.durationType}` : undefined,
      durationDays: durationDays || undefined,
      sessions: form.sessionLimit || 'Unlimited',
      access: form.accessType.length > 0 ? form.accessType.join(', ') : undefined,
      status: form.status,
      notes: form.notes || undefined,
    };
    // Changing an existing package (its price especially) is a management
    // action, so it is held behind the manager's 4-digit code. Creating a new
    // one is not gated.
    if (editingPkg) { setPendingSave({ payload, another }); setShowEditAuth(true); }
    else { doSave(payload, another); }
  };

  const th = { padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' };
  const td = { padding: '14px 20px' };

  // ── Mobile layout ────────────────────────────────────────────────────────────
  // Drawn by both layouts: on a phone their buttons used to do nothing,
  // because only the desktop drew them (F-109). The phone had its own add
  // sheet whose "Duration (Days)" was saved as months (F-110).
  const sharedDialogs = (
    <>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingPkg ? t('packages.editPackage') : t('packages.addPackage')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.packageName')} *</label>
              <input style={{ ...inputStyle, borderColor: errors.name ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('common.eg', { x: 'Premium 12M' })} />
              {errors.name && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.code')}</label>
              <input style={inputStyle} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder={t('common.eg', { x: 'PKG-P12' })} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.description')}</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.price')} *</label>
              <input type="number" min="0" style={{ ...inputStyle, borderColor: errors.price ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              {errors.price && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.price}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.dayPassPrice')} *</label>
              <input type="number" min="0" style={{ ...inputStyle, borderColor: errors.dayPassPrice ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.dayPassPrice} onChange={e => setForm(f => ({ ...f, dayPassPrice: e.target.value }))} placeholder="0" />
              {errors.dayPassPrice && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.dayPassPrice}</div>}
            </div>
          </div>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.durationType')}</label>
              <select style={inputStyle} value={form.durationType} onChange={e => setForm(f => ({ ...f, durationType: e.target.value }))}>
                {[['Days', t('packages.durationDayOpt')],['Weeks', t('packages.durationWeekOpt')],['Months', t('packages.durationMonthOpt')],['Year', t('packages.durationYearOpt')]].map(([val,label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.durationValue')}</label>
              <input type="number" min="0" style={inputStyle} value={form.durationValue} onChange={e => setForm(f => ({ ...f, durationValue: e.target.value }))} placeholder={t('common.eg', { x: 12 })} />
            </div>
          </div>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.sessionLimit')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {form.sessionLimit === 'Unlimited' ? (
                  <div style={{ ...inputStyle, color: 'var(--text-muted)', fontStyle: 'italic', cursor: 'default', userSelect: 'none' }}>{t('packages.unlimited')}</div>
                ) : (
                  <input type="number" min="1" style={inputStyle} value={form.sessionLimit} onChange={e => setForm(f => ({ ...f, sessionLimit: e.target.value }))} placeholder={t('common.eg', { x: 20 })} />
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' }}>
                  <input
                    type="checkbox"
                    checked={form.sessionLimit === 'Unlimited'}
                    onChange={e => setForm(f => ({ ...f, sessionLimit: e.target.checked ? 'Unlimited' : '' }))}
                    style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('packages.unlimitedSessions')}</span>
                </label>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.access')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px' }}>
                {accessTypeOptions.map(opt => {
                  const checked = form.accessType.includes(opt);
                  return (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: checked ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setForm(f => ({
                          ...f,
                          accessType: checked
                            ? f.accessType.filter(a => a !== opt)
                            : [...f.accessType, opt],
                        }))}
                        style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14, flexShrink: 0 }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.status')}</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">{t('packages.active')}</option>
              <option value="inactive">{t('packages.inactive')}</option>
            </select>
          </div>
          {errors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{errors._form}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            {!editingPkg && <button style={secondaryBtn} onClick={() => handleSave(true)}>{t('tasks.saveAndAddAnother')}</button>}
            <button style={primaryBtn} onClick={() => handleSave(false)}>{editingPkg ? t('common.saveChanges') : t('packages.addPackage')}</button>
          </div>
        </div>
      </Modal>
      {/* Package Profile Modal */}
      {profilePkg && (() => {
        // Members whose membership on it is running, not everyone ever put on it
        const subscriberCount = membersList.filter(m => m.packageId === profilePkg.id && isActiveMember(m)).length;
        return (
          <Modal open={!!profilePkg} onClose={() => setProfilePkg(null)} title={t('packages.packageProfile')} maxWidth={500}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{profilePkg.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>{profilePkg.code}</div>
                </div>
                <StatusBadge status={profilePkg.status} />
              </div>
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: t('packages.price'), value: formatMoney(profilePkg.price) },
                  ...(!profilePkg.isVisitor ? [{ label: t('packages.dayPassPrice'), value: profilePkg.dayPassPrice != null ? formatMoney(profilePkg.dayPassPrice) : '-' }] : []),
                  { label: t('packages.duration'), value: durationText(profilePkg.duration, t) },
                  { label: t('packages.sessions'), value: sessionsText(profilePkg.sessions, t) },
                  { label: t('packages.accessLevel'), value: profilePkg.access },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{r.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={16} color="var(--accent-blue)" />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{subscriberCount}</strong> {t('packages.activeOnPackage')}
                </span>
              </div>
              {canPrice && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('packages.deletingRequiresManager')}</div>
                  <button onClick={() => setShowDeleteAuth(true)} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Trash2 size={13} /> {t('packages.deletePackage')}
                  </button>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      <ManagerAuthModal
        open={showEditAuth}
        onClose={() => { setShowEditAuth(false); setPendingSave(null); }}
        action={t('packages.authEdit', { name: editingPkg?.name || '' })}
        onConfirm={async () => {
          if (pendingSave) await doSave(pendingSave.payload, pendingSave.another);
          setShowEditAuth(false); setPendingSave(null);
        }}
      />

      <ManagerAuthModal
        open={showDeleteAuth}
        onClose={() => setShowDeleteAuth(false)}
        danger
        action={t('packages.authDelete', { name: profilePkg?.name || '' })}
        onConfirm={async () => {
          setDeleteError('');
          try {
            await removePackage(profilePkg.id);
            setPackages(prev => prev.filter(p => p.id !== profilePkg.id));
            setProfilePkg(null);
            setShowDeleteAuth(false);
          } catch (err) { setShowDeleteAuth(false); setDeleteError(err?.response?.data?.error || t('memberProfile.actionFailed')); }
        }}
      />

      <ConfirmModal open={!!deletePkg} onClose={() => setDeletePkg(null)}
        onConfirm={async () => {
          setDeleteError('');
          try {
            await removePackage(deletePkg.id);
            setPackages(prev => prev.filter(p => p.id !== deletePkg.id));
            setDeletePkg(null);
          } catch (err) { setDeleteError(err?.response?.data?.error || t('memberProfile.actionFailed')); }
        }}
        title={t('packages.deletePackage')} message={deletePkg ? t('packages.deletePackageConfirm', { name: deletePkg.name }) : ''} confirmLabel={t('common.delete')} />

      {/* ── Add / Edit Visitor Session Bundle Modal ── */}
      <Modal open={showVModal} onClose={() => setShowVModal(false)} title={editingVPkg ? t('packages.editBundle') : t('packages.addSessionBundle')} maxWidth={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.bundleLabel')} *</label>
            <input style={{ ...inputStyle, borderColor: vErrors.label ? 'var(--accent-red)' : 'var(--border-subtle)' }}
              value={vForm.label} onChange={e => setVForm(f => ({ ...f, label: e.target.value }))}
              placeholder={t('packages.bundleLabelPh')} autoComplete="off" />
            {vErrors.label && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.label}</div>}
          </div>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.numSessions')} *</label>
              <input type="number" min="1" style={{ ...inputStyle, borderColor: vErrors.sessions ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                value={vForm.sessions} onChange={e => setVForm(f => ({ ...f, sessions: e.target.value }))}
                placeholder={t('common.eg', { x: 10 })} autoComplete="off" />
              {vErrors.sessions && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.sessions}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.pricePerSessionField')} ({getCurrencySymbol()}) *</label>
              <input type="number" min="1" style={{ ...inputStyle, borderColor: vErrors.pricePerSession ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                value={vForm.pricePerSession} onChange={e => setVForm(f => ({ ...f, pricePerSession: e.target.value }))}
                placeholder={t('common.eg', { x: 2500 })} autoComplete="off" />
              {vErrors.pricePerSession && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.pricePerSession}</div>}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('packages.durationDays')} <span style={{ color: 'var(--text-muted)' }}>({t('packages.durationDaysHint')})</span></label>
            <input type="number" min="1" style={inputStyle}
              value={vForm.durationDays} onChange={e => setVForm(f => ({ ...f, durationDays: e.target.value }))}
              placeholder={t('common.eg', { x: 30 })} autoComplete="off" />
          </div>
          {/* Live total preview */}
          {vForm.sessions && vForm.pricePerSession && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('packages.totalPrice')}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>
                {formatMoney(Number(vForm.sessions) * Number(vForm.pricePerSession))}
              </span>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.status')}</label>
            <select style={inputStyle} value={vForm.status} onChange={e => setVForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">{t('packages.active')}</option>
              <option value="inactive">{t('packages.inactive')}</option>
            </select>
          </div>
          {vErrors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{vErrors._form}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowVModal(false)}>{t('common.cancel')}</button>
            <button style={primaryBtn} onClick={handleSaveV}>{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      <ManagerAuthModal
        open={!!deleteVPkg}
        onClose={() => setDeleteVPkg(null)}
        danger
        action={t('packages.authDeleteBundle', { name: deleteVPkg?.label || '' })}
        onConfirm={async () => {
          setDeleteError('');
          try {
            await removePackage(deleteVPkg.id);
            setPackages(prev => prev.filter(p => p.id !== deleteVPkg.id));
            setDeleteVPkg(null);
          } catch (err) { setDeleteVPkg(null); setDeleteError(err?.response?.data?.error || t('memberProfile.actionFailed')); }
        }}
      />
    </>
  );

  if (isMobile) {
    const memberPkgs = packages.filter(p => !p.isVisitor && p.status !== 'archived');
    const visitorPkgs = packages.filter(p => p.isVisitor && p.status !== 'archived');
    const shownPkgs = tab === 'member' ? memberPkgs : visitorPkgs;
    return (
      <div style={{ minHeight: '100%' }}>
        <div style={{ padding: '16px 16px 10px' }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('packages.title')}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
            {memberPkgs.length} {t('nav.members').toLowerCase()} · {visitorPkgs.length} {t('members.visitor').toLowerCase()}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 12 }}>
          {[['member', t('packages.memberPackages')], ['visitor', t('packages.visitorBundles')]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--accent-gold)' : 'transparent'}`, color: tab === key ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'DM Sans', fontWeight: tab === key ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {deleteError && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{deleteError}</div>}
          {loading ? (
            <SkeletonCards count={3} />
          ) : shownPkgs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('packages.noPackages')}</div>
          ) : shownPkgs.map(pkg => {
            const memberCount = membersList.filter(m => (m.package?.id === pkg.id || m.packageId === pkg.id) && isActiveMember(m)).length;
            return (
              <div key={pkg.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pkg.name}
                    </div>
                    {pkg.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pkg.description}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 8 }}>
                    <RowMenu title={t('common.actions')} items={[
                      { label: t('common.view'), icon: <Eye size={15} />, onClick: () => setProfilePkg(pkg) },
                      { label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => openEdit(pkg), hidden: !canPrice },
                      { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setDeletePkg(pkg), hidden: !canPrice, danger: true },
                    ]} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatMoney(pkg.price)}
                  </span>
                  {pkg.duration && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{durationText(pkg.duration, t)}</span>}
                  {pkg.sessions && pkg.sessions !== 'Unlimited' && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{pkg.sessions} {t('members.visitorSessions')}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={11} strokeWidth={2} />{memberCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {canPrice && <FAB onClick={tab === 'member' ? openAdd : () => { setVForm(emptyVisitorForm); setEditingVPkg(null); setVErrors({}); setShowVModal(true); }} label={tab === 'member' ? t('packages.addPackage') : t('packages.addBundle')} />}

        {sharedDialogs}
      </div>
    );
  }

  return (
    <div className="page-fade">
      {deleteError && <div role="alert" style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{deleteError}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('packages.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t('packages.memberPackages')} & {t('packages.visitorBundles')}</p>
        </div>
        {canPrice && (tab === 'member'
          ? <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('packages.addPackage')}</button>
          : <button style={primaryBtn} onClick={openAddV}><Plus size={13} />{t('packages.addBundle')}</button>
        )}
      </div>

      {/* Setup banner */}
      {packages.length === 0 && !loading && setup && !setup.complete && (
        <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📦</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', marginBottom: 3 }}>{t('packages.createFirstPackage')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('packages.createFirstPackageDesc')}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, marginBottom: 20, width: 'fit-content' }}>
        {[['member', t('packages.memberPackages')], ['visitor', t('packages.visitorBundles')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', fontFamily: 'DM Sans',
            background: tab === key ? 'var(--bg-card)' : 'transparent',
            color: tab === key ? 'var(--accent-gold)' : 'var(--text-muted)',
            boxShadow: tab === key ? 'var(--shadow-card)' : 'none',
            transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Member Packages Table ── */}
      {tab === 'member' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('packages.memberPackages')}{!loading && ` (${packages.filter(p => !p.isVisitor).length})`}</span>
          </div>
          <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('packages.packageName'), t('packages.code'), t('packages.duration'), t('packages.price'), t('packages.sessions'), t('packages.access'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonTableRows rows={3} cols={8} /> : packages.filter(p => !p.isVisitor).map(pkg => (
                <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={td}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.name}</div></td>
                  <td style={{ ...td, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{pkg.code}</td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{durationText(pkg.duration, t)}</td>
                  <td style={{ ...td, fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(pkg.price)}</td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{sessionsText(pkg.sessions, t)}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-secondary)' }}>{pkg.access}</td>
                  <td style={td}><StatusBadge status={pkg.status} /></td>
                  <td style={td}>
                    <RowMenu title={t('common.actions')} items={[
                      { label: t('common.view'), icon: <Eye size={15} />, onClick: () => setProfilePkg(pkg) },
                      { label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => openEdit(pkg), hidden: !canPrice },
                      { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setDeletePkg(pkg), hidden: !canPrice, danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ── Visitor Session Bundles Table ── */}
      {tab === 'visitor' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('packages.visitorBundles')}{!loading && ` (${vPkgs.length})`}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('packages.cheaperPerSession')}</span>
          </div>
          <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('packages.bundle'), t('packages.sessions'), t('packages.pricePerSessionHeader'), t('packages.totalPrice'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonTableRows rows={3} cols={6} /> : vPkgs.sort((a, b) => a.sessions - b.sessions).map(pkg => (
                <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={td}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.label}</div></td>
                  <td style={td}>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                      {t(pkg.sessions === 1 ? 'packages.nSession' : 'packages.nSessions', { n: pkg.sessions })}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{formatMoney(pkg.pricePerSession)} / session</td>
                  <td style={{ ...td, fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(pkg.totalPrice)}</td>
                  <td style={td}><StatusBadge status={pkg.status} /></td>
                  <td style={td}>
                    <RowMenu title={t('common.actions')} items={[
                      { label: t('common.view'), icon: <Eye size={15} />, onClick: () => setProfilePkg(packages.find(p => p.id === pkg.id) || pkg) },
                      { label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => openEditV(pkg), hidden: !canPrice },
                      { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setDeleteVPkg(pkg), hidden: !canPrice, danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}


      {sharedDialogs}
    </div>
  );
}
