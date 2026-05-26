import { useState, useEffect, useRef } from 'react';
import { CloudUpload, Save, Sun, Moon, Check, Palette, Plus, Trash2, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getMyGym, updateMyGym } from '../services/gym.service';
import { ROLE_PROFILES as initialRoleProfiles, ALL_PAGES } from '../data/mockData';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const SECTIONS = [
  { id: 'gym-profile', label: 'Gym Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'language', label: 'Language' },
  { id: 'payment', label: 'Payment Settings' },
  { id: 'membership', label: 'Membership Defaults' },
  { id: 'packages', label: 'Package Settings' },
  { id: 'expenses', label: 'Expense Management' },
  { id: 'notifications', label: 'Notification Preferences' },
  { id: 'roles', label: 'Staff Roles' },
  { id: 'security', label: 'Security' },
];

export const DEFAULT_ACCESS_TYPES = ['Full Access', 'Gym Only', 'Classes Only', 'Full Access + Classes', 'Pool Access', 'Premium (All-Inclusive)'];
export const ACCESS_TYPES_KEY = 'gem_access_types';

const THEMES = [
  {
    id: 'dark',
    name: 'Obsidian',
    desc: 'Sleek dark — easy on the eyes',
    bg: '#0a0a0f', card: '#16161f', text: '#f0ede6', accent: '#c9a96e',
    dots: ['#4ade80', '#60a5fa', '#f87171'],
  },
  {
    id: 'light',
    name: 'Ivory',
    desc: 'Clean light mode for bright spaces',
    bg: '#f2f2f7', card: '#ffffff', text: '#0a0a1a', accent: '#b08a40',
    dots: ['#16a34a', '#2563eb', '#dc2626'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Deep navy — focused and calm',
    bg: '#060a18', card: '#0d1630', text: '#dce8ff', accent: '#e0b860',
    dots: ['#34d399', '#818cf8', '#fb7185'],
  },
  {
    id: 'forest',
    name: 'Forest',
    desc: 'Dark green — natural and grounded',
    bg: '#060d08', card: '#0e1810', text: '#dcf0e0', accent: '#c8a84a',
    dots: ['#4ade80', '#60a5fa', '#f87171'],
  },
];

function ThemeCard({ theme, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 14,
        border: selected ? `2px solid ${theme.accent}` : '2px solid var(--border-subtle)',
        overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 0 0 3px ${theme.accent}28` : hovered ? '0 4px 16px rgba(0,0,0,0.25)' : 'none',
        transform: hovered && !selected ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Mini UI preview */}
      <div style={{ background: theme.bg, height: 88, padding: 10, position: 'relative', overflow: 'hidden' }}>
        {/* Fake sidebar strip */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: theme.card, borderRight: `1px solid ${theme.accent}22` }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent, margin: '8px auto 0' }} />
          {[28, 42, 56].map(t => (
            <div key={t} style={{ position: 'absolute', top: t, left: 3, right: 3, height: 5, background: theme.text, opacity: 0.15, borderRadius: 2 }} />
          ))}
        </div>
        {/* Fake content */}
        <div style={{ marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[40, 30, 50].map((w, i) => (
              <div key={i} style={{ height: 18, width: w, background: theme.card, borderRadius: 5, opacity: 0.9 }} />
            ))}
          </div>
          <div style={{ height: 28, background: theme.card, borderRadius: 6, opacity: 0.8, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4 }}>
            <div style={{ width: 16, height: 4, background: theme.accent, borderRadius: 2 }} />
            <div style={{ width: 30, height: 4, background: theme.text, opacity: 0.4, borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
            {theme.dots.map((d, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: d }} />
            ))}
          </div>
        </div>
      </div>
      {/* Label */}
      <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{theme.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{theme.desc}</div>
        </div>
        {selected && (
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={11} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? 'var(--accent-gold)' : 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: value ? '#0a0a0f' : 'var(--text-muted)', transition: 'left 0.2s' }} />
    </div>
  );
}

function Label({ children }) {
  return <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{children}</label>;
}

export default function SettingsPage() {
  const { lang, switchLang, t } = useLanguage();
  const [activeSection, setActiveSection] = useState('gym-profile');
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('gem-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, []);

  const applyTheme = (id) => {
    setCurrentTheme(id);
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('gem-theme', id);
  };

  const [gymProfile, setGymProfile] = useState({
    name: '', email: '', phone: '', altPhone: '', address: '',
    city: '', province: '', country: '', postal: '', website: '',
    description: '', opening: '06:00', closing: '22:00',
    facebook: '', instagram: '', twitter: '', notes: '',
  });
  const [gymSaving, setGymSaving] = useState(false);
  const [gymSaved, setGymSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(() => localStorage.getItem('gem_gym_logo') || null);
  const logoInputRef = useRef(null);

  const GYM_EXTRA_KEY = 'gem_gym_extra';
  const loadExtraFields = () => { try { return JSON.parse(localStorage.getItem(GYM_EXTRA_KEY) || '{}'); } catch { return {}; } };
  const saveExtraFields = (profile) => {
    const { altPhone, city, province, country, postal, website, description, opening, closing, facebook, instagram, twitter, notes } = profile;
    localStorage.setItem(GYM_EXTRA_KEY, JSON.stringify({ altPhone, city, province, country, postal, website, description, opening, closing, facebook, instagram, twitter, notes }));
  };

  useEffect(() => {
    getMyGym()
      .then(res => {
        const g = res.data;
        if (!g) return;
        const extra = loadExtraFields();
        setGymProfile(prev => ({
          ...prev,
          name: g.name || '',
          email: g.email || '',
          phone: g.phone || '',
          address: g.location || '',
          ...extra,
        }));
        setRegFeeSettings({
          required: g.registrationFeeRequired ?? false,
          amount: g.registrationFee ?? 0,
          frequency: g.registrationFeeFrequency || 'yearly',
          gracePeriod: g.registrationGracePeriodDays ?? 7,
        });
      })
      .catch(console.error);
  }, []);

  const saveGymProfile = async () => {
    setGymSaving(true);
    try {
      await updateMyGym({
        name: gymProfile.name,
        email: gymProfile.email,
        phone: gymProfile.phone,
        location: gymProfile.address,
      });
      saveExtraFields(gymProfile);
      setGymSaved(true);
      setTimeout(() => setGymSaved(false), 2500);
    } catch (err) { console.error(err); }
    setGymSaving(false);
  };

  const [notifPrefs, setNotifPrefs] = useState({
    expiryReminders: true, lowStockAlerts: true, taskOverdue: true, eodSummary: false, welcomeEmail: true,
  });
  const [password, setPassword] = useState({ current: '', newPw: '', confirm: '' });
  const [twoFactor, setTwoFactor] = useState(false);
  const [regFeeSettings, setRegFeeSettings] = useState({
    required: false, amount: 0, frequency: 'yearly', gracePeriod: 7,
  });
  const [regFeeSaving, setRegFeeSaving] = useState(false);
  const [regFeeSaved, setRegFeeSaved] = useState(false);
  const setRegFee = (k, v) => setRegFeeSettings(s => ({ ...s, [k]: v }));
  const saveRegFee = async () => {
    setRegFeeSaving(true);
    try {
      await updateMyGym({
        registrationFeeRequired: regFeeSettings.required,
        registrationFee: Number(regFeeSettings.amount),
        registrationFeeFrequency: regFeeSettings.frequency,
        registrationGracePeriodDays: Number(regFeeSettings.gracePeriod),
      });
      setRegFeeSaved(true);
      setTimeout(() => setRegFeeSaved(false), 2500);
    } catch (err) { console.error(err); }
    setRegFeeSaving(false);
  };

  const [expenseLimit, setExpenseLimit] = useState(() => parseFloat(localStorage.getItem('gem_expense_limit') || '50000'));
  const [expenseLimitInput, setExpenseLimitInput] = useState(() => localStorage.getItem('gem_expense_limit') || '50000');
  const [expenseLimitSaved, setExpenseLimitSaved] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState('all');
  const [expenses, setExpenses] = useState(() => { try { return JSON.parse(localStorage.getItem('gem_expenses') || '[]'); } catch { return []; } });

  const saveExpenseLimit = () => {
    const val = parseFloat(expenseLimitInput);
    if (!val || val <= 0) return;
    localStorage.setItem('gem_expense_limit', String(val));
    setExpenseLimit(val);
    setExpenseLimitSaved(true);
    setTimeout(() => setExpenseLimitSaved(false), 2000);
  };

  const updateExpenseStatus = (id, status) => {
    const updated = expenses.map(e => e.id === id ? { ...e, status } : e);
    setExpenses(updated);
    localStorage.setItem('gem_expenses', JSON.stringify(updated));
  };

  const fmtMoney = (n) => 'XAF ' + Number(n).toLocaleString('fr-CM');

  const [accessTypes, setAccessTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACCESS_TYPES_KEY) || 'null') || DEFAULT_ACCESS_TYPES; } catch { return DEFAULT_ACCESS_TYPES; }
  });
  const [newAccessType, setNewAccessType] = useState('');
  const saveAccessTypes = (types) => {
    setAccessTypes(types);
    localStorage.setItem(ACCESS_TYPES_KEY, JSON.stringify(types));
  };
  const addAccessType = () => {
    const val = newAccessType.trim();
    if (!val || accessTypes.includes(val)) return;
    saveAccessTypes([...accessTypes, val]);
    setNewAccessType('');
  };
  const removeAccessType = (type) => saveAccessTypes(accessTypes.filter(t => t !== type));

  const [roleProfiles, setRoleProfiles] = useState(initialRoleProfiles.map(r => ({ ...r })));
  const [selectedRoleId, setSelectedRoleId] = useState(initialRoleProfiles[0]?.id || '');
  const [newRoleName, setNewRoleName] = useState('');

  const selectedRole = roleProfiles.find(r => r.id === selectedRoleId);
  const togglePage = (roleId, page) => {
    setRoleProfiles(prev => prev.map(r => r.id === roleId ? { ...r, pages: r.pages.includes(page) ? r.pages.filter(p => p !== page) : [...r.pages, page] } : r));
  };
  const addRoleProfile = () => {
    if (!newRoleName.trim()) return;
    const id = newRoleName.toLowerCase().replace(/\s+/g,'_');
    setRoleProfiles(prev => [...prev, { id, name: newRoleName.trim(), color: '#a78bfa', pages: ['dashboard'] }]);
    setSelectedRoleId(id);
    setNewRoleName('');
  };
  const deleteRoleProfile = (id) => {
    setRoleProfiles(prev => prev.filter(r => r.id !== id));
    setSelectedRoleId(roleProfiles[0]?.id || '');
  };

  const PAGE_LABELS = { dashboard:'Dashboard', members:'Members', attendance:'Attendance', calendar:'Calendar', 'front-desk':'Front Desk', tasks:'Tasks', sales:'Sales & Products', operations:'Operations', payments:'Payments', accounting:'Reports', packages:'Packages', communication:'Communication', staff:'Staff', settings:'Settings' };

  const navItemStyle = (active) => ({
    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'transparent',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400, textAlign: 'left', width: '100%', display: 'block',
  });

  return (
    <div className="page-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Manage your gym profile and system preferences</p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Side nav */}
        <div style={{ ...cardStyle, width: 220, flexShrink: 0, padding: 8 }}>
          {SECTIONS.map(s => {
            const labelMap = {
              'gym-profile': t('settings.gymProfile'), appearance: t('settings.appearance'),
              language: t('settings.language'), payment: t('settings.paymentSettings'),
              membership: t('settings.membershipDefaults'), packages: t('settings.packageSettings'),
              expenses: t('settings.expenseManagement'), notifications: t('settings.notificationPreferences'),
              roles: t('settings.staffRoles'), security: t('settings.security'),
            };
            return (
              <button key={s.id} style={navItemStyle(activeSection === s.id)} onClick={() => setActiveSection(s.id)}>
                {labelMap[s.id] || s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {activeSection === 'gym-profile' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Gym Profile</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Gym Name *', key: 'name' }, { label: 'Email *', key: 'email' },
                    { label: 'Phone *', key: 'phone' }, { label: 'Alt Phone', key: 'altPhone' },
                    { label: 'Address', key: 'address' }, { label: 'City', key: 'city' },
                    { label: 'Province', key: 'province' }, { label: 'Country', key: 'country' },
                    { label: 'Postal Code', key: 'postal' }, { label: 'Website', key: 'website' },
                    { label: 'Opening Time', key: 'opening', type: 'time' }, { label: 'Closing Time', key: 'closing', type: 'time' },
                  ].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input type={f.type || 'text'} style={inputStyle} value={gymProfile[f.key]} onChange={e => setGymProfile(g => ({ ...g, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={gymProfile.description} onChange={e => setGymProfile(g => ({ ...g, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Logo</Label>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      setLogoPreview(ev.target.result);
                      localStorage.setItem('gem_gym_logo', ev.target.result);
                    };
                    reader.readAsDataURL(file);
                  }} />
                  <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => logoInputRef.current?.click()}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    {logoPreview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <img src={logoPreview} alt="Gym logo" style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', borderRadius: 8 }} />
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click to change logo</div>
                      </div>
                    ) : (
                      <>
                        <CloudUpload size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click to upload logo</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG up to 2MB</div>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {[{ label: 'Facebook', key: 'facebook' }, { label: 'Instagram', key: 'instagram' }, { label: 'Twitter', key: 'twitter' }].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input style={inputStyle} value={gymProfile[f.key]} onChange={e => setGymProfile(g => ({ ...g, [f.key]: e.target.value }))} placeholder={`@handle`} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                  {gymSaved && (
                    <span style={{ fontSize: 12, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ Saved successfully
                    </span>
                  )}
                  <button style={secondaryBtn}>Cancel</button>
                  <button style={primaryBtn} onClick={saveGymProfile} disabled={gymSaving}><Save size={13} />{gymSaving ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Theme picker card */}
              <div style={cardStyle}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={15} color="var(--accent-gold)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Color Theme</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Choose a look and feel for the interface</div>
                  </div>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {THEMES.map(t => (
                      <ThemeCard key={t.id} theme={t} selected={currentTheme === t.id} onSelect={() => applyTheme(t.id)} />
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Currently using <strong style={{ color: 'var(--text-primary)' }}>{THEMES.find(t => t.id === currentTheme)?.name}</strong> — changes apply instantly and are saved automatically.
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick dark/light toggle card */}
              <div style={cardStyle}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Quick Toggle</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Instantly switch between dark and light mode</div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: currentTheme === 'light' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s' }}>
                      {currentTheme === 'light'
                        ? <Sun size={18} color="#d97706" />
                        : <Moon size={18} color="var(--accent-blue)" />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {currentTheme === 'light' ? 'Light Mode Active' : 'Dark Mode Active'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {currentTheme === 'light' ? 'Switch to a dark theme' : 'Switch to a light theme'}
                      </div>
                    </div>
                  </div>
                  {/* Animated sun/moon pill toggle */}
                  <div
                    onClick={() => applyTheme(currentTheme === 'light' ? 'dark' : 'light')}
                    style={{
                      width: 68, height: 34, borderRadius: 17, cursor: 'pointer', position: 'relative',
                      background: currentTheme === 'light'
                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                        : 'linear-gradient(135deg, #1e2a50, #3b4a6b)',
                      transition: 'background 0.35s',
                      boxShadow: currentTheme === 'light' ? '0 0 12px rgba(251,191,36,0.4)' : '0 0 12px rgba(60,80,150,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: 4,
                      left: currentTheme === 'light' ? 38 : 4,
                      transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    }}>
                      {currentTheme === 'light'
                        ? <Sun size={13} color="#f59e0b" strokeWidth={2.5} />
                        : <Moon size={13} color="#6278a8" strokeWidth={2.5} />
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'language' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(129,140,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Languages size={15} color="#818cf8" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.chooseLanguage')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t('settings.languageDesc')}</div>
                </div>
              </div>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { code: 'en', flag: '🇬🇧', name: t('settings.english'), desc: t('settings.englishDesc') },
                  { code: 'fr', flag: '🇫🇷', name: t('settings.french'),  desc: t('settings.frenchDesc')  },
                ].map(option => {
                  const selected = lang === option.code;
                  return (
                    <div
                      key={option.code}
                      onClick={() => switchLang(option.code)}
                      style={{
                        border: `2px solid ${selected ? '#818cf8' : 'var(--border-subtle)'}`,
                        borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
                        background: selected ? 'rgba(129,140,248,0.06)' : 'var(--bg-elevated)',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14,
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{option.flag}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? '#818cf8' : 'var(--text-primary)' }}>{option.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{option.desc}</div>
                      </div>
                      {selected && (
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {lang === 'fr'
                    ? 'Langue actuelle : Français — les changements s\'appliquent instantanément.'
                    : 'Current language: English — changes apply instantly across the entire system.'}
                </span>
              </div>
            </div>
          )}

          {activeSection === 'payment' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Payment Settings</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><Label>Currency</Label><select style={inputStyle}><option>FCFA (XAF)</option><option>EUR</option><option>USD</option></select></div>
                  <div><Label>Tax Rate (%)</Label><input type="number" style={inputStyle} defaultValue="15" /></div>
                  <div><Label>Late Fee (%)</Label><input type="number" style={inputStyle} defaultValue="5" /></div>
                  <div><Label>Payment Due Days</Label><input type="number" style={inputStyle} defaultValue="30" /></div>
                </div>
                <div>
                  <Label>Accepted Payment Methods</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {['Cash', 'Credit/Debit Card', 'Bank Transfer'].map(m => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={primaryBtn}><Save size={13} />Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'membership' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Membership Defaults</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><Label>Default Package</Label><select style={inputStyle}><option>Basic Monthly</option><option>Standard 6M</option><option>Premium 12M</option></select></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><Label>Grace Period (days)</Label><input type="number" style={inputStyle} defaultValue="3" /></div>
                  <div><Label>Max Freeze Days / Year</Label><input type="number" style={inputStyle} defaultValue="60" /></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Auto-Renew by Default</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Automatically renew memberships upon expiry</div>
                  </div>
                  <Toggle value={true} onChange={() => {}} />
                </div>

                {/* ── Registration Fee ── */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Registration Fee</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Charged once per member at the time of enrolment. For yearly frequency it renews on the member's anniversary date.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Require Registration Fee</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>If off, no registration fee will be charged during enrolment</div>
                    </div>
                    <Toggle value={regFeeSettings.required} onChange={v => setRegFee('required', v)} />
                  </div>
                  {regFeeSettings.required && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <Label>Amount (FCFA)</Label>
                        <input type="number" style={inputStyle} value={regFeeSettings.amount} onChange={e => setRegFee('amount', e.target.value)} />
                      </div>
                      <div>
                        <Label>Frequency</Label>
                        <select style={inputStyle} value={regFeeSettings.frequency} onChange={e => setRegFee('frequency', e.target.value)}>
                          <option value="yearly">Yearly (renews annually)</option>
                          <option value="one-time">One-time (never repeats)</option>
                        </select>
                      </div>
                      {regFeeSettings.frequency === 'yearly' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <Label>Grace Period (days before suspension)</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="number" style={{ ...inputStyle, width: 100 }} value={regFeeSettings.gracePeriod} onChange={e => setRegFee('gracePeriod', e.target.value)} min={0} max={90} />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Members get {regFeeSettings.gracePeriod} day{regFeeSettings.gracePeriod !== 1 ? 's' : ''} after their reg fee renewal date before their account is suspended.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {regFeeSaved && (
                    <span style={{ fontSize: 12, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ Saved successfully
                    </span>
                  )}
                  <button style={primaryBtn} onClick={saveRegFee} disabled={regFeeSaving}>
                    <Save size={13} />{regFeeSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notification Preferences</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { key: 'expiryReminders', label: 'Membership expiry reminders', desc: 'Notify 7 days before expiry' },
                  { key: 'lowStockAlerts', label: 'Low stock alerts', desc: 'Alert when product is below reorder level' },
                  { key: 'taskOverdue', label: 'Task overdue alerts', desc: 'Notify when a task passes its due date' },
                  { key: 'eodSummary', label: 'Daily EOD summary email', desc: 'Receive end-of-day report by email' },
                  { key: 'welcomeEmail', label: 'New member welcome email', desc: 'Auto-send welcome email on registration' },
                ].map((p, i) => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                    <Toggle value={notifPrefs[p.key]} onChange={v => setNotifPrefs(n => ({ ...n, [p.key]: v }))} />
                  </div>
                ))}
                <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={primaryBtn}><Save size={13} />Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'roles' && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Role list */}
              <div style={{ ...cardStyle, width: 220, flexShrink: 0 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Role Profiles</div>
                <div style={{ padding: 8 }}>
                  {roleProfiles.map(r => (
                    <button key={r.id} onClick={() => setSelectedRoleId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: selectedRoleId === r.id ? 'var(--accent-gold-dim)' : 'transparent', color: selectedRoleId === r.id ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: selectedRoleId === r.id ? 600 : 400, fontSize: 13, fontFamily: 'DM Sans', textAlign: 'left' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }}/>
                      {r.name}
                    </button>
                  ))}
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', gap: 6 }}>
                    <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoleProfile()} placeholder="New role..." style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}/>
                    <button onClick={addRoleProfile} style={{ ...primaryBtn, padding: '6px 10px', flexShrink: 0 }}><Plus size={13}/></button>
                  </div>
                </div>
              </div>

              {/* Permissions editor */}
              {selectedRole && (
                <div style={{ ...cardStyle, flex: 1 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{selectedRole.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{selectedRole.pages.length} of {ALL_PAGES.length} pages accessible</div>
                    </div>
                    {!['general_manager','manager'].includes(selectedRole.id) && (
                      <button onClick={() => deleteRoleProfile(selectedRole.id)} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Trash2 size={12}/> Delete Role
                      </button>
                    )}
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginBottom: 14 }}>Toggle which pages staff with this profile can access:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {ALL_PAGES.map(page => {
                        const allowed = selectedRole.pages.includes(page);
                        return (
                          <label key={page} onClick={() => !['general_manager','manager'].includes(selectedRole.id) && togglePage(selectedRole.id, page)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, border: `1px solid ${allowed ? 'rgba(201,169,110,0.35)' : 'var(--border-subtle)'}`, background: allowed ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', cursor: ['general_manager','manager'].includes(selectedRole.id) ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${allowed ? 'var(--accent-gold)' : 'var(--border)'}`, background: allowed ? 'var(--accent-gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {allowed && <Check size={10} color="#0a0a0f" strokeWidth={3}/>}
                            </div>
                            <span style={{ fontSize: 13, color: allowed ? 'var(--accent-gold)' : 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: allowed ? 600 : 400 }}>{PAGE_LABELS[page] || page}</span>
                          </label>
                        );
                      })}
                    </div>
                    {['general_manager','manager'].includes(selectedRole.id) && (
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8 }}>
                        Manager and General Manager roles always have full access and cannot be restricted.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'packages' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Package Settings</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Define the access types that can be assigned to membership packages.</div>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <Label>Access Types</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {accessTypes.map(type => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{type}</span>
                        <button onClick={() => removeAccessType(type)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {accessTypes.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', padding: '12px 0', textAlign: 'center' }}>
                        No access types yet. Add one below.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={newAccessType}
                      onChange={e => setNewAccessType(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addAccessType()}
                      placeholder="e.g. Cardio Zone Only"
                    />
                    <button style={primaryBtn} onClick={addAccessType}><Plus size={13} />Add</button>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    These appear as options in the Access Type dropdown when creating or editing packages.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'expenses' && (() => {
            const statusColors = { pending: { bg:'rgba(251,191,36,0.1)', color:'#f59e0b', label:'Pending' }, approved: { bg:'rgba(52,211,153,0.1)', color:'#34d399', label:'Approved' }, rejected: { bg:'rgba(239,68,68,0.1)', color:'#ef4444', label:'Rejected' } };
            const filtered = expenseFilter === 'all' ? expenses : expenses.filter(e => e.status === expenseFilter);
            const totalAmt = filtered.reduce((s,e)=>s+e.amount,0);
            return (
              <div style={cardStyle}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expense Management</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: 'DM Sans' }}>Set the front desk expense limit and review submitted expenses.</p>
                </div>

                {/* Expense limit setting */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Quick Expense Limit</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', fontFamily: 'DM Sans' }}>Front desk staff can log expenses up to this amount without prior approval. Anything above will be flagged for your review.</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 360 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Limit (XAF)</label>
                      <input type="number" min="0" style={inputStyle} value={expenseLimitInput} onChange={e => setExpenseLimitInput(e.target.value)} placeholder="e.g. 50000"/>
                    </div>
                    <button style={primaryBtn} onClick={saveExpenseLimit}>
                      {expenseLimitSaved ? <><Check size={13}/> Saved</> : <><Save size={13}/> Save</>}
                    </button>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    Current limit: <strong style={{ color: 'var(--accent-gold)' }}>XAF {expenseLimit.toLocaleString('fr-CM')}</strong>
                  </div>
                </div>

                {/* Expense review */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Expense Review</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['all','All'], ['pending','Pending'], ['approved','Approved'], ['rejected','Rejected']].map(([v,l]) => (
                        <button key={v} onClick={() => setExpenseFilter(v)} style={{ background: expenseFilter===v ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: expenseFilter===v ? '#0a0a0f' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>{l}</button>
                      ))}
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>No expenses found.</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filtered.map(e => {
                          const sc = statusColors[e.status] || statusColors.pending;
                          return (
                            <div key={e.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{e.description}</span>
                                  {e.exceedsLimit && <span style={{ fontSize: 10, background: 'rgba(248,113,113,0.12)', color: '#f87171', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Over Limit</span>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', display: 'flex', gap: 10 }}>
                                  <span>{e.category}</span>
                                  <span>·</span>
                                  <span>{e.paymentMethod}</span>
                                  <span>·</span>
                                  <span>{e.submittedBy}</span>
                                  <span>·</span>
                                  <span>{e.time}</span>
                                </div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Manrope', flexShrink: 0 }}>{fmtMoney(e.amount)}</div>
                              <div style={{ background: sc.bg, color: sc.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 72, textAlign: 'center' }}>{sc.label}</div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                {e.status !== 'approved' && (
                                  <button onClick={() => updateExpenseStatus(e.id, 'approved')} style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>Approve</button>
                                )}
                                {e.status !== 'rejected' && (
                                  <button onClick={() => updateExpenseStatus(e.id, 'rejected')} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>Reject</button>
                                )}
                                {e.status !== 'pending' && (
                                  <button onClick={() => updateExpenseStatus(e.id, 'pending')} style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans' }}>Reset</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>
                        Total shown: <span style={{ color: 'var(--accent-gold)', marginLeft: 8 }}>{fmtMoney(totalAmt)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {activeSection === 'security' && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Security</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Change Password</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><Label>Current Password</Label><input type="password" style={inputStyle} value={password.current} onChange={e => setPassword(p => ({ ...p, current: e.target.value }))} /></div>
                    <div><Label>New Password</Label><input type="password" style={inputStyle} value={password.newPw} onChange={e => setPassword(p => ({ ...p, newPw: e.target.value }))} /></div>
                    <div><Label>Confirm New Password</Label><input type="password" style={inputStyle} value={password.confirm} onChange={e => setPassword(p => ({ ...p, confirm: e.target.value }))} /></div>
                  </div>
                  <button style={{ ...primaryBtn, marginTop: 12 }}>Change Password</button>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Two-Factor Authentication</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Add an extra layer of security to your account</div>
                    </div>
                    <Toggle value={twoFactor} onChange={setTwoFactor} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
