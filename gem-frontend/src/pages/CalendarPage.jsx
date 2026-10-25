import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, ClipboardList, Dumbbell, Search, Repeat as RepeatIcon, StickyNote } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import Avatar from '../components/ui/Avatar';
import BusyWarning from '../components/BusyWarning';
import { getAll as getCalendar, create as createEvent, update as updateEvent, remove as removeEvent } from '../services/calendar.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getTasks, update as updateTask } from '../services/tasks.service';
import { getCoachClients } from '../services/coach.service';
import { getAuth, getRole } from '../utils/auth';
import { capFirst, todayStr as getToday, dayStr, addDaysStr } from '../utils/date';
import { softAll, failed } from '../utils/loadAll';
import { gymCache } from '../utils/gymCache';
import { membershipEnded } from '../utils/coaching';
import { TASKS_PATH } from '../utils/rolePages';
import { serverFieldError, revealFirstError } from '../utils/formErrors';
import TimeInput from '../components/ui/TimeInput';

const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const ROLE_KEYS = {
  general_manager: 'generalManager', 'General Manager': 'generalManager',
  manager: 'manager', 'Manager': 'manager',
  trainer: 'trainer', 'Trainer': 'trainer',
  instructor: 'instructor', 'Instructor': 'instructor',
  front_desk: 'frontDesk', 'Front Desk': 'frontDesk',
  coach: 'coach', 'Coach': 'coach',
  other: 'roleOther', 'Other': 'roleOther',
};

const EVENT_COLORS = {
  gold: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', bar: '#c9a96e' },
  blue: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', bar: '#60a5fa' },
  green: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)', bar: '#4ade80' },
  red: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)', bar: '#f87171' },
  purple: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', bar: '#a78bfa' },
};
const CATEGORY_KEYS = { Class: 'calendar.catClass', Appointment: 'calendar.catAppointment', Meeting: 'calendar.catMeeting', Maintenance: 'calendar.catMaintenance', Event: 'calendar.catEvent', Training: 'calendar.catTraining', Personal: 'calendar.catPersonal', Task: 'calendar.catTask' };

const parseStaffIds = (staffIds) => {
  if (Array.isArray(staffIds)) return staffIds;
  try { return staffIds ? JSON.parse(staffIds) : []; } catch { return []; }
};

const mapEvent = (e) => ({
  kind:          'event',
  id:            e.id,
  title:         e.title,
  category:      e.category || (e.isPrivate ? 'Personal' : 'Class'),
  date:          e.date ? String(e.date).slice(0, 10) : (e.startTime || '').slice(0, 10),
  startTime:     e.time || (e.startTime || '').slice(11, 16),
  endTime:       e.duration || '',
  assignedStaff: parseStaffIds(e.staffIds).length > 0 ? parseStaffIds(e.staffIds) : (e.instructor ? [e.instructor.id] : []),
  location:      e.location    || '',
  color:         e.color       || 'gold',
  description:   e.description  || '',
  repeat:        e.repeat       || 'None',
  repeatUntil:   e.repeatUntil  || '',
  seriesId:      e.seriesId     || null,
  createdById:   e.createdById  || null,
  isPrivate:     !!e.isPrivate,
  memberId:      e.memberId || null,
  member:        e.member || null,
  // Who has said yes, no, or not yet - for whoever booked it to read off
  responses:     Array.isArray(e.responses) ? e.responses : [],
  // On My Calendar: 'pending' while I have not answered the invite yet
  myResponse:    e.myResponse || null,
});

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };
const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'DM Sans' };

const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fromMin = (mins) => `${String(Math.floor(Math.min(mins, 1439) / 60)).padStart(2, '0')}:${String(Math.min(mins, 1439) % 60).padStart(2, '0')}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const byTime = (a, b) => (a.startTime || '').localeCompare(b.startTime || '');
const mondayOf = (ds) => { const d = new Date(`${ds}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayStr(d); };
const shiftMonth = (ds, n) => { const d = new Date(`${ds}T00:00:00`); d.setDate(1); d.setMonth(d.getMonth() + n); return dayStr(d); };
const EMPTY_FORM = { type: 'event', title: '', category: 'Class', date: '', startTime: '', endTime: '', description: '', assignedStaff: [], color: 'gold', repeat: 'None', repeatUntil: '', location: '', memberId: '' };

