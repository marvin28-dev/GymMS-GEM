import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, UserCheck, X, MoreHorizontal, LogOut, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, AlertTriangle, QrCode, Calendar } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import VisitorCodeModal from '../components/ui/VisitorCodeModal';
import { getAll as getAttendance, checkIn as checkInApi, checkOut as checkOutApi } from '../services/attendance.service';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { create as createTask } from '../services/tasks.service';
import { getAuth } from '../utils/auth';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatMoney = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;

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

// Converts "HH:MM" (24h) → "09:42 AM" for display/storage
const toDisplayTime = (t) => {
  if (!t) return '';
  if (t.includes('AM') || t.includes('PM')) return t;
  let [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${p}`;
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

let _nextId = 100;
const newId = () => ++_nextId;

const TYPE_FILTERS = ['Members', 'Visitors', 'Staff'];

// ─── Custom time picker ────────────────────────────────────────────────────────
// value: "HH:MM" 24h string; onChange: (newVal) => void
function TimeInput({ value, onChange }) {
  const parse = (v) => {
    if (!v) return { h: 12, m: 0, pm: false };
    const [hh, mm] = v.split(':').map(Number);
    return { h: hh % 12 || 12, m: mm, pm: hh >= 12 };
  };
  const emit = (h, m, pm) => {
    let h24 = pm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    onChange(`${String(h24).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  };

  const { h, m, pm } = parse(value);

  const spinH = (dir) => { const next = ((h - 1 + dir + 12) % 12) + 1; emit(next, m, pm); };
  const spinM = (dir) => { emit(h, (m + dir + 60) % 60, pm); };
  const togglePm = () => emit(h, m, !pm);

  const spinBtn = (onClick) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 2, borderRadius: 4,
    transition: 'color 0.15s',
  });

  const SpinCol = ({ val, onUp, onDown, digits = 2 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={spinBtn(onUp)} onClick={onUp}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
        <ChevronUp size={16} strokeWidth={2.5} />
      </button>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', minWidth: 44, textAlign: 'center', lineHeight: 1 }}>
        {String(val).padStart(digits, '0')}
      </span>
      <button style={spinBtn(onDown)} onClick={onDown}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
        <ChevronDown size={16} strokeWidth={2.5} />
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 20px' }}>
      <SpinCol val={h} onUp={() => spinH(1)} onDown={() => spinH(-1)} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, userSelect: 'none' }}>:</span>
      <SpinCol val={m} onUp={() => spinM(1)} onDown={() => spinM(-1)} />
      <button
        onClick={togglePm}
        style={{
          marginLeft: 10, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans',
          fontSize: 13, fontWeight: 700, border: '1px solid var(--border-subtle)',
          background: pm ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
          color: pm ? 'var(--accent-gold)' : 'var(--text-secondary)',
          transition: 'all 0.15s',
        }}
      >
        {pm ? 'PM' : 'AM'}
      </button>
    </div>
  );
}

