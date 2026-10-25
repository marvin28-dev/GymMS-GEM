import { useState, useEffect, useRef, useMemo } from 'react';
import { CloudUpload, Save, Sun, Moon, Check, Palette, Plus, Trash2, Languages, Eye, EyeOff, ChevronRight, ChevronLeft, X, RotateCcw } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLanguage } from '../contexts/LanguageContext';
import { getMyGym, updateMyGym } from '../services/gym.service';
import { uploadPhoto } from '../services/upload.service';
import { legacyList, refreshGymSettings } from '../hooks/useGymSettings';
import { getAuth, updateSessionGym } from '../utils/auth';
import { COUNTRIES, countryByName } from '../utils/countries';
import { getCurrencySymbol, CURRENCY_SYMBOLS, getCurrencyCode, formatMoney } from '../utils/currency';
import { notifyDataChanged } from '../utils/events';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import RowMenu from '../components/ui/RowMenu';
import ActivityLog from './LogsPage';
import { useSetupStatus, setSetupStatus } from '../hooks/useSetupStatus';
import { confirmSetupSection } from '../services/gym.service';
import TimeInput from '../components/ui/TimeInput';
import LoadFailed from '../components/ui/LoadFailed';
import { SkeletonLine } from '../components/Skeleton';
import { PAYMENT_METHODS } from '../utils/paymentMethods';
import { capFirst, getDateLocale } from '../utils/date';
import { DEFAULT_ACCESS_TYPES, ACCESS_TYPES_KEY } from '../utils/accessTypes';
import { store, unstore } from '../utils/storage';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
// The revert button: an icon and its label sit on one line (the plain
// secondaryBtn has no flex, which stacked the icon on top of the word).
const revertBtn = { ...secondaryBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' };
const snap = (o) => JSON.stringify(o);
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

// What a gym starts out accepting, until the owner says otherwise. Only what
// something reads is offered (D-37): tax rate, late fee and payment due days
// were saved and used nowhere.
const DEFAULT_PAYMENT_SETTINGS = {
  currency: getCurrencyCode(),
  // Every method until the gym chooses, Mobile Money included
  methods: PAYMENT_METHODS.map(m => m.key),
};
// The task reminder job reads taskOverdue; staff creation reads welcomeEmail.
// The expiry, low-stock and end-of-day switches had nothing behind them.
const DEFAULT_NOTIF_PREFS = { taskOverdue: true, welcomeEmail: true };

const SECTIONS = [
  { id: 'gym-identity' },
  { id: 'gym-profile' },
  { id: 'appearance' },
  { id: 'language' },
  { id: 'payment' },
  { id: 'membership' },
  { id: 'packages' },
  { id: 'notifications' },
  // The gym's activity log. Settings is the owner's alone, like the log itself.
  { id: 'logs' },
];

const SETUP_VISITED_KEY = 'gem_settings_visited';
// Sections that show a dot until visited/configured
const SETUP_SECTIONS = new Set(['gym-profile', 'payment', 'membership', 'packages', 'notifications']);
const REQUIRED_CONFIRMS = ['gym-profile', 'payment', 'membership', 'packages', 'notifications'];

const THEMES = [
  {
    id: 'dark',
    nameKey: 'settings.themeDark',
    descKey: 'settings.themeDarkDesc',
    bg: '#0a0a0f', card: '#16161f', text: '#f0ede6', accent: '#c9a96e',
    dots: ['#4ade80', '#60a5fa', '#f87171'],
  },
  {
    id: 'light',
    nameKey: 'settings.themeLight',
    descKey: 'settings.themeLightDesc',
    bg: '#eae6dd', card: '#fbfaf7', text: '#1f1b14', accent: '#8a6a24',
    dots: ['#15803d', '#1d4ed8', '#b91c1c'],
  },
];

function ThemeCard({ theme, selected, onSelect }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 0, background: 'none', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
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
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t(theme.nameKey)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t(theme.descKey)}</div>
        </div>
        {selected && (
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={11} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!value} aria-label={label} onClick={() => onChange(!value)} style={{ padding: 0, width: 40, height: 22, borderRadius: 11, background: value ? 'var(--accent-gold)' : 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 19 : 2, width: 16, height: 16, borderRadius: '50%', background: value ? '#0a0a0f' : 'var(--text-muted)', transition: 'left 0.2s' }} />
    </button>
  );
}

function Label({ children }) {
  return <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{children}</label>;
}

