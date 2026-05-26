import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Clock, Plus, Download, ChevronDown, Check } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getAll as getTimecards, create as createTimecard } from '../services/timecards.service';
import { getAll as getStaff } from '../services/staff.service';

const staffNameFn = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const card  = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn  = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const thStyle = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '11px 16px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' };

function buildDynamicMonths(n) {
  const now = new Date();
  const months = Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  });
  const prefixMap = {};
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  months.forEach(label => {
    const [mon, yr] = label.split(' ');
    prefixMap[label] = `${yr}-${String(monthNames.indexOf(mon) + 1).padStart(2, '0')}`;
  });
  return { months, prefixMap };
}
const { months: MONTHS, prefixMap: MONTH_PREFIX } = buildDynamicMonths(6);

function mapCard(c) {
  const pIn = c.punchIn ? new Date(c.punchIn) : null;
  const pOut = c.punchOut ? new Date(c.punchOut) : null;
  const date = c.date ? String(c.date).slice(0, 10) : '';
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let hoursWorked = 0, regularHours = 0, overtimeHours = 0;
  if (pIn && pOut) {
    hoursWorked = Number(((pOut - pIn) / 3600000).toFixed(2));
    regularHours = Math.min(8, hoursWorked);
    overtimeHours = Math.max(0, Number((hoursWorked - 8).toFixed(2)));
  }
  return {
    id: c.id, staffId: c.staffId,
    staffName: c.staff ? staffNameFn(c.staff) : c.staffId,
    date, dayName: dayNames[new Date(date).getDay()],
    punchIn: pIn ? pIn.toTimeString().slice(0, 5) : '',
    punchOut: pOut ? pOut.toTimeString().slice(0, 5) : '',
    hoursWorked, regularHours, overtimeHours,
    _shiftStart: c.staff?.shiftStart,
    _staff: c.staff,
  };
}

const avatarColorList = ['gold', 'blue', 'green', 'red', 'purple'];

function hoursColor(h) {
  if (h > 8.5) return 'var(--accent-gold)';
  if (h < 7.5) return 'var(--accent-red)';
  return 'var(--text-primary)';
}