// ─── Row 3-dot menu (portal-based so it escapes table overflow clipping) ──────
function RowMenu({ checkedOut, onCheckOut, onEditCheckin, onEditCheckout }) {
  const { t } = useLanguage();
  const [anchorRect, setAnchorRect] = useState(null);
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  const isOpen = !!anchorRect;

  useEffect(() => {
    if (!isOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          btnRef.current  && !btnRef.current.contains(e.target)) {
        setAnchorRect(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const toggle = () => {
    if (isOpen) { setAnchorRect(null); return; }
    setAnchorRect(btnRef.current.getBoundingClientRect());
  };

  const act = (fn) => { btnRef.current?.blur(); setAnchorRect(null); fn(); };

  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', textAlign: 'left', padding: '9px 16px',
    fontSize: 13, background: 'transparent', border: 'none',
    cursor: 'pointer', fontFamily: 'DM Sans', whiteSpace: 'nowrap',
  };

  const menuStyle = anchorRect ? {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    right: window.innerWidth - anchorRect.right,
    zIndex: 9999,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    minWidth: 190,
    overflow: 'hidden',
  } : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          background: isOpen ? 'var(--bg-elevated)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', borderRadius: 6,
          width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} style={menuStyle}>
          {!checkedOut && (
            <button
              onClick={() => act(onCheckOut)}
              style={{ ...itemStyle, color: 'var(--accent-red)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={13} strokeWidth={2.5} /> {t('attendance.checkOutAction')}
            </button>
          )}
          <button
            onClick={() => act(onEditCheckin)}
            style={{ ...itemStyle, color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Clock size={13} strokeWidth={2.5} /> {t('attendance.editCheckinTime')}
          </button>
          {checkedOut && (
            <button
              onClick={() => act(onEditCheckout)}
              style={{ ...itemStyle, color: 'var(--text-primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Clock size={13} strokeWidth={2.5} /> {t('attendance.editCheckoutTime')}
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Check-out modal ──────────────────────────────────────────────────────────
function CheckOutModal({ open, onClose, entry, person, onConfirm }) {
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

  const canConfirm = !timeEdited || notes.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...cardStyle, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('attendance.checkOutAction')} — {person.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('attendance.checkedInAt')} <strong style={{ color: 'var(--text-primary)' }}>{entry.time}</strong>
        </div>
        <div>
          <label style={labelStyle}>{t('attendance.checkoutTimeLabel')}</label>
          <TimeInput value={time} onChange={v => { setTime(v); setTimeEdited(true); }} />
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            disabled={!canConfirm}
            onClick={() => onConfirm({ time: toDisplayTime(time), notes: notes.trim(), timeChanged: timeEdited })}
          >
            <LogOut size={13} /> {t('attendance.confirmCheckOut')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit time modal (always requires notes → manager task) ───────────────────
function EditTimeModal({ open, onClose, entry, field, onConfirm }) {
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
  const canSave = time && notes.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...cardStyle, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div>
          <label style={labelStyle}>{label}</label>
          <TimeInput value={time} onChange={setTime} />
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={{ ...primaryBtn, opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}
            disabled={!canSave}
            onClick={() => onConfirm({ time: toDisplayTime(time), notes: notes.trim(), field })}
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
  const { t } = useLanguage();
  const TYPE_FILTERS = [
    { key: 'Members', label: t('attendance.members') },
    { key: 'Visitors', label: t('attendance.visitors') },
    { key: 'Staff', label: t('attendance.staff') },
  ];
  const searchRef = useRef(null);
  const attDateRef = useRef(null);
  const [searchTerm, setSearchTerm]       = useState('');
  const [foundResult, setFoundResult]     = useState(null);
  const [typeFilter, setTypeFilter]       = useState('Members');
  const [checkins, setCheckins]           = useState([]);
  const [membersList, setMembersList]     = useState([]);
  const [staffList, setStaffList]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [checkoutModal, setCheckoutModal] = useState(null);
  const [editModal, setEditModal]         = useState(null);
  const [managerTasks, setManagerTasks]   = useState([]);
  const [checkInError, setCheckInError]   = useState('');
  const [flash, setFlash]                 = useState(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');
  const [visitorCodeOpen, setVisitorCodeOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [codeInput, setCodeInput]   = useState('');
  const [codeError, setCodeError]   = useState('');

  const _now = new Date();
  const todayISO   = _now.toISOString().slice(0, 10);
  const todayShort = _now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const today      = _now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [viewDate, setViewDate]           = useState(todayISO);
  const [historyCheckins, setHistoryCheckins] = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  const parseAttendanceRows = (data, dateLabel) =>
    (data || []).map(a => ({
      id:         a.id,
      personId:   a.memberId,
      personType: a.member?.status === 'visitor' ? 'Visitor' : 'Member',
      time:       new Date(a.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      checkOut:   a.checkOut ? new Date(a.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
      recordedBy: a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : '—',
      date:       dateLabel,
      notes:      a.note || null,
      _memberObj: a.member,
    }));

  useEffect(() => {
    Promise.all([getAttendance({ date: todayISO }), getMembers(), getStaff()])
      .then(([attRes, memRes, staffRes]) => {
        setMembersList(memRes.data || []);
        setStaffList(staffRes.data || []);
        setCheckins(parseAttendanceRows(attRes.data, todayShort));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTableSearch('');
    if (viewDate === todayISO) return;
    setHistoryLoading(true);
    const dateLabel = new Date(viewDate + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    getAttendance({ date: viewDate })
      .then(res => setHistoryCheckins(parseAttendanceRows(res.data, dateLabel)))
      .catch(() => setHistoryCheckins([]))
      .finally(() => setHistoryLoading(false));
  }, [viewDate]);

  const goPrevDay = () => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().slice(0, 10));
  };
  const goNextDay = () => {
    if (viewDate >= todayISO) return;
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().slice(0, 10));
  };
  const isViewingToday = viewDate === todayISO;
  const viewDateLabel = isViewingToday
    ? 'Today'
    : new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (val) => {
    setSearchTerm(val);
    setCheckInError('');
    setCodeInput('');
    setCodeError('');
    const trimmed = val.trim();
    if (!trimmed) { setFoundResult(null); return; }
    const lower = trimmed.toLowerCase();
    const staffMatch = staffList.find(s => {
      const name = s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();
      return s.accessCode === trimmed || name.toLowerCase().includes(lower);
    });
    if (staffMatch) {
      const staffName = staffMatch.name || `${staffMatch.firstName || ''} ${staffMatch.lastName || ''}`.trim();
      const alreadyIn = checkins.find(c => c.personType === 'Staff' && String(c.personId) === String(staffMatch.id) && !c.checkOut);
      setFoundResult({ type: 'staff', data: { ...staffMatch, name: staffName }, alreadyIn: alreadyIn || null });
      return;
    }
    const memberMatch = membersList.find(m =>
      m.accessCode === trimmed ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
      (m.phone && m.phone.includes(trimmed)) ||
      (m.memberCode && m.memberCode.toLowerCase().includes(lower))
    );
    const foundByCode = !!(memberMatch && memberMatch.accessCode === trimmed);
    setFoundResult(memberMatch ? { type: 'member', data: memberMatch, foundByCode } : null);
  };

  const clearSearch = () => { setSearchTerm(''); setFoundResult(null); setCheckInError(''); setCodeInput(''); setCodeError(''); };

  // Returns true when a member was found by name (not code) and has no profile photo —
  // visual identity cannot be confirmed, so access code must be entered manually.
  const needsCodeVerify = (() => {
    if (!foundResult || foundResult.type !== 'member' || foundResult.foundByCode) return false;
    if (foundResult.data?.isVisitor || foundResult.data?.status === 'visitor') return false;
    return !foundResult.data?.photo;
  })();

  const verifyAndCheckIn = async () => {
    const code = codeInput.trim();
    if (!code) { setCodeError('Please enter the access code.'); return; }
    if (code !== foundResult.data.accessCode) { setCodeError('Incorrect access code. Try again.'); return; }
    setCodeError('');
    await doCheckIn();
  };
  const showFlash = (name, action) => { setFlash({ name, action }); setTimeout(() => setFlash(null), 2500); };

  // ── Check In ─────────────────────────────────────────────────────────────
  const doCheckIn = async () => {
    if (!foundResult) return;
    const isStaff = foundResult.type === 'staff';
    const name = isStaff ? foundResult.data.name : `${foundResult.data.firstName} ${foundResult.data.lastName}`;
    if (!isStaff) {
      try {
        const res = await checkInApi({ memberId: foundResult.data.id });
        const authUser = getAuth()?.user;
        const staffName = res.data?.staff
          ? `${res.data.staff.firstName} ${res.data.staff.lastName}`
          : (authUser ? `${authUser.firstName} ${authUser.lastName}` : '—');
        setCheckins(prev => [{
          id:         res.data.id,
          personId:   foundResult.data.id,
          personType: foundResult.data.status === 'visitor' ? 'Visitor' : 'Member',
          time:       toDisplayTime(nowTime()),
          checkOut:   null,
          recordedBy: staffName,
          date:       todayShort,
          notes:      null,
          _memberObj: foundResult.data,
        }, ...prev]);
      } catch (err) {
        setCheckInError(err.response?.data?.error || 'Check-in failed');
        return;
      }
    } else {
      const authUser = getAuth()?.user;
      const staffName = authUser ? `${authUser.firstName} ${authUser.lastName}` : '—';
      setCheckins(prev => [{
        id:         newId(),
        personId:   String(foundResult.data.id),
        personType: 'Staff',
        time:       toDisplayTime(nowTime()),
        checkOut:   null,
        recordedBy: staffName,
        date:       todayShort,
        notes:      null,
      }, ...prev]);
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
          setCheckInError(`Too early — shift starts at ${toDisplayTime(s.shiftStart)}. Earliest: ${toDisplayTime(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`)}.`);
          return;
        }
      }
      await doCheckIn();
      return;
    }
    const isVisitor = foundResult.data.isVisitor || foundResult.data.status === 'visitor';
    if (isVisitor && !foundResult.foundByCode) {
      setVisitorCodeOpen(true);
    } else {
      await doCheckIn();
    }
  };

  const handleCheckOutFromSearch = () => {
    if (!foundResult?.alreadyIn) return;
    setCheckoutModal({ entry: foundResult.alreadyIn, person: { name: foundResult.data.name } });
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
    if (entry.personType !== 'Staff') {
      try { await checkOutApi(entry.id); } catch {}
    }
    setCheckins(prev => prev.map(c => c.id === entry.id ? { ...c, checkOut: time, notes: notes || null } : c));
    if (timeChanged) {
      setManagerTasks(prev => [...prev, { id: Date.now(), staffName: checkoutModal.person.name, checkIn: entry.time, checkOut: time, notes, createdAt: nowTime(), status: 'Pending' }]);
      try {
        await createTask({ title: `Time Change Approval — ${checkoutModal.person.name}`, description: `Check-out time adjusted to ${time}. Reason: ${notes}`, priority: 'High', status: 'Pending', category: 'Attendance' });
      } catch {}
    }
    showFlash(checkoutModal.person.name, 'out');
    setCheckoutModal(null);
  };

  const confirmEdit = async ({ time, notes, field }) => {
    setCheckins(prev => prev.map(c => c.id === editModal.entry.id ? { ...c, [field]: time, notes } : c));
    setManagerTasks(prev => [...prev, { id: Date.now(), staffName: editModal.person.name, field, newTime: time, notes, createdAt: toDisplayTime(nowTime()), status: 'Pending' }]);
    try {
      const label = field === 'time' ? 'Check-in' : 'Check-out';
      await createTask({ title: `Time Change Approval — ${editModal.person.name}`, description: `${label} time adjusted to ${time}. Reason: ${notes}`, priority: 'High', status: 'Pending', category: 'Attendance' });
    } catch {}
    setEditModal(null);
  };

  const typeMap = { Members: 'Member', Visitors: 'Visitor', Staff: 'Staff' };
  const displayCheckins = isViewingToday ? checkins : historyCheckins;
  const filteredCheckins = displayCheckins
    .filter(c => c.personType === typeMap[typeFilter])
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
  return (
    <div style={{ padding: 28, paddingBottom: 80, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('attendance.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{today}</p>
          {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Loading…</p>}
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
              title="Pick a date"
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: isViewingToday ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
                {isViewingToday ? 'Today' : new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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

      {managerTasks.filter(tk => tk.status === 'Pending').length > 0 && (
        <div style={{ background: 'var(--accent-yellow-dim)', border: '1px solid var(--accent-yellow)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ {managerTasks.filter(tk => tk.status === 'Pending').length} {managerTasks.filter(tk => tk.status === 'Pending').length > 1 ? t('attendance.pendingApprovals_plural') : t('attendance.pendingApprovals')} {t('attendance.pendingManager')}
        </div>
      )}

      {/* Quick Check-In — only when viewing today */}
      {isViewingToday && <div style={{ ...cardStyle, padding: 20, marginBottom: 24 }}>
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
              title="Scan QR / Barcode"
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <QrCode size={18} />
            </button>
          )}
        </div>

        {searchTerm && foundResult && (
          <div style={{ marginTop: 14, background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${foundResult.type === 'staff' && foundResult.alreadyIn ? 'var(--accent-red)' : 'var(--accent-gold-dim)'}` }}>
            {foundResult.type === 'member' ? (
              <>
                {foundResult.data.photo ? <img src={foundResult.data.photo} alt={foundResult.data.firstName} onClick={() => setPhotoLightbox(foundResult.data.photo)} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }}/> : <Avatar firstName={foundResult.data.firstName} lastName={foundResult.data.lastName} avatarColor={foundResult.data.avatarColor} size={44} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span onClick={() => navigate(`/members/${foundResult.data.id}`)} style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>{foundResult.data.firstName} {foundResult.data.lastName}</span>
                    {foundResult.data.balance > 0 && <span style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>Owes {formatMoney(foundResult.data.balance)}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{foundResult.data.memberCode || foundResult.data.id} · {foundResult.data.package?.name ?? foundResult.data.package} · Expires {formatDate(foundResult.data.endDate)}</div>
                  {foundResult.data.status === 'pending' && (
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 3 }}>⏳ Membership not started yet{foundResult.data.startDate ? ` — starts ${formatDate(foundResult.data.startDate)}` : ''}</div>
                  )}
                  {(foundResult.data.status === 'expiring' || foundResult.data.status === 'expired') && (
                    <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 3 }}>⚠ Membership {foundResult.data.status === 'expired' ? 'expired' : 'expiring soon'}</div>
                  )}
                </div>
                {needsCodeVerify ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={codeInput}
                        onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
                        onKeyDown={e => e.key === 'Enter' && verifyAndCheckIn()}
                        placeholder="Access code…"
                        style={{ width: 130, background: 'var(--bg-card)', border: `1px solid ${codeError ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', letterSpacing: '0.5px' }}
                        onFocus={e => { if (!codeError) e.target.style.borderColor = 'var(--accent-gold)'; }}
                        onBlur={e => { if (!codeError) e.target.style.borderColor = 'var(--border-subtle)'; }}
                      />
                      <button style={primaryBtn} onClick={verifyAndCheckIn}>
                        <UserCheck size={13} /> Verify & Check In
                      </button>
                    </div>
                    {codeError
                      ? <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>⚠ {codeError}</span>
                      : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No photo on file — access code required</span>
                    }
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter ↵ to check in</span>
                    <button style={primaryBtn} onClick={handleCheckIn}><UserCheck size={13} /> Check In</button>
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
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>Staff</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{foundResult.data.role}{foundResult.data.shiftStart ? ` · Shift ${toDisplayTime(foundResult.data.shiftStart)}` : ''}</div>
                  {foundResult.alreadyIn && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>Checked in at {foundResult.alreadyIn.time}</div>}
                  {checkInError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>⚠ {checkInError}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {foundResult.alreadyIn
                    ? <button style={dangerOutlineBtn} onClick={handleCheckOutFromSearch}><LogOut size={13} /> Check Out</button>
                    : <button style={primaryBtn} onClick={handleCheckIn}><UserCheck size={13} /> Check In</button>
                  }
                </div>
              </>
            )}
          </div>
        )}

        {searchTerm && !foundResult && (
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            No match for "{searchTerm}"
          </div>
        )}

        {flash && (
          <div style={{ marginTop: 12, background: flash.action === 'in' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)', border: `1px solid ${flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)'}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: flash.action === 'in' ? 'var(--accent-green)' : 'var(--accent-blue)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            {flash.action === 'in' ? <UserCheck size={15} /> : <LogOut size={15} />}
            {flash.name} — {flash.action === 'in' ? 'checked in successfully' : 'checked out'}
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
              {isViewingToday ? t('attendance.checkInsLabel') : `${t('attendance.checkIn')}s — ${new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
            </span>
            {historyLoading && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>Loading…</span>
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
                  {f.label} <span style={{ fontSize: 11, opacity: 0.75 }}>({displayCheckins.filter(c => c.personType === typeMap[f.key]).length})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={thStyle}>{t('attendance.member')}</th>
                <th style={thStyle}>{t('attendance.checkIn')}</th>
                {isStaffTab && <th style={thStyle}>{t('attendance.checkOut')}</th>}
                {isStaffTab && <th style={thStyle}>{t('common.status')}</th>}
                {isStaffTab && <th style={thStyle}>{t('common.notes')}</th>}
                <th style={thStyle}>{t('attendance.recordedBy')}</th>
                {isStaffTab && <th style={thStyle}></th>}
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
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{person.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{person.isStaff ? person.raw.role : person.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{entry.time}</td>
                    {isStaffTab && <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{checkedOut ? entry.checkOut : '—'}</td>}
                    {isStaffTab && (
                      <td style={tdStyle}>
                        {checkedOut
                          ? <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>Left</span>
                          : <span style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Inside</span>
                        }
                      </td>
                    )}
                    {isStaffTab && <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, maxWidth: 160 }}>{entry.notes || '—'}</td>}
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{entry.recordedBy}</td>
                    {isStaffTab && (
                      <td style={{ ...tdStyle, width: 44, textAlign: 'center', paddingLeft: 6, paddingRight: 6 }}>
                        <RowMenu
                          checkedOut={checkedOut}
                          onCheckOut={() => setCheckoutModal({ entry, person })}
                          onEditCheckin={() => setEditModal({ entry, person, field: 'time' })}
                          onEditCheckout={() => setEditModal({ entry, person, field: 'checkOut' })}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {historyLoading && (
                <tr><td colSpan={isStaffTab ? 7 : 3} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</td></tr>
              )}
              {!historyLoading && filteredCheckins.length === 0 && (
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
            {filteredCheckins.length} record{filteredCheckins.length !== 1 ? 's' : ''}
            {tableSearch.trim() ? ` matching "${tableSearch}"` : ''}
          </span>
        </div>
      </div>

      <CheckOutModal open={!!checkoutModal} entry={checkoutModal?.entry} person={checkoutModal?.person} onClose={() => setCheckoutModal(null)} onConfirm={confirmCheckOut} />
      <EditTimeModal open={!!editModal} entry={editModal?.entry} field={editModal?.field} onClose={() => setEditModal(null)} onConfirm={confirmEdit} />

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
              Hold the QR / barcode in front of the camera
              <br /><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>or enter the access code manually below</span>
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
                placeholder="Type or paste access code…"
                style={{ ...inputStyle, flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)', fontFamily: 'DM Sans' }}
              />
              <button
                style={{ ...primaryBtn, flexShrink: 0 }}
                onClick={() => { if (qrManualInput.trim()) { handleSearch(qrManualInput.trim()); setShowQrScanner(false); } }}
              >
                Search
              </button>
            </div>
            <button onClick={() => setShowQrScanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'DM Sans', padding: '4px 12px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {photoLightbox && (
        <div onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={photoLightbox} alt="Profile" style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
          <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>Click anywhere to close</div>
        </div>
      )}
      <VisitorCodeModal
        open={visitorCodeOpen}
        onClose={() => setVisitorCodeOpen(false)}
        visitor={foundResult?.type === 'member' ? foundResult.data : null}
        onSuccess={doCheckIn}
      />
    </div>
  );
}
