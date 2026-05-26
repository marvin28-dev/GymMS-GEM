import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import { ACCESS_TYPES_KEY, DEFAULT_ACCESS_TYPES } from './SettingsPage';
import ConfirmModal from '../components/ui/ConfirmModal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import StatusBadge from '../components/ui/StatusBadge';
import { getAll as getPackages, create as createPackage, update as updatePackage, remove as removePackage } from '../services/packages.service';
import { getAll as getMembers } from '../services/members.service';

const formatMoney = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const emptyForm = { name: '', code: '', description: '', price: '', durationType: 'Months', durationValue: '', sessionLimit: 'Unlimited', accessType: [], status: 'active', notes: '' };
const emptyVisitorForm = { label: '', sessions: '', pricePerSession: '', durationDays: '', status: 'active' };

export default function PackagesPage() {
  const { t } = useLanguage();
  const [accessTypeOptions, setAccessTypeOptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACCESS_TYPES_KEY) || 'null') || DEFAULT_ACCESS_TYPES; } catch { return DEFAULT_ACCESS_TYPES; }
  });

  const [tab, setTab] = useState('member'); // 'member' | 'visitor'
  const [packages, setPackages] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [deletePkg, setDeletePkg] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [profilePkg, setProfilePkg] = useState(null);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);

  useEffect(() => {
    Promise.all([getPackages(), getMembers()])
      .then(([pkgsRes, membersRes]) => {
        setPackages(pkgsRes.data || []);
        setMembersList(membersRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Visitor session packages — stored in backend with isVisitor: true
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
    if (!vForm.label.trim()) e.label = 'Required';
    if (!vForm.sessions || Number(vForm.sessions) < 1) e.sessions = 'Required';
    if (!vForm.pricePerSession || Number(vForm.pricePerSession) < 1) e.pricePerSession = 'Required';
    const nameLower = vForm.label.trim().toLowerCase();
    const duplicate = packages.find(p => p.name.toLowerCase() === nameLower && p.id !== editingVPkg?.id);
    if (duplicate) e.label = 'A package with this name already exists';
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
      const msg = err.response?.data?.error;
      if (msg?.toLowerCase().includes('name')) setVErrors(e => ({ ...e, label: msg }));
      else console.error('Failed to save visitor bundle:', err);
    }
  };

  const openAdd = () => { setForm(emptyForm); setEditingPkg(null); setErrors({}); setShowModal(true); };
  const openEdit = (pkg) => {
    const durationParts = pkg.duration ? pkg.duration.split(' ') : [];
    const existingAccess = pkg.access ? pkg.access.split(',').map(s => s.trim()).filter(Boolean) : [];
    setForm({ name: pkg.name, code: pkg.code || '', description: pkg.description || '', price: String(pkg.price), durationType: durationParts[1] || 'Days', durationValue: durationParts[0] || '', sessionLimit: pkg.sessions, accessType: existingAccess, status: pkg.status, notes: '' });
    setEditingPkg(pkg);
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name) e.name = 'Required';
    if (!form.price) e.price = 'Required';
    const nameLower = form.name.trim().toLowerCase();
    const duplicate = packages.find(p => p.name.toLowerCase() === nameLower && p.id !== editingPkg?.id);
    if (duplicate) e.name = 'A package with this name already exists';
    return e;
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
      duration: form.durationValue ? `${form.durationValue} ${form.durationType}` : undefined,
      durationDays: durationDays || undefined,
      sessions: form.sessionLimit || 'Unlimited',
      access: form.accessType.length > 0 ? form.accessType.join(', ') : undefined,
      status: form.status,
      notes: form.notes || undefined,
    };
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
      const msg = err.response?.data?.error;
      if (msg?.toLowerCase().includes('name')) setErrors(e => ({ ...e, name: msg }));
      else console.error(err);
    }
  };

  const iconBtn = (hoverColor) => ({
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
    onMouseEnter: e => (e.currentTarget.style.color = hoverColor),
    onMouseLeave: e => (e.currentTarget.style.color = 'var(--text-muted)'),
  });
  const th = { padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' };
  const td = { padding: '14px 20px' };

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('packages.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t('packages.memberPackages')} & {t('packages.visitorBundles')}</p>
        </div>
        {tab === 'member'
          ? <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('packages.addPackage')}</button>
          : <button style={primaryBtn} onClick={openAddV}><Plus size={13} />{t('packages.addBundle')}</button>
        }
      </div>

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
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('packages.memberPackages')} ({packages.filter(p => !p.isVisitor).length})</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('packages.packageName'), 'Code', t('packages.duration'), t('packages.price'), t('packages.sessions'), t('packages.access'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {packages.filter(p => !p.isVisitor).map(pkg => (
                <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={td}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.name}</div></td>
                  <td style={{ ...td, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{pkg.code}</td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{pkg.duration}</td>
                  <td style={{ ...td, fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(pkg.price)}</td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{pkg.sessions}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-secondary)' }}>{pkg.access}</td>
                  <td style={td}><StatusBadge status={pkg.status} /></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => openEdit(pkg)}><Pencil size={14} /></button>
                      <button title="View Profile" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => setProfilePkg(pkg)}><Eye size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Visitor Session Bundles Table ── */}
      {tab === 'visitor' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('packages.visitorBundles')} ({vPkgs.length})</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cheaper per session as quantity increases</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {['Bundle','Sessions','Price / Session','Total Price','Status','Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vPkgs.sort((a, b) => a.sessions - b.sessions).map(pkg => (
                <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={td}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.label}</div></td>
                  <td style={td}>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                      {pkg.sessions} {pkg.sessions === 1 ? 'session' : 'sessions'}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 13, color: 'var(--text-secondary)' }}>{formatMoney(pkg.pricePerSession)} / session</td>
                  <td style={{ ...td, fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(pkg.totalPrice)}</td>
                  <td style={td}><StatusBadge status={pkg.status} /></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => openEditV(pkg)}><Pencil size={14} /></button>
                      <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} onClick={() => setDeleteVPkg(pkg)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingPkg ? t('packages.editPackage') : t('packages.addPackage')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Package Name *</label>
              <input style={{ ...inputStyle, borderColor: errors.name ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Premium 12M" />
              {errors.name && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Code</label>
              <input style={inputStyle} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. PKG-P12" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Price *</label>
            <input type="number" style={{ ...inputStyle, borderColor: errors.price ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
            {errors.price && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.price}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Duration Type</label>
              <select style={inputStyle} value={form.durationType} onChange={e => setForm(f => ({ ...f, durationType: e.target.value }))}>
                {['Days','Weeks','Months','Year'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Duration Value</label>
              <input type="number" style={inputStyle} value={form.durationValue} onChange={e => setForm(f => ({ ...f, durationValue: e.target.value }))} placeholder="e.g. 12" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Session Limit</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {form.sessionLimit === 'Unlimited' ? (
                  <div style={{ ...inputStyle, color: 'var(--text-muted)', fontStyle: 'italic', cursor: 'default', userSelect: 'none' }}>Unlimited</div>
                ) : (
                  <input type="number" min="1" style={inputStyle} value={form.sessionLimit} onChange={e => setForm(f => ({ ...f, sessionLimit: e.target.value }))} placeholder="e.g. 20" />
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' }}>
                  <input
                    type="checkbox"
                    checked={form.sessionLimit === 'Unlimited'}
                    onChange={e => setForm(f => ({ ...f, sessionLimit: e.target.checked ? 'Unlimited' : '' }))}
                    style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>Unlimited sessions</span>
                </label>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Access Type</label>
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
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            {!editingPkg && <button style={secondaryBtn} onClick={() => handleSave(true)}>{t('tasks.saveAndAddAnother')}</button>}
            <button style={primaryBtn} onClick={() => handleSave(false)}>{t('packages.addPackage')}</button>
          </div>
        </div>
      </Modal>

      {/* Package Profile Modal */}
      {profilePkg && (() => {
        const subscriberCount = membersList.filter(m => m.packageId === profilePkg.id).length;
        return (
          <Modal open={!!profilePkg} onClose={() => setProfilePkg(null)} title="Package Profile" maxWidth={500}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{profilePkg.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>{profilePkg.code}</div>
                </div>
                <StatusBadge status={profilePkg.status} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Price', value: formatMoney(profilePkg.price) },
                  { label: 'Duration', value: profilePkg.duration },
                  { label: 'Sessions', value: profilePkg.sessions },
                  { label: 'Access Level', value: profilePkg.access },
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
                  <strong style={{ color: 'var(--text-primary)' }}>{subscriberCount}</strong> active subscriber{subscriberCount !== 1 ? 's' : ''} on this package
                </span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>Deleting requires manager authorization.</div>
                <button onClick={() => setShowDeleteAuth(true)} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={13} /> Delete Package
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      <ManagerAuthModal
        open={showDeleteAuth}
        onClose={() => setShowDeleteAuth(false)}
        danger
        action={`delete package "${profilePkg?.name}"`}
        onConfirm={async () => {
          try {
            await removePackage(profilePkg.id);
            setPackages(prev => prev.filter(p => p.id !== profilePkg.id));
            setProfilePkg(null);
            setShowDeleteAuth(false);
          } catch (err) { console.error(err); }
        }}
      />

      <ConfirmModal open={!!deletePkg} onClose={() => setDeletePkg(null)}
        onConfirm={async () => {
          try {
            await removePackage(deletePkg.id);
            setPackages(prev => prev.filter(p => p.id !== deletePkg.id));
            setDeletePkg(null);
          } catch (err) { console.error(err); }
        }}
        title="Delete Package" message={`Are you sure you want to delete "${deletePkg?.name}"? This action cannot be undone.`} confirmLabel="Delete" />

      {/* ── Add / Edit Visitor Session Bundle Modal ── */}
      <Modal open={showVModal} onClose={() => setShowVModal(false)} title={editingVPkg ? 'Edit Session Bundle' : 'Add Session Bundle'} maxWidth={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Bundle Label *</label>
            <input style={{ ...inputStyle, borderColor: vErrors.label ? 'var(--accent-red)' : 'var(--border-subtle)' }}
              value={vForm.label} onChange={e => setVForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. 10 Sessions" autoComplete="off" />
            {vErrors.label && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.label}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Number of Sessions *</label>
              <input type="number" min="1" style={{ ...inputStyle, borderColor: vErrors.sessions ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                value={vForm.sessions} onChange={e => setVForm(f => ({ ...f, sessions: e.target.value }))}
                placeholder="e.g. 10" autoComplete="off" />
              {vErrors.sessions && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.sessions}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Price Per Session (FCFA) *</label>
              <input type="number" min="1" style={{ ...inputStyle, borderColor: vErrors.pricePerSession ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                value={vForm.pricePerSession} onChange={e => setVForm(f => ({ ...f, pricePerSession: e.target.value }))}
                placeholder="e.g. 2500" autoComplete="off" />
              {vErrors.pricePerSession && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{vErrors.pricePerSession}</div>}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Duration (Days) <span style={{ color: 'var(--text-muted)' }}>— how long the bundle is valid</span></label>
            <input type="number" min="1" style={inputStyle}
              value={vForm.durationDays} onChange={e => setVForm(f => ({ ...f, durationDays: e.target.value }))}
              placeholder="e.g. 30" autoComplete="off" />
          </div>
          {/* Live total preview */}
          {vForm.sessions && vForm.pricePerSession && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Price</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>
                {(Number(vForm.sessions) * Number(vForm.pricePerSession)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Status</label>
            <select style={inputStyle} value={vForm.status} onChange={e => setVForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
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
        action={`delete session bundle "${deleteVPkg?.label}"`}
        onConfirm={async () => {
          try {
            await removePackage(deleteVPkg.id);
            setPackages(prev => prev.filter(p => p.id !== deleteVPkg.id));
            setDeleteVPkg(null);
          } catch (err) { console.error(err); }
        }}
      />
    </div>
  );
}
