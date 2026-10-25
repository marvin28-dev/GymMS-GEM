import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useRef, useEffect } from 'react';
import { getCurrencySymbol, formatMoney } from '../utils/currency';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ClipboardList, EyeOff, Plus, RefreshCw, Banknote, TrendingUp, TrendingDown, Calendar, Download, FileText, Lock, Edit2, Camera, IdCard, ChevronLeft, ChevronRight, UserX, UserCheck, Mail, Trash2, CloudUpload, X, Phone } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import StatusBadge from '../components/ui/StatusBadge';
import RowMenu from '../components/ui/RowMenu';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import LoadFailed from '../components/ui/LoadFailed';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import { canManage as outranks, canSeePrivateFields } from '../utils/hierarchy';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getOne as getStaffMember, getCode as getStaffCode, regenerateCode as regenerateStaffCode, update as updateStaff, addNote as addStaffNote, resendInvite as resendStaffInvite } from '../services/staff.service';
import { uploadPhoto } from '../services/upload.service';
import { getAuth, getRole } from '../utils/auth';
import { jobOf, departmentOfRole, assigneeName } from '../utils/departments';
import { getAll as getTasks, update as updateTask } from '../services/tasks.service';
import { getAll as getCalendar } from '../services/calendar.service';
import { getAll as getTimecards, approve as approveTimecard, reject as rejectTimecard } from '../services/timecards.service';
import { getForStaff as getPayRecords, create as createPayRecord } from '../services/payroll.service';
import {
  getForStaff as getAdjustments, previewMonth as previewPay,
  create as createAdjustment, remove as removeAdjustment,
} from '../services/payAdjustments.service';
import { getMyGym } from '../services/gym.service';
import { notifyDataChanged } from '../utils/events';
import api from '../services/api';
import { fmtDate, todayStr as getToday, dayStr, ordinalDay, getDateLocale, payMonthText } from '../utils/date';
import { roleName } from '../utils/roleNames';
import { digitsOnly } from '../utils/number';
import { useSetupStatus } from '../hooks/useSetupStatus';
import NextDayHint from '../components/NextDayHint';
import CoachClientsPanel from '../components/CoachClientsPanel';
import AddressInputs from '../components/AddressInputs';
import { addressErrors, formatAddress } from '../utils/address';
import { serverFieldError, revealFirstError } from '../utils/formErrors';
import { isFitness } from '../utils/rolePages';
import TimeInput from '../components/ui/TimeInput';


// Pay periods are stored as "Sep 2026". Generating the options the same way
// they are generated elsewhere keeps the format identical, so a period always
// matches the adjustments and pay records tagged with it.
// A time card carries every problem found on it, gathered while the shift ran.
const cardIssues = (card) => (Array.isArray(card?.issues) ? card.issues : []);
const payMonthLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// The inverse of payMonthLabel: back to the first day of that month.
const monthStart = (label) => {
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(label || '').trim());
  if (!m) return null;
  const idx = MONTH_ABBR.indexOf(m[1]);
  return idx < 0 ? null : new Date(Number(m[2]), idx, 1);
};

function payMonthOptions(forward = 12) {
  const now = new Date();
  const out = [];
  for (let i = 0; i <= forward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(payMonthLabel(d));
  }
  return out;
}

// The roles the edit form offers, by the value stored on the record. Older
// coach and instructor records show as trainer until someone changes them.
const EDITABLE_ROLES = ['manager', 'front_desk', 'trainer', 'other'];
const roleChoice = (role) => (['coach', 'instructor'].includes(role) ? 'trainer' : role);
// One list of note categories for both layouts
const NOTE_CATEGORIES = ['General', 'Performance', 'Warning', 'Commendation', 'Health', 'Financial', 'Other'];
const noteCategoryName = (c, t) => (NOTE_CATEGORIES.includes(c) ? t(`staff.noteCat${c}`) : c);

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const dangerBtn = { background: 'var(--bg-card)', border: '1px solid var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };

// Shared empty state (icon in a circle + title + hint), matching the member profile.
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
const ADJ_KINDS = [
  { kind: 'bonus', titleKey: 'staff.adjBonuses', sign: '+', color: 'var(--accent-green)', emptyKey: 'staff.adjNoBonuses' },
  { kind: 'deduction', titleKey: 'staff.adjDeductions', sign: '-', color: 'var(--accent-red)', emptyKey: 'staff.adjNoDeductions' },
];
const adjIconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6, display: 'inline-flex', alignItems: 'center' };

const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };

// Pay and a rota mean nothing for a cleaner or a technician, so their profile
// is not asked to complete them.
const SETUP_SKIPPED_FOR_OTHER = new Set(['salary', 'schedule']);

// Marks a part of the profile as not loaded. With keepRefusals a 403 is left
// alone: a manager is refused pay records and bonuses on purpose (D-31).
const markFailed = (set, key, keepRefusals = false) => (err) => {
  if (keepRefusals && err?.response?.status === 403) return;
  set(prev => ({ ...prev, [key]: true }));
};

const TABS = ['Details', 'Tasks Assigned', 'Schedule', 'Calendar', 'Clients', 'Pay & Earnings', 'Notes'];
const TAB_KEYS = ['staff.tabDetails', 'staff.tabTasks', 'staff.tabSchedule', 'staff.tabCalendar', 'staff.tabClients', 'staff.tabPayEarnings', 'staff.tabNotes'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['common.monday', 'common.tuesday', 'common.wednesday', 'common.thursday', 'common.friday', 'common.saturday', 'common.sunday'];
const PRIORITY_KEYS = { High: 'tasks.priorityHigh', Medium: 'tasks.priorityMedium', Low: 'tasks.priorityLow' };
const priorityName = (p, t) => (PRIORITY_KEYS[p] ? t(PRIORITY_KEYS[p]) : p);
const PRIORITY_COLORS = {
  High:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)' },
  Medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  Low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)' },
};

const emptySchedule = DAYS.reduce((acc, d) => ({ ...acc, [d]: { start: '08:00', end: '17:00', off: false } }), {});

// Weeks are identified by their Monday, so an override applies to exactly the
// seven days a manager was looking at when they set it.
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}
const weekKey = (date) => {
  const m = mondayOf(date);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
};
function weekOptions(count = 8) {
  const base = mondayOf(new Date());
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const month = (d) => d.toLocaleDateString(getDateLocale(), { month: 'short' });
    // Only repeat the month when the week straddles two of them
    const label = start.getMonth() === end.getMonth()
      ? `${start.getDate()} - ${end.getDate()} ${month(end)}`
      : `${start.getDate()} ${month(start)} - ${end.getDate()} ${month(end)}`;
    return { key: weekKey(start), label, isThisWeek: i === 0 };
  });
}

const StatusPill = ({ status }) => {
  const { t } = useLanguage();
  const map = { paid: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, issued: { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' }, draft: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' } };
  const names = { paid: t('reports.paidLabel'), issued: t('reports.issuedLabel'), draft: t('staff.payDraft') };
  const s = map[status] || map.draft;
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>{names[status] || status}</span>;
};

