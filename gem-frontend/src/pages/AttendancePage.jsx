import { checkInErrorText, needsCheckInCode } from '../utils/checkin';
import { useLiveTick } from '../hooks/useLiveRefresh';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '../utils/currency';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, UserCheck, X, LogOut, Clock, ChevronLeft, ChevronRight, QrCode, Calendar } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import Avatar from '../components/ui/Avatar';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import RowMenu from '../components/ui/RowMenu';
import CodeInput from '../components/ui/CodeInput';
import TimeInput from '../components/ui/TimeInput';
import VisitKindBadge from '../components/ui/VisitKindBadge';
import { getAll as getAttendance, checkIn as checkInApi, checkOut as checkOutApi } from '../services/attendance.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff, findByCode as findStaffByCode } from '../services/staff.service';
import { getAll as getTimecards, punchIn as punchInApi, punchOut as punchOutApi, adjust as adjustTimecard } from '../services/timecards.service';
import { getAuth, getRole } from '../utils/auth';
import { fmtDate, fmtTime, capFirst, todayStr, dayStr } from '../utils/date';
import CheckinStats from '../components/CheckinStats';
import { SkeletonCards, SkeletonTableRows } from '../components/Skeleton';
import { softAll } from '../utils/loadAll';
import { gymCache } from '../utils/gymCache';

const formatDate = (d) => fmtDate(d);

const ROLE_KEYS = {
  general_manager: 'generalManager', 'General Manager': 'generalManager',
  manager: 'manager', 'Manager': 'manager',
  trainer: 'trainer', 'Trainer': 'trainer',
  instructor: 'instructor', 'Instructor': 'instructor',
  front_desk: 'frontDesk', 'Front Desk': 'frontDesk',
  coach: 'coach', 'Coach': 'coach',
  other: 'roleOther', 'Other': 'roleOther',
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
  display: 'flex', alignItems: 'center', gap: 6,
};
const secondaryBtn = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
  display: 'flex', alignItems: 'center', gap: 6,
};
const dangerOutlineBtn = {
  background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)',
  color: 'var(--accent-red)', borderRadius: 6,
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  cursor: 'pointer', fontFamily: 'DM Sans',
  display: 'flex', alignItems: 'center', gap: 6,
};
const cardStyle = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  borderRadius: 14, boxShadow: 'var(--shadow-card)',
};
const inputStyle = {
  width: '100%', background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)', borderRadius: 10,
  padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)',
  fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: 12, color: 'var(--text-secondary)',
  marginBottom: 5, display: 'block', fontFamily: 'DM Sans',
};
const thStyle = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', fontFamily: 'DM Sans',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)',
  fontFamily: 'DM Sans', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