export default function CalendarPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const translateRole = (r) => { const k = ROLE_KEYS[r]; return k ? t(`staff.${k}`) : (r || ''); };
  const isMobile = useIsMobile();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const role = getRole();
  const isCoach = ['trainer', 'instructor', 'coach'].includes(role);
  // Front desk gets the same personal calendar a trainer has: their own
  // diary, plus whatever gym events they were put on and have accepted.
  const hasOwnCalendar = isCoach || role === 'front_desk';
  // What a trainer or the front desk writes here is theirs alone: the
  // server keeps it off everybody else's calendar, including management's.
  const ownDiaryOnly = hasOwnCalendar;
  const myId = getAuth()?.user?.id;
  const today = getToday();

  // Monday first, in the viewer's language
  const DAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));

  const [calendarTab, setCalendarTab] = useState('gym');
  const [viewMode, setViewMode] = useState('month');
  // The day the view is on: its month, its week, or the day itself
  const [focus, setFocus] = useState(today);
  // Show the last calendar at once and refresh it quietly. See utils/gymCache.js.
  const cache = gymCache('calendar');
  const [events, setEvents] = useState(() => cache.read('events', []));
  const [myCalendarEvents, setMyCalendarEvents] = useState(() => cache.read('mine', []));
  const [myTasks, setMyTasks] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [staffList, setStaffList] = useState(() => cache.read('staff', []));
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Deactivated staff keep their name on existing classes but cannot be picked for new ones
  const assignableStaff = staffList.filter(s => s.isActive !== false || form.assignedStaff.includes(s.id));
  const setF = (patch) => { setForm(f => ({ ...f, ...patch })); setErrors({}); };

  // A compact one-line list of who is on an event: up to two names, then "N people"
  const staffLabel = (ids) => {
    const names = (ids || []).map(id => { const s = staffList.find(x => String(x.id) === String(id)); return s ? staffName(s) : null; }).filter(Boolean);
    if (names.length === 0) return t('calendar.noStaff');
    if (names.length <= 2) return names.join(', ');
    return t('calendar.nPeople', { n: names.length });
  };

  // The personal calendar is a separate fetch, not a filter of the gym one:
  // being named on an event is not the same as being on it. Only an accepted
  // invite belongs here, and the server is what knows which ones those are.
  const refreshMine = useCallback(() => {
    if (!hasOwnCalendar) return;
    getCalendar({ mine: 1 }).then(r => { const m = (r.data || []).map(mapEvent); setMyCalendarEvents(m); cache.write('mine', m); }).catch(() => {});
    getTasks().then(r => setMyTasks((r.data || []).filter(tk => tk.assignedToId === myId))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOwnCalendar, myId]);

  const loadGym = useCallback(() => softAll([getCalendar(), getStaff()])
    .then(([calRes, staffRes]) => {
      // A request that failed leaves what is shown, and its saved copy, alone
      if (!failed(calRes)) { const evs = (calRes.data || []).map(mapEvent); setEvents(evs); cache.write('events', evs); }
      if (!failed(staffRes)) { const stf = staffRes.data || []; setStaffList(stf); cache.write('staff', stf); }
    })
    .catch(console.error), []); // eslint-disable-line react-hooks/exhaustive-deps

  const liveTick = useLiveTick();
  useEffect(() => { loadGym(); refreshMine(); }, [loadGym, refreshMine, liveTick]);
  // A coach books training with their own clients, so those are at hand
  useEffect(() => {
    if (!isCoach || !myId) return;
    getCoachClients(myId).then(r => setClients((r.data?.clients || []).filter(c => !membershipEnded(c)))).catch(() => {});
  }, [isCoach, myId, liveTick]);
  const reload = () => { loadGym(); refreshMine(); };

  // ── What the open tab shows ──
  // A coach's or the desk's gym calendar is the gym's own events, the ones
  // management booked; their own entries live on My calendar.
  const pendingInvites = myTasks.filter(tk => tk.category === 'Calendar' && tk.status === 'Pending');
  const taskItems = myTasks
    .filter(tk => tk.category !== 'Calendar' && tk.dueDate && !['Done', 'Declined'].includes(tk.status))
    .map(tk => ({ kind: 'task', id: `task-${tk.id}`, date: dayStr(tk.dueDate), startTime: '', endTime: '', title: tk.title, color: 'blue', category: 'Task', priority: tk.priority }));
  const onMine = hasOwnCalendar && calendarTab === 'mine';
  const items = onMine ? [...myCalendarEvents, ...taskItems] : (hasOwnCalendar ? events.filter(e => !e.isPrivate) : events);
  const itemsOn = (ds) => items.filter(i => i.date === ds).sort(byTime);

  // ── Navigation ──
  const shift = (n) => setFocus(f => (viewMode === 'month' ? shiftMonth(f, n) : addDaysStr(f, n * (viewMode === 'week' ? 7 : 1))));
  const fd = new Date(`${focus}T00:00:00`);
  const monthLabel = capFirst(fd.toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
  const weekStart = mondayOf(focus);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));
  const weekLabel = (() => {
    const a = new Date(`${weekDays[0]}T00:00:00`), b = new Date(`${weekDays[6]}T00:00:00`);
    const sameMonth = a.getMonth() === b.getMonth();
    return `${a.toLocaleDateString(locale, { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })} - ${b.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();
  const dayLabel = capFirst(fd.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const navLabel = viewMode === 'month' ? monthLabel : viewMode === 'week' ? weekLabel : dayLabel;

  // ── Adding ──
  // Nothing is booked into a day or an hour that has already gone. A coach or
  // the desk adds only to their own calendar: the gym's is management's, so on
  // the Gym Calendar tab its boxes and hours just show what is on.
  const canAddHere = !hasOwnCalendar || onMine;
  const canAddOn = (ds) => canAddHere && ds >= today;
  const slotStart = (ds, hour) => {
    if (hour == null) return '';
    const start = hour * 60;
    if (ds === today && start <= nowMin()) { const next = Math.ceil((nowMin() + 1) / 15) * 15; return next < (hour + 1) * 60 ? fromMin(next) : null; }
    return fromMin(start);
  };
  const openAdd = (ds, hour = null) => {
    if (!canAddOn(ds)) return;
    const start = slotStart(ds, hour);
    if (start === null) return;
    setForm({ ...EMPTY_FORM, type: isCoach ? 'training' : 'event', category: ownDiaryOnly ? 'Personal' : 'Class', date: ds, startTime: start || '', endTime: start ? fromMin(toMin(start) + 60) : '', color: ownDiaryOnly ? 'blue' : 'gold' });
    setEditingEvent(null); setErrors({}); setClientSearch(''); setShowForm(true);
  };
  const openEdit = (evt) => {
    setForm({ ...EMPTY_FORM, ...evt, type: evt.category === 'Training' && evt.memberId ? 'training' : 'event', memberId: evt.memberId || '', repeat: 'None', repeatUntil: '' });
    setEditingEvent(evt); setErrors({}); setClientSearch(''); setSelectedEvent(null); setShowForm(true);
  };
  const canEdit = (evt) => evt?.kind === 'event' && (hasOwnCalendar ? evt.isPrivate && String(evt.createdById) === String(myId) : (!evt.isPrivate || String(evt.createdById) === String(myId)));

  const pickedClient = clients.find(c => c.id === form.memberId) || (editingEvent?.member && editingEvent.member.id === form.memberId ? editingEvent.member : null);
  const handleSave = async () => {
    if (saving) return;
    const e = {};
    const training = form.type === 'training';
    if (training && !form.memberId) e.memberId = t('calendar.clientRequired');
    if (!training && !String(form.title || '').trim()) e.title = t('calendar.titleRequired');
    if (!form.date) e.date = t('calendar.dateRequired');
    if (!form.startTime) e.startTime = t('calendar.startTimeRequired');
    if (!form.endTime) e.endTime = t('calendar.endTimeRequired');
    // An event lives inside a day: its end must be later than its start. Only
    // work shifts (time cards) are allowed to run past midnight.
    else if (form.startTime && form.endTime === form.startTime) e.endTime = t('calendar.endEqualsStart');
    else if (form.startTime && form.endTime < form.startTime) {
      const endH = parseInt(form.endTime.slice(0, 2), 10), startH = parseInt(form.startTime.slice(0, 2), 10);
      e.endTime = (endH < 12 && startH >= 12) ? t('calendar.oneDayOnly') : t('calendar.startBeforeEnd');
    }
    const moved = !editingEvent || form.date !== editingEvent.date || form.startTime !== editingEvent.startTime;
    if (moved && form.date && form.date < today) e.date = t('calendar.notInPast');
    else if (moved && form.date === today && form.startTime && toMin(form.startTime) <= nowMin()) e.startTime = t('calendar.timePassed');
    if (form.repeat !== 'None' && !form.repeatUntil) e.repeatUntil = t('calendar.repeatUntilRequired');
    else if (form.repeat !== 'None' && form.date && form.repeatUntil > addDaysStr(form.date, 366)) e.repeatUntil = t('calendar.repeatUntilMaxYear');
    if (Object.keys(e).length) { setErrors(e); revealFirstError(); return; }

    const clientName = pickedClient ? `${pickedClient.firstName || ''} ${pickedClient.lastName || ''}`.trim() : '';
    const payload = {
      title:        training ? t('calendar.trainingTitle', { name: clientName }) : form.title.trim(),
      category:     ownDiaryOnly ? (training ? 'Training' : 'Personal') : form.category,
      memberId:     training ? form.memberId : null,
      date:         form.date,
      time:         form.startTime,
      duration:     form.endTime || null,
      staffIds:     ownDiaryOnly ? [] : form.assignedStaff,
      instructorId: ownDiaryOnly ? null : (form.assignedStaff[0] || null),
      location:     form.location || '',
      color:        ownDiaryOnly ? (training ? 'green' : 'blue') : form.color,
      description:  form.description || null,
      repeat:       form.repeat !== 'None' ? form.repeat : null,
      repeatUntil:  form.repeat !== 'None' ? form.repeatUntil : null,
      tz:           new Date().getTimezoneOffset(),
    };
    setSaving(true);
    try {
      if (editingEvent) await updateEvent(editingEvent.id, payload);
      else await createEvent(payload);
      setShowForm(false);
      // Saving can add or drop people, which changes their invite - and this
      // account's own personal calendar, if it was on the list either way.
      reload();
    } catch (err) {
      const se = serverFieldError(err, t('calendar.saveFailed'));
      setErrors(se.field ? { [se.field]: se.message } : { save: se.message });
    } finally {
      setSaving(false);
    }
  };

  // A series asks which ones; a single event asks first too (D-25)
  const [confirmDelete, setConfirmDelete] = useState(null);
  const requestDelete = (evt) => { if (evt.seriesId) setDeleteTarget(evt); else setConfirmDelete(evt); };
  // A refused delete or invite answer keeps the event open with the reason
  // (F-120); it used to close as if done and leave the reload to contradict it.
  const handleDeleteEvent = async (evt, series = false) => {
    setActionError('');
    try {
      await removeEvent(evt.id, { series });
    } catch (err) {
      setDeleteTarget(null);
      setActionError(err?.response?.data?.error || t('memberProfile.actionFailed'));
      return;
    }
    setDeleteTarget(null); setSelectedEvent(null); setShowForm(false);
    reload();
  };

  const respondToInvite = async (taskId, decision) => {
    setRespondingId(taskId);
    setActionError('');
    try {
      await updateTask(taskId, { status: decision });
      refreshMine();
      return true;
    } catch (err) {
      setActionError(err?.response?.data?.error || t('memberProfile.actionFailed'));
      return false;
    } finally { setRespondingId(null); }
  };

  const openItem = (it) => { if (it.kind === 'task') navigate(TASKS_PATH(role)); else setSelectedEvent(it); };
  // The invite (a Calendar task) behind an event I was put on
  const inviteFor = (ev) => myTasks.find(tk => tk.category === 'Calendar' && String(tk.eventId) === String(ev.id) && tk.status === 'Pending');

  // ── Pieces ──
  const chipFor = (it, compact = false) => {
    const c = EVENT_COLORS[it.color] || EVENT_COLORS.gold;
    const Icon = it.kind === 'task' ? ClipboardList : it.category === 'Training' ? Dumbbell : null;
    return (
      <button key={it.id} type="button" data-cal-item={it.kind} data-pending={it.myResponse === 'pending' ? '1' : undefined} onClick={ev => { ev.stopPropagation(); openItem(it); }} title={it.myResponse === 'pending' ? `${it.title} (${t('calendar.awaitingYou')})` : it.title}
        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', background: it.myResponse === 'pending' ? 'transparent' : c.bg, color: c.color, fontSize: compact ? 10 : 11, padding: compact ? '2px 6px' : '4px 8px', borderRadius: 5, border: it.myResponse === 'pending' ? `1px dashed ${c.bar}` : 'none', borderLeft: compact ? (it.myResponse === 'pending' ? `1px dashed ${c.bar}` : 'none') : `3px solid ${c.bar}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans', fontWeight: 500, minWidth: 0 }}>
        {Icon && <Icon size={compact ? 10 : 11} style={{ flexShrink: 0 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.startTime ? `${it.startTime} ` : ''}{it.title}</span>
      </button>
    );
  };

  const itemRow = (it) => {
    const c = EVENT_COLORS[it.color] || EVENT_COLORS.gold;
    const Icon = it.kind === 'task' ? ClipboardList : it.category === 'Training' ? Dumbbell : null;
    return (
      <button key={it.id} type="button" data-cal-item={it.kind} data-pending={it.myResponse === 'pending' ? '1' : undefined} onClick={ev => { ev.stopPropagation(); openItem(it); }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: it.myResponse === 'pending' ? `1px dashed ${c.bar}` : '1px solid var(--border-subtle)', borderLeft: `3px ${it.myResponse === 'pending' ? 'dashed' : 'solid'} ${c.bar}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans' }}>
        <span style={{ minWidth: 48, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{it.startTime || t('calendar.allDay')}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{Icon && <Icon size={13} color={c.color} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span></span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {[it.startTime && it.endTime ? `${it.startTime}-${it.endTime}` : null, it.location, it.kind === 'event' && !it.isPrivate && it.assignedStaff?.length ? staffLabel(it.assignedStaff) : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        {it.myResponse === 'pending'
          ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: '1px dashed var(--accent-gold)', color: 'var(--accent-gold)', flexShrink: 0 }}>{t('calendar.awaitingYou')}</span>
          : <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, flexShrink: 0 }}>{t(CATEGORY_KEYS[it.category] || 'calendar.catEvent')}</span>}
      </button>
    );
  };

  const addHere = (ds) => canAddOn(ds) && (
    <button type="button" onClick={() => openAdd(ds)} style={{ ...secondaryBtn, justifyContent: 'center', width: '100%', borderStyle: 'dashed', color: 'var(--text-secondary)' }}>
      <Plus size={13} /> {t('calendar.addOnDay', { day: capFirst(new Date(`${ds}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })) })}
    </button>
  );

  // Month: a grid of days; tap a day to add (desktop), or to see it (phone)
  const monthView = (() => {
    const first = new Date(fd.getFullYear(), fd.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const gridStart = addDaysStr(dayStr(first), -lead);
    const cells = Array.from({ length: 42 }, (_, i) => addDaysStr(gridStart, i));
    const inMonth = (ds) => ds.slice(0, 7) === dayStr(first).slice(0, 7);
    if (isMobile) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...cardStyle, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{d.slice(0, 2)}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map(ds => {
                const n = itemsOn(ds).length, sel = ds === focus, isToday = ds === today;
                return (
                  <button key={ds} type="button" data-cal-day={ds} onClick={() => setFocus(ds)}
                    style={{ aspectRatio: '1', borderRadius: 10, border: sel ? '1px solid var(--accent-gold)' : '1px solid transparent', background: isToday ? 'var(--accent-gold)' : sel ? 'var(--accent-gold-dim)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', opacity: inMonth(ds) ? (ds < today ? 0.55 : 1) : 0.3, fontFamily: 'DM Sans' }}>
                    <span style={{ fontSize: 13, fontWeight: isToday || sel ? 700 : 500, color: isToday ? '#0a0a0f' : 'var(--text-primary)' }}>{Number(ds.slice(8))}</span>
                    <span style={{ display: 'flex', gap: 2, height: 4 }}>{Array.from({ length: Math.min(n, 3) }, (_, i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: isToday ? 'var(--on-accent-gold)' : 'var(--accent-gold)' }} />)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: focus === today ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{focus === today ? t('common.today') : capFirst(fd.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
            {itemsOn(focus).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 0' }}>{t('calendar.nothingThisDay')}</div>}
            {itemsOn(focus).map(itemRow)}
            {addHere(focus)}
          </div>
        </div>
      );
    }
    return (
      <div style={cardStyle}>
        <div className="gem-table-scroll">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 560, borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.01)' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 560 }}>
            {cells.map(ds => {
              const isToday = ds === today, list = itemsOn(ds), addable = canAddOn(ds);
              return (
                <div key={ds} data-cal-day={ds} onClick={() => openAdd(ds)}
                  title={addable ? t('calendar.clickToAdd') : undefined}
                  style={{ minHeight: 96, padding: 6, borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', cursor: addable ? 'pointer' : 'default', background: ds < today ? 'rgba(0,0,0,0.06)' : 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (addable) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ds < today ? 'rgba(0,0,0,0.06)' : 'transparent'; }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                    <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 13, fontWeight: isToday ? 700 : 400, background: isToday ? 'var(--accent-gold)' : 'transparent', color: isToday ? 'var(--on-accent-gold)' : ds < today || !inMonth(ds) ? 'var(--text-muted)' : 'var(--text-primary)' }}>{Number(ds.slice(8))}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {list.slice(0, 1).map(it => chipFor(it, true))}
                    {list.length > 1 && (
                      <button type="button" data-more={list.length - 1} onClick={ev => { ev.stopPropagation(); setFocus(ds); setViewMode('day'); }}
                        style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--accent-gold)', background: 'none', border: 'none', textAlign: 'left', padding: '1px 4px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('calendar.plusMore', { n: list.length - 1 })}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  })();

  // Week: one column a day (desktop) or one card a day (phone)
  const weekView = isMobile ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {weekDays.map(ds => {
        const list = itemsOn(ds), isToday = ds === today;
        return (
          <div key={ds} data-cal-day={ds} style={{ ...cardStyle, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, opacity: ds < today ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans' }}>{capFirst(new Date(`${ds}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }))}</span>
              {canAddOn(ds) && <button type="button" aria-label={t('calendar.addOnDay', { day: ds })} onClick={() => openAdd(ds)} style={{ ...secondaryBtn, padding: '4px 10px' }}><Plus size={13} /></button>}
            </div>
            {list.length ? list.map(itemRow) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('calendar.nothingThisDay')}</div>}
          </div>
        );
      })}
    </div>
  ) : (
    <div style={cardStyle}>
      <div className="gem-table-scroll">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minWidth: 640 }}>
          {weekDays.map((ds, i) => {
            const list = itemsOn(ds), isToday = ds === today, addable = canAddOn(ds);
            return (
              <div key={ds} data-cal-day={ds} onClick={() => openAdd(ds)} title={addable ? t('calendar.clickToAdd') : undefined}
                style={{ borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none', minHeight: 320, cursor: addable ? 'pointer' : 'default', background: ds < today ? 'rgba(0,0,0,0.06)' : 'transparent' }}>
                <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, color: isToday ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 600 }}>
                  {DAYS[i]} {Number(ds.slice(8))}
                </div>
                <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {list.map(it => chipFor(it))}
                  {addable && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0', opacity: 0.7 }}>+ {t('calendar.add')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Day: an hour-by-hour timeline; tap an hour to add then
  const dayView = (() => {
    const list = itemsOn(focus);
    const timed = list.filter(i => toMin(i.startTime) != null), untimed = list.filter(i => toMin(i.startTime) == null);
    const hours = timed.map(i => Math.floor(toMin(i.startTime) / 60));
    const from = Math.min(6, ...hours), to = Math.max(22, ...hours);
    const rows = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    return (
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {untimed.length > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'flex-start' }}>
            <span style={{ width: 48, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', paddingTop: 4 }}>{t('calendar.allDay')}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>{untimed.map(it => chipFor(it))}</div>
          </div>
        )}
        {rows.map(h => {
          const inHour = timed.filter(i => Math.floor(toMin(i.startTime) / 60) === h);
          const open = canAddOn(focus) && slotStart(focus, h) !== null;
          return (
            <div key={h} data-cal-hour={h} onClick={() => open && openAdd(focus, h)} title={open ? t('calendar.clickToAdd') : undefined}
              style={{ display: 'flex', gap: 10, padding: '6px 12px', minHeight: 44, borderBottom: '1px solid var(--border-subtle)', cursor: open ? 'pointer' : 'default', background: open ? 'transparent' : 'rgba(0,0,0,0.06)', alignItems: 'flex-start' }}
              onMouseEnter={e => { if (open) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = open ? 'transparent' : 'rgba(0,0,0,0.06)'; }}>
              <span style={{ width: 48, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', paddingTop: 6, flexShrink: 0 }}>{fromMin(h * 60)}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: inHour.length ? 0 : 0 }}>{inHour.map(itemRow)}</div>
            </div>
          );
        })}
      </div>
    );
  })();

  const pendingPanel = onMine && pendingInvites.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent-gold)', marginBottom: 10, fontFamily: 'DM Sans' }}>{t('calendar.awaitingResponse')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {pendingInvites.map(inv => (
          <div key={inv.id} style={{ ...cardStyle, borderColor: 'var(--accent-gold-dim)', padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{inv.title}</div>
            {inv.dueDate && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{new Date(inv.dueDate).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button disabled={respondingId === inv.id} onClick={() => respondToInvite(inv.id, 'Declined')} style={{ ...secondaryBtn, flex: 1, justifyContent: 'center', color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)', opacity: respondingId === inv.id ? 0.6 : 1 }}>{t('calendar.decline')}</button>
              <button disabled={respondingId === inv.id} onClick={() => respondToInvite(inv.id, 'Accepted')} style={{ ...primaryBtn, flex: 1, justifyContent: 'center', opacity: respondingId === inv.id ? 0.6 : 1 }}>{t('calendar.accept')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const viewSwitch = (
    <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, ...(isMobile ? { width: '100%' } : {}) }}>
      {[['month', t('calendar.viewMonth')], ['week', t('calendar.viewWeek')], ['day', t('calendar.viewDay')]].map(([v, label]) => (
        <button key={v} role="tab" aria-selected={viewMode === v} onClick={() => setViewMode(v)}
          style={{ flex: isMobile ? 1 : 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', border: `1px solid ${viewMode === v ? 'var(--accent-gold)' : 'transparent'}`, background: viewMode === v ? 'var(--accent-gold-dim)' : 'transparent', color: viewMode === v ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{label}</button>
      ))}
    </div>
  );
  const tabSwitch = hasOwnCalendar && (
    <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, ...(isMobile ? { width: '100%' } : {}) }}>
      {[['gym', t('calendar.gymCalendar')], ['mine', t('calendar.mySchedule')]].map(([v, label]) => (
        <button key={v} role="tab" aria-selected={calendarTab === v} onClick={() => setCalendarTab(v)}
          style={{ flex: isMobile ? 1 : 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', background: v === calendarTab ? 'var(--accent-gold-dim)' : 'transparent', color: v === calendarTab ? 'var(--accent-gold)' : 'var(--text-secondary)', border: `1px solid ${v === calendarTab ? 'var(--accent-gold)' : 'var(--border-subtle)'}` }}>{label}</button>
      ))}
    </div>
  );
  const navBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(isMobile ? { width: '100%' } : {}) }}>
      <button aria-label={t('calendar.previous')} style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
      <span data-cal-label style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 15 : 17, fontWeight: 700, color: 'var(--text-primary)', minWidth: isMobile ? 0 : 200, flex: isMobile ? 1 : 'none', textAlign: 'center' }}>{navLabel}</span>
      <button aria-label={t('calendar.next')} style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={() => shift(1)}><ChevronRight size={16} /></button>
      <button style={{ ...secondaryBtn, padding: '6px 12px' }} onClick={() => setFocus(today)}>{t('common.today')}</button>
    </div>
  );
  const addLabel = ownDiaryOnly ? t('calendar.addOwnEntry') : t('calendar.addEvent');
  const firstAddDay = focus >= today ? focus : today;

  // ── The add / edit form ──
  const training = form.type === 'training';
  const q = clientSearch.trim().toLowerCase();
  const clientMatches = clients.filter(c => !q || `${c.firstName} ${c.lastName} ${c.memberCode || ''}`.toLowerCase().includes(q));
  const setDuration = (mins) => { if (form.startTime) setF({ endTime: fromMin(toMin(form.startTime) + mins) }); };
  const err = (k) => errors[k] && <div role="alert" data-field-error style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors[k]}</div>;
  const formBody = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isCoach && !editingEvent && (
        <div role="radiogroup" aria-label={t('calendar.entryType')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 4 }}>
          {[['training', t('calendar.typeTraining'), Dumbbell], ['event', t('calendar.typePersonal'), StickyNote]].map(([k, label, Icon]) => (
            <button key={k} type="button" role="radio" aria-checked={form.type === k} onClick={() => setF({ type: k })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12.5, fontWeight: form.type === k ? 700 : 500, background: form.type === k ? 'var(--accent-gold)' : 'transparent', color: form.type === k ? 'var(--on-accent-gold)' : 'var(--text-secondary)' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      {training ? (
        <div>
          <label style={labelStyle}>{t('calendar.clientLabel')} *</label>
          {pickedClient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--accent-gold-glow)', border: '1px solid var(--accent-gold-dim)', marginBottom: 8 }}>
              {pickedClient.photo ? <img src={pickedClient.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} /> : <Avatar firstName={pickedClient.firstName} lastName={pickedClient.lastName} avatarColor={pickedClient.avatarColor} size={30} />}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{pickedClient.firstName} {pickedClient.lastName}</span>
              {!editingEvent && <button type="button" onClick={() => setF({ memberId: '' })} style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }}>{t('calendar.change')}</button>}
            </div>
          )}
          {!pickedClient && (
            clients.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)' }}>{t('calendar.noClients')}</div>
            ) : (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', borderColor: errors.memberId ? 'var(--accent-red)' : 'var(--border-subtle)' }}>
                <div style={{ position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder={t('calendar.searchClients')} aria-label={t('calendar.searchClients')}
                    style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: 32 }} />
                </div>
                <div role="listbox" aria-label={t('calendar.clientLabel')} style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {clientMatches.map(c => (
                    <button key={c.id} type="button" role="option" aria-selected={false} data-client-option onClick={() => setF({ memberId: c.id })}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans' }}>
                      {c.photo ? <img src={c.photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /> : <Avatar firstName={c.firstName} lastName={c.lastName} avatarColor={c.avatarColor} size={28} />}
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</span>
                    </button>
                  ))}
                  {clientMatches.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>{t('coach.noMatch')}</div>}
                </div>
              </div>
            )
          )}
          {err('memberId')}
        </div>
      ) : (
        <div>
          <label style={labelStyle}>{t('calendar.eventTitle')}</label>
          <input style={{ ...inputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={e => setF({ title: e.target.value })} placeholder={ownDiaryOnly ? t('calendar.ownTitlePlaceholder') : t('calendar.eventTitlePlaceholder')} />
          {err('title')}
        </div>
      )}

      {!ownDiaryOnly && (
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('calendar.categories')}</label>
            <select style={inputStyle} value={form.category} onChange={e => setF({ category: e.target.value })}>
              {['Class', 'Appointment', 'Meeting', 'Maintenance', 'Event'].map(val => <option key={val} value={val}>{t(CATEGORY_KEYS[val])}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('calendar.color')}</label>
            <select style={inputStyle} value={form.color} onChange={e => setF({ color: e.target.value })}>
              {[['gold', t('calendar.colorGold')], ['blue', t('calendar.colorBlue')], ['green', t('calendar.colorGreen')], ['red', t('calendar.colorRed')], ['purple', t('calendar.colorPurple')]].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>{t('common.date')} *</label>
        <input type="date" min={today} style={{ ...inputStyle, borderColor: errors.date ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.date} onChange={e => setF({ date: e.target.value })} />
        {err('date')}
      </div>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t('calendar.startTime')}</label>
          <TimeInput style={{ ...inputStyle, borderColor: errors.startTime ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.startTime}
            onChange={e => { const s = e.target.value; const len = toMin(form.endTime) != null && toMin(form.startTime) != null ? toMin(form.endTime) - toMin(form.startTime) : 60; setF({ startTime: s, endTime: s ? fromMin(toMin(s) + (len > 0 ? len : 60)) : form.endTime }); }} />
          {err('startTime')}
        </div>
        <div>
          <label style={labelStyle}>{t('calendar.endTime')}</label>
          <TimeInput style={{ ...inputStyle, borderColor: errors.endTime ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.endTime} onChange={e => setF({ endTime: e.target.value })} />
          {err('endTime')}
        </div>
      </div>
      {form.startTime && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: -8 }}>
          {[30, 45, 60, 90].map(m => {
            const on = toMin(form.endTime) - toMin(form.startTime) === m;
            return <button key={m} type="button" onClick={() => setDuration(m)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontFamily: 'DM Sans', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-gold-dim)' : 'transparent', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: on ? 700 : 500 }}>{t('coach.minutesN', { n: m })}</button>;
          })}
        </div>
      )}
      <div>
        <label style={labelStyle}>{t('calendar.location')}</label>
        <input style={inputStyle} value={form.location || ''} onChange={e => setF({ location: e.target.value })} placeholder={t('calendar.locationPlaceholder')} />
      </div>

      {!ownDiaryOnly && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('calendar.assignedStaff')}</label>
            <button type="button" style={{ ...secondaryBtn, fontSize: 11, padding: '4px 10px' }}
              onClick={() => setF({ assignedStaff: form.assignedStaff.length === assignableStaff.length ? [] : assignableStaff.map(s => s.id) })}>
              {form.assignedStaff.length === assignableStaff.length ? t('calendar.deselectAll') : t('calendar.assignAll')}
            </button>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, maxHeight: 160, overflowY: 'auto', padding: '6px 0' }}>
            {assignableStaff.map(s => {
              const checked = form.assignedStaff.includes(s.id);
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => setF({ assignedStaff: checked ? form.assignedStaff.filter(id => id !== s.id) : [...form.assignedStaff, s.id] })}
                    style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{staffName(s)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{translateRole(s.role)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {form.startTime && form.endTime && (
        <BusyWarning staffIds={ownDiaryOnly ? (myId ? [myId] : []) : form.assignedStaff} date={form.date} start={form.startTime} end={form.endTime} excludeId={editingEvent?.id} />
      )}

      <div>
        <label style={labelStyle}>{training ? t('calendar.trainingPlan') : t('tasks.descriptionLabel')}</label>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => setF({ description: e.target.value })} placeholder={training ? t('calendar.trainingPlanPh') : t('calendar.eventDescriptionPlaceholder')} />
      </div>
      {!editingEvent && (
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: form.repeat !== 'None' ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('calendar.repeat')}</label>
            <select style={inputStyle} value={form.repeat} onChange={e => setF({ repeat: e.target.value, repeatUntil: '' })}>
              {[['None', t('calendar.repeatNone')], ['Daily', t('calendar.repeatDaily')], ['Weekly', t('calendar.repeatWeekly')], ['Monthly', t('calendar.repeatMonthly')]].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          {form.repeat !== 'None' && (
            <div>
              <label style={labelStyle}>{t('calendar.repeatUntil')}</label>
              <input type="date" style={{ ...inputStyle, borderColor: errors.repeatUntil ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.repeatUntil} min={form.date || today} max={addDaysStr(form.date || today, 366)} onChange={e => setF({ repeatUntil: e.target.value })} />
              {err('repeatUntil')}
            </div>
          )}
        </div>
      )}
      {errors.save && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{errors.save}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, flexWrap: 'wrap' }}>
        {editingEvent && <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)', marginRight: 'auto' }} onClick={() => requestDelete(editingEvent)}>{t('common.delete')}</button>}
        <button style={secondaryBtn} onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>{saving ? t('common.saving') : t('calendar.saveEvent')}</button>
      </div>
    </div>
  );

  const ev = selectedEvent;
  const evColors = ev ? (EVENT_COLORS[ev.color] || EVENT_COLORS.gold) : null;

  return (
    <div className="page-fade" style={isMobile ? { padding: '16px 16px 96px' } : undefined}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('calendar.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{onMine ? t('calendar.mineSubtitle') : hasOwnCalendar ? t('calendar.gymSubtitle') : t('calendar.manageClasses')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {tabSwitch}
          {!isMobile && canAddHere && <button style={primaryBtn} onClick={() => openAdd(firstAddDay)}><Plus size={13} />{addLabel}</button>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
        {navBar}
        {viewSwitch}
      </div>

      {actionError && !ev && <div role="alert" style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{actionError}</div>}
      {pendingPanel}
      {viewMode === 'month' && monthView}
      {viewMode === 'week' && weekView}
      {viewMode === 'day' && dayView}

      {isMobile && canAddHere && <FAB onClick={() => openAdd(firstAddDay)} label={addLabel} />}

      {/* Add / edit */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingEvent ? t('calendar.editEvent') : addLabel} maxWidth={540}>
        {formBody}
      </Modal>

      {/* Details */}
      {ev && (
        <Modal open={!!ev} onClose={() => { setSelectedEvent(null); setActionError(''); }} title={t('calendar.eventDetails')} maxWidth={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 4, height: 48, background: evColors.bar, borderRadius: 2 }} />
              <div>
                <div style={{ fontSize: 18, fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t(CATEGORY_KEYS[ev.category] || 'calendar.catEvent')}{ev.isPrivate ? ` · ${t('calendar.onlyYou')}` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Clock size={14} color="var(--text-muted)" />
                {capFirst(new Date(`${ev.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))} · {ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ''}
              </div>
              {ev.member && (
                <button type="button" onClick={() => navigate(`/members/${ev.member.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--accent-gold)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
                  <Dumbbell size={14} /> {t('calendar.trainingWith', { name: `${ev.member.firstName} ${ev.member.lastName}` })}
                </button>
              )}
              {ev.location && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><MapPin size={14} color="var(--text-muted)" />{ev.location}</div>}
              {ev.seriesId && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}><RepeatIcon size={14} color="var(--text-muted)" />{t('calendar.partOfSeriesShort')}</div>}
              {!ev.isPrivate && ev.assignedStaff?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <User size={14} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ev.assignedStaff.map(id => {
                      const s = staffList.find(x => x.id === id);
                      const resp = ev.responses?.find(r => String(r.staffId) === String(id));
                      const tone = resp?.status === 'accepted' ? { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' } : resp?.status === 'declined' ? { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' } : { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' };
                      const statusLabel = resp ? (resp.status === 'accepted' ? t('calendar.accepted') : resp.status === 'declined' ? t('calendar.declined') : t('calendar.awaiting')) : null;
                      return <span key={id} style={{ background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>{s ? staffName(s) : id}{statusLabel ? ` · ${statusLabel}` : ''}</span>;
                    })}
                  </div>
                </div>
              )}
              {ev.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{ev.description}</div>}
            </div>
            {ev.myResponse === 'pending' && inviteFor(ev) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--accent-gold)', background: 'var(--accent-gold-glow)' }}>
                <span style={{ flex: '1 1 160px', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{t('calendar.answerInvite')}</span>
                <button disabled={respondingId === inviteFor(ev).id} onClick={async () => { if (await respondToInvite(inviteFor(ev).id, 'Declined')) setSelectedEvent(null); }} style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }}>{t('calendar.decline')}</button>
                <button disabled={respondingId === inviteFor(ev).id} onClick={async () => { if (await respondToInvite(inviteFor(ev).id, 'Accepted')) setSelectedEvent(null); }} style={primaryBtn}>{t('calendar.accept')}</button>
              </div>
            )}
            {actionError && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Sans' }}>{actionError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
              {canEdit(ev) && <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }} onClick={() => requestDelete(ev)}>{t('common.delete')}</button>}
              {canEdit(ev) && <button style={secondaryBtn} onClick={() => openEdit(ev)}>{t('common.edit')}</button>}
              <button style={primaryBtn} onClick={() => setSelectedEvent(null)}>{t('common.close')}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => handleDeleteEvent(confirmDelete, false)} title={t('calendar.deleteEvent')} message={t('common.deleteNamedQ', { name: confirmDelete?.title || '' })} />

      {/* Delete series choice */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('calendar.deleteEvent')} maxWidth={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.title}</strong> {t('calendar.partOfSeries')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ ...secondaryBtn, flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '12px 16px', borderRadius: 10, width: '100%' }} onClick={() => handleDeleteEvent(deleteTarget, false)}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('calendar.deleteThisOnly')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 }}>{t('calendar.deleteThisOnlyDesc')}</div>
            </button>
            <button style={{ ...secondaryBtn, flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '12px 16px', borderRadius: 10, width: '100%', borderColor: 'rgba(239,68,68,0.35)', color: 'var(--accent-red)' }} onClick={() => handleDeleteEvent(deleteTarget, true)}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('calendar.deleteAllSeries')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 }}>{t('calendar.deleteAllSeriesDesc')}</div>
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