export default function StaffProfilePage() {
  const { t, lang } = useLanguage();
  const { id: paramId } = useParams();
  const id = paramId ?? String(getAuth()?.user?.id ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from the front desk, Back goes back to the desk, not to the
  // staff list on a dashboard the person on shift never asked for.
  const fromFrontDesk = location.pathname.startsWith('/front-desk');
  const backToList = () => navigate(fromFrontDesk ? '/front-desk' : '/staff');
  const isMobile = useIsMobile();
  const role = getRole();
  const isOwnProfile = !paramId;
  // isOwnProfile only covers the /my-profile route. Reaching your own record
  // through the staff list is still yourself, and the same limits apply.
  const isSelf = String(getAuth()?.user?.id ?? '') === String(paramId ?? getAuth()?.user?.id ?? '');

  // The access code is a credential: it logs you into the front desk and
  // authorises sensitive actions, so View always asks first. Your own is
  // released by your password; anybody else's by your own 4-digit code.
  // Handing out a new code is the owner's alone, his own included
  const canIssueCodes = role === 'general_manager';
  const [showNewCodeAuth, setShowNewCodeAuth] = useState(false);
  const [newCodeNotice, setNewCodeNotice] = useState('');
  // A code that could not be shown or replaced says why, in red (F-120)
  const [codeError, setCodeError] = useState('');
  const issueNewCode = async () => {
    setShowNewCodeAuth(false);
    setCodeLoading(true);
    setCodeError('');
    try {
      const res = await regenerateStaffCode(memberData.id);
      setRevealedCode(res.data.accessCode);
      setShowCode(true);
      setNewCodeNotice(t('staff.newCodeIssued'));
    } catch (err) {
      setNewCodeNotice('');
      setCodeError(err?.response?.data?.error || t('staff.newCodeFailed'));
    } finally {
      setCodeLoading(false);
    }
  };
  const revealCode = async () => {
    setCodeLoading(true);
    setCodeError('');
    try {
      const res = await getStaffCode(memberData.id);
      setRevealedCode(res.data.accessCode);
      setShowCode(true);
    } catch (err) {
      setCodeError(err?.response?.data?.error || t('staff.codeLoadFailed'));
    } finally {
      setCodeLoading(false);
    }
  };
  const canSendInvite = ['general_manager', 'manager'].includes(role);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(null); // { ok: bool, msg: string }

  const handleResendInvite = async () => {
    if (!memberData?.id) return;
    setSendingInvite(true);
    setInviteFeedback(null);
    try {
      await resendStaffInvite(memberData.id);
      setInviteFeedback({ ok: true, msg: t('staff.setupEmailSentTo', { email: memberData.email }) });
    } catch (err) {
      const detail = err?.response?.data?.error || t('staff.failedSendInvite');
      setInviteFeedback({ ok: false, msg: detail });
    } finally {
      setSendingInvite(false);
      setTimeout(() => setInviteFeedback(null), 6000);
    }
  };
  // A notification can deep-link straight to a tab, e.g. /staff/:id?tab=tasks
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    const map = { tasks: 'Tasks Assigned', schedule: 'Schedule', clients: 'Clients', pay: 'Pay & Earnings', notes: 'Notes' };
    return map[tab] || 'Details';
  });
  const [showCode, setShowCode] = useState(false);
  const [revealedCode, setRevealedCode] = useState(null);
  const [showCodeAuthModal, setShowCodeAuthModal] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (!revealedCode) return;
    const t = setTimeout(() => { setRevealedCode(null); setShowCode(false); }, 30000);
    return () => clearTimeout(t);
  }, [revealedCode]);

  const [memberData, setMemberData] = useState(() => {
    const ns = location.state?.newStaff;
    if (!ns) return null;
    return { ...ns, photoData: ns.photo || ns.photoData || null, photoIdData: ns.photoId || ns.photoIdData || null };
  });
  const [loadingStaff, setLoadingStaff] = useState(!location.state?.newStaff);
  const setup = useSetupStatus();
  const [loadError, setLoadError] = useState(null);

  // What you may do here depends on who this is: someone below you, yourself,
  // or someone at or above your level. utils/hierarchy.js holds the ladder.
  const me = { id: getAuth()?.user?.id, role };
  const managesTarget = outranks(me, memberData ? { id: memberData.id ?? paramId, role: memberData.role } : null);
  // Pay and private notes are for the person themself, or someone who
  // outranks them - a colleague viewing a peer's profile never sees these,
  // so the tabs that would only show blank or stale state stay off the list.
  const seesPrivate = canSeePrivateFields(me, memberData ? { id: memberData.id ?? paramId, role: memberData.role } : null);
  const PRIVATE_TABS = ['Pay & Earnings', 'Notes'];
  // A coach's clients: for management, and for the coach on their own profile
  const showsClients = isFitness(memberData?.role) && (['general_manager', 'manager'].includes(role) || isSelf);
  const tabShown = (tab) => (seesPrivate || !PRIVATE_TABS.includes(tab)) && (tab !== 'Clients' || showsClients);
  const shownTabs = TABS.filter(tabShown);
  const shownTabKeys = TAB_KEYS.filter((_, i) => tabShown(TABS[i]));
  // How to reach you, and your photos, are yours to change. Everything else on
  // the record belongs to somebody more senior.
  const canEditProfile = managesTarget || isSelf;
  // A name is what the gym calls you, so it is not yours to rewrite. The owner
  // answers to nobody, so his own record is his.
  const canEditIdentity = managesTarget || (isSelf && role === 'general_manager');
  // Role and rota: anyone who outranks them. Switching a staff member
  // active/inactive is the general manager's alone.
  const canEditStanding = managesTarget;
  const canChangeStatus = role === 'general_manager' && managesTarget;
  // Pay is the owner's alone, on the server as well as here
  const canEditPayroll = role === 'general_manager';
  // Pay history, bonuses and deductions are the owner's and the person's own;
  // the server refuses them to anyone else, so a manager is told so (D-31)
  const seesPayDetails = canEditPayroll || isSelf;
  const canEditSchedule = managesTarget;

  // Notes
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [notes, setNotes] = useState([]);

  const [photoUploading, setPhotoUploading] = useState(false);
  const profilePhotoRef = useRef(null);
  // What a refused change says, shown where it was made (F-107, F-120)
  const [photoError, setPhotoError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  async function handleProfilePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const url = await uploadPhoto(file, 'gem/staff');
      await updateStaff(id, { photo: url });
      setMemberData(prev => ({ ...prev, photoData: url }));
    } catch (err) {
      setPhotoError(err?.response?.data?.error || t('staff.photoFailed'));
    } finally {
      setPhotoUploading(false);
      // so choosing the same file again still fires a change
      if (e.target) e.target.value = '';
    }
  }

  async function removeProfilePhoto() {
    setPhotoUploading(true);
    setPhotoError('');
    try {
      await updateStaff(id, { photo: null });
      setMemberData(prev => ({ ...prev, photoData: null }));
    } catch (err) {
      setPhotoError(err?.response?.data?.error || t('staff.failedSave'));
    } finally {
      setPhotoUploading(false);
    }
  }

  // The photo, with its two actions revealed on hover. Without a photo it is
  // the initials, and hovering offers the upload on its own.
  function ProfilePhoto({ size, style }) {
    const [hover, setHover] = useState(false);
    const shown = hover && canEditProfile && !photoUploading;
    const iconBtn = {
      width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(12,12,16,0.82)', color: '#fff', padding: 0,
    };
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}
      >
        {memberData.photoData ? (
          <img src={memberData.photoData} alt={memberData.name}
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)', display: 'block' }} />
        ) : (
          <Avatar firstName={fn} lastName={ln} avatarColor={avatarColor} size={size} />
        )}
        {shown && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(12,12,16,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <button type="button" style={iconBtn} title={t('staff.uploadProfilePhoto')}
              onClick={() => profilePhotoRef.current?.click()}>
              <CloudUpload size={13} />
            </button>
            {memberData.photoData && (
              <button type="button" style={{ ...iconBtn, background: 'rgba(239,68,68,0.9)' }}
                title={t('staff.removeProfilePhoto')} onClick={removeProfilePhoto}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Edit profile
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  // Field by field, shown under each field of the edit form
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }));
  const editPhotoRef = useRef(null);
  const photoIdRef = useRef(null);
  const [photoIdSaving, setPhotoIdSaving] = useState(false);
  const [photoIdError, setPhotoIdError] = useState('');

  const [localTasks, setLocalTasks] = useState([]);
  // Default to what was assigned to this person, so their own work shows first.
  const [taskFilters, setTaskFilters] = useState({ kind: 'personal', status: 'All', priority: 'All', age: 'All' });
  const [calItems, setCalItems] = useState([]);
  const [viewingTask, setViewingTask] = useState(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [doneTask, setDoneTask] = useState(null);
  const [doneNote, setDoneNote] = useState('');
  // Completing from inside the detail modal happens in place, so the note field
  // appears there instead of opening a second dialog on top of it.
  const [completingInline, setCompletingInline] = useState(false);


  // Deactivate / Reactivate
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showReactivateAuth, setShowReactivateAuth] = useState(false);

  // Schedule
  const [schedule, setSchedule] = useState(emptySchedule);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  // A change not yet saved: the live reload below leaves the grid alone (F-112)
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const setDay = (day, field, value) => { setScheduleDirty(true); setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } })); };

  // 'repeating' edits the standing weekly pattern; 'week' edits one week only,
  // stored as an override against that week's Monday.
  const [scheduleMode, setScheduleMode] = useState('repeating');
  const [selectedWeek, setSelectedWeek] = useState(() => weekKey(new Date()));
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const weeks = weekOptions();
  const weekIndex = weeks.findIndex(w => w.key === selectedWeek);
  const currentWeek = weeks[weekIndex] || weeks[0];
  const canStepWeek = (delta) => weekIndex + delta >= 0 && weekIndex + delta < weeks.length;
  // What the reload needs to know about the grid on screen, read when it lands
  const rotaView = useRef({ dirty: false, mode: 'repeating', week: selectedWeek });
  useEffect(() => { rotaView.current = { dirty: scheduleDirty, mode: scheduleMode, week: selectedWeek }; });
  const stepWeek = (delta) => {
    if (!canStepWeek(delta)) return;
    switchScheduleMode('week', weeks[weekIndex + delta].key);
  };

  // Pay
  const [salary, setSalary] = useState(0);
  const [showSalaryEdit, setShowSalaryEdit] = useState(false);
  const [showSalaryAuthModal, setShowSalaryAuthModal] = useState(false);
  const [showEditAuth, setShowEditAuth] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [timecards, setTimecards] = useState([]);
  const [approvingCard, setApprovingCard] = useState(null);
  const [reviewCard, setReviewCard] = useState(null);
  const [reviewForm, setReviewForm] = useState({ punchIn: '', punchOut: '', note: '' });
  const [reviewError, setReviewError] = useState('');
  // payDay is this staff member's own date; gymPayDay is the gym-wide default
  // used when they have none of their own.
  const [payDay, setPayDay] = useState('');
  const [gymPayDay, setGymPayDay] = useState('');
  const [payDayInput, setPayDayInput] = useState('');
  const [payRecords, setPayRecords] = useState([]);
  const [showIssuePayModal, setShowIssuePayModal] = useState(false);
  const [issuePayForm, setIssuePayForm] = useState({ month: '', amount: '', note: '' });
  const [payError, setPayError] = useState('');

  // Bonuses and deductions: recurring ones apply every month, one-off ones
  // only to the month they are tagged with.
  const [adjustments, setAdjustments] = useState([]);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ kind: 'bonus', label: '', amount: '', recurring: true, month: '', note: '' });
  const [adjError, setAdjError] = useState('');
  const [payPreview, setPayPreview] = useState(null);
  // A refused pay change keeps its form open; a refused removal is shown under its item
  const [salaryError, setSalaryError] = useState('');
  const [salarySaving, setSalarySaving] = useState(false);
  const [adjRemoveError, setAdjRemoveError] = useState(null);

  // Parts of the profile that could not be loaded say so, with a retry (F-102)
  const [sectionFailed, setSectionFailed] = useState({});
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    getAdjustments(id).then(res => setAdjustments(res.data || [])).catch(markFailed(setSectionFailed, 'pay', true));
  }, [id, retryTick]);

  // Pay history and pay day both live on the server so they follow the gym
  // across devices rather than sitting in one browser's localStorage.
  useEffect(() => {
    if (!id) return;
    getPayRecords(id)
      .then(res => setPayRecords(res.data || []))
      .catch(markFailed(setSectionFailed, 'pay', true));
  }, [id, retryTick]);

  useEffect(() => {
    getMyGym()
      .then(res => setGymPayDay(res.data?.payDay != null ? String(res.data.payDay) : ''))
      .catch(markFailed(setSectionFailed, 'pay'));
  }, [retryTick]);

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPaystubView, setShowPaystubView] = useState(false);
  const [selectedPaystub, setSelectedPaystub] = useState(null);

  const [salaryConfigured, setSalaryConfigured] = useState(false);
  const [scheduleConfigured, setScheduleConfigured] = useState(false);

  useEffect(() => {
    const ns = location.state?.newStaff;
    if (!ns) return;
    const sal = Number(ns.salary);
    if (sal > 0) { setSalary(sal); setSalaryConfigured(true); }
  }, []);


  const liveTick = useLiveTick();
  useEffect(() => {
    // Someone just added shows straight away from what the form sent, but the
    // record still loads, so fields the form did not carry are not left blank
    setLoadError(null);
    getStaffMember(id)
      .then(res => {
        const s = res.data;
        setMemberData({
          ...s,
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id,
          status: s.isActive !== false ? 'active' : 'inactive',
          joinDate: s.joinDate || s.createdAt || null,
          photoData: s.photo || null,
          photoIdData: s.photoId || null,
          // A colleague who does not outrank them is told an ID is on file, never sent it
          photoIdOnFile: !!(s.photoId || s.photoIdOnFile),
        });
        if (s.salary != null) {
          const sal = Number(s.salary);
          setSalary(sal);
          if (sal > 0) setSalaryConfigured(true);
        }
        if (s.schedule && typeof s.schedule === 'object') {
          // Never over an unsaved change, and for the mode and week on screen:
          // one-week mode shows that week's exception, not the repeating pattern
          const view = rotaView.current;
          if (!view.dirty) {
            const weekOverride = view.mode === 'week' ? s.scheduleOverrides?.[view.week] : null;
            setSchedule({ ...emptySchedule, ...(weekOverride || s.schedule) });
          }
          const hasWorkingDay = Object.values(s.schedule).some(d => d && !d.off);
          if (hasWorkingDay) setScheduleConfigured(true);
        }
        if (s.scheduleOverrides && typeof s.scheduleOverrides === 'object') {
          setScheduleOverrides(s.scheduleOverrides);
        }
        if (Array.isArray(s.staffNotes)) setNotes(s.staffNotes);
        setPayDay(s.payDay != null ? String(s.payDay) : '');
        // Load timecards for this staff member
        getTimecards({ staffId: s.id }).then(r => setTimecards(r.data || [])).catch(markFailed(setSectionFailed, 'pay', true));
      })
      .catch(err => {
        console.error('Failed to load staff:', err);
        const status = err?.response?.status;
        if (status === 404) {
          setLoadError('not_found');
        } else if (status === 403) {
          setLoadError('forbidden');
        } else {
          setLoadError('server_error');
        }
      })
      .finally(() => setLoadingStaff(false));
  }, [id, liveTick, retryTick]);


  useEffect(() => {
    if (!memberData) return;
    const staffDisplayName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || memberData.name || '';
    const myJob = jobOf(memberData.role);
    const inGroup = (group) => group === 'management' && ['general_manager', 'manager'].includes(memberData.role);
    getTasks()
      .then(res => {
        // Every task this person is on: theirs by name, their job's, their
        // department's, or one they raised. Each is tagged with how it reaches
        // them so the Tasks tab can filter by personal / group / created.
        const tagged = (res.data || []).map(tk => {
          const direct = tk.assignedToId != null && String(tk.assignedToId) === String(id);
          const byRole = !!tk.assignedRole && myJob === tk.assignedRole;
          const byGroup = !!tk.assignedGroup && inGroup(tk.assignedGroup);
          const byName = !tk.assignedRole && !tk.assignedGroup && tk.assignedTo === staffDisplayName;
          const created = tk.createdById != null && String(tk.createdById) === String(id) && !tk.createdBySystem;
          // A task reaching them by their role or department counts as assigned
          // to them - there is no separate "group" bucket on the profile.
          return { ...tk, _personal: direct || byName || byRole || byGroup, _created: created };
        }).filter(tk => tk._personal || tk._created);
        setLocalTasks(tagged);
      })
      .catch(markFailed(setSectionFailed, 'tasks'));
  }, [memberData?.id, id, liveTick, retryTick]);

  // This person's own calendar: the classes they run and the gym events they
  // have accepted. An event they were invited to but have not accepted does not
  // belong here - the same rule the person's own /calendar uses. Read off the
  // gym calendar's per-event responses so a manager can see it from the profile.
  useEffect(() => {
    if (!memberData) return;
    const parseIds = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };
    getCalendar()
      .then(res => {
        const mine = (res.data || []).filter(ev => {
          if (ev.isPrivate) return false; // a colleague's diary is not shown here
          const isInstructor = String(ev.instructorId) === String(id);
          const booked = String(ev.createdById) === String(id);
          const onStaff = parseIds(ev.staffIds).map(String).includes(String(id));
          if (!isInstructor && !booked && !onStaff) return false;
          // A class they run or an event they booked is theirs outright. A plain
          // invitee only sees it once they have accepted.
          if (isInstructor || booked) return true;
          const resp = (ev.responses || []).find(r => String(r.staffId) === String(id));
          return resp?.status === 'accepted';
        }).map(ev => ({
          id: ev.id,
          date: dayStr(ev.date) || (ev.startTime || '').slice(0, 10),
          time: ev.time || (ev.startTime || '').slice(11, 16),
          end: ev.duration || '',
          title: ev.title,
          category: ev.category,
          location: ev.location,
          color: ev.color,
        })).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
        setCalItems(mine);
      })
      .catch(markFailed(setSectionFailed, 'calendar'));
  }, [memberData?.id, id, liveTick, retryTick]);

  if (loadingStaff) {
    return (
      <div className="page-fade" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>{t('staff.loadingProfile')}</p>
      </div>
    );
  }

  if (!memberData) {
    const isServerError = loadError === 'server_error';
    return (
      <div className="page-fade" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
          {loadError === 'forbidden'
            ? t('staff.noAccessToRecord')
            : isServerError ? t('staff.loadErrorServer') : t('staff.loadErrorNotFound')}
        </p>
        {isServerError && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
            {t('staff.tryRestart')}
          </p>
        )}
        <button style={{ ...secondaryBtn, marginTop: 8 }} onClick={() => backToList()}>{t(fromFrontDesk ? 'staff.backToFrontDesk' : 'staff.backToStaff')}</button>
      </div>
    );
  }

  // The owner account can't be deactivated - doing so would lock the gym out
  // of its own admin. The server rejects it too; this hides the button.
  const isOwnerAccount = memberData?.role === 'general_manager';
  // The account actions: beside Close on a desktop, in the header menu on a phone
  const showInviteAction = canSendInvite && !!memberData?.email && memberData?.role !== 'general_manager';
  const showStatusAction = canChangeStatus && !isSelf && !isOwnerAccount;
  const showCloseAction = String(getAuth()?.user?.id) !== String(id) || fromFrontDesk;
  const isPartTime = memberData.employmentType === 'Part Time';
  // Part-time pay follows the clock: hourly rate against the hours actually
  // worked this month. Full-time pay is the same figure every month.
  const thisMonthLabel = payMonthLabel(new Date());
  const hoursThisMonth = timecards.reduce((sum, tc) => {
    if (!tc.punchIn || !tc.punchOut) return sum;
    const d = new Date(tc.date || tc.punchIn);
    if (payMonthLabel(d) !== thisMonthLabel) return sum;
    return sum + Math.max(0, new Date(tc.punchOut) - new Date(tc.punchIn)) / 3600000;
  }, 0);
  const basicPay = isPartTime ? Math.round(salary * hoursThisMonth) : salary;
  // Moving between hourly and salaried changes what the salary figure means, so
  // the new one has to be stated rather than silently reinterpreted.
  const editType = editForm.employmentType || memberData.employmentType || 'Full Time';
  const typeChanged = editType !== (memberData.employmentType || 'Full Time');
  const editWeeklyHours = DAYS.reduce((sum, d) => {
    const day = schedule?.[d];
    if (!day || day.off) return sum;
    const mins = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const a = mins(day.start), b = mins(day.end);
    return a !== null && b !== null && b > a ? sum + (b - a) / 60 : sum;
  }, 0);
  const suggestedPay = editWeeklyHours > 0 && salary > 0
    ? (editType === 'Full Time' ? Math.round(salary * editWeeklyHours) : Math.round(salary / editWeeklyHours))
    : 0;
  const resolvedPay = typeChanged ? Number(editForm.salary ?? suggestedPay) : null;
  const payMissing = typeChanged && !(resolvedPay > 0);
  // The pay is what they earned and what the books record. What was handed
  // over is that less the deductions withheld from it.
  const payHistory = payRecords.map(r => ({
    month: r.month,
    grossPay: r.amount,
    netPay: r.netAmount ?? Math.max(0, r.amount - (r.deductions ?? r.breakdown?.totalDeductions ?? 0)),
    basicPay: r.basePay ?? r.breakdown?.basePay ?? r.amount,
    allowances: r.breakdown?.totalBonuses || 0,
    deductions: r.deductions ?? r.breakdown?.totalDeductions ?? 0,
    breakdown: r.breakdown || null,
    status: r.status || 'issued',
    note: r.note || '',
    issuedAt: r.issuedAt,
    paidAt: r.paidAt || null,
  }));

  // The server issues each month's pay on the pay day (jobs/autoPayroll.js).
  // The owner can still issue it earlier by hand, and a month whose deductions
  // exceed the pay is held back until they are fixed.
  const currentPayMonth = payMonthLabel(new Date());
  // Once a pay has been issued for a month its breakdown is fixed on the record,
  // so an adjustment added afterwards could never apply. The period being worked
  // on is therefore the first month with nothing recorded against it yet.
  const paidMonths = new Set(payRecords.map(r => r.month));
  const unpaidMonthOptions = payMonthOptions().filter(m => !paidMonths.has(m));
  const activePayMonth = unpaidMonthOptions[0] || currentPayMonth;
  // Bonuses and deductions are shown for that period alone: every recurring
  // item, plus the one-off items tagged with it.
  const appliesToPayPeriod = (a) => a.isActive && (a.recurring || a.month === activePayMonth);
  const periodAdjustments = adjustments.filter(appliesToPayPeriod);
  const sumKind = (list, kind) => list.filter(a => a.kind === kind).reduce((s, a) => s + a.amount, 0);

  // What this particular paycheck comes to, one-offs included.
  const activeBonusTotal = sumKind(periodAdjustments, 'bonus');
  const activeDeductionTotal = sumKind(periodAdjustments, 'deduction');
  const rawNetPay = basicPay + activeBonusTotal - activeDeductionTotal;
  const estimatedNetPay = Math.max(0, rawNetPay);
  // Nothing can be paid out below zero, but a bare 0 reads like missing data.
  // Keep the overshoot so the page can say deductions have outrun the pay.
  const payShortfall = rawNetPay < 0 ? -rawNetPay : 0;

  // What a normal month looks like. A one-off belongs to its own paycheck, so
  // it must not drag down a figure that claims to be per month.
  const recurringAdjustments = adjustments.filter(a => a.isActive && a.recurring);
  const recurringBonusTotal = sumKind(recurringAdjustments, 'bonus');
  const recurringDeductionTotal = sumKind(recurringAdjustments, 'deduction');
  const monthlyNetPay = Math.max(0, basicPay + recurringBonusTotal - recurringDeductionTotal);

  // Only the person a task belongs to reports progress on it
  // Moving a task on is management's call, on the profile as on the task page -
  // not the assignee's, even when they are looking at their own record.
  const canUpdateTasks = ['general_manager', 'manager'].includes(role);

  const taskAgeDays = (tk) => {
    const raw = tk.createdAt || tk.dueDate;
    if (!raw) return null;
    return Math.floor((Date.now() - new Date(raw).getTime()) / 86400000);
  };

  const filteredTasks = localTasks.filter(tk => {
    if (taskFilters.kind === 'personal' && !tk._personal) return false;
    if (taskFilters.kind === 'created' && !tk._created) return false;
    if (taskFilters.status !== 'All' && (tk.status || 'Pending') !== taskFilters.status) return false;
    if (taskFilters.priority !== 'All' && (tk.priority || 'Medium') !== taskFilters.priority) return false;
    if (taskFilters.age !== 'All') {
      const age = taskAgeDays(tk);
      if (age === null) return false;
      if (taskFilters.age === '7' && age > 7) return false;
      if (taskFilters.age === '30' && age > 30) return false;
      if (taskFilters.age === 'old' && age <= 30) return false;
    }
    return true;
  });

  // Tasks assigned to this person that are still open - the Tasks tab shows a
  // count so a manager can see at a glance that they have work waiting.
  // Still to do: an answered calendar invite (accepted or declined) is settled
  const attentionCount = localTasks.filter(tk => tk._personal && ['Pending', 'In Progress'].includes(tk.status || 'Pending')).length;

  // The person's calendar as a dated agenda, grouped by day and split into
  // what is still to come and what has passed. Shared by both layouts.
  const EVT_COLORS = { gold: '#c9a96e', blue: '#60a5fa', green: '#34d399', red: '#f87171', purple: '#a78bfa' };
  const retrySections = () => { setSectionFailed({}); setRetryTick(n => n + 1); };
  const sectionProblem = (key, style) => (sectionFailed[key]
    ? <LoadFailed message={t(`staff.${key}LoadFailed`)} onRetry={retrySections} style={style} />
    : null);

  const calendarAgenda = (() => {
    const todayStr = getToday();
    // Only what is still to come - a profile's calendar is for planning, not a
    // history of past classes and events.
    const upcoming = calItems.filter(e => e.date >= todayStr);
    const dayLabel = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return d; } };
    const row = (e) => (
      <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: EVT_COLORS[e.color] || 'var(--accent-gold)', flexShrink: 0 }} />
        <div style={{ minWidth: 54, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{e.time || '-'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[e.category, e.location].filter(Boolean).join(' · ') || '-'}</div>
        </div>
      </div>
    );
    const group = (list) => {
      const byDay = {};
      list.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
      return Object.keys(byDay).map(d => (
        <div key={d} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '8px 0 2px' }}>{dayLabel(d)}</div>
          {byDay[d].map(row)}
        </div>
      ));
    };
    if (upcoming.length === 0) {
      return <EmptyState icon={Calendar} title={t('staff.noCalItems')} hint={t('staff.noCalItemsDesc')} />;
    }
    return (
      <div style={{ padding: '8px 20px 20px' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent-gold)', fontWeight: 600, marginTop: 10, marginBottom: 2 }}>{t('staff.upcoming')}</div>
        {group(upcoming)}
      </div>
    );
  })();

  const changeTaskStatus = async (taskId, status, notes) => {
    setTaskBusy(true);
    setTaskError('');
    try {
      const payload = { status };
      if (notes?.trim()) payload.notes = notes.trim();
      const res = await updateTask(taskId, payload);
      setLocalTasks(prev => prev.map(tk => (tk.id === taskId ? { ...tk, ...(res.data || { status }) } : tk)));
      setViewingTask(prev => (prev && prev.id === taskId ? { ...prev, ...(res.data || { status }) } : prev));
      notifyDataChanged();
      return true;
    } catch (err) {
      setTaskError(err?.response?.data?.error || t('staff.failedSave'));
      return false;
    } finally {
      setTaskBusy(false);
    }
  };

  // Completing a task is the moment worth recording what was actually done, so
  // it asks for a note rather than flipping silently. Other statuses apply
  // straight away.
  const requestStatusChange = (task, status) => {
    if (status === 'Done') {
      // Close the detail view first so the two never sit stacked on each other
      setViewingTask(null);
      setDoneTask(task);
      setDoneNote(task.notes || '');
    } else {
      changeTaskStatus(task.id, status);
    }
  };

  const confirmTaskDone = async () => {
    if (!doneTask) return;
    if (!await changeTaskStatus(doneTask.id, 'Done', doneNote)) return;
    setDoneTask(null);
    setDoneNote('');
  };

  // A calendar-invite task is answered yes/no by the person invited, and by
  // nobody else - a manager viewing the profile can only read the answer. An
  // ordinary task's progress is management's to record (canUpdateTasks).
  const viewerId = String(me.id ?? '');
  const isCalInvite = (tk) => !!tk && (!!tk.eventId || tk.category === 'Calendar');
  const canRespondInvite = (tk) => isCalInvite(tk) && String(tk.assignedToId ?? '') === viewerId;

  const dueDay = payDay || gymPayDay;

  // Where the active period stands, as one line: the month is carried by the
  // due date itself, so there is no second line repeating it.
  const payPeriod = (() => {
    const record = payRecords.find(r => r.month === activePayMonth) || null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodStart = monthStart(activePayMonth) || new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
    const dueDate = dueDay
      ? new Date(periodStart.getFullYear(), periodStart.getMonth(), Math.min(Number(dueDay), lastDayOfMonth))
      : null;
    const daysAway = dueDate ? Math.round((dueDate - startOfToday) / 86400000) : null;
    const on = dueDate ? fmtDate(dueDate, { day: 'numeric', month: 'short' }) : '';
    if (record?.status === 'paid') {
      return {
        key: 'paid', amount: record.amount, handOver: record.netAmount,
        line: record.paidAt
          ? t('staff.payLinePaidOn', { month: payMonthText(activePayMonth), date: fmtDate(record.paidAt, { day: 'numeric', month: 'short' }) })
          : t('staff.payLinePaid', { month: payMonthText(activePayMonth) }),
      };
    }
    if (record) {
      return {
        key: 'issued', amount: record.amount, handOver: record.netAmount,
        line: t('staff.payLineIssued', { month: payMonthText(activePayMonth) }),
      };
    }
    // The pay day job skips deactivated accounts, so there is nothing to count down to
    if (memberData?.status === 'inactive' || memberData?.isActive === false) {
      return { key: 'inactive', amount: estimatedNetPay, line: t('staff.payLineInactive') };
    }
    if (!(salary > 0)) {
      return { key: 'nosalary', amount: 0, line: t('staff.payLineNoSalary') };
    }
    if (!dueDate) {
      return { key: 'nodueday', amount: estimatedNetPay, line: t('staff.payLineNoPayDay', { month: payMonthText(activePayMonth) }) };
    }
    if (daysAway > 0) {
      return {
        key: 'upcoming', amount: estimatedNetPay,
        line: daysAway === 1 ? t('staff.payLineTomorrow', { date: on }) : t('staff.payLineInDays', { n: daysAway, date: on }),
      };
    }
    if (daysAway === 0) {
      return { key: 'due', urgent: true, amount: estimatedNetPay, line: t('staff.payLineToday', { date: on }) };
    }
    return {
      key: 'overdue', urgent: true, amount: estimatedNetPay,
      line: t('staff.payLineOverdue', { date: on }),
    };
  })();

  const avatarColors = ['gold', 'blue', 'green', 'red', 'purple'];
  const avatarColor = memberData.avatarColor || avatarColors[0];
  const fn = memberData.firstName || (memberData.name || '').split(' ')[0] || '';
  const ln = memberData.lastName || (memberData.name || '').split(' ').slice(1).join(' ') || '';

  // Editing somebody else's record is a manager action, so it is verified the
  // same way changing their salary is. Your own details are yours to edit.
  const openEdit = () => {
    if (!canEditProfile) return;
    setShowEditAuth(true);
  };

  const openEditForm = () => {
    setEditForm({
      ...memberData,
    });
    setEditFieldErrors({}); setEditError('');
    setShowEditModal(true);
  };

  function handleEditPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEF('photoFile', file);
    const reader = new FileReader();
    reader.onload = ev => setEF('photoData', ev.target.result);
    reader.readAsDataURL(file);
  }

  // Filing the document is its own act: it uploads and saves on the spot,
  // rather than riding along with whatever else the edit form is changing.
  async function fileThePhotoId(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoIdSaving(true);
    setPhotoIdError('');
    try {
      const url = await uploadPhoto(file, 'gem/staff/ids');
      await updateStaff(id, { photoId: url });
      setMemberData(prev => ({ ...prev, photoIdData: url, photoId: url }));
    } catch (err) {
      setPhotoIdError(err?.response?.data?.error || t('staff.photoIdFailed'));
    } finally {
      setPhotoIdSaving(false);
    }
  }

  // The file picker sits outside the tabs, in both layouts, so the profile
  // checklist can open it from any tab and on a phone.
  const photoIdInput = <input ref={photoIdRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={fileThePhotoId} />;
  // An identity document is filed by a manager who has checked it, never by
  // the person it belongs to (the owner excepted), so their own profile says so.
  const photoIdBlock = (
    <>
      {memberData.photoIdData || memberData.photoIdOnFile ? (
        // The label and the buttons are given room to fall onto separate
        // lines: squeezed together they read as one run-on control
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '12px 16px', maxWidth: 480,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IdCard size={20} color="var(--accent-gold)" />
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.identityDoc')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('staff.photoIdOnFile')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
            {memberData.photoIdData && (
              <button
                type="button"
                onClick={async () => {
                  // A file on another site (Cloudinary) is not downloaded by a plain
                  // link, which opened it in this tab instead, so it is fetched first;
                  // if that is refused it opens in a new tab
                  const src = memberData.photoIdData;
                  try {
                    const blob = await (await fetch(src)).blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${memberData.name.replace(/\s+/g, '_')}_PhotoID`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch {
                    window.open(src, '_blank', 'noopener');
                  }
                }}
                style={{ ...secondaryBtn, padding: '6px 12px', gap: 4, flexShrink: 0 }}
                title={t('staff.downloadPhotoId')}
              >
                <Download size={13} />
                {t('staff.download')}
              </button>
            )}
            {canEditIdentity && (
              <button type="button" onClick={() => photoIdRef.current?.click()} disabled={photoIdSaving}
                style={{ ...secondaryBtn, padding: '6px 12px', gap: 4, flexShrink: 0 }}
                title={t('staff.replacePhotoId')}>
                {photoIdSaving ? t('common.loading') : t('staff.replacePhotoId')}
              </button>
            )}
          </div>
        </div>
      ) : canEditIdentity ? (
        <button type="button" onClick={() => photoIdRef.current?.click()} disabled={photoIdSaving}
          style={{ fontSize: 12, color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: photoIdSaving ? 'default' : 'pointer', fontFamily: 'DM Sans', fontWeight: 600, opacity: photoIdSaving ? 0.6 : 1 }}>
          {photoIdSaving ? t('common.loading') : t('staff.uploadPhotoId')}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
          <IdCard size={16} style={{ flexShrink: 0 }} />
          <span>{isSelf ? t('staff.idFiledByManager') : t('staff.noPhotoIdOnFile')}</span>
        </div>
      )}
      {photoIdError && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{photoIdError}</div>}
    </>
  );

  const saveEdit = async () => {
    const req = t('common.required');
    const fe = { ...(canEditIdentity && !(editForm.name || '').trim() && { name: req }), ...addressErrors(editForm, req) };
    setEditFieldErrors(fe);
    if (Object.keys(fe).length) { revealFirstError(); return; }
    if (payMissing) { setEditError(t('staff.payRequiredOnSwitch')); return; }
    setEditSaving(true);
    setEditError('');
    const nameParts = (editForm.name || '').trim().split(' ');
    // Only what this person may actually change is sent. Anything else in the
    // payload would have the server refuse the whole save, even untouched.
    const apiFields = {
      email: editForm.email,
      phone: editForm.phone,
      avatarColor: editForm.avatarColor,
      emergencyContact: editForm.emergencyContact,
      emergencyPhone: editForm.emergencyPhone,
      houseNumber: editForm.houseNumber || '', street: editForm.street || '', city: editForm.city || '',
      region: editForm.region || '', postalCode: editForm.postalCode || '', country: editForm.country || getAuth()?.user?.gymCountry || '',
      ...(canEditIdentity ? {
        firstName: nameParts[0] || editForm.firstName || '',
        lastName: nameParts.slice(1).join(' ') || editForm.lastName || '',
      } : {}),
      ...(canEditStanding ? {
        ...(memberData?.role !== 'general_manager' && { role: editForm.role }),
        shiftStart: editForm.shiftStart,
        // The owner account is always active and cannot be deactivated
        isActive: memberData?.role === 'general_manager' ? true : editForm.status !== 'inactive',
      } : {}),
      // The salary means something different either side of this switch, so it
      // travels with it and never on its own, and only the owner may send it.
      ...(typeChanged && canEditPayroll ? { employmentType: editType, salary: resolvedPay } : {}),
    };
    // Upload photos to Cloudinary if new files were selected
    if (editForm.photoFile) {
      try { apiFields.photo = await uploadPhoto(editForm.photoFile, 'gem/staff'); } catch (err) { setEditError(err?.response?.data?.error || t('staff.photoFailed')); setEditSaving(false); return; }
    }
    try {
      const res = await updateStaff(id, apiFields);
      // Pay & Earnings reads the salary from its own state, not from memberData,
      // so a figure saved here has to be pushed into it or the tab shows the old
      // one until the page is reloaded.
      if (apiFields.salary !== undefined && Number(apiFields.salary) > 0) {
        setSalary(Number(apiFields.salary));
        setSalaryConfigured(true);
      }
      setMemberData(prev => ({
        ...prev,
        ...editForm,
        firstName: apiFields.firstName,
        lastName: apiFields.lastName,
        ...(res?.data || {}),
        // The response carries the raw column, which is null for accounts
        // created before join dates were stored. Keep the createdAt fallback
        // rather than letting the save blank the field out.
        joinDate: res?.data?.joinDate || prev.joinDate || null,
        ...(apiFields.photo ? { photoData: apiFields.photo } : {}),
      }));
      setShowEditModal(false);
    } catch (err) {
      console.error('Staff update failed:', err);
      const se = serverFieldError(err, err?.message || t('staff.failedSave'));
      if (se.field) setEditFieldErrors(f => ({ ...f, [se.field]: se.message })); else setEditError(se.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Staff are switched off, never deleted - removeStaff here used to wipe the
  // record while the screen only showed them as inactive. The screen changes
  // only once the server has made the change (F-107).
  const setActive = async (isActive) => {
    setStatusError('');
    try {
      await updateStaff(id, { isActive });
      setMemberData(prev => ({ ...prev, status: isActive ? 'active' : 'inactive', isActive }));
    } catch (err) {
      setStatusError(err?.response?.data?.error || t('staff.failedSave'));
    }
  };
  const deactivate = () => setActive(false);
  const reactivate = () => setActive(true);

  // A note is kept once the server has it; a refusal stays in the dialog
  const saveNote = async () => {
    if (!noteText.trim() || noteSaving) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      // The server adds it to the list as it stands, so a note another manager
      // added meanwhile is kept, and answers with the whole list
      const res = await addStaffNote(id, { content: noteText, category: noteCategory, date: getToday() });
      setNotes(Array.isArray(res.data?.notes) ? res.data.notes : [...notes, res.data.note]);
      setNoteText('');
      setNoteCategory('General');
      setShowNoteModal(false);
    } catch (err) {
      setNoteError(err?.response?.data?.error || t('staff.failedSave'));
    } finally {
      setNoteSaving(false);
    }
  };
  const openNoteModal = () => { setNoteError(''); setShowNoteModal(true); };

  const handleChangePassword = async () => {
    setPwError('');
    if (!pwForm.current || !pwForm.next) { setPwError(t('staff.pwAllRequired')); return; }
    if (pwForm.next.length < 6) { setPwError(t('staff.pwTooShort')); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError(t('staff.pwMismatch')); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwSuccess(true);
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => { setPwSuccess(false); setShowChangePw(false); }, 2000);
    } catch (err) {
      setPwError(err?.response?.data?.error || t('staff.pwChangeFailed'));
    } finally { setPwSaving(false); }
  };

  const loadPayPreview = async (month) => {
    setPayPreview(null);
    if (!month) return;
    try {
      const res = await previewPay(id, month);
      setPayPreview(res.data);
    } catch (err) {
      setPayError(err?.response?.data?.error || 'Could not work out this period’s pay. The flat salary is shown instead.');
    }
  };

  const handleIssuePay = async () => {
    // The period the bonuses and deductions on this page are showing for.
    const month = activePayMonth;
    setPayError('');
    setPayPreview(null);
    setIssuePayForm({ month, note: '' });
    setShowIssuePayModal(true);
    await loadPayPreview(month);
  };

  const saveAdjustment = async () => {
    setAdjError('');
    const amount = Number(adjForm.amount);
    if (!adjForm.label.trim() || !amount) { setAdjError(t('staff.adjMissing')); return; }
    // A one-off item can only target the paycheck being worked on now.
    const month = adjForm.recurring ? undefined : activePayMonth;
    try {
      const res = await createAdjustment({
        staffId: id,
        kind: adjForm.kind,
        label: adjForm.label.trim(),
        amount,
        recurring: adjForm.recurring,
        month,
        note: adjForm.note.trim() || undefined,
      });
      setAdjustments(prev => [res.data, ...prev]);
      setShowAdjModal(false);
    } catch (err) {
      setAdjError(err?.response?.data?.error || t('staff.adjSaveFailed'));
    }
  };

  // A hand-adjusted card waits here until a manager signs it off. Approving it
  // is what lets those hours count toward pay.
  // A pending card is opened for review, not accepted blind: the manager sees
  // what changed and why, and can correct the times before accepting.
  const openReview = (card) => {
    const clock = (d) => (d ? new Date(d).toTimeString().slice(0, 5) : '');
    setReviewCard(card);
    setReviewError('');
    setReviewForm({ punchIn: clock(card.punchIn), punchOut: clock(card.punchOut), note: '' });
  };

  const submitReview = async (accept) => {
    if (!reviewCard) return;
    setApprovingCard(reviewCard.id);
    setReviewError('');
    try {
      const res = accept
        ? await approveTimecard(reviewCard.id, { punchIn: reviewForm.punchIn, punchOut: reviewForm.punchOut })
        : await rejectTimecard(reviewCard.id, { note: reviewForm.note || undefined });
      setTimecards(prev => prev.map(c => (c.id === reviewCard.id ? res.data : c)));
      setReviewCard(null);
    } catch (err) {
      setReviewError(err?.response?.data?.error || 'Could not save this review. Please try again.');
    }
    setApprovingCard(null);
  };

  const deleteAdjustment = async (item) => {
    setAdjRemoveError(null);
    try {
      await removeAdjustment(item.id);
      setAdjustments(prev => prev.filter(a => a.id !== item.id));
    } catch (err) {
      setAdjRemoveError({ id: item.id, text: err?.response?.data?.error || t('staff.failedSave') });
    }
  };

  const openAdjModal = (kind) => {
    setAdjError('');
    setAdjForm({ kind, label: '', amount: '', recurring: true, month: activePayMonth, note: '' });
    setShowAdjModal(true);
  };

  // What the prompt shows instead of an amount box: the pay as the accounts will
  // record it, what is withheld, and what actually changes hands. The last one
  // is the figure somebody hands over, so it is the one that stands out.
  const renderPaySummary = () => {
    if (!payPreview || payPreview.month !== issuePayForm.month) {
      return (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
          {t('staff.workingOutPay')}
        </div>
      );
    }
    const gross = Math.round((payPreview.basePay || 0) + (payPreview.totalBonuses || 0));
    const withheld = Math.round(payPreview.totalDeductions || 0);
    const handOver = Math.max(0, gross - withheld);
    const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 };
    const num = { fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' };
    const group = (kind) => {
      const g = ADJ_KINDS.find(x => x.kind === kind);
      const items = kind === 'bonus' ? payPreview.bonuses : payPreview.deductions;
      if (!items.length) return null;
      return items.map((x, i) => (
        <div key={`${kind}${i}`} style={{ ...row, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 10 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}{x.recurring ? '' : ` · ${t('staff.oneTime')}`}</span>
          <span style={{ ...num, flexShrink: 0, color: g.color }}>{g.sign}{formatMoney(x.amount)}</span>
        </div>
      ));
    };
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 12 }}>
        <div style={{ ...row, color: 'var(--text-secondary)' }}>
          <span>{payPreview.isPartTime ? t('staff.hoursWorkedPay') : t('staff.basicSalary')}</span>
          <span style={num}>{formatMoney(payPreview.basePay)}</span>
        </div>
        {group('bonus')}
        <div style={{ ...row, borderTop: '1px solid var(--border-subtle)', marginTop: 10, paddingTop: 8, fontWeight: 700, color: 'var(--text-primary)' }}>
          <span>{t('staff.payRecorded')}</span>
          <span style={num}>{formatMoney(gross)}</span>
        </div>
        {withheld > 0 && (
          <>
            <div style={{ ...row, marginTop: 10, color: 'var(--accent-red)' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('staff.withheldDeductions')}</span>
              <span style={{ ...num, fontWeight: 700 }}>−{formatMoney(withheld)}</span>
            </div>
            {group('deduction')}
          </>
        )}
        <div style={{ ...row, borderTop: '1px solid var(--border-subtle)', marginTop: 10, paddingTop: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t('staff.toHandOver')}</span>
          <span style={{ ...num, fontSize: 18, fontWeight: 800, color: 'var(--accent-gold)' }}>{formatMoney(handOver)}</span>
        </div>
        {withheld > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {t('staff.handOverExplain', { gross: formatMoney(gross), withheld: formatMoney(withheld), handOver: formatMoney(handOver) })}
          </div>
        )}
      </div>
    );
  };

  const confirmIssuePay = async () => {
    setPayError('');
    if (!issuePayForm.month) { setPayError(t('staff.choosePayPeriod')); return; }
    if (payPreview?.month !== issuePayForm.month) { setPayError(t('staff.payStillWorking')); return; }
    const short = payPreview?.month === issuePayForm.month ? (payPreview.shortfall || 0) : 0;
    if (short > 0) {
      setPayError(t('reports.payShortfall', { month: payMonthText(issuePayForm.month), amount: formatMoney(short) }));
      return;
    }
    try {
      // The amount is worked out on the server, never taken from here
      const res = await createPayRecord({
        staffId: id,
        month: issuePayForm.month,
        note: issuePayForm.note || undefined,
      });
      setPayRecords(prev => [res.data, ...prev]);
      // One-time items for that period were consumed into the record
      setAdjustments(prev => prev.filter(a => a.recurring || a.month !== issuePayForm.month));
      setShowIssuePayModal(false);
    } catch (err) {
      setPayError(err?.response?.data?.error || t('staff.payRecordFailed'));
    }
  };

  const effectivePayDay = payDay || gymPayDay;

  // Pay and pay day are saved together, and the new figures only show once the
  // server has them; a refusal keeps the form open with the reason.
  // Each staff member has their own pay day; empty falls back to the gym default.
  const saveSalaryEdit = async () => {
    const v = Number(salaryInput);
    const changes = { payDay: payDayInput === '' ? null : Number(payDayInput) };
    if (v > 0) changes.salary = v;
    setSalaryError('');
    setSalarySaving(true);
    try {
      await updateStaff(id, changes);
      if (v > 0) { setSalary(v); setSalaryConfigured(true); }
      setPayDay(payDayInput);
      setShowSalaryEdit(false);
    } catch (err) {
      setSalaryError(err?.response?.data?.error || t('staff.failedSave'));
    }
    setSalarySaving(false);
  };

  // Phone and desktop share one pay summary, so the two can never drift apart:
  // when they are paid, then four tiles of the same size.
  const payTiles = isPartTime ? [
    { key: 'base', label: t('staff.hourlyRate'), value: formatMoney(salary), unit: t('staff.perHour'), icon: Banknote, color: 'var(--text-primary)', iconColor: 'var(--text-secondary)', dim: 'var(--bg-elevated)' },
    { key: 'extra', label: t('staff.estHoursMonth'), value: t('staff.hoursShort', { n: hoursThisMonth.toFixed(1) }), icon: Calendar, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
    { key: 'deduct', label: t('staff.deductionsLabel'), value: recurringDeductionTotal ? `−${formatMoney(recurringDeductionTotal)}` : formatMoney(0), icon: TrendingDown, color: 'var(--accent-red)', dim: 'var(--accent-red-dim)' },
    { key: 'net', label: t('staff.estMonthlyEarnings'), value: formatMoney(basicPay), icon: TrendingUp, color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', total: true },
  ] : [
    { key: 'base', label: t('staff.monthlyBasic'), value: formatMoney(salary), icon: Banknote, color: 'var(--text-primary)', iconColor: 'var(--text-secondary)', dim: 'var(--bg-elevated)' },
    { key: 'extra', label: t('staff.bonusesExtras'), value: recurringBonusTotal ? `+${formatMoney(recurringBonusTotal)}` : formatMoney(0), icon: TrendingUp, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
    { key: 'deduct', label: t('staff.deductionsLabel'), value: recurringDeductionTotal ? `−${formatMoney(recurringDeductionTotal)}` : formatMoney(0), icon: TrendingDown, color: 'var(--accent-red)', dim: 'var(--accent-red-dim)' },
    { key: 'net', label: t('staff.estNetPay'), value: formatMoney(monthlyNetPay), icon: Banknote, color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)', total: true },
  ].filter(tile => seesPayDetails || tile.key === 'base' || (isPartTime && tile.key === 'extra'));
  // Paid this year, by the day it was paid: issued pay not yet handed over and
  // earlier years left out
  const paidThisYear = payHistory
    .filter(p => p.status === 'paid' && p.paidAt && new Date(p.paidAt).getFullYear() === new Date().getFullYear())
    .reduce((s, p) => s + p.grossPay, 0);
  const payOwnerOnly = (
    <div role="note" style={{ ...cardStyle, borderRadius: isMobile ? 12 : 14, padding: isMobile ? 14 : '16px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
      <Lock size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      {t('staff.payOwnerOnly')}
    </div>
  );

  const payFieldLabel = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'DM Sans', minWidth: 0 };
  const paySummary = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14 }}>
      {showSalaryEdit ? (
        <div style={{ ...cardStyle, borderRadius: isMobile ? 12 : 14, padding: isMobile ? 14 : '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label style={payFieldLabel}>
              {isPartTime ? t('staff.hourlyRate') : t('staff.monthlyBasic')}
              <input type="text" inputMode="numeric" value={salaryInput} onChange={e => setSalaryInput(digitsOnly(e.target.value))} style={{ ...inputStyle, fontSize: isMobile ? 16 : 14 }} autoFocus />
            </label>
            <label style={payFieldLabel}>
              {t('staff.payDayField')}
              <select value={payDayInput} onChange={e => setPayDayInput(e.target.value)} style={{ ...inputStyle, fontSize: isMobile ? 16 : 14 }}>
                <option value="">{gymPayDay ? t('staff.gymDefaultOption', { day: ordinalDay(gymPayDay, lang) }) : t('staff.payDayNotSet')}</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{t('staff.dayOfMonth', { day: ordinalDay(d, lang) })}</option>)}
              </select>
            </label>
          </div>
          {salaryError && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{salaryError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" style={{ ...secondaryBtn, padding: '8px 16px', fontSize: 13, flex: isMobile ? 1 : 'none', justifyContent: 'center' }} onClick={() => { setShowSalaryEdit(false); setSalaryError(''); }}>{t('common.cancel')}</button>
            <button type="button" disabled={salarySaving} style={{ ...primaryBtn, padding: '8px 18px', fontSize: 13, flex: isMobile ? 1 : 'none', justifyContent: 'center', opacity: salarySaving ? 0.6 : 1 }} onClick={saveSalaryEdit}>{salarySaving ? t('common.saving') : t('common.save')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 30, fontFamily: 'DM Sans' }}>
          <Calendar size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: effectivePayDay ? 'var(--text-secondary)' : 'var(--text-muted)', minWidth: 0 }}>
            {effectivePayDay ? t('staff.payDayLine', { day: ordinalDay(effectivePayDay, lang) }) : t('staff.noPayDay')}
            {effectivePayDay && !payDay && <span style={{ color: 'var(--text-muted)' }}> {t('staff.gymDefaultTag')}</span>}
          </span>
          {canEditPayroll && (
            <button type="button" onClick={() => { setSalaryInput(String(salary)); setPayDayInput(payDay); setShowSalaryAuthModal(true); }}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-gold-dim)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}>
              <Lock size={11} /> {isPartTime ? t('staff.changeRate') : t('staff.changePay')}
            </button>
          )}
        </div>
      )}
      <div className="gem-pay-tiles" style={{ display: 'grid', gridTemplateColumns: `repeat(${payTiles.length < 4 ? payTiles.length : (isMobile ? 2 : 4)}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: isMobile ? 10 : 14 }}>
        {payTiles.map(c => (
          <div key={c.key} data-pay-tile={c.key} style={{
            ...cardStyle, borderRadius: isMobile ? 12 : 14, padding: isMobile ? '12px 14px' : '16px 18px', minWidth: 0,
            display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14,
            ...(c.total ? { background: 'var(--accent-gold-glow)', border: '1px solid var(--accent-gold-dim)' } : {}),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: 8, background: c.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <c.icon size={isMobile ? 12 : 14} color={c.iconColor || c.color} />
              </span>
              <span style={{ fontSize: isMobile ? 11.5 : 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.25, minWidth: 0 }}>{c.label}</span>
            </div>
            <div style={{ marginTop: 'auto', fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 16 : 20, fontWeight: 700, color: c.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
              {c.value}{c.unit && <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>{c.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Switching mode loads whatever that mode is currently showing, so the grid
  // always reflects the thing about to be saved.
  const switchScheduleMode = (mode, weekKeyValue = selectedWeek) => {
    setScheduleDirty(false);
    setScheduleMode(mode);
    setSelectedWeek(weekKeyValue);
    if (mode === 'repeating') {
      setSchedule(prev => ({ ...emptySchedule, ...(memberData?.schedule || prev) }));
    } else {
      const override = scheduleOverrides[weekKeyValue];
      // A week with no override starts from the repeating pattern
      setSchedule({ ...emptySchedule, ...(override || memberData?.schedule || {}) });
    }
  };

  const saveSchedule = async () => {
    setScheduleError('');
    try {
      if (scheduleMode === 'repeating') {
        await updateStaff(id, { schedule });
        setMemberData(prev => ({ ...prev, schedule }));
      } else {
        const next = { ...scheduleOverrides, [selectedWeek]: schedule };
        await updateStaff(id, { scheduleOverrides: next });
        setScheduleOverrides(next);
      }
      setScheduleDirty(false);
      setScheduleSaved(true);
      setScheduleConfigured(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } catch (err) {
      setScheduleError(err?.response?.data?.error || t('staff.failedSave'));
    }
  };

  // Drops the exception so the week falls back to the repeating pattern
  const clearWeekOverride = async () => {
    const next = { ...scheduleOverrides };
    delete next[selectedWeek];
    setScheduleError('');
    try {
      await updateStaff(id, { scheduleOverrides: next });
      setScheduleOverrides(next);
      setSchedule({ ...emptySchedule, ...(memberData?.schedule || {}) });
      setScheduleDirty(false);
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } catch (err) {
      setScheduleError(err?.response?.data?.error || t('staff.failedSave'));
    }
  };

  const actionError = photoError || statusError;

  // ── Mobile layout ──────────────────────────────────────────────────────────
  // A task's details and Mark as done: drawn by both layouts, since the phone's
  // task list opens them too (F-109)
  const taskDialogs = (
    <>
      {/* ── Complete Task Modal ───────────────────────────────────────────── */}
      <Modal open={!!doneTask} onClose={() => { setDoneTask(null); setDoneNote(''); setTaskError(''); }} title={t('staff.completeTask')} maxWidth={460}>
        {doneTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{doneTask.title}</div>
              {doneTask.dueDate && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
                  {t('staff.taskDueDateCol')}: {String(doneTask.dueDate).slice(0, 10)}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.completionNote')}</label>
              <textarea
                value={doneNote}
                onChange={e => setDoneNote(e.target.value)}
                autoFocus
                placeholder={t('staff.completionNotePh')}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minHeight: 90, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{t('staff.completionNoteHint')}</div>
            </div>
            {taskError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{taskError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={secondaryBtn} onClick={() => { setDoneTask(null); setDoneNote(''); setTaskError(''); }}>{t('common.cancel')}</button>
              <button style={{ ...primaryBtn, opacity: taskBusy ? 0.6 : 1 }} disabled={taskBusy} onClick={confirmTaskDone}>
                {taskBusy ? t('staff.saving') : t('staff.markDoneBtn')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Task Detail Modal ─────────────────────────────────────────────── */}
      <Modal open={!!viewingTask} onClose={() => { setViewingTask(null); setCompletingInline(false); setDoneNote(''); setTaskError(''); }} title={t('staff.taskDetails')} maxWidth={520}>
        {viewingTask && (() => {
          const pc = PRIORITY_COLORS[viewingTask.priority] || PRIORITY_COLORS.Medium;
          const age = taskAgeDays(viewingTask);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{viewingTask.title}</div>
                {viewingTask.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '8px 0 0' }}>{viewingTask.description}</p>
                )}
              </div>

              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  [t('tasks.priority'), <span key="p" style={{ ...pc, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4 }}>{priorityName(viewingTask.priority, t)}</span>],
                  [t('common.status'), <StatusBadge key="s" status={(viewingTask.status || 'pending').toLowerCase()} />],
                  [t('tasks.assignedTo'), assigneeName(viewingTask, t)],
                  [t('staff.taskDueDateCol'), viewingTask.dueDate ? String(viewingTask.dueDate).slice(0, 10) : ''],
                  [t('tasks.createdBy'), viewingTask.createdBySystem ? t('tasks.createdBySystem') : (viewingTask.createdBy || '')],
                  [t('staff.taskAge'), age === null ? '' : (age === 0 ? t('staff.ageToday') : t('staff.ageDaysAgo', { count: age }))],
                ].filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {viewingTask.notes && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>{t('tasks.notesLabel')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{viewingTask.notes}</div>
                </div>
              )}

              {isCalInvite(viewingTask) ? (
                canRespondInvite(viewingTask) ? (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.awaitingResponse')}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['Accepted', t('calendar.accept'), 'var(--accent-green)', 'var(--accent-green-dim)'], ['Declined', t('calendar.decline'), 'var(--accent-red)', 'var(--accent-red-dim)']].map(([v, l, col, border]) => {
                        const active = (viewingTask.status || 'Pending') === v;
                        return (
                          <button key={v} disabled={taskBusy}
                            onClick={() => changeTaskStatus(viewingTask.id, v)}
                            style={{
                              flex: 1, cursor: taskBusy ? 'default' : 'pointer', borderRadius: 9, padding: '9px 10px',
                              fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans',
                              background: active ? border : 'var(--bg-elevated)',
                              border: `1px solid ${active ? col : 'var(--border-subtle)'}`,
                              color: active ? col : 'var(--text-secondary)',
                              opacity: taskBusy ? 0.6 : 1,
                            }}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                    {t('tasks.onlyInviteeCanRespond')}
                  </div>
                )
              ) : canUpdateTasks ? (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.updateStatus')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')]].map(([v, l]) => {
                      const active = completingInline ? v === 'Done' : (viewingTask.status || 'Pending') === v;
                      return (
                        <button key={v} disabled={taskBusy}
                          onClick={() => {
                            if (v === 'Done') {
                              // Reveal the note field here rather than stacking a second dialog
                              setCompletingInline(true);
                              setDoneNote(viewingTask.notes || '');
                            } else {
                              setCompletingInline(false);
                              changeTaskStatus(viewingTask.id, v);
                            }
                          }}
                          style={{
                            flex: 1, cursor: taskBusy ? 'default' : 'pointer', borderRadius: 9, padding: '9px 10px',
                            fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans',
                            background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                            border: `1px solid ${active ? 'rgba(201,169,110,0.45)' : 'var(--border-subtle)'}`,
                            color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            opacity: taskBusy ? 0.6 : 1,
                          }}>
                          {l}
                        </button>
                      );
                    })}
                  </div>

                  {completingInline && (
                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.completionNote')}</label>
                      <textarea
                        value={doneNote}
                        onChange={e => setDoneNote(e.target.value)}
                        autoFocus
                        placeholder={t('staff.completionNotePh')}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minHeight: 84, resize: 'vertical' }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{t('staff.completionNoteHint')}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  {t('tasks.onlyAssigneeCanComplete')}
                </div>
              )}

              {taskError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{taskError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {completingInline ? (
                  <>
                    <button style={secondaryBtn} onClick={() => { setCompletingInline(false); setDoneNote(''); }}>
                      {t('common.cancel')}
                    </button>
                    <button
                      style={{ ...primaryBtn, opacity: taskBusy ? 0.6 : 1 }}
                      disabled={taskBusy}
                      onClick={async () => {
                        if (!await changeTaskStatus(viewingTask.id, 'Done', doneNote)) return;
                        setCompletingInline(false);
                        setDoneNote('');
                        setViewingTask(null);
                      }}
                    >
                      {taskBusy ? t('staff.saving') : t('staff.markDoneBtn')}
                    </button>
                  </>
                ) : (
                  <button style={secondaryBtn} onClick={() => setViewingTask(null)}>{t('staff.close')}</button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );

  if (isMobile) {
    const roleLabel = roleName(memberData.role, t);
    const isActive = memberData.status !== 'inactive';
    const TAB_MAP = { Details: 'Details', Tasks: 'Tasks Assigned', Schedule: 'Schedule', Calendar: 'Calendar', Clients: 'Clients', Pay: 'Pay & Earnings', Notes: 'Notes' };
    const MOBILE_TABS = ['Details', 'Tasks', 'Schedule', 'Calendar', 'Clients', 'Pay', 'Notes'].filter(k => tabShown(TAB_MAP[k]));
    const MOBILE_TAB_KEYS = MOBILE_TABS.map(k => TAB_KEYS[TABS.indexOf(TAB_MAP[k])]);

    const detailFields = [
      { labelKey: 'staff.department', value: (() => { const d = departmentOfRole(memberData.role); return d ? t(d.labelKey) : '-'; })() },
      { labelKey: 'staff.employment', value: memberData.employmentType || t('staff.fullTime') },
      { labelKey: 'staff.phone', value: memberData.phone || '-' },
      { labelKey: 'staff.email', value: memberData.email || '-' },
      { labelKey: 'common.address', value: formatAddress(memberData) || '-' },
      { labelKey: 'staff.joinDate', value: fmtDate(memberData.joinDate) },
      { labelKey: 'staff.emergencyContact', value: memberData.emergencyContact || '-' },
      { labelKey: 'staff.emergencyPhone', value: memberData.emergencyPhone || '-' },
    ];

    const checkItems = [
      { key: 'photo', labelKey: 'staff.checkPhoto', done: !!memberData.photoData, onClick: canEditProfile ? openEdit : undefined },
      { key: 'photoId', labelKey: 'staff.checkPhotoId', done: !!memberData.photoIdData, onClick: canEditIdentity ? () => photoIdRef.current?.click() : undefined },
      { key: 'email', labelKey: 'staff.checkEmail', done: !!memberData.email, onClick: canEditProfile ? openEdit : undefined },
      { key: 'emergency', labelKey: 'staff.checkEmergency', done: !!memberData.emergencyContact, onClick: canEditProfile ? openEdit : undefined },
      { key: 'salary', labelKey: 'staff.checkSalary', done: salaryConfigured, onClick: () => setActiveTab('Pay & Earnings') },
      { key: 'schedule', labelKey: 'staff.checkSchedule', done: scheduleConfigured, onClick: () => setActiveTab('Schedule') },
    ].filter(i => !SETUP_SKIPPED_FOR_OTHER.has(i.key) || memberData.role !== 'other');
    const doneCount = checkItems.filter(i => i.done).length;
    // Setting a profile up is the general manager's job: his own and everyone
    // else's. Nobody else is shown the list, let alone asked to finish it.
    const showChecklist = role === 'general_manager' && doneCount < checkItems.length;

    return (
      <div style={{ minHeight: '100%', paddingBottom: 16 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
          {(String(getAuth()?.user?.id) !== String(id) || fromFrontDesk) && (
            <button aria-label={t('common.back')} onClick={() => backToList()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={2} />
            </button>
          )}
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {memberData.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: isActive ? '#22c55e' : '#6b7280', fontFamily: 'DM Sans' }}>
            {isActive ? t('staff.activeStatus') : t('staff.inactiveStatus')}
          </span>
          {(showInviteAction || showStatusAction) && (
            <RowMenu title={t('staff.accountActions')} items={[
              { label: sendingInvite ? t('staff.sendingInvite') : t('staff.sendLoginLink'), icon: <Mail size={15} />, onClick: handleResendInvite, hidden: !showInviteAction },
              { label: t('staff.deactivate'), icon: <UserX size={15} />, onClick: () => setShowDeactivateConfirm(true), danger: true, hidden: !showStatusAction || !isActive },
              { label: t('staff.reactivate'), icon: <UserCheck size={15} />, onClick: () => setShowReactivateAuth(true), hidden: !showStatusAction || isActive },
            ]} />
          )}
        </div>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <ProfilePhoto size={72} style={{ marginBottom: 10 }} />
          <input ref={profilePhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
          <div style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 6 }}>{memberData.name}</div>
          <div style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 20, fontFamily: 'DM Sans' }}>{roleLabel}</div>
        </div>

        {location.state?.newStaff?.photoProblem && <div role="alert" style={{ margin: '12px 16px 0', fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{location.state.newStaff.photoProblem}</div>}
        {/* A new employee chooses their own password the first time they sign in */}
        {location.state?.newStaff && !inviteFeedback && (
          <div style={{ margin: '12px 16px 0', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 15, lineHeight: 1.2 }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#22c55e', fontFamily: 'DM Sans', marginBottom: 2 }}>{t('staff.accountCreated')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
                {t('staff.accountCreatedDesc', { email: location.state.newStaff.inviteEmail || location.state.newStaff.email || '' })}
              </div>
            </div>
          </div>
        )}

        {actionError && <div role="alert" style={{ margin: '12px 16px 0', fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{actionError}</div>}
        {/* Resend invite feedback */}
        {inviteFeedback && (
          <div style={{ margin: '12px 16px 0', background: inviteFeedback.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${inviteFeedback.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>{inviteFeedback.ok ? '✉' : '✕'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: inviteFeedback.ok ? '#22c55e' : '#ef4444', fontFamily: 'DM Sans', marginBottom: 2 }}>
                {inviteFeedback.ok ? t('staff.loginLinkSent') : t('staff.failedToSend')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.4 }}>
                {inviteFeedback.msg}
              </div>
            </div>
          </div>
        )}

        {photoIdInput}
        {/* Profile setup checklist */}
        {showChecklist && (
          <div style={{ margin: '14px 16px 0', background: 'rgba(201,169,110,0.04)', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.profileSetup')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.complete', { done: doneCount, total: checkItems.length })}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {checkItems.map(item => (
                <button key={item.key} onClick={item.onClick} disabled={!item.onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', background: item.done ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)', border: `1px solid ${item.done ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`, color: item.done ? '#22c55e' : 'var(--text-secondary)', fontSize: 11, fontFamily: 'DM Sans', fontWeight: item.done ? 500 : 400 }}>
                  <span style={{ fontSize: 12 }}>{item.done ? '✓' : '○'}</span>
                  {t(item.labelKey)}
                  {!item.done && <span style={{ color: 'var(--accent-gold)', fontSize: 9 }}>→</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border-subtle)', margin: '14px 0 0', padding: '0 16px' }}>
          {MOBILE_TABS.map((tab, i) => {
            const full = TAB_MAP[tab];
            const active = activeTab === full;
            return (
              <button key={tab} onClick={() => setActiveTab(full)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 16px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent-gold)' : 'transparent'}`, color: active ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'DM Sans', fontWeight: active ? 600 : 400 }}>
                {t(MOBILE_TAB_KEYS[i])}
                {full === 'Tasks Assigned' && attentionCount > 0 && (
                  <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--accent-red)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{attentionCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Details tab ── */}
        {activeTab === 'Details' && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '4px 0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{t('staff.staffDetails')}</span>
                {canEditProfile && <button style={secondaryBtn} onClick={openEdit}><Edit2 size={13} /> {t('staff.editProfile')}</button>}
              </div>
              {detailFields.map((f, i) => (
                <div key={f.labelKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < detailFields.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t(f.labelKey)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'DM Sans', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{f.value}</span>
                </div>
              ))}
              {/* Access code */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.accessCode')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {revealedCode && showCode ? (
                    <>
                      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 6, color: 'var(--accent-gold)' }}>{revealedCode}</span>
                      <button aria-label={t('staff.hideCode')} onClick={() => { setShowCode(false); setRevealedCode(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><EyeOff size={13} color="var(--text-muted)" /></button>
                      {canIssueCodes && (
                        <button onClick={() => { setNewCodeNotice(''); setShowNewCodeAuth(true); }} disabled={codeLoading}
                          title={t('staff.newCodeAction')}
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <RefreshCw size={9} />{t('staff.newCode')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 6, color: 'var(--text-muted)' }}>••••</span>
                      <button onClick={() => setShowCodeAuthModal(true)} disabled={codeLoading} style={{ background: 'var(--accent-gold-dim)', border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--accent-gold)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Lock size={9} />{codeLoading ? '…' : t('staff.viewCode')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {newCodeNotice && <div style={{ padding: '0 16px 11px', fontSize: 11.5, color: 'var(--accent-green)', fontFamily: 'DM Sans', textAlign: 'right' }}>{newCodeNotice}</div>}
              {codeError && <div role="alert" style={{ padding: '0 16px 11px', fontSize: 11.5, color: 'var(--accent-red)', fontFamily: 'DM Sans', textAlign: 'right' }}>{codeError}</div>}
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10, fontFamily: 'DM Sans' }}>{t('staff.checkPhotoId')}</div>
              {photoIdBlock}
            </div>
            {/* Change Password - only on own profile */}
            {isOwnProfile && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
                <button onClick={() => setShowChangePw(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.changePassword')}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{showChangePw ? '▲' : '▼'}</span>
                </button>
                {showChangePw && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    <GemInput label={t('staff.currentPassword')} required type="password" autoComplete="current-password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
                    <GemInput label={t('staff.newPassword')} required type="password" autoComplete="new-password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
                    <GemInput label={t('staff.confirmNewPassword')} required type="password" autoComplete="new-password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                    {pwError && <div style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{pwError}</div>}
                    {pwSuccess && <div style={{ fontSize: 12, color: '#22c55e', fontFamily: 'DM Sans' }}>{t('staff.pwChangedSuccess')}</div>}
                    <button onClick={handleChangePassword} disabled={pwSaving} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 8, padding: '10px', cursor: pwSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: '#0a0a0f', fontFamily: 'DM Sans', opacity: pwSaving ? 0.7 : 1 }}>
                      {pwSaving ? t('staff.saving') : t('staff.updatePassword')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tasks tab ── */}
        {activeTab === 'Tasks Assigned' && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sectionProblem('tasks')}
            {localTasks.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 2 }}>
                {[
                  { key: 'kind', options: [['All', t('staff.taskKind')], ['personal', t('staff.kindPersonal')], ['created', t('staff.kindCreated')]] },
                  { key: 'status', options: [['All', t('common.all')], ['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')]] },
                  { key: 'priority', options: [['All', t('tasks.priority')], ['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]] },
                  { key: 'age', options: [['All', t('staff.taskAge')], ['7', t('staff.ageWeek')], ['30', t('staff.ageMonth')], ['old', t('staff.ageOlder')]] },
                ].map(f => (
                  <select key={f.key} value={taskFilters[f.key]} onChange={e => setTaskFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', flexShrink: 0 }}>
                    {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
              </div>
            )}
            {localTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('staff.noTasksMobile')}</div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('staff.noTasksMatchFilters')}</div>
            ) : filteredTasks.map(tk => {
              const pc = PRIORITY_COLORS[tk.priority] || PRIORITY_COLORS.Medium;
              const age = taskAgeDays(tk);
              return (
                <button key={tk.id} onClick={() => setViewingTask(tk)}
                  style={{ textAlign: 'left', width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 14px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{tk.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: pc.bg, color: pc.color, fontWeight: 600 }}>{priorityName(tk.priority, t)}</span>
                    {tk.dueDate && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{String(tk.dueDate).slice(0, 10)}</span>}
                    <StatusBadge status={(tk.status || 'pending').toLowerCase()} />
                    {age !== null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{age === 0 ? t('staff.ageToday') : t('staff.ageDaysAgo', { count: age })}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Schedule tab ── */}
        {activeTab === 'Schedule' && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {canEditSchedule && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: 3 }}>
                  {[
                    { value: 'repeating', label: t('staff.schedRepeating') },
                    { value: 'week', label: t('staff.schedOneWeek') },
                  ].map(opt => {
                    const active = scheduleMode === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => switchScheduleMode(opt.value)}
                        style={{
                          flex: 1, cursor: 'pointer', borderRadius: 999, padding: '8px 6px', border: 'none',
                          fontSize: 12.5, fontWeight: 600, fontFamily: 'DM Sans',
                          background: active ? 'var(--accent-gold)' : 'transparent',
                          color: active ? '#0a0a0f' : 'var(--text-secondary)',
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {scheduleMode === 'week' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                      <button aria-label={t('common.previousWeek')} onClick={() => stepWeek(-1)} disabled={!canStepWeek(-1)}
                        style={{ background: 'none', border: 'none', padding: '10px 12px', cursor: canStepWeek(-1) ? 'pointer' : 'default', color: canStepWeek(-1) ? 'var(--text-secondary)' : 'var(--border)', display: 'flex' }}>
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
                        {currentWeek?.label}
                        {scheduleOverrides[selectedWeek] && <span style={{ color: 'var(--accent-gold)', marginLeft: 5 }}>•</span>}
                      </span>
                      <button aria-label={t('common.nextWeek')} onClick={() => stepWeek(1)} disabled={!canStepWeek(1)}
                        style={{ background: 'none', border: 'none', padding: '10px 12px', cursor: canStepWeek(1) ? 'pointer' : 'default', color: canStepWeek(1) ? 'var(--text-secondary)' : 'var(--border)', display: 'flex' }}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {scheduleOverrides[selectedWeek] ? t('staff.customWeek') : t('staff.followsPatternShort')}
                      </span>
                      {scheduleOverrides[selectedWeek] && (
                        <button onClick={clearWeekOverride}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                          {t('staff.clearWeek')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {DAYS.map((day, di) => (
              <div key={day} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', opacity: schedule[day].off ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: schedule[day].off ? 0 : 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t(DAY_KEYS[di])}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: canEditProfile ? 'pointer' : 'default', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    <input type="checkbox" checked={schedule[day].off} disabled={!canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'off', e.target.checked)} style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14 }} />
                    {t('staff.dayOff')}
                  </label>
                </div>
                {!schedule[day].off && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('staff.scheduleStart')}</label>
                      <TimeInput value={schedule[day].start} disabled={!canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'start', e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', cursor: canEditSchedule ? 'auto' : 'default' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('staff.scheduleEnd')}</label>
                      <TimeInput value={schedule[day].end} disabled={!canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'end', e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', cursor: canEditSchedule ? 'auto' : 'default' }} />
                      <NextDayHint start={schedule[day].start} end={schedule[day].end} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'right' }}>
              {t(scheduleMode === 'week' ? 'staff.workingDaysThisWeek' : 'staff.workingDays', { count: DAYS.filter(d => !schedule[d].off).length })}
            </div>
            {scheduleError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{scheduleError}</div>}
            {canEditSchedule ? (
              <button onClick={saveSchedule} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#0a0a0f', fontFamily: 'DM Sans', marginTop: 4 }}>
                {scheduleSaved ? `✓ ${t('staff.saved')}` : t('staff.saveSchedule')}
              </button>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 4px' }}>{t('staff.scheduleReadOnly')}</div>
            )}
          </div>
        )}

        {/* ── Calendar tab ── */}
        {activeTab === 'Calendar' && <>{sectionProblem('calendar', { margin: '14px 16px 0' })}{calendarAgenda}</>}
        {activeTab === 'Clients' && showsClients && <div style={{ padding: '14px 16px' }}><CoachClientsPanel staffId={memberData.id} /></div>}

        {/* ── Pay tab ── */}
        {activeTab === 'Pay & Earnings' && seesPrivate && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sectionProblem('pay')}
            {paySummary}
            {seesPayDetails ? (<>
            {/* Bonuses, deductions and the pay they add up to - one card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
              {ADJ_KINDS.map((g, gi) => {
                const items = periodAdjustments.filter(a => a.kind === g.kind);
                const total = g.kind === 'bonus' ? activeBonusTotal : activeDeductionTotal;
                return (
                  <div key={g.kind} style={{ borderTop: gi === 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 10px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: g.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t(g.titleKey)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: total ? g.color : 'var(--text-muted)' }}>
                        {total ? `${g.sign}${formatMoney(total)}` : '-'}
                      </span>
                      {canEditPayroll && (
                        <button onClick={() => openAdjModal(g.kind)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                          <Plus size={11} /> {t('common.add')}
                        </button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ padding: '4px 14px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t(g.emptyKey)}</div>
                    ) : items.map(a => {
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{a.recurring ? t('staff.adjEveryMonth') : t('staff.adjThisPaycheckOnly')}</div>
                            {adjRemoveError?.id === a.id && <div role="alert" style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4, lineHeight: 1.4 }}>{adjRemoveError.text}</div>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: g.color }}>
                            {formatMoney(a.amount)}
                          </span>
                          {canEditPayroll && (
                            <button onClick={() => deleteAdjustment(a)} style={adjIconBtn} aria-label={t('staff.removeItem')}><Trash2 size={14} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-gold)', lineHeight: 1.1 }}>
                    {formatMoney(payPeriod.amount)}
                  </span>
                  {payPeriod.handOver != null && payPeriod.handOver !== payPeriod.amount && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('staff.handOverShort', { amount: formatMoney(payPeriod.handOver) })}</span>
                  )}
                  <span style={{ fontSize: 11, color: payPeriod.urgent ? 'var(--accent-red)' : 'var(--text-muted)', fontWeight: payPeriod.urgent ? 600 : 400, fontFamily: 'DM Sans' }}>
                    {payPeriod.line}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  <span>{formatMoney(basicPay)}</span>
                  <span style={{ color: 'var(--accent-green)' }}>+ {formatMoney(activeBonusTotal)}</span>
                  <span style={{ color: 'var(--accent-red)' }}>− {formatMoney(activeDeductionTotal)}</span>
                </div>
                {payShortfall > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--accent-red)', fontWeight: 600, width: '100%' }}>
                    {t('staff.payShortfallLine', { amount: formatMoney(payShortfall) })}
                  </div>
                )}
              </div>
            </div>
            {/* Pay history (mobile) */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.payHistory')}</span>
                </div>
                {canEditPayroll && salary > 0 && (
                  <button onClick={handleIssuePay} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0a0a0f', fontFamily: 'DM Sans' }}>
                    {t('reports.issuePay')}
                  </button>
                )}
              </div>
              {payRecords.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', padding: '12px 0' }}>{t('staff.noPayRecordsTitle')}</div>
              ) : payRecords.map((r, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < payRecords.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{payMonthText(r.month)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(r.amount)}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{r.note}</div>}
                </div>
              ))}
              {payRecords.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingTop: 10, marginTop: 4, borderTop: '1px solid var(--border-subtle)', fontFamily: 'DM Sans' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('staff.totalPaidYtd')}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(paidThisYear)}</span>
                </div>
              )}
            </div>
            </>) : payOwnerOnly}
            {/* Only hourly staff are clocked, so only they have a time log */}
            {isPartTime && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', marginBottom: 10 }}>{t('staff.timeLog')}</div>
              {timecards.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', padding: '12px 0' }}>{t('staff.noTimecardsMobile')}</div>
              ) : timecards.slice(0, 10).map((tc, i) => {
                const pIn = tc.punchIn ? new Date(tc.punchIn) : null;
                const pOut = tc.punchOut ? new Date(tc.punchOut) : null;
                const hrs = (pIn && pOut) ? ((pOut - pIn) / 3600000).toFixed(1) : null;
                const awaiting = tc.approvalStatus === 'pending';
                return (
                  <div key={tc.id || i} style={{ padding: '8px 0', borderBottom: i < timecards.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{tc.date ? fmtDate(tc.date, { day: '2-digit', month: 'short' }) : '-'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{pIn ? pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} {pOut ? `→ ${pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: hrs ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{hrs ? `${hrs}h` : t('staff.inProgress')}</span>
                    </div>
                    {awaiting && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--accent-yellow)', fontFamily: 'DM Sans' }}>{cardIssues(tc).length} {cardIssues(tc).length === 1 ? t('staff.oneIssue') : t('staff.manyIssues')}</span>
                        {canEditSchedule && (
                          <button onClick={() => openReview(tc)}
                            style={{ background: 'var(--accent-yellow-dim)', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--accent-yellow)', fontFamily: 'DM Sans' }}>
                            Review
                          </button>
                        )}
                      </div>
                    )}
                    {!awaiting && tc.approvedBy && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4 }}>Approved by {tc.approvedBy.firstName}</div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* ── Notes tab ── */}
        {activeTab === 'Notes' && seesPrivate && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {managesTarget && (
              <button onClick={openNoteModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0a0a0f', fontFamily: 'DM Sans', marginBottom: 4 }}>
                <Plus size={15} /> {t('staff.addNote')}
              </button>
            )}
            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('staff.noNotesMobile')}</div>
            ) : notes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{n.date}</span>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontFamily: 'DM Sans' }}>{noteCategoryName(n.category, t)}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{n.createdBy}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: 'DM Sans' }}>{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Modals (shared with desktop) ── */}
        <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditError(''); }} title={t('staff.editProfileTitle')} maxWidth={600}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoChange} />
            <div onClick={() => editPhotoRef.current?.click()} style={{ width: 72, height: 72, borderRadius: '50%', border: `2px dashed ${editForm.photoData ? 'var(--accent-gold)' : 'var(--border)'}`, background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {editForm.photoData ? <img src={editForm.photoData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={t('members.profilePhoto')} /> : <Camera size={24} color="var(--text-muted)" />}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {canEditIdentity
              ? <GemInput label={t('staff.fullName')} required error={editFieldErrors.name} value={editForm.name || ''} onChange={e => { setEF('name', e.target.value); setEditFieldErrors(f => ({ ...f, name: undefined })); }} />
              : <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('staff.fullName')}</label><div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{memberData?.name || '-'}</div></div>}
            <GemInput label={t('staff.phone')} value={editForm.phone || ''} onChange={e => setEF('phone', e.target.value)} />
            <GemInput label={t('staff.email')} error={editFieldErrors.email} value={editForm.email || ''} onChange={e => { setEF('email', e.target.value); setEditFieldErrors(f => ({ ...f, email: undefined })); }} />
            {(memberData?.role === 'general_manager' || !canEditStanding) ? (
              <>
                <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('staff.role')}</label><div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{memberData?.role === 'general_manager' ? 'General Manager / Owner' : (memberData?.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div></div>
              </>
            ) : (
              <>
                <GemSelect label={t('staff.role')} value={roleChoice(editForm.role) || ''} onChange={e => setEF('role', e.target.value)} options={EDITABLE_ROLES.map(r => ({ value: r, label: roleName(r, t) }))} />
              </>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('staff.employmentType')}</label>
{!canEditPayroll && <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{editType === 'Part Time' ? t('staff.partTime') : t('staff.fullTime')}</div>}
              <div style={{ display: 'flex' }}>
                {canEditPayroll && [{ value: 'Full Time', label: t('staff.fullTime') }, { value: 'Part Time', label: t('staff.partTime') }].map((item, i) => (
                  <button key={item.value} type="button"
                    onClick={() => { setEF('employmentType', item.value); setEF('salary', undefined); }}
                    style={{
                      flex: 1, padding: '9px 14px', border: '1px solid var(--border-subtle)',
                      borderRadius: i === 0 ? '10px 0 0 10px' : '0 10px 10px 0',
                      background: editType === item.value ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                      color: editType === item.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      fontFamily: 'DM Sans', fontSize: 13, fontWeight: editType === item.value ? 600 : 400, cursor: 'pointer',
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>
              {typeChanged && (
                <div style={{ marginTop: 12 }}>
                  <GemInput
                    label={editType === 'Part Time' ? t('staff.newHourlyRate') : t('staff.newMonthlySalary')}
                    type="number" min="0"
                    value={editForm.salary ?? (suggestedPay || '')}
                    onChange={e => setEF('salary', e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                    {editWeeklyHours > 0 && salary > 0
                      ? (editType === 'Full Time'
                        ? t('staff.payFromHourly', { rate: formatMoney(salary), hours: editWeeklyHours, total: formatMoney(suggestedPay) })
                        : t('staff.payFromSalary', { salary: formatMoney(salary), hours: editWeeklyHours, total: formatMoney(suggestedPay) }))
                      : t('staff.noRotaForPay')}
                  </div>
                  {payMissing && (
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-red)', marginTop: 6 }}>{t('staff.payRequiredOnSwitch')}</div>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginTop: 4 }}>{t('common.address')}</div>
            <AddressInputs value={editForm} gymCountry={getAuth()?.user?.gymCountry || ''} errors={editFieldErrors} onChange={(k, v) => { setEF(k, v); setEditFieldErrors(f => ({ ...f, [k]: undefined })); }} />
            <GemInput label={t('staff.emergencyContact')} value={editForm.emergencyContact || ''} onChange={e => setEF('emergencyContact', e.target.value)} />
            <GemInput label={t('staff.emergencyPhone')} value={editForm.emergencyPhone || ''} onChange={e => setEF('emergencyPhone', e.target.value)} />
            {editError && <div style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{editError}</div>}
            <button onClick={saveEdit} disabled={editSaving} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '12px', cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, color: '#0a0a0f', fontFamily: 'DM Sans', opacity: editSaving ? 0.7 : 1 }}>
              {editSaving ? t('staff.saving') : t('staff.saveChanges')}
            </button>
          </div>
        </Modal>

        <ManagerAuthModal open={showDeactivateConfirm} onClose={() => setShowDeactivateConfirm(false)} onVerified={() => { deactivate(); setShowDeactivateConfirm(false); }} action={t('staff.deactivateAction', { name: memberData.name })} danger />
        <ManagerAuthModal open={showReactivateAuth} onClose={() => setShowReactivateAuth(false)} onVerified={() => { reactivate(); setShowReactivateAuth(false); }} action={t('staff.reactivateAction')} />
        <ManagerAuthModal open={showNewCodeAuth} usePassword={isSelf} onClose={() => setShowNewCodeAuth(false)} onVerified={issueNewCode} action={t('staff.newCodeAction')} />
        <ManagerAuthModal open={showCodeAuthModal} usePassword={isSelf} onClose={() => setShowCodeAuthModal(false)} onVerified={() => { setShowCodeAuthModal(false); revealCode(); }} action={t('staff.viewCodeAction')} />
        <ManagerAuthModal open={showSalaryAuthModal} onClose={() => setShowSalaryAuthModal(false)} onVerified={() => { setShowSalaryAuthModal(false); setSalaryInput(String(salary)); setPayDayInput(payDay); setShowSalaryEdit(true); }} action={t('staff.changeSalaryAction')} />
        <ManagerAuthModal open={showEditAuth} onClose={() => setShowEditAuth(false)} onVerified={() => { setShowEditAuth(false); openEditForm(); }} action={t('staff.editProfileAction')} />
        <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title={t('staff.addNote')} maxWidth={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <GemSelect label={t('staff.categoryLabel')} value={noteCategory} onChange={e => setNoteCategory(e.target.value)} options={NOTE_CATEGORIES.map(c => ({ value: c, label: noteCategoryName(c, t) }))} />
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontFamily: 'DM Sans' }}>{t('staff.noteLabel')}</label>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {noteError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{noteError}</div>}
            <button onClick={saveNote} disabled={noteSaving} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#0a0a0f', fontFamily: 'DM Sans' }}>{t('staff.saveNote')}</button>
          </div>
        </Modal>
        {/* ── Bonus / Deduction Modal (mobile) ────────────────────────────── */}
        <Modal open={showAdjModal} onClose={() => setShowAdjModal(false)}
          title={adjForm.kind === 'bonus' ? t('staff.addBonus') : t('staff.addDeduction')} maxWidth={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <GemInput label={t('staff.adjLabel')} required value={adjForm.label}
              onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))}
              placeholder={adjForm.kind === 'bonus' ? t('staff.bonusPh') : t('staff.deductionPh')} />
            <GemInput label={`${t('common.amount')} (${getCurrencySymbol()})`} required type="number" min="0" value={adjForm.amount}
              onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))} />
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.howOften')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: true, title: t('staff.adjEveryMonth'), sub: t('staff.adjEveryMonthSub') },
                  { value: false, title: t('staff.adjThisPaycheck'), sub: t('staff.adjThisPaycheckSub', { month: payMonthText(activePayMonth) }) },
                ].map(opt => {
                  const active = adjForm.recurring === opt.value;
                  return (
                    <button key={String(opt.value)} type="button"
                      onClick={() => setAdjForm(f => ({ ...f, recurring: opt.value }))}
                      style={{
                        flex: 1, textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: '10px 12px',
                        background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                        border: `1px solid ${active ? 'rgba(201,169,110,0.45)' : 'var(--border-subtle)'}`,
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <GemInput label={t('staff.noteOptionalLabel')} value={adjForm.note}
              onChange={e => setAdjForm(f => ({ ...f, note: e.target.value }))} />
            {adjError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{adjError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...secondaryBtn, flex: 1, justifyContent: 'center', padding: '11px' }} onClick={() => setShowAdjModal(false)}>{t('common.cancel')}</button>
              <button style={{ ...primaryBtn, flex: 1, justifyContent: 'center', padding: '11px' }} onClick={saveAdjustment}>{t('common.save')}</button>
            </div>
          </div>
        </Modal>
        {/* ── Review Time Card ─────────────────────────────────────────────── */}
        {reviewCard && (() => {
          const clock = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
          const wasEdited = !!(reviewCard.originalPunchIn || reviewCard.originalPunchOut);
          const issues = cardIssues(reviewCard);
          const hoursFrom = (a, b) => (a && b ? ((new Date(b) - new Date(a)) / 3600000).toFixed(1) : null);
          const proposed = hoursFrom(reviewCard.punchIn, reviewCard.punchOut);
          const original = wasEdited ? hoursFrom(reviewCard.originalPunchIn, reviewCard.originalPunchOut) : null;
          const busy = approvingCard === reviewCard.id;
          return (
            <Modal open onClose={() => setReviewCard(null)} title={t('staff.reviewTimeCard')} maxWidth={480}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(reviewCard.date)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' }}>
                    {issues.length} {issues.length === 1 ? t('staff.oneIssue') : t('staff.manyIssues')}
                  </span>
                </div>

                {issues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {issues.map((iss, n) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent-yellow)', flexShrink: 0, marginTop: 6 }} />
                        <span>{iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* What is being asked for, against what was there before */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5 }}>
                  {wasEdited && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <span>{t('staff.originallyLabel')}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', textDecoration: 'line-through' }}>
                        {clock(reviewCard.originalPunchIn)} - {clock(reviewCard.originalPunchOut)}{original ? ` · ${original}h` : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-primary)', fontWeight: 600 }}>
                    <span>{wasEdited ? t('staff.changedToLabel') : t('staff.recordedLabel')}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {clock(reviewCard.punchIn)} - {clock(reviewCard.punchOut)}{proposed ? ` · ${proposed}h` : ''}
                    </span>
                  </div>
                  {reviewCard.adjustmentNote && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {reviewCard.adjustmentNote}
                    </div>
                  )}
                </div>

                {/* The manager can correct the times before accepting */}
                <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <GemInput label={t('attendance.checkIn')} type="time" value={reviewForm.punchIn}
                    onChange={e => setReviewForm(f => ({ ...f, punchIn: e.target.value }))} />
                  <GemInput label={t('attendance.checkOut')} type="time" value={reviewForm.punchOut}
                    onChange={e => setReviewForm(f => ({ ...f, punchOut: e.target.value }))} />
                    <NextDayHint start={reviewForm.punchIn} end={reviewForm.punchOut} />
                </div>

                <GemInput label={t('staff.reviewNoteLabel')} value={reviewForm.note}
                  onChange={e => setReviewForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={t('staff.reviewNotePh')} />

                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {wasEdited ? t('staff.rejectRestores') : t('staff.rejectDiscards')}
                </div>

                {reviewError && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => submitReview(false)}>
                    {t('staff.rejectBtn')}
                  </button>
                  <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => submitReview(true)}>
                    {t('staff.acceptBtn')}
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}

        {/* ── Issue Pay Modal (mobile) ────────────────────────────────────── */}
        <Modal open={showIssuePayModal} onClose={() => setShowIssuePayModal(false)} title={t('reports.issuePay')} maxWidth={440}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <GemSelect label={t('reports.payPeriod')} required value={issuePayForm.month}
            onChange={async e => {
              const month = e.target.value;
              setPayError('');
              setIssuePayForm(f => ({ ...f, month }));
              await loadPayPreview(month);
            }}
            options={unpaidMonthOptions.map(m => ({ value: m, label: payMonthText(m) }))} />
            {renderPaySummary()}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.notesOptional')}</label>
              <textarea style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} value={issuePayForm.note} onChange={e => setIssuePayForm(f => ({ ...f, note: e.target.value }))} placeholder={t('staff.issuePayNotePh')} />
            </div>
            {payError && (
              <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>
                {payError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }} onClick={() => setShowIssuePayModal(false)}>{t('common.cancel')}</button>
              <button style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#0a0a0f', fontFamily: 'DM Sans' }} onClick={confirmIssuePay}>{t('staff.confirmRecord')}</button>
            </div>
          </div>
        </Modal>
        {taskDialogs}
      </div>
    );
  }

  return (
    <div className="page-fade" style={fromFrontDesk ? { padding: 28, maxWidth: 1200, margin: '0 auto' } : undefined}>
      {/* Profile hero: identity + key stats + actions, in one card */}
      <div style={{ ...cardStyle, padding: 0, marginBottom: 24, overflow: 'hidden' }}>
        {/* Identity band */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '22px 24px', flexWrap: 'wrap' }}>
          <input ref={profilePhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
          <ProfilePhoto size={64} />
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{memberData.name}</h1>
              <StatusBadge status={memberData.status} />
              <span style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{roleName(memberData.role, t)}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
              {memberData.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}><Phone size={13} color="var(--text-muted)" />{memberData.phone}</span>}
              {memberData.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}><Mail size={13} color="var(--text-muted)" />{memberData.email}</span>}
            </div>
          </div>
          {/* Account actions sit with Close, so everything you can do to this record is in one place */}
          {(showInviteAction || showStatusAction || showCloseAction) && (
            <div data-hero-actions style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
              {showInviteAction && (
                <button style={{ ...secondaryBtn, color: 'var(--accent-gold)' }} onClick={handleResendInvite} disabled={sendingInvite}>
                  <Mail size={13} /> {sendingInvite ? t('staff.sendingInvite') : t('staff.sendLoginLink')}
                </button>
              )}
              {showStatusAction && memberData.status !== 'inactive' && (
                <button style={dangerBtn} onClick={() => setShowDeactivateConfirm(true)}><UserX size={13} /> {t('staff.deactivate')}</button>
              )}
              {showStatusAction && memberData.status === 'inactive' && (
                <button style={{ ...secondaryBtn, color: 'var(--accent-green)', borderColor: 'var(--accent-green-dim)' }} onClick={() => setShowReactivateAuth(true)}><UserCheck size={13} /> {t('staff.reactivate')}</button>
              )}
              {showCloseAction && (
                <button style={{ ...secondaryBtn, flexShrink: 0 }} onClick={() => backToList()}>
                  <X size={14} /> {t('common.close')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1, background: 'var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: t('staff.department'), value: (() => { const d = departmentOfRole(memberData.role); return d ? t(d.labelKey) : '-'; })() },
            { label: t('staff.employment'), value: memberData.employmentType || t('staff.fullTime') },
            { label: t('staff.joinDate'), value: fmtDate(memberData.joinDate) },
          ].map((s, i) => (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{s.value}</div>
            </div>
          ))}
        </div>

      </div>

      {actionError && <div role="alert" style={{ marginBottom: 16, fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{actionError}</div>}
      {inviteFeedback && (
        <div style={{ marginBottom: 20, background: inviteFeedback.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${inviteFeedback.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>{inviteFeedback.ok ? '✉' : '✕'}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: inviteFeedback.ok ? '#22c55e' : '#ef4444', fontFamily: 'DM Sans', marginBottom: 2 }}>
              {inviteFeedback.ok ? t('staff.loginLinkSent') : t('staff.failedToSend')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {inviteFeedback.msg}
            </div>
          </div>
        </div>
      )}

      {location.state?.newStaff?.photoProblem && <div role="alert" style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{location.state.newStaff.photoProblem}</div>}
      {/* A new employee chooses their own password the first time they sign in */}
      {location.state?.newStaff && (
        <div style={{ marginBottom: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 15, lineHeight: 1.2 }}>✓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#22c55e', fontFamily: 'DM Sans', marginBottom: 2 }}>{t('staff.accountCreated')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
              {t('staff.accountCreatedDesc', { email: location.state.newStaff.inviteEmail || location.state.newStaff.email || '' })}
            </div>
          </div>
        </div>
      )}

      {photoIdInput}
      {/* Profile Setup Checklist - hidden for fitness roles on their own profile */}
      {canEditProfile && (() => {
        const checkItems = [
          { key: 'photo',     labelKey: 'staff.checkPhoto',     done: !!memberData.photoData,        onClick: canEditProfile ? openEdit : undefined },
          { key: 'photoId',   labelKey: 'staff.checkPhotoId',   done: !!memberData.photoIdData,      onClick: canEditIdentity ? () => photoIdRef.current?.click() : undefined },
          { key: 'email',     labelKey: 'staff.checkEmail',     done: !!memberData.email,            onClick: canEditProfile ? openEdit : undefined },
          { key: 'emergency', labelKey: 'staff.checkEmergency', done: !!memberData.emergencyContact, onClick: canEditProfile ? openEdit : undefined },
          { key: 'salary',    labelKey: 'staff.checkSalary',    done: salaryConfigured,              onClick: () => setActiveTab('Pay & Earnings') },
          { key: 'schedule',  labelKey: 'staff.checkSchedule',  done: scheduleConfigured,            onClick: () => setActiveTab('Schedule') },
        ].filter(i => !SETUP_SKIPPED_FOR_OTHER.has(i.key) || memberData.role !== 'other');
        const doneCount = checkItems.filter(i => i.done).length;
        // Setting a profile up is the general manager's job, his own included
        if (role !== 'general_manager' || doneCount === checkItems.length) return null;
        return (
          <div style={{ ...cardStyle, padding: '14px 20px', marginBottom: 20, border: '1px solid var(--accent-gold-dim)', background: 'rgba(201,169,110,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.profileSetup')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.complete', { done: doneCount, total: checkItems.length })}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {checkItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick} disabled={!item.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    background: item.done ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${item.done ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
                    color: item.done ? '#22c55e' : 'var(--text-secondary)',
                    fontSize: 12, fontFamily: 'DM Sans', fontWeight: item.done ? 500 : 400,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{item.done ? '✓' : '○'}</span>
                  {t(item.labelKey)}
                  {!item.done && <span style={{ color: 'var(--accent-gold)', fontSize: 10 }}>→</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        <div style={{ display: 'flex' }}>
          {shownTabs.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 20px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-gold)' : 'transparent'}`, color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: activeTab === tab ? 600 : 400, fontFamily: 'DM Sans', transition: 'color 0.15s' }}>
              {t(shownTabKeys[i])}
              {tab === 'Tasks Assigned' && attentionCount > 0 && (
                <span title={t('staff.tasksNeedAttention', { count: attentionCount })} style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--accent-red)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{attentionCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Details ─────────────────────────────────────────────────────── */}
      {activeTab === 'Details' && (
        <>
          {memberData?.role === 'general_manager' && setup && !setup.complete && !setup.items.ownerProfile && (
            <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>👤</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif', marginBottom: 3 }}>{t('staff.completeGMProfile')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {t('staff.completeGMProfileDesc')}
                </div>
              </div>
            </div>
          )}
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.staffDetails')}</span>
            {canEditProfile && <button style={secondaryBtn} onClick={openEdit}><Edit2 size={13} /> {t('staff.editProfile')}</button>}
          </div>
          <div className="gem-two-col" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { labelKey: 'staff.fullName', value: memberData.name },
              { labelKey: 'staff.role', value: roleName(memberData.role, t) },
              { labelKey: 'staff.department', value: (() => { const d = departmentOfRole(memberData.role); return d ? t(d.labelKey) : '-'; })() },
                      { labelKey: 'staff.phone', value: memberData.phone },
              { labelKey: 'staff.email', value: memberData.email },
              { labelKey: 'common.address', value: formatAddress(memberData) || '-' },
              { labelKey: 'staff.joinDate', value: fmtDate(memberData.joinDate) },
              { labelKey: 'staff.statusLabel', value: memberData.status },
              { labelKey: 'staff.emergencyContact', value: memberData.emergencyContact || '-' },
              { labelKey: 'staff.emergencyPhone', value: memberData.emergencyPhone || '-' },
            ].map(i => (
              <div key={i.labelKey} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t(i.labelKey)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{i.value}</div>
              </div>
            ))}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('staff.digitAccessCode')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {revealedCode && showCode ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 8, color: 'var(--accent-gold)' }}>
                      {revealedCode}
                    </span>
                    <button
                      onClick={() => { setShowCode(false); setRevealedCode(null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2 }}
                      title={t('staff.hideCode')}
                    >
                      <EyeOff size={14} />
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('staff.autoHides')}</span>
                    {/* Issuing a fresh code is the general manager's, for
                        himself and for anyone who works here */}
                    {canIssueCodes && (
                      <button
                        onClick={() => { setNewCodeNotice(''); setShowNewCodeAuth(true); }}
                        disabled={codeLoading}
                        title={t('staff.newCodeAction')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                          fontFamily: 'DM Sans',
                        }}
                      >
                        <RefreshCw size={10} />
                        {t('staff.newCode')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 8, color: 'var(--text-muted)' }}>
                      ••••
                    </span>
                    <button
                      onClick={() => setShowCodeAuthModal(true)}
                      disabled={codeLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'var(--accent-gold-dim)', border: 'none',
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, color: 'var(--accent-gold)',
                        fontFamily: 'DM Sans',
                      }}
                    >
                      <Lock size={10} />
                      {codeLoading ? t('staff.loadingCode') : t('staff.viewCodeFull')}
                    </button>
                  </>
                )}
              </div>
              {newCodeNotice && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-green)', fontFamily: 'DM Sans' }}>{newCodeNotice}</div>
              )}
              {codeError && (
                <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{codeError}</div>
              )}
            </div>
          </div>

          {/* Photo ID */}
          <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>{t('staff.checkPhotoId')}</div>
            {photoIdBlock}
          </div>
        </div>

        {/* Change Password - only on own profile */}
        {isOwnProfile && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <button onClick={() => setShowChangePw(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 20px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('staff.changePassword')}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{showChangePw ? '▲' : '▼'}</span>
            </button>
            {showChangePw && (
              <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <GemInput label={t('staff.currentPassword')} required type="password" autoComplete="current-password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
                <GemInput label={t('staff.newPassword')} required type="password" autoComplete="new-password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
                <GemInput label={t('staff.confirmNewPassword')} required type="password" autoComplete="new-password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                {pwError && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{pwError}</div>}
                {pwSuccess && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#22c55e', fontFamily: 'DM Sans' }}>{t('staff.pwChangedSuccess')}</div>}
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button onClick={handleChangePassword} disabled={pwSaving} style={{ ...primaryBtn, padding: '9px 20px', opacity: pwSaving ? 0.7 : 1, cursor: pwSaving ? 'not-allowed' : 'pointer' }}>
                    {pwSaving ? t('staff.saving') : t('staff.updatePassword')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* ── Tasks Assigned ───────────────────────────────────────────────── */}
      {activeTab === 'Tasks Assigned' && sectionProblem('tasks', { marginBottom: 12 })}
      {activeTab === 'Tasks Assigned' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.tasksTitle', { name: memberData.name })}</span>
          </div>
          {localTasks.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('staff.noTasksTitle')} hint={t('staff.noTasksDesc')} />
          ) : (
            <>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'kind', label: t('staff.taskKind'), options: [['All', t('common.all')], ['personal', t('staff.kindPersonal')], ['created', t('staff.kindCreated')]] },
                  { key: 'status', label: t('common.status'), options: [['All', t('common.all')], ['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')]] },
                  { key: 'priority', label: t('tasks.priority'), options: [['All', t('common.all')], ['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]] },
                  { key: 'age', label: t('staff.taskAge'), options: [['All', t('common.all')], ['7', t('staff.ageWeek')], ['30', t('staff.ageMonth')], ['old', t('staff.ageOlder')]] },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.label}</span>
                    <select value={taskFilters[f.key]} onChange={e => setTaskFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer' }}>
                      {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {filteredTasks.length} {filteredTasks.length === 1 ? t('staff.taskOne') : t('staff.taskMany')}
                </span>
              </div>

              {filteredTasks.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('staff.noTasksMatchFilters')}</div>
              ) : (
                <div className="gem-table-scroll">
                {taskError && !viewingTask && !doneTask && <div role="alert" style={{ margin: '12px 20px 0', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{taskError}</div>}<table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[t('staff.taskTitleCol'), t('staff.taskDueDateCol'), t('staff.taskPriorityCol'), t('staff.taskStatusCol'), ''].map((h, i) => (
                        <th key={h || `c${i}`} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(tk => {
                      const pc = PRIORITY_COLORS[tk.priority] || PRIORITY_COLORS.Medium;
                      const age = taskAgeDays(tk);
                      return (
                        <tr key={tk.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                          onClick={() => setViewingTask(tk)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {tk.title}
                            {age !== null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{age === 0 ? t('staff.ageToday') : t('staff.ageDaysAgo', { count: age })}</div>}
                          </td>
                          <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{tk.dueDate ? String(tk.dueDate).slice(0, 10) : ''}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ ...pc, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4 }}>{priorityName(tk.priority, t)}</span>
                          </td>
                          <td style={{ padding: '12px 20px' }}><StatusBadge status={(tk.status || 'pending').toLowerCase()} /></td>
                          <td style={{ padding: '12px 20px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            {isCalInvite(tk) ? (
                              canRespondInvite(tk) && (tk.status || 'Pending') === 'Pending' ? (
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button disabled={taskBusy} onClick={() => changeTaskStatus(tk.id, 'Accepted')} style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11, color: 'var(--accent-green)', borderColor: 'var(--accent-green-dim)' }}>{t('calendar.accept')}</button>
                                  <button disabled={taskBusy} onClick={() => changeTaskStatus(tk.id, 'Declined')} style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}>{t('calendar.decline')}</button>
                                </div>
                              ) : (
                                <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setViewingTask(tk)}>{t('staff.viewTask')}</button>
                              )
                            ) : canUpdateTasks ? (
                              <select value={tk.status || 'Pending'} disabled={taskBusy}
                                onChange={e => requestStatusChange(tk, e.target.value)}
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer' }}>
                                {[['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            ) : (
                              <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setViewingTask(tk)}>{t('staff.viewTask')}</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Schedule ─────────────────────────────────────────────────────── */}
      {activeTab === 'Schedule' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.weeklySchedule')} : {memberData.name}</span>
            {canEditSchedule ? (
              <button style={primaryBtn} onClick={saveSchedule}>
                {scheduleSaved ? `✓ ${t('staff.saved')}` : t('staff.saveSchedule')}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('staff.scheduleReadOnly')}</span>
            )}
          </div>
          {canEditSchedule && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Segmented toggle */}
              <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: 3 }}>
                {[
                  { value: 'repeating', label: t('staff.schedRepeating') },
                  { value: 'week', label: t('staff.schedOneWeek') },
                ].map(opt => {
                  const active = scheduleMode === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => switchScheduleMode(opt.value)}
                      style={{
                        cursor: 'pointer', borderRadius: 999, padding: '6px 16px', border: 'none',
                        fontSize: 12.5, fontWeight: 600, fontFamily: 'DM Sans',
                        background: active ? 'var(--accent-gold)' : 'transparent',
                        color: active ? '#0a0a0f' : 'var(--text-secondary)',
                        transition: 'background 0.15s, color 0.15s',
                      }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {scheduleMode === 'week' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                  {scheduleOverrides[selectedWeek] ? (
                    <button onClick={clearWeekOverride}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                      {t('staff.clearWeek')}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('staff.followsPatternShort')}</span>
                  )}

                  {/* Week stepper */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <button aria-label={t('common.previousWeek')} onClick={() => stepWeek(-1)} disabled={!canStepWeek(-1)} title={t('staff.prevWeek')}
                      style={{ background: 'none', border: 'none', padding: '7px 9px', cursor: canStepWeek(-1) ? 'pointer' : 'default', color: canStepWeek(-1) ? 'var(--text-secondary)' : 'var(--border)', display: 'flex' }}>
                      <ChevronLeft size={15} />
                    </button>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', minWidth: 132, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {currentWeek?.label}
                      {scheduleOverrides[selectedWeek] && <span style={{ color: 'var(--accent-gold)', marginLeft: 5 }}>•</span>}
                    </span>
                    <button aria-label={t('common.nextWeek')} onClick={() => stepWeek(1)} disabled={!canStepWeek(1)} title={t('staff.nextWeek')}
                      style={{ background: 'none', border: 'none', padding: '7px 9px', cursor: canStepWeek(1) ? 'pointer' : 'default', color: canStepWeek(1) ? 'var(--text-secondary)' : 'var(--border)', display: 'flex' }}>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t('staff.schedRepeatingHint')}</span>
              )}
            </div>
          )}

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scheduleError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{scheduleError}</div>}
            {DAYS.map((day, di) => (
              <div key={day} className="gem-table-scroll" style={{ borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: 16, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10, opacity: schedule[day].off ? 0.5 : 1, minWidth: 420 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t(DAY_KEYS[di])}</span>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('staff.scheduleStart')}</label>
                  <TimeInput value={schedule[day].start} disabled={schedule[day].off || !canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'start', e.target.value)} style={{ ...inputStyle, opacity: (schedule[day].off || !canEditSchedule) ? 0.5 : 1, cursor: canEditSchedule ? 'auto' : 'default' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('staff.scheduleEnd')}</label>
                  <TimeInput value={schedule[day].end} disabled={schedule[day].off || !canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'end', e.target.value)} style={{ ...inputStyle, opacity: (schedule[day].off || !canEditSchedule) ? 0.5 : 1, cursor: canEditSchedule ? 'auto' : 'default' }} />
                  <NextDayHint start={schedule[day].start} end={schedule[day].end} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                  <input type="checkbox" id={`off-${day}`} checked={schedule[day].off} disabled={!canEditSchedule} onChange={e => canEditSchedule && setDay(day, 'off', e.target.checked)} style={{ width: 14, height: 14, cursor: canEditSchedule ? 'pointer' : 'default', accentColor: 'var(--accent-gold)' }} />
                  <label htmlFor={`off-${day}`} style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: canEditProfile ? 'pointer' : 'default', fontFamily: 'DM Sans' }}>{t('staff.dayOff')}</label>
                </div>
              </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {t(scheduleMode === 'week' ? 'staff.workingDaysThisWeek' : 'staff.workingDays', { count: DAYS.filter(d => !schedule[d].off).length })}
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar ─────────────────────────────────────────────────────── */}
      {activeTab === 'Calendar' && sectionProblem('calendar', { marginBottom: 12 })}
      {activeTab === 'Calendar' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.calendarTitle', { name: memberData.name })}</span>
          </div>
          {calendarAgenda}
        </div>
      )}

      {activeTab === 'Clients' && showsClients && <CoachClientsPanel staffId={memberData.id} />}

      {/* ── Pay & Earnings ───────────────────────────────────────────────── */}
      {activeTab === 'Pay & Earnings' && seesPrivate && (
        <div>
          {sectionProblem('pay', { marginBottom: 12 })}
          <div style={{ marginBottom: 16 }}>{paySummary}</div>

          {seesPayDetails ? (<>
          {/* One card: the two ledgers side by side, and the pay they add up to */}
          <div style={{ ...cardStyle, marginBottom: 16, overflow: 'hidden' }}>
            <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {ADJ_KINDS.map((g, gi) => {
                const items = periodAdjustments.filter(a => a.kind === g.kind);
                const total = g.kind === 'bonus' ? activeBonusTotal : activeDeductionTotal;
                return (
                  <div key={g.kind} style={{ borderLeft: gi === 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px 12px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: g.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{t(g.titleKey)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: total ? g.color : 'var(--text-muted)' }}>
                        {total ? `${g.sign}${formatMoney(total)}` : '-'}
                      </span>
                      {canEditPayroll && (
                        <button style={{ ...secondaryBtn, padding: '4px 9px', fontSize: 11 }} onClick={() => openAdjModal(g.kind)}>
                          <Plus size={11} /> {t('common.add')}
                        </button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ padding: '14px 18px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>{t(g.emptyKey)}</div>
                    ) : items.map((a, i) => {
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', background: i % 2 ? 'transparent' : 'transparent' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.recurring ? t('staff.adjEveryMonth') : t('staff.adjThisPaycheckOnly')}</div>
                            {adjRemoveError?.id === a.id && <div role="alert" style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4, lineHeight: 1.4 }}>{adjRemoveError.text}</div>}
                          </div>
                          <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: g.color }}>
                            {formatMoney(a.amount)}
                          </span>
                          {canEditPayroll && (
                            <button onClick={() => deleteAdjustment(a)} title={t('members.remove')} style={adjIconBtn}><Trash2 size={13} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* What the two ledgers add up to for this period */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                <span>{formatMoney(basicPay)}</span>
                <span style={{ color: 'var(--accent-green)' }}>+ {formatMoney(activeBonusTotal)}</span>
                <span style={{ color: 'var(--accent-red)' }}>− {formatMoney(activeDeductionTotal)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-gold)', lineHeight: 1.1 }}>
                  {formatMoney(payPeriod.amount)}
                </span>
                {payPeriod.handOver != null && payPeriod.handOver !== payPeriod.amount && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('staff.handOverShort', { amount: formatMoney(payPeriod.handOver) })}</span>
                )}
                <span style={{ fontSize: 11, color: payPeriod.urgent ? 'var(--accent-red)' : 'var(--text-muted)', fontWeight: payPeriod.urgent ? 600 : 400 }}>
                  {payPeriod.line}
                </span>
              </div>
              {payShortfall > 0 && (
                <div style={{ width: '100%', fontSize: 11.5, fontWeight: 600, color: 'var(--accent-red)' }}>
                  {t('staff.payShortfallLine', { amount: formatMoney(payShortfall) })}
                </div>
              )}
            </div>
          </div>

          {/* Pay history */}
          <div style={cardStyle}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.payHistory')}</span>
              </div>
              {canEditPayroll && salary > 0 && (
                <button onClick={handleIssuePay} style={{ ...primaryBtn, padding: '6px 16px', fontSize: 12 }}>
                  {t('reports.issuePay')}
                </button>
              )}
            </div>
            <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t('reports.month'), t('common.amount'), t('common.notes'), t('staff.issuedOn'), t('common.status'), ''].map((h, i) => (
                    <th key={h || `col${i}`} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payHistory.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 0 }}><EmptyState icon={Banknote} title={t('staff.noPayRecordsTitle')} hint={t('staff.noPayRecordsHint')} /></td></tr>
                ) : payHistory.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setSelectedPaystub(p); setShowPaystubView(true); }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{payMonthText(p.month)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatMoney(p.grossPay)}
                      {p.netPay !== p.grossPay && (
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{t('staff.handOverShort', { amount: formatMoney(p.netPay) })}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 240 }}>{p.note || ''}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{p.issuedAt ? fmtDate(p.issuedAt) : ''}</td>
                    <td style={{ padding: '12px 20px' }}><StatusPill status={p.status} /></td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <span onClick={e => e.stopPropagation()}>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('staff.viewPaystub'), icon: <FileText size={15} />, onClick: () => { setSelectedPaystub(p); setShowPaystubView(true); } },
                        ]} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {payHistory.length > 0 && (
                <tfoot>
                  {/* Sits inside the table so it stays aligned to the card edge */}
                  <tr>
                    <td colSpan={6} style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('staff.totalPaidYtd')}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(paidThisYear)}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table></div>
          </div>
          </>) : payOwnerOnly}

          {/* Only hourly staff are clocked, so only they have a time log */}
          {isPartTime && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.timeLog')}</span>
            </div>
            {timecards.length === 0 ? (
              <EmptyState icon={ClipboardList} title={t('staff.noTimecardsTitle')} hint={t('staff.noTimecards')} />
            ) : (
              <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[t('common.date'), t('attendance.checkIn') || 'Check In', t('attendance.checkOut') || 'Check Out', t('staff.hoursWorkedLabel'), ''].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timecards.slice(0, 20).map((tc, i) => {
                    const pIn = tc.punchIn ? new Date(tc.punchIn) : null;
                    const pOut = tc.punchOut ? new Date(tc.punchOut) : null;
                    const hrs = (pIn && pOut) ? ((pOut - pIn) / 3600000).toFixed(1) : null;
                    const awaiting = tc.approvalStatus === 'pending';
                    return (
                      <tr key={tc.id || i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {tc.date ? fmtDate(tc.date) : '-'}
                        </td>
                        <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {pIn ? pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '11px 20px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {pOut ? pOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--accent-yellow)', fontSize: 12 }}>{t('staff.inProgress')}</span>}
                        </td>
                        <td style={{ padding: '11px 20px', fontSize: 13, fontWeight: 700, color: hrs ? 'var(--accent-gold)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {hrs ? `${hrs}h` : '-'}
                        </td>
                        <td style={{ padding: '11px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {awaiting ? (canEditSchedule ? (
                            <button onClick={() => openReview(tc)}
                              style={{ ...secondaryBtn, padding: '4px 12px', fontSize: 11, color: 'var(--accent-yellow)', borderColor: 'rgba(245,158,11,0.4)' }}>
                              Review
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--accent-yellow)' }}>{t('reports.awaitingReview')}</span>
                          )) : tc.approvalStatus === 'rejected' ? (
                            <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{t('common.rejected')}</span>
                          ) : tc.approvedBy ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Approved by {tc.approvedBy.firstName}</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
          )}

        </div>
      )}

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {activeTab === 'Notes' && seesPrivate && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.notesTitle')}</span>
            {managesTarget && <button style={primaryBtn} onClick={openNoteModal}><Plus size={13} />{t('staff.addNote')}</button>}
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.length === 0 && (
              <div style={cardStyle}>
                <EmptyState icon={FileText} title={t('staff.noNotesTitle')} hint={t('staff.noNotes')} />
              </div>
            )}
            {notes.map(n => (
              <div key={n.id} style={{ ...cardStyle, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{n.date}</span>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{noteCategoryName(n.category, t)}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('staff.noteBy', { name: n.createdBy })}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Profile Modal ───────────────────────────────────────────── */}
      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditError(''); }} title={t('staff.editProfileTitle')} maxWidth={600}>
        {/* Profile photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoChange} />
          <div
            onClick={() => editPhotoRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `2px dashed ${editForm.photoData ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: 'var(--bg-elevated)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = editForm.photoData ? 'var(--accent-gold)' : 'var(--border)'}
          >
            {editForm.photoData
              ? <img src={editForm.photoData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={t('members.profilePhoto')} />
              : <Camera size={28} color="var(--text-muted)" />
            }
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
            {editForm.photoData ? t('staff.clickToChangePhoto') : t('staff.uploadProfilePhoto')}
          </span>
        </div>

        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            {canEditIdentity
              ? <GemInput label={t('staff.fullName')} required error={editFieldErrors.name} value={editForm.name || ''} onChange={e => { setEF('name', e.target.value); setEditFieldErrors(f => ({ ...f, name: undefined })); }} />
              : <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('staff.fullName')}</label><div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{memberData?.name || '-'}</div></div>}
          </div>
          <GemInput label={t('staff.phone')} value={editForm.phone || ''} onChange={e => setEF('phone', e.target.value)} />
          <GemInput label={t('staff.email')} error={editFieldErrors.email} value={editForm.email || ''} onChange={e => { setEF('email', e.target.value); setEditFieldErrors(f => ({ ...f, email: undefined })); }} />
          {(memberData?.role === 'general_manager' || !canEditStanding) ? (
            <>
              <div><label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, display: 'block', marginBottom: 5 }}>{t('staff.role')}</label><div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{memberData?.role === 'general_manager' ? 'General Manager / Owner' : (memberData?.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div></div>
            </>
          ) : (
            <>
              <GemSelect label={t('staff.role')} value={roleChoice(editForm.role) || ''} onChange={e => setEF('role', e.target.value)}
                options={EDITABLE_ROLES.map(r => ({ value: r, label: roleName(r, t) }))} />
            </>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('staff.employmentType')}</label>
{!canEditPayroll && <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{editType === 'Part Time' ? t('staff.partTime') : t('staff.fullTime')}</div>}
            <div style={{ display: 'flex' }}>
              {canEditPayroll && [{ value: 'Full Time', label: t('staff.fullTime') }, { value: 'Part Time', label: t('staff.partTime') }].map((item, i) => (
                <button key={item.value} type="button"
                  onClick={() => { setEF('employmentType', item.value); setEF('salary', undefined); }}
                  style={{
                    flex: 1, padding: '9px 14px', border: '1px solid var(--border-subtle)',
                    borderRadius: i === 0 ? '10px 0 0 10px' : '0 10px 10px 0',
                    background: editType === item.value ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                    color: editType === item.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontFamily: 'DM Sans', fontSize: 13, fontWeight: editType === item.value ? 600 : 400, cursor: 'pointer',
                  }}>
                  {item.label}
                </button>
              ))}
            </div>
            {typeChanged && (
              <div style={{ marginTop: 12 }}>
                <GemInput
                  label={editType === 'Part Time' ? t('staff.newHourlyRate') : t('staff.newMonthlySalary')}
                  type="number" min="0"
                  value={editForm.salary ?? (suggestedPay || '')}
                  onChange={e => setEF('salary', e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                  {editWeeklyHours > 0 && salary > 0
                    ? (editType === 'Full Time'
                      ? t('staff.payFromHourly', { rate: formatMoney(salary), hours: editWeeklyHours, total: formatMoney(suggestedPay) })
                      : t('staff.payFromSalary', { salary: formatMoney(salary), hours: editWeeklyHours, total: formatMoney(suggestedPay) }))
                    : t('staff.noRotaForPay')}
                </div>
                {payMissing && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-red)', marginTop: 6 }}>{t('staff.payRequiredOnSwitch')}</div>
                )}
              </div>
            )}
          </div>
          <GemSelect label={t('staff.statusLabel')} value={isOwnerAccount ? 'active' : (editForm.status || 'active')}
            onChange={e => setEF('status', e.target.value)}
            disabled={isOwnerAccount || !canChangeStatus}
            hint={isOwnerAccount ? t('staff.ownerAlwaysActive') : (!canChangeStatus ? t('staff.cannotDeactivateSelf') : undefined)}
            options={[{ value: 'active', label: t('staff.activeStatus') }, { value: 'inactive', label: t('staff.inactiveStatus') }]} />
          <div style={{ gridColumn: '1 / -1', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginTop: 4 }}>
            {t('common.address')}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <AddressInputs value={editForm} gymCountry={getAuth()?.user?.gymCountry || ''} errors={editFieldErrors} onChange={(k, v) => { setEF(k, v); setEditFieldErrors(f => ({ ...f, [k]: undefined })); }} />
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)', marginTop: 4 }}>
            {t('staff.emergencyContactInfo')}
          </div>
          <GemInput label={t('staff.emergencyContact')} value={editForm.emergencyContact || ''} onChange={e => setEF('emergencyContact', e.target.value)} />
          <GemInput label={t('staff.emergencyPhone')} value={editForm.emergencyPhone || ''} onChange={e => setEF('emergencyPhone', e.target.value)} />
        </div>
        {editError && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans', marginTop: 12 }}>
            {editError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={secondaryBtn} onClick={() => { setShowEditModal(false); setEditError(''); }} disabled={editSaving}>{t('common.cancel')}</button>
          <button style={{ ...primaryBtn, opacity: editSaving ? 0.6 : 1, cursor: editSaving ? 'not-allowed' : 'pointer' }} onClick={saveEdit} disabled={editSaving}>
            {editSaving ? t('staff.savingChanges') : t('staff.saveChanges')}
          </button>
        </div>
      </Modal>

      {/* ── Paystub View Modal ───────────────────────────────────────────── */}
      <Modal open={showPaystubView} onClose={() => setShowPaystubView(false)} title={t('staff.paystubTitle')} maxWidth={620}>
        {selectedPaystub && (() => {
          const month = selectedPaystub.month;
          // Read the breakdown captured when this pay was issued, so the payslip
          // still reflects that period even if adjustments have changed since.
          const bd = selectedPaystub.breakdown || null;
          const deds = bd?.deductions || [];
          const totalDeds = deds.reduce((s, d) => s + d.amount, 0);
          const allowanceItems = bd?.bonuses || [];
          const totalAllowances = allowanceItems.reduce((s, a) => s + a.amount, 0);
          // Hours are only meaningful for part-time pay, and the figure that
          // matters is the one captured when this pay was issued.
          const paidHours = bd?.hoursWorked ?? null;
          const paidRate = bd?.hourlyRate ?? null;
          const basePay = bd?.basePay ?? selectedPaystub.basicPay;
          const grossPay = selectedPaystub.grossPay ?? (basePay + totalAllowances);
          const netPay = selectedPaystub.netPay ?? Math.max(0, grossPay - totalDeds);
          return (
            <div>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{memberData.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{roleName(memberData.role, t)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('staff.payPeriod')}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-gold)' }}>{payMonthText(month)}</div>
                    <StatusPill status={selectedPaystub.status} />
                  </div>
                </div>
                <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
                  {[
                    // Hours and an hourly rate only mean something for part-time pay.
                    // Full-time pay is the same figure whatever the hours.
                    ...(paidHours !== null ? [
                      { label: t('staff.hoursWorkedLabel'), value: `${paidHours} hrs` },
                      { label: t('staff.hourlyRate'), value: paidRate ? formatMoney(paidRate) : '-' },
                    ] : [
                      { label: t('staff.employment'), value: t('staff.fullTime') },
                      { label: t('staff.monthlyBasic'), value: formatMoney(basePay) },
                    ]),
                    { label: t('staff.payPeriod'), value: month },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earnings */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>{t('staff.earningsBonuses')}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{isPartTime ? t('staff.hoursWorkedPay') : t('staff.basicSalary')}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(basePay)}</span>
                  </div>
                  {allowanceItems.map((a, i) => (
                    <div key={`bonus-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.label}{a.recurring ? '' : ' (one time)'}</span>
                      <span style={{ fontSize: 13, color: 'var(--accent-green)' }}>+{formatMoney(a.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(34,197,94,0.06)', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.totalEarnings')}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(basePay + totalAllowances)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>{t('staff.deductionsLabel')}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  {deds.length === 0 && (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>{t('staff.noDeductions')}</div>
                  )}
                  {deds.map((d, i) => (
                    <div key={`ded-${i}`} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{d.label}{d.recurring ? '' : ' (one time)'}</div>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--accent-red)', fontWeight: 600 }}>-{formatMoney(d.amount)}</span>
                      </div>
                    </div>
                  ))}
                  {totalDeds > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('staff.totalDeductions')}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'Manrope, sans-serif' }}>-{formatMoney(totalDeds)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Net Pay */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.15), rgba(201,169,110,0.05))', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('staff.netPayLabel')} : {payMonthText(month)}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(netPay)}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                  <div>{t('staff.earningsAmount', { amount: formatMoney(grossPay) })}</div>
                  <div>{t('staff.deductionsAmount', { amount: formatMoney(totalDeds) })}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={() => setShowPaystubView(false)}>{t('staff.close')}</button>
                <button style={primaryBtn} onClick={async () => {
                  // A proper payslip, as a PDF. The PDF maker is fetched only when one is
                  // downloaded: it was half of this page's size (F-024)
                  const { downloadPaystubPdf } = await import('../utils/paystubPdf');
                  downloadPaystubPdf({
                    gymName: getAuth()?.user?.gymName || '',
                    employeeName: memberData.name,
                    role: roleName(memberData.role, t),
                    employment: isPartTime ? t('staff.partTime') : t('staff.fullTime'),
                    month,
                    status: selectedPaystub.status,
                    issuedAt: selectedPaystub.issuedAt ? fmtDate(selectedPaystub.issuedAt) : null,
                    paidAt: selectedPaystub.paidAt ? fmtDate(selectedPaystub.paidAt) : null,
                    hours: paidHours,
                    rate: paidRate,
                    basePay,
                    bonuses: allowanceItems,
                    deductions: deds,
                    grossPay,
                    totalDeductions: totalDeds,
                    netPay,
                    note: selectedPaystub.note || '',
                  });
                }}>
                  <Download size={13} />{t('staff.downloadPaystub')}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── View access code ──────────────────────────────────────────── */}
      {/* Someone else's code is confirmed with your own 4-digit code. Only your own
          code needs your password, since asking for that code would be circular. */}
      <ManagerAuthModal
        open={showCodeAuthModal} usePassword={isSelf}
        onClose={() => setShowCodeAuthModal(false)}
        onConfirm={() => { setShowCodeAuthModal(false); revealCode(); }}
        action={t('staff.viewCodeFor', { name: memberData.name })}
      />

      {/* ── A new access code: your password for your own, your code for anyone else's */}
      <ManagerAuthModal open={showNewCodeAuth} usePassword={isSelf} onClose={() => setShowNewCodeAuth(false)} onVerified={issueNewCode} action={t('staff.newCodeAction')} />

      {/* ── Salary change. requires manager PIN ────────────────────────── */}
      <ManagerAuthModal
        open={showSalaryAuthModal}
        onClose={() => setShowSalaryAuthModal(false)}
        onConfirm={() => { setSalaryInput(String(salary)); setPayDayInput(payDay); setShowSalaryEdit(true); setShowSalaryAuthModal(false); }}
        action={t(isPartTime ? 'staff.changeRateFor' : 'staff.changeSalaryFor', { name: memberData.name })}
      />

      {/* ── Deactivate. requires manager PIN ────────────────────────────── */}
      <ManagerAuthModal
        open={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={() => { deactivate(); setShowDeactivateConfirm(false); }}
        action={t('staff.deactivateAction', { name: memberData.name })}
        danger
      />

      {/* ── Reactivate. requires manager PIN ───────────────────────────── */}
      <ManagerAuthModal
        open={showReactivateAuth}
        onClose={() => setShowReactivateAuth(false)}
        onConfirm={() => { reactivate(); setShowReactivateAuth(false); }}
        action={t('staff.reactivateFor', { name: memberData.name })}
      />

      <ManagerAuthModal
        open={showEditAuth}
        onClose={() => setShowEditAuth(false)}
        onVerified={() => { setShowEditAuth(false); openEditForm(); }}
        action={t('staff.editProfileAction')}
      />

      {taskDialogs}

      {/* ── Bonus / Deduction Modal ───────────────────────────────────────── */}
      <Modal open={showAdjModal} onClose={() => setShowAdjModal(false)}
        title={adjForm.kind === 'bonus' ? t('staff.addBonus') : t('staff.addDeduction')} maxWidth={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GemInput label={t('staff.adjLabel')} required value={adjForm.label}
            onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))}
            placeholder={adjForm.kind === 'bonus' ? t('staff.bonusPh') : t('staff.deductionPh')} />
          <GemInput label={`${t('common.amount')} (${getCurrencySymbol()})`} required type="number" min="0" value={adjForm.amount}
            onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))} />

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.howOften')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: true, title: t('staff.adjEveryMonth'), sub: t('staff.adjEveryMonthSub') },
                { value: false, title: t('staff.adjThisPaycheck'), sub: t('staff.adjThisPaycheckSub', { month: payMonthText(activePayMonth) }) },
              ].map(opt => {
                const active = adjForm.recurring === opt.value;
                return (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setAdjForm(f => ({ ...f, recurring: opt.value }))}
                    style={{
                      flex: 1, textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: '10px 12px',
                      background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                      border: `1px solid ${active ? 'rgba(201,169,110,0.45)' : 'var(--border-subtle)'}`,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>


          <GemInput label={t('staff.noteOptionalLabel')} value={adjForm.note}
            onChange={e => setAdjForm(f => ({ ...f, note: e.target.value }))} />

          {adjError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{adjError}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setShowAdjModal(false)}>{t('common.cancel')}</button>
            <button style={primaryBtn} onClick={saveAdjustment}>{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* ── Issue Pay Modal ───────────────────────────────────────────────── */}
      <Modal open={showIssuePayModal} onClose={() => setShowIssuePayModal(false)} title={t('reports.issuePay')} maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GemSelect label={t('reports.payPeriod')} required value={issuePayForm.month}
            onChange={async e => {
              const month = e.target.value;
              setPayError('');
              setIssuePayForm(f => ({ ...f, month }));
              await loadPayPreview(month);
            }}
            options={unpaidMonthOptions.map(m => ({ value: m, label: payMonthText(m) }))} />
          {renderPaySummary()}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.notesOptional')}</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={issuePayForm.note} onChange={e => setIssuePayForm(f => ({ ...f, note: e.target.value }))} placeholder={t('staff.issuePayNotePh')} />
          </div>
          {payError && (
            <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>
              {payError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setShowIssuePayModal(false)}>{t('common.cancel')}</button>
            <button style={primaryBtn} onClick={confirmIssuePay}>{t('staff.confirmRecord')}</button>
          </div>
        </div>
      </Modal>

      {/* ── Review Time Card ─────────────────────────────────────────────── */}
      {reviewCard && (() => {
        const clock = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
        const wasEdited = !!(reviewCard.originalPunchIn || reviewCard.originalPunchOut);
        const issues = cardIssues(reviewCard);
        const hoursFrom = (a, b) => (a && b ? ((new Date(b) - new Date(a)) / 3600000).toFixed(1) : null);
        const proposed = hoursFrom(reviewCard.punchIn, reviewCard.punchOut);
        const original = wasEdited ? hoursFrom(reviewCard.originalPunchIn, reviewCard.originalPunchOut) : null;
        const busy = approvingCard === reviewCard.id;
        return (
          <Modal open onClose={() => setReviewCard(null)} title={t('staff.reviewTimeCard')} maxWidth={480}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(reviewCard.date)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' }}>
                  {issues.length} {issues.length === 1 ? t('staff.oneIssue') : t('staff.manyIssues')}
                </span>
              </div>

              {issues.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {issues.map((iss, n) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent-yellow)', flexShrink: 0, marginTop: 6 }} />
                      <span>{iss.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* What is being asked for, against what was there before */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 12.5 }}>
                {wasEdited && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                    <span>{t('staff.originallyLabel')}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', textDecoration: 'line-through' }}>
                      {clock(reviewCard.originalPunchIn)} - {clock(reviewCard.originalPunchOut)}{original ? ` · ${original}h` : ''}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-primary)', fontWeight: 600 }}>
                  <span>{wasEdited ? t('staff.changedToLabel') : t('staff.recordedLabel')}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {clock(reviewCard.punchIn)} - {clock(reviewCard.punchOut)}{proposed ? ` · ${proposed}h` : ''}
                  </span>
                </div>
                {reviewCard.adjustmentNote && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {reviewCard.adjustmentNote}
                  </div>
                )}
              </div>

              {/* The manager can correct the times before accepting */}
              <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <GemInput label={t('attendance.checkIn')} type="time" value={reviewForm.punchIn}
                  onChange={e => setReviewForm(f => ({ ...f, punchIn: e.target.value }))} />
                <GemInput label={t('attendance.checkOut')} type="time" value={reviewForm.punchOut}
                  onChange={e => setReviewForm(f => ({ ...f, punchOut: e.target.value }))} />
                  <NextDayHint start={reviewForm.punchIn} end={reviewForm.punchOut} />
              </div>

              <GemInput label={t('staff.reviewNoteLabel')} value={reviewForm.note}
                onChange={e => setReviewForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t('staff.reviewNotePh')} />

              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {wasEdited ? t('staff.rejectRestores') : t('staff.rejectDiscards')}
              </div>

              {reviewError && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>
                  {reviewError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => submitReview(false)}>
                  {t('staff.rejectBtn')}
                </button>
                <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => submitReview(true)}>
                  {t('staff.acceptBtn')}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Add Note Modal ────────────────────────────────────────────────── */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title={t('staff.addNote')} maxWidth={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.noteLabel')}</label>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder={t('staff.enterNote')} />
          </div>
          <GemSelect label={t('staff.categoryLabel')} value={noteCategory} onChange={e => setNoteCategory(e.target.value)}
            options={NOTE_CATEGORIES.map(c => ({ value: c, label: noteCategoryName(c, t) }))} />
          {noteError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{noteError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setShowNoteModal(false)}>{t('common.cancel')}</button>
            <button style={{ ...primaryBtn, opacity: noteSaving ? 0.6 : 1 }} disabled={noteSaving} onClick={saveNote}>{t('staff.saveNote')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