// Returns current time as 24h "HH:MM" for <input type="time">
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// Converts "09:42 AM" / "HH:MM" → "HH:MM" (24h) for input value
const toInputTime = (t) => {
  if (!t) return '';
  if (!t.includes('AM') && !t.includes('PM')) return t;
  const [time, period] = t.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

// An "HH:MM" time today, shown the way times loaded from the server are, so a
// row added on screen reads like the rest. (A 12-hour "09:42 PM" sent back to
// the server was once read as 09:42 in the morning.)
const clockLabel = (hhmm) => {
  const [h, m] = toInputTime(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm || '';
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return fmtTime(d);
};

// Hours worked can never be negative, so a shift cannot end before it started.
const minutesOf = (t) => {
  const [h, m] = toInputTime(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const endsBeforeStart = (start, end) => {
  const a = minutesOf(start), b = minutesOf(end);
  return a !== null && b !== null && b <= a;
};

function resolvePerson(entry, staffList) {
  if (entry.personType === 'Staff') {
    const s = staffList.find(s => String(s.id) === String(entry.personId));
    if (!s) return null;
    const name = s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();
    return { id: `STF-${s.id}`, name, role: s.role, avatarColor: s.avatarColor || 'blue', isStaff: true, raw: s };
  }
  const m = entry._memberObj;
  if (!m) return null;
  return {
    id: m.memberCode || m.id,
    name: `${m.firstName} ${m.lastName}`,
    sub: `${m.memberCode || m.id} · ${m.package?.name ?? m.package ?? ''}`,
    status: m.status,
    avatarColor: m.avatarColor,
    isStaff: false,
    raw: m,
  };
}


// ─── Row 3-dot menu (portal-based so it escapes table overflow clipping) ──────

// ─── Check-out modal ──────────────────────────────────────────────────────────
function CheckOutModal({ open, onClose, entry, person, onConfirm, error, busy, finished }) {
  const { t } = useLanguage();
  const [time, setTime]             = useState('');
  const [notes, setNotes]           = useState('');
  const [timeEdited, setTimeEdited] = useState(false);

  useLayoutEffect(() => {
    if (open) { setTime(nowTime()); setNotes(''); setTimeEdited(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !entry || !person) return null;

  const backwards = endsBeforeStart(entry.time, time);
  const canConfirm = (!timeEdited || notes.trim().length > 0) && !backwards;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...cardStyle, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('attendance.checkOutAction')} : {person.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('attendance.checkedInAt')} <strong style={{ color: 'var(--text-primary)' }}>{entry.time}</strong>
        </div>
        <div>
          <label style={labelStyle}>{t('attendance.checkoutTimeLabel')}</label>
          <TimeInput value={time} onChange={e => { setTime(e.target.value); setTimeEdited(true); }} />
        </div>
        {timeEdited && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              {t('attendance.reasonForChange')} <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t('attendance.explainCheckout')} value={notes} onChange={e => setNotes(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--accent-yellow)', background: 'var(--accent-yellow-dim)', borderRadius: 6, padding: '5px 10px' }}>
              {t('attendance.approvalTask')}
            </div>
          </div>
        )}
        {backwards && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>
            {t('attendance.checkoutBeforeCheckin', { time: entry.time })}
          </div>
        )}
        {error && (
          <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {finished ? (
            <button style={secondaryBtn} onClick={onClose}>{t('common.close')}</button>
          ) : (
            <>
              <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
              <button
                style={{ ...primaryBtn, opacity: canConfirm && !busy ? 1 : 0.45, cursor: canConfirm && !busy ? 'pointer' : 'not-allowed' }}
                disabled={!canConfirm || busy}
                onClick={() => onConfirm({ time, notes: notes.trim(), timeChanged: timeEdited })}
              >
                <LogOut size={13} /> {t('attendance.confirmCheckOut')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Check-in modal (time is editable, like check-out → manager task) ─────────
function CheckInModal({ open, onClose, person, onConfirm }) {
  const { t } = useLanguage();
  const [time, setTime]             = useState('');
  const [notes, setNotes]           = useState('');
  const [timeEdited, setTimeEdited] = useState(false);

  useLayoutEffect(() => {
    if (open) { setTime(nowTime()); setNotes(''); setTimeEdited(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !person) return null;

  const canConfirm = !timeEdited || notes.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...cardStyle, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('attendance.checkInBtn')} : {person.name}
        </div>
        <div>
          <label style={labelStyle}>{t('attendance.checkinTimeLabel')}</label>
          <TimeInput value={time} onChange={e => { setTime(e.target.value); setTimeEdited(true); }} />
        </div>
        {timeEdited && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              {t('attendance.reasonForChange')} <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t('attendance.explainCheckin')} value={notes} onChange={e => setNotes(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--accent-yellow)', background: 'var(--accent-yellow-dim)', borderRadius: 6, padding: '5px 10px' }}>
              {t('attendance.approvalTask')}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            disabled={!canConfirm}
            onClick={() => onConfirm({ time, notes: notes.trim(), timeChanged: timeEdited })}
          >
            <UserCheck size={13} /> {t('attendance.checkInBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Edit time modal (always requires notes → manager task) ───────────────────
function EditTimeModal({ open, onClose, entry, field, onConfirm, error }) {
  const { t } = useLanguage();
  const [time, setTime]   = useState('');
  const [notes, setNotes] = useState('');

  useLayoutEffect(() => {
    if (open && entry) {
      setTime(toInputTime(field === 'time' ? entry.time : entry.checkOut));
      setNotes('');
    }
  }, [open, entry, field]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !entry) return null;

  const label = field === 'time' ? t('attendance.editCheckinTime') : t('attendance.editCheckoutTime');
  // Editing either end must keep the shift the right way round
  const backwards = field === 'time'
    ? endsBeforeStart(time, entry.checkOut)
    : endsBeforeStart(entry.time, time);
  const canSave = time && notes.trim().length > 0 && !backwards;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...cardStyle, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div>
          <label style={labelStyle}>{label}</label>
          <TimeInput value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>
            {t('attendance.reason')} <span style={{ color: 'var(--accent-red)' }}>*</span>
          </label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t('attendance.explainChange')} value={notes} onChange={e => setNotes(e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--accent-yellow)', background: 'var(--accent-yellow-dim)', borderRadius: 6, padding: '5px 10px' }}>
            {t('attendance.approvalTask')}
          </div>
        </div>
        {backwards && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>
            {t('attendance.checkoutBeforeCheckin', { time: field === 'time' ? entry.checkOut : entry.time })}
          </div>
        )}
        {error && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}
            disabled={!canSave}
            onClick={() => onConfirm({ time, notes: notes.trim(), field })}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const translateRole = (role) => { const k = ROLE_KEYS[role]; return k ? t(`staff.${k}`) : (role || ''); };
  const isMobile = useIsMobile();
  const canManage = ['general_manager', 'manager', 'front_desk'].includes(getRole());
  // All is everyone who came in to train, members and visitors alike; staff
  // shifts are time-clock entries with their own columns, so they stay apart.
  const TYPE_FILTERS = [
    { key: 'All', label: t('common.all') },
    { key: 'Members', label: t('attendance.members') },
    { key: 'Visitors', label: t('attendance.visitors') },
    { key: 'Staff', label: t('attendance.staff') },
  ];
  const searchRef = useRef(null);
  const attDateRef = useRef(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [matches, setMatches]             = useState([]);
  const [foundResult, setFoundResult]     = useState(null);
  const [typeFilter, setTypeFilter]       = useState('All');
  // Today's check-ins, or the statistics over a longer stretch. The choice sits
  // in the address bar so it survives a reload, the back button and the switch
  // between the phone and desktop layouts, which rebuilds the page.
  const [searchParams, setSearchParams]   = useSearchParams();
  const pageView = searchParams.get('view') === 'stats' ? 'stats' : 'checkins';
  const setPageView = (key) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (key === 'stats') next.set('view', 'stats'); else next.delete('view');
    return next;
  }, { replace: true });
  // Show the last check-ins at once and refresh quietly; a first-ever visit
  // falls back to the skeleton. The cache can be a few minutes stale on the
  // day's first load, which the refresh corrects at once. See utils/gymCache.js.
  const cache = gymCache('attendance');
  const [checkins, setCheckins]           = useState(() => cache.read('checkins', []));
  const [membersList, setMembersList]     = useState(() => cache.read('members', []));
  const [staffList, setStaffList]         = useState(() => cache.read('staff', []));
  const [loading, setLoading]             = useState(() => !cache.has('checkins'));
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [checkoutModal, setCheckoutModal] = useState(null);
  // What the check-out dialog says when the server refused; finished once the
  // check-out itself went through but a changed time did not (F-107)
  const [checkoutResult, setCheckoutResult] = useState({ error: '', busy: false, finished: false });
  const openCheckout = (value) => { setCheckoutResult({ error: '', busy: false, finished: false }); setCheckoutModal(value); };
  const [checkinModal, setCheckinModal]   = useState(null);
  const [editModal, setEditModal]         = useState(null);
  const [editError, setEditError]         = useState('');
  // Time cards in view that a manager has still to sign off
  const [checkInError, setCheckInError]   = useState('');
  const [flash, setFlash]                 = useState(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [codeInput, setCodeInput]   = useState('');
  const [codeError, setCodeError]   = useState('');

  const _now = new Date();
  const todayISO   = todayStr();
  const _locale    = lang === 'fr' ? 'fr-FR' : 'en-US';
  const todayShort = _now.toLocaleDateString(_locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const today      = _now.toLocaleDateString(_locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [viewDate, setViewDate]           = useState(todayISO);
  const [historyCheckins, setHistoryCheckins] = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  const parseAttendanceRows = (data, dateLabel) =>
    (data || []).map(a => ({
      id:         a.id,
      personId:   a.memberId,
      personType: (a.member?.isVisitor || a.member?.status === 'visitor') ? 'Visitor' : 'Member',
      kind:       a.kind || null,
      time:       fmtTime(a.checkIn),
      checkOut:   a.checkOut ? fmtTime(a.checkOut) : null,
      recordedBy: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : '-',
      date:       dateLabel,
      notes:      a.note || null,
      _memberObj: a.member,
    }));

  // A staff clock-in is a TimeCard, not an Attendance row: same feed, different
  // table. punchOut closes it, so the id carried here is the time card id.
  const parseTimecardRows = (data, dateLabel) =>
    (data || []).map(tc => ({
      id:         tc.id,
      personId:   tc.staffId,
      personType: 'Staff',
      time:       fmtTime(tc.punchIn),
      checkOut:   tc.punchOut ? fmtTime(tc.punchOut) : null,
      pending:    tc.approvalStatus === 'pending',
      recordedBy: '-',
      date:       dateLabel,
      notes:      null,
    }));

  const liveTick = useLiveTick();
  useEffect(() => {
    softAll([getAttendance({ date: todayISO }), getMembers(), getStaff(), getTimecards({ date: todayISO })])
      .then(([attRes, memRes, staffRes, tcRes]) => {
        const mem = memRes.data || [], stf = staffRes.data || [];
        const rows = [
          ...parseAttendanceRows(attRes.data, todayShort),
          ...parseTimecardRows(tcRes.data, todayShort),
        ];
        setMembersList(mem); cache.write('members', mem);
        setStaffList(stf); cache.write('staff', stf);
        setCheckins(rows); cache.write('checkins', rows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  useEffect(() => {
    setTableSearch('');
    if (viewDate === todayISO) return;
    setHistoryLoading(true);
    const dateLabel = fmtDate(viewDate + 'T12:00:00');
    softAll([getAttendance({ date: viewDate }), getTimecards({ date: viewDate })])
      .then(([attRes, tcRes]) => setHistoryCheckins([
        ...parseAttendanceRows(attRes.data, dateLabel),
        ...parseTimecardRows(tcRes.data, dateLabel),
      ]))
      .catch(() => setHistoryCheckins([]))
      .finally(() => setHistoryLoading(false));
  }, [viewDate]);

  const goPrevDay = () => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setViewDate(dayStr(d));
  };
  const goNextDay = () => {
    if (viewDate >= todayISO) return;
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setViewDate(dayStr(d));
  };
  const isViewingToday = viewDate === todayISO;

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (val) => {
    setSearchTerm(val);
    setCheckInError('');
    setCodeInput('');
    setCodeError('');
    const trimmed = val.trim();
    setMatches([]);
    if (!trimmed) { setFoundResult(null); return; }
    const lower = trimmed.toLowerCase();
    // A member's own code is exact, so it names one person
    const byCode = membersList.find(m => m.accessCode === trimmed);
    if (byCode) { setFoundResult(memberResult(byCode, true)); return; }
    // Matched by name here. Staff codes never reach the browser, so a typed
    // code is resolved by the server once no name matches. Staff and members
    // can share a name, so every match is offered, never just the first one.
    const staffMatches = staffList.filter(s => staffName(s).toLowerCase().includes(lower));
    const memberMatches = membersList.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
      (m.phone && m.phone.includes(trimmed)) ||
      (m.memberCode && m.memberCode.toLowerCase().includes(lower))
    );
    const all = [...staffMatches.map(staffResult), ...memberMatches.map(m => memberResult(m, false))];
    if (all.length > 1) { setMatches(all.slice(0, 8)); setFoundResult(null); return; }
    if (all.length === 1) { setFoundResult(all[0]); return; }
    if (/^\d{4}$/.test(trimmed)) {
      findStaffByCode(trimmed).then(res => {
        const hit = res.data;
        if (!hit) return;
        const staffName = `${hit.firstName || ''} ${hit.lastName || ''}`.trim();
        // Their own code, so they are here to train. Never a shift.
        setFoundResult({ type: 'staffWorkout', data: { ...hit, name: staffName }, code: trimmed });
      }).catch(() => {
        // The desk cannot read employees' codes, so an unknown one is still
        // worth offering to the server, which can.
        setFoundResult({ type: 'staffWorkout', data: { name: '' }, code: trimmed });
      });
    }
    setFoundResult(null);
  };

  function staffName(s) { return s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(); }
  function staffResult(s) {
    const alreadyIn = checkins.find(c => c.personType === 'Staff' && String(c.personId) === String(s.id) && !c.checkOut);
    // Clocking prices an hourly shift. Salaried staff are paid the same
    // whatever the clock says, so there is nothing to record.
    const hourly = s.employmentType === 'Part Time';
    // A deactivated account cannot start a shift, but one it left running can still be closed
    const deactivated = s.isActive === false && !alreadyIn;
    return { type: 'staff', data: { ...s, name: staffName(s) }, alreadyIn: alreadyIn || null, notClocked: !hourly || deactivated, deactivated };
  }
  function memberResult(m, foundByCode) { return { type: 'member', data: m, foundByCode }; }

  const pickMatch = (r) => { setFoundResult(r); setCheckInError(''); setCodeInput(''); setCodeError(''); };

  const matchList = () => {
    if (!searchTerm || foundResult || matches.length < 2) return null;
    return (
      <div style={{ marginTop: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{t('attendance.pickOne', { n: matches.length })}</div>
        {matches.map((r, i) => {
          const d = r.data;
          const isStaff = r.type === 'staff';
          const name = isStaff ? d.name : `${d.firstName || ''} ${d.lastName || ''}`.trim();
          const sub = isStaff ? translateRole(d.role) : [d.package?.name, d.memberCode].filter(Boolean).join(' · ');
          return (
            <button key={`${r.type}-${d.id}`} onClick={() => pickMatch(r)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontFamily: 'DM Sans' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {d.photo ? <img src={d.photo} alt={name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <Avatar firstName={d.firstName || name} lastName={d.lastName || ''} avatarColor={d.avatarColor} size={34} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub || '-'}</div>
              </div>
              {isStaff
                ? <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 9px', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', whiteSpace: 'nowrap' }}>{t('attendance.staff')}</span>
                : <MemberStatusTags member={d} typeOnly />}
            </button>
          );
        })}
      </div>
    );
  };

  const backToMatches = () => (searchTerm && foundResult && matches.length > 1) ? (
    <button onClick={() => setFoundResult(null)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}>
      {t('attendance.seeAllMatches', { n: matches.length })}
    </button>
  ) : null;

  const clearSearch = () => { setSearchTerm(''); setMatches([]); setFoundResult(null); setCheckInError(''); setCodeInput(''); setCodeError(''); };

  // A member or visitor with no photo on file can't be verified by sight, so the
  // staff must enter their access code before checking them in (unless they were
  // found BY that code). People with a photo, and staff, skip this. Both layouts.
  const needsCodeVerify = foundResult?.type === 'member'
    && needsCheckInCode(foundResult.data, { foundByCode: foundResult.foundByCode });

  const verifyAndCheckIn = async () => {
    const code = codeInput.trim();
    if (!code) { setCodeError(t('attendance.codeRequired')); return; }
    if (code !== foundResult.data.accessCode) { setCodeError(t('attendance.incorrectCode')); return; }
    setCodeError('');
    await doCheckIn();
  };
  const showFlash = (name, action) => { setFlash({ name, action }); setTimeout(() => setFlash(null), 2500); };

  // ── Check In ─────────────────────────────────────────────────────────────
  const doCheckIn = async ({ time, notes } = {}) => {
    if (!foundResult) return;
    // An employee who typed their own code came to train. The server works out
    // who it is and files a visit, not a time card.
    if (foundResult.type === 'staffWorkout') {
      try {
        const res = await checkInApi({ accessCode: foundResult.code });
        const who = res.data?.member || {};
        const visitorName = `${who.firstName || ''} ${who.lastName || ''}`.trim();
        setCheckins(prev => [{
          id:         res.data.id,
          personId:   who.id,
          personType: 'Staff',
          time:       fmtTime(new Date()),
          checkOut:   null,
          recordedBy: (() => { const u = getAuth()?.user; return u ? `${u.firstName} ${u.lastName}` : '-'; })(),
          date:       todayShort,
          notes:      t('attendance.cameToTrain'),
          _memberObj: who,
        }, ...prev]);
        showFlash(visitorName, 'in');
        clearSearch();
      } catch (err) {
        setCheckInError(checkInErrorText(err, t, t('attendance.checkInFailed')));
      }
      return;
    }
    const isStaff = foundResult.type === 'staff';
    const name = isStaff ? foundResult.data.name : `${foundResult.data.firstName} ${foundResult.data.lastName}`;
    if (!isStaff) {
      try {
        const res = await checkInApi({ memberId: foundResult.data.id });
        const authUser = getAuth()?.user;
        const staffName = res.data?.staff
          ? `${res.data.staff.firstName} ${res.data.staff.lastName}`
          : (authUser ? `${authUser.firstName} ${authUser.lastName}` : '-');
        setCheckins(prev => [{
          id:         res.data.id,
          personId:   foundResult.data.id,
          personType: (foundResult.data.isVisitor || foundResult.data.status === 'visitor') ? 'Visitor' : 'Member',
          kind:       res.data?.kind || null,
          time:       fmtTime(new Date()),
          checkOut:   null,
          recordedBy: staffName,
          date:       todayShort,
          notes:      null,
          _memberObj: foundResult.data,
        }, ...prev]);
      } catch (err) {
        setCheckInError(checkInErrorText(err, t, t('attendance.checkInFailed')));
        return;
      }
    } else {
      // Staff clock-ins are time cards. Without this the row lived only in
      // React state and vanished on refresh, and the Time Log stayed empty.
      try {
        const res = await punchInApi({ staffId: foundResult.data.id, at: time || undefined, note: notes || undefined });
        setCheckins(prev => [...parseTimecardRows([res.data], todayShort), ...prev]);
      } catch (err) {
        setCheckInError(checkInErrorText(err, t, t('attendance.checkInFailed')));
        return;
      }
    }
    showFlash(name, 'in');
    clearSearch();
    searchRef.current?.focus();
  };

  const handleCheckIn = async () => {
    if (!foundResult) return;
    const isStaff = foundResult.type === 'staff';
    if (isStaff) {
      const s = foundResult.data;
      if (s.shiftStart) {
        const [sh, sm] = s.shiftStart.split(':').map(Number);
        const now = new Date();
        const earliestMins = sh * 60 + sm - 15;
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (nowMins < earliestMins) {
          const eh = Math.floor(earliestMins / 60), em = earliestMins % 60;
          setCheckInError(t('attendance.tooEarlyShift', { time: clockLabel(s.shiftStart), earliest: clockLabel(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`) }));
          return;
        }
      }
      // Same as check-out: the operator sees the time and may correct it.
      setCheckinModal({ name: foundResult.data.name });
      return;
    }
    if (foundResult.type === 'staffWorkout') {
      await doCheckIn();
      return;
    }
    // Without a photo the code comes first, visitors included (verifyAndCheckIn)
    if (needsCodeVerify) return;
    await doCheckIn();
  };

  const handleCheckOutFromSearch = () => {
    if (!foundResult?.alreadyIn) return;
    openCheckout({ entry: foundResult.alreadyIn, person: { name: foundResult.data.name } });
    clearSearch();
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || !foundResult) return;
    if (needsCodeVerify) return;
    if (foundResult.type === 'staff' && foundResult.alreadyIn) handleCheckOutFromSearch();
    else handleCheckIn();
  };

  const confirmCheckOut = async ({ time, notes, timeChanged }) => {
    const entry = checkoutModal.entry;
    const isStaff = entry.personType === 'Staff';
    setCheckoutResult({ error: '', busy: true, finished: false });
    // Members close an Attendance row, staff close a TimeCard. Only a check-out
    // the server made is shown as done: a refusal stays in the dialog (F-107).
    try {
      if (isStaff) await punchOutApi(entry.id);
      else await checkOutApi(entry.id);
    } catch (err) {
      setCheckoutResult({ error: err?.response?.data?.error || t('attendance.checkOutFailed'), busy: false, finished: false });
      return;
    }

    // An adjusted time is a claim: it is written to the card, the card is
    // marked pending, and the server raises an approval task for every manager.
    let adjustError = '';
    if (timeChanged && isStaff) {
      try {
        await adjustTimecard(entry.id, { punchOut: time, note: notes || undefined });
      } catch (err) {
        adjustError = err?.response?.data?.error || t('attendance.checkOutFailed');
      }
    }
    const outAt = adjustError ? fmtTime(new Date()) : clockLabel(time);
    setCheckins(prev => prev.map(c => c.id === entry.id ? { ...c, checkOut: outAt, notes: notes || null, pending: timeChanged && isStaff && !adjustError } : c));
    showFlash(checkoutModal.person.name, 'out');
    if (adjustError) {
      setCheckoutResult({ error: t('attendance.timeChangeNotSaved', { reason: adjustError }), busy: false, finished: true });
      return;
    }
    setCheckoutModal(null);
  };

  // Only a staff time card is edited here: the menu is on the Staff tab alone
  const confirmEdit = async ({ time, notes, field }) => {
    const entry = editModal.entry;
    setEditError('');
    try {
      await adjustTimecard(entry.id, { [field === 'time' ? 'punchIn' : 'punchOut']: time, note: notes || undefined });
    } catch (err) {
      setEditError(err?.response?.data?.error || t('attendance.timeChangeFailed'));
      return;
    }
    setCheckins(prev => prev.map(c => c.id === entry.id ? { ...c, [field]: clockLabel(time), notes, pending: true } : c));
    setEditModal(null);
  };

  const typeMap = { Members: 'Member', Visitors: 'Visitor', Staff: 'Staff' };
  const displayCheckins = isViewingToday ? checkins : historyCheckins;
  const pendingApprovalCount = displayCheckins.filter(c => c.pending).length;
  const filteredCheckins = displayCheckins
    .filter(c => (typeFilter === 'All' ? c.personType !== 'Staff' : c.personType === typeMap[typeFilter]))
    .filter(c => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      if (c.personType === 'Staff') {
        const s = staffList.find(s => String(s.id) === String(c.personId));
        const name = s ? (s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim()) : '';
        return name.toLowerCase().includes(q);
      }
      const m = c._memberObj;
      if (!m) return false;
      return `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase().includes(q) ||
             (m.memberCode || '').toLowerCase().includes(q);
    });
  const isStaffTab = typeFilter === 'Staff';

  // ── Mobile layout ────────────────────────────────────────────────────────────
  const viewSwitch = (<div role="tablist" style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {[['checkins', t('attendance.viewCheckins')], ['stats', t('attendance.viewStats')]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={pageView === key} onClick={() => setPageView(key)} style={{
            padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'DM Sans',
            background: pageView === key ? 'var(--accent-gold-dim)' : 'transparent',
            color: pageView === key ? 'var(--accent-gold)' : 'var(--text-secondary)',
          }}>{label}</button>
        ))}
      </div>
  );
  if (pageView === 'stats') {
    return (
      <div style={isMobile ? { padding: '16px 16px 96px' } : { padding: 28, paddingBottom: 80, maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Manrope', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>{t('attendance.title')}</h1>
        {viewSwitch}
        <CheckinStats isMobile={isMobile} />
      </div>
    );
  }

  if (isMobile) {
    const displayCheckins = isViewingToday ? checkins : historyCheckins;
    return (
      <div style={{ minHeight: '100%' }}>
        {/* Title + date nav */}
        <div style={{ padding: '16px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('attendance.title')}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
              {isViewingToday ? t('common.today') : new Date(viewDate + 'T12:00:00').toLocaleDateString(_locale, { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}{t('attendance.checkInsN', { n: displayCheckins.length })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={goPrevDay} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 7, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ChevronLeft size={15} strokeWidth={2.5} />
            </button>
            {!isViewingToday && (
              <button onClick={() => setViewDate(todayISO)} style={{ background: 'var(--accent-gold-dim)', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '5px 9px', fontFamily: 'DM Sans' }}>
                {t('common.today')}
              </button>
            )}
            <button onClick={goNextDay} disabled={isViewingToday} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 7, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isViewingToday ? 'default' : 'pointer', color: isViewingToday ? 'var(--border-subtle)' : 'var(--text-muted)' }}>
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>{viewSwitch}</div>

        {/* Quick Check-In - full width search */}
        {isViewingToday && canManage && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                ref={searchRef}
                value={searchTerm}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('attendance.mobileSearchPlaceholder')}
                style={{
                  width: '100%', background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)', borderRadius: 12,
                  padding: '13px 14px 13px 42px', fontSize: 16,
                  color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchTerm && (
                <button onClick={clearSearch} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                  <X size={15} />
                </button>
              )}
            </div>

            {matchList()}
            {backToMatches()}
            {/* Search result. foundResult is { type, data }, not a flat person */}
            {foundResult && (() => {
              const isStaff = foundResult.type === 'staff' || foundResult.type === 'staffWorkout';
              const d = foundResult.data;
              const name = isStaff ? (d.name || t('attendance.staff')) : `${d.firstName || ''} ${d.lastName || ''}`.trim();
              const sub = isStaff ? translateRole(d.role) : (d.package?.name || d.packageName || '');
              const code = (isStaff ? '' : d.memberCode) || '';
              const isOut = isStaff && !!foundResult.alreadyIn;
              return (
                <div style={{ marginTop: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{[sub, code].filter(Boolean).join(' · ')}</div>
                    {foundResult.type === 'staffWorkout' && <div style={{ fontSize: 11.5, color: 'var(--accent-green)', marginTop: 2 }}>{t('attendance.cameToTrain')}</div>}
                    {checkInError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 3 }}>{checkInError}</div>}
                  </div>
                  {foundResult.notClocked ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0, maxWidth: 150, lineHeight: 1.4 }}>{foundResult.deactivated ? t('attendance.deactivatedNotClocked') : t('attendance.fullTimeNotClocked')}</span>
                  ) : needsCodeVerify ? (
                    <div data-code-entry style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <CodeInput
                          value={codeInput}
                          onChange={v => { setCodeInput(v); setCodeError(''); }}
                          onEnter={verifyAndCheckIn}
                          placeholder={t('attendance.accessCodePlaceholder')}
                          style={{ flex: 1, minWidth: 0, background: 'var(--bg-elevated)', border: `1px solid ${codeError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 8, padding: '9px 12px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }}
                        />
                        <button onClick={verifyAndCheckIn} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#0a0a0f', cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserCheck size={15} strokeWidth={2} /> {t('attendance.verifyAndCheckIn')}
                        </button>
                      </div>
                      <span role={codeError ? 'alert' : undefined} style={{ fontSize: 11.5, color: codeError ? 'var(--accent-red)' : 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                        {codeError ? `⚠ ${codeError}` : t('attendance.noPhotoCodeRequired')}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={isOut ? handleCheckOutFromSearch : handleCheckIn}
                      style={{
                        background: isOut ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #c9a96e, #b08d4a)',
                        border: isOut ? '1px solid var(--border-subtle)' : 'none', borderRadius: 8, padding: '9px 18px',
                        fontSize: 13, fontWeight: 700, color: isOut ? 'var(--text-primary)' : '#0a0a0f',
                        cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {isOut ? <><LogOut size={15} strokeWidth={2} /> {t('attendance.checkOut')}</> : <><UserCheck size={15} strokeWidth={2} /> {t('attendance.checkInBtn')}</>}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Flash message */}
            {flash && (
              <div role="status" style={{ marginTop: 8, background: flash.action === 'in' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)', border: `1px solid ${flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)', fontFamily: 'DM Sans' }}>
                {flash.name} : {flash.action === 'in' ? t('attendance.checkedInMsg') : t('attendance.checkedOutMsg')}
              </div>
            )}
          </div>
        )}

        {/* Today's log */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(loading || historyLoading) ? (
            <SkeletonCards count={4} />
          ) : displayCheckins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('attendance.noCheckinsYet')}</div>
          ) : displayCheckins.map(c => {
            const m = c._memberObj;
            const name = m ? `${m.firstName || ''} ${m.lastName || ''}`.trim() : c.personType === 'Staff' ? (() => { const s = staffList.find(s => String(s.id) === String(c.personId)); return s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : t('attendance.unknownPerson'); })() : t('attendance.unknownPerson');
            const initials = name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
            return (
              <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 1 }}>
                    {m?.package?.name || c.personType} {c.notes ? `· ${c.notes}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-gold)', fontWeight: 600 }}>{c.time}</div>
                  {c.checkOut && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{c.checkOut}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Mobile rendered no modals at all, so check-out never opened here */}
        <CheckInModal open={!!checkinModal} person={checkinModal} onClose={() => setCheckinModal(null)}
          onConfirm={async ({ time, notes, timeChanged }) => {
            setCheckinModal(null);
            await doCheckIn(timeChanged ? { time, notes } : {});
          }} />
        <CheckOutModal open={!!checkoutModal} entry={checkoutModal?.entry} person={checkoutModal?.person} onClose={() => setCheckoutModal(null)} onConfirm={confirmCheckOut} {...checkoutResult} />
        <EditTimeModal open={!!editModal} entry={editModal?.entry} field={editModal?.field} onClose={() => { setEditModal(null); setEditError(''); }} onConfirm={confirmEdit} error={editError} />
      </div>
    );
  }

  return (
    <div style={{ padding: 28, paddingBottom: 80, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('attendance.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{today}</p>
          {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('common.loading')}</p>}
        </div>

        {/* Date navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '5px 6px', boxShadow: 'var(--shadow-card)' }}>
          <button
            onClick={goPrevDay}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          ><ChevronLeft size={15} strokeWidth={2.5} /></button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { try { attDateRef.current?.showPicker(); } catch { attDateRef.current?.click(); } }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              title={t('attendance.pickDate')}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: isViewingToday ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
                {isViewingToday ? t('common.today') : new Date(viewDate + 'T12:00:00').toLocaleDateString(_locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <Calendar size={12} color={isViewingToday ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth={2} />
            </button>
            <input ref={attDateRef} type="date" value={viewDate} max={todayISO}
              onChange={e => e.target.value && setViewDate(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', top: 0, left: '50%' }}
            />
          </div>

          <button
            onClick={goNextDay}
            disabled={isViewingToday}
            style={{ background: 'none', border: 'none', cursor: isViewingToday ? 'default' : 'pointer', color: isViewingToday ? 'var(--border-subtle)' : 'var(--text-muted)', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
            onMouseEnter={e => { if (!isViewingToday) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
            onMouseLeave={e => { if (!isViewingToday) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
          ><ChevronRight size={15} strokeWidth={2.5} /></button>

          {!isViewingToday && (
            <>
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
              <button
                onClick={() => setViewDate(todayISO)}
                style={{ background: 'var(--accent-gold-dim)', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 10px', fontFamily: 'DM Sans', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-gold-dim)')}
              >{t('common.today')}</button>
            </>
          )}
        </div>
      </div>

      {viewSwitch}

      {pendingApprovalCount > 0 && (
        <div style={{ background: 'var(--accent-yellow-dim)', border: '1px solid var(--accent-yellow)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ {pendingApprovalCount} {pendingApprovalCount > 1 ? t('attendance.pendingApprovals_plural') : t('attendance.pendingApprovals')} {t('attendance.pendingManager')}
        </div>
      )}

      {/* Quick Check-In. only when viewing today and user can manage */}
      {isViewingToday && canManage && <div style={{ ...cardStyle, padding: 20, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('attendance.searchPlaceholder')}
            style={{ width: '100%', height: 52, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, paddingLeft: 48, paddingRight: searchTerm ? 44 : 16, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-gold)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          {searchTerm ? (
            <button onClick={clearSearch} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={() => { setQrManualInput(''); setShowQrScanner(true); }}
              title={t('attendance.scanQrCode')}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <QrCode size={18} />
            </button>
          )}
        </div>

        {matchList()}
        {backToMatches()}
        {searchTerm && foundResult && (
          <div style={{ marginTop: 14, background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${foundResult.type === 'staff' && foundResult.alreadyIn ? 'var(--accent-red)' : 'var(--accent-gold-dim)'}` }}>
            {foundResult.type === 'member' ? (
              <>
                {foundResult.data.photo ? <img src={foundResult.data.photo} alt={foundResult.data.firstName} onClick={() => setPhotoLightbox(foundResult.data.photo)} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }}/> : <Avatar firstName={foundResult.data.firstName} lastName={foundResult.data.lastName} avatarColor={foundResult.data.avatarColor} size={44} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span onClick={() => navigate(`/members/${foundResult.data.id}`)} style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>{foundResult.data.firstName} {foundResult.data.lastName}</span>
                    {foundResult.data.balance > 0 && <span style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{t('attendance.owes')} {formatMoney(foundResult.data.balance)}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{foundResult.data.memberCode || foundResult.data.id} · {foundResult.data.package?.name ?? foundResult.data.package} · {t('attendance.expires')} {formatDate(foundResult.data.endDate)}</div>
                  {foundResult.data.status === 'pending' && (
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 3 }}>⏳ {t('attendance.membershipNotStarted')}{foundResult.data.startDate ? `. ${t('attendance.startsOn')} ${formatDate(foundResult.data.startDate)}` : ''}</div>
                  )}
                  {(foundResult.data.status === 'expiring' || foundResult.data.status === 'expired') && (
                    <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 3 }}>⚠ {foundResult.data.status === 'expired' ? t('attendance.membershipExpired') : t('attendance.membershipExpiringSoon')}</div>
                  )}
                  {checkInError && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 4, fontWeight: 600 }}>⚠ {checkInError}</div>}
                </div>
                {needsCodeVerify ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <CodeInput
                        value={codeInput}
                        onChange={v => { setCodeInput(v); setCodeError(''); }}
                        onEnter={verifyAndCheckIn}
                        placeholder={t('attendance.accessCodePlaceholder')}
                        style={{ width: 130, background: 'var(--bg-card)', border: `1px solid ${codeError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', letterSpacing: '0.5px' }}
                        onFocus={e => { if (!codeError) e.target.style.borderColor = 'var(--accent-gold)'; }}
                        onBlur={e => { if (!codeError) e.target.style.borderColor = 'var(--border-subtle)'; }}
                      />
                      <button style={primaryBtn} onClick={verifyAndCheckIn}>
                        <UserCheck size={13} /> {t('attendance.verifyAndCheckIn')}
                      </button>
                    </div>
                    {codeError
                      ? <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>⚠ {codeError}</span>
                      : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('attendance.noPhotoCodeRequired')}</span>
                    }
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('attendance.enterToCheckIn')}</span>
                    <button style={primaryBtn} onClick={handleCheckIn}><UserCheck size={13} /> {t('attendance.checkInBtn')}</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: foundResult.alreadyIn ? 'var(--accent-red-dim)' : 'var(--accent-blue-dim)', color: foundResult.alreadyIn ? 'var(--accent-red)' : 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: 16 }}>
                  {getInitials(foundResult.data.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{foundResult.data.name}</span>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{t('attendance.staff')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{translateRole(foundResult.data.role)}{foundResult.data.shiftStart ? ` · ${t('attendance.shiftLabel')} ${clockLabel(foundResult.data.shiftStart)}` : ''}</div>
                  {foundResult.type === 'staffWorkout' && <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 2 }}>{t('attendance.cameToTrain')}</div>}
                  {foundResult.alreadyIn && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>{t('attendance.checkedInAlreadyAt', { time: foundResult.alreadyIn.time })}</div>}
                  {checkInError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>⚠ {checkInError}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {foundResult.notClocked
                    ? <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, lineHeight: 1.5 }}>{foundResult.deactivated ? t('attendance.deactivatedNotClocked') : t('attendance.fullTimeNotClocked')}</span>
                    : foundResult.alreadyIn
                      ? <button style={dangerOutlineBtn} onClick={handleCheckOutFromSearch}><LogOut size={13} /> {t('attendance.checkOutBtn')}</button>
                      : <button style={primaryBtn} onClick={handleCheckIn}><UserCheck size={13} /> {t('attendance.checkInBtn')}</button>
                  }
                </div>
              </>
            )}
          </div>
        )}

        {searchTerm && !foundResult && matches.length < 2 && (
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            {t('attendance.noMatchFor', { term: searchTerm })}
          </div>
        )}

        {flash && (
          <div style={{ marginTop: 12, background: flash.action === 'in' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)', border: `1px solid ${flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)'}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            {flash.action === 'in' ? <UserCheck size={15} /> : <LogOut size={15} />}
            {flash.name} : {flash.action === 'in' ? t('attendance.checkedInMsg') : t('attendance.checkedOutMsg')}
          </div>
        )}
      </div>}

      {/* Attendance Table */}
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', gap: 16 }}>
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {isViewingToday ? t('attendance.checkInsLabel') : `${t('attendance.checkInsOnDay')} : ${capFirst(new Date(viewDate + 'T12:00:00').toLocaleDateString(_locale, { weekday: 'long', month: 'long', day: 'numeric' }))}`}
            </span>
            {historyLoading && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>{t('common.loading')}</span>
            )}
          </div>

          {/* Right: search + divider + filter tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder={t('attendance.searchByName')}
                style={{ width: 190, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 28px 6px 30px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', transition: 'border-color 0.15s, width 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-gold)'; e.target.style.width = '220px'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.width = '190px'; }}
              />
              {tableSearch
                ? <button onClick={() => setTableSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}><X size={12} /></button>
                : null
              }
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', flexShrink: 0 }} />

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {TYPE_FILTERS.map(f => (
                <button key={f.key} onClick={() => { setTypeFilter(f.key); setTableSearch(''); }} style={{
                  background: typeFilter === f.key ? 'var(--accent-gold-dim)' : 'transparent',
                  color: typeFilter === f.key ? 'var(--accent-gold)' : 'var(--text-muted)',
                  border: `1px solid ${typeFilter === f.key ? 'var(--accent-gold)' : 'transparent'}`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'DM Sans', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => { if (typeFilter !== f.key) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                  onMouseLeave={e => { if (typeFilter !== f.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                >
                  {f.label} <span style={{ fontSize: 11, opacity: 0.75 }}>({displayCheckins.filter(c => (f.key === 'All' ? c.personType !== 'Staff' : c.personType === typeMap[f.key])).length})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={thStyle}>{t('attendance.member')}</th>
                <th style={thStyle}>{t('attendance.checkIn')}</th>
                {isStaffTab && <th style={thStyle}>{t('attendance.checkOut')}</th>}
                {isStaffTab && <th style={thStyle}>{t('common.status')}</th>}
                {isStaffTab && <th style={thStyle}>{t('common.notes')}</th>}
                <th style={thStyle}>{t('attendance.recordedBy')}</th>
                {isStaffTab && canManage && <th style={thStyle}></th>}
              </tr>
            </thead>
            <tbody>
              {!historyLoading && filteredCheckins.map(entry => {
                const person = resolvePerson(entry, staffList);
                if (!person) return null;
                const checkedOut = !!entry.checkOut;
                return (
                  <tr key={entry.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {person.isStaff
                          ? (person.raw.photo ? <img src={person.raw.photo} alt={person.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: 12 }}>{getInitials(person.name)}</div>)
                          : (person.raw.photo ? <img src={person.raw.photo} alt={person.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={person.raw.firstName} lastName={person.raw.lastName} avatarColor={person.avatarColor} size={32} />)
                        }
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{person.name}</span>
                            {!person.isStaff && <VisitKindBadge kind={entry.kind} isVisitor={entry.personType === 'Visitor'} onlyPasses />}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{person.isStaff ? translateRole(person.raw.role) : person.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{entry.time}</td>
                    {isStaffTab && <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{checkedOut ? entry.checkOut : '-'}</td>}
                    {isStaffTab && (
                      <td style={tdStyle}>
                        {checkedOut
                          ? <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>{t('attendance.statusLeft')}</span>
                          : <span style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t('attendance.statusInside')}</span>
                        }
                      </td>
                    )}
                    {isStaffTab && <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, maxWidth: 160 }}>{entry.notes || '-'}</td>}
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{entry.recordedBy}</td>
                    {isStaffTab && canManage && (
                      <td style={{ ...tdStyle, width: 44, textAlign: 'center', paddingLeft: 6, paddingRight: 6 }}>
                        <RowMenu title={t('common.actions')} items={[
                          { label: t('attendance.checkOutAction'), icon: <LogOut size={15} />, onClick: () => openCheckout({ entry, person }), hidden: checkedOut, danger: true },
                          { label: t('attendance.editCheckinTime'), icon: <Clock size={15} />, onClick: () => setEditModal({ entry, person, field: 'time' }) },
                          { label: t('attendance.editCheckoutTime'), icon: <Clock size={15} />, onClick: () => setEditModal({ entry, person, field: 'checkOut' }), hidden: !checkedOut },
                        ]} />
                      </td>
                    )}
                    {isStaffTab && !canManage && <td style={tdStyle} />}
                  </tr>
                );
              })}
              {(loading || historyLoading) && <SkeletonTableRows rows={5} cols={isStaffTab ? 7 : 3} />}
              {!loading && !historyLoading && filteredCheckins.length === 0 && (
                <tr><td colSpan={isStaffTab ? 7 : 3} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  {tableSearch.trim()
                    ? `${t('common.noResults')}: "${tableSearch}"`
                    : t('attendance.noCheckinsToday')
                  }
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filteredCheckins.length} {t('common.records')}
            {tableSearch.trim() ? ` ${t('attendance.matchingTerm', { term: tableSearch })}` : ''}
          </span>
        </div>
      </div>

      <CheckInModal open={!!checkinModal} person={checkinModal} onClose={() => setCheckinModal(null)}
        onConfirm={async ({ time, notes, timeChanged }) => {
          setCheckinModal(null);
          await doCheckIn(timeChanged ? { time, notes } : {});
        }} />
      <CheckOutModal open={!!checkoutModal} entry={checkoutModal?.entry} person={checkoutModal?.person} onClose={() => setCheckoutModal(null)} onConfirm={confirmCheckOut} {...checkoutResult} />
      <EditTimeModal open={!!editModal} entry={editModal?.entry} field={editModal?.field} onClose={() => { setEditModal(null); setEditError(''); }} onConfirm={confirmEdit} error={editError} />

      {/* ── QR Scanner Overlay ───────────────────────────────────────────── */}
      {showQrScanner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowQrScanner(false)}>
          <style>{`@keyframes gemScanLine { 0%{top:8%} 50%{top:88%} 100%{top:8%} }`}</style>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }} onClick={e => e.stopPropagation()}>
            {/* Viewfinder */}
            <div style={{ position: 'relative', width: 260, height: 260, background: '#0a0a0f', borderRadius: 16, overflow: 'hidden' }}>
              {/* Corners */}
              {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v, h]) => (
                <div key={v+h} style={{ position: 'absolute', [v]: 8, [h]: 8, width: 28, height: 28,
                  borderTop: v === 'top' ? '3px solid #c9a96e' : 'none',
                  borderBottom: v === 'bottom' ? '3px solid #c9a96e' : 'none',
                  borderLeft: h === 'left' ? '3px solid #c9a96e' : 'none',
                  borderRight: h === 'right' ? '3px solid #c9a96e' : 'none',
                  borderTopLeftRadius: v === 'top' && h === 'left' ? 6 : 0,
                  borderTopRightRadius: v === 'top' && h === 'right' ? 6 : 0,
                  borderBottomLeftRadius: v === 'bottom' && h === 'left' ? 6 : 0,
                  borderBottomRightRadius: v === 'bottom' && h === 'right' ? 6 : 0,
                }} />
              ))}
              {/* Scan line */}
              <div style={{ position: 'absolute', left: 12, right: 12, height: 2, background: 'linear-gradient(90deg, transparent, #c9a96e, transparent)', animation: 'gemScanLine 2s ease-in-out infinite' }} />
              <QrCode size={64} color="rgba(201,169,110,0.15)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
            </div>
            <p style={{ color: '#fff', fontSize: 13, textAlign: 'center', margin: 0, fontFamily: 'DM Sans', lineHeight: 1.6 }}>
              {t('attendance.qrHoldBarcode')}
              <br /><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{t('attendance.qrOrManual')}</span>
            </p>
            {/* Manual entry */}
            <div style={{ display: 'flex', gap: 8, width: 300 }}>
              <input
                autoFocus
                value={qrManualInput}
                onChange={e => setQrManualInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && qrManualInput.trim()) {
                    handleSearch(qrManualInput.trim());
                    setShowQrScanner(false);
                  }
                }}
                placeholder={t('attendance.qrManualPlaceholder')}
                style={{ ...inputStyle, flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)', fontFamily: 'DM Sans' }}
              />
              <button
                style={{ ...primaryBtn, flexShrink: 0 }}
                onClick={() => { if (qrManualInput.trim()) { handleSearch(qrManualInput.trim()); setShowQrScanner(false); } }}
              >
                {t('common.search')}
              </button>
            </div>
            <button onClick={() => setShowQrScanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'DM Sans', padding: '4px 12px' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {photoLightbox && (
        <div onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={photoLightbox} alt={t('members.profilePhoto')} style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
          <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>{t('common.clickToClose')}</div>
        </div>
      )}
    </div>
  );
}
