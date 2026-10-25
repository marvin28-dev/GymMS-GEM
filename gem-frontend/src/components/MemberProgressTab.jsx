import { useState, useEffect } from 'react';
import { Dumbbell, Ruler, StickyNote, Plus, Trash2, Activity, BellRing, CalendarX, TrendingUp, TrendingDown, Minus, Target, Pencil } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';
import TrendChart from './ui/TrendChart';
import WeekBars from './ui/WeekBars';
import RowMenu from './ui/RowMenu';
import ConfirmModal from './ui/ConfirmModal';
import TrackPill from './ui/TrackPill';
import LogProgressModal from './LogProgressModal';
import GoalsModal from './GoalsModal';
import { getProgress, removeProgress } from '../services/coach.service';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { getAuth, getRole } from '../utils/auth';
import { isFitness } from '../utils/rolePages';
import { membershipEnded, hasGoals, trackOf, reasonLines } from '../utils/coaching';
import { fmtDate, dayStr, todayStr, addDaysStr, capFirst, getDateLocale } from '../utils/date';
import LoadFailed from './ui/LoadFailed';

const COACHING = ['general_manager', 'manager', 'trainer', 'instructor', 'coach'];
const MANAGEMENT = ['general_manager', 'manager'];
const KIND_ICON = { session: Dumbbell, measure: Ruler, note: StickyNote, followup: BellRing };
// One colour and icon per kind, the same in the log popups and the history
const KIND_STYLE = {
  session:  { icon: Dumbbell,   color: 'var(--accent-gold)',   dim: 'var(--accent-gold-dim)' },
  measure:  { icon: Ruler,      color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)' },
  note:     { icon: StickyNote, color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)' },
  followup: { icon: BellRing,   color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
};
const HISTORY_FILTERS = [
  { key: 'all', labelKey: 'coach.filterAll', color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)' },
  { key: 'session', labelKey: 'coach.filterSessions', ...KIND_STYLE.session },
  { key: 'measure', labelKey: 'coach.filterMeasures', ...KIND_STYLE.measure },
  { key: 'note', labelKey: 'coach.filterNotes', ...KIND_STYLE.note },
  { key: 'followup', labelKey: 'coach.filterFollowups', ...KIND_STYLE.followup },
];
const EFFORT_TONE = {
  easy:     { color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)' },
  moderate: { color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
  hard:     { color: 'var(--accent-red)',    dim: 'var(--accent-red-dim)' },
};
const METRICS = [
  { key: 'weight',  unit: 'kg', color: 'var(--accent-gold)',   labelKey: 'coach.weight' },
  { key: 'bodyFat', unit: '%',  color: 'var(--accent-blue)',   labelKey: 'coach.bodyFat' },
  { key: 'waist',   unit: 'cm', color: 'var(--accent-green)',  labelKey: 'coach.waist' },
  { key: 'hips',    unit: 'cm', color: 'var(--accent-purple)', labelKey: 'coach.hips' },
  { key: 'chest',   unit: 'cm', color: 'var(--accent-red)',    labelKey: 'coach.chest' },
];
const RANGES = [['3m', 91, 'coach.range3m'], ['6m', 182, 'coach.range6m'], ['1y', 365, 'coach.range1y'], ['all', null, 'coach.rangeAll']];
const WEEKS = 12;

const round1 = (v) => Math.round(v * 10) / 10;
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(round1(v))}`;
// The Monday a day falls in, as a local day
function weekOf(d) {
  const x = new Date(`${dayStr(d)}T00:00:00`);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayStr(x);
}

// A member's progress as their coach records it: what they are working
// towards and how far they have come, a trend for each measurement, how often
// they train with a coach and come in, and every entry. Anyone who can open the
// member reads it; coaches and managers add to it, but a coach can't once the
// membership has ended.
export default function MemberProgressTab({ member, visits = [], onGoalsChanged }) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const role = getRole();
  const me = getAuth()?.user?.id;
  const ended = membershipEnded(member);
  const lockedForMe = isFitness(role) && ended;
  const canLog = COACHING.includes(role) && !lockedForMe;
  const canSetGoals = canLog && (String(member.coachId) === String(me) || MANAGEMENT.includes(role)) && !!member.coachId;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logKind, setLogKind] = useState(null);
  const [goalsMode, setGoalsMode] = useState(null);
  const [metric, setMetric] = useState(null);
  const [range, setRange] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [noteTopic, setNoteTopic] = useState('all');
  const [error, setError] = useState('');
  // A failed load says so, instead of "No progress yet"
  const [loadFailed, setLoadFailed] = useState(false);

  const load = () => getProgress(member.id)
    .then(r => { setLogs(r.data || []); setLoadFailed(false); })
    .catch(() => setLoadFailed(true))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [member.id]);
  useLiveRefresh(load, ['coach']);

  const measures = logs.filter(l => l.kind === 'measure').slice().reverse();
  const seriesOf = (field) => measures.filter(l => l[field] != null).map(l => ({ date: l.date, value: l[field] }));
  const series = Object.fromEntries(METRICS.map(m => [m.key, seriesOf(m.key)]));
  const shownMetrics = METRICS.filter(m => m.key === 'weight' || m.key === 'bodyFat' || m.key === 'waist' || series[m.key].length);
  const activeMetric = metric || METRICS.find(m => series[m.key].length)?.key || 'weight';
  const meta = METRICS.find(m => m.key === activeMetric);
  const days = RANGES.find(r => r[0] === range)?.[1];
  const from = days ? addDaysStr(todayStr(), -days) : null;
  const pts = series[activeMetric].filter(p => !from || dayStr(p.date) >= from);

  const first = pts[0], last = pts[pts.length - 1];
  const recent = pts.filter(p => dayStr(p.date) >= addDaysStr(todayStr(), -30));
  const stats = [
    [t('coach.statStart'), first ? `${round1(first.value)} ${meta.unit}` : '-', first ? fmtDate(first.date, { day: 'numeric', month: 'short' }) : ''],
    [t('coach.statNow'), last ? `${round1(last.value)} ${meta.unit}` : '-', last ? fmtDate(last.date, { day: 'numeric', month: 'short' }) : ''],
    [t('coach.statChange'), pts.length > 1 ? `${signed(last.value - first.value)} ${meta.unit}` : '-', null, pts.length > 1 ? last.value - first.value : null],
    [t('coach.statLast30'), recent.length > 1 ? `${signed(recent[recent.length - 1].value - recent[0].value)} ${meta.unit}` : '-', null, recent.length > 1 ? recent[recent.length - 1].value - recent[0].value : null],
    [t('coach.statLowest'), pts.length ? `${round1(Math.min(...pts.map(p => p.value)))} ${meta.unit}` : '-'],
    [t('coach.statHighest'), pts.length ? `${round1(Math.max(...pts.map(p => p.value)))} ${meta.unit}` : '-'],
  ];

  const latestOf = (field) => { for (let i = measures.length - 1; i >= 0; i--) if (measures[i][field] != null) return measures[i]; return null; };
  const latestWeight = latestOf('weight'), latestFat = latestOf('bodyFat'), latestWaist = latestOf('waist');
  const latestEntry = measures[measures.length - 1] || null;
  const changeOf = (field) => { const s = series[field]; return s.length > 1 ? s[s.length - 1].value - s[0].value : null; };
  const sessions = logs.filter(l => l.kind === 'session');
  const monthKey = todayStr().slice(0, 7);
  const sessionsMonth = sessions.filter(l => dayStr(l.date).slice(0, 7) === monthKey).length;

  const thisWeek = weekOf(new Date());
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDaysStr(thisWeek, -7 * (WEEKS - 1 - i)));
  const countWeeks = (dates) => {
    const by = new Map();
    dates.forEach(d => { const w = weekOf(d); by.set(w, (by.get(w) || 0) + 1); });
    return weekStarts.map(start => ({ start, count: by.get(start) || 0 }));
  };
  const sessionWeeks = countWeeks(sessions.map(s => s.date));
  const visitWeeks = countWeeks(visits);
  const avgOf = (weeks) => round1(weeks.reduce((s, w) => s + w.count, 0) / WEEKS);

  // The member as the coaching rules read them (utils/coaching.js)
  const goalSet = member.goalSetAt ? new Date(member.goalSetAt).getTime() - 5 * 60000 : null;
  const baselineEntry = (goalSet != null && measures.find(l => new Date(l.date).getTime() >= goalSet)) || measures[0] || null;
  const twoWeeksAgo = Date.now() - 14 * 86400000;
  const asClient = {
    ...member,
    visitsLast14: visits.filter(v => new Date(v).getTime() >= twoWeeksAgo).length,
    baseline: baselineEntry ? { weight: baselineEntry.weight, waist: baselineEntry.waist, date: baselineEntry.date } : null,
    latestWeight: latestWeight?.weight ?? null, latestWaist: latestWaist?.waist ?? null,
    lastCheckIn: latestEntry?.date || null,
  };
  const track = trackOf(asClient);
  const lastAll = latestEntry ? Object.fromEntries([...METRICS.map(m => [m.key, latestOf(m.key)?.[m.key] ?? null]), ['date', latestEntry.date]]) : null;

  const countOf = (k) => logs.filter(l => l.kind === k).length;
  const shownLogs = logs.filter(l => (historyFilter === 'all' || l.kind === historyFilter) && (historyFilter !== 'note' || noteTopic === 'all' || (l.category || 'general') === noteTopic));
  const months = [];
  for (const l of shownLogs) {
    const k = dayStr(l.date).slice(0, 7);
    const last = months[months.length - 1];
    if (last && last[0] === k) last[1].push(l); else months.push([k, [l]]);
  }
  // How a measurement moved since the check-in before it
  const deltaOf = (l, field) => {
    const i = measures.findIndex(x => x.id === l.id);
    for (let j = i - 1; j >= 0; j--) if (measures[j][field] != null) return Math.round((l[field] - measures[j][field]) * 10) / 10;
    return null;
  };
  // A focus the coach typed under Other shows as written
  const focusName = (f) => (['full_body', 'upper', 'lower', 'core', 'cardio', 'strength', 'mobility', 'technique'].includes(f) ? t(`coach.focus_${f}`) : f);
  const kindLabel = (l) => (l.kind === 'note' && l.category && l.category !== 'general' ? t(`coach.noteCat_${l.category}`)
    : { session: t('coach.kindSession'), measure: t('coach.kindMeasure'), note: t('coach.kindNote'), followup: t('coach.kindFollowup') }[l.kind] || t('coach.kindNote'));

  const [toDelete, setToDelete] = useState(null);
  const remove = async (id) => {
    setError('');
    setLogs(prev => prev.filter(l => l.id !== id));
    try { await removeProgress(id); } catch (err) { setError(err?.response?.data?.error || t('coach.saveFailed')); load(); }
  };

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
  const label = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' };
  const pill = (on) => ({ padding: '5px 11px', borderRadius: 20, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: on ? 700 : 500, border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-gold-dim)' : 'transparent', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)', whiteSpace: 'nowrap' });
  const ChangeIcon = ({ v }) => { const I = v < 0 ? TrendingDown : v > 0 ? TrendingUp : Minus; return <I size={12} />; };

  const tile = (title, value, sub, change, unit) => (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{value}</div>
      {change != null ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}>
          <ChangeIcon v={change} /> {t('coach.sinceStartShort', { v: `${signed(change)} ${unit}` })}
        </div>
      ) : sub ? <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{sub}</div> : null}
    </div>
  );

  // How far a measurement has come from where it started to its goal
  const goalBar = (title, unit, start, now, goal, color) => {
    if (goal == null) return null;
    const gap = start != null ? goal - start : null;
    const done = gap ? Math.max(0, Math.min(1, ((now ?? start) - start) / gap)) : (now != null && Math.abs(now - goal) <= 1 ? 1 : 0);
    const left = now != null ? round1(Math.abs(goal - now)) : null;
    return (
      <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'DM Sans' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{left != null && left > 0 ? t('coach.toGo', { v: `${left} ${unit}` }) : left === 0 ? t('coach.reached') : ''}</span>
        </div>
        <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)} style={{ height: 8, borderRadius: 8, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(done * 100, done > 0 ? 4 : 0)}%`, height: '100%', background: color, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', fontVariantNumeric: 'tabular-nums' }}>
          <span>{t('coach.statStart')} {start != null ? `${start} ${unit}` : '-'}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{now != null ? `${now} ${unit}` : '-'}</span>
          <span>{t('coach.goalShort')} {goal} {unit}</span>
        </div>
      </div>
    );
  };

  const perWeek = round1(asClient.visitsLast14 / 2);
  const goalsCard = hasGoals(member) ? (
    <section style={{ ...card, padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 14 }} aria-label={t('coach.goalsTitle')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}><Target size={15} color="var(--accent-gold)" /> {t('coach.goalsTitle')}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)', borderRadius: 20, padding: '2px 10px', fontFamily: 'DM Sans' }}>{t(`coach.goal_${member.goalType}`)}</span>
        <TrackPill track={track} />
        {canSetGoals && (
          <button onClick={() => setGoalsMode('edit')} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            <Pencil size={12} /> {t('coach.editGoals')}
          </button>
        )}
      </div>
      {reasonLines(track, t).length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{reasonLines(track, t).join(' · ')}</div>
      )}
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 16 : 22 }}>
        {goalBar(t('coach.weight'), 'kg', asClient.baseline?.weight ?? null, latestWeight?.weight ?? null, member.goalWeight, 'var(--accent-gold)')}
        {goalBar(t('coach.waist'), 'cm', asClient.baseline?.waist ?? null, latestWaist?.waist ?? null, member.goalWaist, 'var(--accent-green)')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'DM Sans' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('coach.trainingPerWeek')}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('coach.last2Weeks')}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }} aria-label={t('coach.rTrain', { n: perWeek, target: member.goalSessionsPerWeek })}>
            {Array.from({ length: member.goalSessionsPerWeek }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 8, borderRadius: 8, background: i < Math.floor(perWeek) ? 'var(--accent-blue)' : i < perWeek ? 'linear-gradient(90deg, var(--accent-blue) 50%, var(--bg-elevated) 50%)' : 'var(--bg-elevated)' }} />
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
            <b style={{ color: 'var(--text-primary)' }}>{perWeek}</b> {t('coach.ofTargetPerWeek', { n: member.goalSessionsPerWeek })}
          </div>
        </div>
      </div>
      {(member.goalTargetDate || member.goalNote || member.goalBodyFat != null) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          {member.goalTargetDate && <span>{t('coach.targetBy', { date: fmtDate(member.goalTargetDate) })}</span>}
          {member.goalBodyFat != null && <span>{t('coach.goalFat', { n: member.goalBodyFat })}</span>}
          {member.goalNote && <span style={{ flexBasis: '100%', color: 'var(--text-primary)' }}>{member.goalNote}</span>}
        </div>
      )}
    </section>
  ) : (
    <section style={{ ...card, padding: isMobile ? 14 : 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} aria-label={t('coach.goalsTitle')}>
      <Target size={18} color="var(--accent-blue)" />
      <div style={{ flex: '1 1 220px', fontFamily: 'DM Sans' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('coach.noGoalsTitle')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{canSetGoals ? t('coach.noGoalsHint') : member.coachId ? t('coach.noGoalsRead') : t('coach.noGoalsNoCoach')}</div>
      </div>
      {canSetGoals && (
        <button onClick={() => setGoalsMode('set')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>
          <Target size={13} /> {t('coach.setGoals')}
        </button>
      )}
    </section>
  );


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {loadFailed && <LoadFailed message={t('coach.progressLoadFailed')} onRetry={load} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--accent-gold)" /> {t('coach.progressTitle')}
        </div>
        {canLog && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['session', t('coach.logSession')], ['measure', t('coach.logMeasure')], ['note', t('coach.logNote')]].map(([k, text]) => {
              const { icon: Icon, color, dim } = KIND_STYLE[k];
              return (
                <button key={k} data-log-open={k} onClick={() => setLogKind(k)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer', border: `1px solid ${color}`, background: dim, color }}>
                  <Plus size={12} /><Icon size={13} /> {text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lockedForMe && (
        <div role="note" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
          <CalendarX size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} /> {t('coach.endedNoLog')}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{error}</div>}

      {!ended && goalsCard}

      {/* Latest figures */}
      <div className="gem-pay-tiles" style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: 10 }}>
        {tile(t('coach.weight'), latestWeight ? `${latestWeight.weight} kg` : '-', latestWeight ? fmtDate(latestWeight.date) : t('coach.noMeasureYet'), changeOf('weight'), 'kg')}
        {tile(t('coach.bodyFat'), latestFat ? `${latestFat.bodyFat}%` : '-', latestFat ? fmtDate(latestFat.date) : t('coach.noMeasureYet'), changeOf('bodyFat'), '%')}
        {tile(t('coach.waist'), latestWaist ? `${latestWaist.waist} cm` : '-', latestWaist ? fmtDate(latestWaist.date) : t('coach.noMeasureYet'), changeOf('waist'), 'cm')}
        {tile(t('coach.sessions'), sessionsMonth, t('coach.sessionsTotal', { n: sessions.length }))}
      </div>

      {/* One measurement over time */}
      <section style={{ ...card, padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 14 }} aria-label={t('coach.measurements')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div role="tablist" style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 3, flexWrap: 'wrap' }}>
            {shownMetrics.map(m => {
              const on = m.key === activeMetric;
              return (
                <button key={m.key} role="tab" aria-selected={on} onClick={() => setMetric(m.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? 'var(--bg-card)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />{t(m.labelKey)}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RANGES.map(([k, , key]) => <button key={k} onClick={() => setRange(k)} aria-pressed={range === k} style={pill(range === k)}>{t(key)}</button>)}
          </div>
        </div>
        {pts.length === 0 ? (
          <div style={{ padding: '26px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('coach.noMetricYet')}</div>
        ) : (
          <>
            <TrendChart points={pts} unit={meta.unit} color={meta.color} height={isMobile ? 170 : 210} />
            {pts.length === 1 && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>{t('coach.needTwo')}</div>}
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, minmax(0, 1fr))`, gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
          {stats.map(([title, value, sub, change]) => (
            <div key={title} style={{ background: 'var(--bg-card)', padding: '9px 10px', minWidth: 0 }}>
              <div style={{ ...label, fontSize: 9.5, letterSpacing: '0.6px' }}>{title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: change != null ? meta.color : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {change != null && <ChangeIcon v={change} />}{value}
              </div>
              {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 1 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* How often they train */}
      <section style={{ ...card, padding: isMobile ? 14 : 18 }} aria-label={t('coach.training')}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{t('coach.training')}</div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 18 : 24 }}>
          {[
            [t('coach.sessionsPerWeek'), sessionWeeks, 'var(--accent-gold)'],
            [t('coach.visitsPerWeek'), visitWeeks, 'var(--accent-green)'],
          ].map(([title, weeks, color]) => (
            <div key={title} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8, fontFamily: 'DM Sans' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('coach.thisWeekN', { n: weeks[weeks.length - 1].count })}</span>
              </div>
              <WeekBars weeks={weeks} color={color} label={title} />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 6 }}>{t('coach.perWeekAvg', { n: avgOf(weeks) })}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Every entry: filter by kind (and a note's topic), grouped by month on a timeline */}
      <section style={{ ...card, overflow: 'hidden' }} aria-label={t('coach.historyTitle')}>
        <div style={{ padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('coach.historyTitle')}</div>
          <div role="tablist" aria-label={t('coach.historyTitle')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HISTORY_FILTERS.filter(f => f.key === 'all' || f.key !== 'followup' || countOf('followup')).map(f => {
              const on = historyFilter === f.key;
              const c = f.key === 'all' ? logs.length : countOf(f.key);
              return (
                <button key={f.key} role="tab" aria-selected={on} data-history-filter={f.key} onClick={() => { setHistoryFilter(f.key); setNoteTopic('all'); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: on ? 700 : 500, border: `1px solid ${on ? f.color : 'var(--border-subtle)'}`, background: on ? f.dim : 'transparent', color: on ? f.color : 'var(--text-secondary)' }}>
                  {f.icon && <f.icon size={12} />}{t(f.labelKey)}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '0 6px', borderRadius: 10, background: on ? 'var(--bg-card)' : 'var(--bg-elevated)', color: on ? f.color : 'var(--text-muted)' }}>{c}</span>
                </button>
              );
            })}
          </div>
          {historyFilter === 'note' && countOf('note') > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'general', 'injury', 'nutrition', 'motivation'].map(k => {
                const on = noteTopic === k;
                return (
                  <button key={k} onClick={() => setNoteTopic(k)} aria-pressed={on}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: on ? 700 : 500, border: `1px solid ${on ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-purple-dim)' : 'transparent', color: on ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                    {k === 'all' ? t('coach.allTopics') : t(`coach.noteCat_${k}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {loading ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('common.loading')}</div>
        ) : logs.length === 0 && loadFailed ? null : logs.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontFamily: 'DM Sans' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><Activity size={20} color="var(--text-muted)" /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('coach.noProgressTitle')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{canLog ? t('coach.noProgressHint') : t('coach.noProgressHintRead')}</div>
          </div>
        ) : shownLogs.length === 0 ? (
          <div style={{ padding: '22px 18px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('coach.nothingOfKind')}</div>
        ) : months.map(([monthKey, entries]) => (
          <div key={monthKey} data-history-month={monthKey}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'DM Sans' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{capFirst(new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' }))}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('coach.nEntries', { n: entries.length })}</span>
            </div>
            <div style={{ position: 'relative', padding: isMobile ? '6px 12px 6px 14px' : '8px 18px 8px 22px' }}>
              <div aria-hidden="true" style={{ position: 'absolute', left: isMobile ? 29 : 37, top: 0, bottom: 0, width: 2, background: 'var(--border-subtle)' }} />
              {entries.map(l => {
                const look = KIND_STYLE[l.kind] || KIND_STYLE.note;
                const Icon = look.icon;
                const canDelete = !lockedForMe && (l.staffId === me || MANAGEMENT.includes(role));
                const noteTone = l.kind === 'note' && l.category === 'injury' ? { color: 'var(--accent-red)', dim: 'var(--accent-red-dim)' } : null;
                const color = noteTone?.color || look.color, dim = noteTone?.dim || look.dim;
                return (
                  <div key={l.id} data-log-row={l.kind} style={{ position: 'relative', display: 'flex', gap: 12, padding: '10px 0', alignItems: 'flex-start', fontFamily: 'DM Sans' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-card)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      <Icon size={14} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: dim, color, flexShrink: 0, whiteSpace: 'nowrap' }}>{kindLabel(l)}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' })}{l.staff ? ` · ${l.staff.firstName} ${l.staff.lastName}` : ''}</span>
                        {canDelete && (
                          <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            <RowMenu title={t('common.actions')} items={[{ label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setToDelete(l.id), danger: true }]} />
                          </span>
                        )}
                      </div>
                      {l.kind === 'session' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                          {l.durationMin ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{t('coach.minutesN', { n: l.durationMin })}</span> : null}
                          {l.effort && <span style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: EFFORT_TONE[l.effort]?.dim, color: EFFORT_TONE[l.effort]?.color }}>{t(`coach.effort_${l.effort}`)}</span>}
                          {(l.focus || '').split(',').filter(Boolean).map(f => (
                            <span key={f} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{focusName(f)}</span>
                          ))}
                        </div>
                      )}
                      {l.kind === 'measure' && (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 92 : 104}px, 1fr))`, gap: 6, marginTop: 8 }}>
                          {METRICS.filter(m => l[m.key] != null).map(m => {
                            const d = deltaOf(l, m.key);
                            return (
                              <div key={m.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>{t(m.labelKey)}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{l[m.key]}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}> {m.unit}</span></span>
                                  {d != null && d !== 0 && <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{d > 0 ? '+' : '−'}{Math.abs(d)}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {l.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{l.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => remove(toDelete)} title={t('common.delete')} message={t('common.deleteEntryQ')} />

      <LogProgressModal
        open={!!logKind}
        initialKind={logKind || 'session'}
        member={member}
        last={lastAll}
        onClose={() => setLogKind(null)}
        onSaved={() => load()}
      />
      <GoalsModal open={!!goalsMode} mode={goalsMode || 'set'} member={member} onClose={() => setGoalsMode(null)}
        onSaved={(saved) => { onGoalsChanged?.(saved); load(); }} />
    </div>
  );
}
