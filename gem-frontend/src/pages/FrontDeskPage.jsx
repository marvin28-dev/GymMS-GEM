import { useState, useEffect, useMemo, useRef } from 'react';
import { getCurrencySymbol, formatMoney } from '../utils/currency';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLanguage } from '../contexts/LanguageContext';
import CodeInput from '../components/ui/CodeInput';
import {
  Search, X, UserCheck, ChevronLeft, ChevronRight, MessageSquare,
  AlertTriangle, CheckCircle, AlertCircle, Clock, LogOut, ArrowLeft, UserCircle,
  ShoppingCart, ShoppingBag, Plus, Minus, Trash2, Phone, Mail, Eye, EyeOff,
  CreditCard, Wrench, FileText, Download, UserPlus, TrendingUp, Receipt,
  RefreshCw, Smartphone, LogIn,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import VisitKindBadge from '../components/ui/VisitKindBadge';
import EodReport from '../components/EodReport';
import RowMenu from '../components/ui/RowMenu';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { AddMemberModal, AddVisitorModal } from './MembersPage';
import MemberProfilePage from './MemberProfilePage';
import { getAll as getMembers, sendCode as sendMemberCode } from '../services/members.service';
import { enabledMethods, acceptedMethod, PAYMENT_METHODS } from '../utils/paymentMethods';
import { checkInBlockReason, passesLeft, checkInErrorText } from '../utils/checkin';
import { getAll as getStaff, verifyCode as verifyStaffCode, checkActive as checkStaffActive } from '../services/staff.service';
import { getAll as getPackages } from '../services/packages.service';
import { getAll as getProducts } from '../services/products.service';
import { getEod } from '../services/reports.service';
import { getAll as getCalendar } from '../services/calendar.service';
import { getAll as getAttendance, checkIn as checkInApi } from '../services/attendance.service';
import { getMyGym } from '../services/gym.service';
import { endOfDay as endOfDayApi, getAll as getTimecards, punchIn as punchInApi, punchOut as punchOutApi, shiftStatus as shiftStatusApi, startShift as startShiftApi } from '../services/timecards.service';
import { create as createSale, getAll as getSales } from '../services/sales.service';
import useLiveRefresh from '../hooks/useLiveRefresh';
import DayStepper from '../components/ui/DayStepper';
import PriceTag from '../components/ui/PriceTag';
import { saleUnitPrice } from '../utils/productPrice';
import { getAll as getEquipmentIssues, create as createEquipmentIssue } from '../services/equipment.service';
import { getAll as getTasks, create as createTask, remove as removeTask } from '../services/tasks.service';
import { create as createExpense } from '../services/expenses.service';
import { verifyManagerPassword } from '../services/auth.service';
import { isDemoMode, getAuth, getRole, clearAuth } from '../utils/auth';

import { fmtDate, getDateLocale, capFirst, dayStr, addDaysStr, todayStr as getTodayStr } from '../utils/date';
import { digitsOnly } from '../utils/number';
import { useGymSettings, refreshGymSettings } from '../hooks/useGymSettings';
import { softAll, failed } from '../utils/loadAll';
import NotificationBell from '../components/NotificationBell';
import TaskAssigneeField from '../components/TaskAssigneeField';
import { assignFields, assigneeName } from '../utils/departments';
import { expenseCategoryName } from '../utils/expenseCategories';
import { storeJson } from '../utils/storage';
import { TASK_CATEGORIES } from '../utils/taskCategories';
import { gymCache } from '../utils/gymCache';
import { fieldErrorStyle, serverFieldError } from '../utils/formErrors';
import TimeInput from '../components/ui/TimeInput';
import DialogBox from '../components/ui/DialogBox';

const formatDate = (d) => fmtDate(d);
const staffFullName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

// ─── Styles ────────────────────────────────────────────────────────────────────
const primaryBtn  = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle   = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
const labelStyle   = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontFamily: 'DM Sans' };


const ROLE_KEYS = {
  general_manager: 'generalManager', 'General Manager': 'generalManager',
  manager: 'manager', 'Manager': 'manager',
  trainer: 'trainer', 'Trainer': 'trainer',
  instructor: 'instructor', 'Instructor': 'instructor',
  front_desk: 'frontDesk', 'Front Desk': 'frontDesk',
  coach: 'coach', 'Coach': 'coach',
  other: 'roleOther', 'Other': 'roleOther',
};

const PROD_CAT_KEYS = {
  'All': 'catAll', 'Beverages': 'catBeverages', 'Nutrition': 'catNutrition',
  'Supplements': 'catSupplements', 'Gear': 'catGear', 'Accessories': 'catAccessories',
};

const TIME_FILTER_KEYS = [
  { key: 'timeToday',    maxMinutes: 1440 },
  { key: 'timeLastHour', maxMinutes: 60   },
  { key: 'timeLast24h',  maxMinutes: 1440 },
  { key: 'timeLast48h',  maxMinutes: 2880 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['gold','blue','green','purple','red'];
const hashStr = (s) => { let h = 0; for (const c of String(s || '')) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h); };
const clockNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const staffColor = (s) => s.avatarColor || AVATAR_COLORS[hashStr(s.id || s.name || '') % AVATAR_COLORS.length];
// Day maths in the viewer's OWN timezone. `.toISOString().slice(0,10)` gives the
// UTC day, which lands a day off east of Greenwich - an event on the 16th then
// shows under the 15th. `dayStr` formats a Date as a local YYYY-MM-DD instead.
const addDays = (d, n) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dayStr(dt); };
const getWeekDays = (d) => {
  const dt = new Date(d + 'T00:00:00');
  const diff = dt.getDay() === 0 ? -6 : 1 - dt.getDay();
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(dt); dd.setDate(dt.getDate() + diff + i); return dayStr(dd); });
};

