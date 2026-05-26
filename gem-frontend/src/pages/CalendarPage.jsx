import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import { getAll as getCalendar, create as createEvent, update as updateEvent, remove as removeEvent } from '../services/calendar.service';
import { getAll as getStaff } from '../services/staff.service';

const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

// DAYS and MONTHS are now locale-aware (generated in component using toLocaleDateString)

const EVENT_COLORS = {
  gold: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', bar: '#c9a96e' },
  blue: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', bar: '#60a5fa' },
  green: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)', bar: '#4ade80' },
  red: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)', bar: '#f87171' },
  purple: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', bar: '#a78bfa' },
};

const parseStaffIds = (staffIds) => {
  if (Array.isArray(staffIds)) return staffIds;
  try { return staffIds ? JSON.parse(staffIds) : []; } catch { return []; }
};

const mapEvent = (e) => ({
  id:            e.id,
  title:         e.title,
  category:      e.category  || 'Class',
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
});

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  // Locale-aware day and month helpers
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, i + 1).toLocaleDateString(locale, { weekday: 'short' })
  );
  const getMonthLabel = (year, month) =>
    new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' });

  const today = new Date();
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [events, setEvents] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'Class', date: '', startTime: '', endTime: '', description: '', assignedStaff: [], color: 'gold', repeat: 'None', repeatUntil: '', notes: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Promise.all([getCalendar(), getStaff()])
      .then(([calRes, staffRes]) => {
        setEvents((calRes.data || []).map(mapEvent));
        setStaffList(staffRes.data || []);
      })
      .catch(console.error);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Week view state — start from Monday of today's week
  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const [weekStart, setWeekStart] = useState(() => getMonday(today));
  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEnd = weekDays[6];
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${getMonthLabel(weekStart.getFullYear(), weekStart.getMonth())} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    : `${getMonthLabel(weekStart.getFullYear(), weekStart.getMonth())} ${weekStart.getDate()} – ${getMonthLabel(weekEnd.getFullYear(), weekEnd.getMonth())} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

  const getEventsForDate = (dateStr) => events.filter(e => e.date === dateStr);

  const openAddEvent = (dateStr) => {
    setForm({ title: '', category: 'Class', date: dateStr, startTime: '', endTime: '', description: '', assignedStaff: [], color: 'gold', repeat: 'None', repeatUntil: '', notes: '' });
    setEditingEvent(null);
    setErrors({});
    setShowAddEvent(true);
  };

  const openEditEvent = (evt) => {
    setForm({ ...evt, repeat: 'None', repeatUntil: '' });
    setEditingEvent(evt);
    setShowEventDetail(false);
    setShowAddEvent(true);
  };

  const handleSave = async () => {
    const e = {};
    if (!form.title) e.title = 'Title is required';
    if (!form.date) e.date = 'Date is required';
    if (!form.startTime) e.startTime = 'Start time is required';
    if (!form.endTime) e.endTime = 'End time is required';
    if (form.repeat !== 'None' && !form.repeatUntil) e.repeatUntil = 'Required when repeat is set';
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload = {
      title:        form.title,
      category:     form.category,
      date:         form.date,
      time:         form.startTime,
      duration:     form.endTime || null,
      staffIds:     form.assignedStaff,
      instructorId: form.assignedStaff[0] || null,
      location:     form.location || '',
      color:        form.color,
      description:  form.description || null,
      repeat:       form.repeat !== 'None' ? form.repeat : null,
      repeatUntil:  form.repeat !== 'None' ? form.repeatUntil : null,
    };

    try {
      if (editingEvent) {
        const res = await updateEvent(editingEvent.id, payload);
        setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? mapEvent(res.data) : ev));
      } else {
        const res = await createEvent(payload);
        const created = Array.isArray(res.data) ? res.data : [res.data];
        setEvents(prev => [...prev, ...created.map(mapEvent)]);
      }
    } catch (err) {
      console.error(err);
    }
    setShowAddEvent(false);
  };

  const [deleteTarget, setDeleteTarget] = useState(null); // event to delete

  const requestDelete = (evt) => {
    if (evt.seriesId) {
      setDeleteTarget(evt); // show choice modal
    } else {
      handleDeleteEvent(evt.id, false);
    }
  };

  const handleDeleteEvent = async (id, series = false) => {
    const seriesId = series ? events.find(e => e.id === id)?.seriesId : null;
    try { await removeEvent(id, { series }); } catch {}
    if (series && seriesId) {
      setEvents(prev => prev.filter(e => e.seriesId !== seriesId));
    } else {
      setEvents(prev => prev.filter(e => e.id !== id));
    }
    setDeleteTarget(null);
    setShowEventDetail(false);
  };

  const viewBtnStyle = (v) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: viewMode === v ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
    color: viewMode === v ? 'var(--accent-gold)' : 'var(--text-secondary)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: viewMode === v ? 'var(--accent-gold)' : 'var(--border-subtle)',
  });

  // Build calendar grid
  const calendarCells = [];
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, currentMonth: false, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarCells.push({ day: d, currentMonth: true, dateStr: `${year}-${mm}-${dd}` });
  }
  const remaining = 42 - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    calendarCells.push({ day: d, currentMonth: false, dateStr: null });
  }

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('calendar.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t('calendar.manageClasses')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8 }}>
            {[['month', t('calendar.viewMonth')], ['week', t('calendar.viewWeek')], ['day', t('calendar.viewDay')]].map(([v, label]) => (
              <button key={v} style={viewBtnStyle(v)} onClick={() => setViewMode(v)}>
                {label}
              </button>
            ))}
          </div>
          <button style={primaryBtn} onClick={() => openAddEvent(todayStr)}>
            <Plus size={13} />{t('calendar.addEvent')}
          </button>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div style={cardStyle}>
          {/* Month nav */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={prevMonth}><ChevronLeft size={16} /></button>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {getMonthLabel(year, month)} {year}
            </span>
            <button style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.01)' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {calendarCells.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const cellEvents = cell.dateStr ? getEventsForDate(cell.dateStr) : [];
              return (
                <div
                  key={idx}
                  onClick={() => cell.dateStr && openAddEvent(cell.dateStr)}
                  style={{
                    minHeight: 90, padding: 6, borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                    cursor: cell.currentMonth ? 'pointer' : 'default',
                    background: 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (cell.currentMonth) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                    <span style={{
                      width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', fontSize: 13, fontWeight: isToday ? 700 : 400,
                      background: isToday ? 'var(--accent-gold)' : 'transparent',
                      color: isToday ? '#0a0a0f' : cell.currentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                      {cell.day}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {cellEvents.slice(0, 3).map(evt => {
                      const c = EVENT_COLORS[evt.color] || EVENT_COLORS.gold;
                      return (
                        <div
                          key={evt.id}
                          onClick={e => { e.stopPropagation(); setSelectedEvent(evt); setShowEventDetail(true); }}
                          style={{ background: c.bg, color: c.color, fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
                        >
                          {evt.startTime} {evt.title}
                        </div>
                      );
                    })}
                    {cellEvents.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>+{cellEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={prevWeek}><ChevronLeft size={16} /></button>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('calendar.weekOf')} {weekLabel}
            </span>
            <button style={{ ...secondaryBtn, padding: '6px 10px' }} onClick={nextWeek}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
            {weekDays.map((d, i) => {
              const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const label = `${DAYS[d.getDay()]} ${getMonthLabel(d.getFullYear(), d.getMonth()).slice(0, 3)} ${d.getDate()}`;
              const dayEvents = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;
              return (
                <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none', minHeight: 200 }}>
                  <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, color: isToday ? 'var(--accent-gold)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 600 }}>
                    {label}
                  </div>
                  <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayEvents.map(evt => {
                      const c = EVENT_COLORS[evt.color] || EVENT_COLORS.gold;
                      return (
                        <div key={evt.id} onClick={() => { setSelectedEvent(evt); setShowEventDetail(true); }}
                          style={{ background: c.bg, color: c.color, fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', borderLeft: `3px solid ${c.bar}` }}>
                          <div style={{ fontWeight: 600 }}>{evt.startTime}</div>
                          <div style={{ fontSize: 10 }}>{evt.title}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {today.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            {getEventsForDate(todayStr).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>{t('calendar.noEventsToday')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getEventsForDate(todayStr).map(evt => {
                  const c = EVENT_COLORS[evt.color] || EVENT_COLORS.gold;
                  return (
                    <div key={evt.id} onClick={() => { setSelectedEvent(evt); setShowEventDetail(true); }}
                      style={{ ...cardStyle, padding: 16, display: 'flex', gap: 16, cursor: 'pointer', borderLeft: `4px solid ${c.bar}` }}>
                      <div style={{ minWidth: 60, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent-gold)' }}>{evt.startTime}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{evt.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{evt.assignedStaff.map(id => { const s = staffList.find(x => x.id === id); return s ? staffName(s) : null; }).filter(Boolean).join(', ') || '—'} · {evt.location} · {evt.startTime}–{evt.endTime}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Event Modal */}
      <Modal open={showAddEvent} onClose={() => setShowAddEvent(false)} title={editingEvent ? t('calendar.editEvent') : t('calendar.addEvent')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.eventTitle')}</label>
            <input style={{ ...inputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('calendar.eventTitlePlaceholder')} />
            {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.categories')}</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['Class','Appointment','Meeting','Maintenance','Event'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.color')}</label>
              <select style={inputStyle} value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
                {Object.keys(EVENT_COLORS).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('common.date')} *</label>
            <input type="date" style={{ ...inputStyle, borderColor: errors.date ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            {errors.date && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.date}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.startTime')}</label>
              <input type="time" style={{ ...inputStyle, borderColor: errors.startTime ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              {errors.startTime && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.startTime}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.endTime')}</label>
              <input type="time" style={{ ...inputStyle, borderColor: errors.endTime ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              {errors.endTime && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.endTime}</div>}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('calendar.assignedStaff')}</label>
              <button
                type="button"
                style={{ ...secondaryBtn, fontSize: 11, padding: '4px 10px' }}
                onClick={() => setForm(f => ({
                  ...f,
                  assignedStaff: f.assignedStaff.length === staffList.length ? [] : staffList.map(s => s.id),
                }))}
              >
                {form.assignedStaff.length === staffList.length ? t('calendar.deselectAll') : t('calendar.assignAll')}
              </button>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, maxHeight: 160, overflowY: 'auto', padding: '6px 0' }}>
              {staffList.map(s => {
                const checked = form.assignedStaff.includes(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setForm(f => ({
                        ...f,
                        assignedStaff: checked
                          ? f.assignedStaff.filter(id => id !== s.id)
                          : [...f.assignedStaff, s.id],
                      }))}
                      style={{ accentColor: 'var(--accent-gold)', width: 14, height: 14, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{staffName(s)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.role}</span>
                  </label>
                );
              })}
            </div>
            {form.assignedStaff.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {form.assignedStaff.length} {t('calendar.staffAssigned')}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.descriptionLabel')}</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('calendar.eventDescriptionPlaceholder')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: form.repeat !== 'None' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.repeat')}</label>
              <select style={inputStyle} value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value, repeatUntil: '' }))}>
                {['None','Daily','Weekly','Monthly'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            {form.repeat !== 'None' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.repeatUntil')}</label>
                <input type="date" style={{ ...inputStyle, borderColor: !form.repeatUntil ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.repeatUntil} min={form.date} onChange={e => setForm(f => ({ ...f, repeatUntil: e.target.value }))} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            {editingEvent && (
              <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }} onClick={() => requestDelete(editingEvent)}>{t('common.delete')}</button>
            )}
            <button style={secondaryBtn} onClick={() => setShowAddEvent(false)}>{t('common.cancel')}</button>
            <button style={primaryBtn} onClick={handleSave}>{t('calendar.saveEvent')}</button>
          </div>
        </div>
      </Modal>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <Modal open={showEventDetail} onClose={() => setShowEventDetail(false)} title={t('calendar.eventDetails')} maxWidth={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const c = EVENT_COLORS[selectedEvent.color] || EVENT_COLORS.gold;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 4, height: 48, background: c.bar, borderRadius: 2 }} />
                    <div>
                      <div style={{ fontSize: 18, fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedEvent.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedEvent.category}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      {selectedEvent.date} · {selectedEvent.startTime} – {selectedEvent.endTime}
                    </div>
                    {selectedEvent.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <MapPin size={14} color="var(--text-muted)" />
                        {selectedEvent.location}
                      </div>
                    )}
                    {selectedEvent.assignedStaff?.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <User size={14} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {selectedEvent.assignedStaff.map(id => {
                            const s = staffList.find(x => x.id === id);
                            const name = s ? staffName(s) : id;
                            return (
                              <span key={id} style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedEvent.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{selectedEvent.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button style={{ ...secondaryBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)' }} onClick={() => requestDelete(selectedEvent)}>{t('common.delete')}</button>
                    <button style={secondaryBtn} onClick={() => openEditEvent(selectedEvent)}>{t('common.edit')}</button>
                    <button style={primaryBtn} onClick={() => setShowEventDetail(false)}>{t('common.close')}</button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Delete series choice modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('calendar.deleteEvent')} maxWidth={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.title}</strong> {t('calendar.partOfSeries')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              style={{ ...secondaryBtn, textAlign: 'left', padding: '12px 16px', borderRadius: 10, width: '100%' }}
              onClick={() => handleDeleteEvent(deleteTarget.id, false)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('calendar.deleteThisOnly')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('calendar.deleteThisOnlyDesc')}</div>
            </button>
            <button
              style={{ ...secondaryBtn, textAlign: 'left', padding: '12px 16px', borderRadius: 10, width: '100%', borderColor: 'rgba(239,68,68,0.35)', color: 'var(--accent-red)' }}
              onClick={() => handleDeleteEvent(deleteTarget.id, true)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('calendar.deleteAllSeries')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('calendar.deleteAllSeriesDesc')}</div>
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