function HoursBadge({ h }) {
  const ot = Math.max(0, h - 8);
  return (
    <span style={{ fontWeight: 600, color: hoursColor(h), fontFamily: 'DM Sans' }}>
      {h.toFixed(2)}h
      {ot > 0 && <span style={{ marginLeft: 4, fontSize: 10, background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', borderRadius: 4, padding: '1px 5px' }}>+{ot.toFixed(2)} OT</span>}
    </span>
  );
}

function StatusDot({ status }) {
  const map = { present: '#22c55e', late: '#eab308', absent: '#ef4444' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: map[status] || map.present, marginRight: 6 }} />;
}

function entryStatus(entry) {
  const [sh, sm] = (entry.shiftStart || '08:00').split(':').map(Number);
  const [ih, im] = entry.punchIn.split(':').map(Number);
  const lateBy = (ih * 60 + im) - (sh * 60 + sm);
  return lateBy > 10 ? 'late' : 'present';
}

export default function TimeCardsPage() {
  const { t } = useLanguage();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ staffId: '', date: '', punchIn: '', punchOut: '' });
  const [localCards, setLocalCards] = useState([]);
  const [savedEntry, setSavedEntry] = useState(false);

  useEffect(() => {
    Promise.all([getTimecards(), getStaff()])
      .then(([tcRes, sRes]) => {
        setLocalCards((tcRes.data || []).map(mapCard));
        const loaded = sRes.data || [];
        setStaffList(loaded);
        if (loaded.length) setAddForm(f => ({ ...f, staffId: loaded[0].id }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const prefix = MONTH_PREFIX[selectedMonth] || MONTH_PREFIX[MONTHS[0]] || '';

  const filtered = useMemo(() => {
    return localCards.filter(c => {
      const monthMatch = c.date.startsWith(prefix);
      const staffMatch = selectedStaff === 'all' || c.staffId === selectedStaff;
      return monthMatch && staffMatch;
    });
  }, [localCards, prefix, selectedStaff]);

  const staffSummary = useMemo(() => {
    return staffList.map(s => {
      const cards = localCards.filter(c => c.staffId === s.id && c.date.startsWith(prefix));
      const totalHours = cards.reduce((sum, c) => sum + c.hoursWorked, 0);
      const totalOT    = cards.reduce((sum, c) => sum + c.overtimeHours, 0);
      const daysWorked = cards.length;
      const avgHours   = daysWorked ? totalHours / daysWorked : 0;
      return { ...s, totalHours, totalOT, daysWorked, avgHours };
    });
  }, [localCards, prefix, staffList]);

  const totalHoursAll = staffSummary.reduce((s, x) => s + x.totalHours, 0);
  const totalOTAll    = staffSummary.reduce((s, x) => s + x.totalOT, 0);
  const totalDaysAll  = staffSummary.reduce((s, x) => s + x.daysWorked, 0);

  const handleAddEntry = async () => {
    const { staffId, date, punchIn, punchOut } = addForm;
    if (!staffId || !date || !punchIn || !punchOut) return;
    try {
      const res = await createTimecard({ staffId, date, punchIn, punchOut });
      setLocalCards(prev => [...prev, mapCard(res.data)]);
      setSavedEntry(true);
      setTimeout(() => {
        setSavedEntry(false); setShowAddModal(false);
        setAddForm({ staffId: staffList[0]?.id || '', date: '', punchIn: '', punchOut: '' });
      }, 1200);
    } catch (err) {
      console.error('Failed to save time entry:', err);
    }
  };

  const handleExportCSV = () => {
    const rows = [['Staff', 'Date', 'Day', 'Punch In', 'Punch Out', 'Hours', 'Regular', 'Overtime', 'Status']];
    filtered.forEach(c => {
      const s = staffList.find(x => x.id === c.staffId);
      rows.push([c.staffName, c.date, c.dayName, c.punchIn, c.punchOut, c.hoursWorked.toFixed(2), c.regularHours.toFixed(2), c.overtimeHours.toFixed(2), entryStatus({ ...c, shiftStart: s?.shiftStart })]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `timecards-${selectedStaff === 'all' ? 'all-staff' : staffSummary.find(x => x.id === selectedStaff)?.staffName || selectedStaff}-${selectedMonth}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const displayCards = selectedStaff === 'all'
    ? filtered.sort((a, b) => a.date.localeCompare(b.date) || a.staffId - b.staffId)
    : filtered.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <PageHeader title={t('timecards.title')} subtitle={`${t('timecards.subtitle')} — ${selectedMonth}`}>
        <button style={secondaryBtn} onClick={handleExportCSV}><Download size={13} />{t('timecards.exportCsv')}</button>
        <button style={{ ...primaryBtn, marginLeft: 8 }} onClick={() => setShowAddModal(true)}><Plus size={13} />{t('timecards.addEntry')}</button>
      </PageHeader>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <select
          value={selectedStaff}
          onChange={e => setSelectedStaff(e.target.value)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minWidth: 200 }}
        >
          <option value="all">{t('common.allStaff')}</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{staffNameFn(s)}</option>)}
        </select>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', minWidth: 140 }}
        >
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('timecards.totalHoursLogged'), value: `${totalHoursAll.toFixed(1)}h`,   accent: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)'   },
          { label: t('timecards.overtimeHours'),   value: `${totalOTAll.toFixed(1)}h`,      accent: 'var(--accent-gold)',   dim: 'var(--accent-gold-dim)'   },
          { label: t('timecards.totalDaysWorked'), value: String(totalDaysAll),              accent: 'var(--accent-green)',  dim: 'var(--accent-green-dim)'  },
          { label: t('timecards.staffTracked'),    value: String(staffList.length),           accent: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)' },
        ].map(c => (
          <div key={c.label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 700, color: c.accent }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Staff summary strip (when "All Staff" selected) */}
      {selectedStaff === 'all' && (
        <div style={{ ...card, marginBottom: 24, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{t('timecards.monthlyOverview')} — {selectedMonth}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {staffSummary.map((s, idx) => {
              const fn = s.firstName || (s.name || '').split(' ')[0] || '';
              const ln = s.lastName || (s.name || '').split(' ')[1] || 'X';
              const ac = s.avatarColor || avatarColorList[idx % avatarColorList.length];
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStaff(s.id)}
                  style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s', border: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Avatar firstName={fn} lastName={ln || 'X'} avatarColor={ac} size={28} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{fn}<br /><span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>{s.role}</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('common.total')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{s.totalHours.toFixed(1)}h</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('timecards.overtime')}</span>
                      <span style={{ fontWeight: 600, color: s.totalOT > 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{s.totalOT.toFixed(1)}h</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('timecards.totalDaysWorked')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.daysWorked}</span>
                    </div>
                    <div style={{ marginTop: 6, height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (s.totalHours / (26 * 8)) * 100).toFixed(0)}%`, background: 'linear-gradient(90deg, #c9a96e, #b08d4a)', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed time card table */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedStaff === 'all' ? t('timecards.allEntries') : staffSummary.find(s => s.id === selectedStaff)?.staffName || selectedStaff} — {selectedMonth}
          </span>
          {selectedStaff !== 'all' && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              {(() => {
                const s = staffSummary.find(x => x.id === selectedStaff);
                return s ? <>
                  <span>{t('timecards.days')} <strong style={{ color: 'var(--text-primary)' }}>{s.daysWorked}</strong></span>
                  <span>{t('timecards.total')} <strong style={{ color: 'var(--accent-blue)' }}>{s.totalHours.toFixed(2)}h</strong></span>
                  <span>{t('timecards.overtime')}: <strong style={{ color: s.totalOT > 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{s.totalOT.toFixed(2)}h</strong></span>
                  <span>{t('timecards.avgDay')} <strong style={{ color: 'var(--text-primary)' }}>{s.avgHours.toFixed(2)}h</strong></span>
                </> : null;
              })()}
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('common.date'), t('timecards.day'), ...(selectedStaff === 'all' ? [t('attendance.staff')] : []), t('timecards.punchIn'), t('timecards.punchOut'), t('timecards.hoursWorked'), t('timecards.regular'), t('timecards.overtime'), t('common.status')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCards.length === 0 && (
                <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>{t('timecards.noPeriodEntries')}</td></tr>
              )}
              {displayCards.map(entry => {
                const s = staffList.find(x => x.id === entry.staffId);
                const status = entryStatus({ ...entry, shiftStart: s?.shiftStart || entry._shiftStart });
                const fn = entry._staff?.firstName || entry.staffName.split(' ')[0] || '';
                const ln = entry._staff?.lastName || entry.staffName.split(' ')[1] || 'X';
                return (
                  <tr key={entry.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{entry.date}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{entry.dayName}</td>
                    {selectedStaff === 'all' && (
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar firstName={fn} lastName={ln} avatarColor={s?.avatarColor || avatarColorList[staffList.indexOf(s) % avatarColorList.length] || 'gold'} size={24} />
                          <span style={{ fontSize: 13 }}>{entry.staffName}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', color: status === 'late' ? 'var(--accent-yellow)' : 'var(--text-primary)' }}>{entry.punchIn}</td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{entry.punchOut}</td>
                    <td style={tdStyle}><HoursBadge h={entry.hoursWorked} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{entry.regularHours.toFixed(2)}h</td>
                    <td style={{ ...tdStyle, color: entry.overtimeHours > 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                      {entry.overtimeHours > 0 ? `+${entry.overtimeHours.toFixed(2)}h` : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                        <StatusDot status={status} />{status === 'present' ? t('timecards.onTime') : t('timecards.late')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayCards.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>{t('timecards.entries')} <strong style={{ color: 'var(--text-primary)' }}>{displayCards.length}</strong></span>
            <span>{t('timecards.totalHoursLabel')} <strong style={{ color: 'var(--accent-blue)' }}>{filtered.reduce((s, c) => s + c.hoursWorked, 0).toFixed(2)}h</strong></span>
            <span>{t('timecards.overtime')}: <strong style={{ color: 'var(--accent-gold)' }}>{filtered.reduce((s, c) => s + c.overtimeHours, 0).toFixed(2)}h</strong></span>
          </div>
        )}
      </div>

      {/* Add Manual Entry Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={t('timecards.addManualEntry')} maxWidth={440}>
        {savedEntry ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, background: 'var(--accent-green-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Check size={24} color="var(--accent-green)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>{t('timecards.entrySaved')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <GemSelect
              label={t('timecards.staffMember')}
              value={addForm.staffId}
              onChange={e => setAddForm(f => ({ ...f, staffId: e.target.value }))}
              options={staffList.map(s => ({ value: s.id, label: staffNameFn(s) }))}
            />
            <GemInput label={`${t('common.date')} *`} type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <GemInput label={`${t('timecards.punchIn')} *`} type="time" value={addForm.punchIn} onChange={e => setAddForm(f => ({ ...f, punchIn: e.target.value }))} />
              <GemInput label={`${t('timecards.punchOut')} *`} type="time" value={addForm.punchOut} onChange={e => setAddForm(f => ({ ...f, punchOut: e.target.value }))} />
            </div>
            {addForm.punchIn && addForm.punchOut && (() => {
              const [ih, im] = addForm.punchIn.split(':').map(Number);
              const [oh, om] = addForm.punchOut.split(':').map(Number);
              const h = ((oh * 60 + om) - (ih * 60 + im)) / 60;
              return h > 0 ? (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {t('timecards.hours')} <strong style={{ color: 'var(--accent-blue)' }}>{h.toFixed(2)}h</strong>
                  {h > 8 && <span style={{ marginLeft: 8, color: 'var(--accent-gold)' }}>+{(h - 8).toFixed(2)}h {t('timecards.overtimeLabel')}</span>}
                </div>
              ) : null;
            })()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button style={secondaryBtn} onClick={() => setShowAddModal(false)}>{t('common.cancel')}</button>
              <button style={primaryBtn} onClick={handleAddEntry}>{t('timecards.saveEntry')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