// ─── Schedule panel (left column) ─────────────────────────────────────────────
function SchedulePanel({ events = [] }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const todayStr = getTodayStr();
  const [view, setView]   = useState('day');
  const [sel,  setSel]    = useState(todayStr);
  const [moCursor, setMoCursor] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [detail, setDetail] = useState(null); // event whose assigned staff are being viewed

  const dayEvents = events.filter(e => e.date === sel).sort((a,b) => a.start.localeCompare(b.start));
  const weekDays  = getWeekDays(sel);

  // Who is on an event, kept to one short line: up to two names, then "N people".
  const staffText = (e) => {
    const names = e.staffNames || [];
    const count = e.staffCount || names.length;
    if (count === 0) return e.instructor || '';
    if (names.length && count <= 2) return names.join(', ');
    return t('calendar.nPeople', { n: count });
  };

  const fmtDayLabel = (d) => {
    if (d === todayStr) return t('common.today');
    return new Date(d + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Month calendar data
  const firstDay    = (new Date(moCursor.year, moCursor.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(moCursor.year, moCursor.month + 1, 0).getDate();
  const moCells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const moName  = new Date(moCursor.year, moCursor.month).toLocaleString(locale, { month: 'short', year: 'numeric' });
  const toDateStr = (d) => `${moCursor.year}-${String(moCursor.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('frontDesk.program')}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[['day','frontDesk.viewDayShort'],['week','frontDesk.viewWeekShort'],['month','frontDesk.viewMonthShort']].map(([v, key]) => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: view === v ? '#0a0a0f' : 'var(--text-muted)', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.1s' }}>
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Day view ── */}
      {view === 'day' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button aria-label={t('frontDesk.prevDay')} onClick={() => setSel(addDays(sel,-1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 11, fontWeight: 600, color: sel === todayStr ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans' }}>{fmtDayLabel(sel)}</span>
            <button aria-label={t('frontDesk.nextDay')} onClick={() => setSel(addDays(sel, 1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', padding: '20px 0' }}>{t('frontDesk.noClassesScheduled')}</div>
            ) : dayEvents.map(e => (
              <div key={e.id} onClick={() => setDetail(e)} title={t('frontDesk.viewAssignedStaff')}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', borderRadius: 6, padding: '2px 4px', margin: '0 -4px', transition: 'background 0.1s' }}
                onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans', width: 34, flexShrink: 0, paddingTop: 1 }}>{e.start}</span>
                <div style={{ borderLeft: `2px solid ${e.color}`, paddingLeft: 7, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', lineHeight: 1.2 }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staffText(e)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === 'week' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button aria-label={t('common.previousWeek')} onClick={() => setSel(addDays(weekDays[0],-1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {new Date(weekDays[0]+'T00:00:00').toLocaleDateString(locale,{month:'short',day:'numeric'})} - {new Date(weekDays[6]+'T00:00:00').toLocaleDateString(locale,{month:'short',day:'numeric'})}
            </span>
            <button aria-label={t('common.nextWeek')} onClick={() => setSel(addDays(weekDays[6], 1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {['M','T','W','T','F','S','S'].map((l,i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 3 }}>{l}</div>
            ))}
            {weekDays.map(d => {
              const isToday = d === todayStr;
              const isSel   = d === sel;
              const evts    = events.filter(e => e.date === d);
              return (
                <div key={d} onClick={() => { setSel(d); setView('day'); }} style={{ cursor: 'pointer', borderRadius: 6, padding: '4px 2px', textAlign: 'center', border: `1px solid ${isToday ? 'var(--accent-gold)' : isSel ? 'var(--accent-gold-dim)' : 'transparent'}`, background: isSel ? 'var(--accent-gold-dim)' : 'transparent' }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{new Date(d+'T00:00:00').getDate()}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 2, minHeight: 6, flexWrap: 'wrap' }}>
                    {evts.slice(0,3).map((e,j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: e.color }}/>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>{t('frontDesk.tapDayToView')}</div>
        </div>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button aria-label={t('common.previousMonth')} onClick={() => setMoCursor(c => { const d = new Date(c.year, c.month-1); return {year:d.getFullYear(),month:d.getMonth()}; })} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{moName}</span>
            <button aria-label={t('common.nextMonth')} onClick={() => setMoCursor(c => { const d = new Date(c.year, c.month+1); return {year:d.getFullYear(),month:d.getMonth()}; })} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
            {/* 2 January 2023 was a Monday */}
            {Array.from({ length: 7 }, (_, i) => new Date(2023, 0, i + 2).toLocaleDateString(locale, { weekday: 'narrow' })).map((l,i) => <div key={i} style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{l}</div>)}
            {moCells.map((d,i) => {
              const dStr    = d ? toDateStr(d) : null;
              const isToday = dStr === todayStr;
              const isSel   = dStr === sel;
              const evts    = dStr ? events.filter(e => e.date === dStr) : [];
              return (
                <div key={i} onClick={() => { if (dStr) { setSel(dStr); setView('day'); } }} style={{ cursor: d ? 'pointer' : 'default', borderRadius: 4, padding: '3px 1px', background: isToday ? 'var(--accent-gold)' : isSel ? 'var(--accent-gold-dim)' : 'transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? '#0a0a0f' : d ? 'var(--text-secondary)' : 'transparent' }}>{d || ''}</div>
                  {d && evts.length > 0 && <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 1 }}>{evts.slice(0,2).map((e,j) => <div key={j} style={{ width: 3, height: 3, borderRadius: '50%', background: isToday ? '#0a0a0f' : e.color }}/>)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Click an event to see everyone assigned to it */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.title} maxWidth={360}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{fmtDayLabel(detail.date)} · {detail.start}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{t('calendar.assignedStaff')}</div>
              {(detail.staffNames && detail.staffNames.length) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.staffNames.map((n, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div>
                      {n}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{detail.instructor || t('calendar.noStaff')}</div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Status dot (check-in list) ────────────────────────────────────────────────
// The marker belongs to the visit, not the person: it shows where the member
// stood when they came in (saved on the check-in), so paying later leaves the
// triangle on that visit and only their next check-in reads green. A visit
// recorded before the snapshot existed falls back to the member as they are now.
function StatusDot({ visit }) {
  const member = visit?.member;
  if (!member) return null;
  const owed = visit.balanceAtCheckIn ?? member.balance;
  const status = visit.statusAtCheckIn ?? member.status;
  // The warning triangle means one thing only: they owed money at that check-in
  if ((Number(owed) || 0) > 0) return <span title={formatMoney(owed)} style={{ display:'inline-flex' }}><AlertTriangle size={13} color="var(--accent-yellow)"/></span>;
  if (['expired','suspended','deactivated','cancelled','frozen','pending'].includes(status)) return <AlertCircle size={13} color="var(--accent-red)"/>;
  return <CheckCircle size={13} color="var(--accent-green)"/>;
}

// ─── Login PIN pad ────────────────────────────────────────────────────────────
function LoginPinPad({ onDigit, onBack, onConfirm, confirmEnabled }) {
  const base = { height: 52, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Manrope', transition: 'all 0.1s' };
  const hover = (e, on) => { e.currentTarget.style.background = on ? 'var(--bg-card-hover)' : 'var(--bg-elevated)'; e.currentTarget.style.borderColor = on ? 'var(--accent-gold)' : 'var(--border-subtle)'; };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[1,2,3,4,5,6,7,8,9].map(n => (
        <button key={n} style={base} onClick={() => onDigit(String(n))} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>{n}</button>
      ))}
      <button style={{...base,fontSize:14,color:'var(--text-muted)'}} onClick={onBack} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>⌫</button>
      <button style={base} onClick={() => onDigit('0')} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>0</button>
      <button onClick={onConfirm} disabled={!confirmEnabled} style={{...base, background: confirmEnabled ? 'linear-gradient(135deg,#c9a96e,#b08d4a)' : 'var(--bg-elevated)', border: confirmEnabled ? '1px solid transparent' : '1px solid var(--border-subtle)', color: confirmEnabled ? '#0a0a0f' : 'var(--text-muted)', cursor: confirmEnabled ? 'pointer' : 'default'}}>✓</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function FrontDeskPage() {
  const gymSettings = useGymSettings();
  const { t } = useLanguage();
  const translateRole = (role) => { const k = ROLE_KEYS[role]; return k ? t(`staff.${k}`) : (role || ''); };
  const tProdCat = (cat) => { const k = PROD_CAT_KEYS[cat]; return k ? t(`frontDesk.${k}`) : cat; };
  const tExpCat = (cat) => expenseCategoryName(cat, t);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // ── Session ────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(() => {
    try {
      // Signed in with their own front desk account: they are the one at the
      // desk, so there is no second sign-in with a name and code
      const me = getAuth()?.user;
      if (me?.role === 'front_desk') {
        const own = { staffId: me.id, staffName: `${me.firstName || ''} ${me.lastName || ''}`.trim(), own: true };
        sessionStorage.setItem('fd_session', JSON.stringify(own));
        return own;
      }
      const s = sessionStorage.getItem('fd_session');
      if (s) return JSON.parse(s);
      // In demo mode, auto-create a session so the login screen is skipped
      if (isDemoMode()) {
        const demo = { staffId: 'demo', staffName: 'Marvin Ekokobe' };
        sessionStorage.setItem('fd_session', JSON.stringify(demo));
        return demo;
      }
      // A manager who opens the desk works it as themselves - no profile picker.
      // They still clear their own PIN to leave for the dashboard (requestExit).
      if (me && ['general_manager', 'manager'].includes(me.role)) {
        const own = { staffId: me.id, staffName: `${me.firstName || ''} ${me.lastName || ''}`.trim() };
        sessionStorage.setItem('fd_session', JSON.stringify(own));
        return own;
      }
      return null;
    } catch { return null; }
  });
  const [loginStep,     setLoginStep]     = useState('select');
  const [selStaff,      setSelStaff]      = useState(null);
  const [loginPin,      setLoginPin]      = useState('');
  const [loginError,    setLoginError]    = useState('');

  // ── Shared UI ──────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('CHECK-IN');

  // Demo mode: ensure session exists so login screen is never shown
  useEffect(() => {
    if (isDemoMode() && !session) {
      const demo = { staffId: 'demo', staffName: 'Marvin Ekokobe' };
      sessionStorage.setItem('fd_session', JSON.stringify(demo));
      setSession(demo);
    }
  }, []);


  // ── CHECK-IN ───────────────────────────────────────────────────────────────
  const [pinInput,      setPinInput]      = useState('');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [foundMember,   setFoundMember]   = useState(null);
  const [fdMatches,     setFdMatches]     = useState([]);
  const [checkedIn,     setCheckedIn]     = useState(false);
  const [staffClockMsg, setStaffClockMsg] = useState('');
  const [staffTime, setStaffTime] = useState('');
  const [staffNote, setStaffNote] = useState('');
  // Four digits that match nobody on the member list: the server is the only
  // one who can say whether it is an employee's own code.
  const [codeAttempt, setCodeAttempt] = useState('');
  // The shift an employee is already on, if any: the same button ends it
  const [staffOpenCard, setStaffOpenCard] = useState(null);
  const [staffClockError, setStaffClockError] = useState('');
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeEntered,   setCodeEntered]   = useState('');
  const [codeError,     setCodeError]     = useState('');
  const [sendCodeSent,  setSendCodeSent]  = useState(false);
  const [sendingCode,   setSendingCode]   = useState(false);
  const [sendCodeMsg,   setSendCodeMsg]   = useState('');
  const [timeFilter,    setTimeFilter]    = useState('timeToday');
  // "Last 24 / 48 hours" reach back before today, so those check-ins are loaded
  // when one of them is chosen (they used to show only today's)
  const longRange = timeFilter === 'timeLast24h' || timeFilter === 'timeLast48h';
  const [olderCheckins, setOlderCheckins] = useState([]);
  useEffect(() => {
    if (!longRange) return;
    const dayBack = (n) => addDaysStr(getTodayStr(), -n);
    softAll([getAttendance({ date: dayBack(1) }), getAttendance({ date: dayBack(2) })]).then(([a, b]) => {
      if (failed(a) || failed(b)) return;
      const now = new Date();
      setOlderCheckins([...(a.data || []), ...(b.data || [])].map(ci => ({
        ...ci,
        type: 'member',
        timeLabel: new Date(ci.checkIn).toLocaleString(getDateLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
        minutesAgo: Math.floor((now - new Date(ci.checkIn)) / 60000),
      })));
    });
  }, [longRange]);
  const [photoLightbox, setPhotoLightbox] = useState(null); // photo URL or null

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  const [todaySignups,  setTodaySignups]  = useState([]);

  // ── PRODUCT SALE ───────────────────────────────────────────────────────────
  const [prodCat,       setProdCat]       = useState('All');
  const [cart,          setCart]          = useState([]); // {id, name, price, qty}
  const [payMethod,     setPayMethod]     = useState('Cash');
  const [saleSuccess,   setSaleSuccess]   = useState(false);
  const [saleError,     setSaleError]     = useState('');
  const [selling,       setSelling]       = useState(false);
  // Today's figures for the Operations tab, from the same server report as the end-of-day report
  const [fdEod,         setFdEod]         = useState(null);

  // ── OPERATIONS ────────────────────────────────────────────────────────────
  const emptyIssue = { equipment: '', location: '', description: '', severity: 'Medium' };
  const [issueForm,     setIssueForm]     = useState(emptyIssue);
  const [issueSuccess,  setIssueSuccess]  = useState(false);
  const emptyExpense = { description: '', amount: '', paidTo: '', category: 'Supplies', paymentMethod: 'Cash' };
  const [expenseForm,    setExpenseForm]    = useState(emptyExpense);
  const [expenseError,   setExpenseError]   = useState('');
  const [expenseFieldErrors, setExpenseFieldErrors] = useState({});
  const [issueErrors, setIssueErrors] = useState({});
  const [issueError, setIssueError] = useState('');
  const [issueSaving, setIssueSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);
  const [expenseWasPending, setExpenseWasPending] = useState(false);
  const [opsActivity,   setOpsActivity]   = useState([]);

  // ── New Task ──────────────────────────────────────────────────────────────
  const emptyTask = { title: '', description: '', assignedTo: '', category: '', dueDate: '', priority: 'Medium' };
  const [taskForm,      setTaskForm]      = useState(emptyTask);
  const [taskErrors,    setTaskErrors]    = useState({});
  const [taskSaving,    setTaskSaving]    = useState(false);
  const [taskSuccess,   setTaskSuccess]   = useState(false);
  const [myCreatedTasks, setMyCreatedTasks] = useState([]);

  // ── Daily revenue tracking ────────────────────────────────────────────────
  const [daySales, setDaySales] = useState([]);
  // The sales panel shows one day at a time; the desk can page back through earlier days
  const [salesDay, setSalesDay] = useState(getTodayStr);
  const [shownSales, setShownSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const salesDayRef = useRef(salesDay);
  salesDayRef.current = salesDay;
  const [dayRegs, setDayRegs] = useState([]);

  // ── Sign Up modals ────────────────────────────────────────────────────────
  const [showAddMember,  setShowAddMember]  = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);


  // ── Operations modals ─────────────────────────────────────────────────────
  const [showIssueModal,    setShowIssueModal]    = useState(false);
  const [showExpenseModal,  setShowExpenseModal]  = useState(false);
  const [showTaskModal,     setShowTaskModal]     = useState(false);
  const [showEodModal,      setShowEodModal]      = useState(false);
  const [eodClockNote, setEodClockNote] = useState('');

  // ── Inline member profile (avoids navigation glitch) ─────────────────────
  const [fdProfileId, setFdProfileId] = useState(null);

  // ── Exit re-auth ──────────────────────────────────────────────────────────
  // Leaving the desk for the app asks the manager for their own account
  // password (not a 4-digit PIN) - the same secret they signed in with.
  const [showExitAuth,  setShowExitAuth]  = useState(false);
  const [exitTarget,    setExitTarget]    = useState('/dashboard');
  const [exitPassword,  setExitPassword]  = useState('');
  const [exitPinError,  setExitPinError]  = useState('');
  const [exitBusy,      setExitBusy]      = useState(false);
  const [showExitPw,    setShowExitPw]    = useState(false);

  const TABS = [
    { key: 'CHECK-IN',      label: t('frontDesk.checkIn') },
    { key: 'SIGN UP',       label: t('frontDesk.signUp') },
    { key: 'PRODUCT SALE',  label: t('frontDesk.productSale') },
    { key: 'OPERATIONS',    label: t('frontDesk.operations') },
  ];

  // ── Real data ──────────────────────────────────────────────────────────────
  const cachedStaff = (() => { try { return JSON.parse(localStorage.getItem('gem_fd_staff') || '[]'); } catch { return []; } })();
  const cachedGym   = (() => { try { return JSON.parse(localStorage.getItem('gem_fd_gym')   || 'null'); } catch { return null; } })();

  const [staffList,      setStaffList]      = useState(cachedStaff);

  // The desk is signed in to one account but worked by whoever entered their
  // code. If that person is deactivated, their desk session ends as well.
  useEffect(() => {
    if (!session || session.staffId === 'demo' || isDemoMode()) return;
    const check = () => {
      if (document.hidden) return;
      checkStaffActive(session.staffId).then(res => {
        if (res.data?.active !== false) return;
        sessionStorage.removeItem('fd_session');
        setSession(null);
        setLoginStep('select');
        setStaffList(prev => prev.map(s => (s.id === session.staffId ? { ...s, isActive: false } : s)));
      }).catch(() => {});
    };
    check();
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer);
  }, [session]);
  // Everything the desk shows - the program, the check-in list, members and
  // products - is seeded from the last time this desk was open, so the panels
  // appear already filled and the fetch only swaps in what changed. Without
  // this the PROGRAM and check-in lists popped in a beat after the page did.
  // See utils/gymCache.js.
  const fdCache = gymCache('fd');
  const [membersList,    setMembersList]    = useState(() => fdCache.read('members', []));
  const [packagesList,   setPackagesList]   = useState(() => fdCache.read('packages', []));
  const [gymData,        setGymData]        = useState(cachedGym);
  const [productsData,   setProductsData]   = useState(() => fdCache.read('products', []));
  const [scheduleEvents, setScheduleEvents] = useState(() => fdCache.read('schedule', []));
  const [todayCheckins,  setTodayCheckins]  = useState(() => fdCache.read('checkins', []));

  // Tasks the person on shift raised themselves, so they can check whether
  // whoever it went to has picked it up - this is the only place that view
  // reaches them, since the kiosk has no sidebar to a real Tasks page. The
  // server attributes a task to whoever's browser session created it, which
  // on a shared kiosk is the device's own account, not the name picked from
  // the PIN screen - so this has to match on that account, not session.staffId.
  const myAccountId = getAuth()?.user?.id;

  // ── A shift is asked about, never assumed ──
  // A part-time front desk employee works on the clock. Signing in (or opening
  // the desk with their code) asks whether to start the shift now, and the end
  // of day report asks whether to end it; either can be put off, and done later
  // from the desk's check-in by searching their own name.
  const [shiftPrompt, setShiftPrompt] = useState(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftDone, setShiftDone] = useState('');
  const [shiftError, setShiftError] = useState('');
  const shiftAsked = useRef(new Set());
  useEffect(() => {
    const sid = session?.staffId;
    if (!sid || sid === 'demo') return;
    // Asked once for each sign-in: the token is new every time
    const key = `fd_shift_asked:${sid}:${String(getAuth()?.token || '').slice(-16)}`;
    if (shiftAsked.current.has(key)) return;
    shiftAsked.current.add(key);
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* private window: ask anyway */ }
    shiftStatusApi(sid).then(r => {
      if (r.data?.clockable && r.data.state === 'none') setShiftPrompt({ kind: 'start', staffId: sid, name: r.data.name });
    }).catch(() => {});
  }, [session?.staffId]);
  const shiftTime = (d) => new Date(d || Date.now()).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
  const closeShiftPrompt = () => { if (shiftBusy) return; setShiftPrompt(null); setShiftDone(''); setShiftError(''); };
  const confirmShift = async () => {
    if (!shiftPrompt || shiftBusy) return;
    setShiftBusy(true); setShiftError('');
    try {
      if (shiftPrompt.kind === 'start') {
        const r = await startShiftApi(shiftPrompt.staffId);
        const note = t('frontDesk.shiftStarted', { time: shiftTime(r.data?.punchIn) });
        setShiftDone(note);
        setOpsActivity(prev => [{ type: 'staff', text: `${shiftPrompt.name}: ${note}`, time: new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
        setTimeout(() => { setShiftPrompt(null); setShiftDone(''); }, 1600);
      } else {
        const res = await endOfDayApi(session?.staffId && session.staffId !== 'demo' ? session.staffId : undefined);
        const names = (res.data?.clockedOut || []).map(c => c.name).filter(Boolean);
        if (names.length) {
          const note = t('frontDesk.autoClockedOut', { names: names.join(', ') });
          setEodClockNote(note);
          setOpsActivity(prev => [{ type: 'staff', text: note, time: new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
        }
        setShiftPrompt(null);
      }
    } catch (err) {
      setShiftError(err?.response?.data?.error || t('frontDesk.shiftFailed'));
    }
    setShiftBusy(false);
  };
  const refreshMyTasks = () => {
    if (!myAccountId) return;
    getTasks().then(res => {
      setMyCreatedTasks((res.data || []).filter(tk => String(tk.createdById) === String(myAccountId)));
    }).catch(() => {});
  };
  const handleDeleteRaisedTask = async (taskId) => {
    setMyCreatedTasks(prev => prev.filter(tk => tk.id !== taskId));
    try { await removeTask(taskId); } catch (err) { console.error('Failed to delete task:', err); refreshMyTasks(); }
  };
  useEffect(() => {
    if (activeTab === 'OPERATIONS') refreshMyTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, session]);

  const loadDesk = () => {
    // Refresh staff and gym name in background; cache for instant next load
    getStaff().then(sRes => {
      const data = sRes.data || [];
      setStaffList(data);
      storeJson('gem_fd_staff', data);
    }).catch(console.error);
    getMyGym().then(gymRes => {
      const data = gymRes.data || null;
      setGymData(data);
      storeJson('gem_fd_gym', data);
    }).catch(console.error);

    const today = getTodayStr();
    softAll([
      getMembers(), getPackages(),
      // The whole gym calendar, not just today's - the program panel lets you
      // page to any day, so an event on the 16th must be loaded even on the 1st.
      getProducts(), getCalendar(), getAttendance({ date: today }),
      getEquipmentIssues(),
    ]).then(([mRes, pkRes, prRes, calRes, attRes, eqRes]) => {
      // The desk's lists are built from each other, so a failed request keeps
      // all of them (and their saved copies) as they are until the next load
      if ([mRes, pkRes, prRes, calRes, attRes, eqRes].some(failed)) return;
      setMembersList(mRes.data || []); fdCache.write('members', mRes.data || []);
      setPackagesList(pkRes.data || []); fdCache.write('packages', pkRes.data || []);
      const pkgs = pkRes.data || [];
      const todayMembers = (mRes.data || []).filter(m => m.createdAt && dayStr(m.createdAt) === today);
      setDayRegs(todayMembers.map(m => {
        const pkg = pkgs.find(p => p.id === m.packageId);
        return {
          name: `${m.firstName} ${m.lastName}`,
          type: (m.isVisitor || m.status === 'visitor') ? 'Visitor' : 'Membership',
          amount: pkg?.price || 0,
          time: new Date(m.createdAt).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }),
        };
      }));
      setTodaySignups(todayMembers.map(m => {
        const pkg = pkgs.find(p => p.id === m.packageId);
        return {
          name: `${m.firstName} ${m.lastName}`,
          package: pkg?.name || '',
          time: new Date(m.createdAt).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }),
        };
      }));
      setProductsData(prRes.data || []); fdCache.write('products', prRes.data || []);
      const mappedSchedule = (calRes.data || []).map(e => ({
        id: e.id,
        date: dayStr(e.date) || (e.startTime || '').slice(0, 10),
        start: e.time || (e.startTime || '').slice(11, 16),
        end: '',
        title: e.title,
        instructor: e.instructor ? `${e.instructor.firstName} ${e.instructor.lastName}` : (e.instructorName || ''),
        // Who's on it, for the program panel: names and count from the same
        // source (the resolved assigned staff) so "N people" always matches the
        // list you see when you open it. Falls back to responses on an old API.
        staffNames: ((e.assignedStaff && e.assignedStaff.length) ? e.assignedStaff.map(s => s.name) : (e.responses || []).map(r => r.name)).filter(Boolean),
        staffCount: ((e.assignedStaff && e.assignedStaff.length) ? e.assignedStaff.map(s => s.name) : (e.responses || []).map(r => r.name)).filter(Boolean).length,
        color: e.color || '#818cf8',
      }));
      setScheduleEvents(mappedSchedule); fdCache.write('schedule', mappedSchedule);
      const now = new Date();
      const checkins = (attRes.data || []).map(ci => ({
        ...ci,
        type: 'member',
        timeLabel: new Date(ci.checkIn).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: Math.floor((now - new Date(ci.checkIn)) / 60000),
      }));
      setTodayCheckins(checkins); fdCache.write('checkins', checkins);
      const issueEntries = (eqRes.data || []).map(issue => ({
        type: 'issue',
        text: t('frontDesk.issueReportedLine', { name: issue.equipment }),
        time: new Date(issue.reportedAt).toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }),
      }));
      setOpsActivity([
        ...checkins.map(ci => ({
          type: 'checkin',
          text: `${ci.member?.firstName || ''} ${ci.member?.lastName || ''} checked in`.trim(),
          time: ci.timeLabel,
        })),
        ...issueEntries,
      ]);
    }).catch(console.error);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDesk(); }, []);
  // Live: a pass bought, a member checked in or a product sold on any other
  // screen shows here straight away (see utils/live.js)
  useLiveRefresh(() => {
    loadDesk();
    if (activeTab === 'OPERATIONS') { loadFdEod(); refreshMyTasks(); }
    loadDaySales();
  });
  useEffect(() => { loadDaySales(salesDay); }, [salesDay]);
  // The open search result is a copy of the member; keep it in step with the list
  useEffect(() => {
    setFoundMember(f => {
      if (!f || f._isStaff) return f;
      const fresh = membersList.find(m => m.id === f.id);
      return fresh ? { ...fresh, _foundByCode: f._foundByCode } : f;
    });
    setFdMatches(list => list.map(f => (f._isStaff ? f : (membersList.find(m => m.id === f.id) ? { ...membersList.find(m => m.id === f.id), _foundByCode: false } : f))));
  }, [membersList]);

  // Only products that are switched on are offered for sale
  const displayProducts = productsData.filter(p => p.isActive !== false);
  const displayCats = ['All', ...new Set(displayProducts.map(p => p.category))];

  // ── Login ──────────────────────────────────────────────────────────────────
  // The PIN is checked on the server. It used to be compared here against every
  // staff member's real code, loaded into the page, the owner's included.
  const handleLoginConfirm = async () => {
    try {
      const res = await verifyStaffCode(selStaff.id, loginPin, 'frontdesk.signin');
      if (res.data?.valid) {
        const s = { staffId: selStaff.id, staffName: staffFullName(selStaff) };
        sessionStorage.setItem('fd_session', JSON.stringify(s));
        setSession(s);
        setLoginStep('select'); setSelStaff(null); setLoginPin(''); setLoginError('');
        return;
      }
      setLoginError(t('frontDesk.incorrectPin'));
    } catch (err) {
      setLoginError(err?.response?.data?.code === 'ACCOUNT_DEACTIVATED'
        ? t('auth.accountDeactivated')
        : err?.response?.data?.error || t('frontDesk.incorrectPin'));
    }
    setLoginPin('');
  };
  const isDeskAccount = getRole() === 'front_desk';
  const handleSignOut = () => {
    const gymCode = getAuth()?.user?.gymCode;
    sessionStorage.removeItem('fd_session');
    clearAuth();
    navigate(gymCode ? `/${gymCode}/login` : '/login', { replace: true });
  };
  // Leaving front desk mode for anywhere in the app - the Exit button, the Back
  // to Dashboard link, or a notification that deep-links into the app - goes
  // through one gate: the manager's own account password. There is no profile
  // picker; the two paths that used to skip the gate (the back link and the
  // notification bell) now route through here too.
  const meUser = getAuth()?.user;
  const requestExit = (target = '/dashboard') => {
    setExitTarget(target || '/dashboard');
    setExitPassword('');
    setExitPinError('');
    setShowExitPw(false);
    setShowExitAuth(true);
  };
  const handleExit = () => requestExit('/dashboard');

  // The browser Back button must not be a side door out of the kiosk. Without
  // this, a manager running front-desk mode could press Back and land on the
  // dashboard without the exit password. We pin a history entry on the kiosk
  // and, when Back fires, re-pin it and open the exit gate instead of leaving.
  // (A real front_desk account has no protected shell behind it, so it's left
  // alone.)
  useEffect(() => {
    if (isDeskAccount) return;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href);
      requestExit('/dashboard');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isDeskAccount]);

  // A desk account has no app shell to go to: a notification that deep-links
  // into the app (own tasks, a colleague's profile, a member) is rewritten to
  // its no-sidebar kiosk twin, query string and all. Without this the person
  // on shift lands on the full app layout - the "dashboard" they should never
  // see - or gets bounced by the role guard.
  const toKioskLink = (link = '') => {
    if (!link) return '/front-desk';
    if (link.startsWith('/my-profile')) return `/front-desk${link}`;
    if (link.startsWith('/staff/')) return `/front-desk${link}`;
    if (link.startsWith('/members/')) return `/front-desk${link.replace('/members/', '/member/')}`;
    // Any task destination (own, team or department) becomes the person's own
    // tasks tab in the kiosk - the desk has no standalone Tasks page.
    if (link === '/tasks' || link.startsWith('/tasks?')) return '/front-desk/my-profile?tab=tasks';
    return link;
  };

  const handleExitConfirm = async () => {
    if (!exitPassword || exitBusy) return;
    setExitBusy(true);
    try {
      const res = await verifyManagerPassword(exitPassword, 'frontdesk.exit');
      if (res.data?.authorized) {
        // Clear the desk session from storage and navigate straight out. We do
        // NOT flip `session` to null first - that would re-render the desk's
        // login/profile screen for a frame before the route changes (the
        // "choose profile" glimpse the manager saw).
        sessionStorage.removeItem('fd_session');
        setShowExitAuth(false);
        navigate(exitTarget || '/dashboard');
        return;
      }
      setExitPinError(t('frontDesk.incorrectPassword'));
    } catch (err) {
      setExitPinError(err?.response?.data?.error || t('frontDesk.incorrectPassword'));
    } finally {
      setExitBusy(false);
      setExitPassword('');
    }
  };

  // ── Check-in ───────────────────────────────────────────────────────────────
  const resetCheckin = () => {
    setPinInput(''); setSearchTerm(''); setFoundMember(null); setFdMatches([]);
    setCheckedIn(false); setShowCodeEntry(false);
    setCodeEntered(''); setCodeError(''); setSendCodeSent(false); setSendCodeMsg('');
    setStaffClockMsg(''); setStaffClockError(''); setStaffTime(''); setStaffNote(''); setStaffOpenCard(null); setCodeAttempt('');
  };
  // Same shared rule as the attendance page and member profile: a paid day pass
  // lets a lapsed member in, so frozen/suspended/expired are only blocked when
  // no pass is left.
  const getCheckInBlock = (m) => checkInBlockReason(m, t, formatDate);
  const staffAsFound = (s) => ({
    id: `STAFF-${s.id}`, firstName: s.firstName || staffFullName(s).split(' ')[0],
    lastName: s.lastName || staffFullName(s).split(' ').slice(1).join(' ') || '', phone: s.phone, photo: s.photo,
    package: s.role, status: 'staff', balance: 0, avatarColor: staffColor(s),
    _isStaff: true, _partTime: s.employmentType === 'Part Time',
  });
  const pickFound = (f) => {
    setCheckedIn(false); setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setStaffClockMsg(''); setStaffClockError('');
    setFoundMember(f);
    if (f._isStaff) loadOpenShift(String(f.id).replace(/^STAFF-/, ''));
  };
  const runSearch = (val) => {
    setCheckedIn(false); setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false); setSendCodeMsg('');
    setStaffClockMsg(''); setStaffClockError(''); setStaffTime(''); setStaffNote(''); setStaffOpenCard(null); setCodeAttempt('');
    setFdMatches([]);
    const trimmed = val.trim();
    if (!trimmed) { setFoundMember(null); return; }
    const lower = trimmed.toLowerCase();
    const byCode = membersList.find(m => m.accessCode === trimmed || (m.memberCode || '').toLowerCase() === lower);
    if (byCode) { setFoundMember({...byCode, _foundByCode:true}); return; }
    const memberMatches = membersList.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
      (m.phone || '').includes(trimmed) ||
      (m.memberCode || '').toLowerCase().includes(lower)
    );
    // An employee is found by name only. Their 4-digit code is theirs alone and
    // is never handed to the desk.
    const staffMatches = lower.length >= 2
      ? staffList.filter(s => s.isActive !== false && staffFullName(s).toLowerCase().includes(lower))
      : [];
    // A member and an employee (or two members) can share a name, so every
    // match is offered and the desk picks the right person
    const all = [...memberMatches.map(m => ({ ...m, _foundByCode: false })), ...staffMatches.map(staffAsFound)];
    if (all.length > 1) { setFdMatches(all.slice(0, 8)); setFoundMember(null); return; }
    if (all.length === 1) { pickFound(all[0]); return; }
    // Employees keep their code to themselves, so the desk cannot match it
    // here. Four digits are worth trying against the server.
    if (/^\d{4}$/.test(trimmed)) setCodeAttempt(trimmed);
    setFoundMember(null);
  };
  const handlePinPress = (d) => { const n = pinInput + d; setPinInput(n); setSearchTerm(n); runSearch(n); };
  const handlePinBack  = ()  => { const n = pinInput.slice(0,-1); setPinInput(n); setSearchTerm(n); runSearch(n); };
  const addCheckinToList = (member, type = 'member', kind = null, record = null) => {
    const timeLabel = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
    setTodayCheckins(prev => [{
      id: `local-${Date.now()}`,
      checkIn: new Date().toISOString(),
      type,
      kind,
      timeLabel,
      minutesAgo: 0,
      member,
      balanceAtCheckIn: record?.balanceAtCheckIn ?? (Number(member.balance) || 0),
      statusAtCheckIn: record?.statusAtCheckIn ?? member.status,
    }, ...prev]);
    setOpsActivity(prev => [{
      type: 'checkin',
      text: `${member.firstName} ${member.lastName} checked in`,
      time: timeLabel,
    }, ...prev]);
  };

  const applyCheckInResult = (member, apiRes) => {
    const serverMember = apiRes?.data?.member;
    const updated = serverMember
      ? {
          ...member,
          passesRemaining: serverMember.passesRemaining !== undefined ? serverMember.passesRemaining : member.passesRemaining,
          dayPasses: serverMember.dayPasses !== undefined ? serverMember.dayPasses : member.dayPasses,
          status: serverMember.status || member.status,
        }
      : member;
    if (updated.passesRemaining !== member.passesRemaining || updated.dayPasses !== member.dayPasses || updated.status !== member.status) {
      setMembersList(prev => prev.map(m => m.id === member.id ? { ...m, passesRemaining: updated.passesRemaining, dayPasses: updated.dayPasses, status: updated.status } : m));
    }
    return updated;
  };

  // Somebody already on shift is clocked OUT by the same button, so the desk is
  // told which of the two is about to happen.
  const loadOpenShift = async (staffId) => {
    setStaffOpenCard(null);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const open = ((await getTimecards({ staffId, openOnly: 'true' })).data || [])
        .find(c => !c.punchOut && new Date(c.date) >= start);
      setStaffOpenCard(open || null);
    } catch { /* the button still works, it just cannot say which way */ }
  };

  const handleCheckIn = async () => {
    // A code the desk could not place. An employee typing their own is here to
    // train, which the server records as a visit and never as a shift.
    if (!foundMember && codeAttempt && !checkedIn) {
      setStaffClockError('');
      try {
        const res = await checkInApi({ accessCode: codeAttempt });
        const visitor = res.data?.member || {};
        const name = `${visitor.firstName || ''} ${visitor.lastName || ''}`.trim();
        setStaffClockMsg(res.data?.staffWorkout ? t('frontDesk.hereToTrain', { name }) : t('frontDesk.checkedInSuccess'));
        addCheckinToList({ ...visitor, _isStaff: !!res.data?.staffWorkout }, res.data?.staffWorkout ? 'staff' : 'member', res.data?.kind || null, res.data);
        setCheckedIn(true);
      } catch (err) {
        setStaffClockError(checkInErrorText(err, t, t('frontDesk.noMatchFor') + ` "${codeAttempt}"`));
      }
      return;
    }
    if (!foundMember || !!getCheckInBlock(foundMember) || checkedIn) return;
    // Employees are clocked in or out on the time clock. They used to be sent to
    // member check-in, which could never find them, so nothing was recorded.
    if (foundMember._isStaff) {
      const staffId = String(foundMember.id).replace(/^STAFF-/, '');
      const name = `${foundMember.firstName || ''} ${foundMember.lastName || ''}`.trim();
      // A corrected time is a claim, so the card goes to a manager to accept
      const at = staffTime || clockNow();
      const note = staffNote.trim();
      setStaffClockError('');
      // A time entered by hand is a claim about when it happened, so it is only
      // recorded with a reason attached.
      if (staffTime && staffTime !== clockNow() && !note) {
        setStaffClockError(t('frontDesk.clockNoteRequired'));
        return;
      }
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const open = staffOpenCard || ((await getTimecards({ staffId, openOnly: 'true' })).data || [])
          .find(c => !c.punchOut && new Date(c.date) >= start);
        if (open) {
          await punchOutApi(open.id, { at, note: note || undefined });
          setStaffClockMsg(t('frontDesk.staffClockedOut', { name, time: at }));
        } else {
          await punchInApi({ staffId, at, note: note || undefined });
          setStaffClockMsg(t('frontDesk.staffClockedIn', { name, time: at }));
          addCheckinToList(foundMember, 'staff');
        }
        setStaffOpenCard(null);
        setCheckedIn(true);
      } catch (err) {
        setStaffClockError(err?.response?.data?.error || t('frontDesk.staffClockFailed'));
      }
      return;
    }
    // Waved straight through only when the desk can confirm who this is:
    // they scanned/typed the member's own access code, or there is a photo on
    // file to check them against by sight. A name match with no photo proves
    // nothing, so the access code stands in for the missing face.
    if (foundMember._foundByCode || foundMember.photo) {
      setStaffClockError('');
      try {
        const apiRes = await checkInApi({ memberId: foundMember.id });
        const memberAfter = applyCheckInResult(foundMember, apiRes);
        setFoundMember(memberAfter);
        addCheckinToList(memberAfter, 'member', apiRes?.data?.kind || null, apiRes?.data);
        setCheckedIn(true);
      } catch (err) {
        // 409 = already in within 30 min; 403 = frozen/deactivated/expired/etc.
        setStaffClockError(checkInErrorText(err, t, t('frontDesk.checkInFailed')));
      }
    } else {
      setShowCodeEntry(true);
    }
  };

  // Re-send the member their own check-in code. Email goes through the server;
  // a text opens the desk device's own messaging app, prefilled, since the gym
  // has no SMS gateway of its own. Both take the member to act on (defaulting to
  // the search result) and return { ok, text }; the code modal shows the shared state.
  const emailCodeToMember = async (m = foundMember) => {
    if (!m || m._isStaff) return { ok: false, text: '' };
    if (!m.email) { const r = { ok: false, text: t('frontDesk.noEmailOnFile') }; setSendCodeSent(false); setSendCodeMsg(r.text); return r; }
    setSendingCode(true); setSendCodeMsg('');
    try {
      await sendMemberCode(m.id);
      const r = { ok: true, text: t('frontDesk.codeEmailedTo', { email: m.email }) };
      setSendCodeSent(true); setSendCodeMsg(r.text); return r;
    } catch (err) {
      const r = { ok: false, text: err?.response?.data?.error || t('frontDesk.codeSendFailed') };
      setSendCodeSent(false); setSendCodeMsg(r.text); return r;
    } finally {
      setSendingCode(false);
    }
  };
  const textCodeToMember = (m = foundMember) => {
    if (!m || m._isStaff) return { ok: false, text: '' };
    if (!m.phone) { const r = { ok: false, text: t('frontDesk.noPhoneOnFile') }; setSendCodeSent(false); setSendCodeMsg(r.text); return r; }
    const body = t('frontDesk.codeSmsBody', { gym: gymData?.name || 'the gym', code: m.accessCode || '' });
    window.location.href = `sms:${m.phone}?body=${encodeURIComponent(body)}`;
    const r = { ok: true, text: t('frontDesk.codeTextOpened') };
    setSendCodeSent(true); setSendCodeMsg(r.text); return r;
  };

  const handleCodeVerifyCheckIn = async () => {
    if (codeEntered.trim() === foundMember.accessCode) {
      try {
        const apiRes = await checkInApi({ memberId: foundMember.id });
        const memberAfter = applyCheckInResult(foundMember, apiRes);
        setFoundMember(memberAfter);
        addCheckinToList(memberAfter, 'member', apiRes?.data?.kind || null, apiRes?.data);
        setCheckedIn(true);
        setShowCodeEntry(false);
      } catch (err) {
        setCodeError(checkInErrorText(err, t, t('frontDesk.checkInFailed')));
      }
    } else {
      setCodeError(t('frontDesk.incorrectCode'));
    }
  };

  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const isWorkingToday = (s) => {
    if (!s.schedule || typeof s.schedule !== 'object') return true;
    const day = s.schedule[todayDayName];
    return !day?.off;
  };

  const maxMinutes = TIME_FILTER_KEYS.find(f => f.key === timeFilter)?.maxMinutes ?? 1440;
  const filteredCheckins = useMemo(() => (longRange ? [...todayCheckins, ...olderCheckins] : todayCheckins).filter(c => c.minutesAgo <= maxMinutes), [todayCheckins, olderCheckins, longRange, maxMinutes]);
  const memberCheckins = filteredCheckins.filter(c => c.type === 'member');
  const staffCheckins  = filteredCheckins.filter(c => c.type === 'staff');
  const blockReason    = foundMember ? getCheckInBlock(foundMember) : null;

  // ── Product Sale ───────────────────────────────────────────────────────────
  const cartTotal   = cart.reduce((s,i) => s + i.price * i.qty, 0);
  // The cart can never hold more of a product than is on the shelf
  const stockOf     = (id) => productsData.find(p => p.id === id)?.stock ?? 0;
  const addToCart   = (p) => {
    setSaleError('');
    const inCart = cart.find(x => x.id === p.id)?.qty || 0;
    if (inCart >= stockOf(p.id)) { setSaleError(t('sales.onlyNLeft', { n: stockOf(p.id) })); return; }
    setCart(c => { const ex = c.find(x=>x.id===p.id); return ex ? c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x) : [...c,{...p,price:saleUnitPrice(p),qty:1}]; });
  };
  const changeQty   = (id, delta) => {
    setSaleError('');
    const item = cart.find(x => x.id === id);
    if (delta > 0 && item && item.qty + delta > stockOf(id)) { setSaleError(t('sales.onlyNLeft', { n: stockOf(id) })); return; }
    setCart(c => c.map(x=>x.id===id?{...x,qty:Math.max(0,x.qty+delta)}:x).filter(x=>x.qty>0));
  };
  const loadFdEod   = () => getEod(getTodayStr()).then(r => setFdEod(r.data)).catch(() => {});
  function loadDaySales(day = salesDayRef.current) {
    setSalesLoading(true);
    getSales(day)
      .then(r => { if (day === salesDayRef.current) setShownSales(r.data || []); })
      .catch(() => {})
      .finally(() => setSalesLoading(false));
  }
  const reloadProducts = () => getProducts().then(r => { const list = r.data || []; setProductsData(list); fdCache.write('products', list); }).catch(() => {});
  const handleSale  = async () => {
    if (!cart.length || selling) return;
    setSelling(true); setSaleError('');
    try {
      const res = await createSale({
        items: cart.map(i => ({ productId: i.id, quantity: i.qty })),
        method: acceptedMethod(payMethod, enabledMethods(gymSettings)),
      });
      // The server says what is left, so the shelf count is never guessed
      const left = Object.fromEntries((res.data.stock || []).map(s => [s.id, s.stock]));
      setProductsData(prev => prev.map(p => (p.id in left ? { ...p, stock: left[p.id] } : p)));
      setDaySales(prev => [...prev, { total: res.data.total, items: cart.reduce((s,i)=>s+i.qty,0), time: new Date().toLocaleTimeString(getDateLocale(),{hour:'2-digit',minute:'2-digit'}) }]);
      if (salesDayRef.current === getTodayStr()) setShownSales(prev => [res.data, ...prev]);
      else setSalesDay(getTodayStr());
      setSaleSuccess(true); setCart([]);
      setTimeout(() => setSaleSuccess(false), 3000);
      loadFdEod();
    } catch (err) {
      // Nothing was sold: keep the cart so the desk can fix it, and show the real stock
      setSaleError(err?.response?.data?.error || t('sales.saleFailed'));
      reloadProducts();
    } finally {
      setSelling(false);
    }
  };

  // Fresh figures each time the Operations tab is opened
  useEffect(() => { if (activeTab === 'OPERATIONS') loadFdEod(); }, [activeTab]);

  // ── Operations ────────────────────────────────────────────────────────────
  const handleIssue = async () => {
    const fe = { ...(!issueForm.equipment.trim() && { equipment: t('common.required') }), ...(!issueForm.description.trim() && { description: t('common.required') }) };
    setIssueErrors(fe);
    if (Object.keys(fe).length || issueSaving) return;
    const timeLabel = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
    // Only a saved issue is reported as logged: on a refusal the form stays,
    // with the server's reason (F-084)
    setIssueError('');
    setIssueSaving(true);
    try {
      await createEquipmentIssue({
        equipment: issueForm.equipment.trim(),
        location: issueForm.location.trim() || undefined,
        description: issueForm.description.trim(),
        severity: issueForm.severity.toLowerCase(),
      });
    } catch (err) {
      const se = serverFieldError(err, t('operations.saveIssueFailed'));
      if (se.field === 'equipment' || se.field === 'description') setIssueErrors(x => ({ ...x, [se.field]: se.message }));
      else setIssueError(se.message);
      return;
    } finally {
      setIssueSaving(false);
    }
    setOpsActivity(prev => [{ type: 'issue', text: t('frontDesk.issueReportedLine', { name: issueForm.equipment }), time: timeLabel }, ...prev]);
    setIssueSuccess(true); setIssueForm(emptyIssue);
    // Close the whole modal after the confirmation, rather than flipping back to
    // an empty form - which read as a second "report issue" prompt popping up.
    setTimeout(() => { setShowIssueModal(false); setIssueSuccess(false); }, 1400);
  };
  const handleExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    const limit = gymSettings.expenseLimit;
    // Who the money went to is required - an expense in the books without it is
    // untraceable. Over the desk limit cannot be created at all - it has to be
    // arranged with a manager directly, not pushed through the desk.
    const fe = {
      ...(!expenseForm.description.trim() && { description: t('common.required') }),
      ...(!expenseForm.paidTo?.trim() && { paidTo: t('frontDesk.paidToRequired') }),
      ...((!amt || amt <= 0) ? { amount: t('payments.invalidAmount') } : amt > limit ? { amount: t('frontDesk.expenseOverLimitBlocked', { limit: formatMoney(limit) }) } : {}),
    };
    setExpenseFieldErrors(fe);
    if (Object.keys(fe).length || expenseSaving) return;
    setExpenseError('');
    const today = getTodayStr();
    // Every desk expense now waits for a manager's approval before it reaches
    // the books. `source:'frontdesk'` makes the server hold it pending.
    // Only a saved expense is reported as sent: money has left the drawer, so a
    // refusal must say so and keep the form (F-107)
    setExpenseSaving(true);
    try {
      await createExpense({
        title: expenseForm.description.trim(),
        amount: amt,
        category: expenseForm.category,
        date: today,
        method: acceptedMethod(expenseForm.paymentMethod, enabledMethods(gymSettings)),
        paidTo: expenseForm.paidTo?.trim() || undefined,
        recordedBy: session?.staffName || undefined,
        source: 'frontdesk',
      });
    } catch (err) {
      const se = serverFieldError(err, t('reports.failedToSave'));
      const field = se.field === 'title' ? 'description' : se.field;
      if (field === 'description' || field === 'paidTo' || field === 'amount') setExpenseFieldErrors(x => ({ ...x, [field]: se.message }));
      else setExpenseError(se.message);
      return;
    } finally {
      setExpenseSaving(false);
    }
    setOpsActivity(prev => [{ type:'expense', text: t('frontDesk.expenseSentLine', { desc: expenseForm.description, amount: formatMoney(amt) }), time: new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setExpenseWasPending(true);
    setExpenseSuccess(true); setExpenseForm(emptyExpense);
    // Close the whole modal after the confirmation, rather than flipping back to
    // an empty form - which read as a second expense prompt popping up.
    setTimeout(() => { setShowExpenseModal(false); setExpenseSuccess(false); }, 1600);
  };
  const handleAddTask = async () => {
    const e = {};
    if (!taskForm.title.trim()) e.title = t('tasks.titleRequired');
    if (!taskForm.assignedTo) e.assignedTo = t('tasks.assigneeRequired');
    if (!taskForm.dueDate) e.dueDate = t('tasks.dueDateRequired');
    if (!taskForm.category) e.category = t('tasks.categoryRequired');
    if (Object.keys(e).length) { setTaskErrors(e); return; }
    setTaskSaving(true);
    try {
      await createTask({
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        dueDate: taskForm.dueDate || undefined,
        priority: taskForm.priority,
        category: taskForm.category,
        ...assignFields(taskForm.assignedTo),
      });
      refreshMyTasks();
      setTaskSuccess(true); setTaskForm(emptyTask); setTaskErrors({});
      setTimeout(() => setTaskSuccess(false), 3000);
    } catch (err) {
      setTaskErrors({ title: err?.response?.data?.error || t('tasks.saveFailed') });
    } finally {
      setTaskSaving(false);
    }
  };

  // The exit gate (the manager's account password), drawn by both the desk and
  // its sign-in screen: every way out of the kiosk goes through it (F-106).
  const exitGate = showExitAuth ? (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <DialogBox label={t('frontDesk.enterYourPassword')} onClose={() => setShowExitAuth(false)} style={{ width:'100%', maxWidth:400, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, boxShadow:'0 24px 80px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:12 }}>
          <div>
            <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
              {t('frontDesk.enterYourPassword')}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>
              {`${t('frontDesk.authenticatingAs')} ${meUser ? `${meUser.firstName || ''} ${meUser.lastName || ''}`.trim() : ''}`}
            </div>
          </div>
          <button aria-label={t('common.close')} onClick={() => setShowExitAuth(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:28, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ position:'relative' }}>
            <input
              type={showExitPw ? 'text' : 'password'}
              value={exitPassword}
              autoFocus
              autoComplete="new-password"
              name="gem-exit-secret"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              data-form-type="other"
              onChange={e => { setExitPassword(e.target.value); setExitPinError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleExitConfirm(); }}
              placeholder={t('auth.loginPasswordPh')}
              style={{ width:'100%', boxSizing:'border-box', background:'var(--bg-elevated)', border:`1px solid ${exitPinError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius:10, padding:'12px 44px 12px 14px', fontSize:15, color:'var(--text-primary)', fontFamily:'DM Sans', outline:'none' }}
            />
            <button type="button" aria-label={showExitPw ? t('common.hidePassword') : t('common.showPassword')} onClick={() => setShowExitPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:2 }}>
              {showExitPw ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          {exitPinError && (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', textAlign:'center' }}>{exitPinError}</div>
          )}
          <button onClick={handleExitConfirm} disabled={!exitPassword || exitBusy}
            style={{ ...primaryBtn, width:'100%', justifyContent:'center', padding:'13px', fontSize:14, opacity:(!exitPassword || exitBusy) ? 0.6 : 1, cursor:(!exitPassword || exitBusy) ? 'default' : 'pointer' }}>
            <LogOut size={15}/> {exitBusy ? t('frontDesk.verifying') : t('frontDesk.exitToApp')}
          </button>
        </div>
      </DialogBox>
    </div>
  ) : null;

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!session) {
    const gymName = (gymData?.name || 'GEM FITNESS').toUpperCase();
    return (
      <div className="page-fade" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 24 }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'var(--accent-gold-dim)', border: '1px solid var(--accent-gold)', marginBottom: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>G</span>
          </div>
          <div style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>{gymName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4 }}>
            {capFirst(new Date().toLocaleDateString(getDateLocale(), { weekday:'long', month:'long', day:'numeric', year:'numeric' }))}
          </div>
        </div>

        {/* Login card */}
        <div style={{ width: '100%', maxWidth: loginStep === 'pin' ? 400 : 560, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {loginStep === 'pin' && (
              <button aria-label={t('common.back')} onClick={() => { setLoginStep('select'); setLoginPin(''); setLoginError(''); }} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ArrowLeft size={16}/></button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
                {loginStep === 'select' ? t('frontDesk.frontDeskLogin') : t('frontDesk.enterYourPin')}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {loginStep === 'select' ? t('frontDesk.selectYourName') : `${t('frontDesk.loggingInAs')} ${selStaff ? staffFullName(selStaff) : ''}`}
              </div>
            </div>
            <span style={{ marginLeft:'auto', background:'var(--accent-gold-dim)', color:'var(--accent-gold)', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, letterSpacing:'1.5px', flexShrink:0, textTransform:'uppercase' }}>{t('staff.roleFrontDesk')}</span>
          </div>

          <div style={{ padding: 28 }}>
            {/* Staff grid */}
            {loginStep === 'select' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {staffList.filter(s => {
                  if (s.isActive === false) return false;
                  if (!['manager', 'front_desk', 'general_manager'].includes(s.role)) return false;
                  if (s.role === 'manager' || s.role === 'general_manager') return true;
                  return isWorkingToday(s);
                }).map(s => {
                  const name = staffFullName(s); const [fn,...rest] = name.split(' '); const ln = rest.join(' ') || 'X';
                  return (
                    <button key={s.id} onClick={() => { setSelStaff(s); setLoginPin(''); setLoginError(''); setLoginStep('pin'); }} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'16px 12px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:10, transition:'all 0.15s', textAlign:'center' }} onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-gold)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.transform='none'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
                      {s.photo ? <img src={s.photo} alt={name} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={ln} avatarColor={staffColor(s)} size={44}/>}
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', lineHeight:1.3 }}>{name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{translateRole(s.role)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* PIN entry */}
            {loginStep === 'pin' && selStaff && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  {(() => { const nm = staffFullName(selStaff); const [fn,...r] = nm.split(' '); return selStaff.photo ? <img src={selStaff.photo} alt={fn} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={staffColor(selStaff)} size={52}/>; })()}
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope' }}>{staffFullName(selStaff)}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{translateRole(selStaff.role)}</div>
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:12, minHeight:32, alignItems:'center' }}>
                  {loginPin.length > 0
                    ? Array.from(loginPin).map((_,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background: loginError ? 'var(--accent-red)' : 'var(--accent-gold)' }}/>)
                    : <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.enterPinToLogin')}</span>}
                </div>
                {loginError && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', textAlign:'center', width:'100%' }}>{loginError}</div>}
                {isDemoMode() && selStaff?.accessCode && (
                  <div style={{ background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.3)', borderRadius:10, padding:'10px 16px', width:'100%', textAlign:'center' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#c9a96e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>Demo. PIN for {selStaff.firstName}</div>
                    <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:22, fontWeight:800, color:'#c9a96e', letterSpacing:'6px' }}>{selStaff.accessCode}</div>
                  </div>
                )}
                <div style={{ width:'100%' }}>
                  <LoginPinPad onDigit={d => { if (loginPin.length < 6) { setLoginPin(p=>p+d); setLoginError(''); } }} onBack={() => { setLoginPin(p=>p.slice(0,-1)); setLoginError(''); }} onConfirm={handleLoginConfirm} confirmEnabled={loginPin.length >= 3}/>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop:20, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.selectNameAndPin')}</span>
          <button type="button" onClick={() => requestExit('/dashboard')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', cursor:'pointer', transition:'color 0.15s' }} onMouseEnter={e=>e.currentTarget.style.color='var(--text-secondary)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>{t('frontDesk.backToDashboard')}</button>
        </div>
        {exitGate}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KIOSK SCREEN
  // ══════════════════════════════════════════════════════════════════════════

  // Left sidebar (always visible)
  const leftPanel = (
    <div data-fdtour="left-panel" style={{ ...(isMobile ? { borderTop:'1px solid var(--border-subtle)' } : { borderRight:'1px solid var(--border-subtle)' }), padding:20, display:'flex', flexDirection:'column', gap:20, overflowY:'auto' }}>
      <SchedulePanel events={scheduleEvents}/>
      <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:16 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:12, fontFamily:'DM Sans' }}>{t('frontDesk.staffOnDuty')}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {staffList.filter(s=>s.isActive!==false && isWorkingToday(s)).slice(0,5).map(s => {
            const nm = staffFullName(s); const [fn,...r] = nm.split(' ');
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                {s.photo ? <img src={s.photo} alt={fn} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={staffColor(s)} size={28}/>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: s.id===session.staffId ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{translateRole(s.role)}</div>
                </div>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-green)', flexShrink:0 }}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    // On a desk screen the kiosk is held to the window, so a long check-in list,
    // product grid or sales list scrolls inside its own column instead of
    // dragging the whole page. Phones stack the columns and scroll as a page.
    <div className="page-fade" style={{ ...(isMobile ? { minHeight:'100vh' } : { height:'100vh', overflow:'hidden' }), background:'var(--bg-base)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div data-fdtour="header" style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)', padding: isMobile ? '0 16px' : '0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height: isMobile ? 52 : 56, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 14 }}>
          <span style={{ fontFamily:'Manrope', fontSize: isMobile ? 15 : 17, fontWeight:800, color:'var(--accent-gold)', letterSpacing:'1px' }}>{(gymData?.name||'GEM FITNESS').toUpperCase()}</span>
          {!isMobile && <span style={{ background:'var(--accent-gold-dim)', color:'var(--accent-gold)', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, letterSpacing:'1.5px' }}>{t('frontDesk.frontDeskMode')}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 14 }}>
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent-green)' }}/>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{t('frontDesk.loggedInAs')}: <strong style={{ color:'var(--text-primary)' }}>{session.staffName}</strong></span>
            </div>
          )}
          {/* The desk has no app header, so this is the only way anything
              reaches whoever is standing at it */}
          <NotificationBell onOpenLink={(link) => {
            // A manager working the desk must clear the same pin to leave for
            // the app, whichever door they use - a notification that deep-links
            // into the dashboard used to walk straight past the exit gate. A
            // real front-desk account has no dashboard to protect, so their
            // notifications open as usual.
            if (isDeskAccount) { navigate(toKioskLink(link)); return; }
            requestExit(link || '/dashboard');
          }} />
          {isDeskAccount ? (
            <>
              <button onClick={() => navigate('/front-desk/my-profile')} aria-label={t('frontDesk.myProfile')} title={t('frontDesk.myProfile')} style={{ ...secondaryBtn, padding: isMobile ? '6px 10px' : '6px 14px', fontSize:12 }}><UserCircle size={13}/>{!isMobile && ` ${t('frontDesk.myProfile')}`}</button>
              <button onClick={handleSignOut} aria-label={t('frontDesk.signOut')} title={t('frontDesk.signOut')} style={{ ...secondaryBtn, padding: isMobile ? '6px 10px' : '6px 14px', fontSize:12, color:'var(--accent-red)', borderColor:'rgba(239,68,68,0.3)' }}><LogOut size={13}/>{!isMobile && ` ${t('frontDesk.signOut')}`}</button>
            </>
          ) : (
            <button onClick={handleExit} style={{ ...secondaryBtn, padding: isMobile ? '6px 10px' : '6px 14px', fontSize:12, color:'var(--accent-red)', borderColor:'rgba(239,68,68,0.3)' }}><LogOut size={13}/>{!isMobile && ` ${t('frontDesk.exitFrontDesk')}`}</button>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)', padding: isMobile ? '0 8px' : '0 28px', display:'flex', flexShrink:0, overflowX: isMobile ? 'auto' : 'visible', scrollbarWidth:'none' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setFdProfileId(null); }} style={{ padding: isMobile ? '11px 14px' : '12px 20px', background:'none', border:'none', borderBottom:`2px solid ${activeTab===tab.key?'var(--accent-gold)':'transparent'}`, color: activeTab===tab.key ? 'var(--accent-gold)' : 'var(--text-secondary)', fontSize: isMobile ? 11 : 11, fontWeight:700, letterSpacing:'1px', cursor:'pointer', fontFamily:'DM Sans', transition:'color 0.15s', flexShrink:0, whiteSpace:'nowrap' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex:1, minHeight:0, display: isMobile ? 'flex' : 'grid', flexDirection: isMobile ? 'column' : undefined, gridTemplateColumns: isMobile ? undefined : '260px minmax(0, 1fr) 300px', gridTemplateRows: isMobile ? undefined : 'minmax(0, 1fr)', overflow:'hidden' }}>

        {/* Left: schedule + staff - desktop only */}
        {!isMobile && leftPanel}

        {/* ── Member profile, opened in the centre over the keypad ────────── */}
        {fdProfileId && (
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, flex:1 }}>
            <div style={{ flex:1, overflowY:'auto', minWidth:0 }}>
              <MemberProfilePage
                memberId={fdProfileId}
                onBack={() => setFdProfileId(null)}
                fromFrontDesk={true}
                seedMember={membersList.find(m => String(m.id) === String(fdProfileId))}
                seedGym={gymData}
                seedPackages={packagesList}
              />
            </div>
          </div>
        )}

        {/* ── CENTER ─────────────────────────────────────────────────────── */}
        {activeTab === 'CHECK-IN' && !fdProfileId && (
          <div data-fdtour="checkin-search" style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 28px', overflowY:'auto' }}>
            <div style={{ width:'100%', maxWidth:440 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:16, fontFamily:'DM Sans', textAlign:'center' }}>{t('frontDesk.checkInMemberOrStaff')}</div>
              {/* Search */}
              <div style={{ position:'relative', marginBottom:20 }}>
                <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPinInput(''); runSearch(e.target.value); }} onKeyDown={e => e.key==='Enter'&&handleCheckIn()} placeholder={t('frontDesk.searchPlaceholderCheckin')} style={{ width:'100%', height:48, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, paddingLeft:42, paddingRight:80, fontSize:14, color:'var(--text-primary)', fontFamily:'DM Sans', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }} onFocus={e=>e.target.style.borderColor='var(--accent-gold)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
                <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center', gap:4 }}>
                  {searchTerm && <button aria-label={t('common.clearSearch')} onClick={resetCheckin} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:2 }}><X size={14}/></button>}
                </div>
              </div>
              {searchTerm && !foundMember && fdMatches.length > 1 && (
                <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, overflow:'hidden', marginBottom:20 }}>
                  <div style={{ padding:'9px 14px', fontSize:11, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', color:'var(--text-muted)', borderBottom:'1px solid var(--border-subtle)', fontFamily:'DM Sans' }}>{t('attendance.pickOne', { n: fdMatches.length })}</div>
                  {fdMatches.map((f, i) => (
                    <button key={f.id} onClick={() => pickFound(f)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'transparent', border:'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor:'pointer', textAlign:'left', color:'var(--text-primary)', fontFamily:'DM Sans' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {f.photo ? <img src={f.photo} alt={f.firstName} style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={f.firstName} lastName={f.lastName} avatarColor={f.avatarColor} size={34}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.firstName} {f.lastName}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f._isStaff ? translateRole(f.package) : [f.package?.name, f.memberCode].filter(Boolean).join(' · ')}</div>
                      </div>
                      {f._isStaff
                        ? <span style={{ fontSize:11, fontWeight:600, borderRadius:20, padding:'2px 9px', color:'var(--accent-blue)', border:'1px solid var(--accent-blue)', whiteSpace:'nowrap' }}>{t('attendance.staff')}</span>
                        : <MemberStatusTags member={f} typeOnly/>}
                    </button>
                  ))}
                </div>
              )}
              {searchTerm && foundMember && fdMatches.length > 1 && !checkedIn && (
                <button onClick={() => setFoundMember(null)} style={{ background:'none', border:'none', padding:0, marginBottom:8, cursor:'pointer', fontSize:12, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{t('attendance.seeAllMatches', { n: fdMatches.length })}</button>
              )}
              {/* Result. shown above keypad */}
              {searchTerm && foundMember && (
                <div style={{ padding:16, background: blockReason?'rgba(239,68,68,0.04)':'var(--bg-elevated)', borderRadius:12, border:`1px solid ${blockReason?'rgba(239,68,68,0.3)':checkedIn?'rgba(52,211,153,0.4)':'var(--accent-gold-dim)'}`, marginBottom:20 }}>
                  {blockReason && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', display:'flex', alignItems:'flex-start', gap:8, marginBottom:12 }}><AlertTriangle size={13} style={{ flexShrink:0, marginTop:1 }}/>{blockReason}</div>}
                  {!blockReason && foundMember.status==='expiring' && <div style={{ background:'var(--accent-yellow-dim)', color:'var(--accent-yellow)', borderRadius:7, padding:'7px 12px', fontSize:12, fontFamily:'DM Sans', fontWeight:500, marginBottom:12 }}>⚠ {t('frontDesk.membershipExpiringSoon')} : {formatDate(foundMember.endDate)}</div>}
                  {staffClockError && <div role="alert" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', marginBottom:12 }}>{staffClockError}</div>}
                  {checkedIn && <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:7, padding:'8px 12px', fontSize:13, fontWeight:600, color:'#34d399', fontFamily:'DM Sans', textAlign:'center', marginBottom:12 }}>{staffClockMsg || t('frontDesk.checkedInSuccess')}</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {(() => {
                      const mp = foundMember.photo || null;
                      return mp
                        ? <img src={mp} alt={foundMember.firstName} onClick={() => setPhotoLightbox(mp)} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in', border:'2px solid var(--accent-gold-dim)' }}/>
                        : <Avatar firstName={foundMember.firstName} lastName={foundMember.lastName} avatarColor={foundMember.avatarColor} size={40}/>;
                    })()}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', columnGap:8, rowGap:4, marginBottom:2 }}>
                        <span style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{foundMember.firstName} {foundMember.lastName}</span>
                        <span style={{ display:'inline-flex', flexShrink:0 }}><MemberStatusTags member={foundMember}/></span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{foundMember._isStaff ? translateRole(foundMember.package) : `${foundMember.memberCode || foundMember.id} · ${foundMember.package?.name ?? foundMember.package ?? '-'}`}</div>
                      {foundMember._isStaff && !checkedIn && (
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                          <div style={{
                            alignSelf:'flex-start', fontSize:11, fontWeight:600, fontFamily:'DM Sans', borderRadius:6, padding:'3px 8px',
                            background: staffOpenCard ? 'var(--accent-yellow-dim)' : 'var(--accent-green-dim)',
                            color: staffOpenCard ? 'var(--accent-yellow)' : 'var(--accent-green)',
                          }}>
                            {staffOpenCard
                              ? t('frontDesk.willClockOut', { time: new Date(staffOpenCard.punchIn).toLocaleTimeString(getDateLocale(), { hour:'2-digit', minute:'2-digit' }) })
                              : t('frontDesk.willClockIn')}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <label style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.clockTime')}</label>
                            <TimeInput value={staffTime || clockNow()} onChange={e => setStaffTime(e.target.value)}
                              style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'5px 8px', fontSize:12, color:'var(--text-primary)', fontFamily:'JetBrains Mono, monospace' }} />
                            {staffTime && staffTime !== clockNow() && (
                              <span style={{ fontSize:10.5, color:'var(--accent-yellow)', fontFamily:'DM Sans' }}>{t('frontDesk.clockTimeEdited')}</span>
                            )}
                          </div>
                          {staffTime && staffTime !== clockNow() && (
                            <textarea rows={2} value={staffNote} onChange={e => setStaffNote(e.target.value)}
                              placeholder={t('frontDesk.clockNotePlaceholder')}
                              style={{ width:'100%', background:'var(--bg-elevated)', border:`1px solid ${staffNote.trim() ? 'var(--border-subtle)' : 'var(--accent-yellow)'}`, borderRadius:8, padding:'7px 10px', fontSize:12, color:'var(--text-primary)', fontFamily:'DM Sans', outline:'none', boxSizing:'border-box', resize:'vertical' }} />
                          )}
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:4 }}>
                        {!foundMember._isStaff && (foundMember.balance > 0
                          ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-red-dim)', color:'var(--accent-red)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>⚠ {t('frontDesk.owes')} {formatMoney(foundMember.balance)}</span>
                          : <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-green-dim)', color:'var(--accent-green)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>✓ {t('frontDesk.noBalanceDue')}</span>)}
                        {(foundMember.isVisitor || foundMember.status === 'visitor') && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-blue-dim)', color:'var(--accent-blue)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>
                            {passesLeft(foundMember)} {t('memberProfile.passesRemainingLabel')}
                          </span>
                        )}
                      </div>
                    </div>
                    {!foundMember._isStaff && <button onClick={() => setFdProfileId(foundMember.id)} style={{ ...secondaryBtn, padding:'6px 12px', fontSize:11 }}>{t('members.viewProfile')} →</button>}
                    {foundMember._isStaff && <button onClick={() => navigate(`/front-desk/staff/${String(foundMember.id).replace(/^STAFF-/, '')}`)} style={{ ...secondaryBtn, padding:'6px 12px', fontSize:11 }}>{t('members.viewProfile')} →</button>}
                  </div>
                  {checkedIn && <button onClick={resetCheckin} style={{ ...secondaryBtn, marginTop:12, width:'100%', justifyContent:'center' }}>{t('common.close')}</button>}
                </div>
              )}
              {searchTerm && !foundMember && fdMatches.length < 2 && (codeAttempt || checkedIn ? (
                <div style={{ padding:'12px 16px', background:'var(--bg-elevated)', borderRadius:10, fontSize:13, fontFamily:'DM Sans', textAlign:'center', marginBottom:20, color: staffClockError ? 'var(--accent-red)' : (checkedIn ? '#34d399' : 'var(--text-secondary)') }}>
                  {staffClockError || staffClockMsg || t('frontDesk.pressToUseCode')}
                </div>
              ) : (
                <div style={{ padding:'12px 16px', background:'var(--bg-elevated)', borderRadius:10, fontSize:13, color:'var(--text-muted)', fontFamily:'DM Sans', textAlign:'center', marginBottom:20 }}>{t('frontDesk.noMatchFor')} "{searchTerm}"</div>
              ))}
              {/* PIN dots */}
              <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:20, minHeight:36, alignItems:'center' }}>
                {pinInput.length > 0
                  ? Array.from(pinInput).map((_,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background:'var(--accent-gold)' }}/>)
                  : <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.enterPinOrSearch')}</span>}
              </div>
              {/* PIN pad */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:20 }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:20, fontWeight:600, color:'var(--text-primary)', cursor:'pointer', fontFamily:'Manrope', transition:'all 0.1s' }} onClick={()=>handlePinPress(String(n))} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-card-hover)';e.currentTarget.style.borderColor='var(--accent-gold)';}} onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-elevated)';e.currentTarget.style.borderColor='var(--border-subtle)';}}>{n}</button>
                ))}
                <button onClick={handlePinBack} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:14, color:'var(--text-muted)', cursor:'pointer', transition:'all 0.1s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='var(--bg-elevated)'}>⌫</button>
                <button onClick={()=>handlePinPress('0')} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:20, fontWeight:600, color:'var(--text-primary)', cursor:'pointer', fontFamily:'Manrope', transition:'all 0.1s' }} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-card-hover)';e.currentTarget.style.borderColor='var(--accent-gold)';}} onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-elevated)';e.currentTarget.style.borderColor='var(--border-subtle)';}}>0</button>
                <button onClick={handleCheckIn} disabled={(!foundMember && !codeAttempt)||!!blockReason||checkedIn} style={{ height:56, background: (foundMember||codeAttempt)&&!blockReason&&!checkedIn ? 'linear-gradient(135deg,#c9a96e,#b08d4a)' : 'var(--bg-elevated)', border:`1px solid ${(foundMember||codeAttempt)&&!blockReason&&!checkedIn?'transparent':'var(--border-subtle)'}`, borderRadius:10, fontSize:20, color: (foundMember||codeAttempt)&&!blockReason&&!checkedIn ? '#0a0a0f' : 'var(--text-muted)', cursor: (foundMember||codeAttempt)&&!blockReason&&!checkedIn ? 'pointer' : 'default', transition:'all 0.1s' }}>✓</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SIGN UP ─────────────────────────────────────────────────────── */}
        {activeTab === 'SIGN UP' && !fdProfileId && (
          <div data-fdtour="signup" style={{ overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.registration')}</div>
            <div className="gem-two-col" style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:14 }}>
              {/* New Member card */}
              <button onClick={() => setShowAddMember(true)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'28px 20px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-gold)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.transform='none';}}>
                <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <UserCheck size={20} color="var(--accent-gold)"/>
                </div>
                <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{t('frontDesk.newMemberTitle')}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', lineHeight:1.5 }}>{t('frontDesk.newMemberDesc')}</div>
              </button>
              {/* New Visitor card */}
              <button onClick={() => setShowAddVisitor(true)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'28px 20px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.transform='none';}}>
                <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-blue-dim)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <UserPlus size={20} color="var(--accent-blue)"/>
                </div>
                <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{t('frontDesk.newVisitorTitle')}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', lineHeight:1.5 }}>{t('frontDesk.newVisitorDesc')}</div>
              </button>
            </div>
          </div>
        )}

        {/* ── PRODUCT SALE ──────────────────────────────────────────────── */}
        {activeTab === 'PRODUCT SALE' && !fdProfileId && (
          <div data-fdtour="product-sale" style={{ overflowY:'auto', padding:'24px 28px' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:16, fontFamily:'DM Sans' }}>{t('frontDesk.productSaleLabel')}</div>
            {/* Category filter */}
            <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
              {displayCats.map(c => (
                <button key={c} onClick={()=>setProdCat(c)} style={{ padding:'5px 12px', background: prodCat===c?'var(--accent-gold)':'var(--bg-elevated)', color: prodCat===c?'#0a0a0f':'var(--text-secondary)', border:`1px solid ${prodCat===c?'transparent':'var(--border-subtle)'}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans', transition:'all 0.1s' }}>{tProdCat(c)}</button>
              ))}
            </div>
            {/* Product grid */}
            {displayProducts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)', fontSize:13, fontFamily:'DM Sans' }}>
                {t('sales.noProductsFrontDesk')}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10 }}>
                {displayProducts.filter(p => prodCat==='All' || p.category===prodCat).map(p => { const out = (p.stock ?? 0) <= 0; return (
                  <button key={p.id} onClick={()=>addToCart(p)} disabled={out} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'14px 12px', cursor: out ? 'not-allowed' : 'pointer', textAlign:'left', transition:'all 0.12s', opacity: out ? 0.5 : 1 }} onMouseEnter={e=>{ if (out) return; e.currentTarget.style.borderColor='var(--accent-gold)';e.currentTarget.style.background='var(--bg-card-hover)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.background='var(--bg-elevated)';}}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Sans', marginBottom:4, lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'JetBrains Mono, monospace', marginBottom:4 }}>{p.code}</div>
                    <div style={{ fontSize:10, color:'var(--accent-gold)', fontFamily:'DM Sans', marginBottom:6 }}>{tProdCat(p.category)}</div>
                    <div style={{ fontFamily:'Manrope' }}><PriceTag product={p} size={13} color="var(--text-primary)" /></div>
                    <div style={{ fontSize:10, color: out || (p.stock <= (p.reorderLevel ?? 5)) ? 'var(--accent-red)' : 'var(--text-muted)', fontFamily:'DM Sans', marginTop:4 }}>{out ? t('sales.outOfStock') : `${t('sales.stockLabel')}: ${p.stock}`}</div>
                    <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:4, background: out ? 'var(--bg-card)' : 'var(--accent-gold-dim)', color: out ? 'var(--text-muted)' : 'var(--accent-gold)', borderRadius:6, padding:'3px 0', fontSize:11, fontWeight:700, fontFamily:'DM Sans' }}>{out ? t('sales.outOfStock') : <><Plus size={10}/> {t('common.add')}</>}</div>
                  </button>
                ); })}
              </div>
            )}
          </div>
        )}

        {/* ── OPERATIONS ──────────────────────────────────────────────────── */}
        {activeTab === 'OPERATIONS' && !fdProfileId && (
          <div data-fdtour="operations" style={{ overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:24 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.todaysSummary')}</div>

            {/* ── Daily Summary Strip ── */}
            {(() => {
              // From the server's report for today, so every desk and a refresh agree
              const e = fdEod;
              // The shop counts toward revenue by its profit; what it took in is shown under it
              const productRev  = e ? (e.totals.salesProfit ?? 0) : 0;
              const shopTakings = e ? e.totals.salesTotal : daySales.reduce((s,t) => s+t.total, 0);
              const regRev      = e ? e.totals.paymentsTotal : dayRegs.reduce((s,r) => s+r.amount, 0);
              const totalRev    = e ? e.totals.revenue : regRev;
              const itemsSold   = e ? e.totals.itemsSold : daySales.reduce((s,t) => s+t.items, 0);
              const memberCI    = e ? e.checkins.filter(c=>c.who==='member').length : todayCheckins.filter(c=>c.type==='member').length;
              const visitorCI   = e ? e.checkins.filter(c=>c.who==='visitor').length : todayCheckins.filter(c=>c.type==='visitor').length;
              const regCount    = e ? e.registrations.length : dayRegs.length;
              const regMembers  = e ? e.registrations.filter(r=>r.type==='member').length : dayRegs.filter(r=>r.type==='Membership').length;
              const regVisitors = e ? e.registrations.filter(r=>r.type==='visitor').length : dayRegs.filter(r=>r.type==='Visitor').length;
              const txCount     = e ? e.sales.length : daySales.length;
              const fmt = n => formatMoney(n);
              const tiles = [
                { label: t('operations.checkInsToday'),   value: memberCI,          sub: t('frontDesk.nVisitorsCheckin', { n: visitorCI }), accent:'var(--accent-blue)',   dim:'var(--accent-blue-dim)',   icon: UserCheck },
                { label: t('frontDesk.newRegistrations'), value: regCount,    sub: t('frontDesk.nMembersVisitors', { members: regMembers, visitors: regVisitors }), accent:'var(--accent-gold)', dim:'var(--accent-gold-dim)', icon: UserPlus },
                { label: t('operations.eodItemsSold'),    value: itemsSold,         sub: t('frontDesk.nTransactions', { n: txCount }),         accent:'var(--accent-purple)', dim:'var(--accent-purple-dim)', icon: ShoppingCart },
                { label: t('operations.eodMemberRev'),   value: fmt(regRev),       sub: null,                            accent:'var(--accent-yellow)', dim:'var(--accent-yellow-dim)', icon: CreditCard },
                { label: t('reports.revShop'),  value: fmt(productRev),   sub: t('operations.shopTakings', { amount: fmt(shopTakings) }),                            accent:'var(--accent-blue)',   dim:'var(--accent-blue-dim)',   icon: ShoppingCart },
                { label: t('dashboard.revenue'),         value: fmt(totalRev),     sub: t('common.today'),               accent:'var(--accent-green)',  dim:'var(--accent-green-dim)',  icon: TrendingUp  },
              ];
              return (
                <div className="gem-stats-grid" style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:10 }}>
                  {tiles.map(t => (
                    <div key={t.label} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:26, height:26, borderRadius:7, background:t.dim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <t.icon size={12} color={t.accent}/>
                        </div>
                        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', fontWeight:600 }}>{t.label}</span>
                      </div>
                      <div style={{ fontSize:20, fontWeight:800, color:t.accent, fontFamily:'Manrope', lineHeight:1.1 }}>{t.value}</div>
                      {t.sub && <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:4 }}>{t.sub}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.quickActions')}</div>
            <div className="gem-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { icon: Wrench,   label: t('operations.reportIssue'),  accent:'var(--accent-yellow)', dim:'rgba(251,191,36,0.1)',  onClick:()=>{ setIssueSuccess(false); setIssueError(''); setIssueErrors({}); setIssueForm(emptyIssue); setShowIssueModal(true); } },
                { icon: Receipt,  label: t('frontDesk.quickExpense'),   accent:'#f87171',              dim:'rgba(248,113,113,0.1)', onClick:()=>{ refreshGymSettings(); setExpenseError(''); setExpenseSuccess(false); setShowExpenseModal(true); } },
                { icon: FileText, label: t('tasks.addTask'),            accent:'var(--accent-green)',  dim:'rgba(52,211,153,0.1)', onClick:()=>setShowTaskModal(true) },
                { icon: Download, label: t('frontDesk.eodReport'),      accent:'var(--accent-gold)',   dim:'rgba(201,169,110,0.1)', onClick:()=>setShowEodModal(true) },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick} style={{ background:'var(--bg-elevated)', border:`1px solid var(--border-subtle)`, borderRadius:12, padding:'16px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left', transition:'all 0.15s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=btn.accent; e.currentTarget.style.background=btn.dim; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:btn.dim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <btn.icon size={15} color={btn.accent}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', lineHeight:1.3 }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        {/* On a phone the columns stack: recent check-ins under the keypad, then the programme */}
        {activeTab === 'CHECK-IN' && (
          <div data-fdtour="checkin-recent" style={{ ...(isMobile ? { borderTop:'1px solid var(--border-subtle)', maxHeight:'60vh' } : { borderLeft:'1px solid var(--border-subtle)' }), display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.recentCheckIns')}</span>
              <select aria-label={t('common.checkinsSince')} value={timeFilter} onChange={e=>setTimeFilter(e.target.value)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:6, padding:'3px 8px', fontSize:11, color:'var(--text-secondary)', fontFamily:'DM Sans', cursor:'pointer', outline:'none' }}>
                {TIME_FILTER_KEYS.map(f=><option key={f.key} value={f.key}>{t(`frontDesk.${f.key}`)}</option>)}
              </select>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {memberCheckins.length > 0 && <>
                <div style={{ padding:'4px 18px 8px', fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.membersLabel')}</div>
                {memberCheckins.map((c,i) => { const m = c.member; if (!m) return null; const mp = m.photo || null; return (
                  <div key={i} style={{ padding:'9px 18px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', transition:'background 0.1s' }} onClick={()=> m.id && setFdProfileId(m.id)} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {mp ? <img src={mp} alt={m.firstName} onClick={e=>{e.stopPropagation();setPhotoLightbox(mp);}} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={28}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.firstName} {m.lastName}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.package?.name ?? m.memberCode ?? '-'}</span>
                        <VisitKindBadge kind={c.kind} isVisitor={m.isVisitor} onlyPasses />
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                      <StatusDot visit={c}/>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{c.timeLabel}</span>
                    </div>
                  </div>
                );})}
              </>}
              {staffCheckins.length > 0 && <>
                <div style={{ padding:'12px 18px 8px', fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans', borderTop: memberCheckins.length>0?'1px solid var(--border-subtle)':'none', marginTop: memberCheckins.length>0?4:0 }}>{t('frontDesk.staffLabel')}</div>
                {staffCheckins.map((c,i) => { const m = c.member; if (!m) return null; const nm = staffFullName(m); const [fn,...r] = nm.split(' '); const sp = m.photo || null; return (
                  <div key={i} style={{ padding:'9px 18px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', transition:'background 0.1s' }} onClick={()=>navigate(`/front-desk/staff/${m.id}`)} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {sp ? <img src={sp} alt={fn} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={m.avatarColor || 'gold'} size={28}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{translateRole(m.role) || t('attendance.staff')}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                      <CheckCircle size={13} color="var(--accent-green)"/>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{c.timeLabel}</span>
                    </div>
                  </div>
                );})}
              </>}
              {memberCheckins.length===0 && staffCheckins.length===0 && (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <Clock size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noCheckInsThisPeriod')}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {isMobile && activeTab === 'CHECK-IN' && leftPanel}

        {activeTab === 'SIGN UP' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.todaySignups')}</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {todaySignups.length === 0 ? (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <UserCheck size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noSignupsToday')}</div>
                </div>
              ) : todaySignups.map((s,i) => (
                <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{s.package} · {s.time}</div>
                </div>
              ))}
            </div>
            {/* Packages reference */}
            <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'14px 18px', flexShrink:0 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans', marginBottom:10 }}>{t('frontDesk.packagesRef')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {packagesList.filter(p=>p.status==='active').map(p => (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{p.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{formatMoney(p.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'PRODUCT SALE' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            {(() => {
              const isToday = salesDay === getTodayStr();
              const itemsSold = shownSales.reduce((n, x) => n + (x.items || []).reduce((m, i) => m + (i.quantity || 0), 0), 0);
              const takings = shownSales.reduce((n, x) => n + (Number(x.total) || 0), 0);
              const tile = (label, value, color, grow = 1) => (
                <div style={{ flex:grow, minWidth:0, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:9, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:800, color: color || 'var(--text-primary)', fontFamily:'Manrope', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
                </div>
              );
              return (
                <>
                  <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0, display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ShoppingBag size={14} color="var(--accent-gold)"/>
                      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.salesLabel')}</span>
                      <div style={{ marginLeft:'auto' }}><DayStepper day={salesDay} onChange={setSalesDay} /></div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {tile(t('frontDesk.salesCount'), shownSales.length)}
                      {tile(t('frontDesk.itemsLabel'), itemsSold)}
                      {tile(t('frontDesk.totalLabel'), formatMoney(takings), 'var(--accent-gold)', 2)}
                    </div>
                  </div>
                  <div style={{ maxHeight: isMobile ? '50vh' : '32%', overflowY:'auto', padding:'4px 0', flexShrink:0, opacity: salesLoading && !shownSales.length ? 0.5 : 1, transition:'opacity 0.15s' }}>
                    {shownSales.length === 0 ? (
                      <div style={{ padding:'18px', textAlign:'center', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>
                        {salesLoading ? t('common.loading') : (isToday ? t('frontDesk.noSalesToday') : t('frontDesk.noSalesOnDay'))}
                      </div>
                    ) : shownSales.map((sale, idx) => {
                      const items = sale.items || [];
                      const count = items.reduce((n, i) => n + (i.quantity || 0), 0);
                      const method = PAYMENT_METHODS.find(m => m.api === sale.method);
                      return (
                        <div key={sale.id} style={{ padding:'9px 18px', display:'flex', alignItems:'center', gap:10, borderTop: idx ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><ShoppingBag size={13} color="var(--accent-gold)"/></div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{items.map(i => i.product?.name).filter(Boolean).join(', ') || '-'}</div>
                            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{[t('frontDesk.nItems', { n: count }), method ? t(method.labelKey) : null].filter(Boolean).join(' · ')}</div>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{formatMoney(sale.total)}</span>
                            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'JetBrains Mono, monospace' }}>{new Date(sale.createdAt).toLocaleTimeString(getDateLocale(), { hour:'2-digit', minute:'2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <div style={{ padding:'16px 18px', borderTop:'1px solid var(--border-subtle)', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <ShoppingCart size={14} color="var(--accent-gold)"/>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.cartLabel')}</span>
              {cart.length > 0 && <span style={{ marginLeft:'auto', background:'var(--accent-red-dim)', color:'var(--accent-red)', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{cart.length}</span>}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {saleSuccess && <div style={{ margin:'0 16px 12px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#34d399', fontFamily:'DM Sans' }}>{t('frontDesk.saleRecorded')}</div>}
              {saleError && <div role="alert" style={{ margin:'0 16px 12px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'var(--accent-red)', fontFamily:'DM Sans' }}>{saleError}</div>}
              {cart.length === 0 ? (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <ShoppingCart size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.cartEmpty')}</div>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', flex:1 }}>{item.name}</span>
                    <button aria-label={t('common.removeFromCart')} onClick={()=>changeQty(item.id,-item.qty)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><Trash2 size={12}/></button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button aria-label={t('common.oneFewer')} onClick={()=>changeQty(item.id,-1)} style={{ width:22, height:22, borderRadius:6, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={10}/></button>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Sans', minWidth:16, textAlign:'center' }}>{item.qty}</span>
                      <button aria-label={t('common.oneMore')} onClick={()=>changeQty(item.id, 1)} style={{ width:22, height:22, borderRadius:6, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={10}/></button>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{formatMoney(item.price * item.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'16px 18px', flexShrink:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{t('frontDesk.totalLabel')}</span>
                  <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', fontFamily:'Manrope' }}>{formatMoney(cartTotal)}</span>
                </div>
                <select style={{ ...inputStyle, marginBottom:10 }} value={acceptedMethod(payMethod, enabledMethods(gymSettings))} onChange={e=>setPayMethod(e.target.value)}>
                  {enabledMethods(gymSettings).map(m=><option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                </select>
                <button style={{ ...primaryBtn, width:'100%', justifyContent:'center', opacity: selling ? 0.6 : 1, cursor: selling ? 'not-allowed' : 'pointer' }} disabled={selling} onClick={handleSale}><CreditCard size={13}/> {selling ? t('common.saving') : t('frontDesk.recordSale')}</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'OPERATIONS' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.myCreatedTasks')}</span>
            </div>
            <div style={{ borderBottom:'1px solid var(--border-subtle)', maxHeight:220, overflowY:'auto', flexShrink:0 }}>
              {myCreatedTasks.length === 0 ? (
                <div style={{ padding:'18px', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', textAlign:'center' }}>{t('frontDesk.noTasksCreatedYet')}</div>
              ) : myCreatedTasks.map(tk => (
                <div key={tk.id} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:10, alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', lineHeight:1.3 }}>{tk.title}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{assigneeName(tk, t) || '-'}</div>
                  </div>
                  <StatusBadge status={tk.status.toLowerCase()} />
                  <RowMenu title={t('common.actions')} items={[
                    { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => handleDeleteRaisedTask(tk.id), danger: true },
                  ]} />
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.activityLog')}</span>
              {opsActivity.length > 0 && (
                <button onClick={() => setOpsActivity([])} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{t('header.clearAll')}</button>
              )}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {opsActivity.length === 0 ? (
                <div style={{ padding:'18px', fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', textAlign:'center' }}>{t('frontDesk.noActivityYet')}</div>
              ) : opsActivity.map((a,i) => {
                const colors = { checkin:'var(--accent-green)', signup:'var(--accent-blue)', payment:'var(--accent-gold)', issue:'var(--accent-yellow)', announce:'var(--accent-blue)' };
                return (
                  <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: colors[a.type]||'var(--text-muted)', marginTop:5, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', lineHeight:1.4 }}>{a.text}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{a.time}</div>
                    </div>
                    <button title={t('header.dismiss')} onClick={() => setOpsActivity(prev => prev.filter((_,idx) => idx !== i))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, display:'flex', flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.color='var(--accent-red)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}><X size={12}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Report Issue Modal ── */}
      <Modal open={showIssueModal} onClose={()=>{ setShowIssueModal(false); setIssueSuccess(false); setIssueError(''); }} title={t('frontDesk.reportIssueTitle')} maxWidth={480}>
        {issueSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{t('frontDesk.issueReported')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{t('frontDesk.issueLoggedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>setShowIssueModal(false)}>{t('common.close')}</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="gem-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={labelStyle}>{t('operations.equipmentArea')}</label><input style={{ ...inputStyle, borderColor: issueErrors.equipment ? 'var(--accent-red)' : undefined }} value={issueForm.equipment} onChange={e=>{ setIssueForm(f=>({...f,equipment:e.target.value})); setIssueErrors(x=>({ ...x, equipment: undefined })); }} placeholder={t('operations.equipmentPlaceholder')}/>{issueErrors.equipment && <span role="alert" style={fieldErrorStyle}>{issueErrors.equipment}</span>}</div>
              <div><label style={labelStyle}>{t('operations.location')}</label><input style={inputStyle} value={issueForm.location} onChange={e=>setIssueForm(f=>({...f,location:e.target.value}))} placeholder={t('operations.locationPlaceholder')}/></div>
            </div>
            <div><label style={labelStyle}>{t('payments.description')} *</label><textarea style={{ ...inputStyle, minHeight:72, resize:'vertical', borderColor: issueErrors.description ? 'var(--accent-red)' : undefined }} value={issueForm.description} onChange={e=>{ setIssueForm(f=>({...f,description:e.target.value})); setIssueErrors(x=>({ ...x, description: undefined })); }} placeholder={t('operations.descriptionPlaceholder')}/>{issueErrors.description && <span role="alert" style={fieldErrorStyle}>{issueErrors.description}</span>}</div>
            <div><label style={labelStyle}>{t('operations.severity')}</label>
              <select style={inputStyle} value={issueForm.severity} onChange={e=>setIssueForm(f=>({...f,severity:e.target.value}))}>
                {[['Low', t('operations.severityLow')], ['Medium', t('operations.severityMedium')], ['High', t('operations.severityHigh')], ['Critical', t('operations.severityCritical')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {issueError && (
              <div role="alert" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans' }}>{issueError}</div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>setShowIssueModal(false)}>{t('common.cancel')}</button>
              <button style={{ ...primaryBtn, opacity: issueSaving ? 0.6 : 1 }} disabled={issueSaving} onClick={handleIssue}><Wrench size={13}/> {t('frontDesk.submitBtn')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Quick Expense Modal ── */}
      <Modal open={showExpenseModal} onClose={()=>{ setShowExpenseModal(false); setExpenseSuccess(false); setExpenseError(''); }} title={t('frontDesk.logQuickExpense')} maxWidth={460}>
        {expenseSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            {expenseWasPending ? <Clock size={40} color="var(--accent-gold)" style={{ marginBottom:12 }}/> : <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>}
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{expenseWasPending ? t('frontDesk.expenseSentForApproval') : t('frontDesk.expenseLogged')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{expenseWasPending ? t('frontDesk.expenseSentForApprovalMsg') : t('frontDesk.expenseLoggedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>{ setShowExpenseModal(false); setExpenseSuccess(false); }}>{t('common.close')}</button>
          </div>
        ) : (() => {
          const limit = gymSettings.expenseLimit;
          const amt = parseFloat(expenseForm.amount) || 0;
          const overLimit = amt > 0 && amt > limit;
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>
                {t('frontDesk.expenseLimit')}: <strong style={{ color:'var(--accent-gold)' }}>{formatMoney(limit)}</strong>. {t('frontDesk.expenseLimitMsg')}
              </div>
              {expenseError && (
                <div role="alert" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans' }}>{expenseError}</div>
              )}
              <div><label style={labelStyle}>{t('payments.description')} *</label><input style={{ ...inputStyle, borderColor: expenseFieldErrors.description ? 'var(--accent-red)' : undefined }} value={expenseForm.description} onChange={e=>{ setExpenseForm(f=>({...f,description:e.target.value})); setExpenseFieldErrors(x=>({ ...x, description: undefined })); }} placeholder={t('frontDesk.descriptionPurchased')}/>{expenseFieldErrors.description && <span role="alert" style={fieldErrorStyle}>{expenseFieldErrors.description}</span>}</div>
              <div><label style={labelStyle}>{t('frontDesk.paidToLabel')}</label><input style={{ ...inputStyle, borderColor: expenseFieldErrors.paidTo ? 'var(--accent-red)' : undefined }} value={expenseForm.paidTo} onChange={e=>{ setExpenseForm(f=>({...f,paidTo:e.target.value})); setExpenseError(''); setExpenseFieldErrors(x=>({ ...x, paidTo: undefined })); }} placeholder={t('frontDesk.paidToPlaceholder')}/>{expenseFieldErrors.paidTo && <span role="alert" style={fieldErrorStyle}>{expenseFieldErrors.paidTo}</span>}</div>
              <div className="gem-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>{t('frontDesk.amountLabel', { currency: getCurrencySymbol() })}</label>
                  <input style={{ ...inputStyle, borderColor: overLimit || expenseFieldErrors.amount ? 'var(--accent-red)' : undefined }} type="text" inputMode="numeric" value={expenseForm.amount} onChange={e=>{ setExpenseForm(f=>({...f,amount:digitsOnly(e.target.value)})); setExpenseError(''); setExpenseFieldErrors(x=>({ ...x, amount: undefined })); }} placeholder="0"/>
                  {expenseFieldErrors.amount ? <span role="alert" style={fieldErrorStyle}>{expenseFieldErrors.amount}</span> : overLimit && <div style={{ fontSize:10, color:'#f87171', marginTop:4, fontFamily:'DM Sans' }}>{t('frontDesk.exceedsLimitBlocked')}</div>}
                </div>
                <div><label style={labelStyle}>{t('frontDesk.categoryLabel')}</label>
                  <select style={inputStyle} value={expenseForm.category} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))}>
                    {['Supplies','Cleaning','Maintenance','Food & Drinks','Equipment','Transport','Other'].map(c=><option key={c} value={c}>{tExpCat(c)}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>{t('frontDesk.paymentMethodLabel')}</label>
                <select style={inputStyle} value={acceptedMethod(expenseForm.paymentMethod, enabledMethods(gymSettings))} onChange={e=>setExpenseForm(f=>({...f,paymentMethod:e.target.value}))}>
                  {enabledMethods(gymSettings).map(m=><option key={m.key} value={m.key}>{t(m.labelKey)}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button style={secondaryBtn} onClick={()=>setShowExpenseModal(false)}>{t('common.cancel')}</button>
                <button style={{ ...primaryBtn, opacity: overLimit || expenseSaving ? 0.5 : 1, cursor: overLimit ? 'not-allowed' : 'pointer' }} disabled={overLimit || expenseSaving} onClick={handleExpense}><Receipt size={13}/> {t('frontDesk.submitForApproval')}</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Add Task Modal ── */}
      <Modal open={showTaskModal} onClose={()=>{ setShowTaskModal(false); setTaskErrors({}); }} title={t('frontDesk.addTaskTitle')} maxWidth={480}>
        {taskSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{t('frontDesk.taskCreated')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{t('frontDesk.taskCreatedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>setShowTaskModal(false)}>{t('common.close')}</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={labelStyle}>{t('frontDesk.taskTitleLabel')}</label>
              <input style={inputStyle} value={taskForm.title} onChange={e=>{ setTaskForm(f=>({...f,title:e.target.value})); setTaskErrors(er=>({...er,title:''})); }} placeholder={t('frontDesk.taskTitlePlaceholder')}/>
              {taskErrors.title && <span style={{ fontSize:11, color:'var(--accent-red)' }}>{taskErrors.title}</span>}
            </div>
            <TaskAssigneeField
              value={taskForm.assignedTo}
              dueDate={taskForm.dueDate}
              onChange={v => { setTaskForm(f => ({ ...f, assignedTo: v })); setTaskErrors(er => ({ ...er, assignedTo: '' })); }}
              staffList={staffList}
              fieldStyle={inputStyle}
              labelStyle={labelStyle}
              required
            />
            {taskErrors.assignedTo && <span style={{ fontSize:11, color:'var(--accent-red)' }}>{taskErrors.assignedTo}</span>}
            <div className="gem-two-col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={labelStyle}>{t('tasks.category')} *</label>
                <select style={inputStyle} value={taskForm.category} onChange={e=>{ setTaskForm(f=>({...f,category:e.target.value})); setTaskErrors(er=>({...er,category:''})); }}>
                  <option value="">{t('tasks.selectCategory')}</option>
                  {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                </select>
                {taskErrors.category && <span style={{ fontSize:11, color:'var(--accent-red)' }}>{taskErrors.category}</span>}
              </div>
              <div><label style={labelStyle}>{t('frontDesk.priorityLabel')}</label>
                <select style={inputStyle} value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}>
                  {[['Low', t('tasks.priorityLow')], ['Medium', t('tasks.priorityMedium')], ['High', t('tasks.priorityHigh')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('frontDesk.dueDateLabel')} *</label>
              <input style={inputStyle} type="date" value={taskForm.dueDate} onChange={e=>{ setTaskForm(f=>({...f,dueDate:e.target.value})); setTaskErrors(er=>({...er,dueDate:''})); }}/>
              {taskErrors.dueDate && <span style={{ fontSize:11, color:'var(--accent-red)' }}>{taskErrors.dueDate}</span>}
            </div>
            <div><label style={labelStyle}>{t('tasks.descriptionLabel')}</label><textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={taskForm.description} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} placeholder={t('frontDesk.taskDescPlaceholder')}/></div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>{ setShowTaskModal(false); setTaskErrors({}); }}>{t('common.cancel')}</button>
              <button style={{ ...primaryBtn, opacity: taskSaving ? 0.6 : 1, cursor: taskSaving ? 'default' : 'pointer' }} disabled={taskSaving} onClick={handleAddTask}><FileText size={13}/> {taskSaving ? t('tasks.savingTask') : t('frontDesk.createTask')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── EOD Report ── */}
      <EodReport
        open={showEodModal}
        onClose={() => { setShowEodModal(false); setEodClockNote(''); }}
        // The report closes the day: whoever is still on the clock is asked whether to check out now
        onPrinted={() => {
          setEodClockNote('');
          const ids = [...new Set([session?.staffId && session.staffId !== 'demo' ? session.staffId : null, myAccountId].filter(Boolean).map(String))];
          Promise.all(ids.map(id => shiftStatusApi(id)
            .then(r => (r.data?.clockable && r.data.state === 'in' ? { staffId: id, name: r.data.name, punchIn: r.data.punchIn } : null))
            .catch(() => null)))
            .then(list => { const open = list.filter(Boolean); if (open.length) setShiftPrompt({ kind: 'end', people: open }); });
        }}
        footer={eodClockNote ? <div role="status" style={{ fontSize:12.5, color:'var(--accent-green)', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)', borderRadius:8, padding:'9px 12px', fontFamily:'DM Sans' }}>{eodClockNote}</div> : null}
      />

      {/* ── Start / end the shift: asked, with "Not now" ── */}
      <Modal open={!!shiftPrompt} onClose={closeShiftPrompt} title={shiftPrompt?.kind === 'end' ? t('frontDesk.shiftEndTitle') : t('frontDesk.shiftStartTitle')} maxWidth={430}>
        {shiftPrompt && (() => {
          const start = shiftPrompt.kind === 'start';
          const first = (n) => String(n || '').split(' ')[0];
          const text = start
            ? t('frontDesk.shiftStartText', { name: first(shiftPrompt.name), time: shiftTime() })
            : shiftPrompt.people.length === 1
              ? t('frontDesk.shiftEndTextOne', { name: shiftPrompt.people[0].name, time: shiftTime(shiftPrompt.people[0].punchIn) })
              : t('frontDesk.shiftEndTextMany', { names: shiftPrompt.people.map(x => `${x.name} (${shiftTime(x.punchIn)})`).join(', ') });
          return (
            <div data-shift-prompt={shiftPrompt.kind} style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:'DM Sans' }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: start ? 'var(--accent-gold-dim)' : 'var(--accent-blue-dim)' }}>
                  {start ? <LogIn size={20} color="var(--accent-gold)"/> : <LogOut size={20} color="var(--accent-blue)"/>}
                </div>
                <div style={{ fontSize:14, color:'var(--text-primary)', lineHeight:1.55, paddingTop:2 }}>{text}</div>
              </div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', lineHeight:1.5 }}>{start ? t('frontDesk.shiftStartLater') : t('frontDesk.shiftEndLater')}</div>
              {shiftDone && <div role="status" style={{ fontSize:13, fontWeight:600, color:'var(--accent-green)', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)', borderRadius:8, padding:'9px 12px' }}>✓ {shiftDone}</div>}
              {shiftError && <div role="alert" style={{ fontSize:12.5, color:'var(--accent-red)', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'9px 12px' }}>{shiftError}</div>}
              {!shiftDone && (
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap', paddingTop:8, borderTop:'1px solid var(--border-subtle)' }}>
                  <button type="button" style={secondaryBtn} disabled={shiftBusy} onClick={closeShiftPrompt}>{t('frontDesk.notNow')}</button>
                  <button type="button" style={{ ...primaryBtn, opacity: shiftBusy ? 0.6 : 1 }} disabled={shiftBusy} onClick={confirmShift}>
                    {start ? <LogIn size={14}/> : <LogOut size={14}/>} {start ? t('frontDesk.shiftStartBtn') : t('frontDesk.shiftEndBtn')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>


      {/* ── Add Member / Visitor Modals ── */}
      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        packagesList={packagesList}
        gymData={gymData ?? {}}
        onCreated={(newId, newMember) => {
          setShowAddMember(false);
          if (newId) setFdProfileId(newId);
          if (newMember) {
            const timeLabel = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
            const pkg = packagesList.find(p => p.id === newMember.packageId);
            const fullName = `${newMember.firstName} ${newMember.lastName}`;
            setMembersList(prev => [newMember, ...prev]);
            setDayRegs(prev => [{ name: fullName, type: 'Membership', amount: pkg?.price || 0, time: timeLabel }, ...prev]);
            setTodaySignups(prev => [{ name: fullName, package: pkg?.name || '', time: timeLabel }, ...prev]);
            setOpsActivity(prev => [{ type: 'signup', text: `${fullName} registered as member`, time: timeLabel }, ...prev]);
          }
        }}
      />
      <AddVisitorModal
        open={showAddVisitor}
        onClose={() => setShowAddVisitor(false)}
        packagesList={packagesList}
        gymData={gymData ?? {}}
        onCreated={(newId, newMember) => {
          setShowAddVisitor(false);
          if (newId) setFdProfileId(newId);
          if (newMember) {
            const timeLabel = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });
            const pkg = packagesList.find(p => p.id === newMember.packageId);
            const fullName = `${newMember.firstName} ${newMember.lastName}`;
            setMembersList(prev => [newMember, ...prev]);
            setDayRegs(prev => [{ name: fullName, type: 'Visitor', amount: pkg?.price || 0, time: timeLabel }, ...prev]);
            setTodaySignups(prev => [{ name: fullName, package: pkg?.name || '', time: timeLabel }, ...prev]);
            setOpsActivity(prev => [{ type: 'signup', text: `${fullName} registered as visitor`, time: timeLabel }, ...prev]);
          }
        }}
      />

      {/* ── Code Verification Modal ── */}
      {showCodeEntry && foundMember && (
        <Modal open={showCodeEntry} onClose={()=>{ setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false); setSendCodeMsg(''); }} title={t('frontDesk.verifyAccessCode')} maxWidth={360}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, fontFamily:'DM Sans' }}>
              {t('frontDesk.askForCode')} <strong style={{ color:'var(--text-primary)' }}>{foundMember.firstName} {foundMember.lastName}</strong> {t('frontDesk.forTheirCode')}
            </div>
            <CodeInput autoFocus maxLength={6} value={codeEntered} onChange={v=>{ setCodeEntered(v); setCodeError(''); }} onEnter={handleCodeVerifyCheckIn} placeholder="••••" style={{ background:'var(--bg-elevated)', border:`1px solid ${codeError?'rgba(239,68,68,0.5)':'var(--border-subtle)'}`, borderRadius:10, padding:'11px 14px', fontSize:20, color:'var(--accent-gold)', fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.25em', textAlign:'center', outline:'none', width:'100%', boxSizing:'border-box' }}/>
            {codeError && <div role="alert" style={{ fontSize:11, color:'#ef4444', fontFamily:'DM Sans' }}>{codeError}</div>}
            <div style={{ paddingTop:4, borderTop:'1px solid var(--border-subtle)' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', color:'var(--text-muted)', fontFamily:'DM Sans', margin:'8px 0' }}>{t('frontDesk.forgotCode')}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={emailCodeToMember} disabled={sendingCode} style={{ ...secondaryBtn, flex:1, justifyContent:'center', padding:'7px 10px', fontSize:11.5, opacity:sendingCode?0.6:1, cursor:sendingCode?'default':'pointer' }}><Mail size={13}/> {t('frontDesk.sendByEmail')}</button>
                <button onClick={textCodeToMember} style={{ ...secondaryBtn, flex:1, justifyContent:'center', padding:'7px 10px', fontSize:11.5 }}><MessageSquare size={13}/> {t('frontDesk.sendByText')}</button>
              </div>
              {sendCodeMsg && <div style={{ marginTop:8, fontSize:11, fontFamily:'DM Sans', color: sendCodeSent ? '#34d399' : 'var(--accent-red)' }}>{sendCodeMsg}</div>}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>{ setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false); setSendCodeMsg(''); }}>{t('common.cancel')}</button>
              <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', lineHeight:1.5 }}>{t('frontDesk.textCodeHint')}</div>
              <button style={{ ...primaryBtn, opacity:codeEntered.trim()?1:0.4, cursor:codeEntered.trim()?'pointer':'not-allowed' }} disabled={!codeEntered.trim()} onClick={handleCodeVerifyCheckIn}>
                <UserCheck size={13}/> {t('frontDesk.checkIn')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Member profile drawer ── */}

      {/* ── Photo lightbox ── */}
      {photoLightbox && (
        <DialogBox label={t('members.profilePhoto')} onClose={() => setPhotoLightbox(null)} onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={photoLightbox} alt={t('members.profilePhoto')} style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
          <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>{t('common.clickToClose')}</div>
        </DialogBox>
      )}

      {exitGate}

    </div>
  );
}