export default function SettingsPage() {
  const { lang, switchLang, t } = useLanguage();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get('section');
    return SECTIONS.some(s => s.id === asked) ? asked : 'gym-profile';
  });
  // Only the two themes remain. A browser still holding one of the old ones
  // falls back rather than rendering with no palette at all.
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('gem-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, []);

  const applyTheme = (id) => {
    setCurrentTheme(id);
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('gem-theme', id);
  };

  // ── My Account ───────────────────────────────────────────────────────────────
  const [gymCode, setGymCode] = useState('');
  const [showGymCode, setShowGymCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showAccountAuth, setShowAccountAuth] = useState(false);

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const defaultSchedule = () => Object.fromEntries(DAYS.map(d => [d, { open: !['Sat','Sun'].includes(d), slots: [{ from: '06:00', to: '22:00' }] }]));

  const [gymProfile, setGymProfile] = useState({
    name: '', email: '', phone: '', altPhone: '', address: '',
    city: '', province: '', country: '', postal: '', website: '',
    description: '', facebook: '', instagram: '', twitter: '', notes: '',
  });
  const [gymSchedule, setGymSchedule] = useState(defaultSchedule);
  const [gymSaving, setGymSaving] = useState(false);
  const [gymSaved, setGymSaved] = useState(false);
  // A refused save says why beside its Save button (F-120)
  const [gymSaveError, setGymSaveError] = useState('');
  const [regFeeSaveError, setRegFeeSaveError] = useState('');
  // The last-saved profile, so an edit can be reverted field-for-field.
  const [pristineGym, setPristineGym] = useState(null);
  const GYM_KEYS = ['name', 'email', 'phone', 'altPhone', 'address', 'city', 'province', 'country', 'postal', 'website', 'facebook', 'instagram', 'twitter'];
  const gymDirty = pristineGym != null && (GYM_KEYS.some(k => (gymProfile[k] || '') !== (pristineGym[k] || ''))
    || JSON.stringify(gymSchedule) !== pristineGym.schedule);
  const revertGym = () => {
    if (!pristineGym) return;
    const { schedule, ...fields } = pristineGym;
    setGymProfile(g => ({ ...g, ...fields }));
    setGymSchedule(JSON.parse(schedule));
  };
  const snapshotGym = () => setPristineGym({ ...Object.fromEntries(GYM_KEYS.map(k => [k, gymProfile[k] || ''])), schedule: JSON.stringify(gymSchedule) });
  // Every section with a Save button gets the same revert-on-edit treatment:
  // a JSON snapshot of the last-saved values, a dirty check, and a one-click
  // restore. Save stays disabled until something actually changed.
  const [pristinePayment, setPristinePayment] = useState(null);
  const [pristineRegFee, setPristineRegFee]   = useState(null);
  const [pristineNotif, setPristineNotif]     = useState(null);
  // The country on the record, so picking a different one can warn that the
  // gym's money is about to change with it
  const [savedCountry, setSavedCountry] = useState('');
  const LOGO_KEY = 'gem_gym_logo';
  const [logoPreview, setLogoPreview] = useState(() => localStorage.getItem('gem_gym_logo') || null);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef(null);

  // localStorage caps out around 5MB, so a full-size photo stored as a base64
  // data URI silently fails to write. Downscale to a thumbnail first.
  const shrinkLogo = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('settings.logoReadFailed')));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error(t('settings.logoNotImage')));
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // PNG keeps transparency, which real logos usually need - but it bloats
        // photographic images, so fall back to JPEG when the PNG comes out large.
        const png = canvas.toDataURL('image/png');
        if (png.length <= 200_000) return resolve(png);

        const flat = document.createElement('canvas');
        flat.width = canvas.width;
        flat.height = canvas.height;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(canvas, 0, 0);
        resolve(flat.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // The shrunk logo as a file to upload
  const logoFile = (dataUrl) => {
    const [head, body] = dataUrl.split(',');
    const type = /^data:([^;,]+)/.exec(head)?.[1] || 'image/png';
    const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
    return new File([bytes], type === 'image/png' ? 'logo.png' : 'logo.jpg', { type });
  };

  const handleLogoFile = async (file) => {
    setLogoError('');
    let dataUrl;
    try { dataUrl = await shrinkLogo(file); } catch (err) { setLogoError(err.message); return; }
    const before = logoPreview;
    setLogoPreview(dataUrl);
    try {
      // Filed with the photos, and the gym record keeps its address: the record
      // is read on every page load and by the public sign-in page (F-128)
      const url = await uploadPhoto(logoFile(dataUrl), 'gem/logos');
      await updateMyGym({ logo: url });
      store(LOGO_KEY, url);
    } catch (err) {
      // Not saved, so the logo the gym really has stays on screen
      setLogoPreview(before);
      setLogoError(err?.response?.status === 413 ? t('settings.logoTooLarge') : (err?.response?.data?.error || t('settings.logoSaveFailed')));
    }
  };

  const removeLogo = async () => {
    setLogoError('');
    const before = logoPreview;
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
    try {
      await updateMyGym({ logo: null });
      unstore(LOGO_KEY);
    } catch {
      // Still on the gym record, so it stays on screen
      setLogoPreview(before);
      setLogoError(t('settings.logoRemoveFailed'));
    }
  };


  const saveGymProfile = async () => {
    setGymSaving(true);
    setGymSaveError('');
    try {
      const res = await updateMyGym({
        name: gymProfile.name,
        email: gymProfile.email,
        phone: gymProfile.phone,
        location: gymProfile.address,
        altPhone: gymProfile.altPhone,
        city: gymProfile.city,
        province: gymProfile.province,
        country: gymProfile.country,
        postal: gymProfile.postal,
        website: gymProfile.website,
        facebook: gymProfile.facebook,
        instagram: gymProfile.instagram,
        twitter: gymProfile.twitter,
        schedule: gymSchedule,
      });
      // Moving the gym moves its currency, phone format and address examples.
      // The session carries them, so it has to hear about it straight away.
      updateSessionGym(res.data);
      setSavedCountry(res.data?.country || '');
      setPaymentSettings(p => ({ ...p, currency: res.data?.currency || p.currency }));
      notifyDataChanged();
      markConfirmed('gym-profile');
      snapshotGym();
      setGymSaved(true);
      setTimeout(() => setGymSaved(false), 2500);
    } catch (err) { setGymSaveError(err?.response?.data?.error || t('settings.saveFailed')); }
    setGymSaving(false);
  };

  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIF_PREFS);
  const [regFeeSettings, setRegFeeSettings] = useState({
    required: false, amount: 0, frequency: 'yearly', gracePeriod: 7,
  });
  // Freeze fee: charged every N days a membership stays frozen.
  const [freezeFee, setFreezeFee] = useState({ fee: 0, intervalDays: 30 });
  const setFF = (k, v) => setFreezeFee(s => ({ ...s, [k]: v }));
  const [regFeeSaving, setRegFeeSaving] = useState(false);
  const [regFeeSaved, setRegFeeSaved] = useState(false);
  const setRegFee = (k, v) => setRegFeeSettings(s => ({ ...s, [k]: v }));
  const saveRegFee = async () => {
    setRegFeeSaving(true);
    setRegFeeSaveError('');
    try {
      await updateMyGym({
        registrationFeeRequired: regFeeSettings.required,
        registrationFee: Number(regFeeSettings.amount),
        registrationFeeFrequency: regFeeSettings.frequency,
        registrationGracePeriodDays: Number(regFeeSettings.gracePeriod),
        settings: { freeze: { fee: Number(freezeFee.fee) || 0, intervalDays: Number(freezeFee.intervalDays) || 0 } },
      });
      notifyDataChanged();
      markConfirmed('membership');
      snapshotRegFee();
      setRegFeeSaved(true);
      setTimeout(() => setRegFeeSaved(false), 2500);
    } catch (err) { setRegFeeSaveError(err?.response?.data?.error || t('settings.saveFailed')); }
    setRegFeeSaving(false);
  };

  const [paymentSettings, setPaymentSettings] = useState(DEFAULT_PAYMENT_SETTINGS);
  const [expenseLimitInput, setExpenseLimitInput] = useState('50000');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const setPS = (k, v) => setPaymentSettings(p => ({ ...p, [k]: v }));
  // At least one way to take money has to stay switched on
  const toggleMethod = (m) => setPaymentSettings(p => {
    const on = p.methods.includes(m);
    if (on && p.methods.length === 1) return p;
    return { ...p, methods: on ? p.methods.filter(x => x !== m) : [...p.methods, m] };
  });
  const savePaymentSettings = async () => {
    setPaymentSaving(true);
    setPaymentError('');
    try {
      const limitVal = parseFloat(expenseLimitInput);
      const res = await updateMyGym({
        currency: paymentSettings.currency,
        settings: {
          payment: { methods: paymentSettings.methods },
          expenseLimit: limitVal > 0 ? limitVal : undefined,
        },
      });
      // The currency may have just changed, so the session carries the new one
      updateSessionGym(res.data);
      notifyDataChanged();
      markConfirmed('payment');
      snapshotPayment();
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 2500);
    } catch (err) {
      setPaymentError(err.response?.data?.error || t('settings.saveFailed'));
    }
    setPaymentSaving(false);
  };

  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState('');

  const saveNotifPrefs = async () => {
    setNotifSaving(true);
    setNotifError('');
    try {
      await updateMyGym({ settings: { notifications: notifPrefs } });
      notifyDataChanged();
      markConfirmed('notifications');
      snapshotNotif();
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
    } catch (err) {
      setNotifError(err.response?.data?.error || t('settings.saveFailed'));
    }
    setNotifSaving(false);
  };

  // Per-section revert-on-edit (payment / registration fee / notifications).
  const paymentCurrent = snap({ settings: paymentSettings, expenseLimit: expenseLimitInput });
  const paymentDirty   = pristinePayment != null && paymentCurrent !== pristinePayment;
  const revertPayment  = () => { if (!pristinePayment) return; const p = JSON.parse(pristinePayment); setPaymentSettings(p.settings); setExpenseLimitInput(p.expenseLimit); setPaymentError(''); };
  const snapshotPayment = () => setPristinePayment(snap({ settings: paymentSettings, expenseLimit: expenseLimitInput }));

  // The membership-defaults section owns both the auto-renew toggle and the
  // registration-fee fields, so the dirty check must cover both or Save/Revert
  // never light up when only auto-renew changes.
  const regFeeDirty    = pristineRegFee != null && snap({ fee: regFeeSettings, freeze: freezeFee }) !== pristineRegFee;
  const revertRegFee   = () => { if (pristineRegFee) { const p = JSON.parse(pristineRegFee); setRegFeeSettings(p.fee); if (p.freeze) setFreezeFee(p.freeze); } };
  const snapshotRegFee = () => setPristineRegFee(snap({ fee: regFeeSettings, freeze: freezeFee }));

  const notifDirty     = pristineNotif != null && snap(notifPrefs) !== pristineNotif;
  const revertNotif    = () => { if (pristineNotif) setNotifPrefs(JSON.parse(pristineNotif)); setNotifError(''); };
  const snapshotNotif  = () => setPristineNotif(snap(notifPrefs));

  // A gym that could not be loaded says so: the forms stay empty and nothing
  // can be saved until it has (each Save compares against what was loaded)
  const [gymLoadFailed, setGymLoadFailed] = useState(false);
  // Kept on the gym, so every account and computer reads one list (F-127)
  const [accessTypes, setAccessTypes] = useState(() => legacyList(ACCESS_TYPES_KEY) || DEFAULT_ACCESS_TYPES);
  const [gymLoadTick, setGymLoadTick] = useState(0);
  useEffect(() => {
    // Only the latest load fills the form: an earlier answer arriving late
    // would wipe what was typed since (in development React runs this twice)
    let alive = true;
    getMyGym()
      .then(res => {
        const g = res.data;
        if (!g || !alive) return;
        setGymLoadFailed(false);
        if (Array.isArray(g.settings?.accessTypes)) setAccessTypes(g.settings.accessTypes);
        setGymCode(g.code || '');
        // The gym record is the source of truth for the whole profile
        setLogoPreview(g.logo || null);
        if (g.logo) store(LOGO_KEY, g.logo);
        else unstore(LOGO_KEY);
        const loaded = {
          name: g.name || '',
          email: g.email || '',
          phone: g.phone || '',
          address: g.location || '',
          altPhone: g.altPhone || '',
          city: g.city || '',
          province: g.province || '',
          country: g.country || '',
          postal: g.postal || '',
          website: g.website || '',
          facebook: g.facebook || '',
          instagram: g.instagram || '',
          twitter: g.twitter || '',
        };
        setGymProfile(prev => ({ ...prev, ...loaded }));
        const loadedSchedule = g.schedule || defaultSchedule();
        setGymSchedule(loadedSchedule);
        setPristineGym({ ...loaded, schedule: JSON.stringify(loadedSchedule) });
        setSavedCountry(g.country || '');
        // Payment and notification settings live on the gym, so every employee
        // on every device reads the same ones
        const s = g.settings || {};
        const loadedPayment = {
          currency: g.currency || DEFAULT_PAYMENT_SETTINGS.currency,
          methods: (s.payment?.methods?.length ? s.payment.methods : DEFAULT_PAYMENT_SETTINGS.methods),
        };
        const loadedNotif = Object.fromEntries(Object.entries(DEFAULT_NOTIF_PREFS).map(([k, on]) => [k, s.notifications?.[k] ?? on]));
        const loadedExpenseLimit = s.expenseLimit > 0 ? String(s.expenseLimit) : '50000';
        const loadedRegFee = {
          required: g.registrationFeeRequired ?? false,
          amount: g.registrationFee ?? 0,
          frequency: g.registrationFeeFrequency || 'yearly',
          gracePeriod: g.registrationGracePeriodDays ?? 7,
        };
        setPaymentSettings(loadedPayment);
        setNotifPrefs(loadedNotif);
        setExpenseLimitInput(loadedExpenseLimit);
        setRegFeeSettings(loadedRegFee);
        const loadedFreeze = { fee: Number(s.freeze?.fee) || 0, intervalDays: Number(s.freeze?.intervalDays) || 30 };
        setFreezeFee(loadedFreeze);
        setPristinePayment(snap({ settings: loadedPayment, expenseLimit: loadedExpenseLimit }));
        setPristineNotif(snap(loadedNotif));
        setPristineRegFee(snap({ fee: loadedRegFee, freeze: loadedFreeze }));
      })
      .catch(() => { if (alive) setGymLoadFailed(true); });
    return () => { alive = false; };
  }, [gymLoadTick]);
  // Until the gym has loaded, these sections would show defaults that look real
  // and can be changed, and the load would then replace what was changed
  const sectionLoading = !pristineGym && !gymLoadFailed;
  const LOADS_FROM_GYM = ['gym-profile', 'payment', 'membership', 'notifications'];

  const gymLoadProblem = gymLoadFailed
    ? <LoadFailed message={t('settings.loadFailed')} onRetry={() => setGymLoadTick(n => n + 1)} style={{ marginBottom: 16 }} />
    : null;

  const [newAccessType, setNewAccessType] = useState('');
  const [accessTypesError, setAccessTypesError] = useState('');
  const saveAccessTypes = async (types) => {
    const before = accessTypes;
    setAccessTypes(types);
    setAccessTypesError('');
    try {
      await updateMyGym({ settings: { accessTypes: types } });
      refreshGymSettings();
    } catch (err) {
      setAccessTypes(before);
      setAccessTypesError(err?.response?.data?.error || t('settings.saveFailed'));
    }
  };
  const addAccessType = () => {
    const val = newAccessType.trim();
    if (!val || accessTypes.includes(val)) return;
    saveAccessTypes([...accessTypes, val]);
    setNewAccessType('');
  };
  const removeAccessType = (type) => saveAccessTypes(accessTypes.filter(t => t !== type));


  // ── Setup indicators ─────────────────────────────────────────────────────────
  const [visitedSections, setVisitedSections] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SETUP_VISITED_KEY) || '[]')); }
    catch { return new Set(); }
  });

  // Which sections the owner has confirmed. Held on the server, so a section
  // confirmed on one device shows as done on every other.
  const setup = useSetupStatus();
  const setupOpen = !!setup && !setup.complete;
  const confirmedSections = useMemo(() => new Set(setup?.confirmedSections || []), [setup]);

  // Which section is mid-save, and which just saved - so a confirm/reconfirm
  // button visibly reacts even when the section was already confirmed and the
  // returned status is unchanged (which read as the button doing nothing).
  const [confirmingSection, setConfirmingSection] = useState(null);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const markConfirmed = (id) => {
    if (confirmingSection) return;
    setConfirmingSection(id);
    confirmSetupSection(id)
      .then(res => { setSetupStatus(res.data); setJustConfirmed(id); setTimeout(() => setJustConfirmed(c => (c === id ? null : c)), 2000); })
      .catch(() => {})
      .finally(() => setConfirmingSection(c => (c === id ? null : c)));
  };

  const markVisited = (id) => {
    if (!SETUP_SECTIONS.has(id) || visitedSections.has(id)) return;
    const next = new Set(visitedSections);
    next.add(id);
    setVisitedSections(next);
    localStorage.setItem(SETUP_VISITED_KEY, JSON.stringify([...next]));
  };

  const handleSectionClick = (id) => {
    setActiveSection(id);
    markVisited(id);
    // A section opens at its top. On a phone the Log replaces the page, so
    // the page starts from the top; on a computer only if scrolled past it.
    if (isMobile) {
      if (id === 'logs') window.scrollTo({ top: 0 });
    } else {
      // Clear of the app's fixed top bar (64px) with a little room to spare
      const CLEAR = 80;
      const layout = document.querySelector('.gem-settings-layout');
      const top = layout ? layout.getBoundingClientRect().top : CLEAR;
      if (top < CLEAR) window.scrollTo({ top: window.scrollY + top - CLEAR });
    }
  };

  const incompleteMap = useMemo(() => {
    if (!setupOpen) return {};
    return {
      'gym-profile':   !confirmedSections.has('gym-profile'),
      'payment':       !confirmedSections.has('payment'),
      'membership':    !confirmedSections.has('membership'),
      'packages':      !confirmedSections.has('packages'),
      'notifications': !confirmedSections.has('notifications'),
    };
  }, [confirmedSections, setupOpen]);

  const sectionLabels = {
    'gym-identity': t('settings.gymIdentity'),
    'gym-profile': t('settings.gymProfile'),
    appearance: t('settings.appearance'),
    language: t('settings.language'),
    payment: t('settings.paymentSettings'),
    membership: t('settings.membershipDefaults'),
    packages: t('settings.packageSettings'),
    notifications: t('settings.notificationPreferences'),
    logs: t('settings.activityLog'),
  };

  const navItemStyle = (active) => ({
    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'transparent',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  });

  // The log is long, so on a phone it opens on a screen of its own with a way
  // back, rather than underneath the whole list of sections
  if (isMobile && activeSection === 'logs') {
    return (
      <div style={{ padding: '16px 16px 0' }}>
        <button type="button" onClick={() => { setActiveSection(''); window.scrollTo({ top: 0 }); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: '4px 0', marginBottom: 12, cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans' }}>
          <ChevronLeft size={16} /> {t('settings.title')}
        </button>
        <ActivityLog />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('settings.title')}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'DM Sans' }}>{t('settings.settingsSubtitle')}</p>
        </div>
        {gymLoadProblem}

        {/* Section list - tap to open */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map(sec => {
            const isOpen = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => { handleSectionClick(sec.id); if (isOpen) setActiveSection(''); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: isOpen ? 'var(--accent-gold-dim)' : 'var(--bg-card)', border: `1px solid ${isOpen ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, borderRadius: 12, cursor: 'pointer', color: isOpen ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans', fontSize: 14, fontWeight: isOpen ? 600 : 400, textAlign: 'left', width: '100%' }}
              >
                {sectionLabels[sec.id]}
                <ChevronRight size={16} strokeWidth={2} color={isOpen ? 'var(--accent-gold)' : 'var(--text-muted)'} />
              </button>
            );
          })}
        </div>

        {/* Active section content rendered below the list */}
        {activeSection && (
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent-gold)', marginBottom: 10, fontFamily: 'DM Sans' }}>
              {sectionLabels[activeSection]}
            </div>
            {/* Render the same content panels as desktop */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 }}>
              <div style={{ padding: 16 }}>
                {(() => {
                  const sec = activeSection;
                  if (sec === 'appearance') return (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 14 }}>{t('settings.chooseThemeMobile')}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {THEMES.map(th => (
                          <button key={th.id} onClick={() => applyTheme(th.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `2px solid ${currentTheme === th.id ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: currentTheme === th.id ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: th.bg, border: '2px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: currentTheme === th.id ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t(th.nameKey)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t(th.descKey)}</div>
                            </div>
                            {currentTheme === th.id && <Check size={14} color="var(--accent-gold)" strokeWidth={2.5} style={{ marginLeft: 'auto' }} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                  if (sec === 'language') return (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 14 }}>{t('settings.interfaceLanguage')}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[['en', 'English'], ['fr', 'Français']].map(([code, label]) => (
                          <button key={code} onClick={() => switchLang(code)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `2px solid ${lang === code ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: lang === code ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', cursor: 'pointer', fontSize: 13, fontWeight: lang === code ? 600 : 400, color: lang === code ? 'var(--accent-gold)' : 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                  return <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('settings.openOnDesktop', { section: sectionLabels[sec] || sec })}</p>;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('settings.title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t('settings.manageSubtitle')}</p>
      </div>
      {gymLoadProblem}

      {setupOpen && (() => {
        const confirmedCount = REQUIRED_CONFIRMS.filter(s => confirmedSections.has(s)).length;
        const totalCount = REQUIRED_CONFIRMS.length;
        const allConfirmed = confirmedCount === totalCount;
        const pct = Math.round((confirmedCount / totalCount) * 100);
        return (
          <div style={{ background: allConfirmed ? 'rgba(52,211,153,0.08)' : 'rgba(201,169,110,0.07)', border: `1px solid ${allConfirmed ? 'rgba(52,211,153,0.3)' : 'rgba(201,169,110,0.3)'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: allConfirmed ? '#34d399' : 'var(--accent-gold)', fontFamily: 'Manrope, sans-serif' }}>
                {allConfirmed ? `✓ ${t('settings.allSettingsConfirmed')}` : t('settings.finishSetup')}
              </div>
              <span style={{ fontSize: 12, color: allConfirmed ? '#34d399' : 'var(--accent-gold)', fontWeight: 600 }}>{t('settings.settingsConfirmedCount', { done: confirmedCount, total: totalCount })}</span>
            </div>
            {!allConfirmed && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
                  {t('settings.setupBannerDesc')}
                </p>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', borderRadius: 6, transition: 'width 0.4s ease' }} />
                </div>
              </>
            )}
          </div>
        );
      })()}

      <div className="gem-settings-layout" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Side nav */}
        <div className="gem-settings-nav" style={{ ...cardStyle, width: 220, flexShrink: 0, padding: 8 }}>
          {SECTIONS.map(s => {
            const incomplete = incompleteMap[s.id];
            return (
              <button key={s.id} style={navItemStyle(activeSection === s.id)} onClick={() => handleSectionClick(s.id)}>
                <span>{sectionLabels[s.id]}</span>
                {incomplete && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-gold)',
                    animation: 'gem-dot-pulse 1.8s ease-in-out infinite',
                    boxShadow: '0 0 0 0 rgba(201,169,110,0.6)',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>

          {LOADS_FROM_GYM.includes(activeSection) && sectionLoading && (
            <div data-settings-loading style={{ ...cardStyle, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['40%', '70%', '55%', '65%', '35%'].map((w, i) => <SkeletonLine key={i} width={w} height={14} style={{ animationDelay: `${i * 60}ms` }} />)}
            </div>
          )}

          {/* ── Gym Identity ──────────────────────────────────────────────── */}
          {activeSection === 'gym-identity' && (() => {
            const authUser = getAuth()?.user || {};
            const displayCode = gymCode || authUser.gymCode || '-';
            const displayName = gymProfile.name || authUser.gymName || '-';
            return (
              <div style={cardStyle}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.gymIdentity')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.gymIdentityDesc')}</div>
                </div>
                <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>

                  {/* Gym Name */}
                  <div>
                    <Label>{t('settings.gymNameLabel')}</Label>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.2px' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontFamily: 'DM Sans' }}>{t('settings.gymNameHint')}</div>
                  </div>

                  {/* Gym Code */}
                  <div>
                    <Label>{t('settings.gymCodeLabel')}</Label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ background: 'var(--bg-elevated)', border: `1px solid ${showGymCode ? 'rgba(201,169,110,0.4)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '12px 16px', flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', color: showGymCode ? 'var(--accent-gold)' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                        {showGymCode ? displayCode : '•'.repeat(displayCode.length || 8)}
                      </div>
                      {showGymCode && (
                        <button
                          onClick={async () => {
                            // "Copied" only when it was: a refused or missing clipboard says so
                            let copied = false;
                            try { if (navigator.clipboard) { await navigator.clipboard.writeText(displayCode); copied = true; } } catch { copied = false; }
                            setCodeCopied(copied ? true : 'failed');
                            setTimeout(() => setCodeCopied(false), 1600);
                          }}
                          style={{
                            ...secondaryBtn, flexShrink: 0, padding: '0 16px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            minWidth: 96, transition: 'all 0.18s',
                            color: codeCopied === 'failed' ? 'var(--accent-red)' : codeCopied ? '#22c55e' : 'var(--text-primary)',
                            borderColor: codeCopied === 'failed' ? 'rgba(248,113,113,0.45)' : codeCopied ? 'rgba(34,197,94,0.45)' : 'var(--border)',
                            background: codeCopied === 'failed' ? 'var(--accent-red-dim)' : codeCopied ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)',
                          }}
                        >
                          {codeCopied === 'failed'
                            ? t('settings.copyFailed')
                            : codeCopied
                              ? <><Check size={14} strokeWidth={3} /> {t('settings.copied')}</>
                              : t('settings.copy')}
                        </button>
                      )}
                      <button
                        onClick={() => { if (showGymCode) { setShowGymCode(false); return; } setShowAccountAuth(true); }}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '0 16px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'DM Sans', fontWeight: 600, flexShrink: 0 }}
                      >
                        {showGymCode ? <><EyeOff size={14} /> {t('settings.hide')}</> : <><Eye size={14} /> {t('settings.reveal')}</>}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontFamily: 'DM Sans' }}>
                      {showGymCode ? t('settings.gymCodeHintVisible') : t('settings.gymCodeHintHidden')}
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ── Gym Profile ────────────────────────────────────────────────── */}
          {activeSection === 'gym-profile' && !sectionLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!confirmedSections.has('gym-profile') && setupOpen && (
                <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🏢</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', marginBottom: 3 }}>{t('settings.completeProfileTitle')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {t('settings.completeProfileDesc')}
                    </div>
                  </div>
                </div>
              )}
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.gymProfile')}</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { label: t('settings.fieldGymName'), key: 'name' }, { label: t('settings.fieldEmail'), key: 'email' },
                    { label: t('settings.fieldPhone'), key: 'phone' }, { label: t('settings.fieldAltPhone'), key: 'altPhone' },
                    { label: t('settings.fieldAddress'), key: 'address' },
                    { label: t('settings.fieldProvince'), key: 'province' },
                    { label: t('settings.fieldPostal'), key: 'postal' }, { label: t('settings.fieldWebsite'), key: 'website' },
                  ].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input
                        type={f.key === 'email' ? 'email' : 'text'}
                        inputMode={['phone', 'altPhone'].includes(f.key) ? 'tel' : undefined}
                        style={inputStyle}
                        value={gymProfile[f.key]}
                        onChange={e => setGymProfile(g => ({
                          ...g,
                          [f.key]: ['phone', 'altPhone'].includes(f.key)
                            ? e.target.value.replace(/[^\d\s+\-()]/g, '')
                            : e.target.value,
                        }))}
                      />
                    </div>
                  ))}
                  {/* The country decides the currency, the phone format and the
                      address the forms suggest, so it is picked, never typed. */}
                  <div>
                    <Label>{t('settings.fieldCountry')}</Label>
                    <select
                      style={inputStyle}
                      value={gymProfile.country}
                      onChange={e => setGymProfile(g => ({ ...g, country: e.target.value, city: '' }))}
                    >
                      <option value="">{t('settings.choose')}</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                    </select>
                    {gymProfile.country !== savedCountry && countryByName(gymProfile.country) && (
                      <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginTop: 5 }}>
                        {t('settings.countryChangeHint', { currency: countryByName(gymProfile.country).currency })}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>{t('settings.fieldCity')}</Label>
                    <select
                      style={inputStyle}
                      value={gymProfile.city}
                      onChange={e => setGymProfile(g => ({ ...g, city: e.target.value }))}
                      disabled={!countryByName(gymProfile.country)}
                    >
                      <option value="">{countryByName(gymProfile.country) ? t('settings.choose') : t('settings.chooseCountryFirst')}</option>
                      {(countryByName(gymProfile.country)?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
                      {/* a city already on the record that is not in the list stays selectable */}
                      {gymProfile.city && !(countryByName(gymProfile.country)?.cities || []).includes(gymProfile.city) && (
                        <option value={gymProfile.city}>{gymProfile.city}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>{t('settings.openingHours')}</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {DAYS.map(day => {
                      const dayData = gymSchedule[day];
                      const updateSlot = (i, field, val) => setGymSchedule(s => ({
                        ...s,
                        [day]: { ...s[day], slots: s[day].slots.map((sl, idx) => idx === i ? { ...sl, [field]: val } : sl) },
                      }));
                      const addSlot = () => setGymSchedule(s => ({
                        ...s,
                        [day]: { ...s[day], slots: [...s[day].slots, { from: '12:00', to: '18:00' }] },
                      }));
                      const removeSlot = (i) => setGymSchedule(s => ({
                        ...s,
                        [day]: { ...s[day], slots: s[day].slots.filter((_, idx) => idx !== i) },
                      }));
                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, width: 52, cursor: 'pointer', flexShrink: 0, paddingTop: 7 }}>
                            <input
                              type="checkbox"
                              checked={dayData.open}
                              onChange={e => setGymSchedule(s => ({ ...s, [day]: { ...s[day], open: e.target.checked } }))}
                              style={{ width: 14, height: 14, accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: dayData.open ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'DM Sans' }}>{capFirst(new Date(2024, 0, 1 + DAYS.indexOf(day)).toLocaleDateString(getDateLocale(), { weekday: 'short' }))}</span>
                          </label>
                          {dayData.open ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {dayData.slots.map((slot, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <TimeInput value={slot.from} onChange={e => updateSlot(i, 'from', e.target.value)} style={{ ...inputStyle, width: 112, padding: '5px 8px', fontSize: 12 }} />
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.timeTo')}</span>
                                  <TimeInput value={slot.to} onChange={e => updateSlot(i, 'to', e.target.value)} style={{ ...inputStyle, width: 112, padding: '5px 8px', fontSize: 12 }} />
                                  {dayData.slots.length > 1 && (
                                    <button onClick={() => removeSlot(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4, fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>×</button>
                                  )}
                                  {i === dayData.slots.length - 1 && dayData.slots.length < 3 && (
                                    <button onClick={addSlot} title={t('settings.addTimeSlot')} style={{ background: 'var(--accent-gold-dim)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>+</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'DM Sans', paddingTop: 7 }}>{t('settings.closed')}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>{t('settings.logoLabel')}</Label>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0];
                    // Clear the value so picking the same file again still fires onChange
                    e.target.value = '';
                    if (file) handleLogoFile(file);
                  }} />
                  <div style={{ position: 'relative', border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => logoInputRef.current?.click()}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    {logoPreview ? (
                      <>
                        <button type="button" title={t('settings.removeLogo')} aria-label={t('settings.removeLogo')}
                          onClick={e => { e.stopPropagation(); removeLogo(); }}
                          style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, padding: 0, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                          <X size={13} />
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <img src={logoPreview} alt={t('settings.gymLogo')} style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', borderRadius: 8 }} />
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('settings.clickToChangeLogo')}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <CloudUpload size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('settings.clickToUploadLogo')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('settings.logoHint')}</div>
                      </>
                    )}
                  </div>
                  {logoError && (
                    <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{logoError}</div>
                  )}
                </div>
                <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {[{ label: 'Facebook', key: 'facebook' }, { label: 'Instagram', key: 'instagram' }, { label: 'Twitter', key: 'twitter' }].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input style={inputStyle} value={gymProfile[f.key]} onChange={e => setGymProfile(g => ({ ...g, [f.key]: e.target.value }))} placeholder={`@handle`} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 8 }}>
                  {gymSaveError && <span role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', marginRight: 'auto', fontFamily: 'DM Sans' }}>{gymSaveError}</span>}
                  {gymSaved && (
                    <span style={{ fontSize: 12, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ {t('settings.savedSuccessfully')}
                    </span>
                  )}
                  {gymDirty && <button style={revertBtn} onClick={revertGym}><RotateCcw size={13} /> {t('settings.revertChanges')}</button>}
                  <button style={primaryBtn} onClick={saveGymProfile} disabled={gymSaving || !gymDirty}><Save size={13} />{gymSaving ? t('common.saving') : t('common.saveChanges')}</button>
                </div>
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
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.colorTheme')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t('settings.colorThemeDesc')}</div>
                  </div>
                </div>
                <div style={{ padding: 24 }}>
                  <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {THEMES.map(t => (
                      <ThemeCard key={t.id} theme={t} selected={currentTheme === t.id} onSelect={() => applyTheme(t.id)} />
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {t('settings.currentlyUsing', { name: THEMES.find(th => th.id === currentTheme)?.name })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick dark/light toggle card */}
              <div style={cardStyle}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.quickToggle')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t('settings.quickToggleDesc')}</div>
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
                        {currentTheme === 'light' ? t('settings.lightModeActive') : t('settings.darkModeActive')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {currentTheme === 'light' ? t('settings.switchToDark') : t('settings.switchToLight')}
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
              <div className="gem-two-col" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                  {t('settings.currentLangHint')}
                </span>
              </div>
            </div>
          )}

          {activeSection === 'payment' && !sectionLoading && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.paymentSettings')}</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <Label>{t('settings.currency')}</Label>
                    <select style={inputStyle} value={paymentSettings.currency} onChange={e => setPS('currency', e.target.value)}>
                      {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                        <option key={code} value={code}>{code} - {symbol}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>{t('settings.acceptedMethods')}</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      ['Cash', t('settings.methodCash')],
                      ['Credit/Debit Card', t('settings.methodCard')],
                      ['Bank Transfer', t('settings.methodTransfer')],
                      ['Mobile Money', t('settings.methodMobile')],
                    ].map(([val, label]) => (
                      <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={paymentSettings.methods.includes(val)} onChange={() => toggleMethod(val)} style={{ width: 16, height: 16, accentColor: 'var(--accent-gold)' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t('settings.expenseLimit', { currency: getCurrencySymbol() })}</Label>
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={expenseLimitInput}
                    onChange={e => setExpenseLimitInput(e.target.value)}
                    placeholder={t('common.eg', { x: 50000 })}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                    {t('settings.expenseLimitHint')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {paymentSaved && <span style={{ fontSize: 12, color: '#22c55e', fontFamily: 'DM Sans' }}>✓ {t('settings.saved')}</span>}
                  {paymentError && <span style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{paymentError}</span>}
                  {paymentDirty && <button style={revertBtn} onClick={revertPayment}><RotateCcw size={13} /> {t('settings.revertChanges')}</button>}
                  <button style={{ ...primaryBtn, opacity: (paymentSaving || (!paymentDirty && !setupOpen)) ? 0.6 : 1 }} onClick={savePaymentSettings} disabled={paymentSaving || (!paymentDirty && !setupOpen)}>
                    <Save size={13} />{paymentSaving ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'membership' && !sectionLoading && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.membershipDefaults')}</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* ── Registration Fee ── */}
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.registrationFeeTitle')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.registrationFeeDesc')}</div>
                    </div>
                    <Toggle label={t('settings.registrationFeeTitle')} value={regFeeSettings.required} onChange={v => setRegFee('required', v)} />
                  </div>
                  {regFeeSettings.required && (
                    <div className="gem-two-col" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <Label>{t('common.amount')} ({getCurrencySymbol()})</Label>
                        <input type="number" style={inputStyle} value={regFeeSettings.amount} onChange={e => setRegFee('amount', e.target.value)} />
                      </div>
                      <div>
                        <Label>{t('settings.frequencyLabel')}</Label>
                        <select style={inputStyle} value={regFeeSettings.frequency} onChange={e => setRegFee('frequency', e.target.value)}>
                          <option value="yearly">{t('settings.frequencyYearly')}</option>
                          <option value="one-time">{t('settings.frequencyOneTime')}</option>
                        </select>
                      </div>
                      {regFeeSettings.frequency === 'yearly' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <Label>{t('settings.gracePeriodSuspension')}</Label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="number" style={{ ...inputStyle, width: 100 }} value={regFeeSettings.gracePeriod} onChange={e => setRegFee('gracePeriod', e.target.value)} min={0} max={90} />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {t('settings.gracePeriodMemberHint', { days: regFeeSettings.gracePeriod })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Freeze fee */}
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.freezeFeeTitle')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.freezeFeeDesc')}</div>
                  </div>
                  <div className="gem-two-col" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <Label>{t('settings.freezeFeeAmount')} ({getCurrencySymbol()})</Label>
                      <input type="text" inputMode="numeric" style={inputStyle} value={freezeFee.fee} onChange={e => setFF('fee', e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
                    </div>
                    <div>
                      <Label>{t('settings.freezeFeeInterval')}</Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="text" inputMode="numeric" style={{ ...inputStyle, width: 100 }} value={freezeFee.intervalDays} onChange={e => setFF('intervalDays', e.target.value.replace(/[^\d]/g, ''))} placeholder="30" />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('settings.freezeFeeIntervalHint')}</span>
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
                      {Number(freezeFee.fee) > 0
                        ? t('settings.freezeFeeSummary', { amount: formatMoney(Number(freezeFee.fee)), days: freezeFee.intervalDays || 0 })
                        : t('settings.freezeFeeOff')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {regFeeSaveError && <span role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', marginRight: 'auto', fontFamily: 'DM Sans' }}>{regFeeSaveError}</span>}
                  {regFeeSaved && (
                    <span style={{ fontSize: 12, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ {t('settings.savedSuccessfully')}
                    </span>
                  )}
                  {regFeeDirty && <button style={revertBtn} onClick={revertRegFee}><RotateCcw size={13} /> {t('settings.revertChanges')}</button>}
                  <button style={{ ...primaryBtn, opacity: (regFeeSaving || (!regFeeDirty && !setupOpen)) ? 0.6 : 1 }} onClick={saveRegFee} disabled={regFeeSaving || (!regFeeDirty && !setupOpen)}>
                    <Save size={13} />{regFeeSaving ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && !sectionLoading && (
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.notificationPreferences')}</span>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { key: 'taskOverdue', label: t('settings.notifTaskLabel'), desc: t('settings.notifTaskDesc') },
                  { key: 'welcomeEmail', label: t('settings.notifWelcomeLabel'), desc: t('settings.notifWelcomeDesc') },
                ].map((p, i, all) => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 0', borderBottom: i < all.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                    <Toggle label={p.label} value={notifPrefs[p.key]} onChange={v => setNotifPrefs(n => ({ ...n, [p.key]: v }))} />
                  </div>
                ))}
                <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                  {notifSaved && <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> {t('settings.saved')}</span>}
                  {notifError && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>{notifError}</span>}
                  {setupOpen && confirmedSections.has('notifications') && !notifSaved && <span style={{ fontSize: 12, color: '#34d399' }}>✓ {t('settings.saved')}</span>}
                  {notifDirty && <button style={revertBtn} onClick={revertNotif}><RotateCcw size={13} /> {t('settings.revertChanges')}</button>}
                  <button style={{ ...primaryBtn, opacity: (notifSaving || (!notifDirty && !setupOpen)) ? 0.6 : 1 }} onClick={saveNotifPrefs} disabled={notifSaving || (!notifDirty && !setupOpen)}>
                    <Save size={13} />{notifSaving ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'packages' && (
            <>
            <div style={cardStyle}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings.packageSettings')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('settings.packageSettingsDesc')}</div>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <Label>{t('settings.accessTypes')}</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {accessTypes.map(type => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{type}</span>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => removeAccessType(type), danger: true },
                        ]} />
                      </div>
                    ))}
                    {accessTypes.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', padding: '12px 0', textAlign: 'center' }}>
                        {t('settings.noAccessTypes')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={newAccessType}
                      onChange={e => setNewAccessType(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addAccessType()}
                      placeholder={t('settings.accessTypePlaceholder')}
                    />
                    <button style={primaryBtn} onClick={addAccessType}><Plus size={13} />{t('common.add')}</button>
                  </div>
                  {accessTypesError && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{accessTypesError}</div>}
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    {t('settings.accessTypesHint')}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
              {justConfirmed === 'packages'
                ? <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> {t('common.saved')}</span>
                : setupOpen && confirmedSections.has('packages') && <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> {t('settings.packageSettingsConfirmed')}</span>}
              <button style={{ ...primaryBtn, opacity: confirmingSection === 'packages' ? 0.6 : 1 }} disabled={confirmingSection === 'packages'} onClick={() => markConfirmed('packages')}>
                <Save size={13} /> {confirmingSection === 'packages' ? t('common.saving') : !setupOpen ? t('common.saveChanges') : confirmedSections.has('packages') ? t('settings.reconfirm') : t('settings.confirmPackageSettings')}
              </button>
            </div>
            </>
          )}

          {activeSection === 'logs' && <ActivityLog />}

        </div>
      </div>

      <ManagerAuthModal
        open={showAccountAuth}
        onClose={() => setShowAccountAuth(false)}
        action={t('settings.revealGymCode')}
        onConfirm={() => {
          setShowAccountAuth(false);
          setShowGymCode(true);
          setTimeout(() => setShowGymCode(false), 30000);
        }}
      />
    </div>
  );
}
